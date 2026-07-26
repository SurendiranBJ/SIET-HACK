import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Eye, Wifi, WifiOff, TrendingUp, Filter, ArrowDownUp, Lock, Unlock, MessageSquare } from 'lucide-react';
import FocusView from './FocusView';
import { getApiUrl } from '../config';

// ── Sparkline SVG Component ──────────────────────────────────────────────────
function Sparkline({ studentId }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!studentId) return;
    fetch(getApiUrl(`/students/${studentId}/risk-history`))
      .then(r => r.ok ? r.json() : [])
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]));
  }, [studentId]);

  if (history.length < 2) {
    return (
      <div className="h-8 flex items-center">
        <span className="text-[10px] text-white/20 italic">No trend data</span>
      </div>
    );
  }

  const W = 120, H = 32, pad = 2;
  const maxRisk = Math.max(...history.map(h => h.risk), 1);
  const points = history.map((h, i) => {
    const x = pad + (i / (history.length - 1)) * (W - pad * 2);
    const y = H - pad - (h.risk / maxRisk) * (H - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  const lastRisk = history[history.length - 1]?.risk || 0;
  const lineColor = lastRisk >= 60 ? '#ef4444' : lastRisk >= 30 ? '#eab308' : '#22c55e';

  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      {/* Last point dot */}
      {history.length > 0 && (() => {
        const last = history[history.length - 1];
        const x = W - pad;
        const y = H - pad - (last.risk / maxRisk) * (H - pad * 2);
        return <circle cx={x} cy={y} r="2.5" fill={lineColor} />;
      })()}
    </svg>
  );
}

// ── Session Health Summary Bar ───────────────────────────────────────────────
function SessionHealthBar({ students }) {
  const high = students.filter(s => (s.risk_score || 0) >= 60).length;
  const medium = students.filter(s => (s.risk_score || 0) >= 30 && (s.risk_score || 0) < 60).length;
  const normal = students.filter(s => (s.risk_score || 0) < 30).length;
  const total = students.length;

  if (total === 0) return null;

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 bg-white border border-emerald-300/80 rounded-2xl mb-5 flex-wrap shadow-sm text-slate-900">
      <span className="text-xs text-emerald-950 font-black uppercase tracking-wider">Session Health</span>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-xs" />
        <span className="text-xs font-black text-rose-700">{high} High Risk</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-xs" />
        <span className="text-xs font-black text-amber-700">{medium} Medium</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-xs" />
        <span className="text-xs font-black text-emerald-700">{normal} Clean</span>
      </div>
      <div className="ml-auto text-xs text-emerald-950 font-extrabold font-mono">{total} Students Total</div>
      {/* Mini progress bar */}
      {total > 0 && (
        <div className="w-full h-2 bg-emerald-100/70 rounded-full overflow-hidden flex border border-emerald-200/60">
          <div className="bg-rose-500 h-full transition-all" style={{ width: `${(high / total) * 100}%` }} />
          <div className="bg-amber-500 h-full transition-all" style={{ width: `${(medium / total) * 100}%` }} />
          <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(normal / total) * 100}%` }} />
        </div>
      )}
    </div>
  );
}

// ── Main LiveGrid ────────────────────────────────────────────────────────────
export default function LiveGrid({ students, flags, onLockScreen, onUnlockScreen, socket }) {
  const [focusedStudentId, setFocusedStudentId] = useState(null);
  const [autoFocused, setAutoFocused] = useState(null);
  const [enableAutoFocus, setEnableAutoFocus] = useState(false);
  const [sortMode, setSortMode] = useState('risk'); // 'risk' | 'name' | 'flags'
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'high' | 'flagged' | 'normal'

  // Auto-focus flagged student when enabled
  useEffect(() => {
    if (!enableAutoFocus || !flags || flags.length === 0) return;
    const latest = flags[0];
    if (latest && !focusedStudentId) {
      setAutoFocused(latest.student_id);
    }
  }, [flags, enableAutoFocus, focusedStudentId]);

  const activeFocusId = focusedStudentId || autoFocused;
  const focusedStudent = activeFocusId
    ? students.find(s => String(s?.student_id) === String(activeFocusId))
    : null;

  const getRiskColor = (score) => {
    if (score >= 60) return 'border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.15)]';
    if (score >= 30) return 'border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.12)]';
    return 'border-emerald-300/80';
  };

  const getRiskLabel = (score) => {
    if (score >= 60) return 'High Risk';
    if (score >= 30) return 'Moderate';
    return 'Normal';
  };

  // Apply filter
  const filtered = students.filter(s => {
    const risk = s.risk_score || 0;
    if (filterMode === 'high') return risk >= 60;
    if (filterMode === 'flagged') return (s.flags?.length || 0) > 0;
    if (filterMode === 'normal') return risk < 30;
    return true;
  });

  // Apply sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'risk') return (b.risk_score || 0) - (a.risk_score || 0);
    if (sortMode === 'name') return (a.name || a.student_id).localeCompare(b.name || b.student_id);
    if (sortMode === 'flags') return (b.flags?.length || 0) - (a.flags?.length || 0);
    return 0;
  });

  return (
    <div>
      {/* Session Health Summary Bar */}
      <SessionHealthBar students={students} />

      {/* Controls Row */}
      <div className="flex items-center justify-between mb-4 px-1 flex-wrap gap-3">
        <span className="text-xs font-black text-emerald-950 uppercase tracking-wider">Live Classroom Monitoring Grid</span>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter */}
          <div className="flex items-center gap-1 bg-white border border-emerald-300 rounded-xl p-1 shadow-sm">
            <Filter className="w-3.5 h-3.5 text-emerald-700 ml-1.5" />
            {[
              { key: 'all', label: 'All' },
              { key: 'high', label: '🔴 High' },
              { key: 'flagged', label: '⚠️ Flagged' },
              { key: 'normal', label: '🟢 Clean' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterMode(key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all ${
                  filterMode === key
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-900 hover:bg-emerald-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 bg-white border border-emerald-300 rounded-xl p-1 shadow-sm">
            <ArrowDownUp className="w-3.5 h-3.5 text-emerald-700 ml-1.5" />
            {[
              { key: 'risk', label: 'Risk' },
              { key: 'name', label: 'Name' },
              { key: 'flags', label: 'Flags' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortMode(key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all ${
                  sortMode === key
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-900 hover:bg-emerald-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Auto-Focus toggle */}
          <button
            onClick={() => setEnableAutoFocus(!enableAutoFocus)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black border transition-all shadow-sm ${
              enableAutoFocus
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-600/30'
                : 'bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${enableAutoFocus ? 'bg-white animate-pulse' : 'bg-emerald-600'}`} />
            {enableAutoFocus ? 'Auto-Focus: ON' : 'Auto-Focus: OFF'}
          </button>
        </div>
      </div>

      {/* Focus View Modal */}
      {focusedStudent && (
        <FocusView
          student={focusedStudent}
          onClose={() => { setFocusedStudentId(null); setAutoFocused(null); }}
          onLockScreen={onLockScreen}
          onUnlockScreen={onUnlockScreen}
          socket={socket}
        />
      )}

      {/* Student Grid */}
      {sorted.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3 text-emerald-900/60 bg-white rounded-3xl border border-emerald-300/80 shadow-sm">
          <WifiOff className="w-10 h-10 text-emerald-700" />
          <p className="text-lg font-bold text-emerald-950">
            {students.length === 0 ? 'Waiting for students to connect…' : 'No students match the current filter'}
          </p>
          {students.length === 0 && (
            <p className="text-sm font-semibold text-emerald-700">Students should open the portal and share their screen</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4.5">
          {sorted.map(student => {
            const risk = student.risk_score || 0;
            const isHigh = risk >= 50;
            const isMed = risk >= 30 && risk < 50;
            const recentlyFlagged = student.flaggedAt && (Date.now() - student.flaggedAt < 5000);

            return (
              <div
                key={student.student_id}
                onClick={() => setFocusedStudentId(student.student_id)}
                className={`bg-white border border-emerald-300/80 rounded-2xl p-3.5 cursor-pointer group transition-all duration-300 hover:scale-[1.02] hover:border-emerald-500 hover:shadow-xl shadow-md relative overflow-hidden ${getRiskColor(risk)}`}
              >
                {/* Risk bar at top */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${isHigh ? 'bg-gradient-to-r from-rose-600 to-red-500' : isMed ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}`} />

                {/* Header */}
                <div className="flex justify-between items-center mb-3 gap-2">
                  <div className="truncate">
                    <p className="font-black text-sm text-emerald-950 truncate flex items-center gap-1.5 tracking-tight">
                      {student.name || student.student_id}
                      {student.is_locked && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-300 flex items-center gap-1 uppercase tracking-wider animate-pulse">
                          <Lock className="w-2.5 h-2.5" /> LOCKED
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] font-mono font-bold text-emerald-800/80 tracking-wide">{student.student_id}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const msg = window.prompt(`Send Warning Message to ${student.name || student.student_id}:`, "Your exam is being monitored. Please maintain exam focus.");
                        if (msg && msg.trim() && socket) {
                          socket.emit('teacher:warn_student', { student_id: student.student_id, message: msg.trim() });
                        }
                      }}
                      title="Send Warning Message"
                      className="p-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 hover:scale-110 transition-all shadow-xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-amber-800" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (student.is_locked) {
                          if (onUnlockScreen) onUnlockScreen(student.student_id);
                        } else {
                          if (onLockScreen) onLockScreen(student.student_id);
                        }
                      }}
                      title={student.is_locked ? "Unlock Screen" : "Lock Screen"}
                      className={`p-1.5 rounded-xl text-xs font-bold transition-all shadow-xs hover:scale-110 ${
                        student.is_locked
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                          : 'bg-rose-100 text-rose-700 border border-rose-300 hover:bg-rose-200'
                      }`}
                    >
                      {student.is_locked ? <Unlock className="w-3.5 h-3.5 text-emerald-800" /> : <Lock className="w-3.5 h-3.5 text-rose-700" />}
                    </button>
                    <div
                      aria-label={`Risk score: ${risk} percent, status: ${getRiskLabel(risk)}`}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border shadow-xs ${
                        isHigh ? 'bg-rose-100 border-rose-300 text-rose-800' :
                        isMed ? 'bg-amber-100 border-amber-300 text-amber-800' :
                        'bg-emerald-100 border-emerald-300 text-emerald-900'
                      }`}
                    >
                      <span>{getRiskLabel(risk)}</span>
                      <span>• {risk}%</span>
                    </div>
                  </div>
                </div>

                {/* Screen thumbnail */}
                <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden relative mb-2.5 border border-emerald-200 shadow-inner">
                  {student.latestFrame ? (
                    <img
                      src={`data:image/jpeg;base64,${student.latestFrame}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      alt=""
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/40 gap-2">
                      <Wifi className="w-7 h-7 animate-pulse text-emerald-400" />
                      <span className="text-xs font-semibold tracking-wide">Connecting Stream…</span>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl text-xs font-black text-white uppercase tracking-wider shadow-lg shadow-emerald-600/40 border border-emerald-400/60 transform scale-95 group-hover:scale-105 transition-all">
                      <Eye className="w-4 h-4 text-white stroke-[2.5]" /> Inspect Candidate
                    </span>
                  </div>

                  {/* Locked Overlay Badge */}
                  {student.is_locked && (
                    <div className="absolute inset-0 bg-rose-950/85 backdrop-blur-[3px] flex flex-col items-center justify-center gap-1 text-rose-300 font-black text-xs select-none pointer-events-none border border-rose-500/40">
                      <Lock className="w-7 h-7 animate-pulse text-rose-300" />
                      <span className="tracking-widest">WORKSTATION LOCKED</span>
                    </div>
                  )}

                  {/* Flag pulse indicator */}
                  {!student.is_locked && recentlyFlagged && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-rose-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg animate-pulse">
                      <AlertCircle className="w-3 h-3" /> FLAG
                    </div>
                  )}
                </div>

                {/* Sparkline Trend */}
                <div className="mb-2.5 px-1 flex items-center gap-2 bg-emerald-50/80 rounded-lg p-1 border border-emerald-200/80">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <Sparkline studentId={student.student_id} />
                </div>

                {/* Activity bar */}
                <div className="flex gap-2">
                  <div className="flex-1 bg-emerald-50/80 rounded-xl px-2 py-1.5 text-center border border-emerald-200/80">
                    <p className="text-[10px] uppercase font-black text-emerald-900 tracking-wider">Activity</p>
                    <p className="text-xs font-black text-emerald-800">{student.activity?.activity_score || 0}%</p>
                  </div>
                  <div className="flex-1 bg-emerald-50/80 rounded-xl px-2 py-1.5 text-center border border-emerald-200/80">
                    <p className="text-[10px] uppercase font-black text-emerald-900 tracking-wider">Idle</p>
                    <p className={`text-xs font-black ${(student.activity?.idle_seconds || 0) > 30 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {Math.round(student.activity?.idle_seconds || 0)}s
                    </p>
                  </div>
                  <div className="flex-1 bg-emerald-50/80 rounded-xl px-2 py-1.5 text-center border border-emerald-200/80">
                    <p className="text-[10px] uppercase font-black text-emerald-900 tracking-wider">Flags</p>
                    <p className={`text-xs font-black ${(student.flags?.length || 0) > 0 ? 'text-rose-700' : 'text-emerald-900/60'}`}>
                      {student.flags?.length || 0}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
