import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, AlertCircle, XCircle, Sparkles, Compass } from 'lucide-react';
import { analyzePointInPolygon } from './pipApi';

const ZONE_PRESETS = [
  {
    name: 'Dhanmondi Catchment Zone',
    description: 'High-density urban depression with poor drainage outlet',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [90.365, 23.735],
          [90.385, 23.735],
          [90.385, 23.760],
          [90.365, 23.760],
          [90.365, 23.735]
        ]
      ]
    },
    samplePointInside: { lat: 23.7465, lon: 90.3760, label: 'Dhanmondi Lake 32 (Inside)' },
    samplePointOutside: { lat: 23.7925, lon: 90.4167, label: 'Gulshan 2 (Outside)' },
    samplePointBoundary: { lat: 23.7350, lon: 90.3750, label: 'Southern Boundary (Edge)' }
  },
  {
    name: 'Turag River Floodplain (Western Embankment)',
    description: 'Low-elevation riverside marshland prone to seasonal inundation',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [90.320, 23.780],
          [90.355, 23.780],
          [90.355, 23.840],
          [90.320, 23.840],
          [90.320, 23.780]
        ]
      ]
    },
    samplePointInside: { lat: 23.8100, lon: 90.3350, label: 'Turag Lowlands (Inside)' },
    samplePointOutside: { lat: 23.8071, lon: 90.3686, label: 'Mirpur 10 (Outside)' },
    samplePointBoundary: { lat: 23.7800, lon: 90.3400, label: 'Southern Perimeter (Edge)' }
  }
];

