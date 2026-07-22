import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentPortal from './pages/StudentPortal';

// Simulated Auth Context
const getAuth = () => {
  const userStr = localStorage.getItem('siet_user');
  if (!userStr) return null;
  try { return JSON.parse(userStr); } catch(e) { return null; }
};

const PrivateRoute = ({ children, role }) => {
  const user = getAuth();
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'teacher' ? "/teacher" : "/student"} />;
  }
  return children;
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#0F1115] text-white font-sans selection:bg-blue-500/30">
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          <Route 
            path="/teacher" 
            element={
              <PrivateRoute role="teacher">
                <TeacherDashboard />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/student" 
            element={
              <PrivateRoute role="student">
                <StudentPortal />
              </PrivateRoute>
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
