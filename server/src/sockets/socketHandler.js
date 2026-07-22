const rulesEngine = require('../engine/rulesEngine');
const riskEngine = require('../engine/riskEngine');

module.exports = function setupSocketHandlers(agentNs, dashboardNs, db) {

  // In-memory registry: socket.id -> { student_id(string), student_id_num, name, last_frame }
  const connectedAgents = {};

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
