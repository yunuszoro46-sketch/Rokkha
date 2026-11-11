import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Shield, 
  LayoutDashboard,
  Map as MapIcon,
  Building2, 
  FileText, 
  AlertTriangle, 
  Cpu, 
  Search, 
  Bell, 
  Plus, 
  PlusCircle, 
  Trash2, 
  CheckCircle2, 
  ArrowUpRight, 
  Clock, 
  Waves, 
  Droplets, 
  TrendingUp, 
  Sliders, 
  Radio, 
  Send,
  Zap,
  Check,
  ExternalLink,
  ChevronRight,
  Flame,
  Target,
  Filter,
  ArrowDownRight,
  Calendar,
  Activity,
  Wind
} from 'lucide-react';
import FastLoginBar from '../components/FastLoginBar';
import InteractiveFloodMap from '../components/InteractiveFloodMap';
import { fetchAssetExposureSummary, fetchPredictions } from '../services/apiClient';

// ==========================================
// 1. 2D Flood Modeling Area Wave SVG Card
// ==========================================
function TwoDFloodModelingCard() {
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-md transition-all flex flex-col justify-between h-full">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Hydrodynamic Simulation
          </span>
          <h4 className="font-extrabold text-xs text-slate-900 tracking-tight flex items-center gap-1.5 mt-0.5">
            <Waves size={14} className="text-sky-500" />
            2D Flood Modeling
          </h4>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 border border-sky-100">
          Simulation
        </span>
      </div>

      {/* Dynamic 2D Flood Wave SVG Area Chart matching reference */}
      <div className="w-full flex-1 min-h-[120px] max-h-[140px] relative my-1 flex items-center justify-center">
        <svg viewBox="0 0 240 120" className="w-full h-full overflow-visible">
          <defs>
            {/* Flood A Blue Gradient */}
            <linearGradient id="floodAGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.05" />
            </linearGradient>
            {/* Flood B Coral/Red Gradient */}
            <linearGradient id="floodBGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#fda4af" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Background vertical dashed grid lines */}
          {[20, 60, 100, 140, 180, 220].map(x => (
            <line key={x} x1={x} y1="10" x2={x} y2="110" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
          ))}

          {/* Flood A Area (Blue Curve) */}
          <path
            d="M 0 110 Q 30 40, 60 55 T 120 30 T 180 50 T 240 40 L 240 110 L 0 110 Z"
            fill="url(#floodAGrad)"
          />
          <path
            d="M 0 110 Q 30 40, 60 55 T 120 30 T 180 50 T 240 40"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Flood B Area (Coral Curve) */}
          <path
            d="M 0 110 Q 35 70, 70 80 T 130 65 T 190 75 T 240 85 L 240 110 L 0 110 Z"
            fill="url(#floodBGrad)"
          />
          <path
            d="M 0 110 Q 35 70, 70 80 T 130 65 T 190 75 T 240 85"
            fill="none"
            stroke="#f43f5e"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Data point dots */}
          <circle cx="120" cy="30" r="3.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="130" cy="65" r="3.5" fill="#f43f5e" stroke="#ffffff" strokeWidth="1.5" />
        </svg>
      </div>

      {/* Numerical Quick Stats */}
      <div className="grid grid-cols-2 gap-2 py-1 px-2 bg-slate-50 rounded-xl text-[10px] mb-1">
        <div>
          <span className="text-slate-400 block font-semibold text-[9px]">Discharge</span>
          <span className="font-extrabold text-blue-600">1,420 m³/s</span>
        </div>
        <div>
          <span className="text-slate-400 block font-semibold text-[9px]">Backflow</span>
          <span className="font-extrabold text-rose-500">0.85 m</span>
        </div>
      </div>

      {/* Legend & Calibration Footer */}
      <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-100 text-slate-500">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1 font-semibold text-slate-700 text-[10px]">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Flood A
          </span>
          <span className="flex items-center gap-1 font-semibold text-slate-700 text-[10px]">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Flood B
          </span>
        </div>
        <span className="font-mono text-[9px] text-slate-400 font-bold">SWMM-2D</span>
      </div>
    </div>
  );
}

