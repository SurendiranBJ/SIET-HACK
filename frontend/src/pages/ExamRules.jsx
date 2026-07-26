import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, CheckCircle2, XCircle, Clock, Monitor, Usb, Globe, Wifi,
  AlertTriangle, ChevronRight, Eye
} from 'lucide-react';

const ALLOWED = [
  { icon: Monitor, text: 'Exam portal (this browser tab only)', color: 'text-emerald-700' },
  { icon: Globe, text: 'Calculator (system app only)', color: 'text-emerald-700' },
  { icon: Eye, text: 'Single monitor only', color: 'text-emerald-700' },
  { icon: Wifi, text: 'Network access to exam server only', color: 'text-emerald-700' },
];

const NOT_ALLOWED = [
  { icon: Globe, text: 'Switching to any other browser tab or window', color: 'text-rose-700' },
  { icon: Monitor, text: 'Using a secondary/external display', color: 'text-rose-700' },
  { icon: Usb, text: 'Plugging in USB drives or storage devices', color: 'text-rose-700' },
  { icon: AlertTriangle, text: 'Opening messaging apps (WhatsApp, Discord, etc.)', color: 'text-rose-700' },
  { icon: AlertTriangle, text: 'Using AI tools (ChatGPT, Gemini, Copilot, etc.)', color: 'text-rose-700' },
  { icon: AlertTriangle, text: 'Excessive window-switching or alt-tab behavior', color: 'text-rose-700' },
];

const ExamRules = () => {
  const navigate = useNavigate();
  const [understood, setUnderstood] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem('siet_user');
    if (!userStr) { navigate('/login'); return; }
    try {
      const u = JSON.parse(userStr);
      if (u.role !== 'student') navigate('/teacher');
    } catch { navigate('/login'); }
  }, [navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const handleStartExam = () => {
    if (!understood || countdown > 0) return;
    setIsStarting(true);
    setTimeout(() => navigate('/student'), 600);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#EEF4F0] text-slate-900 font-sans selection:bg-emerald-500/30 overflow-x-hidden p-4 sm:p-6 relative">
      
      {/* Header (Responsive Light Green & Half-White Theme) */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 bg-[#FAFCFA]/95 backdrop-blur-xl border border-emerald-300/80 rounded-3xl shadow-md mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/25 shrink-0 border border-emerald-300/30 text-white">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-lg font-black text-emerald-950 tracking-tight">Exam Safe</p>
            <p className="text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-wider">Exam Session Gateway</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-100 border border-amber-300 rounded-full shadow-xs">
          <Clock className="w-4 h-4 text-amber-800" />
          <span className="text-xs text-amber-950 font-black">
            {countdown > 0 ? `Read carefully — ${countdown}s` : 'Ready to proceed'}
          </span>
        </div>
      </header>

      {/* Main Card */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-4xl bg-[#FAFCFA] border-2 border-emerald-300/80 rounded-3xl p-8 sm:p-10 shadow-xl text-slate-900">
          
          {/* Title Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1 bg-emerald-100/80 border border-emerald-300/60 rounded-full text-emerald-900 text-xs font-black uppercase tracking-wider mb-3">
              <Shield className="w-3.5 h-3.5 text-emerald-700" /> Exam Rules & Conduct Policy
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-emerald-950 mb-2 tracking-tight">Before You Begin</h1>
            <p className="text-slate-600 font-bold text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
              Please read and acknowledge all exam rules. Your session is under active monitoring. 
              Any violation will be immediately flagged to the exam supervisor.
            </p>
          </div>

          {/* Rules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            {/* Allowed */}
            <div className="bg-white border-2 border-emerald-300/80 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4 pb-2 border-b border-emerald-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                <h2 className="font-black text-emerald-950 text-base">What is Allowed</h2>
              </div>
              <ul className="space-y-3">
                {ALLOWED.map(({ icon: Icon, text, color }, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Icon className={`w-4 h-4 ${color} shrink-0 mt-0.5`} />
                    <span className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Not Allowed */}
            <div className="bg-white border-2 border-rose-300/80 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4 pb-2 border-b border-rose-100">
                <XCircle className="w-5 h-5 text-rose-700" />
                <h2 className="font-black text-rose-950 text-base">What is NOT Allowed</h2>
              </div>
              <ul className="space-y-3">
                {NOT_ALLOWED.map(({ icon: Icon, text, color }, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Icon className={`w-4 h-4 ${color} shrink-0 mt-0.5`} />
                    <span className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Important Warning Box */}
          <div className="flex items-start gap-3 p-5 bg-amber-50/90 border-2 border-amber-300 rounded-2xl mb-8 shadow-xs text-amber-950">
            <AlertTriangle className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm leading-relaxed font-bold">
              <strong className="text-amber-950 font-black uppercase">Important:</strong> Your screen is being recorded, your active window title is monitored in real-time, 
              and any connected USB devices or unauthorized applications will trigger an immediate alert to your examiner. 
              Attempting to close the monitoring agent will also create a critical incident report.
            </p>
          </div>

          {/* Checkbox & Start Exam Action */}
          <div className="flex flex-col items-center gap-5">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => setUnderstood(!understood)}
                className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer shadow-xs
                  ${understood ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 bg-white hover:border-emerald-500'}`}
              >
                {understood && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>
              <span className="text-xs sm:text-sm font-black text-slate-800 group-hover:text-emerald-950 transition-colors">
                I have read and understood all exam rules and conduct policies
              </span>
            </label>

            <button
              onClick={handleStartExam}
              disabled={!understood || countdown > 0 || isStarting}
              className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-xs sm:text-sm transition-all uppercase tracking-wider
                ${understood && countdown === 0 && !isStarting
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xl shadow-emerald-600/30 cursor-pointer hover:scale-105 active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                }`}
            >
              {isStarting ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Starting Exam...</span></>
              ) : countdown > 0 ? (
                <><Clock className="w-4 h-4" /><span>Please wait {countdown}s</span></>
              ) : (
                <><span>I Understand — Start Exam</span><ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ExamRules;
