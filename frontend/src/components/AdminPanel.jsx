import React, { useState, useEffect } from 'react';
import { Settings, Users, Wifi, FileText, Plus, Trash2, RefreshCw } from 'lucide-react';

export default function AdminPanel({ host }) {
  const [tab, setTab] = useState('rules');
  const [rules, setRules] = useState([]);
  const [students, setStudents] = useState([]);
  const [agents, setAgents] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [newStudent, setNewStudent] = useState({ student_id: '', name: '' });
  const [loading, setLoading] = useState(false);

  const api = (path) => `http://${host}:3000/api${path}`;

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAll = () => {
    fetchRules();
    fetchStudents();
    fetchAgents();
    fetchAuditLog();
  };

  const fetchRules = () => fetch(api('/rules')).then(r => r.json()).then(setRules).catch(() => {});
  const fetchStudents = () => fetch(api('/students')).then(r => r.json()).then(setStudents).catch(() => {});
  const fetchAgents = () => fetch(api('/agents/status')).then(r => r.json()).then(setAgents).catch(() => {});
  const fetchAuditLog = () => fetch(api('/audit-log')).then(r => r.json()).then(setAuditLog).catch(() => {});

  const updateRule = async (rule, changes) => {
    const updated = { ...rule, ...changes };
    await fetch(api(`/rules/${rule.id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: updated.enabled, threshold_value: updated.threshold_value, weight: updated.weight })
    });
    fetchRules();
  };

  const addStudent = async () => {
    if (!newStudent.student_id) return;
    setLoading(true);
    await fetch(api('/students'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newStudent)
    });
    setNewStudent({ student_id: '', name: '' });
    fetchStudents();
    setLoading(false);
  };

  const deleteStudent = async (sid) => {
    if (!confirm(`Remove student ${sid}?`)) return;
    await fetch(api(`/students/${sid}`), { method: 'DELETE' });
    fetchStudents();
  };

  const tabs = [
    { id: 'rules', label: 'Rule Config', icon: Settings },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'agents', label: 'Agent Status', icon: Wifi },
    { id: 'audit', label: 'Audit Log', icon: FileText },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Admin Panel</h2>
        <button onClick={fetchAll} className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-white/5 pb-3">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === id ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── RULE CONFIG ── */}
      {tab === 'rules' && (
        <div className="space-y-3">
          {rules.map(rule => {
            let threshold = '';
            try { threshold = JSON.stringify(rule.threshold_value ? JSON.parse(rule.threshold_value) : ''); } catch { threshold = rule.threshold_value || ''; }
            return (
              <div key={rule.id} className={`bg-[#1A1D24] border rounded-2xl p-5 transition-all ${rule.enabled ? 'border-white/10' : 'border-white/5 opacity-60'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-white">{rule.rule_type.replace(/_/g, ' ').toUpperCase()}</p>
                    <p className="text-xs text-white/30 mt-0.5">Rule ID #{rule.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${rule.enabled ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/30'}`}>
                      {rule.enabled ? 'Active' : 'Disabled'}
                    </span>
                    <button
                      onClick={() => updateRule(rule, { enabled: rule.enabled ? 0 : 1 })}
                      className={`w-11 h-6 rounded-full transition-all relative ${rule.enabled ? 'bg-blue-600' : 'bg-white/10'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${rule.enabled ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-white/30 block mb-1">Threshold</label>
                    <input
                      defaultValue={threshold}
                      onBlur={(e) => updateRule(rule, { threshold_value: e.target.value })}
                      className="w-full bg-[#0F1115] border border-white/5 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-white/30 block mb-1">Weight</label>
                    <input
                      type="number"
                      defaultValue={rule.weight}
                      onBlur={(e) => updateRule(rule, { weight: parseInt(e.target.value) })}
                      className="w-full bg-[#0F1115] border border-white/5 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── STUDENTS ── */}
      {tab === 'students' && (
        <div className="space-y-4">
          <div className="bg-[#1A1D24] border border-white/10 rounded-2xl p-5">
            <h3 className="font-semibold mb-4 text-white/80">Add Student</h3>
            <div className="flex gap-3">
              <input
                value={newStudent.student_id}
                onChange={e => setNewStudent(p => ({ ...p, student_id: e.target.value }))}
                placeholder="Roll Number / ID"
                className="flex-1 bg-[#0F1115] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
              />
              <input
                value={newStudent.name}
                onChange={e => setNewStudent(p => ({ ...p, name: e.target.value }))}
                placeholder="Full Name (optional)"
                className="flex-1 bg-[#0F1115] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
              />
              <button
                onClick={addStudent}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>

          <div className="bg-[#1A1D24] border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-white/5">
                <tr className="text-white/40 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Student ID</th>
                  <th className="text-left px-5 py-3">Name</th>
                  <th className="text-left px-5 py-3">Hostname</th>
                  <th className="text-left px-5 py-3">IP</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.student_id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                    <td className="px-5 py-3 text-white font-medium">{s.student_id}</td>
                    <td className="px-5 py-3 text-white/60">{s.name}</td>
                    <td className="px-5 py-3 text-white/40">{s.hostname || 'N/A'}</td>
                    <td className="px-5 py-3 text-white/40">{s.ip_address || 'N/A'}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => deleteStudent(s.student_id)} className="text-red-400/60 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {students.length === 0 && <p className="text-center text-white/20 py-8 text-sm">No students registered</p>}
          </div>
        </div>
      )}

      {/* ── AGENT STATUS ── */}
      {tab === 'agents' && (
        <div className="bg-[#1A1D24] border border-white/10 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-white/5">
              <tr className="text-white/40 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3">Agent</th>
                <th className="text-left px-5 py-3">Hostname</th>
                <th className="text-left px-5 py-3">IP</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.student_id} className="border-b border-white/5">
                  <td className="px-5 py-3 text-white font-medium">{a.student_id}</td>
                  <td className="px-5 py-3 text-white/60">{a.hostname}</td>
                  <td className="px-5 py-3 text-white/40">{a.ip}</td>
                  <td className="px-5 py-3">
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${a.status === 'online' ? 'text-green-400' : 'text-yellow-400'}`}>
                      <span className={`w-2 h-2 rounded-full ${a.status === 'online' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
                      {a.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-white/30 text-xs">{new Date(a.last_seen).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {agents.length === 0 && <p className="text-center text-white/20 py-8 text-sm">No agents connected</p>}
        </div>
      )}

      {/* ── AUDIT LOG ── */}
      {tab === 'audit' && (
        <div className="bg-[#1A1D24] border border-white/10 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-white/5">
              <tr className="text-white/40 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3">Time</th>
                <th className="text-left px-5 py-3">Actor</th>
                <th className="text-left px-5 py-3">Action</th>
                <th className="text-left px-5 py-3">Target</th>
                <th className="text-left px-5 py-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map(log => (
                <tr key={log.id} className="border-b border-white/5 hover:bg-white/2">
                  <td className="px-5 py-3 text-white/30 text-xs">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-5 py-3 text-blue-400 font-medium">{log.actor}</td>
                  <td className="px-5 py-3 text-white/70">{log.action?.replace(/_/g, ' ')}</td>
                  <td className="px-5 py-3 text-white/50">{log.target}</td>
                  <td className="px-5 py-3 text-white/30 text-xs">{log.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {auditLog.length === 0 && <p className="text-center text-white/20 py-8 text-sm">No audit events recorded</p>}
        </div>
      )}
    </div>
  );
}
