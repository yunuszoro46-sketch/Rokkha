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
  Home
} from 'lucide-react';

import { checkBackendHealth } from './services/apiClient';
import LandingPage from './landing-page/LandingPage';
import FeatureModulesCatalog from './features-catalog/FeatureModulesCatalog';
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

export default function App() {
  const [activeTab, setActiveTab] = useState('landing'); // 'landing' | 'catalog' | 'console'
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

  // Floating Multi-Page Switcher Dock — icons only
  const PageSwitcherDock = () => (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white/95 backdrop-blur-md border-2 border-cyan-400 p-2.5 rounded-2xl shadow-[0_8px_32px_rgba(6,182,212,0.25)]">
      <button
        onClick={() => setActiveTab('landing')}
        title="Landing Page"
        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
          activeTab === 'landing'
            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-200'
            : 'text-slate-400 hover:text-cyan-600 hover:bg-cyan-50'
        }`}
      >
        <Home size={17} />
      </button>
      <button
        onClick={() => setActiveTab('catalog')}
        title="Feature Catalog"
        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
          activeTab === 'catalog'
            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-200'
            : 'text-slate-400 hover:text-cyan-600 hover:bg-cyan-50'
        }`}
      >
        <LayoutGrid size={17} />
      </button>
      <button
        onClick={() => setActiveTab('console')}
        title="Live Sandbox"
        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
          activeTab === 'console'
            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-200'
            : 'text-slate-400 hover:text-cyan-600 hover:bg-cyan-50'
        }`}
      >
        <SlidersHorizontal size={17} />
      </button>
    </div>
  );

  // View 1: Landing Page
  if (activeTab === 'landing') {
    return (
      <>
        <LandingPage onOpenConsole={() => setActiveTab('catalog')} />
        <PageSwitcherDock />
      </>
    );
  }

  // View 2: Feature Modules Catalog (exact screenshot match: Rokkha Core Engine + 12 categories + interactive box)
  if (activeTab === 'catalog') {
    return (
      <>
        <FeatureModulesCatalog 
          onSelectFeature={handleLaunchFeature} 
          onBackToLanding={() => setActiveTab('landing')}
        />
        <PageSwitcherDock />
      </>
    );
  }

  // View 3: Live Sandbox Console for chosen feature
  return (
    <div className="min-h-screen bg-[#f0f9ff] text-slate-800 flex flex-col font-sans">
      {/* Top Header Navbar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-cyan-100 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div 
            onClick={() => setActiveTab('catalog')}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 cursor-pointer border border-cyan-300"
          >
            <Shield size={22} fill="currentColor" fillOpacity={0.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span 
                onClick={() => setActiveTab('catalog')}
                className="text-xl font-black tracking-tight text-slate-900 cursor-pointer"
              >
                Rokkha
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 font-bold hidden sm:inline-block">
                Live Sandbox
              </span>
            </div>
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
            <LayoutGrid size={13} /> Return to Catalog
          </Button>

          <Button 
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab('landing')}
            className="text-xs flex items-center gap-1.5 text-slate-500 hover:text-slate-900"
          >
            <Home size={13} /> Landing Page
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

          <ActiveComponent />
        </main>
      </div>
      <PageSwitcherDock />
    </div>
  );
}
