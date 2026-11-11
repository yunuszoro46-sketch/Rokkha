import React, { useState } from 'react';
import { useApp, PRESET_USERS } from '../context/AppContext';
import { X, Shield, LifeBuoy, User, Lock, Mail, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';

export default function AuthModal({ onTabChange }) {
  const { authModalOpen, setAuthModalOpen, fastLogin, setCurrentUser } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('citizen');
  const [error, setError] = useState('');

  if (!authModalOpen) return null;

  const handleFastLogin = (roleKey) => {
    const user = fastLogin(roleKey);
    setAuthModalOpen(false);
    if (onTabChange) {
      if (roleKey === 'admin') onTabChange('admin');
      else if (roleKey === 'rescue_team') onTabChange('rescue');
      else onTabChange('landing');
    }
  };

  const handleManualLogin = (e) => {
    e.preventDefault();
    setError('');

    // Check against preset emails or generate custom session
    let matchedUser = Object.values(PRESET_USERS).find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!matchedUser) {
      // Create user session based on chosen role
      matchedUser = {
        email: email || `${selectedRole}@rokkha.org`,
        role: selectedRole,
        name: email.split('@')[0] || `${selectedRole.toUpperCase()} User`,
        title: selectedRole === 'admin' ? 'Authorized System Admin' : selectedRole === 'rescue_team' ? 'Emergency Responder' : 'Verified Resident',
        badge: selectedRole.toUpperCase()
      };
    }

    setCurrentUser(matchedUser);
    setAuthModalOpen(false);

    if (onTabChange) {
      if (matchedUser.role === 'admin') onTabChange('admin');
      else if (matchedUser.role === 'rescue_team') onTabChange('rescue');
      else onTabChange('landing');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Shield size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Rokkha Sign In</h3>
              <p className="text-[11px] text-slate-400">Access protected emergency panels & updates</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setAuthModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Quick 1-Click Fast Login Cards */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                <Zap size={13} /> 1-Click Fast Login
              </span>
              <span className="text-[10px] text-slate-500">Instant Demo Auth</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Citizen */}
              <button
                type="button"
                onClick={() => handleFastLogin('citizen')}
                className="flex flex-col items-start p-3 rounded-xl bg-slate-800/80 hover:bg-emerald-950/50 border border-slate-700 hover:border-emerald-500/50 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="p-1.5 rounded-md bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
                    <User size={15} />
                  </div>
                  <span className="text-[9px] font-bold text-emerald-400 uppercase">Public</span>
                </div>
                <div className="font-bold text-xs text-slate-100 group-hover:text-emerald-300">Citizen</div>
                <div className="text-[10px] text-slate-400 line-clamp-1">Rahim (Resident)</div>
              </button>

              {/* Rescue Team */}
              <button
                type="button"
                onClick={() => handleFastLogin('rescue_team')}
                className="flex flex-col items-start p-3 rounded-xl bg-slate-800/80 hover:bg-amber-950/50 border border-slate-700 hover:border-amber-500/50 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="p-1.5 rounded-md bg-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform">
                    <LifeBuoy size={15} />
                  </div>
                  <span className="text-[9px] font-bold text-amber-400 uppercase">Field Ops</span>
                </div>
                <div className="font-bold text-xs text-slate-100 group-hover:text-amber-300">Rescue Team</div>
                <div className="text-[10px] text-slate-400 line-clamp-1">Capt. Farhan</div>
              </button>

              {/* Admin */}
              <button
                type="button"
                onClick={() => handleFastLogin('admin')}
                className="flex flex-col items-start p-3 rounded-xl bg-slate-800/80 hover:bg-rose-950/50 border border-slate-700 hover:border-rose-500/50 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="p-1.5 rounded-md bg-rose-500/20 text-rose-400 group-hover:scale-110 transition-transform">
                    <Shield size={15} />
                  </div>
                  <span className="text-[9px] font-bold text-rose-400 uppercase">Admin</span>
                </div>
                <div className="font-bold text-xs text-slate-100 group-hover:text-rose-300">Admin</div>
                <div className="text-[10px] text-slate-400 line-clamp-1">Dr. Nasreen</div>
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[11px] text-slate-500 uppercase font-semibold absolute">
              Or Sign In with Email
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Role Type</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'citizen', label: 'Citizen', icon: User },
                  { id: 'rescue_team', label: 'Rescue Squad', icon: LifeBuoy },
                  { id: 'admin', label: 'Admin', icon: Shield }
                ].map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRole(r.id)}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                      selectedRole === r.id
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <r.icon size={13} />
                    <span>{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`${selectedRole}@rokkha.org`}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              Sign In to Panel <ArrowRight size={14} />
            </button>
          </form>

        </div>

      </div>
    </div>
  );
}

