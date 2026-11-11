import React, { useState, useEffect } from 'react';
import { 
  CloudRain, 
  MapPin, 
  CheckSquare, 
  ShieldAlert, 
  Ruler, 
  Layers, 
  Building2, 
  DownloadCloud, 
  Waves, 
  Cpu, 
  Crosshair, 
  Bell, 
  Shield, 
  ExternalLink, 
  ChevronRight, 
  ArrowLeft,
  LayoutGrid,
  SlidersHorizontal,
  Home,
  LifeBuoy
} from 'lucide-react';

import { checkBackendHealth } from './services/apiClient';
import LandingPage from './landing-page/LandingPage';
import FeatureModulesCatalog from './features-catalog/FeatureModulesCatalog';
import AdminPanel from './panels/AdminPanel';
import RescuePanel from './panels/RescuePanel';
import FastLoginBar from './components/FastLoginBar';
import AuthModal from './auth/AuthModal';
import { AppProvider, useApp } from './context/AppContext';
import { Button } from './components/ui/button';

// Import all 12 feature components from Frontend/feature
import WeatherObservations from '../feature/Weather observations/WeatherObservations';
import LocationManagement from '../feature/Location management/LocationManagement';
import GeoJSONValidation from '../feature/GeoJSON validation/GeoJSONValidation';
import PointInPolygon from '../feature/Point-in-Polygon/PointInPolygon';
import GeographicDistance from '../feature/Geographic distance/GeographicDistance';
import GeographicZones from '../feature/Geographic zones/GeographicZones';
import AssetManagement from '../feature/Asset management/AssetManagement';
import WeatherIngestion from '../feature/Weather ingestion/WeatherIngestion';
import RiverMonitoring from '../feature/River monitoring/RiverMonitoring';
import FloodPrediction from '../feature/Flood prediction/FloodPrediction';
import AssetExposure from '../feature/Asset exposure/AssetExposure';
import AlertsFeature from '../feature/Alerts/AlertsFeature';

const FEATURES_CONFIG = [
  {
    id: 'weather-observations',
    name: 'Weather observations',
    purpose: 'Record weather measurements',
    status: 'Implemented',
    badgeType: 'emerald',
    icon: CloudRain,
    component: WeatherObservations
  },
  {
    id: 'location-management',
    name: 'Location management',
    purpose: 'Store geographic locations',
    status: 'Implemented',
    badgeType: 'emerald',
    icon: MapPin,
    component: LocationManagement
  },
  {
    id: 'geojson-validation',
    name: 'GeoJSON validation',
    purpose: 'Validate geographic inputs',
    status: 'Implemented',
    badgeType: 'emerald',
    icon: CheckSquare,
    component: GeoJSONValidation
  },
  {
    id: 'point-in-polygon',
    name: 'Point-in-Polygon',
    purpose: 'Determine geographic containment',
    status: 'Implemented',
    badgeType: 'emerald',
    icon: ShieldAlert,
    component: PointInPolygon
  },
  {
    id: 'geographic-distance',
    name: 'Geographic distance',
    purpose: 'Calculate real-world distances',
    status: 'Milestone',
    badgeType: 'blue',
    icon: Ruler,
    component: GeographicDistance
  },
  {
    id: 'geographic-zones',
    name: 'Geographic zones',
    purpose: 'Represent flood-risk areas',
    status: 'Planned',
    badgeType: 'amber',
    icon: Layers,
    component: GeographicZones
  },
  {
    id: 'asset-management',
    name: 'Asset management',
    purpose: 'Register protected assets',
    status: 'Planned',
    badgeType: 'amber',
    icon: Building2,
    component: AssetManagement
  },
  {
    id: 'weather-ingestion',
    name: 'Weather ingestion',
    purpose: 'Collect external weather data',
    status: 'Planned',
    badgeType: 'amber',
    icon: DownloadCloud,
    component: WeatherIngestion
  },
  {
    id: 'river-monitoring',
    name: 'River monitoring',
    purpose: 'Monitor water levels',
    status: 'Planned',
    badgeType: 'amber',
    icon: Waves,
    component: RiverMonitoring
  },
  {
    id: 'flood-prediction',
    name: 'Flood prediction',
    purpose: 'Forecast localized flood probability',
    status: 'Planned',
    badgeType: 'amber',
    icon: Cpu,
    component: FloodPrediction
  },
  {
    id: 'asset-exposure',
    name: 'Asset exposure',
    purpose: 'Identify assets exposed to flooding',
    status: 'Planned',
    badgeType: 'amber',
    icon: Crosshair,
    component: AssetExposure
  },
  {
    id: 'alerts',
    name: 'Alerts',
    purpose: 'Notify users of potential danger',
    status: 'Planned',
    badgeType: 'amber',
    icon: Bell,
    component: AlertsFeature
  }
];

