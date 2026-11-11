import React from 'react';
import { useApp } from '../context/AppContext';
import { Shield, LifeBuoy, User, LogOut, KeyRound, Check } from 'lucide-react';

export default function FastLoginBar({ onTabChange, activeTab }) {
  const { currentUser, fastLogin, logout, setAuthModalOpen } = useApp();

  const handleRoleSelect = (roleKey) => {
    const user = fastLogin(roleKey);
    if (onTabChange) {
      if (roleKey === 'admin') onTabChange('admin');
      else if (roleKey === 'rescue_team') onTabChange('rescue');
      else onTabChange('landing');
    }
  };

  const handleLogout = () => {
    logout();
    if (onTabChange) onTabChange('landing');
  };

  return (
    <div className="w-full bg-slate-900/95 border-b border-cyan-500/30 px-3 py-2 text-xs text-slate-200 backdrop-blur-md shadow-md z-40 sticky top-0">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Left: Role Switcher Label & Current Status */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Fast Role Switcher
          </span>

          <span className="text-slate-400 hidden sm:inline">Active:</span>
          {currentUser ? (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[11px] ${
              currentUser.role === 'admin'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : currentUser.role === 'rescue_team'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}>
              <Check size={12} />
              {currentUser.role === 'admin' && 'Admin Panel'}
              {currentUser.role === 'rescue_team' && 'Rescue Team Console'}
              {currentUser.role === 'citizen' && 'Citizen View'}
              <span className="text-[10px] opacity-75 hidden md:inline">({currentUser.name})</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
              Guest / Public Visitor (Early Warnings)
            </span>
          )}
        </div>

        {/* Right: 1-Click Fast Login Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400 mr-1 hidden lg:inline">One-Click Fast Login:</span>

          {/* Citizen / Public */}
          <button
            type="button"
            onClick={() => handleRoleSelect('citizen')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              currentUser?.role === 'citizen' || (!currentUser && activeTab === 'landing')
                ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
            title="Fast switch to Regular Citizen view"
          >
            <User size={12} />
            <span>Citizen</span>
          </button>

          {/* Rescue Team */}
          <button
            type="button"
            onClick={() => handleRoleSelect('rescue_team')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              currentUser?.role === 'rescue_team'
                ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/30'
                : 'bg-slate-800 text-slate-300 hover:bg-amber-950/60 hover:text-amber-300 border border-slate-700 hover:border-amber-600/50'
            }`}
            title="Fast login as Rescue Operations Team"
          >
            <LifeBuoy size={12} />
            <span>Rescue Team</span>
          </button>

          {/* Admin */}
          <button
            type="button"
            onClick={() => handleRoleSelect('admin')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              currentUser?.role === 'admin'
                ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/30'
                : 'bg-slate-800 text-slate-300 hover:bg-rose-950/60 hover:text-rose-300 border border-slate-700 hover:border-rose-600/50'
            }`}
            title="Fast login as Disaster News & System Admin"
          >
            <Shield size={12} />
            <span>Admin</span>
          </button>

          {/* Custom Credentials Modal Trigger */}
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-cyan-800/50 transition-all cursor-pointer"
            title="Open Login Dialog"
          >
            <KeyRound size={12} />
            <span className="hidden sm:inline">Credentials</span>
          </button>

          {/* Logout */}
          {currentUser && (
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 border border-rose-800/40 transition-all cursor-pointer"
              title="Sign Out to Public View"
            >
              <LogOut size={12} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

