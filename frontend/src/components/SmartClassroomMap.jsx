import React, { useState } from 'react';
import FocusView from './FocusView';

export default function SmartClassroomMap({ students, flags }) {
  const [focused, setFocused] = useState(null);
  const COLS = 6;
  const rows = Math.ceil(students.length / COLS) || 3;
  const cells = Array.from({ length: rows * COLS });

  const getRiskBg = (risk) => {
    if (risk >= 60) return 'bg-red-500/30 border-red-500/60 text-red-300';
    if (risk >= 30) return 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300';
    return 'bg-green-500/10 border-green-500/30 text-green-300';
  };

  const getRiskTag = (risk) => {
    if (risk >= 60) return 'High';
    if (risk >= 30) return 'Mod';
    return 'Safe';
  };

  return (
    <div>
      {focused && (
        <FocusView
          student={focused}
          onClose={() => setFocused(null)}
        />
      )}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-white">Smart Classroom Seating Map</h2>
        <div className="flex items-center gap-4 text-xs text-white/40">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500/30 border border-green-500/60 inline-block" /> Safe</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-500/20 border border-yellow-500/40 inline-block" /> Moderate</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500/30 border border-red-500/60 inline-block" /> High Risk</span>
        </div>
      </div>

      {/* Faculty desk */}
      <div className="flex justify-center mb-8">
        <div className="px-8 py-3 bg-blue-500/20 border border-blue-500/40 text-blue-300 rounded-xl text-sm font-semibold">
          📋 Faculty Desk
        </div>
      </div>

      <div
        className="grid gap-3 max-w-4xl mx-auto"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
      >
        {cells.map((_, i) => {
          const student = students[i];
          if (!student) {
            return (
              <div key={i} className="aspect-square rounded-xl border border-dashed border-white/5 bg-white/[0.02] flex items-center justify-center text-white/10 text-xs">
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
              className={`aspect-square rounded-xl border-2 cursor-pointer flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 p-2 ${getRiskBg(risk)}`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">{getRiskTag(risk)}</div>
              <div className="text-lg font-bold">{risk}%</div>
              <div className="text-xs text-center truncate w-full opacity-80">{student.student_id}</div>
              {(student.flags?.length || 0) > 0 && (
                <div className="text-xs bg-red-500/30 px-1.5 py-0.5 rounded-full font-semibold">
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
