const express = require('express');
const router = express.Router();
const aiEngine = require('../engine/aiEngine');

// ─── AUTH ────────────────────────────────────────────────────────────────────
router.post('/auth/signup', async (req, res) => {
  const { db } = req;
  const { username, password, role } = req.body;
  try {
    const existing = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (existing) return res.status(400).json({ error: 'Username already exists' });
    await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, role || 'student']);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/auth/login', async (req, res) => {
  const { db } = req;
  const { username, password } = req.body;
  try {
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
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
  const { db } = req;
  const { enabled, threshold_value, weight } = req.body;
  try {
    await db.run(
      'UPDATE rules SET enabled = ?, threshold_value = ?, weight = ? WHERE id = ?',
      [enabled, typeof threshold_value === 'string' ? threshold_value : JSON.stringify(threshold_value), weight, req.params.id]
    );
    await db.run('INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
      ['admin', 'update_rule', req.params.id, `Rule ${req.params.id} updated`]);
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

module.exports = router;
