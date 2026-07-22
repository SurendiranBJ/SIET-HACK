import React from 'react';
import { Shield, Eye, Clipboard, Keyboard, Lock, Server, Database } from 'lucide-react';

const privacyItems = [
  {
    icon: Keyboard,
    title: 'Keystroke Cadence Only',
    description: 'We count keystrokes per interval — we never capture what keys are pressed or the content of text typed.',
    status: 'Protected',
    color: 'text-green-400 bg-green-500/10 border-green-500/20'
  },
  {
    icon: Clipboard,
    title: 'Clipboard Size Only',
    description: 'Only the byte-length of clipboard pastes is measured. Clipboard content is never accessed, read, or transmitted.',
    status: 'Protected',
    color: 'text-green-400 bg-green-500/10 border-green-500/20'
  },
  {
    icon: Eye,
    title: 'Session-Scoped Monitoring',
    description: 'Monitoring is strictly active only during an exam session. No background data collection occurs outside sessions.',
    status: 'Enforced',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
  },
  {
    icon: Lock,
    title: 'Encrypted Transport (WSS)',
    description: 'All telemetry and screen frames travel over WebSocket Secure (WSS) / HTTPS in production deployments.',
    status: 'Enforced',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
  },
  {
    icon: Server,
    title: 'On-Premises Data Storage',
    description: 'All session data is stored locally on the institution\'s server. No data is ever sent to third-party cloud services.',
    status: 'Guaranteed',
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20'
  },
  {
    icon: Database,
    title: 'Audit Trail',
    description: 'Every admin action is logged with actor, timestamp, and detail. All data access is traceable.',
    status: 'Active',
    color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
  }
];

export default function PrivacyDashboard() {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-[#1A1D24] border border-blue-500/20 rounded-2xl p-6 shadow-[0_0_40px_rgba(59,130,246,0.05)]">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Privacy Safeguards</h2>
            <p className="text-white/40 text-sm">SIET Overwatch is designed with privacy-first principles</p>
          </div>
        </div>
        <p className="text-white/60 leading-relaxed">
          This platform monitors student behavior during exam sessions using behavioral signals only — never private content.
          Every design decision prioritizes the minimum necessary data for academic integrity, with explicit privacy boundaries.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {privacyItems.map(({ icon: Icon, title, description, status, color }) => (
          <div key={title} className="bg-[#1A1D24] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center">
                  <Icon className="w-4 h-4 text-white/60" />
                </div>
                <h3 className="font-semibold text-white text-sm">{title}</h3>
              </div>
              <span className={`shrink-0 text-xs px-2 py-1 rounded-full border font-medium ${color}`}>
                {status}
              </span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed">{description}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#1A1D24] border border-yellow-500/10 rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-3">What is NOT collected</h3>
        <ul className="space-y-2">
          {[
            'The actual text typed by students',
            'Clipboard content (only byte size)',
            'Personal communications, emails, or messages',
            'Browsing history or bookmarks',
            'Microphone or camera (audio/video)',
            'GPS location or physical sensor data'
          ].map(item => (
            <li key={item} className="flex items-center gap-3 text-sm text-white/60">
              <span className="w-5 h-5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center text-xs flex-shrink-0">✕</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