// ==========================================
// 2. Radial Gauge Arc Card: "Flood Risk Index"
// ==========================================
function RadialFloodRiskCard() {
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-md transition-all flex flex-col justify-between h-full">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Telemetry Control
          </span>
          <h4 className="font-extrabold text-xs text-slate-900 tracking-tight flex items-center gap-1.5 mt-0.5">
            <Wind size={14} className="text-emerald-500" />
            Inundation Risk Control
          </h4>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
          Optimal
        </span>
      </div>

      {/* Calibrated Radial Semi-Circle Gauge SVG */}
      <div className="w-full flex-1 min-h-[110px] max-h-[130px] flex items-center justify-center relative my-1">
        <svg viewBox="0 0 160 100" className="w-36 h-24 overflow-visible">
          {/* Background Arc Ticks */}
          {Array.from({ length: 28 }).map((_, i) => {
            const angle = 180 + (i * 180) / 27;
            const rad = (angle * Math.PI) / 180;
            const x1 = 80 + 55 * Math.cos(rad);
            const y1 = 85 + 55 * Math.sin(rad);
            const x2 = 80 + 68 * Math.cos(rad);
            const y2 = 85 + 68 * Math.sin(rad);
            const isActive = i <= 21; // ~78% filled
            const strokeColor = i < 15 ? '#10b981' : i < 22 ? '#0ea5e9' : '#cbd5e1';
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isActive ? strokeColor : '#e2e8f0'}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            );
          })}

          {/* Center icon badge */}
          <circle cx="80" cy="85" r="16" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1.5" />
          <path
            d="M74 85 Q77 82 80 85 T86 85"
            fill="none"
            stroke="#059669"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M72 88 Q76 86 80 88 T88 88"
            fill="none"
            stroke="#059669"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="text-center pt-1 border-t border-slate-100">
        <div className="flex items-baseline justify-center gap-1.5">
          <span className="font-extrabold text-sm text-slate-900">Controlled</span>
          <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">78%</span>
        </div>
        <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
          Retention gates active in Eastern Dhaka.
        </p>
      </div>
    </div>
  );
}

