import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeContext';

export default function ThemeToggle({ inline = false }) {
  const { theme, toggleTheme } = useTheme();

  if (inline) {
    return (
      <button
        onClick={toggleTheme}
        type="button"
        title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border font-medium transition-all cursor-pointer"
        style={{
          backgroundColor: theme === 'light' ? '#F1F5F9' : '#1E2330',
          color: theme === 'light' ? '#0F172A' : '#FFFFFF',
          borderColor: theme === 'light' ? '#CBD5E1' : 'rgba(255, 255, 255, 0.1)'
        }}
      >
        {theme === 'dark' ? (
          <>
            <Sun className="w-4 h-4 text-amber-400 fill-amber-400/20" />
            <span className="hidden md:inline">Light</span>
          </>
        ) : (
          <>
            <Moon className="w-4 h-4 text-indigo-600 fill-indigo-600/20" />
            <span className="hidden md:inline">Dark</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
      className="absolute top-5 right-5 z-50 px-3.5 py-2 rounded-full shadow-lg backdrop-blur-md border transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer"
      style={{
        backgroundColor: theme === 'light' ? '#FFFFFF' : '#1A1D24',
        color: theme === 'light' ? '#0F172A' : '#FFFFFF',
        borderColor: theme === 'light' ? '#CBD5E1' : '#2E323D',
        boxShadow: theme === 'light' ? '0 10px 25px -5px rgba(0,0,0,0.1)' : '0 10px 25px -5px rgba(0,0,0,0.5)'
      }}
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-4 h-4 text-amber-400 fill-amber-400/20" />
          <span>Light Mode</span>
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 text-indigo-600 fill-indigo-600/20" />
          <span>Dark Mode</span>
        </>
      )}
    </button>
  );
}
