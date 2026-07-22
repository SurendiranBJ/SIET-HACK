import React, { useState, useEffect } from 'react';
import { AlertCircle, Eye, Activity, Wifi, WifiOff } from 'lucide-react';
import FocusView from './FocusView';

export default function LiveGrid({ students, flags, onLockScreen, onUnlockScreen, socket }) {
  const [focusedStudentId, setFocusedStudentId] = useState(null);
  const [autoFocused, setAutoFocused] = useState(null);
  const [enableAutoFocus, setEnableAutoFocus] = useState(false);

  // Auto-focus flagged student's screen when enabled
  useEffect(() => {
    if (!enableAutoFocus || !flags || flags.length === 0) return;
    const latest = flags[0];
    if (latest && !focusedStudentId) {
      setAutoFocused(latest.student_id);
    }
  }, [flags, enableAutoFocus, focusedStudentId]);

  const sortedStudents = [...students].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));
  const activeFocusId = focusedStudentId || autoFocused;
  const focusedStudent = activeFocusId ? students.find(s => String(s?.student_id) === String(activeFocusId)) : null;

  const getRiskColor = (score) => {
    if (score >= 60) return 'border-red-500/70 shadow-[0_0_20px_rgba(239,68,68,0.25)]';
    if (score >= 30) return 'border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.15)]';
    return 'border-white/5';
  };

  const getRiskLabel = (score) => {
    if (score >= 60) return 'High Risk';
    if (score >= 30) return 'Moderate';
    return 'Normal';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-xs text-white/40 uppercase tracking-wider font-semibold">Live Classroom Monitoring Grid</span>
        <button
          onClick={() => setEnableAutoFocus(!enableAutoFocus)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            enableAutoFocus
              ? 'bg-purple-600/20 border-purple-500/40 text-purple-300'
              : 'bg-[#1A1D24] border-white/10 text-white/40 hover:text-white/70'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${enableAutoFocus ? 'bg-purple-400 animate-pulse' : 'bg-white/20'}`} />
          {enableAutoFocus ? 'Auto-Focus Alerts: ON' : 'Auto-Focus Alerts: OFF'}
        </button>
      </div>

      {focusedStudent && (
        <FocusView
          student={focusedStudent}
          onClose={() => { setFocusedStudentId(null); setAutoFocused(null); }}
          onLockScreen={onLockScreen}
          onUnlockScreen={onUnlockScreen}
        />
      )}

      {sortedStudents.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3 text-white/30 bg-[#1A1D24] rounded-2xl border border-white/5">
          <WifiOff className="w-10 h-10" />
          <p className="text-lg">Waiting for students to connect…</p>
          <p className="text-sm">Students should open the portal and share their screen</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedStudents.map(student => {
            const risk = student.risk_score || 0;
            const isHigh = risk >= 50;
            const isMed = risk >= 30 && risk < 50;
            const recentlyFlagged = student.flaggedAt && (Date.now() - student.flaggedAt < 5000);
            return (
              <div
                key={student.student_id}
                onClick={() => setFocusedStudentId(student.student_id)}
                className={`bg-[#1A1D24] border rounded-2xl p-3 cursor-pointer group transition-all hover:scale-[1.02] relative overflow-hidden ${getRiskColor(risk)}`}
              >
                {/* Risk bar at top */}
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${isHigh ? 'bg-red-500' : isMed ? 'bg-yellow-500' : 'bg-green-500'}`} />

                {/* Header */}
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="font-semibold text-sm text-white truncate">{student.name || student.student_id}</p>
                    <p className="text-xs text-white/30">{student.student_id}</p>
                  </div>
                  <div
                    aria-label={`Risk score: ${risk} percent, status: ${getRiskLabel(risk)}`}
                    className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                      isHigh ? 'bg-red-500/20 text-red-400' :
                      isMed ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-green-500/20 text-green-400'
                    }`}
                  >
                    <span>{getRiskLabel(risk)}</span>
                    <span>• {risk}%</span>
                  </div>
                </div>

                {/* Screen thumbnail */}
                <div className="aspect-video bg-black rounded-xl overflow-hidden relative mb-2 border border-white/5">
                  {student.latestFrame ? (
                    <img
                      src={`data:image/jpeg;base64,${student.latestFrame}`}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-2">
                      <Wifi className="w-8 h-8 animate-pulse" />
                      <span className="text-xs">Connecting…</span>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 rounded-lg text-sm font-medium">
                      <Eye className="w-4 h-4" /> Focus View
                    </span>
                  </div>

                  {/* Flag pulse indicator */}
                  {recentlyFlagged && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-500/90 px-2 py-0.5 rounded-full text-xs font-bold animate-pulse">
                      <AlertCircle className="w-3 h-3" /> FLAG
                    </div>
                  )}
                </div>

                {/* Activity bar */}
                <div className="flex gap-2">
                  <div className="flex-1 bg-[#0F1115] rounded-lg px-2 py-1.5 text-center">
                    <p className="text-xs text-white/30">Activity</p>
                    <p className="text-sm font-semibold text-blue-400">{student.activity?.activity_score || 0}%</p>
                  </div>
                  <div className="flex-1 bg-[#0F1115] rounded-lg px-2 py-1.5 text-center">
                    <p className="text-xs text-white/30">Idle</p>
                    <p className={`text-sm font-semibold ${(student.activity?.idle_seconds || 0) > 30 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {Math.round(student.activity?.idle_seconds || 0)}s
                    </p>
                  </div>
                  <div className="flex-1 bg-[#0F1115] rounded-lg px-2 py-1.5 text-center">
                    <p className="text-xs text-white/30">Flags</p>
                    <p className={`text-sm font-semibold ${(student.flags?.length || 0) > 0 ? 'text-red-400' : 'text-white/50'}`}>
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
