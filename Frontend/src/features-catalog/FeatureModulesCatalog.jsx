import React, { useState } from 'react';
import { 
  Search, 
  Sparkles, 
  Cloud, 
  Layers, 
  Shield, 
  Bell, 
  LayoutGrid,
  Code2,
  X,
  Play,
  Home
} from 'lucide-react';
import './catalog.css';

// 12 Pixel-Matched Cyan Glowing Icons matching uploaded screenshot
function IconWeatherObservations() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f2fe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <circle cx="18" cy="8" r="1.5" fill="#00f2fe" />
      <circle cx="12" cy="3" r="1.5" fill="#00f2fe" />
      <circle cx="6" cy="12" r="1.5" fill="#00f2fe" />
    </svg>
  );
}

function IconWeatherIngestion() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f2fe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      <polyline points="12 13 12 18" />
      <polyline points="9 16 12 13 15 16" />
    </svg>
  );
}

function IconRiverMonitoring() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f2fe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12c3-2 6-2 9 0s6 2 9 0" />
      <path d="M2 17c3-2 6-2 9 0s6 2 9 0" />
      <line x1="6" y1="4" x2="6" y2="10" />
      <line x1="4" y1="6" x2="8" y2="6" />
      <line x1="4" y1="8" x2="7" y2="8" />
    </svg>
  );
}

function IconLocationManagement() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f2fe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="3" />
      <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8Z" />
    </svg>
  );
}

function IconGeoJSONValidation() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f2fe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function IconPointInPolygon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f2fe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2.5" fill="#00f2fe" />
      <path d="m19 5-7 7-7-7" strokeDasharray="2 2" />
      <polygon points="12 2 22 8.5 18 21 6 21 2 8.5" />
    </svg>
  );
}

function IconGeographicDistance() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f2fe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="18" r="2.5" fill="#00f2fe" />
      <circle cx="18" cy="6" r="2.5" fill="#00f2fe" />
      <path d="m8 16 8-8" />
      <polyline points="12 6 18 6 18 12" />
    </svg>
  );
}

function IconGeographicZones() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f2fe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );
}

function IconAssetManagement() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f2fe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 20V12h6v8" />
      <line x1="4" y1="9" x2="20" y2="9" />
    </svg>
  );
}

function IconFloodPrediction() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f2fe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 15l3-3 3 2 4-5" />
      <circle cx="18" cy="9" r="1.5" fill="#00f2fe" />
    </svg>
  );
}

function IconAssetExposure() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f2fe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconAlerts() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f2fe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

const CATALOG_DATA = [
  {
    category: "Weather & Ingestion",
    icon: Cloud,
    features: [
      {
        id: "weather-observations",
        title: "Weather observations",
        desc: "Record weather measurements",
        status: "Implemented",
        icon: IconWeatherObservations
      },
      {
        id: "weather-ingestion",
        title: "Weather ingestion",
        desc: "Collect external weather data",
        status: "Planned",
        icon: IconWeatherIngestion
      },
      {
        id: "river-monitoring",
        title: "River monitoring",
        desc: "Monitor water levels",
        status: "Planned",
        icon: IconRiverMonitoring
      }
    ]
  },
  {
    category: "GIS & Spatial Engine",
    icon: Layers,
    features: [
      {
        id: "location-management",
        title: "Location management",
        desc: "Store geographic locations",
        status: "Implemented",
        icon: IconLocationManagement
      },
      {
        id: "geojson-validation",
        title: "GeoJSON validation",
        desc: "Validate geographic inputs",
        status: "Implemented",
        icon: IconGeoJSONValidation
      },
      {
        id: "point-in-polygon",
        title: "Point-in-Polygon",
        desc: "Determine geographic containment",
        status: "Implemented",
        icon: IconPointInPolygon
      },
      {
        id: "geographic-distance",
        title: "Geographic distance",
        desc: "Calculate real-world distances",
        status: "Milestone",
        icon: IconGeographicDistance
      },
      {
        id: "geographic-zones",
        title: "Geographic zones",
        desc: "Represent flood-risk areas",
        status: "Planned",
        icon: IconGeographicZones
      }
    ]
  },
  {
    category: "Risk & Protection",
    icon: Shield,
    features: [
      {
        id: "asset-management",
        title: "Asset management",
        desc: "Register protected assets",
        status: "Planned",
        icon: IconAssetManagement
      },
      {
        id: "flood-prediction",
        title: "Flood prediction",
        desc: "Forecast localized flood probability",
        status: "Planned",
        icon: IconFloodPrediction
      },
      {
        id: "asset-exposure",
        title: "Asset exposure",
        desc: "Identify assets exposed to flooding",
        status: "Planned",
        icon: IconAssetExposure
      }
    ]
  },
  {
    category: "Early Warning & Alerts",
    icon: Bell,
    features: [
      {
        id: "alerts",
        title: "Alerts",
        desc: "Notify users of potential danger",
        status: "Planned",
        icon: IconAlerts
      }
    ]
  }
];

