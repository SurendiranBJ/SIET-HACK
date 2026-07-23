import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, CheckCircle2, XCircle, Clock, Monitor, Usb, Globe, Wifi,
  AlertTriangle, ChevronRight, Eye
} from 'lucide-react';

const ALLOWED = [
  { icon: Monitor, text: 'Exam portal (this browser tab only)', color: 'text-green-400' },
  { icon: Globe, text: 'Calculator (system app only)', color: 'text-green-400' },
  { icon: Eye, text: 'Single monitor only', color: 'text-green-400' },
  { icon: Wifi, text: 'Network access to exam server only', color: 'text-green-400' },
];

const NOT_ALLOWED = [
  { icon: Globe, text: 'Switching to any other browser tab or window', color: 'text-red-400' },
  { icon: Monitor, text: 'Using a secondary/external display', color: 'text-red-400' },
  { icon: Usb, text: 'Plugging in USB drives or storage devices', color: 'text-red-400' },
  { icon: AlertTriangle, text: 'Opening messaging apps (WhatsApp, Discord, etc.)', color: 'text-red-400' },
  { icon: AlertTriangle, text: 'Using AI tools (ChatGPT, Gemini, Copilot, etc.)', color: 'text-red-400' },
  { icon: AlertTriangle, text: 'Excessive window-switching or alt-tab behavior', color: 'text-red-400' },
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
    <div className="min-h-screen bg-[#080B10] text-white flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/6 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5 bg-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">SIET Overwatch</p>
            <p className="text-[10px] text-blue-400/70 uppercase tracking-wider">Exam Session Gateway</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-amber-400 font-medium">
            {countdown > 0 ? `Read carefully — ${countdown}s` : 'Ready to proceed'}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-3xl">
          {/* Title */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-semibold mb-4 uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5" /> Exam Rules & Conduct Policy
            </div>
            <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Before You Begin</h1>
            <p className="text-white/50 text-base max-w-lg mx-auto leading-relaxed">
              Please read and acknowledge all exam rules. Your session is under active monitoring. 
              Any violation will be immediately flagged to the exam supervisor.
            </p>
          </div>

          {/* Rules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            {/* Allowed */}
            <div className="bg-green-500/5 border border-green-500/15 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <h2 className="font-semibold text-green-400">What is Allowed</h2>
              </div>
              <ul className="space-y-3">
                {ALLOWED.map(({ icon: Icon, text, color }, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Icon className={`w-4 h-4 ${color} shrink-0 mt-0.5`} />
                    <span className="text-sm text-white/70 leading-relaxed">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Not Allowed */}
            <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <XCircle className="w-5 h-5 text-red-400" />
                <h2 className="font-semibold text-red-400">What is NOT Allowed</h2>
              </div>
              <ul className="space-y-3">
                {NOT_ALLOWED.map(({ icon: Icon, text, color }, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Icon className={`w-4 h-4 ${color} shrink-0 mt-0.5`} />
                    <span className="text-sm text-white/70 leading-relaxed">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Warning banner */}
          <div className="flex items-start gap-3 p-4 bg-amber-500/8 border border-amber-500/20 rounded-xl mb-8">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-300/80 leading-relaxed">
              <strong className="text-amber-400">Important:</strong> Your screen is being recorded, your active window title is monitored in real-time, 
              and any connected USB devices or secondary monitors will trigger an immediate alert to your examiner. 
              Attempting to close the monitoring agent will also create a critical incident report.
            </p>
          </div>

          {/* Checkbox + Button */}
          <div className="flex flex-col items-center gap-5">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => setUnderstood(!understood)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer
                  ${understood ? 'bg-blue-500 border-blue-500' : 'border-white/30 hover:border-blue-500/60'}`}
              >
                {understood && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </div>
              <span className="text-sm text-white/70 group-hover:text-white transition-colors">
                I have read and understood all exam rules and conduct policies
              </span>
            </label>

            <button
              onClick={handleStartExam}
              disabled={!understood || countdown > 0 || isStarting}
              className={`flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-sm transition-all
                ${understood && countdown === 0 && !isStarting
                  ? 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:shadow-[0_0_40px_rgba(37,99,235,0.6)] cursor-pointer'
                  : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10'
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

