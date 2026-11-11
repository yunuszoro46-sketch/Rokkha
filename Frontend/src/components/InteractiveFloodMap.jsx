import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, GeoJSON, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  Shield, LifeBuoy, AlertTriangle, MapPin, Building, Anchor, 
  CheckCircle2, Waves, Compass, Search, Filter, Eye, EyeOff, Layers, Cpu
} from 'lucide-react';

// Official BWDB / FFWC GeoJSON, Live Telemetry & ML Flood Prediction Datasets
import districtsGeoJson from '../data/bangladesh_districts.json';
import riversGeoJson from '../data/bangladesh_rivers_hydro.json';
import ffwcLiveStations from '../data/ffwc_stations_live.json';
import districtPredictionsData from '../data/district_flood_predictions.json';

function MapViewController({ targetView }) {
  const map = useMap();
  useEffect(() => {
    if (targetView) {
      map.flyTo(targetView.center, targetView.zoom, { duration: 1.2 });
    }
  }, [targetView, map]);
  return null;
}

// Custom SVG Icons for SOS, Shelters, Hospitals, Boats
const createCustomIcon = (bgColor, borderColor, text, pulse = false) => {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: ${bgColor};
        border: 2px solid ${borderColor};
        border-radius: 50%;
        color: white;
        font-weight: 800;
        font-size: 13px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.45);
        cursor: pointer;
      ">
        ${pulse ? `<span style="
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid ${bgColor};
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          opacity: 0.75;
        "></span>` : ''}
        ${text}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

const ICONS = {
  sos: createCustomIcon('#ef4444', '#fca5a5', 'SOS', true),
  shelter: createCustomIcon('#10b981', '#6ee7b7', '⌂'),
  hospital: createCustomIcon('#0284c7', '#38bdf8', '+'),
  boat: createCustomIcon('#f59e0b', '#fde68a', '⛵'),
  target: createCustomIcon('#8b5cf6', '#c4b5fd', '📍', true)
};

// Exact FFWC Station Node Icon generator with Green, Yellow, Red Signs
const createFfwcStationIcon = (name, status = 'normal', showLabel = true) => {
  let circleColor = '#16a34a'; // Green Sign: Normal (<50cm below danger)
  let haloHtml = '';

  if (status === 'warning') {
    circleColor = '#ea580c'; // Yellow/Orange Sign: Warning (within 50cm below danger, like Mongla)
    haloHtml = `
      <div style="
        position: absolute;
        top: -6px;
        left: -6px;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: rgba(234, 88, 12, 0.35);
        border: 1.5px solid rgba(234, 88, 12, 0.85);
        pointer-events: none;
      "></div>
    `;
  } else if (status === 'danger') {
    circleColor = '#dc2626'; // Red Sign: Severe Danger (> Danger Level)
    haloHtml = `
      <div style="
        position: absolute;
        top: -8px;
        left: -8px;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: rgba(220, 38, 38, 0.40);
        border: 1.5px solid #dc2626;
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        pointer-events: none;
      "></div>
    `;
  }

  return L.divIcon({
    className: 'ffwc-station-node',
    html: `
      <div style="position: relative; display: flex; align-items: center; cursor: pointer; white-space: nowrap;">
        ${haloHtml}
        <div style="
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: ${circleColor};
          border: 1.5px solid #ffffff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.35);
          flex-shrink: 0;
          z-index: 2;
        "></div>
        ${showLabel ? `
          <span style="
            margin-left: 6px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-style: italic;
            font-size: 10px;
            font-weight: 600;
            color: #1e293b;
            text-shadow: 0 1px 2px #ffffff, 0 -1px 2px #ffffff, 1px 0 2px #ffffff, -1px 0 2px #ffffff;
            user-select: none;
            pointer-events: none;
          ">${name}</span>
        ` : ''}
      </div>
    `,
    iconSize: [showLabel ? 120 : 12, 16],
    iconAnchor: [5, 8],
    popupAnchor: [0, -10]
  });
};