// ==========================================
// 3. Stacked SWMM Drainage Capacity Chart
// ==========================================
function StackedDrainageChart() {
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-md transition-all flex flex-col justify-between h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Drainage &amp; Storage Volume
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-black text-slate-900 tracking-tight">9,257.5 k-m³</span>
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-0.5 border border-emerald-100">
              <ArrowUpRight size={12} /> 15.8% (+143.5 k-m³)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] shrink-0">
          <button
            type="button"
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white text-slate-600 font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            <Filter size={11} /> Filter
          </button>
          <button
            type="button"
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white text-slate-600 font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            <Sliders size={11} /> Sort
          </button>
        </div>
      </div>

      {/* Multi-Tier Stacked Bar Visual with Connecting Fluid Ribbons */}
      <div className="w-full flex-1 min-h-[140px] max-h-[160px] my-1 relative flex items-center justify-center">
        <svg viewBox="0 0 340 160" className="w-full h-full overflow-visible">
          {/* Fluid Bezier Ribbons Connecting Oct to Nov to Dec */}
          <path
            d="M 70 60 C 110 60, 130 90, 170 90 L 170 145 C 130 145, 110 145, 70 145 Z"
            fill="#e0f2fe"
            opacity="0.5"
          />
          <path
            d="M 170 90 C 210 90, 230 40, 270 40 L 270 145 C 230 145, 210 145, 170 145 Z"
            fill="#e0e7ff"
            opacity="0.4"
          />

          {/* Stack 1: October (2,988 k-m³) */}
          <g transform="translate(45, 0)">
            <text x="25" y="45" textAnchor="middle" className="text-[9px] font-bold fill-slate-500">2,988 k-m³</text>
            <rect x="5" y="55" width="40" height="15" rx="4" fill="#38bdf8" />
            <rect x="5" y="73" width="40" height="15" rx="4" fill="#0284c7" />
            <rect x="5" y="91" width="40" height="18" rx="4" fill="#6366f1" />
            <rect x="5" y="112" width="40" height="30" rx="6" fill="#4338ca" />
            <text x="25" y="155" textAnchor="middle" className="text-[10px] font-bold fill-slate-400">Oct</text>
          </g>

          {/* Stack 2: November (1,765 k-m³) */}
          <g transform="translate(145, 0)">
            <text x="25" y="78" textAnchor="middle" className="text-[9px] font-bold fill-slate-500">1,765 k-m³</text>
            <rect x="5" y="88" width="40" height="12" rx="4" fill="#38bdf8" />
            <rect x="5" y="103" width="40" height="14" rx="4" fill="#0284c7" />
            <rect x="5" y="120" width="40" height="22" rx="6" fill="#4338ca" />
            <text x="25" y="155" textAnchor="middle" className="text-[10px] font-bold fill-slate-400">Nov</text>
          </g>

          {/* Stack 3: December (4,006 k-m³) */}
          <g transform="translate(245, 0)">
            <text x="25" y="28" textAnchor="middle" className="text-[9px] font-bold fill-slate-500">4,006 k-m³</text>
            <rect x="5" y="38" width="40" height="16" rx="4" fill="#38bdf8" />
            <rect x="5" y="57" width="40" height="18" rx="4" fill="#0284c7" />
            <rect x="5" y="78" width="40" height="20" rx="4" fill="#6366f1" />
            <rect x="5" y="101" width="40" height="41" rx="6" fill="#4338ca" />
            <text x="25" y="155" textAnchor="middle" className="text-[10px] font-bold fill-slate-400">Dec</text>
          </g>
        </svg>
      </div>

      {/* Channel Color Legend */}
      <div className="flex items-center justify-center gap-3 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex-wrap">
        <span className="flex items-center gap-1 font-semibold text-slate-700">
          <span className="w-2 h-2 rounded-sm bg-sky-400" /> Buriganga
        </span>
        <span className="flex items-center gap-1 font-semibold text-slate-700">
          <span className="w-2 h-2 rounded-sm bg-sky-600" /> Turag
        </span>
        <span className="flex items-center gap-1 font-semibold text-slate-700">
          <span className="w-2 h-2 rounded-sm bg-indigo-500" /> Balu
        </span>
        <span className="flex items-center gap-1 font-semibold text-slate-700">
          <span className="w-2 h-2 rounded-sm bg-indigo-800" /> Sluice
        </span>
      </div>
    </div>
  );
}

// ==========================================
// 4. Weekly Precipitation & Alerts Chart
// ==========================================
function WeeklyPrecipitationCard() {
  const weeklyData = [
    { day: 'Sun', val: 40, active: false },
    { day: 'Mon', val: 55, active: false },
    { day: 'Tue', val: 95, active: true, label: '3,874' },
    { day: 'Wed', val: 35, active: false },
    { day: 'Thu', val: 65, active: false },
    { day: 'Fri', val: 30, active: false },
    { day: 'Sat', val: 50, active: false }
  ];

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-md transition-all flex flex-col justify-between h-full">
      <div className="pb-2 border-b border-slate-100">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Total Alerts &amp; Rainfall Accumulation
        </span>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-xl font-black text-slate-900 tracking-tight">24,473</span>
          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-0.5 border border-emerald-100">
            <ArrowUpRight size={12} /> 8.3% (+749 today)
          </span>
        </div>
      </div>

      {/* Bar Chart with Highlighted Tuesday */}
      <div className="w-full flex-1 min-h-[140px] max-h-[160px] flex items-end justify-between gap-2 my-2 px-1">
        {weeklyData.map(d => (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
            {d.active && (
              <span className="text-[9px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 py-0.5 rounded shadow-2xs">
                {d.label}
              </span>
            )}
            <div
              className={`w-full rounded-md transition-all cursor-pointer ${
                d.active
                  ? 'bg-gradient-to-t from-indigo-600 to-blue-500 shadow-md shadow-indigo-500/20'
                  : 'bg-slate-100 hover:bg-slate-200'
              }`}
              style={{ height: `${d.val}%` }}
              title={`${d.day}: ${d.val}% intensity`}
            />
            <span className={`text-[10px] font-bold ${d.active ? 'text-indigo-700' : 'text-slate-400'}`}>
              {d.day}
            </span>
          </div>
        ))}
      </div>

      <div className="text-[10px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100">
        <span>7-Day Monsoon Window</span>
        <span className="text-indigo-600 font-bold">Peak Alert on Tuesday</span>
      </div>
    </div>
  );
}

