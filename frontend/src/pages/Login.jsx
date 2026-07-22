import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Eye, EyeOff, Lock, ChevronRight } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const host = window.location.hostname;
      const res = await fetch(`http://${host}:3000/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('siet_user', JSON.stringify(data.user));
      if (data.user.role === 'teacher') {
        navigate('/teacher');
      } else {
        navigate('/student');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] px-4 py-8 text-slate-100">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="rounded-[1.75rem] border border-[#1F2937] bg-[#141A24] p-7 shadow-[0_28px_70px_rgba(0,0,0,0.30)]">
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.32em] text-slate-500">Secure Monitoring</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Operator login</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">Sign in with your operator credentials to access the monitoring console.</p>
          </div>

          {error && (
            <div className="mb-5 rounded-3xl border border-[#EF4444]/20 bg-[#EF4444]/10 px-4 py-3 text-sm text-[#FECACA]">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.28em] text-slate-500 mb-2">Username / Roll ID</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-[1.5rem] border border-[#1F2937] bg-[#0B0E14] px-4 py-3 text-white font-mono text-sm placeholder:text-slate-500 focus:border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-200/20"
                placeholder="ROLL-01 or operator id"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[0.28em] text-slate-500 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-[1.5rem] border border-[#1F2937] bg-[#0B0E14] px-4 py-3 text-white font-mono text-sm placeholder:text-slate-500 focus:border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-200/20"
                  placeholder="Enter secure password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-100"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-[1.5rem] border border-[#1F2937] bg-white/5 px-5 py-3 text-sm font-semibold uppercase tracking-[0.24em] text-white transition duration-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Authenticating...' : 'Sign in'}
              <ChevronRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            <Link to="/signup" className="font-semibold text-slate-100 hover:text-white">
              Create operator access
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
