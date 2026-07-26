const rulesEngine = require('../engine/rulesEngine');
const riskEngine = require('../engine/riskEngine');
const frozenFrameEngine = require('../engine/frozenFrameEngine');

module.exports = function setupSocketHandlers(agentNs, dashboardNs, db) {

  // In-memory registry: socket.id -> { student_id(string), student_id_num, name, last_frame }
  const connectedAgents = {};
  // In-memory ban registry: student_id -> expiryTimestamp (ms)
  const bannedStudents = {};
  // Persistent registries across agent reconnections
  const lockedStudentIds = new Set();
  const kickedStudentIds = new Set();
  const alertCooldowns = {}; // `${student_id}:${rule_type}` -> timestamp

  // 6-Character Alphanumeric Session Key Generator (e.g. K9X2M7)
  const generateSessionKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let res = '';
    for (let i = 0; i < 6; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  let activeExamSessionKey = generateSessionKey();
  let activeExamSessionId = `SESS-${Math.floor(100000 + Math.random() * 900000)}`;
  let lastSessionRotationTime = Date.now();
  global.activeExamSessionKey = activeExamSessionKey;

  setInterval(() => {
    activeExamSessionKey = generateSessionKey();
    activeExamSessionId = `SESS-${Math.floor(100000 + Math.random() * 900000)}`;
    lastSessionRotationTime = Date.now();
    global.activeExamSessionKey = activeExamSessionKey;
    console.log(`[SESSION_ENGINE] 🔄 Exam Session & Key auto-rotated to Key: ${activeExamSessionKey} (ID: ${activeExamSessionId})`);
    try {
      dashboardNs.to('session:active').emit('session:info_update', {
        session_key: activeExamSessionKey,
        session_id: activeExamSessionId,
        rotated_at: new Date(lastSessionRotationTime).toISOString()
      });
    } catch(e) {}
  }, 5 * 60 * 1000);

  // Helper to check if an agent matches a target student ID
  const isMatchingAgent = (agent, targetId) => {
    if (!agent || targetId === undefined || targetId === null) return false;
    const targetStr = String(targetId).trim().toLowerCase();
    const stringIdStr = String(agent.string_id || '').trim().toLowerCase();
    const numIdStr = String(agent.num_id || '').trim().toLowerCase();
    return stringIdStr === targetStr || numIdStr === targetStr;
  };

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

    // Send current session info
    socket.emit('session:info_update', {
      session_key: activeExamSessionKey,
      session_id: activeExamSessionId,
      rotated_at: new Date(lastSessionRotationTime).toISOString()
    });

    // Replay kicked students list
    socket.emit('session:kicked_list', {
      kicked_students: Array.from(kickedStudentIds)
    });

    // Replay all current agents to new dashboard client
    for (const agent of Object.values(connectedAgents)) {
      socket.emit('session:student_joined', {
        student_id: agent.string_id,
        name: agent.name,
        id: agent.num_id,
        hostname: agent.hostname,
        ip: agent.ip,
        is_locked: agent.is_locked || false
      });
      if (agent.is_locked) {
        socket.emit('student:lock_status', { student_id: agent.string_id, is_locked: true });
      }
    }

    // Teacher requests remote screen lock for a student
    socket.on('teacher:lock_screen', (data) => {
      const { student_id } = data;
      lockedStudentIds.add(String(student_id));
      for (const [sid, agent] of Object.entries(connectedAgents)) {
        if (isMatchingAgent(agent, student_id)) {
          agent.is_locked = true;
          agentNs.to(sid).emit('command:lock_screen');
        }
      }
      dashboardNs.to('session:active').emit('student:lock_status', { student_id, is_locked: true });
      db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
        ['teacher', 'lock_screen', String(student_id), 'Remote screen lock triggered']);
    });

    // Teacher requests remote screen unlock for a student
    socket.on('teacher:unlock_screen', (data) => {
      const { student_id } = data;
      lockedStudentIds.delete(String(student_id));
      for (const [sid, agent] of Object.entries(connectedAgents)) {
        if (isMatchingAgent(agent, student_id)) {
          agent.is_locked = false;
          agentNs.to(sid).emit('command:unlock_screen');
        }
      }
      dashboardNs.to('session:active').emit('student:lock_status', { student_id, is_locked: false });
      db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
        ['teacher', 'unlock_screen', String(student_id), 'Remote screen unlock triggered']);
    });

    // Teacher kicks student from current exam session
    socket.on('teacher:kick_student', (data) => {
      const { student_id } = data;
      let displayId = String(student_id).trim();

      for (const [sid, agent] of Object.entries(connectedAgents)) {
        if (isMatchingAgent(agent, student_id)) {
          if (agent.string_id) displayId = String(agent.string_id).trim();
          try {
            agentNs.to(sid).emit('command:kick', {
              reason: 'KICKED_OUT',
              message: 'You have been kicked out of the current exam session by proctoring faculty.'
            });
          } catch (err) { console.warn('Failed to send kick command to agent', err); }
          try {
            const targetSocket = agentNs.sockets.get(sid);
            if (targetSocket) {
              targetSocket.emit('command:kick', {
                reason: 'KICKED_OUT',
                message: 'You have been kicked out of the current exam session by proctoring faculty.'
              });
              targetSocket.disconnect(true);
            }
          } catch (err) { console.warn('Failed to disconnect socket', err); }
          delete connectedAgents[sid];
          dashboardNs.to('session:active').emit('session:student_left', { student_id: displayId, reason: 'kicked' });
          break;
        }
      }

      // Store ONLY the actual candidate roll number (e.g. "108"), NOT SQLite DB row IDs!
      kickedStudentIds.add(displayId);

      // Automatically rotate Session Key upon kickout so kicked user's old key is invalidated
      activeExamSessionKey = generateSessionKey();
      activeExamSessionId = `SESS-${Math.floor(100000 + Math.random() * 900000)}`;
      lastSessionRotationTime = Date.now();
      console.log(`[SESSION_ENGINE] 🔄 Kickout auto-rotated Session Key to: ${activeExamSessionKey}`);

      dashboardNs.to('session:active').emit('session:info_update', {
        session_key: activeExamSessionKey,
        session_id: activeExamSessionId,
        rotated_at: new Date(lastSessionRotationTime).toISOString()
      });
      dashboardNs.to('session:active').emit('session:kicked_list', { kicked_students: Array.from(kickedStudentIds) });

      db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
        ['teacher', 'kick_student', String(student_id), `Student kicked from exam. Session key rotated to ${activeExamSessionKey}`]);
    });

    // Teacher manually rotates active exam session Key
    socket.on('teacher:rotate_session', () => {
      activeExamSessionKey = generateSessionKey();
      activeExamSessionId = `SESS-${Math.floor(100000 + Math.random() * 900000)}`;
      lastSessionRotationTime = Date.now();
      global.activeExamSessionKey = activeExamSessionKey;
      console.log(`[SESSION_ENGINE] 🔄 Teacher manually rotated Session Key to: ${activeExamSessionKey}`);
      dashboardNs.to('session:active').emit('session:info_update', {
        session_key: activeExamSessionKey,
        session_id: activeExamSessionId,
        rotated_at: new Date(lastSessionRotationTime).toISOString()
      });
    });

    // Teacher unbans / clears kickout status for a student
    socket.on('teacher:unban_student', (data) => {
      const { student_id } = data;
      const targetIdStr = String(student_id).trim().toLowerCase();
      kickedStudentIds.delete(targetIdStr);
      for (const id of Array.from(kickedStudentIds)) {
        if (id.includes(targetIdStr) || targetIdStr.includes(id)) {
          kickedStudentIds.delete(id);
        }
      }
      console.log(`[SESSION_ENGINE] 🔓 Cleared kickout status for student '${student_id}'`);
      dashboardNs.to('session:active').emit('session:unbanned', { student_id });
      dashboardNs.to('session:active').emit('session:kicked_list', { kicked_students: Array.from(kickedStudentIds) });
      agentNs.emit('command:unban', { student_id });
      db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
        ['teacher', 'unban_student', String(student_id), 'Student unbanned & re-authorized by proctor']);
    });

    // Teacher sends a live warning message to a specific student's screen
    socket.on('teacher:warn_student', (data) => {
      const { student_id, message } = data;
      const warnMsg = message || 'Your exam is being monitored. Please focus.';
      console.log(`[WARN_SOCKET] Sending warning to student '${student_id}': "${warnMsg}"`);

      let matchedCount = 0;
      for (const [sid, agent] of Object.entries(connectedAgents)) {
        if (isMatchingAgent(agent, student_id)) {
          matchedCount++;
          console.log(`[WARN_SOCKET] Emitting command:warn to agent socket ${sid} (${agent.string_id})`);
          agentNs.to(sid).emit('command:warn', { message: warnMsg });
          try {
            const targetSocket = agentNs.sockets.get(sid);
            if (targetSocket) targetSocket.emit('command:warn', { message: warnMsg });
          } catch(e) {}
        }
      }

      if (matchedCount === 0) {
        console.warn(`[WARN_SOCKET] ⚠️ No agent matched target '${student_id}'. Active agents:`, 
          Object.values(connectedAgents).map(a => `${a.string_id} (num: ${a.num_id})`));
      }

      dashboardNs.to('session:active').emit('student:warned', { student_id, message: warnMsg });
      db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
        ['teacher', 'warn_student', String(student_id), `Warning sent: ${warnMsg}`]);
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
      const { student_id, hostname, ip, mac, session_key } = data;
      const rawIdStr = String(student_id || '').trim().toLowerCase();
      const providedKey = String(session_key || '').trim().toUpperCase();

      // Check Session Key validity (must match current 6-character activeExamSessionKey)
      if (!providedKey || providedKey !== activeExamSessionKey) {
        console.warn(`[AGENT_REGISTER] ⛔ Rejected invalid 6-character Session Key '${providedKey}' for candidate '${student_id}'. Active key is '${activeExamSessionKey}'`);
        socket.emit('command:kick', {
          reason: 'INVALID_SESSION_KEY',
          message: 'Invalid or expired 6-character Session Key. Please enter the current Session Key from your instructor.'
        });
        setTimeout(() => {
          try { socket.disconnect(true); } catch(e) {}
        }, 300);
        return;
      }

      // Valid 6-Character Session Key provided -> Clear previous kickout block for this candidate!
      kickedStudentIds.delete(rawIdStr);
      for (const id of Array.from(kickedStudentIds)) {
        if (id.includes(rawIdStr) || rawIdStr.includes(id)) {
          kickedStudentIds.delete(id);
        }
      }

      // Extract real IP address from socket connection headers or client parameters
      const socketClientIp = (
        socket.handshake.headers['x-forwarded-for'] ||
        socket.handshake.headers['x-real-ip'] ||
        socket.handshake.address ||
        ''
      ).split(',')[0].replace('::ffff:', '').trim();

      let resolvedIp = ip && ip !== 'Web-Client' && ip !== '0.0.0.0' ? ip : (socketClientIp || '127.0.0.1');
      if (resolvedIp === '::1') resolvedIp = '127.0.0.1';

      try {
        await db.run(
          `INSERT INTO students (student_id, name, hostname, ip_address, mac_address) VALUES (?, ?, ?, ?, ?) ON CONFLICT(student_id) DO UPDATE SET hostname=?, ip_address=?, mac_address=?`,
          [student_id, `Student ${student_id}`, hostname, resolvedIp, mac, hostname, resolvedIp, mac]
        );

        const student = await db.get(`SELECT id, student_id FROM students WHERE student_id = ?`, [student_id]);
        numId = student.id;
        stringId = student.student_id;

        const isLocked = lockedStudentIds.has(stringId);

        connectedAgents[socket.id] = {
          string_id: stringId,
          num_id: numId,
          name: `Student ${stringId}`,
          hostname,
          ip: resolvedIp,
          last_seen: Date.now(),
          status: 'online',
          is_locked: isLocked
        };

        // Update heartbeat
        await db.run('UPDATE agent_heartbeat SET last_seen = ?', [stringId]);

        dashboardNs.to('session:active').emit('session:student_joined', {
          student_id: stringId,
          name: `Student ${stringId}`,
          id: numId,
          hostname,
          ip: resolvedIp,
          is_locked: isLocked
        });

        if (isLocked) {
          socket.emit('command:lock_screen');
          dashboardNs.to('session:active').emit('student:lock_status', { student_id: stringId, is_locked: true });
        }
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
        connectedAgents[socket.id].last_frame = data.jpeg_base64;
      }

      // Frozen Frame Detection: dual-signal check
      const idleSecs = connectedAgents[socket.id]?.idle_seconds || 0;
      const { isFrozen, frozenSeconds } = frozenFrameEngine.checkFrozenFrame(stringId, data.jpeg_base64, idleSecs);
      if (isFrozen) {
        dashboardNs.to('session:active').emit('flag:new', {
          student_id: stringId,
          rule_type: 'frozen_frame',
          detail: `Suspiciously Perfect Telemetry: Screen unchanged for ${frozenSeconds}s with zero input`,
          severity: 'high',
          risk_score_delta: 20,
          timestamp: new Date().toISOString()
        });
        dashboardNs.to('session:active').emit('alert:frozen_frame', {
          student_id: stringId,
          detail: `Suspiciously Perfect Telemetry: Screen unchanged for ${frozenSeconds}s with zero input`,
          timestamp: new Date().toISOString()
        });
      }

      dashboardNs.to('session:active').emit('frame:update', {
        student_id: stringId,
        jpeg_base64: data.jpeg_base64,
        timestamp: data.timestamp,
        frozen: isFrozen
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

        // Dynamic blacklisted app & web site keyword detection
        const rule = await db.get('SELECT enabled, threshold_value FROM rules WHERE rule_type = ?', ['blacklisted_app']);
        let activeKeywords = ['chatgpt', 'openai', 'gpt', 'youtube', 'whatsapp', 'discord', 'instagram', 'facebook', 'claude', 'perplexity', 'grok'];
        if (rule && rule.enabled && rule.threshold_value) {
          try {
            const val = typeof rule.threshold_value === 'string' ? JSON.parse(rule.threshold_value) : rule.threshold_value;
            if (Array.isArray(val) && val.length > 0) activeKeywords = val;
            else if (typeof val === 'string') activeKeywords = val.split(',').map(s => s.trim()).filter(Boolean);
          } catch {
            activeKeywords = String(rule.threshold_value || '').split(',').map(s => s.trim()).filter(Boolean);
          }
        }

        for (const kw of activeKeywords) {
          const cleanKw = String(kw).toLowerCase().trim();
          if (cleanKw && combinedTarget.includes(cleanKw)) {
            const cdKey = `${stringId}:blacklisted_app`;
            const lastAlert = alertCooldowns[cdKey] || 0;
            if (Date.now() - lastAlert >= 5000) {
              alertCooldowns[cdKey] = Date.now();
              dashboardNs.to('session:active').emit('alert:blacklisted_app', {
                student_id: stringId,
                name: `Student ${stringId}`,
                rule_type: 'blacklisted_app',
                detail: `Unauthorized app/website detected: "${cleanKw}" (in active window/process)`,
                app_name: cleanKw,
                timestamp: new Date().toISOString()
              });
            }
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

          // Explicit admin alerts for window spike and blacklisted app violations to ensure urgent visibility
          if (flag.rule_type === 'window_spike') {
            try {
              dashboardNs.to('session:active').emit('alert:window_spike', {
                student_id: stringId,
                detail: flag.detail,
                timestamp: new Date().toISOString()
              });
            } catch (err) { console.warn('Failed to emit window_spike alert', err); }
          }
          if (flag.rule_type === 'blacklisted_app') {
            try {
              const cdKey = `${stringId}:blacklisted_app`;
              const lastAlert = alertCooldowns[cdKey] || 0;
              if (Date.now() - lastAlert >= 5000) {
                alertCooldowns[cdKey] = Date.now();
                dashboardNs.to('session:active').emit('alert:blacklisted_app', {
                  student_id: stringId,
                  name: `Student ${stringId}`,
                  rule_type: 'blacklisted_app',
                  detail: flag.detail,
                  app_name: flag.detail.includes('"') ? flag.detail.split('"')[1] : 'Blacklisted Web App',
                  timestamp: new Date().toISOString()
                });
              }
            } catch (err) { console.warn('Failed to emit blacklisted_app alert', err); }
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
        mouse_score: mouseScore,
        active_window: data.active_window || '',
        window_count: data.window_count || 1,
        monitor_count: data.monitor_count || 1,
        usb_detected: data.usb_detected || false,
        usb_events: data.usb_events || [],
        processes: data.processes || []
      });
    });

    // Heartbeat ping
    socket.on('agent:ping', () => {
      if (connectedAgents[socket.id]) {
        connectedAgents[socket.id].last_seen = Date.now();
        connectedAgents[socket.id].status = 'online';
      }
    });

    // Tab Switch Detection (real-time from browser)
    socket.on('agent:tab_switch', async (data) => {
      if (!stringId || !numId) return;
      try {
        await db.run(
          'INSERT INTO flags (session_id, student_id, rule_type, detail, severity, risk_score_delta) VALUES (?, ?, ?, ?, ?, ?)',
          [sessionId, numId, 'tab_switch', `Tab switched ${data.count} time(s) — browser focus lost`, 'high', 15]
        );
        dashboardNs.to('session:active').emit('alert:tab_switch', {
          student_id: stringId,
          detail: `Tab switch #${data.count} detected — student left exam portal`,
          timestamp: new Date().toISOString()
        });
        dashboardNs.to('session:active').emit('flag:new', {
          student_id: stringId,
          rule_type: 'tab_switch',
          detail: `Tab switch #${data.count}: student left exam portal`,
          risk_score_delta: 15,
          created_at: new Date().toISOString()
        });
      } catch(e) { console.warn('Tab switch log error', e); }
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
