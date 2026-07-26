import React, { useState, useEffect } from 'react';
import { Shield, Plus, Users, UserPlus, Trash2, Ban, CheckCircle, Lock } from 'lucide-react';
import { getApiUrl } from '../config';

export default function UserManagementPanel({ currentUserRole }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Get active role from prop or localStorage
  const activeRole = currentUserRole || (() => {
    try { return JSON.parse(localStorage.getItem('siet_user'))?.role; } catch { return 'student'; }
  })();

  const isTeacherOnly = activeRole === 'teacher';

  // Create User Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/users'));
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      console.error('Failed to fetch users', e);
    }
    setLoading(false);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setMessage('');

    // Enforcement: Teachers can ONLY create Student accounts
    const targetRole = isTeacherOnly ? 'student' : role;

    try {
      const res = await fetch(getApiUrl('/admin/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role: targetRole, creatorRole: activeRole })
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`Success: Account created for ${username} (${targetRole.toUpperCase()})`);
        setUsername('');
        setPassword('');
        fetchUsers();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setMessage(`Network error: ${err.message}`);
    }
    setCreateLoading(false);
  };

  const handleDeleteUser = async (id) => {
    if (isTeacherOnly) {
      alert('Permission Denied: Teachers can only block student accounts and cannot delete them. Contact an Admin to delete accounts.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(getApiUrl(`/admin/users/${id}?actorRole=${activeRole}`), { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error || 'Failed to delete user.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleBlock = async (targetUser, currentBlocked) => {
    const targetId = typeof targetUser === 'object' ? targetUser.id : targetUser;
    const targetRole = typeof targetUser === 'object' ? targetUser.role : '';

    if (isTeacherOnly && targetRole && targetRole !== 'student') {
      alert('Permission Denied: Teachers can only block or unblock Student accounts. Admin and Teacher accounts are protected.');
      return;
    }

    try {
      const res = await fetch(getApiUrl(`/admin/users/${targetId}/block`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: !currentBlocked, actorRole: activeRole })
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error || 'Failed to update user block status.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create User Form Card (Light Green & Half-White Theme) */}
      <div className="bg-[#FAFCFA] border-2 border-emerald-300/80 rounded-3xl p-6 shadow-md text-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-emerald-100">
          <h2 className="text-lg font-black text-emerald-950 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-emerald-800" />
            </div>
            Create New Account
          </h2>

          <div className="px-3 py-1 bg-emerald-100/90 border border-emerald-300 rounded-full text-xs font-black text-emerald-950 flex items-center gap-1.5 shadow-xs">
            <Shield className="w-3.5 h-3.5 text-emerald-700" />
            <span>Scope: {isTeacherOnly ? 'Teacher Mode (Student Accounts Only)' : 'Admin Mode (All Roles)'}</span>
          </div>
        </div>
        
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black text-emerald-900 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <input 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. candidate105"
                className="w-full bg-white border-2 border-emerald-200/80 rounded-xl px-4 py-2.5 text-slate-900 font-bold text-sm focus:outline-none focus:border-emerald-600 shadow-inner placeholder:text-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-emerald-900 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border-2 border-emerald-200/80 rounded-xl px-4 py-2.5 text-slate-900 font-bold text-sm focus:outline-none focus:border-emerald-600 shadow-inner placeholder:text-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-emerald-900 uppercase tracking-wider mb-1.5">
                Role
              </label>
              {isTeacherOnly ? (
                <div className="w-full bg-emerald-50 border-2 border-emerald-300/80 rounded-xl px-4 py-2.5 text-emerald-950 font-black text-sm flex items-center justify-between shadow-xs cursor-not-allowed">
                  <span>Student</span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Restricted
                  </span>
                </div>
              ) : (
                <select 
                  value={role} 
                  onChange={e => setRole(e.target.value)}
                  className="w-full bg-white border-2 border-emerald-200/80 rounded-xl px-4 py-2.5 text-slate-900 font-bold text-sm focus:outline-none focus:border-emerald-600 shadow-inner"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button 
              type="submit" 
              disabled={createLoading} 
              className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              {createLoading ? 'Creating Account...' : isTeacherOnly ? 'Create Student Account' : 'Create Account'}
            </button>
          </div>

          {message && (
            <div className={`mt-3 p-3 rounded-xl font-bold text-xs flex items-center gap-2 border shadow-xs ${
              message.includes('Success') 
                ? 'bg-emerald-100 border-emerald-300 text-emerald-950' 
                : 'bg-rose-100 border-rose-300 text-rose-950'
            }`}>
              {message.includes('Success') ? <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" /> : <Ban className="w-4 h-4 text-rose-700 shrink-0" />}
              <span>{message}</span>
            </div>
          )}
        </form>
      </div>

      {/* User Registry List Card (Light Green & Half-White Theme) */}
      <div className="bg-[#FAFCFA] border-2 border-emerald-300/80 rounded-3xl p-6 shadow-md text-slate-900">
        <h2 className="text-lg font-black text-emerald-950 flex items-center gap-2 mb-4 pb-3 border-b border-emerald-100">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center">
            <Users className="w-4 h-4 text-emerald-800" />
          </div>
          Manage Users
        </h2>

        {loading ? (
          <div className="p-8 text-center text-slate-500 font-bold text-sm animate-pulse">
            Loading user directory...
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-emerald-200 bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-emerald-200 text-emerald-950 font-black text-xs uppercase tracking-wider bg-emerald-50/70">
                  <th className="p-3.5">S.No</th>
                  <th className="p-3.5">Username</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100">
                {users.map((user, idx) => (
                  <tr key={user.id} className="hover:bg-emerald-50/60 transition">
                    <td className="p-3.5 text-slate-500 font-mono font-bold text-xs">#{idx + 1}</td>
                    <td className="p-3.5 font-extrabold text-slate-900 text-sm">{user.username}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-black border uppercase tracking-wider ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-900 border-purple-300' : 
                        user.role === 'teacher' ? 'bg-teal-100 text-teal-900 border-teal-300' : 
                        'bg-slate-100 text-slate-800 border-slate-300'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-3.5">
                      {user.blocked ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-950 border border-rose-300 flex items-center gap-1 w-max">
                          <Ban className="w-3.5 h-3.5 text-rose-700" /> Blocked
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-950 border border-emerald-300 flex items-center gap-1 w-max">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-700" /> Active
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 flex items-center gap-2">
                      {isTeacherOnly && user.role !== 'student' ? (
                        <span className="text-[10px] text-slate-400 font-bold px-2 py-1 bg-slate-100 rounded-lg border border-slate-200" title="Teachers can only manage Student accounts">
                          Protected Account
                        </span>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleToggleBlock(user, user.blocked)}
                            className={`p-2 rounded-xl border font-bold text-xs transition shadow-xs ${
                              user.blocked 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100' 
                                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                            }`}
                            title={user.blocked ? "Unblock Student" : "Block Student"}
                          >
                            {user.blocked ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                          </button>
                          {!isTeacherOnly && (
                            <button 
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-100 transition shadow-xs"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-6 text-center text-slate-500 font-bold text-sm">No registered users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
