import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  LifeBuoy, 
  MapPin, 
  Phone, 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertOctagon, 
  Anchor, 
  ShieldCheck, 
  Radio,
  Search,
  Building,
  Navigation,
  ArrowRight,
  Shield,
  Layers,
  AlertTriangle
} from 'lucide-react';
import FastLoginBar from '../components/FastLoginBar';
import InteractiveFloodMap from '../components/InteractiveFloodMap';
import { fetchAssetsNear, fetchDistrictAlerts } from '../services/apiClient';

export default function RescuePanel({ onTabChange }) {
  const { currentUser, rescueRequests, updateRescueStatus } = useApp();
  const [activeSideTab, setActiveSideTab] = useState('sos'); // 'sos' | 'shelters' | 'squads'
  const [filter, setFilter] = useState('all'); // 'all' | 'urgent' | 'dispatched' | 'rescued'

  // Proximity shelter search state (GET /assets/near)
  const [shelterRadiusM, setShelterRadiusM] = useState(10000);
  const [nearbyAssets, setNearbyAssets] = useState([]);
  const [loadingShelters, setLoadingShelters] = useState(false);
  const [activeIncidentCoord, setActiveIncidentCoord] = useState({ lng: 90.4106, lat: 23.7058 });

  // Priority district alerts
  const [activeAlerts, setActiveAlerts] = useState([]);

  useEffect(() => {
    loadNearbyShelters(activeIncidentCoord.lng, activeIncidentCoord.lat, shelterRadiusM);
    fetchDistrictAlerts().then(res => {
      if (res && res.alerts) setActiveAlerts(res.alerts);
    });
  }, [shelterRadiusM]);

  const loadNearbyShelters = async (lng, lat, radius) => {
    setLoadingShelters(true);
    try {
      const data = await fetchAssetsNear(lng, lat, radius);
      if (data && data.results) {
        setNearbyAssets(data.results);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingShelters(false);
    }
  };

  const filteredRequests = rescueRequests.filter(req => {
    if (filter === 'all') return true;
    return req.status === filter;
  });

  const urgentCount = rescueRequests.filter(r => r.status === 'urgent').length;
  const totalTrapped = rescueRequests
    .filter(r => r.status !== 'rescued')
    .reduce((acc, curr) => acc + (Number(curr.peopleTrapped) || 0), 0);

  const totalRescued = rescueRequests
    .filter(r => r.status === 'rescued')
    .reduce((acc, curr) => acc + (Number(curr.peopleTrapped) || 0), 0);

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden">
      
      {/* Universal Fast Role Switcher */}
      <FastLoginBar onTabChange={onTabChange} activeTab="rescue" />

      {/* Compact Tactical Command Header (No scrolling required) */}
      <header className="border-b border-amber-900/30 bg-slate-900/90 px-4 py-2.5 backdrop-blur-md shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Brand & Squad */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 shadow-md font-bold">
              <LifeBuoy size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white tracking-tight">
                  Emergency Flood Rescue Operations Console
                </h1>
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  FIELD RESPONDER
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Live Geodesic Telemetry &bull; Unit 7 Rapid Deployment
              </p>
            </div>
          </div>

          {/* Quick Metrics (Single-line cards) */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-slate-400 text-[11px]">Distress SOS:</span>
              <strong className="text-red-400 font-bold">{urgentCount} calls</strong>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <Users size={13} className="text-amber-400" />
              <span className="text-slate-400 text-[11px]">Trapped:</span>
              <strong className="text-amber-300 font-bold">{totalTrapped}</strong>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <Anchor size={13} className="text-cyan-400" />
              <span className="text-slate-400 text-[11px]">Boats:</span>
              <strong className="text-cyan-300 font-bold">8 Deployed</strong>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <ShieldCheck size={13} className="text-emerald-400" />
              <span className="text-slate-400 text-[11px]">Evacuated:</span>
              <strong className="text-emerald-400 font-bold">{totalRescued}</strong>
            </div>

            <div className="text-xs font-bold text-amber-300 bg-amber-950/60 border border-amber-800/40 px-2.5 py-1 rounded-lg">
              {currentUser?.name || 'Capt. Farhan'} (Unit 7)
            </div>
          </div>
        </div>
      </header>

      {/* Main Tactical Workspace: Left Map + Right Side Options (100% Viewport, Zero Page Scroll) */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3 min-h-0">
        
        {/* Left: Real Tactical Interactive Map (Fills all remaining height) */}
        <div className="flex-1 h-full min-h-0 flex flex-col rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative">
          <InteractiveFloodMap
            mode="rescue"
            theme="dark"
            heightClass="h-full"
            sosRequests={rescueRequests}
            assets={nearbyAssets.map(r => r.asset).filter(Boolean)}
            onDispatchBoat={(id) => updateRescueStatus(id, 'dispatched', 'Inflatable Boat B-1 (Dispatched)')}
            onMarkRescued={(id) => updateRescueStatus(id, 'rescued', 'Completed by Unit 7')}
          />
        </div>

        {/* Right Side Options Panel: Tabbed (SOS Queue / Shelters / Squads) with Self-Contained Scroll */}
        <div className="w-96 lg:w-[410px] h-full min-h-0 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl shrink-0">
          
          {/* Side Tabs Header */}
          <div className="p-2 border-b border-slate-800 bg-slate-950/60 flex items-center gap-1 shrink-0 text-xs">
            <button
              type="button"
              onClick={() => setActiveSideTab('sos')}
              className={`flex-1 py-1.5 px-2 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeSideTab === 'sos'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <AlertTriangle size={13} />
              <span>SOS Queue ({filteredRequests.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSideTab('shelters')}
              className={`flex-1 py-1.5 px-2 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeSideTab === 'shelters'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Navigation size={13} />
              <span>Near Shelters ({nearbyAssets.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSideTab('squads')}
              className={`py-1.5 px-2.5 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                activeSideTab === 'squads'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Squad Readiness & VHF Radio Sync"
            >
              <Anchor size={13} />
            </button>
          </div>

          {/* TAB 1: LIVE DISTRESS SOS QUEUE */}
          {activeSideTab === 'sos' && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              
              {/* Filter Row */}
              <div className="p-2.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-1 shrink-0 text-[11px]">
                <div className="flex items-center gap-1">
                  {[
                    { id: 'all', label: `All (${rescueRequests.length})` },
                    { id: 'urgent', label: `Urgent (${urgentCount})` },
                    { id: 'dispatched', label: `En Route` },
                    { id: 'rescued', label: `Safe` }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                        filter === f.id
                          ? 'bg-slate-800 text-amber-300 font-bold border border-amber-500/40'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <span className="text-[10px] text-amber-400 flex items-center gap-1 font-semibold">
                  <Radio size={11} className="animate-pulse" /> Live Sync
                </span>
              </div>

              {/* Scrollable SOS List (Only this panel scrolls vertically!) */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
                {filteredRequests.map(req => (
                  <div
                    key={req.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                      req.status === 'urgent'
                        ? 'bg-slate-950/80 border-red-500/60 shadow-md shadow-red-950/30'
                        : req.status === 'dispatched'
                        ? 'bg-slate-950/80 border-amber-500/50 shadow-md shadow-amber-950/20'
                        : 'bg-slate-950/40 border-slate-800 opacity-75'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          req.status === 'urgent'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                            : req.status === 'dispatched'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}>
                          {req.status === 'urgent' ? '🔴 CRITICAL SOS' : req.status === 'dispatched' ? '🟡 EN ROUTE' : '🟢 SAFE'}
                        </span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Clock size={10} /> {req.timestamp}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-xs text-white flex items-start gap-1">
                          <MapPin size={14} className="text-amber-400 shrink-0 mt-0.5" />
                          <span>{req.location}</span>
                        </h4>
                        <div className="text-[10px] text-slate-400 font-mono ml-4">
                          GPS: {req.coordinates}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <div>
                          <span className="text-[9px] text-slate-400 block">Water Height:</span>
                          <strong className="text-cyan-400">{req.floodDepth}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block">People Trapped:</span>
                          <strong className="text-white">{req.peopleTrapped} Persons</strong>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-300 italic bg-slate-900/40 p-1.5 rounded">
                        "{req.notes}"
                      </p>

                      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-900 flex items-center justify-between">
                        <span>Caller: <strong className="text-slate-200">{req.callerName}</strong></span>
                        <a href={`tel:${req.phone}`} className="text-cyan-400 hover:underline flex items-center gap-1 font-mono">
                          <Phone size={10} /> {req.phone}
                        </a>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 mt-2 border-t border-slate-850 flex items-center gap-2">
                      {req.status === 'urgent' && (
                        <button
                          type="button"
                          onClick={() => updateRescueStatus(req.id, 'dispatched', 'Inflatable Boat B-1 (Dispatched)')}
                          className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                        >
                          <Anchor size={12} /> Dispatch Boat
                        </button>
                      )}

                      {req.status === 'dispatched' && (
                        <button
                          type="button"
                          onClick={() => updateRescueStatus(req.id, 'rescued', 'Completed by Unit 7')}
                          className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer"
                        >
                          <CheckCircle2 size={12} /> Mark Rescued & Safe
                        </button>
                      )}

                      {req.status === 'rescued' && (
                        <div className="w-full py-1 text-center text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 rounded border border-emerald-800/30">
                          Safely Evacuated to Shelter
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: NEAREST SHELTERS & HOSPITALS (PROXIMITY ENGINE) */}
          {activeSideTab === 'shelters' && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              
              {/* Radius Switcher */}
              <div className="p-2.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0 text-xs">
                <span className="text-[11px] text-slate-400">Search Radius:</span>
                <div className="flex items-center gap-1">
                  {[
                    { label: '3 km', val: 3000 },
                    { label: '6 km', val: 6000 },
                    { label: '10 km', val: 10000 }
                  ].map(r => (
                    <button
                      key={r.val}
                      type="button"
                      onClick={() => setShelterRadiusM(r.val)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        shelterRadiusM === r.val
                          ? 'bg-sky-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Shelters List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
                {nearbyAssets.map(item => (
                  <div key={item.asset?.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                        {item.asset?.asset_type?.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-extrabold text-amber-400 font-mono">
                        {item.distance_meters ? `${item.distance_meters.toFixed(0)} m away` : `${item.distance_kilometers} km`}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-white line-clamp-1">{item.asset?.name}</h4>
                    <div className="text-[10px] text-slate-400">{item.asset?.address || 'Dhaka Metropolitan'}</div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-900 text-[10px]">
                      <span className="text-slate-400">Capacity: <strong className="text-white">{item.asset?.occupancy} people</strong></span>
                      <span className="text-emerald-400 font-bold">{item.asset?.criticality?.toUpperCase()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: BOAT SQUADS & VHF RADIO READINESS */}
          {activeSideTab === 'squads' && (
            <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-3 min-h-0 overflow-y-auto text-xs">
              
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-bold text-slate-200 flex items-center justify-between">
                  <span>Rescue Squad Deployment</span>
                  <span className="text-emerald-400 text-[10px] font-bold">READY</span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Inflatable Boat B-1 (Active):</span>
                    <strong className="text-amber-300">Demra Sector</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Rigid Hull Boat R-4 (Standby):</span>
                    <strong className="text-emerald-400">Sadarghat Post</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Amphibian Squad A-2 (En Route):</span>
                    <strong className="text-cyan-400">Keraniganj</strong>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Radio size={14} className="text-amber-400" />
                  <span>VHF Emergency Radio Sync</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Channel 16 &amp; Channel 72 active. GPS coordinates broadcast every 15 seconds to national disaster center.
                </p>
                <div className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-amber-300">
                  FREQ: 156.800 MHz &bull; SQUELCH: AUTO
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-900/40 text-amber-200 space-y-1 text-[11px]">
                <strong className="font-bold block">Safety Protocol Notice:</strong>
                <p className="text-[10px] text-amber-300/80 leading-relaxed">
                  Night operations require high-intensity searchlights and mandatory life vest enforcement for all citizens evacuated.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
