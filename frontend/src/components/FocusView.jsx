import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Monitor, TerminalSquare, Camera, Lock, Clock, AlertTriangle, CheckCircle, MessageSquare, BarChart2, UserX } from 'lucide-react';
import { getApiUrl } from '../config';

const safeString = (val, fallback = '') => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return fallback;
};

const formatRule = (rule) => {
  const str = safeString(rule, 'Violation');
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const RULE_COLORS = {
  tab_switched: 'text-amber-700',
  blacklisted_app: 'text-rose-700',
  window_spike: 'text-teal-700',
  idle_timeout: 'text-amber-800',
  usb_detected: 'text-rose-800',
  large_clipboard_paste: 'text-purple-800',
  statistical_anomaly: 'text-emerald-800',
};

// ── Risk Score Breakdown ─────────────────────────────────────────────────────
function RiskBreakdown({ flags }) {
  if (!flags || flags.length === 0) return null;

  const breakdown = {};
  flags.filter(f => f.rule_type !== 'secondary_monitor' && f.rule_type !== 'remote_access_tool').forEach(f => {
    const key = f.rule_type || 'unknown';
    if (!breakdown[key]) breakdown[key] = { label: formatRule(key), total: 0, count: 0 };
    breakdown[key].total += (f.risk_score_delta || f.weight || 10);
    breakdown[key].count += 1;
  });

  const entries = Object.entries(breakdown).sort((a, b) => b[1].total - a[1].total);
  const grandTotal = Math.min(100, entries.reduce((s, [, v]) => s + v.total, 0));

  return (
    <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-sm">
      <p className="text-[10px] text-emerald-900 font-black tracking-wider uppercase mb-3 flex items-center gap-2">
        <BarChart2 className="w-3.5 h-3.5 text-emerald-700" /> Risk Score Breakdown
      </p>
      <div className="space-y-2.5">
        {entries.map(([key, val]) => {
          const color = RULE_COLORS[key] || 'text-slate-700';
          const pct = grandTotal > 0 ? (val.total / grandTotal) * 100 : 0;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-black ${color}`}>
                  {val.label}
                  {val.count > 1 && <span className="text-slate-500 font-bold ml-1">×{val.count}</span>}
                </span>
                <span className="text-xs font-mono font-bold text-slate-700">+{val.total}pts</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-rose-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3.5 pt-2.5 border-t border-emerald-100 flex justify-between items-center">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold">Total Cumulative Risk</span>
        <span className={`text-sm font-black ${grandTotal >= 60 ? 'text-rose-700' : grandTotal >= 30 ? 'text-amber-700' : 'text-emerald-700'}`}>
          {grandTotal}%
        </span>
      </div>
    </div>
  );
}

// ── Timeline Scrubber ────────────────────────────────────────────────────────
function TimelineScrubber({ flags, snapshots, onSelectSnap }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  if (!flags || flags.length === 0) return null;

  const allTimes = flags.map(f => new Date(f.timestamp || f.created_at).getTime()).filter(Boolean);
  if (allTimes.length === 0) return null;

  const minT = Math.min(...allTimes);
  const maxT = Math.max(...allTimes);
  const range = maxT - minT || 1;

  const matchSnapshot = (flag) => {
    const fTime = new Date(flag.timestamp || flag.created_at).getTime();
    if (!snapshots?.length) return null;
    return snapshots.reduce((best, snap) => {
      const sTime = new Date(snap.created_at).getTime();
      const bestTime = best ? new Date(best.created_at).getTime() : Infinity;
      return Math.abs(sTime - fTime) < Math.abs(bestTime - fTime) ? snap : best;
    }, null);
  };

  return (
    <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-sm">
      <p className="text-[10px] text-emerald-900 font-black tracking-wider uppercase mb-3 flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-emerald-700" /> Session Timeline Scrubber
      </p>
      <div className="relative h-8 bg-emerald-50/60 rounded-full mx-1 border border-emerald-200/80">
        <div className="absolute inset-0 flex items-center px-1">
          <div className="w-full h-1 bg-emerald-200 rounded-full" />
        </div>

        {flags.map((f, i) => {
          const fTime = new Date(f.timestamp || f.created_at).getTime();
          if (!fTime) return null;
          const pct = ((fTime - minT) / range) * 100;
          const color = RULE_COLORS[f.rule_type] || 'text-rose-700';
          const bgClass = f.rule_type === 'tab_switched' ? 'bg-amber-500' :
            f.rule_type === 'blacklisted_app' ? 'bg-rose-600' :
            f.rule_type === 'window_spike' ? 'bg-teal-500' :
            f.rule_type === 'idle_timeout' ? 'bg-amber-600' :
            'bg-rose-500';

          return (
            <div
              key={f.id || i}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer group/dot"
              style={{ left: `${pct}%` }}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              onClick={() => {
                const snap = matchSnapshot(f);
                if (snap) onSelectSnap(snap);
              }}
            >
              <div className={`w-3.5 h-3.5 rounded-full ${bgClass} border-2 border-white shadow-sm transition-all group-hover/dot:scale-150`} />
              {hoverIdx === i && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white border border-emerald-200 rounded-xl px-2.5 py-1.5 text-[10px] whitespace-nowrap z-50 shadow-xl pointer-events-none">
                  <p className={`font-black ${color}`}>{formatRule(f.rule_type)}</p>
                  <p className="text-slate-500 font-mono font-bold">{new Date(f.timestamp || f.created_at).toLocaleTimeString()}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-2 px-1">
        <span className="text-[10px] text-slate-500 font-mono font-bold">
          {new Date(minT).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="text-[10px] text-slate-600 font-black">{flags.length} incidents</span>
        <span className="text-[10px] text-slate-500 font-mono font-bold">
          {new Date(maxT).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

// ── Warn Modal ───────────────────────────────────────────────────────────────
function WarnModal({ onSend, onClose }) {
  const [msg, setMsg] = useState('');
  const presets = [
    'Please focus on your exam.',
    'Your activity is being monitored. Suspicious behavior detected.',
    'Close all unauthorized applications immediately.',
  ];

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#FAFCFA] border-2 border-emerald-300/80 rounded-3xl p-6 w-full max-w-md shadow-2xl text-slate-900">
        <h3 className="text-lg font-black text-emerald-950 mb-1">Send Warning to Student</h3>
        <p className="text-xs text-slate-600 font-medium mb-4">Message will pop up on the student's screen immediately.</p>
        <div className="space-y-2 mb-3">
          {presets.map((p, i) => (
            <button
              key={i}
              onClick={() => setMsg(p)}
              className="w-full text-left px-3.5 py-2.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100 text-xs font-bold text-emerald-950 transition-all border border-emerald-200"
            >
              {p}
            </button>
          ))}
        </div>
        <textarea
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder="Or type a custom warning message…"
          className="w-full bg-white border border-emerald-200 rounded-xl p-3 text-sm text-slate-900 placeholder-slate-400 resize-none h-20 focus:outline-none focus:border-emerald-500 mb-4 shadow-inner"
        />
        <div className="flex gap-3">
          <button
            onClick={() => { if (msg.trim()) { onSend(msg.trim()); onClose(); } }}
            disabled={!msg.trim()}
            className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl font-black text-xs transition-all shadow-md shadow-amber-600/30 uppercase tracking-wider"
          >
            ⚠️ Send Warning
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main FocusView ───────────────────────────────────────────────────────────
export default function FocusView({ student, onClose, onLockScreen, onUnlockScreen, socket }) {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [activeSnap, setActiveSnap] = useState(null);
  const [showWarnModal, setShowWarnModal] = useState(null);
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [actionFeedback, setActionFeedback] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!student?.student_id) return;
    let isMounted = true;

    setLoading(true);
    fetch(getApiUrl(`/students/${student.student_id}/ai-explanation`))
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (isMounted) {
          setExplanation(data && typeof data === 'object' ? data : null);
          setLoading(false);
        }
      })
      .catch(() => { if (isMounted) setLoading(false); });

    fetch(getApiUrl(`/students/${student.student_id}/snapshots`))
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        if (isMounted) setSnapshots(Array.isArray(data) ? [...data].reverse() : []);
      })
      .catch(() => { if (isMounted) setSnapshots([]); });

    return () => { isMounted = false; };
  }, [student?.student_id, student?.flags?.length]);

  const showFeedback = (msg) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(''), 3000);
  };

  const handleDismissFlag = async (flagId) => {
    try {
      const res = await fetch(getApiUrl(`/flags/${flagId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' }),
      });
      if (res.ok) {
        setDismissedIds(prev => new Set([...prev, flagId]));
        showFeedback('✅ Incident dismissed successfully.');
      }
    } catch { showFeedback('❌ Failed to dismiss incident.'); }
  };

  const handleFlagForReview = async (flagId) => {
    try {
      const res = await fetch(getApiUrl(`/flags/${flagId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'flagged_for_review' }),
      });
      if (res.ok) showFeedback('⚠️ Flagged for human review.');
    } catch { showFeedback('❌ Failed to flag for review.'); }
  };

  const handleWarnStudent = (message) => {
    if (socket) {
      socket.emit('teacher:warn_student', { student_id: student.student_id, message });
      showFeedback('📢 Warning sent to student\'s screen!');
    }
  };

  if (!student) return null;

  const allFlags = (Array.isArray(student.flags) ? student.flags : []).filter(f => f.rule_type !== 'secondary_monitor' && f.rule_type !== 'remote_access_tool');
  const studentFlags = allFlags.filter(f => !dismissedIds.has(f.id));
  const risk = typeof student.risk_score === 'number' ? student.risk_score : 0;
  const riskColor =
    risk >= 60
      ? 'text-rose-700 bg-rose-50 border-rose-300'
      : risk >= 30
      ? 'text-amber-700 bg-amber-50 border-amber-300'
      : 'text-emerald-700 bg-emerald-50 border-emerald-300';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
    >
      {showWarnModal && (
        <WarnModal onSend={handleWarnStudent} onClose={() => setShowWarnModal(false)} />
      )}

      <div className="bg-[#FAFCFA] border-2 border-emerald-300/80 w-full max-w-7xl h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-900">

        {/* Alert Banner */}
        {studentFlags.length > 0 && (
          <div className="bg-rose-600 text-white px-6 py-2.5 flex items-center justify-between text-xs font-black tracking-wider uppercase animate-pulse shadow-md">
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Unusual Behavior Detected — {studentFlags.length} Active Incidents
            </span>
            <span>{formatRule(studentFlags[0]?.rule_type)}</span>
          </div>
        )}

        {/* Action Feedback Toast */}
        {actionFeedback && (
          <div className="bg-emerald-100 border-b border-emerald-300 text-emerald-950 px-6 py-2 text-xs font-extrabold">
            {actionFeedback}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-200/80 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center border border-emerald-300">
              <Monitor className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <h2 className="text-lg font-black text-emerald-950">
                {safeString(student.name) || safeString(student.student_id, 'Student')}
              </h2>
              <p className="text-xs text-slate-600 font-bold font-mono">
                {safeString(student.student_id)} · {safeString(student.hostname, 'Browser')} · {safeString(student.ip, 'Web')}
              </p>
            </div>
            <div className={`px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-xs ${riskColor}`}>
              Risk: {risk}%
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Warn Student */}
            <button
              onClick={() => setShowWarnModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-black border border-amber-300 transition-all shadow-xs hover:scale-105 uppercase tracking-wider"
            >
              <MessageSquare className="w-4 h-4" /> Warn
            </button>

            {/* Lock/Unlock */}
            {student.is_locked ? (
              <button
                onClick={() => onUnlockScreen && onUnlockScreen(student.student_id)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black border border-emerald-500 transition-all shadow-md shadow-emerald-600/30 uppercase tracking-wider"
              >
                🔓 Unlock Screen
              </button>
            ) : (
              <button
                onClick={() => onLockScreen && onLockScreen(student.student_id)}
                className="flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-900 rounded-xl text-xs font-black border border-rose-300 transition-all shadow-xs hover:scale-105 uppercase tracking-wider"
              >
                <Lock className="w-4 h-4" /> Lock Screen
              </button>
            )}

            {/* Kick Out */}
            <button
              onClick={() => {
                if (window.confirm(`Are you sure you want to kick ${student.name || student.student_id} out of the exam session?`)) {
                  if (socket) {
                    socket.emit('teacher:kick_student', { student_id: student.student_id });
                    setActionFeedback(`Student ${student.student_id} has been kicked from the exam.`);
                    if (onClose) onClose();
                  }
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white rounded-xl text-xs font-black shadow-lg shadow-red-600/30 border border-red-400/30 transition-all hover:scale-105 active:scale-95 uppercase tracking-wider"
            >
              <UserX className="w-4 h-4" /> Kick Out
            </button>

            <button
              onClick={() => onClose && onClose()}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Live Feed + Timeline + Snapshots */}
          <div className="flex-1 flex flex-col p-5 gap-4 overflow-y-auto">
            {/* Live screen */}
            <div className="aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-emerald-200/80 relative shadow-inner">
              {student.latestFrame && typeof student.latestFrame === 'string' ? (
                <img
                  src={`data:image/jpeg;base64,${student.latestFrame}`}
                  className="w-full h-full object-contain"
                  alt="Live feed"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                  <Monitor className="w-16 h-16" />
                  <p className="text-lg font-bold">Awaiting screen feed…</p>
                </div>
              )}
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-700">
                <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                <span className="text-xs text-white font-bold tracking-wider">LIVE</span>
              </div>
            </div>

            {/* Telemetry row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Typing Speed', value: student.activity?.typing_speed || 0, unit: 'kpm', color: 'text-emerald-800' },
                { label: 'Mouse Activity', value: Math.round(student.activity?.mouse_score || 0), unit: 'px', color: 'text-teal-800' },
                {
                  label: 'Idle Time',
                  value: Math.round(student.activity?.idle_seconds || 0),
                  unit: 's',
                  color: (student.activity?.idle_seconds || 0) > 30 ? 'text-amber-700' : 'text-emerald-700'
                },
                { label: 'Activity Score', value: student.activity?.activity_score || 0, unit: '%', color: 'text-teal-700' }
              ].map(({ label, value, unit, color }) => (
                <div key={label} className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-sm">
                  <p className="text-xs text-slate-500 font-extrabold uppercase tracking-wider mb-1">{label}</p>
                  <p className={`text-2xl font-black ${color}`}>
                    {value}
                    <span className="text-xs font-bold text-slate-500 ml-1">{unit}</span>
                  </p>
                </div>
              ))}
            </div>

            {/* Timeline Scrubber */}
            <TimelineScrubber
              flags={studentFlags}
              snapshots={snapshots}
              onSelectSnap={setActiveSnap}
            />

            {/* Evidence Snapshots */}
            {snapshots.length > 0 && (
              <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-sm">
                <h3 className="text-xs font-black text-emerald-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-700" /> Evidence Snapshots ({snapshots.length})
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {snapshots.map((snap, i) => (
                    <div
                      key={snap?.id || snap?.created_at || i}
                      onClick={() => setActiveSnap(activeSnap?.id === snap?.id ? null : snap)}
                      className={`flex-shrink-0 w-36 cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                        activeSnap?.id === snap?.id ? 'border-emerald-600 shadow-md scale-105' : 'border-emerald-200 hover:border-emerald-400'
                      }`}
                    >
                      {snap?.jpeg_base64 && (
                        <img
                          src={`data:image/jpeg;base64,${snap.jpeg_base64}`}
                          className="w-full h-20 object-cover"
                          alt={`Snap ${i}`}
                        />
                      )}
                      <p className="text-[10px] text-slate-700 p-1.5 bg-emerald-50 truncate font-mono font-bold border-t border-emerald-200">
                        {snap?.created_at ? new Date(snap.created_at).toLocaleTimeString() : ''}
                      </p>
                    </div>
                  ))}
                </div>
                {activeSnap?.jpeg_base64 && (
                  <div className="mt-3 rounded-2xl overflow-hidden border-2 border-emerald-300 shadow-md">
                    <img
                      src={`data:image/jpeg;base64,${activeSnap.jpeg_base64}`}
                      className="w-full object-contain max-h-64"
                      alt="Selected snapshot"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="w-96 border-l border-emerald-200/80 bg-[#FAFCFA] flex flex-col overflow-y-auto p-5 gap-5">

            {/* AI Behavior Engine */}
            <div>
              <h3 className="text-xs font-black text-emerald-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" /> AI Behavior Engine
              </h3>
              {loading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-3 bg-emerald-100 rounded w-3/4" />
                  <div className="h-3 bg-emerald-100 rounded w-1/2" />
                </div>
              ) : explanation ? (
                <div className="space-y-3">
                  <p className="text-xs font-extrabold text-rose-900 leading-relaxed p-3.5 bg-rose-50 rounded-2xl border border-rose-200 shadow-xs">
                    {safeString(explanation.explanation, 'Monitoring active.')}
                  </p>
                  {Array.isArray(explanation.reasons) && explanation.reasons.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-2">
                        Flagged Reasons ({explanation.reasons.length})
                      </p>
                      <ul className="space-y-2">
                        {explanation.reasons.map((r, i) => (
                          <li
                            key={i}
                            className="text-xs font-bold text-slate-800 bg-white p-3 rounded-xl border border-emerald-200/80 flex items-start gap-2 leading-relaxed shadow-xs"
                          >
                            <span className="text-rose-600 font-black shrink-0">•</span>
                            {safeString(r)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 shadow-xs">
                    <p className="text-[10px] text-amber-800 font-black tracking-wider uppercase mb-1">
                      SUGGESTED FACULTY ACTION
                    </p>
                    <p className="text-xs font-black text-slate-900">
                      {safeString(explanation.suggestedAction, 'Continue monitoring')}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 font-bold italic">No flags yet. Behavior appears normal.</p>
              )}
            </div>

            {/* Risk Score Breakdown */}
            <RiskBreakdown flags={studentFlags} />

            {/* Incident Timeline */}
            <div className="pt-4 border-t border-emerald-200/80">
              <h3 className="text-xs font-black text-emerald-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <TerminalSquare className="w-4 h-4 text-emerald-700" /> Incident Timeline ({studentFlags.length})
              </h3>
              <div className="space-y-3">
                {studentFlags.length === 0 ? (
                  <p className="text-xs text-slate-500 font-bold italic">No active incidents in this session.</p>
                ) : (
                  studentFlags.map((f, i) => (
                    <div key={f?.id || f?.timestamp || i} className="bg-white p-3.5 rounded-2xl border border-emerald-200/80 shadow-xs">
                      <div className="flex items-start gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-600 mt-1 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className={`text-xs font-black uppercase tracking-wide ${RULE_COLORS[f?.rule_type] || 'text-rose-700'}`}>
                              {formatRule(f?.rule_type)}
                            </p>
                            {f?.timestamp && (
                              <span className="text-[10px] text-slate-500 font-mono font-bold">
                                {new Date(f.timestamp).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-slate-700 leading-relaxed mb-2.5">{safeString(f?.detail)}</p>
                          {f?.id && (
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDismissFlag(f.id); }}
                                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-[10px] font-black transition-all border border-emerald-300"
                              >
                                <CheckCircle className="w-3 h-3" /> Dismiss
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleFlagForReview(f.id); }}
                                className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[10px] font-black transition-all border border-amber-300"
                              >
                                <AlertTriangle className="w-3 h-3" /> Review
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
