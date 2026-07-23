import React, { useState, useEffect } from 'react';
import { Shield, Plus, Users, UserPlus, Trash2, Ban, CheckCircle } from 'lucide-react';
import { getApiUrl } from '../config';

export default function UserManagementPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
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
    try {
      const res = await fetch(getApiUrl('/admin/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`Success: account created for ${username}`);
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
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(getApiUrl(`/admin/users/${id}`), { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleBlock = async (id, currentBlocked) => {
    try {
      const res = await fetch(getApiUrl(`/admin/users/${id}/block`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: !currentBlocked })
      });
      const data = await res.json();
      if (data.success) fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create User Form */}
      <div className="bg-[#13161D] rounded-2xl border border-white/5 p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-purple-400" />
          Create New Account
        </h2>
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-white/50 mb-1">Username</label>
              <input 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-[#0A0D14] border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-[#0A0D14] border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Role</label>
              <select 
                value={role} 
                onChange={e => setRole(e.target.value)}
                className="w-full bg-[#0A0D14] border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={createLoading} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 transition disabled:opacity-50 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {createLoading ? 'Creating...' : 'Create Account'}
          </button>
          {message && <p className={`mt-2 text-sm ${message.includes('Success') ? 'text-green-400' : 'text-red-400'}`}>{message}</p>}
        </form>
      </div>

      {/* User List */}
      <div className="bg-[#13161D] rounded-2xl border border-white/5 p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-400" />
          Manage Users
        </h2>
        {loading ? (
          <p className="text-white/50">Loading users...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-white/50">
                  <th className="p-3 font-medium">ID</th>
                  <th className="p-3 font-medium">Username</th>
                  <th className="p-3 font-medium">Role</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="p-3 text-white/70">{user.id}</td>
                    <td className="p-3">{user.username}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 
                        user.role === 'teacher' ? 'bg-blue-500/20 text-blue-400' : 
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-3">
                      {user.blocked ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 flex items-center gap-1 w-max">
                          <Ban className="w-3 h-3" /> Blocked
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 flex items-center gap-1 w-max">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      )}
                    </td>
                    <td className="p-3 flex items-center gap-3">
                      <button 
                        onClick={() => handleToggleBlock(user.id, user.blocked)}
                        className={`p-1.5 rounded-lg transition ${user.blocked ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}
                        title={user.blocked ? "Unblock User" : "Block User"}
                      >
                        {user.blocked ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-4 text-center text-white/50">No users found.</td>
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