// Watermark Label DivIcon for Neighboring Regions & Divisions
const createWatermarkLabel = (text, color = '#94a3b8', fontSize = '11px', letterSpacing = '2px') => {
  return L.divIcon({
    className: 'ffwc-watermark-label',
    html: `
      <div style="
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 700;
        font-size: ${fontSize};
        color: ${color};
        letter-spacing: ${letterSpacing};
        text-transform: uppercase;
        user-select: none;
        pointer-events: none;
        white-space: nowrap;
        opacity: 0.8;
      ">${text}</div>
    `,
    iconSize: [120, 20],
    iconAnchor: [60, 10]
  });
};

// Strict Bangladesh Geographic Bounding Box
export const BANGLADESH_BOUNDS = [
  [20.30, 88.00],
  [26.75, 92.85]
];

// Defined High-Risk (Red), Watch (Yellow) & Safe (Green) Urban Micro-Zones
export const FLOOD_RISK_ZONES = [
  {
    id: 'zone-red-1',
    name: '🔴 Eastern Lowlands (Badda, Demra & Rampura)',
    center: [23.7750, 90.4350],
    radiusMeters: 3800,
    risk: 'critical',
    color: '#ef4444',
    fillColor: '#ef4444',
    fillOpacity: 0.25,
    details: 'Critical Red Zone: Waterlogged ground floors, canal backflow from Balu river, 3-4ft depth.'
  },
  {
    id: 'zone-red-2',
    name: '🔴 Buriganga Embankment Low Basin (Keraniganj)',
    center: [23.6980, 90.3950],
    radiusMeters: 3200,
    risk: 'critical',
    color: '#ef4444',
    fillColor: '#ef4444',
    fillOpacity: 0.25,
    details: 'Critical Red Zone: River level near danger mark, sluice gates on high supervision.'
  },
  {
    id: 'zone-amber-1',
    name: '🟡 Turag River Corridor (Mirpur-Gabtoli Section)',
    center: [23.8100, 90.3450],
    radiusMeters: 3600,
    risk: 'warning',
    color: '#f59e0b',
    fillColor: '#f59e0b',
    fillOpacity: 0.22,
    details: 'Yellow Watch Sign: Moderate overflow warning. Roads experiencing 1-2ft waterlogging.'
  },
  {
    id: 'zone-amber-2',
    name: '🟡 Old Dhaka Core (Sadarghat to Lalbagh)',
    center: [23.7140, 90.4050],
    radiusMeters: 2600,
    risk: 'warning',
    color: '#f59e0b',
    fillColor: '#f59e0b',
    fillOpacity: 0.22,
    details: 'Yellow Watch Sign: Drainage congestion. Historic urban alleys subject to standing water.'
  },
  {
    id: 'zone-green-1',
    name: '🟢 Northern Elevated Ridge (Uttara & Airport High Ground)',
    center: [23.8720, 90.3980],
    radiusMeters: 4200,
    risk: 'safe',
    color: '#10b981',
    fillColor: '#10b981',
    fillOpacity: 0.18,
    details: 'Green Safe Sign: Elevated natural terrain. Rapid stormwater drainage functioning normally.'
  },
  {
    id: 'zone-green-2',
    name: '🟢 Central Dhaka Elevated Plateau (Dhanmondi-Tejgaon)',
    center: [23.7550, 90.3850],
    radiusMeters: 3400,
    risk: 'safe',
    color: '#10b981',
    fillColor: '#10b981',
    fillOpacity: 0.18,
    details: 'Green Safe Sign: Normal water runoff. Primary emergency relief corridors open.'
  }
];

