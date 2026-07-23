import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function AutoLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const username = searchParams.get('username');
    const role = searchParams.get('role');
    const exam_id = searchParams.get('exam_id');

    if (token && username && role) {
      const user = { username, role, token, exam_id };
      localStorage.setItem('siet_user', JSON.stringify(user));
      
      // Give a tiny delay so localstorage settles before redirect
      setTimeout(() => {
        navigate('/exam-rules', { replace: true });
      }, 500);
    } else {
      // Invalid SSO link
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-[#080B10] flex items-center justify-center text-white">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <h2 className="text-xl font-semibold">Authenticating Secure Session...</h2>
        <p className="text-white/50 text-sm">Please wait while we initialize your exam environment.</p>
      </div>
    </div>
  );
}
