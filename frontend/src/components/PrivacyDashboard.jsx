import React from 'react';
import { Shield, Eye, Clipboard, Keyboard, Lock, Server, Database } from 'lucide-react';

const privacyItems = [
  {
    icon: Keyboard,
    title: 'Keystroke Cadence Only',
    description: 'We count keystrokes per interval — we never capture what keys are pressed or the content of text typed.',
    status: 'Protected',
    color: 'text-emerald-900 bg-emerald-100 border-emerald-300'
  },
  {
    icon: Clipboard,
    title: 'Clipboard Size Only',
    description: 'Only the byte-length of clipboard pastes is measured. Clipboard content is never accessed, read, or transmitted.',
    status: 'Protected',
    color: 'text-emerald-900 bg-emerald-100 border-emerald-300'
  },
  {
    icon: Eye,
    title: 'Session-Scoped Monitoring',
    description: 'Monitoring is strictly active only during an exam session. No background data collection occurs outside sessions.',
    status: 'Enforced',
    color: 'text-teal-900 bg-teal-100 border-teal-300'
  },
  {
    icon: Lock,
    title: 'Encrypted Transport (WSS)',
    description: 'All telemetry and screen frames travel over WebSocket Secure (WSS) / HTTPS in production deployments.',
    status: 'Enforced',
    color: 'text-teal-900 bg-teal-100 border-teal-300'
  },
  {
    icon: Server,
    title: 'On-Premises Data Storage',
    description: 'All session data is stored locally on the institution\'s server. No data is ever sent to third-party cloud services.',
    status: 'Guaranteed',
    color: 'text-emerald-900 bg-emerald-100 border-emerald-300'
  },
  {
    icon: Database,
    title: 'Audit Trail',
    description: 'Every admin action is logged with actor, timestamp, and detail. All data access is traceable.',
    status: 'Active',
    color: 'text-amber-900 bg-amber-100 border-amber-300'
  }
];

export default function PrivacyDashboard() {
  return (
    <div className="max-w-4xl space-y-6 text-slate-900">
      <div className="bg-[#FAFCFA] border border-emerald-300/80 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center border border-emerald-300">
            <Shield className="w-6 h-6 text-emerald-800" />
          </div>
          <div>
            <h2 className="text-xl font-black text-emerald-950">Privacy Safeguards</h2>
            <p className="text-slate-600 text-sm font-bold">Exam Safe is designed with privacy-first principles</p>
          </div>
        </div>
        <p className="text-slate-700 font-medium leading-relaxed">
          This platform monitors student behavior during exam sessions using behavioral signals only — never private content.
          Every design decision prioritizes the minimum necessary data for academic integrity, with explicit privacy boundaries.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {privacyItems.map(({ icon: Icon, title, description, status, color }) => (
          <div key={title} className="bg-white border border-emerald-300/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all hover:border-emerald-500">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-200">
                  <Icon className="w-4.5 h-4.5 text-emerald-800" />
                </div>
                <h3 className="font-extrabold text-emerald-950 text-sm">{title}</h3>
              </div>
              <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full border font-black uppercase tracking-wider ${color}`}>
                {status}
              </span>
            </div>
            <p className="text-slate-600 text-sm font-medium leading-relaxed">{description}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#FAFCFA] border border-emerald-300/80 rounded-3xl p-6 shadow-sm">
        <h3 className="font-black text-emerald-950 mb-3 text-base">What is NOT collected</h3>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {[
            'The actual text typed by students',
            'Clipboard content (only byte size)',
            'Personal communications, emails, or messages',
            'Browsing history or bookmarks',
            'Microphone or camera (audio/video)',
            'GPS location or physical sensor data'
          ].map(item => (
            <li key={item} className="flex items-center gap-3 text-sm text-slate-700 font-bold bg-white p-3 rounded-xl border border-emerald-200/80 shadow-xs">
              <span className="w-5 h-5 rounded-full bg-rose-100 border border-rose-300 text-rose-700 flex items-center justify-center text-xs font-black shrink-0">✕</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
