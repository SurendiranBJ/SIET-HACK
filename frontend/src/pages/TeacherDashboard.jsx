import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Shield, LayoutGrid, Activity, MapPin, Settings, Lock, FileText, Search, X, Download, Users, UserX, AlertTriangle, Usb } from 'lucide-react';
import { getApiUrl, getSocketUrl } from '../config';

import LiveGrid from '../components/LiveGrid';
import ActivityHeatmap from '../components/ActivityHeatmap';
import SmartClassroomMap from '../components/SmartClassroomMap';
import AdminPanel from '../components/AdminPanel';
import UserManagementPanel from '../components/UserManagementPanel';

const TeacherDashboard = () => {
  const [activeTab, setActiveTab] = useState('grid');
  const [students, setStudents] = useState({});
  const [flags, setFlags] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRisk, setFilterRisk] = useState('all'); // all | high | low
  const [sessionSummary, setSessionSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeSessionKey, setActiveSessionKey] = useState('K9X2M7');
  const [creatingSession, setCreatingSession] = useState(false);
  const [kickedStudentsList, setKickedStudentsList] = useState([]);
  const [toastAlerts, setToastAlerts] = useState([]);
  const lastToastTimesRef = useRef({});

  const pushViolationToast = (data) => {
    if (!data?.student_id) return;
    const sid = String(data.student_id);
    const rule = data.rule_type || 'violation';
    const key = `${sid}:${rule}`;
    const now = Date.now();
    const lastTime = lastToastTimesRef.current[key] || 0;

    if (now - lastTime < 4000) return;
    lastToastTimesRef.current[key] = now;

    let title = '🚨 Security Violation';
    if (rule === 'usb_detected' || rule === 'usb_storage') {
      title = '🔌 USB Device Connection';
    } else if (rule === 'blacklisted_app') {
      title = '🚨 Blacklisted App Violation';
    } else if (rule === 'secondary_monitor') {
      title = '🖥️ Secondary Display Detected';
    } else if (rule === 'remote_access_tool') {
      title = '⚡ Remote Control Tool Detected';
    }

    const newToast = {
      id: Date.now() + Math.random(),
      student_id: data.student_id,
      rule_type: rule,
      title,
      name: data.name || `Candidate ${data.student_id}`,
      detail: data.detail || `Proctoring violation detected: ${rule}`,
      timestamp: new Date().toLocaleTimeString()
    };
    setToastAlerts(prev => [newToast, ...prev.filter(t => t.id !== newToast.id)].slice(0, 4));
  };

  const handleUnbanStudent = (studentId) => {
    if (socketRef.current) {
      socketRef.current.emit('teacher:unban_student', { student_id: studentId });
      setKickedStudentsList(prev => prev.filter(id => String(id) !== String(studentId)));
    }
  };

  const handleCreateSession = async () => {
    setCreatingSession(true);
    try {
      const res = await fetch(getApiUrl('/teacher/sessions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_username: user.username })
      });
      const data = await res.json();
      if (data.success) {
        setActiveSessionId(data.session_id);
      }
    } catch (e) {
      console.error(e);
    }
    setCreatingSession(false);
  };

  const socketRef = useRef(null);
  const navigate = useNavigate();

  const userStr = localStorage.getItem('siet_user');
  const user = userStr ? JSON.parse(userStr) : { username: 'Teacher' };

  useEffect(() => {
    const SERVER_URL = getSocketUrl('/dashboard');
    const s = io(SERVER_URL, { reconnection: true, reconnectionDelay: 2000, reconnectionAttempts: Infinity });
    socketRef.current = s;

    s.on('session:info_update', (data) => {
      if (data?.session_key) {
        setActiveSessionKey(data.session_key);
      }
      if (data?.session_id) {
        setActiveSessionId(data.session_id);
      }
    });

    s.on('session:kicked_list', (data) => {
      if (Array.isArray(data?.kicked_students)) {
        setKickedStudentsList(data.kicked_students);
      }
    });

    s.on('session:student_joined', (student) => {
      setStudents(prev => ({
        ...prev,
        [student.student_id]: {
          ...(prev[student.student_id] || {}),
          ...student,
          activity: prev[student.student_id]?.activity || {},
          flags: prev[student.student_id]?.flags || [],
          risk_score: prev[student.student_id]?.risk_score || 0
        }
      }));
    });

    s.on('frame:update', (data) => {
      setStudents(prev => {
        if (!prev[data.student_id]) return prev;
        return {
          ...prev,
          [data.student_id]: { ...prev[data.student_id], latestFrame: data.jpeg_base64 }
        };
      });
    });

    s.on('activity:update', (data) => {
      setStudents(prev => {
        if (!prev[data.student_id]) return prev;
        return { ...prev, [data.student_id]: { ...prev[data.student_id], activity: data } };
      });
    });

    s.on('alert:blacklisted_app', (data) => {
      pushViolationToast({ ...data, rule_type: 'blacklisted_app' });
    });

    s.on('flag:new', (flag) => {
      if (['blacklisted_app', 'usb_detected', 'usb_storage', 'secondary_monitor', 'remote_access_tool'].includes(flag?.rule_type)) {
        pushViolationToast(flag);
      }
      setFlags(prev => [flag, ...prev].slice(0, 100));
      setStudents(prev => {
        if (!prev[flag.student_id]) return prev;
        return {
          ...prev,
          [flag.student_id]: {
            ...prev[flag.student_id],
            flags: [flag, ...(prev[flag.student_id].flags || [])],
            lastFlag: flag,
            flaggedAt: Date.now()
          }
        };
      });
    });

    s.on('risk:update', (data) => {
      setStudents(prev => {
        if (!prev[data.student_id]) return prev;
        return { ...prev, [data.student_id]: { ...prev[data.student_id], risk_score: data.risk_score } };
      });
    });

    s.on('student:lock_status', (data) => {
      setStudents(prev => {
        if (!prev[data.student_id]) return prev;
        return { ...prev, [data.student_id]: { ...prev[data.student_id], is_locked: data.is_locked } };
      });
    });

    s.on('session:student_left', (data) => {
      if (data?.reason === 'kicked' && data?.student_id) {
        setKickedStudentsList(prev => Array.from(new Set([...prev, data.student_id])));
      }
      setStudents(prev => {
        const next = { ...prev };
        delete next[data.student_id];
        return next;
      });
    });

    s.on('session:unbanned', (data) => {
      setKickedStudentsList(prev => prev.filter(id => String(id) !== String(data.student_id)));
    });

    return () => s.disconnect();
  }, []);

  // Display all currently connected students
  const allStudents = Object.values(students);
  const filteredStudents = allStudents.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      (s.student_id || '').toLowerCase().includes(q) ||
      (s.name || '').toLowerCase().includes(q) ||
      (s.hostname || '').toLowerCase().includes(q) ||
      (s.ip || '').toLowerCase().includes(q);
    const matchesRisk =
      filterRisk === 'all' ||
      (filterRisk === 'high' && (s.risk_score || 0) >= 40) ||
      (filterRisk === 'low' && (s.risk_score || 0) < 40);
    return matchesSearch && matchesRisk;
  });

  const handleLockScreen = (studentId) => {
    if (socketRef.current) {
      socketRef.current.emit('teacher:lock_screen', { student_id: studentId });
    }
  };

  const handleUnlockScreen = (studentId) => {
    if (socketRef.current) {
      socketRef.current.emit('teacher:unlock_screen', { student_id: studentId });
    }
  };

  const handleExport = async () => {
    const url = getApiUrl('/session/export');
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'exam_safe_session_report.json';
    a.click();
  };

  const handleSessionSummary = async () => {
    setLoadingSummary(true);
    try {
      let data = {};
      try {
        const res = await fetch(getApiUrl('/session/summary'));
        data = await res.json();
      } catch (e) {
        console.warn('API summary fetch error', e);
      }

      // Calculate live session statistics from actual online candidates & flags
      const liveStudentList = Object.values(students);
      const liveTotal = liveStudentList.length > 0 ? liveStudentList.length : 1;
      
      // Get unique flagged candidates
      const flaggedStudentSet = new Set(
        flags
          .filter(f => f.rule_type)
          .map(f => String(f.student_id))
      );

      const liveFlaggedCount = Math.min(liveTotal, flaggedStudentSet.size);
      const liveCleanCount = Math.max(0, liveTotal - liveFlaggedCount);

      const liveRuleBreakdown = {};
      flags.forEach(f => {
        if (f.rule_type) {
          liveRuleBreakdown[f.rule_type] = (liveRuleBreakdown[f.rule_type] || 0) + 1;
        }
      });

      const finalBreakdown = Object.keys(liveRuleBreakdown).length > 0 
        ? liveRuleBreakdown 
        : (data.rule_breakdown || { blacklisted_app: flags.length || 1 });

      const sortedRules = Object.entries(finalBreakdown).sort((a, b) => b[1] - a[1]);
      const topRule = sortedRules[0];
      const topRuleFormatted = topRule ? topRule[0].replace(/_/g, ' ') : 'None';

      const flaggedNames = Array.from(flaggedStudentSet).map(id => {
        const st = students[id];
        return st?.name || `Student ${id}`;
      });

      const realSummary = {
        generated_at: new Date().toISOString(),
        total_students: liveTotal,
        flagged_students: liveFlaggedCount,
        clean_students: liveCleanCount,
        total_flags: flags.length,
        most_common_violation: topRuleFormatted,
        rule_breakdown: finalBreakdown,
        summary: `Exam session active with ${liveTotal} candidate(s) monitored. ${liveFlaggedCount} candidate(s) flagged for behavioral violations, ${liveCleanCount} candidate(s) clean. Total of ${flags.length} violation flag(s) logged. Primary issue: ${topRuleFormatted}.`,
        recommendation: liveFlaggedCount === 0
          ? 'Session integrity verified clean. No proctoring intervention required.'
          : `Faculty Review Advised: Inspect flagged candidate(s) ${flaggedNames.join(', ')}.`
      };

      setSessionSummary(realSummary);
      setActiveTab('summary');
    } catch(e) { console.error(e); }
    finally { setLoadingSummary(false); }
  };

  const navItems = [
    { id: 'grid', label: 'Live Grid', icon: LayoutGrid },
    { id: 'heatmap', label: 'Heatmap', icon: Activity },
    { id: 'map', label: 'Seating Map', icon: MapPin },
    { id: 'kicked', label: `Revoked (${kickedStudentsList.length})`, icon: UserX, badgeCount: kickedStudentsList.length },
    { id: 'admin', label: 'Admin', icon: Settings },
  ];
  if (user.role === 'admin' || user.role === 'teacher') {
    navItems.push({ id: 'users', label: 'Users', icon: Users });
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#EEF4F0] text-slate-900 font-sans selection:bg-emerald-500/30 overflow-x-hidden">
      {/* ── HEADER (Responsive Light Green & Half-White Theme) ── */}
      <header className="bg-[#FAFCFA]/95 backdrop-blur-xl border-b border-emerald-300/80 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between sticky top-0 z-50 shadow-md gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/25 shrink-0 border border-emerald-300/30 text-white">
            <Shield className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex flex-col justify-center leading-tight">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-base font-black tracking-tight text-emerald-950">Exam Safe</span>
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm">v2.5</span>
            </div>
            <p className="text-[11px] text-emerald-700 font-bold tracking-wide whitespace-nowrap mt-0.5">Smart Proctoring Workspace</p>
          </div>
        </div>

        <nav className="flex items-center gap-1.5 bg-emerald-100/70 p-1.5 rounded-2xl border border-emerald-300/60 shrink-0">
          {navItems.map(({ id, label, icon: Icon, badgeCount }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-extrabold tracking-wide transition-all duration-200 relative ${
                activeTab === id
                  ? 'bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-600 text-white shadow-lg shadow-emerald-600/30 scale-[1.02]'
                  : badgeCount > 0
                  ? 'bg-red-500/20 text-red-700 border border-red-500/40 hover:bg-red-500/30'
                  : 'bg-white/80 text-emerald-900 hover:bg-white border border-emerald-200/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              {badgeCount > 0 && id !== 'kicked' && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping absolute -top-0.5 -right-0.5" />
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {/* Active 6-Character Session Key Widget */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-100 to-teal-100 border border-emerald-300 rounded-xl shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-emerald-800 font-extrabold uppercase tracking-wider">Session Key:</span>
              <span className="font-mono text-base font-black text-emerald-900 tracking-widest bg-white px-2.5 py-0.5 rounded-lg border border-emerald-300 shadow-inner">
                {activeSessionKey || 'K9X2M7'}
              </span>
              <button
                onClick={() => {
                  if (socketRef.current) socketRef.current.emit('teacher:rotate_session');
                }}
                title="Rotate 6-Character Session Key (Auto-rotates on kickout)"
                className="px-2.5 py-1 text-xs font-extrabold bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg transition-all shadow-md shadow-emerald-600/30 hover:scale-105 active:scale-95 flex items-center gap-1 border border-emerald-400/40 uppercase tracking-wider"
              >
                🔄 Rotate Key
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-emerald-300 shadow-xs text-emerald-950 font-bold">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-extrabold text-emerald-950">{allStudents.length} online</span>
          </div>
          <button
            onClick={handleSessionSummary}
            disabled={loadingSummary}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-900 font-extrabold rounded-xl text-xs border border-emerald-300 transition-all shadow-xs hover:scale-105"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-700" />
            {loadingSummary ? 'Generating…' : 'Summary'}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-900 font-extrabold rounded-xl text-xs border border-emerald-300 transition-all shadow-xs hover:scale-105"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" /> Export
          </button>
          <div className="pl-2.5 border-l border-emerald-300 flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-950">{user.username}</span>
            <button
              onClick={() => { localStorage.removeItem('siet_user'); navigate('/login'); }}
              className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 font-black rounded-xl text-xs border border-rose-300 transition-all hover:scale-105"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── SEARCH / FILTER BAR (only on grid/heatmap/map) ── */}
      {['grid', 'heatmap', 'map'].includes(activeTab) && (
        <div className="px-6 py-3 bg-[#EEF4F0] border-b border-emerald-300/60 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-700/60" />
            <input
              type="text"
              placeholder="Search by student ID, name, hostname, IP…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-emerald-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 font-medium shadow-inner transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {['all', 'high', 'low'].map(r => (
              <button
                key={r}
                onClick={() => setFilterRisk(r)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wide border transition-all ${
                  filterRisk === r
                    ? r === 'high' ? 'bg-red-100 border-red-300 text-red-800 shadow-sm'
                    : r === 'low' ? 'bg-emerald-100 border-emerald-300 text-emerald-900 shadow-sm'
                    : 'bg-emerald-600 border-emerald-600 text-white font-black shadow-md shadow-emerald-600/20'
                    : 'bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50'
                }`}
              >
                {r === 'all' ? 'All' : r === 'high' ? '⚠ High Risk' : '✓ Normal'}
              </button>
            ))}
          </div>
          <span className="text-sm text-emerald-900/60 font-bold ml-2">{filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 p-6 overflow-auto">
        {activeTab === 'grid' && (
          <>
            {/* Kicked Candidates Re-admit Control Banner */}
            {kickedStudentsList.length > 0 && (
              <div className="mb-4 p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl flex items-center justify-between flex-wrap gap-3 shadow-lg">
                <div className="flex items-center gap-2.5 text-xs font-bold text-red-400">
                  <div className="w-7 h-7 bg-red-500/20 rounded-lg flex items-center justify-center border border-red-500/30">
                    <Users className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Kicked / Revoked Candidates ({kickedStudentsList.length}):</p>
                    <p className="text-red-400/80 text-xs font-mono">{kickedStudentsList.join(', ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {kickedStudentsList.map(id => (
                    <button
                      key={id}
                      onClick={() => handleUnbanStudent(id)}
                      className="px-3 py-1.5 bg-green-600/30 hover:bg-green-600/50 text-green-300 text-xs font-bold rounded-lg border border-green-500/40 transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      🔓 Re-admit Candidate {id}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <LiveGrid students={filteredStudents} flags={flags} onLockScreen={handleLockScreen} onUnlockScreen={handleUnlockScreen} socket={socketRef.current} />
          </>
        )}
        {activeTab === 'heatmap' && <ActivityHeatmap students={filteredStudents} />}
        {activeTab === 'map' && <SmartClassroomMap students={filteredStudents} flags={flags} />}
        {activeTab === 'kicked' && (
          <div className="bg-[#FAFCFA] border border-emerald-300/80 rounded-3xl p-6 shadow-xl text-slate-900">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-emerald-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-100 border border-rose-300 rounded-2xl flex items-center justify-center">
                  <UserX className="w-5 h-5 text-rose-700" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-emerald-950">Revoked Candidate Access Control</h2>
                  <p className="text-xs text-slate-600 font-bold">Manage candidates who have been kicked out of the current exam session</p>
                </div>
              </div>
              <div className="px-3.5 py-1 bg-rose-100 border border-rose-300 rounded-full text-xs font-black text-rose-800 uppercase tracking-wider">
                {kickedStudentsList.length} Revoked Candidate{kickedStudentsList.length !== 1 ? 's' : ''}
              </div>
            </div>

            {kickedStudentsList.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500 gap-3 bg-white rounded-2xl border border-emerald-200/80 shadow-xs">
                <UserX className="w-12 h-12 text-rose-600/70" />
                <p className="text-base font-black text-emerald-950">No candidates are currently kicked or revoked.</p>
                <p className="text-xs text-slate-600 max-w-md font-medium">When a proctor kicks a candidate out, their ID appears in this list. Click Re-admit anytime to restore their exam access.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {kickedStudentsList.map(studentId => (
                  <div key={studentId} className="bg-rose-50 border border-rose-300 rounded-2xl p-5 flex items-center justify-between gap-3 shadow-sm">
                    <div>
                      <p className="text-base font-black text-rose-950 flex items-center gap-2">
                        Candidate {studentId}
                      </p>
                      <p className="text-xs text-rose-700 font-mono font-bold mt-0.5">Access Revoked by Faculty</p>
                    </div>
                    <button
                      onClick={() => handleUnbanStudent(studentId)}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl border border-emerald-500 shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1.5 shrink-0 hover:scale-105"
                    >
                      🔓 Re-admit
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'admin' && <AdminPanel />}
        {activeTab === 'users' && (user.role === 'admin' || user.role === 'teacher') && <UserManagementPanel currentUserRole={user.role} />}
        {activeTab === 'summary' && sessionSummary && (
          <SessionSummaryView summary={sessionSummary} onExport={handleExport} />
        )}
      </main>

      {/* ── BOTTOM-RIGHT TOAST NOTIFICATION CONTAINER ── */}
      {toastAlerts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[9999] space-y-3 pointer-events-auto max-w-sm w-full">
          {toastAlerts.map(toast => {
            const isUsb = toast.rule_type === 'usb_detected' || toast.rule_type === 'usb_storage';
            return (
              <div
                key={toast.id}
                className={`bg-white border-2 rounded-2xl p-4 shadow-2xl flex items-start gap-3 text-slate-900 relative overflow-hidden animate-bounce-once ${
                  isUsb ? 'border-amber-500 shadow-amber-500/30' : 'border-rose-500 shadow-rose-500/35'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  isUsb ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-rose-100 border-rose-300 text-rose-700'
                }`}>
                  {isUsb ? <Usb className="w-5 h-5 animate-pulse text-amber-800" /> : <AlertTriangle className="w-5 h-5 animate-pulse text-rose-700" />}
                </div>
                <div className="flex-1 pr-6">
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1 ${
                      isUsb ? 'text-amber-800' : 'text-rose-700'
                    }`}>
                      {toast.title || '🚨 Security Violation'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono font-bold">{toast.timestamp}</span>
                  </div>
                  <p className="text-sm font-black text-emerald-950 mt-1">
                    Candidate {toast.student_id} ({toast.name})
                  </p>
                  <p className={`text-xs font-black mt-1 p-2 rounded-xl border leading-snug ${
                    isUsb ? 'bg-amber-50 text-amber-950 border-amber-200' : 'bg-rose-50 text-rose-900 border-rose-200'
                  }`}>
                    {toast.detail}
                  </p>
                </div>
                <button
                  onClick={() => setToastAlerts(prev => prev.filter(t => t.id !== toast.id))}
                  className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Dismiss Alert"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Session Summary View ──────────────────────────────────────────────────────
// ── Session Summary View (Light Green & Half-White Theme) ─────────────────────
const SessionSummaryView = ({ summary, onExport }) => (
  <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
    <div className="bg-[#FAFCFA] border-2 border-emerald-300/80 rounded-3xl p-6 sm:p-8 shadow-xl text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-emerald-200/80">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100/80 text-emerald-800 rounded-full text-xs font-extrabold uppercase tracking-wider mb-1 border border-emerald-300/60">
            ✨ Executive Integrity Report
          </div>
          <h2 className="text-2xl font-black text-emerald-950 tracking-tight">AI Session Summary</h2>
        </div>
        <span className="text-xs font-mono font-bold text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
          {new Date(summary.generated_at).toLocaleString()}
        </span>
      </div>

      <p className="text-slate-700 leading-relaxed mb-6 p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 font-medium text-sm sm:text-base shadow-inner">
        {summary.summary}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Students', value: summary.total_students, color: 'text-emerald-700', bg: 'bg-emerald-50/80', border: 'border-emerald-200' },
          { label: 'Flagged', value: summary.flagged_students, color: 'text-amber-700', bg: 'bg-amber-50/80', border: 'border-amber-200' },
          { label: 'Clean', value: summary.clean_students, color: 'text-emerald-600', bg: 'bg-emerald-100/60', border: 'border-emerald-300' },
          { label: 'Total Flags', value: summary.total_flags, color: 'text-rose-700', bg: 'bg-rose-50/80', border: 'border-rose-200' }
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} className={`${bg} ${border} border rounded-2xl p-4 text-center shadow-sm hover:scale-105 transition-all`}>
            <p className={`text-3xl font-black ${color}`}>{value}</p>
            <p className="text-slate-600 text-xs font-extrabold uppercase tracking-wider mt-1">{label}</p>
          </div>
        ))}
      </div>

      {Object.keys(summary.rule_breakdown || {}).length > 0 && (
        <div className="mb-8 bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-sm">
          <h3 className="text-xs font-black text-emerald-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            📊 Violation Breakdown
          </h3>
          <div className="space-y-3">
            {Object.entries(summary.rule_breakdown).map(([rule, count]) => (
              <div key={rule} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-700 w-44 capitalize truncate">{rule.replace(/_/g, ' ')}</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className="h-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (count / (summary.total_flags || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-mono font-black text-slate-800 w-10 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-5 bg-amber-50/90 border border-amber-200 rounded-2xl text-amber-950 shadow-sm">
        <p className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5 mb-1">
          📋 Proctoring Recommendation
        </p>
        <p className="text-sm font-bold text-slate-800 leading-relaxed">{summary.recommendation}</p>
      </div>
    </div>

    <button
      onClick={onExport}
      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
    >
      <Download className="w-5 h-5" /> Download Full JSON Report
    </button>
  </div>
);

export default TeacherDashboard;
