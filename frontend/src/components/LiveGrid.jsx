import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2, Clock3, Eye, Wifi, WifiOff } from 'lucide-react';
import FocusView from './FocusView';

const riskStates = [
  { id: 'clear', label: 'Clear', icon: CheckCircle2, color: '#22C55E', ring: '#22C55E', shadow: 'rgba(34,197,94,0.18)' },
  { id: 'medium', label: 'Medium', icon: Clock3, color: '#F5A524', ring: '#F5A524', shadow: 'rgba(245,165,36,0.18)' },
  { id: 'high', label: 'High', icon: AlertCircle, color: '#EF4444', ring: '#EF4444', shadow: 'rgba(239,68,68,0.22)' }
];

const statusLookup = {
  streaming: { label: 'Streaming', color: '#38BDF8', bg: 'rgba(56,189,248,0.12)', icon: Wifi },
  idle: { label: 'Idle', color: '#F5A524', bg: 'rgba(245,165,36,0.12)', icon: Clock3 },
  flagged: { label: 'Flagged', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', icon: AlertTriangle },
  offline: { label: 'Offline', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: WifiOff }
};

function getRiskState(score) {
  if (score >= 60) return riskStates[2];
  if (score >= 30) return riskStates[1];
  return riskStates[0];
}

export default function LiveGrid({ students, flags, onLockScreen, onUnlockScreen, socket, host }) {
  const [focusedStudentId, setFocusedStudentId] = useState(null);
  const [autoFocused, setAutoFocused] = useState(null);

  useEffect(() => {
    if (!flags || flags.length === 0) return;
    const latest = flags[0];
    if (latest && !focusedStudentId) {
      setAutoFocused(latest.student_id);
    }
  }, [flags, focusedStudentId]);

  const sortedStudents = [...students].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));
  const activeFocusId = focusedStudentId || autoFocused;
  const focusedStudent = activeFocusId ? students.find((s) => s.student_id === activeFocusId) : null;

  const getStatusKey = (student, recentlyFlagged) => {
    if (recentlyFlagged) return 'flagged';
    if (student.activity?.idle_seconds >= 45) return 'idle';
    if (student.latestFrame) return 'streaming';
    return 'offline';
  };

  const getRingSpeed = (riskId) => {
    if (riskId === 'high') return '1.1s';
    if (riskId === 'medium') return '1.9s';
    return '3.5s';
  };

  const formatMeta = (student) => ({
    hostname: student.hostname || 'unknown-host',
    ip: student.ip || '0.0.0.0'
  });

  return (
    <div className="space-y-4">
      {focusedStudent && (
        <FocusView
          student={focusedStudent}
          onClose={() => {
            setFocusedStudentId(null);
            setAutoFocused(null);
          }}
          onLockScreen={onLockScreen}
          onUnlockScreen={onUnlockScreen}
          host={host}
          socket={socket}
        />
      )}

      {sortedStudents.length === 0 ? (
        <div className="rounded-3xl border border-[#1F2937] bg-[#141A24] p-8 text-center">
          <WifiOff className="mx-auto mb-4 h-10 w-10 text-slate-500" />
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500 mb-2">Awaiting student agents</p>
          <p className="text-lg font-semibold text-slate-100">No live sessions are active yet.</p>
          <p className="mt-2 text-sm text-slate-400">Students should connect through the portal to begin monitoring.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {sortedStudents.map((student) => {
            const risk = student.risk_score || 0;
            const riskState = getRiskState(risk);
            const recentlyFlagged = student.flaggedAt && Date.now() - student.flaggedAt < 8000;
            const statusKey = getStatusKey(student, recentlyFlagged);
            const status = statusLookup[statusKey];
            const meta = formatMeta(student);
            const ringStyle = {
              '--ring-speed': getRingSpeed(riskState.id),
              borderColor: riskState.ring,
              boxShadow: `0 0 0 1px ${riskState.ring}, 0 0 0 14px ${riskState.shadow}`
            };

            return (
              <article
                key={student.student_id}
                role="button"
                tabIndex={0}
                onClick={() => setFocusedStudentId(student.student_id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setFocusedStudentId(student.student_id);
                  }
                }}
                className="group relative overflow-hidden rounded-3xl border border-[#1F2937] bg-[#141A24] p-3 text-slate-200 shadow-panel transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0E14]"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{student.name || 'Student'}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-white font-mono">{student.student_id}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#1F2937] bg-[#0B0E14]/80 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-300">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#38BDF8] shadow-[0_0_12px_rgba(56,189,248,0.22)]" />
                      Live
                    </div>

                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); if (student.is_locked) onUnlockScreen && onUnlockScreen(student.student_id); else onLockScreen && onLockScreen(student.student_id); }}
                        className="px-2.5 py-1 rounded-md bg-[#0B0E14]/60 border border-white/5 text-[11px] text-white/70 hover:bg-white/5"
                        style={{ minWidth: 64 }}
                      >
                        {student.is_locked ? 'Unlock' : 'Lock'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!socket) return;
                          if (!confirm(`Kick ${student.student_id} from session?`)) return;
                          try { socket.emit('teacher:kick_student', { student_id: student.student_id }); }
                          catch (err) { console.warn('Kick emit failed', err); }
                        }}
                        className="px-2.5 py-1 rounded-md bg-red-600/20 border border-red-500/30 text-[11px] text-red-300 hover:bg-red-600/30"
                        style={{ minWidth: 64 }}
                      >
                        Kick
                      </button>
                    </div>
                  </div>
                </div>

                <div className="relative mb-3 rounded-[1.6rem] bg-[#0B0E14] border border-[#1F2937] p-0.5">
                  <div className="risk-ring absolute inset-0 rounded-[1.6rem]" style={ringStyle} />
                  <div className="relative overflow-hidden rounded-[1.45rem] bg-[#090C12]">
                    {student.latestFrame ? (
                      <img
                        src={`data:image/jpeg;base64,${student.latestFrame}`}
                        alt={`Live view for ${student.student_id}`}
                        className="h-48 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-48 items-center justify-center bg-[#090C12] text-slate-500">
                        <div className="flex flex-col items-center gap-2">
                          <WifiOff className="h-7 w-7" />
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Offline</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  <span
                    className="status-pill"
                    style={{ color: status.color, backgroundColor: status.bg, borderColor: 'rgba(148,163,184,0.16)' }}
                  >
                    <status.icon className="h-3.5 w-3.5" />
                    {status.label}
                  </span>
                  <span
                    className="status-pill"
                    style={{ color: riskState.color, backgroundColor: `${riskState.ring}1A`, borderColor: 'rgba(148,163,184,0.12)' }}
                  >
                    <riskState.icon className="h-3.5 w-3.5" />
                    {riskState.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  <div className="metric-tile">
                    <div className="font-mono text-sm font-semibold text-white">{student.activity?.activity_score ?? 0}%</div>
                    <div className="mt-1 text-slate-400">Activity</div>
                  </div>
                  <div className="metric-tile">
                    <div className="font-mono text-sm font-semibold text-white">{Math.round(student.activity?.idle_seconds ?? 0)}s</div>
                    <div className="mt-1 text-slate-400">Idle</div>
                  </div>
                  <div className="metric-tile">
                    <div className="font-mono text-sm font-semibold text-white">{student.flags?.length ?? 0}</div>
                    <div className="mt-1 text-slate-400">Flags</div>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-[11px] leading-5 text-slate-400">
                  <div className="font-mono text-slate-200">{meta.hostname}</div>
                  <div className="font-mono text-slate-200">{meta.ip}</div>
                </div>

                {recentlyFlagged && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto flex w-fit rounded-full border border-[#EF4444]/20 bg-[#EF4444]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#EF4444] shadow-[0_0_16px_rgba(239,68,68,0.14)] animate-pulse motion-reduce:animate-none">
                    New behavior detected
                  </div>
                )}
                
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
