import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Monitor, AlertTriangle, CheckCircle, FileEdit, Clock, Activity, Zap, Usb, ScreenShare, Cpu, Lock } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

const StudentPortal = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState(null);
  const [telemetry, setTelemetry] = useState({ keystrokes: 0, idle: 0, tabSwitches: 0, activeWindow: 'Exam Portal' });
  const [examText, setExamText] = useState('');
  const [isLocked, setIsLocked] = useState(false);
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
  const activeWindowRef = useRef('Exam Portal - SIET');
  const extraProcessesRef = useRef([]);
  const secondaryMonitorRef = useRef(false);
  const usbDetectedRef = useRef(false);
  const clipboardSizeRef = useRef(0);
  const windowCountRef = useRef(1);

  useEffect(() => {
    const userStr = localStorage.getItem('siet_user');
    if (!userStr) { navigate('/login'); return; }
    setUser(JSON.parse(userStr));

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
      if (document.hidden && elapsed > 4000) {
        tabSwitchedRef.current = true;
        tabSwitchCountRef.current += 1;
        activeWindowRef.current = 'Other Browser Tab';
      } else {
        activeWindowRef.current = 'Exam Portal - SIET';
      }
    };

    const handlePaste = (e) => {
      const text = e.clipboardData?.getData('text') || '';
      if (text.length > 0) {
        clipboardSizeRef.current = text.length;
      }
    };

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

  const triggerSignal = (signalType, val) => {
    if (signalType === 'chatgpt') {
      activeWindowRef.current = 'ChatGPT - OpenAI Answers Tab';
      setExamText(prev => prev + '\n[Pasted from ChatGPT: Detailed Answer Solution...]');
      clipboardSizeRef.current = 250;
    } else if (signalType === 'anydesk') {
      extraProcessesRef.current = ['chrome.exe', 'anydesk.exe', 'teamviewer.exe'];
      activeWindowRef.current = 'AnyDesk Remote Desktop Control';
    } else if (signalType === 'usb') {
      usbDetectedRef.current = true;
    } else if (signalType === 'monitor') {
      secondaryMonitorRef.current = true;
    } else if (signalType === 'spike') {
      windowCountRef.current = 8;
    } else if (signalType === 'paste') {
      clipboardSizeRef.current = 450;
      setExamText(prev => prev + '\n[Pasted External Content: 450 characters copied from external browser/notes...]');
      activeWindowRef.current = 'Exam Portal - External Paste Detected';
    } else if (signalType === 'idle') {
      lastActivityRef.current = Date.now() - 35000; // Force 35s idle
    } else if (signalType === 'normal') {
      activeWindowRef.current = 'Exam Portal - SIET';
      extraProcessesRef.current = [];
      usbDetectedRef.current = false;
      secondaryMonitorRef.current = false;
      windowCountRef.current = 1;
      lastActivityRef.current = Date.now();
    }
  };

  const startExamSession = async () => {
    try {
      setError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setError('INSECURE_CONTEXT');
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });

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

      const host = window.location.hostname;
      const socket = io(`http://${host}:3000/agent`, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: Infinity
      });
      socketRef.current = socket;

      // Listen for remote screen lock & unlock commands from teacher
      socket.on('command:lock_screen', () => {
        setIsLocked(true);
      });
      socket.on('command:unlock_screen', () => {
        setIsLocked(false);
      });

      const startLoop = () => {
        socket.emit('agent:register', {
          student_id: user.username,
          hostname: `Browser-${user.username}`,
          ip: 'Web-Client',
          mac: '00:00:00:00:00:00'
        });

        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
          if (!isSharingRef.current) {
            clearInterval(intervalRef.current);
            return;
          }

          // Capture Frame
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

          // Emit Full Activity & Rule Telemetry
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

          // Reset temporary accumulators
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
    <div className="min-h-screen bg-[#0F1115] text-white p-6 relative">

      {/* Screen Lock Overlay */}
      {isLocked && (
        <div className="fixed inset-0 z-50 bg-red-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in select-none">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
            <Lock className="w-10 h-10 text-red-400 animate-pulse" />
          </div>
          <h2 className="text-3xl font-bold text-red-400 mb-2">Workstation Locked by Faculty</h2>
          <p className="text-white/70 max-w-md mb-6 leading-relaxed text-sm">
            Your examination workspace has been locked remotely by the proctoring faculty due to potential integrity violations.
          </p>
          <div className="px-6 py-3.5 bg-red-900/50 border border-red-500/40 rounded-xl text-red-200 font-semibold text-sm flex items-center justify-center gap-2 shadow-xl">
            🔒 WORKSTATION LOCKED — Faculty inspection required to unlock
          </div>
        </div>
      )}

      {/* Off-screen video + canvas for capture */}
      <div style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: 800, height: 600 }}>
        <video ref={videoRef} autoPlay playsInline muted width={800} height={600} />
        <canvas ref={canvasRef} width={800} height={600} />
      </div>

      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              SIET Student Examination Portal
            </h1>
            <p className="text-white/40 mt-1">Logged in as <strong className="text-white">{user.username}</strong></p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle inline />
            <button
              onClick={() => { localStorage.removeItem('siet_user'); navigate('/login'); }}
              className="px-4 py-2 border border-white/10 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm"
            >
              Logout
            </button>
          </div>
        </header>

        {!isSharing ? (
          <div className="bg-[#1A1D24] border border-white/10 rounded-2xl p-10 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Monitor className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-2xl font-semibold mb-4">Start Your Exam Session</h2>
            <p className="text-white/60 mb-4 max-w-lg mx-auto leading-relaxed">
              You will be prompted to share your <strong>entire screen</strong>. Select <em>Entire Screen</em> (not a window or tab) 
              for best proctoring accuracy.
            </p>
            <p className="text-yellow-400/80 text-sm mb-8">
              ⚠️ Make sure to select <strong>Entire Screen</strong> in the share dialog.
            </p>

            {error === 'INSECURE_CONTEXT' ? (
              <div className="mb-6 text-left bg-orange-500/10 border border-orange-500/30 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-orange-400 font-semibold">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  Screen sharing requires a secure connection
                </div>
                
                <p className="text-white/60 text-sm leading-relaxed">
                  Your browser blocks screen capture over plain HTTP on non-localhost addresses. Select your browser below for step-by-step instructions to enable it:
                </p>

                {/* Browser Tab Selector */}
                <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5 mb-4">
                  <button
                    onClick={() => setBrowserTab('chrome')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                      browserTab === 'chrome'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Google Chrome
                  </button>
                  <button
                    onClick={() => setBrowserTab('edge')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                      browserTab === 'edge'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Microsoft Edge
                  </button>
                  <button
                    onClick={() => setBrowserTab('firefox')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                      browserTab === 'firefox'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Mozilla Firefox
                  </button>
                </div>

                {browserTab === 'chrome' && (
                  <div className="space-y-3 animate-in fade-in duration-200">
                    <ol className="space-y-3 text-sm">
                      <li className="flex gap-3">
                        <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                        <span className="text-white/70">Open a new tab and go to: <code className="bg-white/10 px-2 py-0.5 rounded text-blue-300 text-xs select-all">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code></span>
                      </li>
                      <li className="flex gap-3">
                        <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                        <span className="text-white/70">In the text box, paste: <code className="bg-white/10 px-2 py-0.5 rounded text-blue-300 text-xs select-all">http://{window.location.hostname}:{window.location.port}</code></span>
                      </li>
                      <li className="flex gap-3">
                        <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                        <span className="text-white/70">Set the flag to <strong className="text-white">Enabled</strong> → Click <strong className="text-white">Relaunch</strong></span>
                      </li>
                      <li className="flex gap-3">
                        <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">4</span>
                        <span className="text-white/70">Come back to this page, refresh, and click <strong className="text-white">Share Screen</strong> again</span>
                      </li>
                    </ol>
                  </div>
                )}

                {browserTab === 'edge' && (
                  <div className="space-y-3 animate-in fade-in duration-200">
                    <ol className="space-y-3 text-sm">
                      <li className="flex gap-3">
                        <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                        <span className="text-white/70">Open a new tab and go to: <code className="bg-white/10 px-2 py-0.5 rounded text-blue-300 text-xs select-all">edge://flags/#unsafely-treat-insecure-origin-as-secure</code></span>
                      </li>
                      <li className="flex gap-3">
                        <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                        <span className="text-white/70">In the text box, paste: <code className="bg-white/10 px-2 py-0.5 rounded text-blue-300 text-xs select-all">http://{window.location.hostname}:{window.location.port}</code></span>
                      </li>
                      <li className="flex gap-3">
                        <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                        <span className="text-white/70">Set the flag to <strong className="text-white">Enabled</strong> → Click <strong className="text-white">Relaunch</strong></span>
                      </li>
                      <li className="flex gap-3">
                        <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">4</span>
                        <span className="text-white/70">Come back to this page, refresh, and click <strong className="text-white">Share Screen</strong> again</span>
                      </li>
                    </ol>
                  </div>
                )}

                {browserTab === 'firefox' && (
                  <div className="space-y-3 animate-in fade-in duration-200">
                    <ol className="space-y-3 text-sm">
                      <li className="flex gap-3">
                        <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                        <span className="text-white/70">Open a new tab and go to: <code className="bg-white/10 px-2 py-0.5 rounded text-blue-300 text-xs select-all">about:config</code></span>
                      </li>
                      <li className="flex gap-3">
                        <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                        <span className="text-white/70">Accept the warning by clicking <strong className="text-white">"Accept the Risk and Continue"</strong></span>
                      </li>
                      <li className="flex gap-3">
                        <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                        <span className="text-white/70">Search for: <code className="bg-white/10 px-2 py-0.5 rounded text-blue-300 text-xs select-all">media.getdisplaymedia.require_secure_context</code></span>
                      </li>
                      <li className="flex gap-3">
                        <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">4</span>
                        <span className="text-white/70">Double-click or toggle the option to set it to <strong className="text-green-400">false</strong></span>
                      </li>
                      <li className="flex gap-3">
                        <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">5</span>
                        <span className="text-white/70">Come back to this page, refresh, and click <strong className="text-white">Share Screen</strong> again</span>
                      </li>
                    </ol>
                  </div>
                )}

                <div className="pt-2 border-t border-orange-500/20 flex flex-col gap-1">
                  <p className="text-xs text-white/30">💡 Alternatively, if you're on the same PC as the server, use <code className="text-blue-300">http://localhost:{window.location.port}</code> instead.</p>
                  <p className="text-xs text-white/30">🔒 For production environments, configure HTTPS on the server to make the context secure natively.</p>
                </div>
              </div>
            ) : error ? (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            ) : null}

            <button
              onClick={startExamSession}
              className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]"
            >
              Share Screen &amp; Begin Exam
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Exam Workspace */}
            <div className="md:col-span-2 space-y-6">
              {/* Browser Examination Tabs */}
              <div className="bg-[#1A1D24] border border-white/10 rounded-2xl p-6 flex flex-col min-h-[460px]">
                
                {/* Tab Header Bar */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
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
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border shrink-0 ${
                          workspaceTab === t.id
                            ? t.allowed 
                              ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30'
                              : 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30 animate-pulse'
                            : 'bg-[#0F1115] border-white/5 text-white/50 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-white/40 font-mono hidden sm:inline">{telemetry.activeWindow}</span>
                </div>

                {/* Tab Content */}
                <div className="flex-1">
                  {workspaceTab === 'answer' && (
                    <textarea
                      value={examText}
                      onChange={(e) => setExamText(e.target.value)}
                      className="w-full h-full min-h-[300px] bg-[#0F1115] border border-white/10 rounded-xl p-4 text-white/80 focus:outline-none focus:border-blue-500/50 resize-none leading-relaxed font-sans text-sm"
                      placeholder="Type your exam answers here..."
                    />
                  )}

                  {workspaceTab === 'question' && (
                    <div className="bg-[#0F1115] border border-white/10 rounded-xl p-6 text-sm space-y-4 min-h-[300px]">
                      <h4 className="font-bold text-blue-400 text-base">Section A: Systems & Security (10 Marks)</h4>
                      <p className="text-white/80 leading-relaxed font-medium">
                        Q1. Explain the architectural design of real-time monitoring systems in distributed client-server applications. How do WebSocket framing protocols reduce latency?
                      </p>
                      <p className="text-white/80 leading-relaxed font-medium pt-2">
                        Q2. Describe the mechanisms used to detect unauthorized process execution and clipboard size anomalies without capturing sensitive user keystrokes.
                      </p>
                    </div>
                  )}

                  {workspaceTab === 'docs' && (
                    <div className="bg-[#0F1115] border border-white/10 rounded-xl p-6 text-sm space-y-3 min-h-[300px]">
                      <h4 className="font-bold text-green-400">Approved Exam Reference Material</h4>
                      <ul className="space-y-2 text-white/70 text-xs">
                        <li>• System Call Reference: `GetForegroundWindow()`, `GetLastInputInfo()`</li>
                        <li>• Network Protocols: WebSockets RFC 6455, HTTP/2 Server Push</li>
                        <li>• Data Compression: JPEG quality scaling (30% quality frame capture)</li>
                      </ul>
                    </div>
                  )}

                  {workspaceTab === 'external' && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center text-sm space-y-3 min-h-[300px] flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center text-red-400 font-bold text-xl mb-1">
                        ⚠️
                      </div>
                      <h4 className="font-bold text-red-400 text-base">Unauthorized External Tab Simulated</h4>
                      <p className="text-white/70 max-w-md text-xs leading-relaxed">
                        Navigating away to an unauthorized tab triggers an immediate <strong className="text-red-300">Tab Switch Violation Flag</strong> on the faculty dashboard and increases your risk score.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Simulation Triggers for Evaluation & Testing */}
              <div className="bg-[#1A1D24] border border-purple-500/20 rounded-2xl p-5 shadow-[0_0_20px_rgba(168,85,247,0.05)]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Live Rule Testing Controls (Simulate Signals)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => triggerSignal('chatgpt')}
                    className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-xl text-xs font-medium border border-purple-500/30 text-left transition-all"
                  >
                    🤖 ChatGPT / Banned Keyword
                  </button>
                  <button
                    onClick={() => triggerSignal('anydesk')}
                    className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-xl text-xs font-medium border border-red-500/30 text-left transition-all"
                  >
                    🖥️ AnyDesk / RAT Process
                  </button>
                  <button
                    onClick={() => triggerSignal('usb')}
                    className="px-3 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 rounded-xl text-xs font-medium border border-yellow-500/30 text-left transition-all"
                  >
                    🔌 USB Drive Connected
                  </button>
                  <button
                    onClick={() => triggerSignal('monitor')}
                    className="px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-xl text-xs font-medium border border-blue-500/30 text-left transition-all"
                  >
                    📺 Secondary Display
                  </button>
                  <button
                    onClick={() => triggerSignal('spike')}
                    className="px-3 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 rounded-xl text-xs font-medium border border-cyan-500/30 text-left transition-all"
                  >
                    📈 Window Count Spike
                  </button>
                  <button
                    onClick={() => triggerSignal('paste')}
                    className="px-3 py-2 bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 rounded-xl text-xs font-medium border border-pink-500/30 text-left transition-all"
                  >
                    📋 External Copy &amp; Paste (450 chars)
                  </button>
                  <button
                    onClick={() => triggerSignal('idle')}
                    className="px-3 py-2 bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 rounded-xl text-xs font-medium border border-orange-500/30 text-left transition-all"
                  >
                    💤 Idle Timeout (35s)
                  </button>
                </div>
                <div className="mt-3 text-right">
                  <button
                    onClick={() => triggerSignal('normal')}
                    className="text-xs text-white/40 hover:text-white underline transition-colors"
                  >
                    Reset all test signals to Normal
                  </button>
                </div>
              </div>
            </div>

            {/* Status Panel */}
            <div className="space-y-4">
              <div className="bg-[#1A1D24] border border-green-500/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(34,197,94,0.08)]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <h3 className="font-semibold text-green-400">Proctoring Active</h3>
                </div>
                <p className="text-white/50 text-sm">Screen & OS activity streaming live to faculty dashboard.</p>
              </div>

              <div className="bg-[#1A1D24] border border-white/10 rounded-2xl p-5">
                <h3 className="font-semibold mb-4 text-white/80 text-sm uppercase tracking-wider">Live Telemetry</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/40 flex items-center gap-2"><Activity className="w-4 h-4" /> Keystrokes</span>
                    <span className="text-blue-400 font-mono">{telemetry.keystrokes}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/40 flex items-center gap-2"><Clock className="w-4 h-4" /> Idle Time</span>
                    <span className={`font-mono ${telemetry.idle > 30 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {telemetry.idle}s
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/40 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Tab Switches</span>
                    <span className={`font-mono ${telemetry.tabSwitches > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {telemetry.tabSwitches}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#1A1D24] border border-white/10 rounded-2xl p-5">
                <h3 className="font-semibold mb-4 text-white/80 text-sm uppercase tracking-wider font-mono text-xs">Monitored Signals</h3>
                <div className="space-y-2 text-xs text-white/60">
                  <div className="flex items-center justify-between">
                    <span>Active Window:</span>
                    <span className="text-blue-400 truncate max-w-[120px] font-mono">{telemetry.activeWindow}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Clipboard Paste:</span>
                    <span className="text-green-400 font-mono">Size Only</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Keystrokes:</span>
                    <span className="text-green-400 font-mono">Count Only</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default StudentPortal;
