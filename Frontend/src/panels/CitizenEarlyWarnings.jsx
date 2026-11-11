import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Waves, 
  Radio, 
  MapPin, 
  PhoneCall, 
  LifeBuoy, 
  Send, 
  CheckCircle2, 
  Clock, 
  Droplets,
  Search,
  ExternalLink,
  Info,
  ShieldAlert,
  Building,
  Check
} from 'lucide-react';
import { checkLocationFlood, fetchDistrictAlerts } from '../services/apiClient';

const PRESET_PLACES = [
  { name: 'Sadarghat Riverfront', lng: 90.4106, lat: 23.7058, desc: '224m from Buriganga River' },
  { name: 'Dhaka Medical Hospital', lng: 90.3976, lat: 23.7258, desc: 'Central Urban Health Complex' },
  { name: 'Sunamganj Haor Basin', lng: 91.1428, lat: 24.8474, desc: 'Critical Basin (Flooded in 7/7 passes)' },
  { name: 'Keraniganj Suburb', lng: 90.3500, lat: 23.6800, desc: 'Modelled 10-yr hazard zone' }
];

export default function CitizenEarlyWarnings({ onSwitchRole }) {
  const { news, submitSosRequest, submitCitizenReport } = useApp();

  const [activeModal, setActiveModal] = useState(null); // 'sos' | 'report' | null
  const [sosSuccess, setSosSuccess] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Check any place tool state
  const [selectedLng, setSelectedLng] = useState(90.4106);
  const [selectedLat, setSelectedLat] = useState(23.7058);
  const [checkingPlace, setCheckingPlace] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  // ML District Alerts from Backend
  const [districtAlerts, setDistrictAlerts] = useState([]);

  useEffect(() => {
    // Run initial point check for Sadarghat
    handleRunCheck(90.4106, 23.7058);

    // Fetch district alerts
    fetchDistrictAlerts().then(res => {
      if (res && res.alerts) setDistrictAlerts(res.alerts);
    });
  }, []);

  const handleRunCheck = async (lng, lat) => {
    setCheckingPlace(true);
    try {
      const data = await checkLocationFlood(lng, lat);
      setCheckResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingPlace(false);
    }
  };

  // SOS Form state
  const [sosForm, setSosForm] = useState({
    callerName: '',
    phone: '',
    location: '',
    peopleTrapped: '2',
    vulnerable: '',
    notes: ''
  });

  // Report waterlogging form state
  const [reportForm, setReportForm] = useState({
    reporter: '',
    location: '',
    waterDepth: '1.5 ft',
    description: ''
  });

  const handleSosSubmit = (e) => {
    e.preventDefault();
    submitSosRequest({
      callerName: sosForm.callerName,
      phone: sosForm.phone,
      location: sosForm.location,
      peopleTrapped: Number(sosForm.peopleTrapped) || 1,
      vulnerable: sosForm.vulnerable || 'Residents requiring evacuation',
      notes: sosForm.notes || 'Emergency assistance requested via citizen portal.',
      floodDepth: '3.0+ ft',
      coordinates: `${selectedLat.toFixed(4)}° N, ${selectedLng.toFixed(4)}° E`
    });
    setSosSuccess(true);
    setTimeout(() => {
      setSosSuccess(false);
      setActiveModal(null);
      setSosForm({ callerName: '', phone: '', location: '', peopleTrapped: '2', vulnerable: '', notes: '' });
    }, 2500);
  };

  const handleReportSubmit = (e) => {
    e.preventDefault();
    submitCitizenReport({
      reporter: reportForm.reporter,
      location: reportForm.location,
      waterDepth: reportForm.waterDepth,
      description: reportForm.description
    });
    setReportSuccess(true);
    setTimeout(() => {
      setReportSuccess(false);
      setActiveModal(null);
      setReportForm({ reporter: '', location: '', waterDepth: '1.5 ft', description: '' });
    }, 2500);
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-10" id="early-warnings">
      
      {/* 1. TOP BANNER: Real-time ML Forecast & Alert Status */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-red-950/70 via-slate-900 to-amber-950/50 border border-red-500/40 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-72 h-72 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-red-400">
                Climate Shield ML Early Warning Engine
              </span>
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
              Bangladesh Flood & Waterlogging Early Warning Portal
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Synthesizing Sentinel-1 satellite observations (2016–2024), GloFAS river discharge, and JRC hazard depth models to provide localized flood awareness across Bangladesh.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveModal('sos')}
              className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer animate-pulse"
            >
              <LifeBuoy size={16} /> Request Emergency SOS
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('report')}
              className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/60 font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Droplets size={16} /> Report Waterlogging
            </button>
          </div>
        </div>
      </div>

      {/* 2. BACKEND API TOOL: "CHECK ANY PLACE ON THE MAP" (POST /geospatial/flood/check) */}
      <div className="rounded-2xl p-6 bg-slate-900 border border-cyan-500/40 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Search size={18} className="text-cyan-400" />
              Check Any Place (Satellite Flood History & Hazard Depth)
            </h3>
            <p className="text-xs text-slate-400">
              Backend endpoint: <code className="text-cyan-300 font-mono">POST /api/v1/geospatial/flood/check</code> — Enter coordinates or pick a sample location
            </p>
          </div>

          {/* Preset Buttons from API Guide */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400">Presets:</span>
            {PRESET_PLACES.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setSelectedLng(p.lng);
                  setSelectedLat(p.lat);
                  handleRunCheck(p.lng, p.lat);
                }}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  selectedLng === p.lng && selectedLat === p.lat
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Input coordinates bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Longitude (e.g. 90.4106)
            </label>
            <input
              type="number"
              step="0.0001"
              value={selectedLng}
              onChange={(e) => setSelectedLng(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Latitude (e.g. 23.7058)
            </label>
            <input
              type="number"
              step="0.0001"
              value={selectedLat}
              onChange={(e) => setSelectedLat(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              disabled={checkingPlace}
              onClick={() => handleRunCheck(selectedLng, selectedLat)}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
            >
              {checkingPlace ? 'Querying Sentinel-1 Grid...' : 'Inspect Coordinates'}
            </button>
          </div>
        </div>

        {/* Query Result Card (matching Section D of FRONTEND_API_GUIDE.md) */}
        {checkResult && (
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-cyan-400" />
                <span className="font-bold text-sm text-white">
                  District: {checkResult.district?.name} ({checkResult.district?.division} Division)
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                  Flood Frequency Rank: #{checkResult.district?.flood_rank} of 64
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Coordinates: [{checkResult.location?.coordinates?.[0]}, {checkResult.location?.coordinates?.[1]}]
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Badge 1: Observed Satellite Flooding */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Observed Satellite History
                </span>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${checkResult.flags?.observed_flooding ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  {checkResult.observed_flooding?.times_flooded > 0
                    ? `Flooded in ${checkResult.observed_flooding.times_flooded} of ${checkResult.observed_flooding.times_observed} satellite passes`
                    : 'No water detected in satellite passes'}
                </div>
                <div className="text-[11px] text-slate-400">
                  Latest: {checkResult.observed_flooding?.last_flooded_event_id || 'Never observed'}
                </div>
              </div>

              {/* Badge 2: Modelled Hazard (10-yr & 100-yr return) */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  JRC Modelled Flood Hazard
                </span>
                <div className="text-sm font-bold text-amber-400">
                  10-Yr Depth: {checkResult.hazard?.[0]?.depth_label || 'Outside 10-yr zone'}
                </div>
                <div className="text-[11px] text-slate-400">
                  100-Yr Depth: {checkResult.hazard?.[1]?.depth_label || 'Outside 100-yr zone'}
                </div>
              </div>

              {/* Badge 3: Nearest Waterway */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Nearest River / Canal
                </span>
                <div className="text-sm font-bold text-cyan-300">
                  {checkResult.nearest_waterway?.name || 'Unnamed Canal'}
                </div>
                <div className="text-[11px] text-slate-400">
                  Distance: {checkResult.nearest_waterway?.distance_meters ? `${checkResult.nearest_waterway.distance_meters.toFixed(0)} meters away` : 'Not in Dhaka coverage'}
                </div>
              </div>
            </div>

            {/* Attribution note */}
            <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-900 flex flex-wrap items-center justify-between gap-2">
              <span>Source: {checkResult.attribution?.[0]} • {checkResult.attribution?.[1]}</span>
              <span className="text-cyan-400/80">Distinct badges per scientific guidelines</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. ML DISTRICT FLOOD ALERTS FEED (GET /alerts) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Radio size={18} className="text-red-500 animate-pulse" />
            <h3 className="font-bold text-base text-white">
              Target Date District Predictions & Alerts (GET /api/v1/alerts)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Probability threshold: Watch &ge; 0.60, Alert &ge; 0.80
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {districtAlerts.map((alert) => {
            const probPct = alert.probability > 0.95 ? 'more than 95%' : `${(alert.probability * 100).toFixed(0)}%`;
            return (
              <div
                key={alert.alert_id}
                className={`p-5 rounded-2xl border transition-all space-y-3 ${
                  alert.level === 'alert'
                    ? 'bg-gradient-to-br from-red-950/40 via-slate-900 to-slate-950 border-red-500/40 shadow-lg shadow-red-950/20'
                    : 'bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 border-amber-500/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      alert.level === 'alert'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}>
                      {alert.level === 'alert' ? '🔴 CRITICAL ALERT' : '🟡 WATCH ADVISORY'}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {alert.district?.name} District
                    </span>
                  </div>
                  <span className="text-xs font-bold text-cyan-300 font-mono">
                    Model Probability: {probPct}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {alert.message}
                </p>

                {alert.assets_at_risk?.assets?.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300 block mb-1">Assets in district:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {alert.assets_at_risk.assets.map(a => (
                        <span key={a.asset_id} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                          {a.name} ({a.occupancy} people)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. OFFICIAL BULLETINS FEED (Admin published) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 className="font-bold text-base text-white">
            Admin Verified News & Safety Bulletins
          </h3>
          <span className="text-xs text-slate-400">Updated in real-time</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {news.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-cyan-400">{item.category}</span>
                  <span className="text-slate-500">{item.publishedAt}</span>
                </div>
                <h4 className="font-bold text-sm text-white">{item.title}</h4>
                <p className="text-xs text-slate-300">{item.summary}</p>
              </div>
              <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold pt-2 border-t border-slate-800">
                <CheckCircle2 size={12} /> {item.author}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. DATA HONESTY & LIMITATIONS BANNER (As required by Section 2 of FRONTEND_API_GUIDE) */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-2">
        <div className="flex items-center gap-1.5 text-slate-300 font-bold">
          <Info size={14} className="text-cyan-400" />
          <span>Scientific Data Transparency & License Attributions</span>
        </div>
        <p className="leading-relaxed">
          <strong>Attribution:</strong> Satellite flood observations courtesy of Copernicus GFM (Sentinel-1 SAR, 2016–2024). Modelled river flood depth courtesy of the European Commission JRC Global Flood Hazard Dataset. District boundaries courtesy of HDX / OCHA. Waterways courtesy of OpenStreetMap contributors.
        </p>
        <p className="text-[11px] text-slate-500">
          <strong>Limitations:</strong> Radar satellites cannot penetrate high-density urban building canyons. Historical observations depict past flood events; hazard polygons depict statistical 10-year and 100-year return periods. Official operational warnings remain under the jurisdiction of the Bangladesh Flood Forecasting & Warning Centre (FFWC).
        </p>
      </div>

      {/* ================= MODAL 1: REQUEST RESCUE SOS ================= */}
      {activeModal === 'sos' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-red-500/50 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <LifeBuoy size={20} className="text-red-500" />
                <h3 className="font-bold text-base text-white">Emergency Flood Rescue Request</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {sosSuccess ? (
              <div className="text-center py-6 space-y-2">
                <CheckCircle2 size={40} className="text-emerald-400 mx-auto animate-bounce" />
                <h4 className="font-bold text-base text-white">SOS Broadcasted to Rescue Units!</h4>
                <p className="text-xs text-slate-300">
                  Rescue Team Unit 7 has received your location and coordinates. Keep your phone line reachable.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSosSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    value={sosForm.callerName}
                    onChange={(e) => setSosForm({ ...sosForm, callerName: e.target.value })}
                    placeholder="e.g. Tanvir Hossain"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Mobile Contact Number</label>
                  <input
                    type="tel"
                    required
                    value={sosForm.phone}
                    onChange={(e) => setSosForm({ ...sosForm, phone: e.target.value })}
                    placeholder="e.g. 017XXXXXXXX"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Exact Trapped Location (House, Road, Area)</label>
                  <input
                    type="text"
                    required
                    value={sosForm.location}
                    onChange={(e) => setSosForm({ ...sosForm, location: e.target.value })}
                    placeholder="e.g. Badda, Block D, House 14 (Ground floor submerged)"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">People Trapped</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={sosForm.peopleTrapped}
                      onChange={(e) => setSosForm({ ...sosForm, peopleTrapped: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Vulnerable Members</label>
                    <input
                      type="text"
                      value={sosForm.vulnerable}
                      onChange={(e) => setSosForm({ ...sosForm, vulnerable: e.target.value })}
                      placeholder="e.g. 1 infant, elderly"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Urgent Situation Details</label>
                  <textarea
                    rows={2}
                    value={sosForm.notes}
                    onChange={(e) => setSosForm({ ...sosForm, notes: e.target.value })}
                    placeholder="Water level entering rooms, electricity disconnected..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 cursor-pointer"
                >
                  <Send size={14} /> Send SOS to Rescue Operations
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL 2: REPORT WATERLOGGING ================= */}
      {activeModal === 'report' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-cyan-500/50 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Droplets size={20} className="text-cyan-400" />
                <h3 className="font-bold text-base text-white">Report Waterlogging / Flooded Road</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {reportSuccess ? (
              <div className="text-center py-6 space-y-2">
                <CheckCircle2 size={40} className="text-cyan-400 mx-auto animate-bounce" />
                <h4 className="font-bold text-base text-white">Report Submitted to Admin Queue</h4>
                <p className="text-xs text-slate-300">
                  Our disaster monitoring team will validate this report and update early warnings for nearby citizens.
                </p>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={reportForm.reporter}
                    onChange={(e) => setReportForm({ ...reportForm, reporter: e.target.value })}
                    placeholder="e.g. Siddiqur Rahman"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Location / Road / Landmark</label>
                  <input
                    type="text"
                    required
                    value={reportForm.location}
                    onChange={(e) => setReportForm({ ...reportForm, location: e.target.value })}
                    placeholder="e.g. Rampura Bridge Approach Road"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Estimated Water Depth</label>
                  <select
                    value={reportForm.waterDepth}
                    onChange={(e) => setReportForm({ ...reportForm, waterDepth: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Ankle level (0.5 ft)">Ankle level (0.5 ft)</option>
                    <option value="Knee level (1.5 ft)">Knee level (1.5 ft)</option>
                    <option value="Waist level (3.0 ft)">Waist level (3.0 ft)</option>
                    <option value="Submerged Vehicles (4.0+ ft)">Submerged Vehicles (4.0+ ft)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Observations / Blocked Drains</label>
                  <textarea
                    rows={2}
                    required
                    value={reportForm.description}
                    onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                    placeholder="Vehicles stranded, canal overflowed, manhole open..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/30 cursor-pointer"
                >
                  <Send size={14} /> Submit Report for Admin Validation
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </section>
  );
}