function MainAppContent() {
  const { currentUser, setAuthModalOpen, fastLogin } = useApp();

  const getInitialTab = () => {
    if (typeof window === 'undefined') return 'landing';
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (hash === 'admin') return 'admin';
    if (hash === 'rescue') return 'rescue';
    if (hash === 'catalog') return 'catalog';
    if (hash === 'console') return 'console';
    return 'landing';
  };

  const [activeTab, setActiveTabState] = useState(getInitialTab);

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      window.location.hash = tab === 'landing' ? '' : `#${tab}`;
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const newTab = getInitialTab();
      setActiveTabState(newTab);
      // Auto-set matching demo user if not already set
      if (newTab === 'admin' && !currentUser) fastLogin('admin');
      if (newTab === 'rescue' && !currentUser) fastLogin('rescue_team');
    };
    window.addEventListener('hashchange', handleHashChange);
    // Initial check on load
    const initial = getInitialTab();
    if (initial === 'admin' && !currentUser) fastLogin('admin');
    if (initial === 'rescue' && !currentUser) fastLogin('rescue_team');

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [activeFeatureId, setActiveFeatureId] = useState('weather-observations');
  const [backendHealth, setBackendHealth] = useState({ status: 'checking' });

  useEffect(() => {
    const check = async () => {
      const res = await checkBackendHealth();
      setBackendHealth(res);
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeFeature = FEATURES_CONFIG.find(f => f.id === activeFeatureId) || FEATURES_CONFIG[0];
  const ActiveComponent = activeFeature.component;

  const handleLaunchFeature = (featureId) => {
    setActiveFeatureId(featureId);
    setActiveTab('console');
  };

  const handleRescueDockClick = () => {
    if (!currentUser || (currentUser.role !== 'rescue_team' && currentUser.role !== 'admin')) {
      setActiveTab('rescue');
    } else {
      setActiveTab('rescue');
    }
  };

  const handleAdminDockClick = () => {
    if (!currentUser || currentUser.role !== 'admin') {
      setActiveTab('admin');
    } else {
      setActiveTab('admin');
    }
  };

  // Floating Multi-Page Switcher Dock with fast role and module jumps
  const PageSwitcherDock = () => (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 p-2 rounded-2xl shadow-[0_10px_35px_rgba(6,182,212,0.3)]">
      {/* 1. Public / Citizen Landing */}
      <button
        onClick={() => setActiveTab('landing')}
        title="Public Citizen Portal (Early Warnings)"
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
          activeTab === 'landing'
            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30 font-bold'
            : 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800'
        }`}
      >
        <Home size={17} />
      </button>

      {/* 2. Rescue Operations Console */}
      <button
        onClick={handleRescueDockClick}
        title="Rescue Team Operations Console"
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
          activeTab === 'rescue'
            ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/30'
            : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
        }`}
      >
        <LifeBuoy size={17} />
      </button>

      {/* 3. Admin News & Control Hub */}
      <button
        onClick={handleAdminDockClick}
        title="Disaster News Admin Hub"
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
          activeTab === 'admin'
            ? 'bg-rose-500 text-white font-bold shadow-lg shadow-rose-500/30'
            : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
        }`}
      >
        <Shield size={17} />
      </button>

      <div className="w-[1px] h-6 bg-slate-700/80 mx-1" />

      {/* 4. Feature Modules Catalog */}
      <button
        onClick={() => setActiveTab('catalog')}
        title="Rokkha Core Engine Modules"
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
          activeTab === 'catalog'
            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-200'
            : 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800'
        }`}
      >
        <LayoutGrid size={17} />
      </button>

      {/* 5. Live Sandbox Console */}
      <button
        onClick={() => setActiveTab('console')}
        title="Live Modules Sandbox"
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
          activeTab === 'console'
            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-200'
            : 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800'
        }`}
      >
        <SlidersHorizontal size={17} />
      </button>
    </div>
  );

  return (
    <>
      <AuthModal onTabChange={setActiveTab} />

      {/* View 1: Public Citizen Early Warnings Landing Page */}
      {activeTab === 'landing' && (
        <>
          <FastLoginBar onTabChange={setActiveTab} activeTab="landing" />
          <LandingPage 
            onOpenConsole={() => setActiveTab('catalog')} 
            onTabChange={setActiveTab} 
          />
          <PageSwitcherDock />
        </>
      )}

      {/* View 2: Rescue Team Operations Panel */}
      {activeTab === 'rescue' && (
        <RescuePanel onTabChange={setActiveTab} />
      )}

      {/* View 3: Disaster Admin News & Control Panel */}
      {activeTab === 'admin' && (
        <AdminPanel onTabChange={setActiveTab} />
      )}

      {/* View 4: Feature Modules Catalog */}
      {activeTab === 'catalog' && (
        <>
          <FastLoginBar onTabChange={setActiveTab} activeTab="catalog" />
          <FeatureModulesCatalog 
            onSelectFeature={handleLaunchFeature} 
            onBackToLanding={() => setActiveTab('landing')}
          />
          <PageSwitcherDock />
        </>
      )}

      {/* View 5: Live Sandbox Console */}
      {activeTab === 'console' && (
        <div className="min-h-screen bg-[#f0f9ff] text-slate-800 flex flex-col font-sans">
          <FastLoginBar onTabChange={setActiveTab} activeTab="console" />

          {/* Top Header Navbar */}
          <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-cyan-100 px-6 sm:px-10 h-[72px] flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3.5">
              <div 
                onClick={() => setActiveTab('catalog')}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 18px rgba(6,182,212,0.45)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <Shield size={26} fill="currentColor" fillOpacity={0.2} />
              </div>
              <div className="flex items-baseline gap-2.5">
                <span 
                  onClick={() => setActiveTab('catalog')}
                  style={{
                    fontSize: '30px',
                    fontWeight: 900,
                    letterSpacing: '-0.01em',
                    color: '#0f172a',
                    lineHeight: 1,
                    cursor: 'pointer'
                  }}
                >
                  Rokkha
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 font-bold hidden sm:inline-block">
                  Live Sandbox
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2">
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('catalog')}
                className="text-xs flex items-center gap-1.5 border-cyan-300 text-cyan-800 hover:bg-cyan-50 hover:text-cyan-900 font-semibold"
              >
                <LayoutGrid size={13} /> Catalog
              </Button>

              <Button 
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('landing')}
                className="text-xs flex items-center gap-1.5 text-slate-500 hover:text-slate-900"
              >
                <Home size={13} /> Citizen View
              </Button>
            </div>
          </header>

          {/* Main Console Layout */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left Sidebar Feature Directory */}
            <aside className="w-80 bg-white border-r border-slate-200 p-4 space-y-2 overflow-y-auto hidden md:block">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  12 Core Modules
                </span>
                <span className="text-[10px] text-cyan-700 font-bold px-2 py-0.5 rounded bg-cyan-50 border border-cyan-200">
                  ACTIVE
                </span>
              </div>

              <div className="space-y-1">
                {FEATURES_CONFIG.map((feat, index) => {
                  const Icon = feat.icon;
                  const isSelected = feat.id === activeFeatureId;

                  return (
                    <button
                      key={feat.id}
                      onClick={() => setActiveFeatureId(feat.id)}
                      className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left text-xs transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-cyan-50 border border-cyan-300 text-cyan-950 font-bold shadow-sm' 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{index + 1}. {feat.name}</div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">{feat.purpose}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Center Workspace Content */}
            <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-5xl mx-auto w-full">
              <div className="mb-4 flex items-center justify-between">
                <button 
                  onClick={() => setActiveTab('catalog')} 
                  className="inline-flex items-center gap-1.5 text-xs text-cyan-700 hover:text-cyan-900 font-bold cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back to Modules Catalog
                </button>
              </div>

              <ActiveComponent />
            </main>
          </div>
          <PageSwitcherDock />
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
