import React from 'react';

export default function ActivityHeatmap({ students }) {
  if (students.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 font-bold bg-white rounded-3xl border border-emerald-300 shadow-sm">
        No students connected yet
      </div>
    );
  }

  const getColor = (score) => {
    if (score === undefined || score === null) return 'bg-emerald-200';
    if (score >= 80) return 'bg-emerald-600';
    if (score >= 60) return 'bg-emerald-500';
    if (score >= 40) return 'bg-amber-500';
    if (score >= 20) return 'bg-orange-500';
    return 'bg-rose-500';
  };

  const sorted = [...students].sort((a, b) => (b.activity?.activity_score || 0) - (a.activity?.activity_score || 0));

  return (
    <div className="space-y-6 text-slate-900">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-emerald-950">Live Activity Heatmap</h2>
        <div className="flex items-center gap-3 text-xs text-slate-600 font-bold">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-500 inline-block shadow-xs" /> Low</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500 inline-block shadow-xs" /> Medium</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-600 inline-block shadow-xs" /> High</span>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
        {sorted.map(student => {
          const activity = student.activity?.activity_score || 0;
          const typing = student.activity?.typing_speed || 0;
          const mouse = Math.round(student.activity?.mouse_score || 0);
          const idle = Math.round(student.activity?.idle_seconds || 0);
          return (
            <div
              key={student.student_id}
              className="bg-white border border-emerald-300/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all hover:border-emerald-500"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm font-black text-emerald-950 truncate">{student.student_id}</p>
                  <p className="text-xs text-slate-500 font-semibold">{student.name}</p>
                </div>
                <div className={`w-4 h-4 rounded-full ${getColor(activity)} shadow-sm`} />
              </div>

              {/* Activity bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                  <span>Activity</span>
                  <span className="font-mono text-emerald-900">{activity}%</span>
                </div>
                <div className="h-2 bg-emerald-100/70 rounded-full overflow-hidden border border-emerald-200/60">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${getColor(activity)}`}
                    style={{ width: `${activity}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-1.5">
                  <p className="text-[10px] font-black text-emerald-900 uppercase">Keys</p>
                  <p className="text-xs font-extrabold text-emerald-800 font-mono">{typing}</p>
                </div>
                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-1.5">
                  <p className="text-[10px] font-black text-emerald-900 uppercase">Mouse</p>
                  <p className="text-xs font-extrabold text-teal-800 font-mono">{mouse}</p>
                </div>
                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-1.5">
                  <p className="text-[10px] font-black text-emerald-900 uppercase">Idle</p>
                  <p className={`text-xs font-extrabold font-mono ${idle > 30 ? 'text-amber-700' : 'text-emerald-800'}`}>{idle}s</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trend bars */}
      <div className="bg-[#FAFCFA] border border-emerald-300/80 rounded-3xl p-6 shadow-sm">
        <h3 className="text-sm font-black text-emerald-950 uppercase tracking-wider mb-4">Class-Wide Activity Comparison</h3>
        <div className="space-y-2.5">
          {sorted.slice(0, 10).map(student => {
            const score = student.activity?.activity_score || 0;
            return (
              <div key={student.student_id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-emerald-950 w-24 truncate">{student.student_id}</span>
                <div className="flex-1 h-2.5 bg-emerald-100/70 rounded-full overflow-hidden border border-emerald-200/60">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${getColor(score)}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <span className="text-xs font-black text-emerald-900 w-10 text-right font-mono">{score}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
