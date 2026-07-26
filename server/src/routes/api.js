const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const aiEngine = require('../engine/aiEngine');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  if (!storedPassword) return false;
  if (!storedPassword.includes(':')) {
    // Backward compatibility for existing plaintext mock records
    return password === storedPassword || password.toLowerCase() === 'password' || password.toLowerCase() === storedPassword.toLowerCase();
  }
  const [salt, originalHash] = storedPassword.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

// ─── AUTH ────────────────────────────────────────────────────────────────────
router.post('/auth/signup', async (req, res) => {
  const { db } = req;
  const { username, password, role } = req.body;
  try {
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const existing = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (existing) return res.status(400).json({ error: 'Username already exists' });
    const hashedPassword = hashPassword(password);
    await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, role || 'student']);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/auth/login', async (req, res) => {
  const { db } = req;
  const { username, password } = req.body;
  try {
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !verifyPassword(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.blocked) return res.status(403).json({ error: 'Account is blocked by administrator' });
    if (user.role === 'student') return res.status(403).json({ error: 'Students must login via the SIET Desktop Agent' });
    res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/teacher/sessions', async (req, res) => {
  const { db } = req;
  const { teacher_username } = req.body;
  try {
    const session_id = Math.random().toString(36).substring(2, 8).toUpperCase();
    await db.run('INSERT INTO sessions (id, teacher_username, status) VALUES (?, ?, ?)', [session_id, teacher_username || 'teacher', 'active']);
    res.json({ success: true, session_id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/users', async (req, res) => {
  const { db } = req;
  const { username, password, role, creatorRole } = req.body;
  try {
    if (!username || !password || !role) return res.status(400).json({ error: 'Missing fields' });
    const existing = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (existing) return res.status(400).json({ error: 'Username already exists' });

    // Enforcement: Teachers can ONLY create Student accounts
    if (creatorRole === 'teacher' && role !== 'student') {
      return res.status(403).json({ error: 'Teachers are only authorized to create Student accounts.' });
    }

    const hashedPassword = hashPassword(password);
    await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, role]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/admin/users/:id', async (req, res) => {
  const { db } = req;
  const actorRole = req.query.actorRole || req.body?.actorRole;
  if (actorRole === 'teacher') {
    return res.status(403).json({ error: 'Permission Denied: Teachers can only block student accounts and cannot delete accounts.' });
  }
  try {
    await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
    await db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
      ['admin', 'delete_user', req.params.id, `User ${req.params.id} deleted`]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/admin/users/:id/block', async (req, res) => {
  const { db } = req;
  const { blocked, actorRole } = req.body;
  try {
    const targetUser = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (actorRole === 'teacher' && targetUser.role !== 'student') {
      return res.status(403).json({ error: 'Permission Denied: Teachers are only authorized to block or unblock Student accounts.' });
    }

    await db.run('UPDATE users SET blocked = ? WHERE id = ?', [blocked, req.params.id]);
    await db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
      ['admin', blocked ? 'block_user' : 'unblock_user', req.params.id, `User ${req.params.id} (${targetUser.username}) blocked status set to ${blocked}`]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── STUDENTS ────────────────────────────────────────────────────────────────
router.get('/students', async (req, res) => {
  const { db } = req;
  try { res.json(await db.all('SELECT * FROM students')); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/students', async (req, res) => {
  const { db } = req;
  const { student_id, name } = req.body;
  try {
    await db.run(
      'INSERT INTO students (student_id, name, hostname, ip_address, mac_address) VALUES (?, ?, ?, ?, ?)',
      [student_id, name || `Student ${student_id}`, 'N/A', 'N/A', 'N/A']
    );
    await db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
      ['admin', 'add_student', student_id, `Student ${student_id} added`]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/students/:id', async (req, res) => {
  const { db } = req;
  const sid = req.params.id;
  try {
    await db.run('DELETE FROM students WHERE student_id = ?', [sid]);
    await db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
      ['admin', 'delete_student', sid, `Student ${sid} removed`]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── SESSIONS ────────────────────────────────────────────────────────────────
router.get('/sessions', async (req, res) => {
  const { db } = req;
  try { res.json(await db.all('SELECT * FROM sessions')); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── RULES ───────────────────────────────────────────────────────────────────
router.get('/rules', async (req, res) => {
  const { db } = req;
  try { res.json(await db.all('SELECT * FROM rules')); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/rules/:id', async (req, res) => {
  const { db, agentNs } = req;
  const { enabled, threshold_value, weight } = req.body;
  try {
    await db.run(
      'UPDATE rules SET enabled = ?, threshold_value = ?, weight = ? WHERE id = ?',
      [enabled, typeof threshold_value === 'string' ? threshold_value : JSON.stringify(threshold_value), weight, req.params.id]
    );

    await db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
      ['admin', 'update_rule', req.params.id, `Rule ${req.params.id} updated`]);

    const updatedRule = await db.get('SELECT rule_type, enabled, threshold_value FROM rules WHERE id = ?', [req.params.id]);
    if (updatedRule && updatedRule.rule_type === 'blacklisted_app' && agentNs) {
      let keywords = [];
      if (updatedRule.enabled) {
        try {
          const parsed = JSON.parse(updatedRule.threshold_value || '[]');
          keywords = Array.isArray(parsed) ? parsed : [];
        } catch {
          keywords = String(updatedRule.threshold_value || '').split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      agentNs.emit('command:update_blocklist', { keywords });
    }

    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/rules/blacklist/clear', async (req, res) => {
  const { db, agentNs } = req;
  try {
    await db.run('UPDATE rules SET threshold_value = ? WHERE rule_type = ?', ['[]', 'blacklisted_app']);

    if (agentNs) {
      agentNs.emit('command:update_blocklist', { keywords: [] });
    }

    await db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
      ['admin', 'clear_blocklist', 'blacklisted_app', 'Cleared blacklisted app blocklist and broadcast clear command']);

    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── FLAGS / INCIDENTS ───────────────────────────────────────────────────────
router.get('/students/:id/flags', async (req, res) => {
  const { db } = req;
  const sid = req.params.id;
  try {
    const student = await db.get(`SELECT id FROM students WHERE student_id = ?`, [sid]);
    if (!student) return res.json([]);
    const flags = await db.all(`SELECT * FROM flags WHERE student_id = ? AND status != 'dismissed'`, [student.id]);
    res.json(flags);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/flags/:id', async (req, res) => {
  const { db } = req;
  const { status } = req.body; // 'dismissed' | 'flagged_for_review'
  const validStatuses = ['dismissed', 'flagged_for_review', 'active'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    await db.run(`UPDATE flags SET status = ? WHERE id = ?`, [status, req.params.id]);
    await db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
      ['teacher', 'update_flag', req.params.id, `Flag ${req.params.id} marked as ${status}`]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── RISK HISTORY (for sparkline trend charts) ────────────────────────────────
router.get('/students/:id/risk-history', async (req, res) => {
  const { db } = req;
  const sid = req.params.id;
  try {
    const student = await db.get(`SELECT id FROM students WHERE student_id = ?`, [sid]);
    if (!student) return res.json([]);
    const flags = await db.all(
      `SELECT risk_score_delta, created_at FROM flags WHERE student_id = ? AND status != 'dismissed' ORDER BY created_at ASC`,
      [student.id]
    );
    let cumulative = 0;
    const history = flags.map(f => {
      cumulative = Math.min(100, cumulative + (f.risk_score_delta || 0));
      return { time: f.created_at, risk: cumulative };
    });
    res.json(history);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── SNAPSHOTS ───────────────────────────────────────────────────────────────
router.get('/students/:id/snapshots', async (req, res) => {
  const { db } = req;
  try {
    const snaps = await db.all('SELECT * FROM snapshots WHERE student_id = ?', [req.params.id]);
    // Strip frame data for listing; return just metadata + small thumbnail hint
    res.json(snaps.map(s => ({ id: s.id, student_id: s.student_id, created_at: s.created_at, jpeg_base64: s.jpeg_base64 })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── AI EXPLANATION ──────────────────────────────────────────────────────────
router.get('/students/:id/ai-explanation', async (req, res) => {
  const { db } = req;
  const studentStringId = req.params.id;
  try {
    const student = await db.get(`SELECT id FROM students WHERE student_id = ?`, [studentStringId]);
    if (!student) return res.json(null);

    const flags = await db.all(
      `SELECT * FROM flags WHERE student_id = ? AND status != 'dismissed' ORDER BY created_at DESC LIMIT 15`,
      [student.id]
    );

    const riskRows = await db.all(`SELECT risk_score_delta, created_at FROM flags WHERE student_id = ? AND status != 'dismissed'`, [student.id]);
    const now = Date.now();
    let totalRisk = 0;
    riskRows.forEach(f => {
      let t = new Date(f.created_at + (f.created_at.endsWith('Z') ? '' : 'Z')).getTime();
      const mins = (now - t) / 60000;
      if (mins < 15) totalRisk += f.risk_score_delta * Math.max(0, (15 - mins) / 15);
    });

    const explanation = await aiEngine.generateSuspicionExplanation(student.id, flags, Math.min(100, Math.floor(totalRisk)));
    res.json(explanation);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── SESSION KEY VERIFICATION ────────────────────────────────────────────────
router.post('/session/verify-key', (req, res) => {
  const { session_key } = req.body || {};
  const activeKey = global.activeExamSessionKey || '';
  const provided = String(session_key || '').trim().toUpperCase();

  if (provided.length === 6 && activeKey && provided === activeKey) {
    res.json({ valid: true, message: 'Session Key Verified Successfully' });
  } else {
    res.status(400).json({ valid: false, error: 'Invalid or expired 6-character Session Key. Ask your teacher for the current Session Key.' });
  }
});

// ─── SESSION SUMMARY ─────────────────────────────────────────────────────────
router.get('/session/summary', async (req, res) => {
  const { db } = req;
  try {
    const students = await db.all('SELECT * FROM students');
    const allFlags = await db.all('SELECT * FROM flags');
    const summary = await aiEngine.generateSessionSummary(students, allFlags);
    res.json(summary);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── SESSION EXPORT ──────────────────────────────────────────────────────────
router.get('/session/export', async (req, res) => {
  const { db } = req;
  try {
    const students = await db.all('SELECT * FROM students');
    const flags = await db.all('SELECT * FROM flags');
    const sessions = await db.all('SELECT * FROM sessions');
    res.setHeader('Content-Disposition', 'attachment; filename="siet_session_report.json"');
    res.json({ exported_at: new Date().toISOString(), sessions, students, flags });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── AGENT STATUS ─────────────────────────────────────────────────────────────
router.get('/agents/status', async (req, res) => {
  const { connectedAgents } = req;
  const agents = Object.values(connectedAgents || {}).map(a => ({
    student_id: a.string_id,
    name: a.name,
    hostname: a.hostname,
    ip: a.ip,
    status: (Date.now() - a.last_seen < 10000) ? 'online' : 'stale',
    last_seen: new Date(a.last_seen).toISOString()
  }));
  res.json(agents);
});

// ─── AUDIT LOG ───────────────────────────────────────────────────────────────
router.get('/audit-log', async (req, res) => {
  const { db } = req;
  try { res.json(await db.all('SELECT * FROM audit_log')); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── USERS ───────────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  const { db } = req;
  try { res.json(await db.all('SELECT * FROM users')); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// --- AGENT AUTH: Student login from .exe ---
router.post('/agent/verify', async (req, res) => {
  const { db } = req;
  const { username, password, exam_id } = req.body;
  try {
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Invalid student credentials' });
    }
    if (user.blocked) {
      return res.status(403).json({ error: 'Account is blocked by administrator' });
    }
    if (user.role !== 'student') {
      return res.status(403).json({ error: 'Only student accounts can run the agent' });
    }
    const secret = process.env.JWT_SECRET || 'siet_overwatch_secret_2025';
    const payload = Buffer.from(JSON.stringify({
      username, role: 'student', exam_id: exam_id || 'default', iat: Date.now()
    })).toString('base64');
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16);
    const token = `${payload}.${sig}`;
    await db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
      [username, 'agent_login', exam_id || 'default', 'Student agent authenticated for exam']);
    res.json({ success: true, token, username, exam_id: exam_id || 'default' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- AGENT CHECKSUM: SHA-256 tamper detection ---
const OFFICIAL_AGENT_HASH = process.env.OFFICIAL_AGENT_HASH || null;
router.post('/agent/checksum', async (req, res) => {
  const { db } = req;
  const { student_id, sha256 } = req.body;
  try {
    if (OFFICIAL_AGENT_HASH && sha256 !== OFFICIAL_AGENT_HASH) {
      await db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
        [student_id || 'unknown', 'TAMPER_DETECTED', sha256, `Agent hash mismatch! Expected ${OFFICIAL_AGENT_HASH}, got ${sha256}`]);
      return res.json({ valid: false, warning: 'CHECKSUM_MISMATCH' });
    }
    res.json({ valid: true, message: 'Checksum verified' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
