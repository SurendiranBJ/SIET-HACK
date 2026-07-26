import React, { useState, useEffect } from 'react';
import { Settings, Users, Wifi, FileText, Plus, Trash2, RefreshCw } from 'lucide-react';
import { getApiUrl } from '../config';

export default function AdminPanel() {
  const [tab, setTab] = useState('rules');
  const [rules, setRules] = useState([]);
  const [students, setStudents] = useState([]);
  const [agents, setAgents] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [newStudent, setNewStudent] = useState({ student_id: '', name: '' });
  const [loading, setLoading] = useState(false);

  const api = (path) => getApiUrl(path);

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
    <div className="bg-[#EEF4F0] border border-emerald-300/60 rounded-3xl p-6 text-slate-900 shadow-xl space-y-5">
      {/* Light Green & Half-White Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-emerald-950 tracking-tight">Admin Control Center</h2>
          <p className="text-xs text-emerald-700 font-bold uppercase tracking-wider mt-0.5">System Rules, Student Registry &amp; Audit Logs</p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-900 font-extrabold rounded-xl border border-emerald-300 shadow-sm transition-all hover:scale-105 active:scale-95 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-700" /> Refresh Data
        </button>
      </div>

      {/* Light Green Tab Navigation */}
      <div className="flex gap-2 bg-[#E1ECE4] p-1.5 rounded-2xl border border-emerald-300/50">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all duration-200 ${
              tab === id
                ? 'bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-600 text-white shadow-lg shadow-emerald-600/30 scale-[1.02]'
                : 'bg-white/80 text-emerald-900 hover:bg-white border border-emerald-200/80 font-extrabold'
            }`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── RULE CONFIG ── */}
      {tab === 'rules' && (
        <div className="space-y-3.5">
          {rules.filter(r => r.rule_type !== 'secondary_monitor' && r.rule_type !== 'remote_access_tool').map(rule => {
            let threshold = '';
            try { threshold = JSON.stringify(rule.threshold_value ? JSON.parse(rule.threshold_value) : ''); } catch { threshold = rule.threshold_value || ''; }
            return (
              <div key={rule.id} className={`bg-[#FAFCFA] border rounded-2xl p-5 transition-all shadow-sm ${rule.enabled ? 'border-emerald-300 hover:border-emerald-500' : 'border-emerald-200/50 opacity-60'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-extrabold text-emerald-950 text-base">{rule.rule_type.replace(/_/g, ' ').toUpperCase()}</p>
                    <p className="text-xs text-emerald-700/70 font-semibold mt-0.5">Rule ID #{rule.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-3 py-1 rounded-full font-black uppercase tracking-wider border ${rule.enabled ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-slate-200/60 text-slate-500 border-slate-300'}`}>
                      {rule.enabled ? 'Active' : 'Disabled'}
                    </span>
                    <button
                      onClick={() => updateRule(rule, { enabled: rule.enabled ? 0 : 1 })}
                      className={`w-12 h-6 rounded-full transition-all relative ${rule.enabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
                    >
                      <div className={`w-4.5 h-4.5 bg-white rounded-full absolute top-0.75 transition-all shadow-md ${rule.enabled ? 'left-6.5' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-emerald-800 font-extrabold uppercase tracking-wider block mb-1">Threshold</label>
                    <input
                      defaultValue={threshold}
                      onBlur={(e) => updateRule(rule, { threshold_value: e.target.value })}
                      className="w-full bg-white border border-emerald-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-emerald-600 shadow-inner"
                    />
                  </div>
                  <div className="w-28">
                    <label className="text-xs text-emerald-800 font-extrabold uppercase tracking-wider block mb-1">Weight</label>
                    <input
                      type="number"
                      defaultValue={rule.weight}
                      onBlur={(e) => updateRule(rule, { weight: parseInt(e.target.value) })}
                      className="w-full bg-white border border-emerald-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-emerald-600 shadow-inner"
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
          <div className="bg-[#FAFCFA] border border-emerald-300/80 rounded-2xl p-5 shadow-sm">
            <h3 className="font-extrabold text-emerald-950 mb-3 text-sm uppercase tracking-wider">Add Student Record</h3>
            <div className="flex gap-3">
              <input
                value={newStudent.student_id}
                onChange={e => setNewStudent(p => ({ ...p, student_id: e.target.value }))}
                placeholder="Roll Number / ID"
                className="flex-1 bg-white border border-emerald-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 font-medium"
              />
              <input
                value={newStudent.name}
                onChange={e => setNewStudent(p => ({ ...p, name: e.target.value }))}
                placeholder="Full Name (optional)"
                className="flex-1 bg-white border border-emerald-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 font-medium"
              />
              <button
                onClick={addStudent}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-black transition-all shadow-md shadow-emerald-600/30 hover:scale-105"
              >
                <Plus className="w-4 h-4" /> Add Record
              </button>
            </div>
          </div>

          <div className="bg-white border border-emerald-300/80 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-emerald-100/60 border-b border-emerald-200">
                <tr className="text-emerald-950 text-xs font-black uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Student ID</th>
                  <th className="text-left px-5 py-3">Name</th>
                  <th className="text-left px-5 py-3">Hostname</th>
                  <th className="text-left px-5 py-3">IP Address</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.student_id} className="border-b border-emerald-100 hover:bg-emerald-50/50 transition-colors">
                    <td className="px-5 py-3 text-emerald-950 font-bold">{s.student_id}</td>
                    <td className="px-5 py-3 text-slate-700 font-medium">{s.name}</td>
                    <td className="px-5 py-3 text-slate-500 font-mono text-xs">{s.hostname || 'N/A'}</td>
                    <td className="px-5 py-3 text-slate-500 font-mono text-xs">{s.ip_address || 'N/A'}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => deleteStudent(s.student_id)} className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {students.length === 0 && <p className="text-center text-slate-400 py-8 text-sm font-medium">No students registered</p>}
          </div>
        </div>
      )}

      {/* ── AGENT STATUS ── */}
      {tab === 'agents' && (
        <div className="bg-white border border-emerald-300/80 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-emerald-100/60 border-b border-emerald-200">
              <tr className="text-emerald-950 text-xs font-black uppercase tracking-wider">
                <th className="text-left px-5 py-3">Agent ID</th>
                <th className="text-left px-5 py-3">Hostname</th>
                <th className="text-left px-5 py-3">IP Address</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.student_id} className="border-b border-emerald-100 hover:bg-emerald-50/50">
                  <td className="px-5 py-3 text-emerald-950 font-bold">{a.student_id}</td>
                  <td className="px-5 py-3 text-slate-700 font-medium">{a.hostname}</td>
                  <td className="px-5 py-3 text-slate-500 font-mono text-xs">{a.ip}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border ${a.status === 'online' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'}`}>
                      <span className={`w-2 h-2 rounded-full ${a.status === 'online' ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'}`} />
                      {a.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs font-mono">{new Date(a.last_seen).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {agents.length === 0 && <p className="text-center text-slate-400 py-8 text-sm font-medium">No agents connected</p>}
        </div>
      )}

      {/* ── AUDIT LOG ── */}
      {tab === 'audit' && (
        <div className="bg-white border border-emerald-300/80 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-emerald-100/60 border-b border-emerald-200">
              <tr className="text-emerald-950 text-xs font-black uppercase tracking-wider">
                <th className="text-left px-5 py-3">Time</th>
                <th className="text-left px-5 py-3">Actor</th>
                <th className="text-left px-5 py-3">Action</th>
                <th className="text-left px-5 py-3">Target</th>
                <th className="text-left px-5 py-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map(log => (
                <tr key={log.id} className="border-b border-emerald-100 hover:bg-emerald-50/50">
                  <td className="px-5 py-3 text-slate-500 text-xs font-mono">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-5 py-3 text-emerald-800 font-extrabold">{log.actor}</td>
                  <td className="px-5 py-3 text-slate-800 font-medium">{log.action?.replace(/_/g, ' ')}</td>
                  <td className="px-5 py-3 text-slate-600 font-mono text-xs">{log.target}</td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{log.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {auditLog.length === 0 && <p className="text-center text-slate-400 py-8 text-sm font-medium">No audit events recorded</p>}
        </div>
      )}
    </div>
  );
}
