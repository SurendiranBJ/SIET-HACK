import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Shield, LayoutGrid, Activity, MapPin, Settings, Lock, FileText, Search, X, Download, Users } from 'lucide-react';
import { getApiUrl, getSocketUrl } from '../config';

import LiveGrid from '../components/LiveGrid';
import ActivityHeatmap from '../components/ActivityHeatmap';
import SmartClassroomMap from '../components/SmartClassroomMap';
import AdminPanel from '../components/AdminPanel';
import PrivacyDashboard from '../components/PrivacyDashboard';
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
  const [creatingSession, setCreatingSession] = useState(false);

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

    s.on('flag:new', (flag) => {
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
      setStudents(prev => {
        const next = { ...prev };
        delete next[data.student_id];
        return next;
      });
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
    a.download = 'siet_session_report.json';
    a.click();
  };

  const handleSessionSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await fetch(getApiUrl('/session/summary'));
      const data = await res.json();
      setSessionSummary(data);
      setActiveTab('summary');
    } catch(e) { console.error(e); }
    finally { setLoadingSummary(false); }
  };

  const navItems = [
    { id: 'grid', label: 'Live Grid', icon: LayoutGrid },
    { id: 'heatmap', label: 'Heatmap', icon: Activity },
    { id: 'map', label: 'Seating Map', icon: MapPin },
    { id: 'admin', label: 'Admin', icon: Settings },
    { id: 'privacy', label: 'Privacy', icon: Lock },
  ];
  if (user.role === 'admin') {
    navItems.push({ id: 'users', label: 'Users', icon: Users });
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0F1115] text-white">
      {/* ── HEADER ── */}
      <header className="bg-[#14171F]/95 backdrop-blur border-b border-white/5 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">SIET Overwatch</h1>
            <p className="text-xs text-blue-400 font-medium">Smart Classroom Monitoring</p>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {/* Active Session Creator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 border border-blue-500/30 rounded-lg">
            {activeSessionId ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-300 font-medium uppercase tracking-wider">Session ID:</span>
                <span className="font-mono text-base font-bold text-green-400 tracking-widest">{activeSessionId}</span>
              </div>
            ) : (
              <button
                onClick={handleCreateSession}
                disabled={creatingSession}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-all uppercase tracking-wider flex items-center gap-1"
              >
                {creatingSession ? 'Creating...' : '+ Create Session ID'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1E2330] rounded-lg border border-white/5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-white/70">{allStudents.length} online</span>
          </div>
          <button
            onClick={handleSessionSummary}
            disabled={loadingSummary}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-lg text-sm border border-purple-500/20 transition-all"
          >
            <FileText className="w-4 h-4" />
            {loadingSummary ? 'Generating…' : 'Summary'}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E2330] hover:bg-white/5 text-white/60 rounded-lg text-sm border border-white/5 transition-all"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <div className="pl-3 border-l border-white/10 flex items-center gap-3">
            <span className="text-sm text-white/40">{user.username}</span>
            <button
              onClick={() => { localStorage.removeItem('siet_user'); navigate('/login'); }}
              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm border border-red-500/20 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── SEARCH / FILTER BAR (only on grid/heatmap/map) ── */}
      {['grid', 'heatmap', 'map'].includes(activeTab) && (
        <div className="px-6 py-3 bg-[#0F1115] border-b border-white/5 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search by student ID, name, hostname, IP…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#1A1D24] border border-white/5 rounded-xl text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {['all', 'high', 'low'].map(r => (
              <button
                key={r}
                onClick={() => setFilterRisk(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wide border transition-all ${
                  filterRisk === r
                    ? r === 'high' ? 'bg-red-500/20 border-red-500/40 text-red-400'
                    : r === 'low' ? 'bg-green-500/20 border-green-500/40 text-green-400'
                    : 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-[#1A1D24] border-white/5 text-white/40 hover:text-white/70'
                }`}
              >
                {r === 'all' ? 'All' : r === 'high' ? '⚠ High Risk' : '✓ Normal'}
              </button>
            ))}
          </div>
          <span className="text-sm text-white/30 ml-2">{filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 p-6 overflow-auto">
        {activeTab === 'grid' && (
          <LiveGrid students={filteredStudents} flags={flags} onLockScreen={handleLockScreen} onUnlockScreen={handleUnlockScreen} socket={socketRef.current} />
        )}
        {activeTab === 'heatmap' && <ActivityHeatmap students={filteredStudents} />}
        {activeTab === 'map' && <SmartClassroomMap students={filteredStudents} flags={flags} />}
        {activeTab === 'admin' && <AdminPanel />}
        {activeTab === 'privacy' && <PrivacyDashboard />}
        {activeTab === 'users' && user.role === 'admin' && <UserManagementPanel />}
        {activeTab === 'summary' && sessionSummary && (
          <SessionSummaryView summary={sessionSummary} onExport={handleExport} />
        )}
      </main>
    </div>
  );
};

// ── Session Summary View ──────────────────────────────────────────────────────
const SessionSummaryView = ({ summary, onExport }) => (
  <div className="max-w-3xl mx-auto space-y-6">
    <div className="bg-[#1A1D24] border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">AI Session Summary</h2>
        <span className="text-xs text-white/30">{new Date(summary.generated_at).toLocaleString()}</span>
      </div>
      <p className="text-white/80 leading-relaxed mb-6 p-4 bg-[#0F1115] rounded-xl border border-white/5">{summary.summary}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Students', value: summary.total_students, color: 'text-blue-400' },
          { label: 'Flagged', value: summary.flagged_students, color: 'text-yellow-400' },
          { label: 'Clean', value: summary.clean_students, color: 'text-green-400' },
          { label: 'Total Flags', value: summary.total_flags, color: 'text-red-400' }
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#0F1115] rounded-xl p-4 border border-white/5 text-center">
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            <p className="text-white/40 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>
      {Object.keys(summary.rule_breakdown || {}).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-3">Violation Breakdown</h3>
          <div className="space-y-2">
            {Object.entries(summary.rule_breakdown).map(([rule, count]) => (
              <div key={rule} className="flex items-center gap-3">
                <span className="text-sm text-white/60 w-48">{rule.replace(/_/g, ' ')}</span>
                <div className="flex-1 h-2 bg-[#0F1115] rounded-full overflow-hidden">
                  <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (count / summary.total_flags) * 100)}%` }} />
                </div>
                <span className="text-sm text-white/60 w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
        <p className="text-yellow-300 text-sm font-medium">📋 Recommendation</p>
        <p className="text-white/70 text-sm mt-1">{summary.recommendation}</p>
      </div>
    </div>
    <button onClick={onExport} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all">
      <Download className="w-4 h-4" /> Download Full JSON Report
    </button>
  </div>
);

export default TeacherDashboard;
