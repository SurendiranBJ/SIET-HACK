import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Shield, Monitor, AlertTriangle, CheckCircle, FileEdit, Clock, Activity, Zap, Usb, ScreenShare, Cpu, Lock, LogOut, Key } from 'lucide-react';
import { getSocketUrl, getApiUrl } from '../config';

const StudentPortal = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState(null);
  const [telemetry, setTelemetry] = useState({ keystrokes: 0, idle: 0, tabSwitches: 0, activeWindow: 'Exam Portal' });
  const [examText, setExamText] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [isKicked, setIsKicked] = useState(false);
  const [sessionKeyInput, setSessionKeyInput] = useState('');
  const [sessionKeyError, setSessionKeyError] = useState('');
  const [isKeyVerified, setIsKeyVerified] = useState(false);
  const [verifyingKey, setVerifyingKey] = useState(false);
  const [teacherWarning, setTeacherWarning] = useState(null);
  const [workspaceTab, setWorkspaceTab] = useState('answer');
  const [browserTab, setBrowserTab] = useState(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('edg/')) return 'edge';
    if (ua.includes('firefox')) return 'firefox';
    return 'chrome';
  });

  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const sessionKeyRef = useRef('');

  // Telemetry refs
  const keystrokesRef = useRef(0);
  const mouseDeltaRef = useRef(0);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const lastActivityRef = useRef(Date.now());
  const tabSwitchedRef = useRef(false);
  const tabSwitchCountRef = useRef(0);
  const isSharingRef = useRef(false);
  const sharingStartTimeRef = useRef(0);

  // Advanced signal simulation refs
  const activeWindowRef = useRef('Exam Portal - Exam Safe');
  const extraProcessesRef = useRef([]);
  const secondaryMonitorRef = useRef(false);
  const usbDetectedRef = useRef(false);
  const clipboardSizeRef = useRef(0);
  const windowCountRef = useRef(1);

  useEffect(() => {
    const userStr = localStorage.getItem('siet_user');
    if (!userStr) { navigate('/login'); return; }
    const userObj = JSON.parse(userStr);
    setUser(userObj);

    const isKickedState = sessionStorage.getItem(`exam_kicked_${userObj.username}`) === 'true';
    if (isKickedState) {
      setIsKicked(true);
    }

    // Check if active verified Session Key exists in sessionStorage
    const savedKey = sessionStorage.getItem(`siet_session_key_${userObj.username}`);
    if (savedKey && !isKickedState) {
      const formattedKey = savedKey.trim().toUpperCase();
      setSessionKeyInput(formattedKey);
      sessionKeyRef.current = formattedKey;

      // Verify stored key against server silently on mount
      fetch(getApiUrl('/session/verify-key'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_key: formattedKey })
      })
      .then(r => r.json())
      .then(res => {
        if (res.valid) {
          setIsKeyVerified(true);
        } else {
          sessionStorage.removeItem(`siet_session_key_${userObj.username}`);
          setIsKeyVerified(false);
        }
      })
      .catch(() => {});
    }

    const handleKeyDown = () => {
      keystrokesRef.current += 1;
      lastActivityRef.current = Date.now();
    };

    const handleMouseMove = (e) => {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      mouseDeltaRef.current += Math.sqrt(dx * dx + dy * dy);
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      lastActivityRef.current = Date.now();
    };

    const handleVisibilityChange = () => {
      const elapsed = Date.now() - sharingStartTimeRef.current;
      if (document.hidden && elapsed > 1000) {
        tabSwitchedRef.current = true;
        tabSwitchCountRef.current += 1;
        activeWindowRef.current = 'External Browser Tab (Unfocused)';
      } else {
        activeWindowRef.current = 'Exam Portal - Exam Safe';
      }
    };

    const handlePaste = (e) => {
      const text = e.clipboardData?.getData('text') || '';
      if (text.length > 0) {
        clipboardSizeRef.current = text.length;
      }
    };

    const handleUsbConnect = (e) => {
      usbDetectedRef.current = true;
      const deviceName = e?.device?.productName || 'USB Removable Hardware Drive';
      extraProcessesRef.current = [...extraProcessesRef.current, deviceName];
    };

    if (navigator.usb) {
      navigator.usb.addEventListener('connect', handleUsbConnect);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('paste', handlePaste);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (socketRef.current) socketRef.current.disconnect();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [navigate]);

  // STEP 1: Verify Session Key First BEFORE opening screen share dialog
  const handleVerifySessionKey = async (e) => {
    if (e) e.preventDefault();
    const formattedKey = sessionKeyInput.trim().toUpperCase();
    if (formattedKey.length !== 6 || !/^[A-Z0-9]{6}$/.test(formattedKey)) {
      setSessionKeyError('Session Key must be exactly 6 characters (letters & numbers only).');
      setIsKeyVerified(false);
      return;
    }

    setVerifyingKey(true);
    setSessionKeyError('');

    try {
      const res = await fetch(getApiUrl('/session/verify-key'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_key: formattedKey })
      });
      const data = await res.json();

      if (res.ok && data.valid) {
        setIsKeyVerified(true);
        sessionKeyRef.current = formattedKey;
        setSessionKeyError('');
        if (user?.username) {
          sessionStorage.setItem(`siet_session_key_${user.username}`, formattedKey);
          sessionStorage.removeItem(`exam_kicked_${user.username}`);
        }
        setIsKicked(false);
      } else {
        setIsKeyVerified(false);
        setSessionKeyError(data.error || 'Invalid or expired 6-character Session Key. Ask your teacher for the current key.');
        if (user?.username) {
          sessionStorage.removeItem(`siet_session_key_${user.username}`);
        }
      }
    } catch (err) {
      setSessionKeyError('Server connection error. Please try again.');
      setIsKeyVerified(false);
    } finally {
      setVerifyingKey(false);
    }
  };

  // STEP 2: Only called AFTER Session Key is verified + Enforces ENTIRE SCREEN ONLY
  const startExamSession = async () => {
    try {
      setError(null);

      if (!isKeyVerified || sessionKeyRef.current.length !== 6) {
        setSessionKeyError('Please verify a valid 6-character Session Key first.');
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setError('INSECURE_CONTEXT');
        return;
      }

      // Request Entire Screen (displaySurface: 'monitor')
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          cursor: 'always',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false,
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'exclude',
        systemAudio: 'exclude'
      });

      // Strict Enforcement: Verify candidate actually selected ENTIRE SCREEN ('monitor')
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack && videoTrack.getSettings ? videoTrack.getSettings() : {};
      const surfaceType = settings.displaySurface;

      if (surfaceType && surfaceType !== 'monitor') {
        // Reject tab or window selection!
        try { stream.getTracks().forEach(t => t.stop()); } catch(e) {}
        setSessionKeyError('❌ PROCTORING VIOLATION: You selected a single tab or window. You MUST select "Entire screen" to enter the exam portal. Please click Share Screen again and choose "Entire screen".');
        setIsSharing(false);
        isSharingRef.current = false;
        return;
      }

      streamRef.current = stream;
      sharingStartTimeRef.current = Date.now();

      const video = videoRef.current;
      video.srcObject = stream;

      await new Promise((resolve) => {
        const onReady = () => { video.removeEventListener('loadedmetadata', onReady); resolve(); };
        video.addEventListener('loadedmetadata', onReady);
        if (video.readyState >= 1) resolve();
      });

      try { await video.play(); } catch (_) {}

      isSharingRef.current = true;
      setIsSharing(true);

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        isSharingRef.current = false;
        setIsSharing(false);
        if (socketRef.current) socketRef.current.disconnect();
        if (intervalRef.current) clearInterval(intervalRef.current);
      });

      const socket = io(getSocketUrl('/agent'), {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: Infinity
      });
      socketRef.current = socket;

      socket.on('command:lock_screen', () => {
        setIsLocked(true);
      });
      socket.on('command:unlock_screen', () => {
        setIsLocked(false);
      });
      socket.on('command:warn', (data) => {
        setTeacherWarning(data?.message || 'Warning from your teacher.');
      });
      socket.on('command:kick', (data) => {
        setIsSharing(false);
        isSharingRef.current = false;
        setIsKicked(true);
        setIsKeyVerified(false);
        if (data?.reason === 'INVALID_SESSION_KEY') {
          setSessionKeyError('Invalid or expired 6-character Session Key. Ask your teacher for the current Session Key.');
        } else {
          setSessionKeyError('You were removed from the exam session by the proctor. Enter the new 6-character Session Key to re-join.');
        }
        if (user?.username) {
          sessionStorage.removeItem(`siet_session_key_${user.username}`);
          sessionStorage.setItem(`exam_kicked_${user.username}`, 'true');
        }
        if (streamRef.current) {
          try { streamRef.current.getTracks().forEach(t => t.stop()); } catch(e) {}
        }
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (socketRef.current) {
          try { socketRef.current.disconnect(); } catch(e) {}
        }
      });
      socket.on('command:unban', (data) => {
        const targetId = String(data?.student_id || '').trim().toLowerCase();
        const currentId = String(user?.username || '').trim().toLowerCase();
        if (!targetId || targetId === currentId) {
          sessionStorage.removeItem(`exam_kicked_${user?.username}`);
          setIsKicked(false);
          setSessionKeyError('');
        }
      });

      const startLoop = () => {
        const clientHostIp = window.location.hostname || '127.0.0.1';
        socket.emit('agent:register', {
          student_id: user.username,
          hostname: `Browser-${user.username}`,
          ip: clientHostIp === 'localhost' ? '127.0.0.1' : clientHostIp,
          mac: '00:00:00:00:00:00',
          session_key: sessionKeyRef.current.trim().toUpperCase()
        });

        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
          if (!isSharingRef.current) {
            clearInterval(intervalRef.current);
            return;
          }

          const v = videoRef.current;
          const canvas = canvasRef.current;
          if (v && canvas && v.readyState >= 2 && v.videoWidth > 0) {
            const ctx = canvas.getContext('2d');
            canvas.width = 800;
            canvas.height = Math.round(800 * v.videoHeight / v.videoWidth) || 450;
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const jpeg = canvas.toDataURL('image/jpeg', 0.3);
            const clean = jpeg.replace(/^data:image\/jpeg;base64,/, '');
            socket.emit('agent:frame', { jpeg_base64: clean, timestamp: Date.now() / 1000 });
          }

          const idleSeconds = Math.round((Date.now() - lastActivityRef.current) / 1000);
          const keystrokes = keystrokesRef.current;
          const mouseDelta = Math.round(mouseDeltaRef.current);
          const tabSwitched = tabSwitchedRef.current;
          const cbSize = clipboardSizeRef.current;

          const procs = ['browser', ...extraProcessesRef.current];

          socket.emit('agent:activity', {
            mouse_delta: mouseDelta,
            keystroke_count: keystrokes,
            idle_seconds: idleSeconds,
            processes: procs,
            active_window: activeWindowRef.current,
            tab_switched: tabSwitched,
            clipboard_size: cbSize,
            secondary_monitor: secondaryMonitorRef.current,
            monitor_count: secondaryMonitorRef.current ? 2 : 1,
            usb_detected: usbDetectedRef.current,
            usb_events: usbDetectedRef.current ? ['USB Storage Drive'] : [],
            window_count: windowCountRef.current
          });

          setTelemetry({
            keystrokes: keystrokes,
            idle: idleSeconds,
            tabSwitches: tabSwitchCountRef.current,
            activeWindow: activeWindowRef.current
          });

          socket.emit('agent:ping');

          keystrokesRef.current = 0;
          mouseDeltaRef.current = 0;
          tabSwitchedRef.current = false;
          clipboardSizeRef.current = 0;

        }, 2000);
      };

      socket.on('connect', startLoop);
      if (socket.connected) startLoop();

    } catch (err) {
      setError(err.message || 'Failed to start screen share. Permission is required.');
      setIsSharing(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#EEF4F0] text-slate-900 font-sans selection:bg-emerald-500/30 overflow-x-hidden p-4 sm:p-6 relative">

      {/* Teacher Warning Overlay */}
      {teacherWarning && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[#FAFCFA] border-2 border-amber-400 rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-bounce-once text-slate-900">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center border border-amber-300">
                <AlertTriangle className="w-7 h-7 text-amber-700" />
              </div>
              <div>
                <p className="text-xs text-amber-800 font-black uppercase tracking-wider mb-0.5">⚠️ Message from Proctoring Faculty</p>
                <h3 className="text-lg font-black text-slate-950">Official Warning</h3>
              </div>
            </div>
            <p className="text-slate-800 text-sm leading-relaxed bg-amber-50/80 border border-amber-200 rounded-2xl p-4 mb-6 font-semibold">
              {teacherWarning}
            </p>
            <button
              onClick={() => setTeacherWarning(null)}
              className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-2xl transition-all text-xs uppercase tracking-wider shadow-lg shadow-amber-600/30"
            >
              I Understand — Close Warning
            </button>
          </div>
        </div>
      )}

      {/* Screen Lock Overlay */}
      {isLocked && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in select-none">
          <div className="bg-[#FAFCFA] border-2 border-rose-500 rounded-3xl p-8 max-w-lg w-full shadow-2xl text-slate-900 flex flex-col items-center">
            <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mb-6 border-2 border-rose-300 shadow-md">
              <Lock className="w-10 h-10 text-rose-700 animate-pulse" />
            </div>
            <h2 className="text-2xl font-black text-rose-950 mb-2">Workstation Locked by Faculty</h2>
            <p className="text-slate-600 max-w-md mb-6 leading-relaxed text-sm font-medium">
              Your examination workspace has been locked remotely by the proctoring faculty due to potential integrity violations.
            </p>
            <div className="px-6 py-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 font-black text-xs uppercase tracking-wider shadow-xs">
              🔒 WORKSTATION LOCKED — Faculty inspection required to unlock
            </div>
          </div>
        </div>
      )}

      {/* Off-screen video + canvas for capture */}
      <div style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: 800, height: 600 }}>
        <video ref={videoRef} autoPlay playsInline muted width={800} height={600} />
        <canvas ref={canvasRef} width={800} height={600} />
      </div>

      <div className="max-w-5xl mx-auto w-full">
        {/* Responsive Header (Light Green & Half-White Theme) */}
        <header className="bg-[#FAFCFA]/95 backdrop-blur-xl border border-emerald-300/80 px-6 py-4 rounded-3xl shadow-md mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/25 shrink-0 border border-emerald-300/30 text-white">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-emerald-950 tracking-tight">
                Exam Safe Student Portal
              </h1>
              <p className="text-xs text-slate-600 font-bold">
                Logged in as <strong className="text-emerald-900 font-black">{user.username}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3.5 py-1 bg-emerald-100/80 text-emerald-950 rounded-full font-black text-xs border border-emerald-300 shadow-xs hidden sm:inline">
              Candidate: {user.username}
            </span>
            <button
              onClick={() => { localStorage.removeItem('siet_user'); navigate('/login'); }}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-2xl border border-slate-200 shadow-xs transition-all text-xs uppercase tracking-wider"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </header>

        {!isSharing ? (
          <div className="bg-[#FAFCFA] border-2 border-emerald-300/80 rounded-3xl p-8 sm:p-10 text-center shadow-xl relative overflow-hidden text-slate-900 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100/80 text-emerald-800 rounded-full text-xs font-extrabold uppercase tracking-wider mb-4 border border-emerald-300/60">
              ✨ Examination Workstation
            </div>

            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-emerald-300 shadow-sm">
              <Monitor className="w-8 h-8 text-emerald-800" />
            </div>
            <h2 className="text-2xl font-black text-emerald-950 mb-3">Start Your Exam Session</h2>

            {sessionKeyError && (
              <div className="mb-6 max-w-lg mx-auto p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-950 text-xs font-extrabold flex items-start gap-2.5 text-left leading-relaxed shadow-xs">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                <span>{sessionKeyError}</span>
              </div>
            )}

            {error === 'INSECURE_CONTEXT' ? (
              <div className="mb-6 text-left bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-700" />
                  Screen sharing requires a secure connection
                </div>
                
                <p className="text-slate-700 text-xs leading-relaxed font-medium">
                  Your browser blocks screen capture over plain HTTP on non-localhost addresses. Select your browser below for instructions:
                </p>

                <div className="flex gap-2 p-1 bg-white rounded-xl border border-slate-200 mb-4">
                  <button
                    onClick={() => setBrowserTab('chrome')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      browserTab === 'chrome' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Chrome
                  </button>
                  <button
                    onClick={() => setBrowserTab('edge')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      browserTab === 'edge' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Edge
                  </button>
                  <button
                    onClick={() => setBrowserTab('firefox')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      browserTab === 'firefox' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Firefox
                  </button>
                </div>
              </div>
            ) : null}

            {/* STEP 1: Enter & Verify 6-Character Session Key */}
            <div className="max-w-md mx-auto mb-6 text-left bg-white border border-emerald-200/80 rounded-2xl p-6 shadow-sm">
              <label className="block text-xs font-black text-emerald-950 uppercase tracking-wider mb-2 text-center flex items-center justify-center gap-1.5">
                <Key className="w-4 h-4 text-emerald-700" /> 1. Enter 6-Character Session Key
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={sessionKeyInput}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    setSessionKeyInput(val);
                    sessionKeyRef.current = val;
                    setIsKeyVerified(false);
                    if (sessionKeyError) setSessionKeyError('');
                  }}
                  placeholder="e.g. K9X2M7"
                  className="flex-1 bg-slate-50 border-2 border-emerald-300/80 focus:border-emerald-600 focus:outline-none text-center font-mono text-xl font-black tracking-widest text-emerald-950 py-2.5 rounded-xl uppercase transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={handleVerifySessionKey}
                  disabled={sessionKeyInput.length !== 6 || verifyingKey}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs rounded-xl disabled:opacity-40 transition-all uppercase tracking-wider shrink-0 shadow-md shadow-emerald-700/20"
                >
                  {verifyingKey ? 'Checking...' : isKeyVerified ? '✓ Verified' : 'Verify Key'}
                </button>
              </div>

              {isKeyVerified ? (
                <div className="mt-3 p-3 bg-emerald-100/90 border border-emerald-300 rounded-xl text-emerald-950 text-xs font-black flex items-center justify-center gap-2 shadow-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-700" />
                  <span>Session Key Verified & Active!</span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 font-bold mt-2 text-center">
                  Ask your exam proctor for the current 6-digit session key.
                </p>
              )}
            </div>

            {/* STEP 2: Share ENTIRE SCREEN ONLY Button */}
            <div className="space-y-3">
              <button
                onClick={startExamSession}
                disabled={!isKeyVerified}
                className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black transition-all shadow-xl shadow-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider text-xs sm:text-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                2. Share Entire Screen &amp; Begin Exam
              </button>
              {!isKeyVerified ? (
                <p className="text-xs text-amber-800 font-black">
                  🔒 Step 1 (Session Key Verification) required to enable Screen Share.
                </p>
              ) : (
                <p className="text-xs text-emerald-800 font-black">
                  ⚠️ Mandatory: Select <strong>"Entire screen"</strong> in the browser window picker. Single tabs/windows will be rejected.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Exam Workspace */}
            <div className="md:col-span-2 space-y-6">
              <div className="bg-[#FAFCFA] border-2 border-emerald-300/80 rounded-3xl p-6 shadow-xl flex flex-col min-h-[480px] text-slate-900">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-200/80">
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {[
                      { id: 'answer', label: '📝 Answer Workspace', allowed: true },
                      { id: 'question', label: '📄 Question Paper', allowed: true },
                      { id: 'docs', label: '📚 Reference Docs', allowed: true },
                      { id: 'external', label: '⚠️ External Tab (Unauthorized)', allowed: false }
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setWorkspaceTab(t.id);
                          if (!t.allowed) {
                            tabSwitchedRef.current = true;
                            tabSwitchCountRef.current += 1;
                            activeWindowRef.current = 'External Browser Tab (Google/Banned)';
                          } else {
                            activeWindowRef.current = `Exam Portal - ${t.label}`;
                          }
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all border shrink-0 ${
                          workspaceTab === t.id
                            ? t.allowed 
                              ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-600/30'
                              : 'bg-rose-600 border-rose-500 text-white shadow-md shadow-rose-600/30 animate-pulse'
                            : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-slate-500 font-mono font-bold hidden sm:inline">{telemetry.activeWindow}</span>
                </div>

                <div className="flex-1 flex flex-col">
                  {workspaceTab === 'answer' && (
                    <textarea
                      value={examText}
                      disabled={isLocked}
                      onChange={(e) => setExamText(e.target.value)}
                      className="w-full flex-1 min-h-[320px] bg-white border-2 border-emerald-200/80 rounded-2xl p-4 text-slate-900 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed font-sans text-sm font-medium shadow-inner disabled:opacity-40 disabled:cursor-not-allowed"
                      placeholder={isLocked ? "Workstation locked by faculty..." : "Type your exam answers here..."}
                    />
                  )}

                  {workspaceTab === 'question' && (
                    <div className="bg-white border-2 border-emerald-200/80 rounded-2xl p-6 text-sm space-y-4 min-h-[320px] shadow-sm">
                      <h4 className="font-black text-emerald-950 text-base">Section A: Systems & Security (10 Marks)</h4>
                      <p className="text-slate-700 leading-relaxed font-bold">
                        Q1. Explain the architectural design of real-time monitoring systems in distributed client-server applications. How do WebSocket framing protocols reduce latency?
                      </p>
                      <p className="text-slate-700 leading-relaxed font-bold pt-2">
                        Q2. Describe the mechanisms used to detect unauthorized process execution and clipboard size anomalies without capturing sensitive user keystrokes.
                      </p>
                    </div>
                  )}

                  {workspaceTab === 'docs' && (
                    <div className="bg-white border-2 border-emerald-200/80 rounded-2xl p-6 text-sm space-y-3 min-h-[320px] shadow-sm">
                      <h4 className="font-black text-emerald-900">Approved Exam Reference Material</h4>
                      <ul className="space-y-2 text-slate-700 text-xs font-bold">
                        <li>• System Call Reference: `GetForegroundWindow()`, `GetLastInputInfo()`</li>
                        <li>• Network Protocols: WebSockets RFC 6455, HTTP/2 Server Push</li>
                        <li>• Data Compression: JPEG quality scaling (30% quality frame capture)</li>
                      </ul>
                    </div>
                  )}

                  {workspaceTab === 'external' && (
                    <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-6 text-center text-sm space-y-3 min-h-[320px] flex flex-col items-center justify-center shadow-sm">
                      <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-700 font-bold text-xl mb-1 border border-rose-300">
                        ⚠️
                      </div>
                      <h4 className="font-black text-rose-950 text-base">Unauthorized External Tab Simulated</h4>
                      <p className="text-rose-900 max-w-md text-xs leading-relaxed font-bold">
                        Navigating away to an unauthorized tab triggers an immediate <strong className="text-rose-950 font-black">Tab Switch Violation Flag</strong> on the faculty dashboard and increases your risk score.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status Panel */}
            <div className="space-y-4">
              <div className="bg-[#FAFCFA] border-2 border-emerald-300/80 rounded-3xl p-5 shadow-xl">
                <div className="flex items-center gap-3 mb-2 p-3 bg-emerald-100/80 rounded-2xl border border-emerald-300">
                  <div className="w-3 h-3 bg-emerald-600 rounded-full animate-pulse"></div>
                  <h3 className="font-black text-emerald-950 text-sm">Proctoring Active</h3>
                </div>
                <p className="text-slate-600 text-xs font-bold mt-2">Screen & OS activity streaming live to faculty dashboard.</p>
              </div>

              <div className="bg-white border-2 border-emerald-200/80 rounded-3xl p-5 shadow-sm">
                <h3 className="font-black mb-4 text-emerald-950 text-xs uppercase tracking-wider">Live Telemetry</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-600 flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-700" /> Keystrokes</span>
                    <span className="text-emerald-800 font-mono font-black">{telemetry.keystrokes}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-600 flex items-center gap-2"><Clock className="w-4 h-4 text-teal-700" /> Idle Time</span>
                    <span className={`font-mono font-black ${telemetry.idle > 30 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {telemetry.idle}s
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-700" /> Tab Switches</span>
                    <span className={`font-mono font-black ${telemetry.tabSwitches > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {telemetry.tabSwitches}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Impenetrable Proctor Kickout / 6-Character Session Key Verification Overlay */}
      {isKicked && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/80 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="bg-[#FAFCFA] border-2 border-rose-400 rounded-3xl p-8 max-w-md w-full shadow-2xl text-slate-900 flex flex-col items-center">
            <div className="w-20 h-20 bg-rose-100 border-2 border-rose-300 rounded-3xl flex items-center justify-center mb-6 animate-pulse shadow-md">
              <Lock className="w-10 h-10 text-rose-700" />
            </div>
            <h1 className="text-2xl font-black text-rose-950 mb-2">SESSION KEY REQUIRED</h1>
            <p className="text-rose-900 text-xs font-bold mb-6 max-w-md">
              {sessionKeyError || 'Your session key has expired or been revoked by proctoring faculty.'}
            </p>

            <form onSubmit={handleVerifySessionKey} className="bg-white border-2 border-emerald-200/80 rounded-2xl p-6 w-full text-left space-y-4 mb-6 shadow-sm">
              <div>
                <label className="block text-xs font-black text-emerald-950 uppercase tracking-wider mb-2 text-center">
                  Enter 6-Character Session Key (A-Z, 0-9)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={sessionKeyInput}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    setSessionKeyInput(val);
                    sessionKeyRef.current = val;
                    setIsKeyVerified(false);
                    if (sessionKeyError) setSessionKeyError('');
                  }}
                  placeholder="e.g. K9X2M7"
                  className="w-full bg-slate-50 border-2 border-emerald-300 focus:border-emerald-600 focus:outline-none text-center font-mono text-2xl font-black tracking-widest text-emerald-950 py-3 rounded-xl uppercase transition-all shadow-inner"
                />
                <p className="text-[11px] text-slate-500 font-bold mt-2 text-center">
                  • Exactly 6 digits (letters & numbers only). Ask your instructor for the current Session Key.
                </p>
              </div>

              <button
                type="submit"
                disabled={sessionKeyInput.length !== 6 || verifyingKey}
                className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-700/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider"
              >
                {verifyingKey ? 'Verifying Key...' : 'Verify Session Key'}
              </button>
            </form>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Candidate: {user?.username} · Verify 6-Character Key to Proceed</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentPortal;