export default function PointInPolygonFeature() {
  const [selectedPreset, setSelectedPreset] = useState(ZONE_PRESETS[0]);
  const [pointLat, setPointLat] = useState('23.7465');
  const [pointLon, setPointLon] = useState('90.3760');
  const [polygonJson, setPolygonJson] = useState(JSON.stringify(ZONE_PRESETS[0].polygon, null, 2));
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset);
    setPolygonJson(JSON.stringify(preset.polygon, null, 2));
    setPointLat(preset.samplePointInside.lat.toString());
    setPointLon(preset.samplePointInside.lon.toString());
    setAnalysisResult(null);
    setError(null);
  };

  const handleAnalyze = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const lat = parseFloat(pointLat);
      const lon = parseFloat(pointLon);
      if (isNaN(lat) || isNaN(lon)) {
        throw new Error('Please enter valid numeric latitude and longitude');
      }

      let parsedPolygon;
      try {
        parsedPolygon = JSON.parse(polygonJson);
      } catch {
        throw new Error('Invalid GeoJSON syntax for Polygon/MultiPolygon');
      }

      // GeoJSON coordinate order is [longitude, latitude]
      const result = await analyzePointInPolygon([lon, lat], parsedPolygon);
      setAnalysisResult(result);
    } catch (err) {
      setError(err.message || 'Spatial analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <ShieldAlert size={26} color="#f59e0b" /> Flood Zone Containment (Point-in-Polygon)
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
          Evaluate whether specific coordinates fall within designated flood perimeters using planar Shapely geometry
        </p>
      </div>

      {/* Preset Selector */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Sparkles size={16} color="#f59e0b" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Select Designated Risk Zone:</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {ZONE_PRESETS.map((preset, idx) => {
            const isSelected = selectedPreset.name === preset.name;
            return (
              <div
                key={idx}
                onClick={() => handleSelectPreset(preset)}
                style={{
                  background: isSelected ? '#192640' : '#0b1120',
                  border: isSelected ? '2px solid #38bdf8' : '1px solid var(--border-color)',
                  borderRadius: '0.6rem',
                  padding: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isSelected ? '#38bdf8' : '#f8fafc' }}>
                  {preset.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {preset.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Input Panel */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Compass size={18} color="#38bdf8" /> Target Coordinates
          </h3>

          {/* Quick Point Presets */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              onClick={() => {
                setPointLat(selectedPreset.samplePointInside.lat.toString());
                setPointLon(selectedPreset.samplePointInside.lon.toString());
              }}
            >
              📍 Inside Point
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              onClick={() => {
                setPointLat(selectedPreset.samplePointOutside.lat.toString());
                setPointLon(selectedPreset.samplePointOutside.lon.toString());
              }}
            >
              📍 Outside Point
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              onClick={() => {
                setPointLat(selectedPreset.samplePointBoundary.lat.toString());
                setPointLon(selectedPreset.samplePointBoundary.lon.toString());
              }}
            >
              📍 Boundary Point
            </button>
          </div>

          <form onSubmit={handleAnalyze}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={pointLat}
                  onChange={(e) => setPointLat(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={pointLon}
                  onChange={(e) => setPointLon(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                GeoJSON Polygon Definition
              </label>
              <textarea
                rows={7}
                value={polygonJson}
                onChange={(e) => setPolygonJson(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', lineHeight: '1.4' }}
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Analyzing Geometry...' : 'Run Point-in-Polygon Check'}
            </button>
          </form>
        </div>

        {/* Output Panel */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
            Containment Results
          </h3>

          {error && (
            <div style={{ padding: '1rem', borderRadius: '0.5rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {!analysisResult && !error && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <ShieldAlert size={40} style={{ opacity: 0.3, margin: '0 auto 0.75rem', display: 'block' }} />
              <p style={{ fontSize: '0.875rem' }}>Click "Run Point-in-Polygon Check" to calculate spatial containment</p>
            </div>
          )}

          {analysisResult && (
            <div>
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '0.75rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  background: analysisResult.relationship === 'inside'
                    ? 'rgba(244, 63, 94, 0.15)'
                    : analysisResult.relationship === 'boundary'
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(6, 182, 212, 0.15)',
                  border: analysisResult.relationship === 'inside'
                    ? '1px solid rgba(244, 63, 94, 0.4)'
                    : analysisResult.relationship === 'boundary'
                    ? '1px solid rgba(245, 158, 11, 0.4)'
                    : '1px solid rgba(6, 182, 212, 0.4)',
                }}
              >
                {analysisResult.relationship === 'inside' && <AlertCircle size={36} color="#fb7185" />}
                {analysisResult.relationship === 'boundary' && <ShieldAlert size={36} color="#fbbf24" />}
                {analysisResult.relationship === 'outside' && <CheckCircle2 size={36} color="#0891b2" />}

                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                    Spatial Relationship
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, textTransform: 'capitalize', color: '#f8fafc' }}>
                    {analysisResult.relationship} Zone
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ background: '#0b1120', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Covered</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: analysisResult.covered ? '#38bdf8' : '#94a3b8', marginTop: '0.2rem' }}>
                    {analysisResult.covered ? 'TRUE' : 'FALSE'}
                  </div>
                </div>

                <div style={{ background: '#0b1120', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Strictly Inside</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: analysisResult.strictly_inside ? '#fb7185' : '#94a3b8', marginTop: '0.2rem' }}>
                    {analysisResult.strictly_inside ? 'TRUE' : 'FALSE'}
                  </div>
                </div>

                <div style={{ background: '#0b1120', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>On Boundary</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: analysisResult.on_boundary ? '#fbbf24' : '#94a3b8', marginTop: '0.2rem' }}>
                    {analysisResult.on_boundary ? 'TRUE' : 'FALSE'}
                  </div>
                </div>
              </div>

              <div style={{ background: '#0b1120', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <strong>Technical interpretation:</strong>
                {analysisResult.relationship === 'inside' && (
                  <p style={{ marginTop: '0.25rem' }}>
                    The target point is strictly inside the polygon interior. In operational modeling, this point intersects the defined flood-risk zone.
                  </p>
                )}
                {analysisResult.relationship === 'boundary' && (
                  <p style={{ marginTop: '0.25rem' }}>
                    The point lies exactly on the perimeter boundary of the polygon.
                  </p>
                )}
                {analysisResult.relationship === 'outside' && (
                  <p style={{ marginTop: '0.25rem' }}>
                    The point is exterior to the risk area or falls within a polygon hole.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