// Watermark labels coordinates matching the FFWC screenshot
const REGIONAL_LABELS = [
  { id: 'lbl-india-1', text: 'INDIA', lat: 24.30, lng: 88.10, color: '#94a3b8' },
  { id: 'lbl-india-2', text: 'INDIA', lat: 23.40, lng: 91.55, color: '#94a3b8' },
  { id: 'lbl-wb', text: 'WEST BENGAL', lat: 23.10, lng: 87.70, color: '#94a3b8' },
  { id: 'lbl-meghalaya', text: 'MEGHALAYA', lat: 25.50, lng: 91.30, color: '#94a3b8' },
  { id: 'lbl-assam', text: 'ASSAM', lat: 26.20, lng: 92.50, color: '#94a3b8' },
  { id: 'lbl-tripura', text: 'TRIPURA', lat: 23.85, lng: 91.80, color: '#94a3b8' },
  { id: 'lbl-mizoram', text: 'MIZORAM', lat: 23.30, lng: 92.95, color: '#94a3b8' },
  
  // Bangladesh Internal Divisions Watermark
  { id: 'div-rangpur', text: 'RANGPUR', lat: 25.80, lng: 89.20, color: '#cbd5e1' },
  { id: 'div-rajshahi', text: 'RAJSHAHI', lat: 24.45, lng: 88.85, color: '#cbd5e1' },
  { id: 'div-mymensingh', text: 'MYMENSINGH', lat: 24.75, lng: 90.40, color: '#cbd5e1' },
  { id: 'div-sylhet', text: 'SYLHET', lat: 24.75, lng: 91.75, color: '#cbd5e1' },
  { id: 'div-dhaka', text: 'DHAKA', lat: 23.85, lng: 90.30, color: '#cbd5e1' },
  { id: 'div-khulna', text: 'KHULNA', lat: 22.80, lng: 89.40, color: '#cbd5e1' },
  { id: 'div-barishal', text: 'BARISHAL', lat: 22.60, lng: 90.35, color: '#cbd5e1' },
  { id: 'div-chittagong', text: 'CHITTAGONG', lat: 22.40, lng: 91.95, color: '#cbd5e1' }
];

// Click listener hook for Admin "Click to place asset"
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick({
          lat: parseFloat(e.latlng.lat.toFixed(5)),
          lng: parseFloat(e.latlng.lng.toFixed(5))
        });
      }
    }
  });
  return null;
}