export default function FeatureModulesCatalog({ onSelectFeature, onBackToLanding }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [activeSimulator, setActiveSimulator] = useState(false);
  const [boxLauncherOpen, setBoxLauncherOpen] = useState(false);
  const [simLog, setSimLog] = useState([
    "Initialising Rokkha Core Simulation Engine...",
    "FastAPI Local Host: http://127.0.0.1:8000 (Connected)",
    "Loaded 12 Core GIS & Environmental Telemetry Modules."
  ]);

  const triggerLiveSim = () => {
    setActiveSimulator(true);
    setSimLog(prev => [
      `[${new Date().toLocaleTimeString()}] Pipeline triggered: Stream ingestion -> Spatial Analysis -> Flood Risk Calc.`,
      `[${new Date().toLocaleTimeString()}] Dhaka Ward 11 precipitation threshold reached (62mm). Point-in-polygon containment verified.`,
      ...prev
    ]);
  };

  // Dynamic filter
  const filteredCatalog = CATALOG_DATA.map(sec => {
    const matching = sec.features.filter(f => {
      const matchSearch = f.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          f.desc.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = filterStatus === "all" || f.status.toLowerCase() === filterStatus.toLowerCase();
      return matchSearch && matchStatus;
    });
    return { ...sec, features: matching };
  }).filter(sec => sec.features.length > 0);

  return (
    <div className="rokkha-catalog-page">
      {/* Top Header Navbar - Using Rokkha Core Engine */}
      <nav className="rokkha-catalog-nav">
        <div className="rokkha-catalog-brand">
          {/* Same logo style as Landing Page */}
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 18px rgba(6,182,212,0.45)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.4)',
            flexShrink: 0
          }}>
            <Shield size={30} fill="currentColor" fillOpacity={0.2} />
          </div>
          <div>
            <div className="rokkha-catalog-brand-text">
              <span className="rokkha-catalog-brand-main">Rokkha</span>
              <span className="rokkha-catalog-brand-sub">Core Engine</span>
            </div>
            <span className="rokkha-catalog-sys-badge">INVENTORY SYSTEM</span>
          </div>
        </div>

        {/* Right Header Action Buttons */}
        <div className="rokkha-catalog-nav-actions">
          {onBackToLanding && (
            <button onClick={onBackToLanding} className="rokkha-btn-sim">
              <Home size={14} color="#38bdf8" /> Landing Page
            </button>
          )}

          <button onClick={() => setBoxLauncherOpen(true)} className="rokkha-btn-launcher">
            <LayoutGrid size={15} /> Box Launcher
          </button>

          <button onClick={triggerLiveSim} className="rokkha-btn-sim">
            <Code2 size={14} color="#38bdf8" /> &lt;/&gt; Live Simulator
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="rokkha-catalog-main">

        {/* Search By Type Section — replaces old banner */}
        <div className="rokkha-search-hero">
          <div className="rokkha-search-hero-left">
            <p className="rokkha-search-hero-label">Browse by type</p>
            <h2 className="rokkha-search-hero-title">Search Modules</h2>
            <div className="rokkha-search-hero-bar">
              <Search size={18} className="rokkha-search-hero-icon" />
              <input
                type="text"
                placeholder="Search by name, type or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rokkha-search-hero-input"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="rokkha-search-hero-clear">
                  <X size={15} />
                </button>
              )}
            </div>
            {/* Type filter chips */}
            <div className="rokkha-type-chips">
              {['all','implemented','milestone','planned'].map(type => (
                <button
                  key={type}
                  onClick={() => setFilterStatus(type)}
                  className={`rokkha-type-chip ${filterStatus === type ? 'active' : ''}`}
                >
                  {type === 'all' ? 'All (12)' : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {/* Right: clickable stat counters */}
          <div className="rokkha-stats-box">
            <button
              onClick={() => setFilterStatus(filterStatus === 'implemented' ? 'all' : 'implemented')}
              className={`rokkha-stat-btn ${filterStatus === 'implemented' ? 'active' : ''}`}
              title="Filter Implemented"
            >
              <div className="rokkha-stat-num emerald">4</div>
              <div className="rokkha-stat-caption">IMPLEMENTED</div>
            </button>
            <div className="rokkha-stat-divider" />
            <button
              onClick={() => setFilterStatus(filterStatus === 'milestone' ? 'all' : 'milestone')}
              className={`rokkha-stat-btn ${filterStatus === 'milestone' ? 'active' : ''}`}
              title="Filter Milestone"
            >
              <div className="rokkha-stat-num cyan">1</div>
              <div className="rokkha-stat-caption">MILESTONE</div>
            </button>
            <div className="rokkha-stat-divider" />
            <button
              onClick={() => setFilterStatus(filterStatus === 'planned' ? 'all' : 'planned')}
              className={`rokkha-stat-btn ${filterStatus === 'planned' ? 'active' : ''}`}
              title="Filter Planned"
            >
              <div className="rokkha-stat-num blue">7</div>
              <div className="rokkha-stat-caption">PLANNED</div>
            </button>
          </div>
        </div>

        {/* 4 Categorized Sections matching exact image */}
        {filteredCatalog.map((section, sIdx) => {
          const CatIcon = section.icon;

          return (
            <div key={sIdx} className="rokkha-section-block">
              <div className="rokkha-section-head">
                <div className="rokkha-section-title-wrap">
                  <div className="rokkha-section-icon">
                    <CatIcon size={16} />
                  </div>
                  <h2 className="rokkha-section-name">{section.category}</h2>
                </div>
              </div>

              <div className="rokkha-cards-grid">
                {section.features.map((feature) => {
                  const FeatureIcon = feature.icon;
                  const statusClass = feature.status.toLowerCase();

                  return (
                    <div
                      key={feature.id}
                      onClick={() => onSelectFeature && onSelectFeature(feature.id)}
                      className="rokkha-module-card"
                    >
                      <div className="rokkha-card-badge-row">
                        <span className={`rokkha-status-tag ${statusClass}`}>
                          {feature.status}
                        </span>
                      </div>

                      <div className="rokkha-card-icon-box">
                        <FeatureIcon />
                      </div>

                      <h3 className="rokkha-card-title">{feature.title}</h3>
                      <p className="rokkha-card-desc">{feature.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </main>

      {/* Modal: Live Simulator */}
      {activeSimulator && (
        <div className="rokkha-modal-backdrop">
          <div className="rokkha-modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #1e293b', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '16px', color: '#fff' }}>
                <Code2 size={18} color="#38bdf8" /> Rokkha Core Engine Simulator
              </div>
              <button onClick={() => setActiveSimulator(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '14px', lineHeight: 1.5 }}>
              Real-time pipeline simulation connecting weather observation telemetry to localized Shapely point-in-polygon flood inundation engines.
            </p>
            <div style={{ background: '#030712', border: '1px solid #1e293b', borderRadius: '10px', padding: '14px', fontFamily: 'monospace', fontSize: '12px', color: '#cbd5e1', maxHeight: '190px', overflowY: 'auto', marginBottom: '16px' }}>
              <div style={{ color: '#34d399', marginBottom: '6px' }}>✓ FastAPI Server: http://127.0.0.1:8000 (Live)</div>
              <div style={{ color: '#38bdf8', marginBottom: '6px' }}>✓ WGS84 Geodesic Calculation Engine: Active</div>
              <div style={{ color: '#38bdf8', marginBottom: '6px' }}>✓ Shapely Geometry Point-in-Polygon Engine: Active</div>
              {simLog.map((log, i) => (
                <div key={i} style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>{log}</div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn-secondary" onClick={() => setActiveSimulator(false)}>Close</button>
              <button className="btn-primary" onClick={() => { setActiveSimulator(false); onSelectFeature && onSelectFeature('weather-observations'); }}>
                <Play size={13} /> Launch Live Sandbox
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Box Launcher Quick Selector */}
      {boxLauncherOpen && (
        <div className="rokkha-modal-backdrop">
          <div className="rokkha-modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #1e293b', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '16px', color: '#fff' }}>
                <LayoutGrid size={18} color="#38bdf8" /> Rokkha Box Launcher
              </div>
              <button onClick={() => setBoxLauncherOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '14px' }}>
              Select any of the 12 core modules to directly launch its interactive environment:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '10px', maxHeight: '280px', overflowY: 'auto', marginBottom: '16px' }}>
              {CATALOG_DATA.flatMap(c => c.features).map(f => (
                <button
                  key={f.id}
                  onClick={() => {
                    setBoxLauncherOpen(false);
                    onSelectFeature && onSelectFeature(f.id);
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: '#0a1226',
                    border: '1px solid #1e293b',
                    color: '#e2e8f0',
                    fontSize: '12px',
                    fontWeight: 700,
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  {f.title}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setBoxLauncherOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