// ==========================================
// MAIN COMPONENT: GeoSWMM Admin Dashboard
// ==========================================
export default function AdminPanel({ onTabChange }) {
  const { 
    currentUser, 
    news, 
    addNews, 
    deleteNews, 
    citizenReports, 
    validateCitizenReport 
  } = useApp();

  const [navTab, setNavTab] = useState('dashboard');
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' | 'map'
  const [dateFilter, setDateFilter] = useState('Oct 18 - Nov 18');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCoord, setSelectedCoord] = useState({ lat: 23.7058, lng: 90.4106 });

  // Registered assets fallback
  const registeredAssets = [
    { id: 1, name: 'Sadarghat Flood Shelter #1', type: 'flood_shelter', capacity: 1200, lat: 23.7058, lng: 90.4106 },
    { id: 2, name: 'Dhaka Medical Evacuation Hospital', type: 'hospital', capacity: 450, lat: 23.7258, lng: 90.3975 },
    { id: 3, name: 'Demra Rapid Rescue Boat Station', type: 'boat', capacity: 18, lat: 23.7121, lng: 90.5050 }
  ];

  return (
    <div className="h-screen w-full bg-[#f8fafc] text-slate-800 flex flex-col font-sans overflow-hidden selection:bg-sky-500 selection:text-white">
      
      {/* Universal Fast Role Switcher */}
      <FastLoginBar onTabChange={onTabChange} activeTab="admin" />

      {/* Main Layout Container: Left Sidebar + Center Dashboard */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* ================= 1. LEFT SIDEBAR (GeoSWMM Inspired White Aesthetic) ================= */}
        <aside className="w-56 lg:w-60 bg-white border-r border-slate-200/80 flex flex-col justify-between p-4 shadow-sm hidden md:flex shrink-0">
          <div className="space-y-6">
            
            {/* Logo Brand Header */}
            <div className="flex items-center gap-3 px-1 py-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20 font-bold shrink-0">
                <Waves size={20} />
              </div>
              <div>
                <h1 className="font-black text-lg text-slate-900 tracking-tight leading-none">
                  Rok<span className="text-teal-600">ka</span>
                </h1>
                <span className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase mt-1 block">
                  Urban Flood Ops
                </span>
              </div>
            </div>

            {/* Navigation Menu */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">
                GENERAL
              </span>

              {[
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'map', label: 'Risk Map & GIS', icon: MapIcon, badge: 'LIVE' },
                { id: 'assets', label: 'Critical Assets', icon: Building2, count: 14 },
                { id: 'bulletins', label: 'Flood Bulletins', icon: FileText, count: news.length },
                { id: 'reports', label: 'Citizen Reports', icon: AlertTriangle, count: citizenReports.length, alert: true },
                { id: 'ml', label: 'ML Forecasting', icon: Cpu, badge: 'v0.5.0' },
              ].map(item => {
                const Icon = item.icon;
                const isActive = navTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setNavTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer text-xs font-semibold ${
                      isActive
                        ? 'bg-slate-900 text-white font-bold shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon size={15} className={isActive ? 'text-white' : 'text-slate-400'} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                        isActive ? 'bg-white/20 text-white' : 'bg-teal-50 text-teal-700 border border-teal-200'
                      }`}>
                        {item.badge}
                      </span>
                    )}

                    {item.count !== undefined && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        item.alert
                          ? (isActive ? 'bg-white text-rose-600' : 'bg-rose-100 text-rose-600')
                          : (isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600')
                      }`}>
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Sidebar Card: 2D Modeling Status */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-[11px]">2D Engine Status</span>
              <span className="text-emerald-600 font-extrabold text-[9px] px-1.5 py-0.5 rounded bg-emerald-100">
                ACTIVE
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-snug">
              Saint-Venant hydrodynamic equations solving across Dhaka basins.
            </p>
          </div>
        </aside>

        {/* ================= 2. MAIN BROWSER-CHROME DASHBOARD ================= */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          
          {/* Top Browser Chrome Bar matching GeoSWMM mockup */}
          <header className="bg-white border-b border-slate-200/90 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
            
            {/* Search Input with ⌘+F shortcut */}
            <div className="relative w-64 sm:w-80">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search telemetry, basins, assets..."
                className="w-full bg-slate-50 border border-slate-200/90 rounded-xl pl-9 pr-11 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 px-1 py-0.5 rounded shadow-2xs pointer-events-none">
                ⌘F
              </span>
            </div>

            {/* Header Right Actions: Date Picker & Filter Buttons */}
            <div className="flex items-center gap-2.5 shrink-0">
              
              {/* Date Range Selector */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1 whitespace-nowrap shrink-0">
                <Calendar size={13} className="text-slate-400 shrink-0" />
                <span className="font-semibold text-[11px] whitespace-nowrap">{dateFilter}</span>
              </div>

              {/* Interval Pill */}
              <select className="bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1 text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer shrink-0">
                <option>Monthly</option>
                <option>Weekly</option>
                <option>Daily Live</option>
              </select>

              {/* Notification & User Profile */}
              <button
                type="button"
                className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                title="Telemetry Notifications"
              >
                <Bell size={15} />
              </button>

              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                M
              </div>
            </div>
          </header>

          {/* Subheader: "Dashboard" Title & View Switcher */}
          <div className="px-5 py-2 bg-white border-b border-slate-200/70 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">
                {navTab === 'dashboard' ? 'Urban Flood Management Dashboard' : navTab === 'map' ? 'FFWC River Basin GIS Map' : 'System Administration'}
              </h2>
              <span className="text-[10px] text-slate-400">
                Climate-resilient stormwater simulation &amp; automated river telemetry
              </span>
            </div>

            {/* Switch between Analytics View and Full GIS Map View */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setNavTab('dashboard')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  navTab === 'dashboard'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                📊 Analytics &amp; 2D Models
              </button>
              <button
                type="button"
                onClick={() => setNavTab('map')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  navTab === 'map'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🌊 Interactive FFWC Map
              </button>
            </div>
          </div>

          {/* ================= 3. DASHBOARD MAIN WORKSPACE ================= */}
          <main className={`flex-1 min-h-0 bg-[#f8fafc] ${navTab === 'map' ? 'p-0 flex flex-col overflow-hidden relative' : 'p-4 sm:p-5 space-y-4 overflow-y-auto'}`}>

            {/* VIEW 1: GEOSWMM ANALYTICS & 2D FLOOD MODELS (Matching uploaded screenshot) */}
            {navTab === 'dashboard' && (
              <div className="space-y-4 max-w-[1600px] mx-auto">
                
                {/* TOP ROW: 3 MINIMALIST WHITE METRIC CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  
                  {/* Card 1: Monitored Inundation Area */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Protected Citizens &bull; Drainage
                      </span>
                      <span className="text-slate-400 text-xs">ⓘ</span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-2xl font-black text-slate-900 tracking-tight">12,450</span>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-0.5 border border-emerald-100">
                        <ArrowUpRight size={12} /> 15.8% ↗
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Buriganga Water Level */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        River Stage &bull; Buriganga
                      </span>
                      <span className="text-slate-400 text-xs">ⓘ</span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-2xl font-black text-slate-900 tracking-tight">5.70 m</span>
                      <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full flex items-center gap-0.5 border border-rose-100">
                        <ArrowDownRight size={12} /> 24.0% ↘
                      </span>
                    </div>
                  </div>

                  {/* Card 3: Stormwater Retention */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Runoff Retention Efficiency
                      </span>
                      <span className="text-slate-400 text-xs">ⓘ</span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-2xl font-black text-slate-900 tracking-tight">86.5%</span>
                      <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full flex items-center gap-0.5 border border-teal-100">
                        <ArrowUpRight size={12} /> 24.2% ↗
                      </span>
                    </div>
                  </div>

                </div>

                {/* MIDDLE ROW: 3 BALANCED EQUAL-HEIGHT CARDS */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
                  
                  {/* Left 4 Cols: 2D Flood Modeling Wave Chart */}
                  <div className="lg:col-span-4 min-h-[250px]">
                    <TwoDFloodModelingCard />
                  </div>

                  {/* Center 4 Cols: SWMM Stacked Drainage Capacity Chart */}
                  <div className="lg:col-span-4 min-h-[250px]">
                    <StackedDrainageChart />
                  </div>

                  {/* Right 4 Cols: Weekly Precipitation & Alerts */}
                  <div className="lg:col-span-4 min-h-[250px]">
                    <WeeklyPrecipitationCard />
                  </div>

                </div>

                {/* BOTTOM ROW: RADIAL GAUGE + OCEAN BANNER */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
                  
                  {/* Left 4 Cols: Calibrated Radial Risk Meter */}
                  <div className="lg:col-span-4 min-h-[140px]">
                    <RadialFloodRiskCard />
                  </div>

                  {/* Right 8 Cols: Ocean Waves Hero Banner */}
                  <div className="lg:col-span-8 min-h-[140px] rounded-2xl p-5 relative overflow-hidden bg-gradient-to-r from-teal-700 via-cyan-800 to-sky-900 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Fluid Wave SVG Background Overlay */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                      <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-full">
                        <path d="M0,0 C150,90 350,-40 500,45 C650,130 900,10 1200,50 L1200,120 L0,120 Z" fill="#ffffff" />
                      </svg>
                    </div>

                    <div className="relative z-10 space-y-1 text-center sm:text-left">
                      <div className="flex items-center justify-center sm:justify-start gap-2">
                        <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                        <h3 className="text-base font-extrabold tracking-tight text-white">
                          Rokka - A Smart Solution for Urban Flood Management
                        </h3>
                      </div>
                      <p className="text-xs text-sky-200/90 max-w-xl leading-relaxed">
                        Deploy 2D shallow water hydrodynamic modeling, real-time sluice gate actuation, and machine learning inundation prediction across all Dhaka wards.
                      </p>
                    </div>

                    <div className="relative z-10 flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setNavTab('map')}
                        className="px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/25 transition-all cursor-pointer whitespace-nowrap"
                      >
                        Open Live Map
                      </button>
                      <button
                        type="button"
                        onClick={() => setNavTab('ml')}
                        className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/25 transition-all cursor-pointer whitespace-nowrap"
                      >
                        ML Model Scorecard
                      </button>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* VIEW 2: INTERACTIVE FFWC RIVER BASIN GIS MAP (With 🔴🟡🟢 Signs) */}
            {navTab === 'map' && (
              <div className="flex-1 h-full min-h-0 w-full flex flex-col">
                <InteractiveFloodMap
                  mode="admin"
                  theme="ocean"
                  heightClass="h-full"
                  assets={registeredAssets}
                  selectedCoord={selectedCoord}
                  onSelectLocation={(coord) => setSelectedCoord(coord)}
                />
              </div>
            )}

            {/* VIEW 3: ASSET MANAGEMENT */}
            {navTab === 'assets' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="lg:col-span-5 space-y-3">
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <PlusCircle size={16} className="text-teal-600" />
                    Register Emergency Asset (POST /assets)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Assets are indexed with GeoJSON Point geometry in MongoDB for spatial proximity searches.
                  </p>
                  <form className="space-y-3 text-xs pt-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Asset Name</label>
                      <input type="text" placeholder="e.g. Keraniganj Flood Shelter" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Type</label>
                        <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold">
                          <option>Flood Shelter</option>
                          <option>Hospital / Medical</option>
                          <option>Rescue Boat Post</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Capacity</label>
                        <input type="number" placeholder="600" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2" />
                      </div>
                    </div>
                    <button type="button" className="w-full py-2 bg-slate-900 text-white rounded-xl font-bold cursor-pointer hover:bg-slate-800 transition-all">
                      Save &amp; Index Asset
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-7 border-l border-slate-100 pl-6 space-y-3">
                  <h3 className="font-extrabold text-sm text-slate-900">Registered Critical Facilities</h3>
                  <div className="space-y-2">
                    {registeredAssets.map(a => (
                      <div key={a.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                        <div>
                          <strong className="text-slate-900 block">{a.name}</strong>
                          <span className="text-[10px] text-slate-400 capitalize">{a.type.replace('_', ' ')} &bull; Capacity: {a.capacity}</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 4: FLOOD BULLETINS */}
            {navTab === 'bulletins' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <FileText size={16} className="text-teal-600" />
                    Official Flood Bulletins &amp; Public Warning Advisories
                  </h3>
                  <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                    {news.length} Bulletins Dispatched
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {news.map(n => (
                    <div key={n.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm">{n.title}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700">
                          {n.severity || 'Urgent'}
                        </span>
                      </div>
                      <p className="text-slate-600 leading-relaxed text-[11px]">{n.summary}</p>
                      <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <span>Issued by: Chief Controller</span>
                        <span>{n.timestamp || 'Live'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VIEW 5: CITIZEN REPORTS QUEUE */}
            {navTab === 'reports' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">Crowdsourced Waterlogging Submissions</h3>
                    <p className="text-xs text-slate-400">Validate citizen observations before broadcasting alerts</p>
                  </div>
                  <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100">
                    {citizenReports.length} Submissions
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {citizenReports.map(r => (
                    <div key={r.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2">
                      <div>
                        <div className="flex items-center justify-between">
                          <strong className="text-slate-900">{r.location}</strong>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            {r.status}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px] mt-1">"{r.description}"</p>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => validateCitizenReport(r.id, 'verified')}
                          className="flex-1 py-1 bg-emerald-600 text-white rounded font-bold text-[10px] cursor-pointer"
                        >
                          Verify &bull; Broadcast
                        </button>
                        <button
                          type="button"
                          onClick={() => validateCitizenReport(r.id, 'dismissed')}
                          className="flex-1 py-1 bg-slate-200 text-slate-700 rounded font-bold text-[10px] cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VIEW 6: ML FLOOD FORECASTING (XGBoost Model) */}
            {navTab === 'ml' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <Cpu size={16} className="text-teal-600" />
                      XGBoost 3.4.1 Flood Inundation Prediction Engine
                    </h3>
                    <p className="text-xs text-slate-400">
                      Trained on Sentinel-1 SAR GFM labels, GloFAS river discharge, and ERA5 precipitation
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                    ROC-AUC 0.936 &bull; PR-AUC 0.46
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 text-[10px] block font-bold uppercase">Algorithm</span>
                    <strong className="text-slate-900 text-sm">XGBoost Decision Trees</strong>
                    <p className="text-[10px] text-slate-500 mt-1">binary:logistic with isotonic calibration</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 text-[10px] block font-bold uppercase">Alert Thresholds</span>
                    <strong className="text-amber-600 text-sm">Watch: 18.2% | Alert: 37.5%</strong>
                    <p className="text-[10px] text-slate-500 mt-1">Calibrated on 2022 validation year</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 text-[10px] block font-bold uppercase">Covered Districts</span>
                    <strong className="text-slate-900 text-sm">64 Districts (Bangladesh)</strong>
                    <p className="text-[10px] text-slate-500 mt-1">21,165 district-days re-evaluated</p>
                  </div>
                </div>
              </div>
            )}

          </main>
        </div>

      </div>

    </div>
  );
}
