const rulesEngine = require('../engine/rulesEngine');
const riskEngine = require('../engine/riskEngine');

module.exports = function setupSocketHandlers(agentNs, dashboardNs, db) {

  // In-memory registry: socket.id -> { student_id(string), student_id_num, name, last_frame }
  const connectedAgents = {};
  // In-memory ban registry: student_id -> expiryTimestamp (ms)
  const bannedStudents = {};

  // Heartbeat interval: mark agents offline if no ping in 15s
  setInterval(() => {
    const now = Date.now();
    for (const [socketId, agent] of Object.entries(connectedAgents)) {
      if (now - agent.last_seen > 15000) {
        agent.status = 'stale';
      }
    }
  }, 10000);

  // ─── DASHBOARD NAMESPACE ────────────────────────────────────────────────────
  dashboardNs.on('connection', (socket) => {
    console.log(`Dashboard connected: ${socket.id}`);
    socket.join('session:active');

    // Replay all current agents to new dashboard client
    for (const agent of Object.values(connectedAgents)) {
      socket.emit('session:student_joined', {
        student_id: agent.string_id,
        name: agent.name,
        id: agent.num_id
      });
    }

    // Teacher requests remote screen lock for a student
    socket.on('teacher:lock_screen', (data) => {
      const { student_id } = data;
      for (const [sid, agent] of Object.entries(connectedAgents)) {
        if (agent.string_id === student_id) {
          agent.is_locked = true;
          agentNs.to(sid).emit('command:lock_screen');
          dashboardNs.to('session:active').emit('student:lock_status', { student_id, is_locked: true });
          break;
        }
      }
      db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
        ['teacher', 'lock_screen', student_id, 'Remote screen lock triggered']);
    });

    // Teacher requests remote screen unlock for a student
    socket.on('teacher:unlock_screen', (data) => {
      const { student_id } = data;
      for (const [sid, agent] of Object.entries(connectedAgents)) {
        if (agent.string_id === student_id) {
          agent.is_locked = false;
          agentNs.to(sid).emit('command:unlock_screen');
          dashboardNs.to('session:active').emit('student:lock_status', { student_id, is_locked: false });
          break;
        }
      }
      db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
        ['teacher', 'unlock_screen', student_id, 'Remote screen unlock triggered']);
    });

    // Teacher requests to kick a student (disconnect their agent)
    socket.on('teacher:kick_student', (data) => {
      const { student_id } = data;
      // optional duration in minutes (defaults to 5)
      const durationMinutes = Number(data?.duration_minutes || 5);
      const expiry = Date.now() + Math.max(1, durationMinutes) * 60 * 1000;
      for (const [sid, agent] of Object.entries(connectedAgents)) {
        if (agent.string_id === student_id) {
          try {
            // mark temporarily banned to prevent immediate reconnects
            bannedStudents[String(student_id)] = expiry;
          } catch (e) { console.warn('failed to set ban', e); }

          try {
            // Notify the agent first; agent will handle graceful shutdown on receipt
            agentNs.to(sid).emit('command:kickout', { reason: 'Kicked by teacher' });
          } catch (err) { console.warn('Failed to send kick command to agent', err); }

          // Attempt to forcibly disconnect the socket after notifying
          try {
            const targetSocket = agentNs.sockets.get(sid);
            if (targetSocket) targetSocket.disconnect(true);
          } catch (err) { console.warn('Failed to forcibly disconnect agent socket', err); }

          // Update in-memory registry and notify dashboards (include ban expiry)
          delete connectedAgents[sid];
          dashboardNs.to('session:active').emit('session:student_left', { student_id });
          dashboardNs.to('session:active').emit('student:kicked', { student_id, banned_until: new Date(expiry).toISOString() });
          db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
            ['teacher', 'kick_student', student_id, `Teacher forced disconnect (kick). Banned until ${new Date(expiry).toISOString()}`]);
          break;
        }
      }
    });

    socket.on('disconnect', () => {
      console.log(`Dashboard disconnected: ${socket.id}`);
    });
  });

  // ─── AGENT NAMESPACE ────────────────────────────────────────────────────────
  agentNs.on('connection', (socket) => {
    console.log(`Agent socket connected: ${socket.id}`);

    let numId = null;       // numeric DB id
    let stringId = null;    // string roll number e.g. "105"
    const sessionId = 1;

    // Registration
    socket.on('agent:register', async (data) => {
      const { student_id, hostname, ip, mac } = data;
      // Reject registration if student is temporarily banned
      try {
        const banExpiry = bannedStudents[String(student_id)];
        if (banExpiry && Date.now() < banExpiry) {
          // Notify dashboard that banned agent attempted reconnect
          dashboardNs.to('session:active').emit('session:ban_attempt', { student_id, banned_until: new Date(banExpiry).toISOString() });
          // Instruct agent to disconnect and refuse registration
          try { socket.emit('command:kickout', { reason: 'You are temporarily banned by instructor' }); } catch (e) { }
          try { socket.disconnect(true); } catch (e) { }
          try { await db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)', ['system', 'ban_block_reject', student_id, `Rejected registration while banned until ${new Date(banExpiry).toISOString()}`]); } catch (e) { }
          return;
        }
      } catch (e) { console.warn('ban check failed', e); }

      try {
        await db.run(
          `INSERT INTO students (student_id, name, hostname, ip_address, mac_address) VALUES (?, ?, ?, ?, ?) ON CONFLICT(student_id) DO UPDATE SET hostname=?, ip_address=?, mac_address=?`,
          [student_id, `Student ${student_id}`, hostname, ip, mac, hostname, ip, mac]
        );

        const student = await db.get(`SELECT id, student_id FROM students WHERE student_id = ?`, [student_id]);
        numId = student.id;
        stringId = student.student_id;

        connectedAgents[socket.id] = {
          string_id: stringId,
          num_id: numId,
          name: `Student ${stringId}`,
          hostname,
          ip,
          last_seen: Date.now(),
          status: 'online'
        };

        // Update heartbeat
        await db.run('UPDATE agent_heartbeat SET last_seen = ?', [stringId]);

        dashboardNs.to('session:active').emit('session:student_joined', {
          student_id: stringId,
          name: `Student ${stringId}`,
          id: numId,
          hostname,
          ip
        });
        const rule = await db.get('SELECT enabled, threshold_value FROM rules WHERE rule_type = ?', ['blacklisted_app']);
        let keywords = [];
        if (rule && rule.enabled) {
          try {
            const parsed = JSON.parse(rule.threshold_value || '[]');
            keywords = Array.isArray(parsed) ? parsed : [];
          } catch {
            keywords = String(rule.threshold_value || '').split(',').map(s => s.trim()).filter(Boolean);
          }
        }
        socket.emit('command:update_blocklist', { keywords });
        console.log(`Agent registered: ${stringId}`);
      } catch(e) {
        console.error('Registration error:', e);
      }
    });

    // Screen Frame
    socket.on('agent:frame', (data) => {
      if (!stringId) return;
      if (connectedAgents[socket.id]) {
        connectedAgents[socket.id].last_seen = Date.now();
        connectedAgents[socket.id].status = 'online';
        connectedAgents[socket.id].last_frame = data.jpeg_base64; // cache for late-join snapshot
      }
      dashboardNs.to('session:active').emit('frame:update', {
        student_id: stringId,
        jpeg_base64: data.jpeg_base64,
        timestamp: data.timestamp
      });
    });

    // Telemetry
    socket.on('agent:activity', async (data) => {
      if (!numId || !stringId) return;

      const { mouse_delta, keystroke_count, idle_seconds } = data;
      // Immediate detection: check for window spike and AI site keywords and notify dashboard/admin right away
      try {
        const procString = (Array.isArray(data.processes) ? data.processes.join(' ') : String(data.processes || '')).toLowerCase();
        const windowTitle = String(data.active_window || '').toLowerCase();
        const combinedTarget = `${procString} ${windowTitle}`;

        const aiKeywords = ['chatgpt', 'openai', 'gpt', 'instagram', 'bard', 'dalle', 'midjourney', 'perplexity'];
        for (const kw of aiKeywords) {
          if (combinedTarget.includes(kw)) {
            dashboardNs.to('session:active').emit('alert:ai_site', {
              student_id: stringId,
              detail: `AI/managed site detected: ${kw}`,
              timestamp: new Date().toISOString()
            });
            // Send immediate blocklist update to the originating agent to attempt blocking the domain/process
            try {
              socket.emit('command:update_blocklist', { keywords: [kw] });
            } catch (err) { console.warn('Failed to send update_blocklist to agent', err); }
            break;
          }
        }

        const window_count = data.window_count || 0;
        if (window_count > 4) {
          dashboardNs.to('session:active').emit('alert:window_spike', {
            student_id: stringId,
            detail: `Window spike detected: ${window_count} active open windows`,
            timestamp: new Date().toISOString()
          });
        }
      } catch (e) {
        console.warn('Immediate detection error', e);
      }
      const typing_speed = keystroke_count || 0;
      const mouseScore = mouse_delta || 0;
      const overall_activity_score = Math.min(100, Math.floor((mouseScore * 0.05) + (typing_speed * 2)));

      // Persist snapshot
      await db.run(
        `INSERT INTO activity_snapshots (session_id, student_id, mouse_activity_score, typing_speed, idle_seconds, overall_activity_score) VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionId, numId, mouseScore, typing_speed, idle_seconds || 0, overall_activity_score]
      );

      // Evaluate all rules
      const flags = await rulesEngine.evaluate(data, db, stringId);

      if (flags && flags.length > 0) {
        for (const flag of flags) {
          const riskDelta = flag.weight || 10;

          await db.run(
            `INSERT INTO flags (session_id, student_id, rule_type, detail, severity, risk_score_delta) VALUES (?, ?, ?, ?, ?, ?)`,
            [sessionId, numId, flag.rule_type, flag.detail, 'high', riskDelta]
          );

          // Auto-snapshot: capture the latest frame when a flag fires
          const latestFrame = connectedAgents[socket.id]?.last_frame;
          if (latestFrame) {
            await db.run(
              `INSERT INTO snapshots (student_id, session_id, jpeg_base64) VALUES (?, ?, ?)`,
              [stringId, sessionId, latestFrame]
            );
          }

          dashboardNs.to('session:active').emit('flag:new', {
            student_id: stringId,
            rule_type: flag.rule_type,
            detail: flag.detail,
            severity: 'high',
            timestamp: new Date().toISOString()
          });

          // Explicit admin alert for window spike to ensure urgent visibility
          if (flag.rule_type === 'window_spike') {
            try {
              dashboardNs.to('session:active').emit('alert:window_spike', {
                student_id: stringId,
                detail: flag.detail,
                timestamp: new Date().toISOString()
              });
            } catch (err) { console.warn('Failed to emit window_spike alert', err); }
          }
        }

        const newRiskScore = await riskEngine.computeRiskScore(numId, sessionId, db);
        dashboardNs.to('session:active').emit('risk:update', {
          student_id: stringId,
          risk_score: newRiskScore
        });
      }

      dashboardNs.to('session:active').emit('activity:update', {
        student_id: stringId,
        activity_score: overall_activity_score,
        typing_speed,
        idle_seconds: idle_seconds || 0,
        mouse_score: mouseScore
      });
    });

    // Heartbeat ping
    socket.on('agent:ping', () => {
      if (connectedAgents[socket.id]) {
        connectedAgents[socket.id].last_seen = Date.now();
        connectedAgents[socket.id].status = 'online';
      }
    });

    socket.on('disconnect', () => {
      console.log(`Agent disconnected: ${socket.id}`);
      delete connectedAgents[socket.id];
      if (stringId) {
        dashboardNs.to('session:active').emit('session:student_left', { student_id: stringId });
      }
    });
  });

  // Expose connectedAgents for API routes
  return connectedAgents;
};