export default function InteractiveFloodMap({
  mode = 'admin', // 'admin' | 'rescue'
  theme = 'ocean', // 'dark' | 'ocean'
  heightClass = 'h-full',
  onSelectLocation,
  selectedCoord,
  assets = [],
  sosRequests = [],
  onDispatchBoat,
  onMarkRescued
}) {
  const isOcean = theme === 'ocean';
  
  // GIS Technology Engine State
  const [gisEngine, setGisEngine] = useState('leaflet'); // 'leaflet' | 'mapbox' | 'openlayers'
  const [mapStyle, setMapStyle] = useState('ffwc'); // 'ffwc' | 'topo' | 'satellite'
  
  // Green, Yellow, Red Sign & Choropleth Controls
  const [showDistrictRisk, setShowDistrictRisk] = useState(true);
  const [filterZones, setFilterZones] = useState({
    red: true,
    yellow: true,
    green: true
  });
  
  const [showAssets, setShowAssets] = useState(true);
  const [showFfwcStations, setShowFfwcStations] = useState(true);
  const [showStationLabels, setShowStationLabels] = useState(true);
  const [showRivers, setShowRivers] = useState(true);
  const [selectedBasin, setSelectedBasin] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Default Map center: Bangladesh Center (Locked to Bangladesh Bounds)
  const defaultCenter = [23.8500, 90.3500];
  const [targetView, setTargetView] = useState({ center: [23.8500, 90.3500], zoom: 7.4 });

  // Map PCode to Prediction Record for O(1) Choropleth Lookup
  const districtPredMap = useMemo(() => {
    const map = {};
    for (const pred of districtPredictionsData) {
      map[pred.pcode] = pred;
    }
    return map;
  }, []);

  const handleMapClick = (coord) => {
    if (onSelectLocation) {
      onSelectLocation(coord);
    }
  };

  // Basemap Tile Providers (100% Free, NO API Key, NO watermark)
  const TILE_PROVIDERS = {
    ffwc: null,
    topo: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri &mdash; Topo & Waterways Database"
    },
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri &mdash; Satellite Imagery"
    }
  };

  // Filtered FFWC Stations based on search query and basin filter
  const filteredStations = useMemo(() => {
    return ffwcLiveStations.filter(st => {
      if (selectedBasin !== 'ALL') {
        const basin = (st.basin || '').toLowerCase();
        if (selectedBasin === 'Brahmaputra' && !basin.includes('brahmaputra')) return false;
        if (selectedBasin === 'Ganges' && !basin.includes('ganges') && !basin.includes('padma')) return false;
        if (selectedBasin === 'Meghna' && !basin.includes('meghna') && !basin.includes('haor')) return false;
        if (selectedBasin === 'SE Hill' && !basin.includes('hill') && !basin.includes('chattogram')) return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = (st.name || '').toLowerCase().includes(query);
        const matchRiver = (st.river || '').toLowerCase().includes(query);
        const matchDistrict = (st.district || '').toLowerCase().includes(query);
        if (!matchName && !matchRiver && !matchDistrict) return false;
      }
      return true;
    });
  }, [selectedBasin, searchQuery]);

  // District Boundary Vector Style with Green, Yellow, Red Signs
  const districtStyle = (feature) => {
    if (!showDistrictRisk) {
      return {
        fillColor: '#fbfcfd',
        fillOpacity: 0.98,
        color: '#0f3b75', // FFWC exact dark navy outline
        weight: 1.8,
        opacity: 0.9
      };
    }

    const pcode = feature.id;
    const pred = districtPredMap[pcode];

    if (pred && pred.risk === 'alert') {
      if (!filterZones.red) return { fillOpacity: 0, weight: 0.5, color: '#e2e8f0' };
      return {
        fillColor: '#ef4444', // 🔴 Red Sign: Severe Alert
        fillOpacity: 0.38,
        color: '#b91c1c',
        weight: 2.2,
        opacity: 1
      };
    } else if (pred && pred.risk === 'watch') {
      if (!filterZones.yellow) return { fillOpacity: 0, weight: 0.5, color: '#e2e8f0' };
      return {
        fillColor: '#f59e0b', // 🟡 Yellow Sign: Watch
        fillOpacity: 0.32,
        color: '#d97706',
        weight: 1.8,
        opacity: 1
      };
    } else {
      if (!filterZones.green) return { fillOpacity: 0, weight: 0.5, color: '#e2e8f0' };
      return {
        fillColor: '#10b981', // 🟢 Green Sign: Safe Normal
        fillOpacity: 0.16,
        color: '#059669',
        weight: 1.2,
        opacity: 0.85
      };
    }
  };

  // District Click and Popup Handler
  const onEachDistrict = (feature, layer) => {
    const pcode = feature.id;
    const name = feature.properties?.name || 'District';
    const division = feature.properties?.parent_name || '';
    const pred = districtPredMap[pcode] || { risk: 'normal', prob: 0.05 };

    const badgeClass = pred.risk === 'alert' 
      ? 'bg-red-100 text-red-700 border-red-300' 
      : pred.risk === 'watch' 
      ? 'bg-amber-100 text-amber-800 border-amber-300' 
      : 'bg-emerald-100 text-emerald-700 border-emerald-300';

    const riskSign = pred.risk === 'alert' 
      ? '🔴 SEVERE FLOOD ALERT' 
      : pred.risk === 'watch' 
      ? '🟡 FLOOD WATCH (ELEVATED RISK)' 
      : '🟢 NORMAL / SAFE GROUND';

    layer.bindPopup(`
      <div style="font-family: sans-serif; padding: 4px; min-width: 220px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
          <div>
            <strong style="font-size: 13px; color: #0f172a;">${name} District</strong>
            <div style="font-size: 10px; color: #64748b;">${division} Division &bull; ${pcode}</div>
          </div>
          <span style="font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 9999px; text-transform: uppercase;" class="${badgeClass}">
            ${pred.risk}
          </span>
        </div>
        <div style="font-size: 11px; margin-bottom: 4px; color: #334155;">
          GIS ML Inundation Probability: <strong style="color: #0f172a;">${(pred.prob * 100).toFixed(1)}%</strong>
        </div>
        <div style="font-size: 11px; font-weight: 700; margin-bottom: 6px;">
          GIS Sign: ${riskSign}
        </div>
        <div style="font-size: 10px; color: #475569; background: #f8fafc; padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0; line-height: 1.4;">
          ${pred.risk === 'alert' 
            ? 'Action: High river backflow detected. Emergency rescue boats on standby. Evacuation shelters pre-positioned.' 
            : pred.risk === 'watch' 
            ? 'Action: Rising upstream runoff. Embankments on patrol. Haor drainage monitoring active.' 
            : 'Action: Elevated terrain with normal stormwater discharge. Safe humanitarian staging corridor.'}
        </div>
      </div>
    `);
  };

  // River Vector Style
  const riverStyle = () => ({
    color: '#38bdf8', // crisp sky-blue river line
    weight: 2.0,
    opacity: 0.85
  });

  return (
    <div className={`w-full h-full relative font-sans overflow-hidden bg-[#e8ecf2] ${heightClass}`}>
      
      {/* 1. Official Full-Bleed Map Canvas (Strictly locked to Bangladesh coordinates) */}
      <div className="absolute inset-0 w-full h-full z-0">
        <MapContainer
          center={defaultCenter}
          zoom={7.4}
          minZoom={6.5}
          maxZoom={18}
          maxBounds={BANGLADESH_BOUNDS}
          maxBoundsViscosity={1.0}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', background: '#e2e8f0' }}
        >
          <MapViewController targetView={targetView} />

          {/* External TileLayer if Topo or Satellite selected */}
          {mapStyle !== 'ffwc' && TILE_PROVIDERS[mapStyle] && (
            <TileLayer
              key={mapStyle}
              attribution={TILE_PROVIDERS[mapStyle].attribution}
              url={TILE_PROVIDERS[mapStyle].url}
              maxZoom={19}
            />
          )}

          <MapClickHandler onMapClick={handleMapClick} />

          {/* 1. OFFICIAL BANGLADESH DISTRICTS CHOROPLETH LAYER (Red, Yellow, Green GIS Signs) */}
          <GeoJSON
            key={`districts-${showDistrictRisk}-${filterZones.red}-${filterZones.yellow}-${filterZones.green}-${mapStyle}`}
            data={districtsGeoJson}
            style={districtStyle}
            onEachFeature={onEachDistrict}
          />

          {/* 2. REGIONAL WATERMARK LABELS (INDIA, WEST BENGAL, MEGHALAYA, ASSAM, TRIPURA, MIZORAM, DIVISIONS) */}
          {REGIONAL_LABELS.map(lbl => (
            <Marker
              key={lbl.id}
              position={[lbl.lat, lbl.lng]}
              icon={createWatermarkLabel(lbl.text, lbl.color, '10px', '2.5px')}
              interactive={false}
            />
          ))}

          {/* 3. VIBRANT SKY-BLUE RIVER WATERWAYS LAYER */}
          {showRivers && (
            <GeoJSON
              key="rivers-hydro-layer"
              data={riversGeoJson}
              style={riverStyle}
            />
          )}

          {/* 4. SEVERE RED, YELLOW WATCH, AND GREEN SAFE URBAN INUNDATION ZONES */}
          {FLOOD_RISK_ZONES.map(zone => {
            if (zone.risk === 'critical' && !filterZones.red) return null;
            if (zone.risk === 'warning' && !filterZones.yellow) return null;
            if (zone.risk === 'safe' && !filterZones.green) return null;

            return (
              <Circle
                key={zone.id}
                center={zone.center}
                radius={zone.radiusMeters}
                pathOptions={{
                  color: zone.color,
                  fillColor: zone.fillColor,
                  fillOpacity: zone.fillOpacity,
                  weight: 2,
                  dashArray: zone.risk === 'warning' ? '5, 5' : undefined
                }}
              >
                <Popup className="rokkha-leaflet-popup">
                  <div className="p-2 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className={`w-2.5 h-2.5 rounded-full ${zone.risk === 'critical' ? 'bg-red-500' : zone.risk === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <span className="text-slate-900">{zone.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Severity: <strong className="uppercase">{zone.risk}</strong>
                    </div>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      {zone.details}
                    </p>
                  </div>
                </Popup>
              </Circle>
            );
          })}

          {/* 5. ALL 152 OFFICIAL FFWC / BWDB RIVER GAUGING STATIONS (Exact replication of screenshot) */}
          {showFfwcStations && filteredStations.map(st => {
            const isWarning = st.status === 'warning';
            const isDanger = st.status === 'danger';

            return (
              <Marker
                key={`ffwc-${st.id}`}
                position={[st.lat, st.lng]}
                icon={createFfwcStationIcon(st.name, st.status, showStationLabels)}
              >
                <Popup className="rokkha-leaflet-popup">
                  <div className="p-3 space-y-2 min-w-[240px] text-xs font-sans">
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-200">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            isDanger ? 'bg-red-600 animate-pulse' : isWarning ? 'bg-amber-500' : 'bg-emerald-600'
                          }`} />
                          <h4 className="font-bold text-sm text-slate-900">{st.name} Station</h4>
                        </div>
                        <span className="text-[11px] text-slate-500 block">
                          {st.river} River &bull; {st.basin}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isDanger 
                          ? 'bg-red-100 text-red-700 border border-red-300' 
                          : isWarning 
                          ? 'bg-amber-100 text-amber-700 border border-amber-300' 
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                      }`}>
                        {st.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Current Water Level:</span>
                        <strong className="text-slate-900 text-xs">
                          {st.waterLevel !== null ? `${st.waterLevel.toFixed(2)} m` : 'N/A'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Official Danger Level:</span>
                        <strong className="text-slate-900 text-xs">
                          {st.dangerLevel !== null ? `${st.dangerLevel.toFixed(2)} m` : 'N/A'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Difference from Danger:</span>
                        <strong className={st.diffCm !== null && st.diffCm >= 0 ? 'text-red-600 font-bold' : 'text-emerald-700'}>
                          {st.diffCm !== null ? `${st.diffCm > 0 ? '+' : ''}${st.diffCm} cm` : 'N/A'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Highest Recorded (RHWL):</span>
                        <strong className="text-slate-700 text-xs">
                          {st.rhwl !== null ? `${st.rhwl.toFixed(2)} m` : 'N/A'}
                        </strong>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 pt-1 flex items-center justify-between border-t border-slate-100">
                      <span>Location: {st.upazilla || '-'}, {st.district}</span>
                      <span>Source: BWDB Telemetry</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* 6. ADMIN SELECTED COORDINATE PIN (Click on map to place) */}
          {selectedCoord && (
            <Marker position={[selectedCoord.lat, selectedCoord.lng]} icon={ICONS.target}>
              <Popup className="rokkha-leaflet-popup">
                <div className="p-2 space-y-1 text-xs">
                  <div className="font-bold text-violet-700 flex items-center gap-1">
                    <MapPin size={14} /> Selected Coordinates
                  </div>
                  <div className="font-mono text-slate-800 bg-violet-50 p-1 rounded">
                    Lat: {selectedCoord.lat}, Lng: {selectedCoord.lng}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Use these coordinates to register new emergency shelters, medical posts, or boats.
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* 7. RESCUE ASSETS (Shelters, Hospitals, Boats) */}
          {showAssets && assets.map(asset => {
            if (!asset.lat || !asset.lng) return null;
            const icon = asset.type === 'hospital' ? ICONS.hospital : asset.type === 'boat' ? ICONS.boat : ICONS.shelter;
            return (
              <Marker key={asset.id} position={[asset.lat, asset.lng]} icon={icon}>
                <Popup className="rokkha-leaflet-popup">
                  <div className="p-2 space-y-1 text-xs">
                    <div className="font-bold text-slate-900 flex items-center gap-1">
                      {asset.type === 'hospital' ? <Building size={14} className="text-sky-600" /> : <Shield size={14} className="text-emerald-600" />}
                      {asset.name}
                    </div>
                    <div className="text-slate-600 text-[11px]">
                      Type: <strong className="capitalize">{asset.type}</strong> &bull; Capacity: <strong>{asset.capacity || 'N/A'}</strong>
                    </div>
                    <div className="text-slate-500 text-[10px]">
                      {asset.address}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* 8. RESCUE MODE: LIVE SOS DISTRESS CALLS */}
          {mode === 'rescue' && sosRequests.map(sos => {
            if (!sos.lat || !sos.lng) return null;
            return (
              <Marker key={sos.id} position={[sos.lat, sos.lng]} icon={ICONS.sos}>
                <Popup className="rokkha-leaflet-popup">
                  <div className="p-3 space-y-2 min-w-[220px] text-xs">
                    <div className="flex items-center justify-between pb-1.5 border-b border-red-100">
                      <div className="font-bold text-red-600 flex items-center gap-1.5">
                        <AlertTriangle size={15} /> SOS Request #{sos.id}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-700">
                        {sos.status || 'Pending'}
                      </span>
                    </div>
                    <div className="text-slate-700 space-y-0.5">
                      <div>Citizen: <strong>{sos.citizenName || 'Anonymous'}</strong> ({sos.phone || 'N/A'})</div>
                      <div>People stranded: <strong>{sos.peopleCount || 1}</strong></div>
                      <div>Water level: <strong className="text-red-600">{sos.waterDepth || '3-4ft'}</strong></div>
                      <p className="text-[11px] text-slate-600 italic bg-red-50/60 p-1.5 rounded mt-1">
                        "{sos.note || 'Emergency evacuation requested immediately.'}"
                      </p>
                    </div>

                    <div className="pt-2 flex items-center gap-1.5 border-t border-slate-100">
                      {onDispatchBoat && sos.status !== 'dispatched' && sos.status !== 'rescued' && (
                        <button
                          type="button"
                          onClick={() => onDispatchBoat(sos.id)}
                          className="flex-1 py-1 px-2 rounded bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Anchor size={12} /> Dispatch Boat
                        </button>
                      )}
                      {onMarkRescued && sos.status !== 'rescued' && (
                        <button
                          type="button"
                          onClick={() => onMarkRescued(sos.id)}
                          className="flex-1 py-1 px-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 size={12} /> Rescued
                        </button>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* 2. Floating Top Command Bar (Glassmorphic) */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2.5 pointer-events-none">
        
        {/* Left: Floating Brand & Station Telemetry Badge */}
        <div className="pointer-events-auto backdrop-blur-md bg-slate-900/90 text-white border border-slate-700/80 rounded-2xl px-3.5 py-1.5 shadow-xl flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/40 flex items-center justify-center font-bold text-xs shrink-0">
            🌊
          </div>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-xs tracking-tight text-white whitespace-nowrap">
              FFWC / BWDB Hydrographic Map
            </h3>
            <span className="text-[9px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-bold whitespace-nowrap hidden sm:inline-block">
              ● 152 Stations Live
            </span>
          </div>
        </div>

        {/* Right: Floating Search & Basemap Switcher */}
        <div className="pointer-events-auto backdrop-blur-md bg-white/95 border border-slate-200/90 rounded-2xl p-1 shadow-xl flex items-center gap-2 text-xs">
          {/* Station Search Input */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search 152 stations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white w-32 sm:w-44 transition-all"
            />
          </div>

          {/* Basemap Switcher */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl text-[10px] font-bold">
            {[
              { id: 'ffwc', label: '🌊 FFWC' },
              { id: 'topo', label: '🗺️ Topo' },
              { id: 'satellite', label: '🛰️ Sat' }
            ].map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setMapStyle(s.id)}
                className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                  mapStyle === s.id
                    ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* 3. Floating Left Risk Signs & Layer Dock */}
      <div className="absolute top-16 left-3 z-[1000] pointer-events-auto hidden sm:block">
        <div className="backdrop-blur-md bg-white/95 border border-slate-200/90 rounded-2xl p-2.5 shadow-xl space-y-1.5 text-xs w-44 transition-all">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block px-1">
            GIS Signs &amp; Layers
          </span>

          {/* 64 District Prediction Toggle */}
          <button
            type="button"
            onClick={() => setShowDistrictRisk(!showDistrictRisk)}
            className={`w-full py-1 px-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer flex items-center justify-between ${
              showDistrictRisk 
                ? 'bg-indigo-600 border-indigo-700 text-white shadow-2xs' 
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>🔴🟡🟢 64 Districts</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${showDistrictRisk ? 'bg-white/20' : 'bg-slate-200 text-slate-700'}`}>ML</span>
          </button>

          {/* Red Severe Sign Filter */}
          <button
            type="button"
            onClick={() => setFilterZones(prev => ({ ...prev, red: !prev.red }))}
            className={`w-full py-0.5 px-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer flex items-center justify-between ${
              filterZones.red 
                ? 'bg-red-500 border-red-600 text-white shadow-2xs' 
                : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
            }`}
            title="Toggle Red Severe Flood Alert"
          >
            <span>🔴 Alert (&ge;37.5%)</span>
            <span className="text-[8px] font-black">ALERT</span>
          </button>

          {/* Yellow Watch Sign Filter */}
          <button
            type="button"
            onClick={() => setFilterZones(prev => ({ ...prev, yellow: !prev.yellow }))}
            className={`w-full py-0.5 px-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer flex items-center justify-between ${
              filterZones.yellow 
                ? 'bg-amber-500 border-amber-600 text-white shadow-2xs' 
                : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
            }`}
            title="Toggle Yellow Moderate Watch"
          >
            <span>🟡 Watch (Halo)</span>
            <span className="text-[8px] font-black">WATCH</span>
          </button>

          {/* Green Safe Sign Filter */}
          <button
            type="button"
            onClick={() => setFilterZones(prev => ({ ...prev, green: !prev.green }))}
            className={`w-full py-0.5 px-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer flex items-center justify-between ${
              filterZones.green 
                ? 'bg-emerald-600 border-emerald-700 text-white shadow-2xs' 
                : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
            }`}
            title="Toggle Green Safe Areas"
          >
            <span>🟢 Normal / Safe</span>
            <span className="text-[8px] font-black">SAFE</span>
          </button>

          <div className="border-t border-slate-100 pt-1 space-y-1">
            {/* Stations Toggle */}
            <button
              type="button"
              onClick={() => setShowFfwcStations(!showFfwcStations)}
              className={`w-full py-0.5 px-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer flex items-center justify-between ${
                showFfwcStations 
                  ? 'bg-sky-50 border-sky-300 text-sky-800' 
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <span>🌊 152 Stations</span>
              <span className="text-[9px] font-black">{filteredStations.length}</span>
            </button>

            {/* River Waterways Toggle */}
            <button
              type="button"
              onClick={() => setShowRivers(!showRivers)}
              className={`w-full py-0.5 px-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer flex items-center justify-between ${
                showRivers 
                  ? 'bg-cyan-50 border-cyan-300 text-cyan-800' 
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <span>〰️ 325 Rivers</span>
              <span className="text-[9px] font-black">HYDRO</span>
            </button>

            {/* Station Names Toggle */}
            <button
              type="button"
              onClick={() => setShowStationLabels(!showStationLabels)}
              className={`w-full py-0.5 px-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer flex items-center justify-between ${
                showStationLabels 
                  ? 'bg-slate-100 border-slate-300 text-slate-800' 
                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
              }`}
            >
              <span>Names On Map</span>
              {showStationLabels ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Floating Bottom Bar: Risk Legend & Preset Focus Buttons */}
      <div className="absolute bottom-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Left: Floating Legend Pill */}
        <div className="pointer-events-auto backdrop-blur-md bg-white/95 border border-slate-200/90 rounded-xl px-3 py-1 shadow-lg flex items-center gap-2.5 text-xs">
          <span className="font-black text-[9px] uppercase text-slate-400">Legend:</span>
          <span className="flex items-center gap-1 font-bold text-red-600 text-[10px]">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" /> Alert (&ge;37.5%)
          </span>
          <span className="flex items-center gap-1 font-bold text-amber-600 text-[10px]">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Watch (Halo)
          </span>
          <span className="flex items-center gap-1 font-bold text-emerald-600 text-[10px]">
            <span className="w-2 h-2 rounded-full bg-emerald-600" /> Safe (&lt;18%)
          </span>
          <span className="flex items-center gap-1 font-bold text-sky-600 text-[10px] hidden sm:flex">
            <span className="w-3 h-0.5 bg-sky-400 rounded" /> Rivers
          </span>
        </div>

        {/* Right: Floating Focus Preset Pills */}
        <div className="pointer-events-auto backdrop-blur-md bg-white/95 border border-slate-200/90 rounded-xl p-0.5 shadow-lg flex items-center gap-1 text-xs">
          <span className="text-[9px] text-slate-400 font-bold px-1.5">Focus:</span>
          <button
            type="button"
            onClick={() => setTargetView({ center: [23.8500, 90.3500], zoom: 7.4 })}
            className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-sky-100 text-slate-700 cursor-pointer transition-all"
          >
            🇧🇩 BD
          </button>
          <button
            type="button"
            onClick={() => setTargetView({ center: [25.0667, 91.4000], zoom: 9.5 })}
            className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 cursor-pointer transition-all"
          >
            🔴 Sunamganj
          </button>
          <button
            type="button"
            onClick={() => setTargetView({ center: [22.4642, 89.6000], zoom: 10 })}
            className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 cursor-pointer transition-all"
          >
            🟡 Mongla
          </button>
          <button
            type="button"
            onClick={() => setTargetView({ center: [23.7770, 90.4050], zoom: 11 })}
            className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-sky-100 text-slate-700 cursor-pointer transition-all"
          >
            📍 Dhaka
          </button>
        </div>

      </div>
    </div>
  );
}
