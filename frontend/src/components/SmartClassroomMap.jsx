import React, { useState } from 'react';
import FocusView from './FocusView';

export default function SmartClassroomMap({ students, flags }) {
  const [focused, setFocused] = useState(null);
  const COLS = 6;
  const rows = Math.ceil(students.length / COLS) || 3;
  const cells = Array.from({ length: rows * COLS });

  const getRiskBg = (risk) => {
    if (risk >= 60) return 'bg-rose-50 border-rose-400 text-rose-950 shadow-sm';
    if (risk >= 30) return 'bg-amber-50 border-amber-400 text-amber-950 shadow-sm';
    return 'bg-white border-emerald-300 text-emerald-950 shadow-sm hover:border-emerald-500';
  };

  const getRiskTag = (risk) => {
    if (risk >= 60) return 'High';
    if (risk >= 30) return 'Mod';
    return 'Safe';
  };

  return (
    <div className="text-slate-900">
      {focused && (
        <FocusView
          student={focused}
          onClose={() => setFocused(null)}
        />
      )}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-emerald-950">Smart Classroom Seating Map</h2>
        <div className="flex items-center gap-4 text-xs text-slate-600 font-bold">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border border-emerald-300 inline-block shadow-xs" /> Safe</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block shadow-xs" /> Moderate</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-100 border border-rose-300 inline-block shadow-xs" /> High Risk</span>
        </div>
      </div>

      {/* Faculty desk */}
      <div className="flex justify-center mb-8">
        <div className="px-8 py-3 bg-white border border-emerald-300 text-emerald-950 rounded-2xl text-sm font-black shadow-sm flex items-center gap-2">
          📋 Faculty Desk
        </div>
      </div>

      <div
        className="grid gap-3.5 max-w-4xl mx-auto"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
      >
        {cells.map((_, i) => {
          const student = students[i];
          if (!student) {
            return (
              <div key={i} className="aspect-square rounded-2xl border-2 border-dashed border-emerald-300/60 bg-white/50 flex items-center justify-center text-slate-400 text-xs font-bold">
                Empty
              </div>
            );
          }
          const risk = student.risk_score || 0;
          return (
            <div
              key={student.student_id}
              onClick={() => setFocused(student)}
              tabIndex={0}
              aria-label={`Student ${student.student_id}, risk score ${risk} percent, status ${getRiskTag(risk)}`}
              className={`aspect-square rounded-2xl border-2 cursor-pointer flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 p-2.5 ${getRiskBg(risk)}`}
            >
              <div className="text-[10px] font-black uppercase tracking-wider opacity-90">{getRiskTag(risk)}</div>
              <div className="text-lg font-black font-mono">{risk}%</div>
              <div className="text-xs text-center font-bold font-mono truncate w-full">{student.student_id}</div>
              {(student.flags?.length || 0) > 0 && (
                <div className="text-[10px] bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full font-black">
                  {student.flags.length}⚠
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
