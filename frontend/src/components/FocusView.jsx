import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ShieldAlert, Monitor, TerminalSquare, Camera, Lock, Clock, TrendingUp, AlertTriangle, CheckCircle, MessageSquare, BarChart2, UserX } from 'lucide-react';
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
  tab_switched: 'text-orange-400',
  blacklisted_app: 'text-red-400',
  window_spike: 'text-cyan-400',
  idle_timeout: 'text-yellow-400',
  usb_detected: 'text-pink-400',
  large_clipboard_paste: 'text-purple-400',
  statistical_anomaly: 'text-amber-400',
};

// ── Risk Score Breakdown ─────────────────────────────────────────────────────
function RiskBreakdown({ flags }) {
  if (!flags || flags.length === 0) return null;

  // Group by rule_type and sum weights
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
    <div className="bg-[#0F1115] rounded-xl p-3.5 border border-white/10">
      <p className="text-[10px] text-white/40 font-bold tracking-wider uppercase mb-3 flex items-center gap-2">
        <BarChart2 className="w-3 h-3" /> Risk Score Breakdown
      </p>
      <div className="space-y-2">
        {entries.map(([key, val]) => {
          const color = RULE_COLORS[key] || 'text-white/60';
          const pct = grandTotal > 0 ? (val.total / grandTotal) * 100 : 0;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-xs font-semibold ${color}`}>
                  {val.label}
                  {val.count > 1 && <span className="text-white/30 ml-1">×{val.count}</span>}
                </span>
                <span className="text-xs font-mono text-white/60">+{val.total}pts</span>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500/60 to-red-400/80 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-2 border-t border-white/5 flex justify-between items-center">
        <span className="text-[10px] text-white/30 uppercase tracking-wider">Total Score</span>
        <span className={`text-sm font-bold ${grandTotal >= 60 ? 'text-red-400' : grandTotal >= 30 ? 'text-yellow-400' : 'text-green-400'}`}>
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

  // Build unified timeline sorted oldest → newest
  const allTimes = flags.map(f => new Date(f.timestamp || f.created_at).getTime()).filter(Boolean);
  if (allTimes.length === 0) return null;

  const minT = Math.min(...allTimes);
  const maxT = Math.max(...allTimes);
  const range = maxT - minT || 1;

  // Match each flag to nearest snapshot
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
    <div className="bg-[#0F1115] rounded-xl p-3 border border-white/10">
      <p className="text-[10px] text-white/40 font-bold tracking-wider uppercase mb-3 flex items-center gap-2">
        <Clock className="w-3 h-3" /> Session Timeline Scrubber
      </p>
      <div className="relative h-8 bg-white/5 rounded-full mx-1">
        {/* Timeline track */}
        <div className="absolute inset-0 flex items-center px-1">
          <div className="w-full h-0.5 bg-white/10 rounded-full" />
        </div>

        {/* Incident dots */}
        {flags.map((f, i) => {
          const fTime = new Date(f.timestamp || f.created_at).getTime();
          if (!fTime) return null;
          const pct = ((fTime - minT) / range) * 100;
          const color = RULE_COLORS[f.rule_type] || 'text-red-400';
          const bgClass = f.rule_type === 'tab_switched' ? 'bg-orange-500' :
            f.rule_type === 'blacklisted_app' ? 'bg-red-500' :
            f.rule_type === 'window_spike' ? 'bg-cyan-500' :
            f.rule_type === 'idle_timeout' ? 'bg-yellow-500' :
            'bg-red-400';

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
              <div className={`w-3 h-3 rounded-full ${bgClass} border-2 border-[#0F1115] transition-all group-hover/dot:scale-150`} />
              {/* Tooltip */}
              {hoverIdx === i && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#1A1D24] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] whitespace-nowrap z-50 shadow-xl pointer-events-none">
                  <p className={`font-bold ${color}`}>{formatRule(f.rule_type)}</p>
                  <p className="text-white/40">{new Date(f.timestamp || f.created_at).toLocaleTimeString()}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Time labels */}
      <div className="flex justify-between mt-1.5 px-1">
        <span className="text-[9px] text-white/20 font-mono">
          {new Date(minT).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="text-[9px] text-white/20">{flags.length} incidents</span>
        <span className="text-[9px] text-white/20 font-mono">
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
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-[#1A1D24] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-1">Send Warning to Student</h3>
        <p className="text-xs text-white/40 mb-4">Message will appear as a popup on the student's screen immediately.</p>
        <div className="space-y-2 mb-3">
          {presets.map((p, i) => (
            <button
              key={i}
              onClick={() => setMsg(p)}
              className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/70 transition-all border border-white/5"
            >
              {p}
            </button>
          ))}
        </div>
        <textarea
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder="Or type a custom message…"
          className="w-full bg-[#0F1115] border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/20 resize-none h-20 focus:outline-none focus:border-blue-500/40 mb-4"
        />
        <div className="flex gap-3">
          <button
            onClick={() => { if (msg.trim()) { onSend(msg.trim()); onClose(); } }}
            disabled={!msg.trim()}
            className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white rounded-xl font-bold text-sm transition-all"
          >
            ⚠️ Send Warning
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-sm transition-all"
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
      ? 'text-red-400 bg-red-500/10 border-red-500/20'
      : risk >= 30
      ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
      : 'text-green-400 bg-green-500/10 border-green-500/20';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
    >
      {showWarnModal && (
        <WarnModal onSend={handleWarnStudent} onClose={() => setShowWarnModal(false)} />
      )}

      <div className="bg-[#14171F] border border-white/10 w-full max-w-7xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Alert Banner */}
        {studentFlags.length > 0 && (
          <div className="bg-red-600/90 text-white px-6 py-2 flex items-center justify-between text-xs font-bold tracking-wider uppercase animate-pulse">
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Unusual Behavior Detected — {studentFlags.length} Active Incidents
            </span>
            <span>{formatRule(studentFlags[0]?.rule_type)}</span>
          </div>
        )}

        {/* Action Feedback Toast */}
        {actionFeedback && (
          <div className="bg-blue-600/20 border-b border-blue-500/20 text-blue-300 px-6 py-2 text-xs font-semibold">
            {actionFeedback}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#1A1D24]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Monitor className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {safeString(student.name) || safeString(student.student_id, 'Student')}
              </h2>
              <p className="text-xs text-white/40">
                {safeString(student.student_id)} · {safeString(student.hostname, 'Browser')} · {safeString(student.ip, 'Web')}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-bold border ${riskColor}`}>
              Risk: {risk}%
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Warn Student */}
            <button
              onClick={() => setShowWarnModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-xl text-sm border border-orange-500/20 transition-all font-medium"
            >
              <MessageSquare className="w-4 h-4" /> Warn
            </button>

            {/* Lock/Unlock */}
            {student.is_locked ? (
              <button
                onClick={() => onUnlockScreen && onUnlockScreen(student.student_id)}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-xl text-sm border border-green-500/40 transition-all font-bold animate-pulse"
              >
                🔓 Unlock Screen
              </button>
            ) : (
              <button
                onClick={() => onLockScreen && onLockScreen(student.student_id)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-xl text-sm border border-orange-500/20 transition-all font-medium"
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
              className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl text-sm border border-red-500/30 transition-all font-bold"
            >
              <UserX className="w-4 h-4" /> Kick Out
            </button>

            <button
              onClick={() => onClose && onClose()}
              className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all"
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
            <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-white/5 relative">
              {student.latestFrame && typeof student.latestFrame === 'string' ? (
                <img
                  src={`data:image/jpeg;base64,${student.latestFrame}`}
                  className="w-full h-full object-contain"
                  alt="Live feed"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-3">
                  <Monitor className="w-16 h-16" />
                  <p className="text-lg">Awaiting screen feed…</p>
                </div>
              )}
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 px-2 py-1 rounded-lg">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-white font-medium">LIVE</span>
              </div>
            </div>

            {/* Telemetry row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Typing Speed', value: student.activity?.typing_speed || 0, unit: 'kpm', color: 'text-blue-400' },
                { label: 'Mouse Activity', value: Math.round(student.activity?.mouse_score || 0), unit: 'px', color: 'text-purple-400' },
                {
                  label: 'Idle Time',
                  value: Math.round(student.activity?.idle_seconds || 0),
                  unit: 's',
                  color: (student.activity?.idle_seconds || 0) > 30 ? 'text-yellow-400' : 'text-green-400'
                },
                { label: 'Activity Score', value: student.activity?.activity_score || 0, unit: '%', color: 'text-cyan-400' }
              ].map(({ label, value, unit, color }) => (
                <div key={label} className="bg-[#1A1D24] rounded-xl p-4 border border-white/5">
                  <p className="text-xs text-white/40 mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>
                    {value}
                    <span className="text-sm font-normal text-white/30 ml-1">{unit}</span>
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
              <div>
                <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Evidence Snapshots ({snapshots.length})
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {snapshots.map((snap, i) => (
                    <div
                      key={snap?.id || snap?.created_at || i}
                      onClick={() => setActiveSnap(activeSnap?.id === snap?.id ? null : snap)}
                      className={`flex-shrink-0 w-32 cursor-pointer rounded-lg overflow-hidden border transition-all ${
                        activeSnap?.id === snap?.id ? 'border-blue-500' : 'border-white/10 hover:border-blue-500/50'
                      }`}
                    >
                      {snap?.jpeg_base64 && (
                        <img
                          src={`data:image/jpeg;base64,${snap.jpeg_base64}`}
                          className="w-full h-20 object-cover"
                          alt={`Snap ${i}`}
                        />
                      )}
                      <p className="text-[10px] text-white/30 p-1 bg-[#1A1D24] truncate">
                        {snap?.created_at ? new Date(snap.created_at).toLocaleTimeString() : ''}
                      </p>
                    </div>
                  ))}
                </div>
                {activeSnap?.jpeg_base64 && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-blue-500/20">
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
          <div className="w-96 border-l border-white/5 bg-[#1A1D24] flex flex-col overflow-y-auto p-5 gap-5">

            {/* AI Behavior Engine */}
            <div>
              <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" /> AI Behavior Engine
              </h3>
              {loading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-3 bg-white/5 rounded w-3/4" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                  <div className="h-3 bg-white/5 rounded w-5/6" />
                </div>
              ) : explanation ? (
                <div className="space-y-3">
                  <p className="text-sm text-white/80 leading-relaxed font-medium p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                    {safeString(explanation.explanation, 'Monitoring active.')}
                  </p>
                  {Array.isArray(explanation.reasons) && explanation.reasons.length > 0 && (
                    <div>
                      <p className="text-xs text-white/40 uppercase tracking-wider mb-2 font-bold">
                        Flagged Reasons ({explanation.reasons.length})
                      </p>
                      <ul className="space-y-2">
                        {explanation.reasons.map((r, i) => (
                          <li
                            key={i}
                            className="text-xs text-white/70 bg-[#0F1115] p-2.5 rounded-lg border border-white/5 flex items-start gap-2 leading-relaxed"
                          >
                            <span className="text-red-400 font-bold shrink-0">•</span>
                            {safeString(r)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                        explanation.confidence === 'high'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : explanation.confidence === 'medium'
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          : 'bg-green-500/20 text-green-400 border border-green-500/30'
                      }`}
                    >
                      {safeString(explanation.confidence, 'low')} confidence
                    </span>
                  </div>
                  <div className="bg-[#0F1115] rounded-xl p-3.5 border border-white/10 shadow-lg">
                    <p className="text-[10px] text-white/40 font-bold tracking-wider uppercase mb-1">
                      SUGGESTED FACULTY ACTION
                    </p>
                    <p className="text-sm text-white font-semibold">
                      {safeString(explanation.suggestedAction, 'Continue monitoring')}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-white/30 italic">No flags yet. Behavior appears normal.</p>
              )}
            </div>

            {/* Risk Score Breakdown */}
            <RiskBreakdown flags={studentFlags} />

            {/* Incident Timeline */}
            <div className="pt-4 border-t border-white/5">
              <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
                <TerminalSquare className="w-4 h-4 text-blue-400" /> Incident Timeline ({studentFlags.length})
              </h3>
              <div className="space-y-3">
                {studentFlags.length === 0 ? (
                  <p className="text-sm text-white/20 italic">No active incidents in this session.</p>
                ) : (
                  studentFlags.map((f, i) => (
                    <div key={f?.id || f?.timestamp || i} className="bg-[#0F1115] p-3 rounded-xl border border-white/5">
                      <div className="flex items-start gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className={`text-xs font-bold uppercase tracking-wide ${RULE_COLORS[f?.rule_type] || 'text-red-400'}`}>
                              {formatRule(f?.rule_type)}
                            </p>
                            {f?.timestamp && (
                              <span className="text-[10px] text-white/30 font-mono">
                                {new Date(f.timestamp).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/60 leading-relaxed mb-2">{safeString(f?.detail)}</p>
                          {/* Action buttons per incident */}
                          {f?.id && (
                            <div className="flex gap-1.5 mt-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDismissFlag(f.id); }}
                                className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded text-[10px] font-medium transition-all border border-green-500/20"
                              >
                                <CheckCircle className="w-2.5 h-2.5" /> Dismiss
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleFlagForReview(f.id); }}
                                className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded text-[10px] font-medium transition-all border border-yellow-500/20"
                              >
                                <AlertTriangle className="w-2.5 h-2.5" /> Review
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
