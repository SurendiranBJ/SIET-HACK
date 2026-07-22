import React from 'react';

export default function ActivityHeatmap({ students }) {
  if (students.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-white/30 bg-[#1A1D24] rounded-2xl border border-white/5">
        No students connected yet
      </div>
    );
  }

  const getColor = (score) => {
    if (score === undefined || score === null) return 'bg-white/5';
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-green-400/70';
    if (score >= 40) return 'bg-yellow-400/70';
    if (score >= 20) return 'bg-orange-400/70';
    return 'bg-red-500/70';
  };

  const sorted = [...students].sort((a, b) => (b.activity?.activity_score || 0) - (a.activity?.activity_score || 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Live Activity Heatmap</h2>
        <div className="flex items-center gap-3 text-xs text-white/40">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500/70 inline-block" /> Low</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-400/70 inline-block" /> Medium</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> High</span>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {sorted.map(student => {
          const activity = student.activity?.activity_score || 0;
          const typing = student.activity?.typing_speed || 0;
          const mouse = Math.round(student.activity?.mouse_score || 0);
          const idle = Math.round(student.activity?.idle_seconds || 0);
          return (
            <div
              key={student.student_id}
              className="bg-[#1A1D24] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm font-semibold text-white truncate">{student.student_id}</p>
                  <p className="text-xs text-white/30">{student.name}</p>
                </div>
                <div className={`w-4 h-4 rounded-full ${getColor(activity)} shadow-lg`} />
              </div>

              {/* Activity bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-white/40 mb-1">
                  <span>Activity</span>
                  <span>{activity}%</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-700 ${getColor(activity)}`}
                    style={{ width: `${activity}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 text-center">
                <div className="bg-[#0F1115] rounded-lg p-1.5">
                  <p className="text-[10px] text-white/30">Keys</p>
                  <p className="text-xs font-bold text-blue-400">{typing}</p>
                </div>
                <div className="bg-[#0F1115] rounded-lg p-1.5">
                  <p className="text-[10px] text-white/30">Mouse</p>
                  <p className="text-xs font-bold text-purple-400">{mouse}</p>
                </div>
                <div className="bg-[#0F1115] rounded-lg p-1.5">
                  <p className="text-[10px] text-white/30">Idle</p>
                  <p className={`text-xs font-bold ${idle > 30 ? 'text-yellow-400' : 'text-green-400'}`}>{idle}s</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trend bars */}
      <div className="bg-[#1A1D24] border border-white/5 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white/60 mb-4">Class-Wide Activity Comparison</h3>
        <div className="space-y-2">
          {sorted.slice(0, 10).map(student => {
            const score = student.activity?.activity_score || 0;
            return (
              <div key={student.student_id} className="flex items-center gap-3">
                <span className="text-xs text-white/50 w-20 truncate">{student.student_id}</span>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-700 ${getColor(score)}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <span className="text-xs text-white/40 w-8 text-right">{score}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
