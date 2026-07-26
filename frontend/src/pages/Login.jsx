import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, User, Eye, EyeOff, CheckCircle2, Cpu, ArrowRight } from 'lucide-react';
import { getApiUrl } from '../config';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const userStr = localStorage.getItem('siet_user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u.role === 'teacher') navigate('/teacher', { replace: true });
        else if (u.role === 'admin') navigate('/admin', { replace: true });
      } catch (_) {}
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch(getApiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Login failed. Please verify credentials.');
      }

      localStorage.setItem('siet_user', JSON.stringify(data.user));
      if (data.user.role === 'admin') {
        navigate('/admin');
      } else if (data.user.role === 'teacher') {
        navigate('/teacher');
      } else {
        navigate('/login');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EEF4F0] via-[#FAFCFA] to-[#E2EBE5] flex flex-col justify-between items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans select-none">
      
      {/* Ambient Animated Mint Glow Orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-300/30 rounded-full blur-[100px] pointer-events-none animate-pulse" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal-300/30 rounded-full blur-[100px] pointer-events-none animate-pulse" />

      {/* Top Header Navigation Bar */}
      <header className="w-full max-w-6xl flex items-center justify-between py-2 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-900 text-white flex items-center justify-center shadow-md border border-emerald-700">
            <Shield className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-base font-black text-emerald-950 tracking-tight leading-none">
              EXAM SAFE
            </h1>
            <p className="text-[11px] text-emerald-800 font-extrabold">
              Secure Examination System
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-100/80 border border-emerald-300 rounded-full text-xs font-black text-emerald-900 shadow-xs">
          <Cpu className="w-3.5 h-3.5 text-emerald-700 animate-spin-slow" />
          AI Proctoring Engine v2.5 Active
        </div>
      </header>

      {/* Main Glassmorphism Login Card */}
      <main className="w-full max-w-md my-auto relative z-10">
        <div className="bg-white/90 backdrop-blur-2xl border-2 border-emerald-300/90 rounded-3xl p-7 sm:p-9 shadow-[0_20px_50px_rgba(5,71,42,0.12)] relative overflow-hidden">
          
          {/* Top Decorative Emerald Accent Strip */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700" />

          {/* Header Shield Crest Icon */}
          <div className="flex flex-col items-center text-center mt-2 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-900 via-emerald-800 to-teal-900 text-emerald-200 flex items-center justify-center shadow-lg border-2 border-emerald-400 mb-3 group hover:scale-105 transition-transform">
              <Lock className="w-8 h-8 text-emerald-300" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Portal Authentication
            </h2>
            <p className="text-xs text-slate-600 font-bold mt-1 max-w-xs">
              Sign in to access your proctoring workspace
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-rose-900 text-xs font-black text-center shadow-xs flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Username / Roll No.</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4 text-emerald-700" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. STD-105 or teacher_proctor"
                  className="w-full bg-emerald-50/50 border border-emerald-200/90 text-slate-900 font-bold text-sm rounded-2xl py-3.5 pl-10 pr-4 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-400 shadow-xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4 text-emerald-700" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-emerald-50/50 border border-emerald-200/90 text-slate-900 font-bold text-sm rounded-2xl py-3.5 pl-10 pr-11 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-400 shadow-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4 text-slate-500" /> : <Eye className="w-4 h-4 text-slate-500" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Secure SSL Session
              </span>
              <button
                type="button"
                onClick={() => alert('Forgot Password? Contact Examination Controller / Administrator.')}
                className="text-xs font-bold text-emerald-800 hover:text-emerald-950 hover:underline transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 hover:from-emerald-900 hover:to-teal-900 text-white font-extrabold text-sm rounded-2xl shadow-lg hover:shadow-emerald-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2 group hover:scale-[1.01] active:scale-[0.99] uppercase tracking-wider"
            >
              {isLoading ? (
                <span>Authenticating Session...</span>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4 text-emerald-200 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Quick Info Box */}
          <div className="mt-6 pt-4 border-t border-emerald-100 text-center">
            <p className="text-[11px] font-bold text-slate-500">
              Role Access: Students, Faculty Proctors &amp; System Admins
            </p>
          </div>
        </div>
      </main>

      {/* Security & System Footer */}
      <footer className="w-full max-w-md text-center text-xs font-bold text-slate-500 py-2 relative z-10 flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span>256-Bit Encrypted Session • Secure Exam System</span>
      </footer>

    </div>
  );
};

export default Login;
