const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.json');

class MockDB {
  constructor() {
    this._saveTimer = null;
    this.data = {
      users: [],
      students: [],
      sessions: [{ id: 1, class_name: 'Hackathon Session', started_at: new Date().toISOString(), status: 'active' }],
      flags: [],
      activity_snapshots: [],
      snapshots: [],         // auto-captured JPEGs on flag
      audit_log: [],         // admin action trail
      agent_heartbeats: {},  // { student_id: { last_seen, status } }
      session_summaries: [], // AI end-of-session summaries
      rules: [
        { id: 1, rule_type: 'blacklisted_app', enabled: 1, threshold_value: JSON.stringify(["chatgpt","openai","youtube","whatsapp","discord","instagram","facebook","claude","perplexity","grok","telegram","game","cheat","cheatengine"]), weight: 30 },
        { id: 2, rule_type: 'idle_timeout', enabled: 1, threshold_value: JSON.stringify({ seconds: 60 }), weight: 10 },
        { id: 3, rule_type: 'secondary_monitor', enabled: 1, threshold_value: null, weight: 20 },
        { id: 4, rule_type: 'usb_detected', enabled: 1, threshold_value: null, weight: 15 },
        { id: 5, rule_type: 'remote_access_tool', enabled: 1, threshold_value: JSON.stringify(["teamviewer","anydesk","rdp","zoom"]), weight: 40 },
        { id: 6, rule_type: 'large_clipboard_paste', enabled: 1, threshold_value: JSON.stringify({ minLength: 50 }), weight: 25 },
        { id: 7, rule_type: 'window_spike', enabled: 1, threshold_value: JSON.stringify({ count: 5, seconds: 10 }), weight: 15 },
        { id: 8, rule_type: 'tab_switched', enabled: 1, threshold_value: null, weight: 25 },
        { id: 9, rule_type: 'statistical_anomaly', enabled: 1, threshold_value: JSON.stringify({ sigma: 2 }), weight: 20 }
      ]
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileData = fs.readFileSync(DB_FILE, 'utf-8');
        const loaded = JSON.parse(fileData);
        // Merge to preserve new defaults
        this.data = { ...this.data, ...loaded };
        // Always restore runtime-only field
        this.data.agent_heartbeats = loaded.agent_heartbeats || {};
        // Prune old historical test flags to keep session data clean (max 200 recent flags)
        if (Array.isArray(this.data.flags) && this.data.flags.length > 200) {
          this.data.flags = this.data.flags.slice(-200);
        }
      }
    } catch(e) {
      console.error("Error loading DB file:", e);
    }
  }

  save() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(async () => {
      this._saveTimer = null;
      try {
        await fs.promises.writeFile(DB_FILE, JSON.stringify(this.data, null, 2));
      } catch(e) {
        console.error("Error saving DB file:", e);
      }
    }, 500);
  }

  async run(query, params = []) {
    const q = query.toUpperCase().trim();

    if (q.includes('INSERT INTO USERS')) {
      this.data.users.push({
        id: this.data.users.length > 0 ? Math.max(...this.data.users.map(u => u.id)) + 1 : 1,
        username: params[0],
        password: params[1],
        role: params[2],
        blocked: false,
        created_at: new Date().toISOString()
      });
      this.save();

    } else if (q.includes('DELETE FROM USERS')) {
      this.data.users = this.data.users.filter(u => u.id != params[0]);
      this.save();

    } else if (q.includes('UPDATE USERS SET BLOCKED')) {
      const user = this.data.users.find(u => u.id == params[1]);
      if (user) user.blocked = params[0];
      this.save();

    } else if (q.includes('INSERT INTO STUDENTS')) {
      const existing = this.data.students.find(s => s.student_id === params[0]);
      if (existing) {
        existing.hostname = params[2];
        existing.ip_address = params[3];
        existing.mac_address = params[4];
      } else {
        this.data.students.push({
          id: this.data.students.length + 1,
          student_id: params[0],
          name: params[1],
          hostname: params[2],
          ip_address: params[3],
          mac_address: params[4],
          created_at: new Date().toISOString()
        });
      }
      this.save();

    } else if (q.includes('DELETE FROM STUDENTS')) {
      this.data.students = this.data.students.filter(s => s.student_id !== params[0]);
      this.save();

    } else if (q.includes('INSERT INTO ACTIVITY_SNAPSHOTS')) {
      this.data.activity_snapshots.push({
        id: this.data.activity_snapshots.length + 1,
        session_id: params[0],
        student_id: params[1],
        mouse_activity_score: params[2],
        typing_speed: params[3],
        idle_seconds: params[4],
        overall_activity_score: params[5],
        timestamp: new Date().toISOString()
      });
      // Trim old snapshots to prevent unbounded growth
      if (this.data.activity_snapshots.length > 5000) {
        this.data.activity_snapshots = this.data.activity_snapshots.slice(-5000);
      }

    } else if (q.includes('INSERT INTO SNAPSHOTS')) {
      this.data.snapshots.push({
        id: this.data.snapshots.length + 1,
        student_id: params[0],
        session_id: params[1],
        jpeg_base64: params[2],
        created_at: new Date().toISOString()
      });
      // Keep only last 20 snapshots per student
      const studentSnaps = this.data.snapshots.filter(s => s.student_id === params[0]);
      if (studentSnaps.length > 20) {
        const toRemove = studentSnaps.slice(0, studentSnaps.length - 20).map(s => s.id);
        this.data.snapshots = this.data.snapshots.filter(s => !toRemove.includes(s.id));
      }
      this.save();

    } else if (q.includes('INSERT INTO FLAGS')) {
      this.data.flags.push({
        id: this.data.flags.length + 1,
        session_id: params[0],
        student_id: params[1],
        rule_type: params[2],
        detail: params[3],
        severity: params[4],
        risk_score_delta: params[5],
        status: 'open',
        created_at: new Date().toISOString()
      });
      this.save();

    } else if (q.includes('INSERT INTO AUDIT_LOG')) {
      this.data.audit_log.push({
        id: this.data.audit_log.length + 1,
        actor: params[0],
        action: params[1],
        target: params[2],
        detail: params[3],
        created_at: new Date().toISOString()
      });
      this.save();

    } else if (q.includes('UPDATE RULES')) {
      const ruleId = params[3];
      const rule = this.data.rules.find(r => r.id == ruleId);
      if (rule) {
        rule.enabled = params[0];
        rule.threshold_value = params[1];
        rule.weight = params[2];
      }
      this.save();

    } else if (q.includes('UPDATE AGENT_HEARTBEAT')) {
      this.data.agent_heartbeats[params[0]] = {
        last_seen: new Date().toISOString(),
        status: 'online'
      };

    } else if (q.includes('INSERT INTO SESSION_SUMMARIES')) {
      this.data.session_summaries.push({
        id: this.data.session_summaries.length + 1,
        session_id: params[0],
        summary_text: params[1],
        created_at: new Date().toISOString()
      });
      this.save();
    }
  }

  async get(query, params = []) {
    const q = query.toUpperCase();
    if (q.includes('FROM STUDENTS WHERE STUDENT_ID')) {
      return this.data.students.find(s => s.student_id === params[0]) || null;
    } else if (q.includes('FROM USERS WHERE USERNAME')) {
      return this.data.users.find(u => u.username.toLowerCase() === (params[0] || '').toLowerCase()) || null;
    } else if (q.includes('FROM SESSIONS WHERE')) {
      return this.data.sessions.find(s => s.id == params[0]) || null;
    }
    return null;
  }

  async all(query, params = []) {
    const q = query.toUpperCase();
    if (q.includes('FROM RULES')) {
      if (q.includes('ENABLED = 1')) return this.data.rules.filter(r => r.enabled === 1);
      return this.data.rules;
    } else if (q.includes('FROM STUDENTS')) {
      return this.data.students;
    } else if (q.includes('FROM SESSIONS')) {
      return this.data.sessions;
    } else if (q.includes('FROM FLAGS')) {
      let filtered = this.data.flags;
      if (params.length >= 2) {
        filtered = filtered.filter(f => f.student_id == params[0] && f.session_id == params[1]);
      } else if (params.length === 1) {
        filtered = filtered.filter(f => f.student_id == params[0]);
      }
      if (!q.includes("STATUS != 'DISMISSED'") || q.includes("STATUS != 'DISMISSED'")) {
        if (q.includes("STATUS != 'DISMISSED'")) filtered = filtered.filter(f => f.status !== 'dismissed');
      }
      return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (q.includes('FROM ACTIVITY_SNAPSHOTS')) {
      let filtered = this.data.activity_snapshots;
      if (params.length >= 2) {
        filtered = filtered.filter(s => s.student_id == params[0] && s.session_id == params[1]);
      }
      return filtered.slice(-50); // last 50
    } else if (q.includes('FROM SNAPSHOTS')) {
      let filtered = this.data.snapshots;
      if (params.length >= 1) filtered = filtered.filter(s => s.student_id === params[0]);
      return filtered.slice(-10);
    } else if (q.includes('FROM AUDIT_LOG')) {
      return this.data.audit_log.slice(-200).reverse();
    } else if (q.includes('FROM USERS')) {
      return this.data.users.map(u => ({ id: u.id, username: u.username, role: u.role, blocked: u.blocked || false, created_at: u.created_at }));
    }
    return [];
  }
}

const dbInstance = new MockDB();

async function getDb() {
  return dbInstance;
}

module.exports = { getDb };
