import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Monitor, TerminalSquare, Camera, Lock, Clock } from 'lucide-react';

export default function FocusView({ student, onClose, onLockScreen, onUnlockScreen, host }) {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [activeSnap, setActiveSnap] = useState(null);

  useEffect(() => {
    if (!student?.student_id) return;
    // Fetch AI explanation
    setLoading(true);
    fetch(`http://${host}:3000/api/students/${student.student_id}/ai-explanation`)
      .then(r => r.json())
      .then(data => { setExplanation(data); setLoading(false); })
      .catch(() => setLoading(false));

    // Fetch auto-captured snapshots
    fetch(`http://${host}:3000/api/students/${student.student_id}/snapshots`)
      .then(r => r.json())
      .then(data => setSnapshots(data.reverse()))
      .catch(() => {});
  }, [student?.student_id, student?.flags?.length]);

  const risk = student.risk_score || 0;
  const riskColor = risk >= 60 ? 'text-red-400 bg-red-500/10 border-red-500/20'
    : risk >= 30 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
    : 'text-green-400 bg-green-500/10 border-green-500/20';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#14171F] border border-white/10 w-full max-w-7xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Alert Banner for Auto-Focus on Unusual Behavior */}
        {(student.flags?.length || 0) > 0 && (
          <div className="bg-red-600/90 text-white px-6 py-2 flex items-center justify-between text-xs font-bold tracking-wider uppercase animate-pulse">
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Unusual Behavior Detected — Automatically Brought to Full Screen
            </span>
            <span>Flagged: {student.flags[0]?.rule_type?.replace(/_/g, ' ')}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#1A1D24]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Monitor className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{student.name || student.student_id}</h2>
              <p className="text-xs text-white/40">{student.student_id} · {student.hostname || 'Browser'} · {student.ip || 'Web'}</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-bold border ${riskColor}`}>
              Risk: {risk}%
            </div>
          </div>
          <div className="flex items-center gap-3">
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
            <button onClick={onClose} className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">

          {/* Left: Live Feed + Telemetry */}
          <div className="flex-1 flex flex-col p-5 gap-4 overflow-y-auto">

            {/* Live screen */}
            <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-white/5 relative">
              {student.latestFrame ? (
                <img src={`data:image/jpeg;base64,${student.latestFrame}`} className="w-full h-full object-contain" alt="Live feed" />
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
                { label: 'Idle Time', value: Math.round(student.activity?.idle_seconds || 0), unit: 's', color: (student.activity?.idle_seconds || 0) > 30 ? 'text-yellow-400' : 'text-green-400' },
                { label: 'Activity Score', value: student.activity?.activity_score || 0, unit: '%', color: 'text-cyan-400' }
              ].map(({ label, value, unit, color }) => (
                <div key={label} className="bg-[#1A1D24] rounded-xl p-4 border border-white/5">
                  <p className="text-xs text-white/40 mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}<span className="text-sm font-normal text-white/30 ml-1">{unit}</span></p>
                </div>
              ))}
            </div>

            {/* Auto-captured snapshots */}
            {snapshots.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Evidence Snapshots ({snapshots.length})
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {snapshots.map((snap, i) => (
                    <div
                      key={snap.id}
                      onClick={() => setActiveSnap(activeSnap?.id === snap.id ? null : snap)}
                      className="flex-shrink-0 w-32 cursor-pointer rounded-lg overflow-hidden border border-white/10 hover:border-blue-500/50 transition-all"
                    >
                      <img src={`data:image/jpeg;base64,${snap.jpeg_base64}`} className="w-full h-20 object-cover" alt={`Snap ${i}`} />
                      <p className="text-[10px] text-white/30 p-1 bg-[#1A1D24] truncate">{new Date(snap.created_at).toLocaleTimeString()}</p>
                    </div>
                  ))}
                </div>
                {activeSnap && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-blue-500/20">
                    <img src={`data:image/jpeg;base64,${activeSnap.jpeg_base64}`} className="w-full object-contain max-h-64" alt="Selected snapshot" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Sidebar: AI Engine + Incident Timeline */}
          <div className="w-96 border-l border-white/5 bg-[#1A1D24] flex flex-col overflow-y-auto p-5 gap-6">

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
                  <p className="text-sm text-white/80 leading-relaxed font-medium p-3 bg-red-500/5 rounded-xl border border-red-500/10">{explanation.explanation}</p>
                  {explanation.reasons?.length > 0 && (
                    <div>
                      <p className="text-xs text-white/40 uppercase tracking-wider mb-2 font-bold">Flagged Reasons ({explanation.reasons.length})</p>
                      <ul className="space-y-2">
                        {explanation.reasons.map((r, i) => (
                          <li key={i} className="text-xs text-white/70 bg-[#0F1115] p-2.5 rounded-lg border border-white/5 flex items-start gap-2 leading-relaxed">
                            <span className="text-red-400 font-bold shrink-0">•</span>{r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                      explanation.confidence === 'high' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : explanation.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : 'bg-green-500/20 text-green-400 border border-green-500/30'
                    }`}>{explanation.confidence} confidence</span>
                  </div>
                  <div className="bg-[#0F1115] rounded-xl p-3.5 border border-white/10 shadow-lg">
                    <p className="text-[10px] text-white/40 font-bold tracking-wider uppercase mb-1">SUGGESTED FACULTY ACTION</p>
                    <p className="text-sm text-white font-semibold">{explanation.suggestedAction}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-white/30 italic">No flags yet. Behavior appears normal.</p>
              )}
            </div>

            {/* Incident Timeline */}
            <div className="pt-4 border-t border-white/5">
              <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
                <TerminalSquare className="w-4 h-4 text-blue-400" /> Incident Timeline ({student.flags?.length || 0})
              </h3>
              <div className="space-y-3">
                {(student.flags || []).length === 0 ? (
                  <p className="text-sm text-white/20 italic">No incidents recorded in this session.</p>
                ) : (
                  (student.flags || []).map((f, i) => (
                    <div key={i} className="flex gap-3 bg-[#0F1115] p-3 rounded-xl border border-white/5">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1 shrink-0" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-bold text-red-400 uppercase tracking-wide">{f.rule_type?.replace(/_/g, ' ')}</p>
                          {f.timestamp && (
                            <span className="text-[10px] text-white/30 font-mono">
                              {new Date(f.timestamp).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/60 leading-relaxed">{f.detail}</p>
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
