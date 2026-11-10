import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { apiRequest } from '../../src/services/apiClient';

const PRESETS = [
  {
    name: 'Dhanmondi Catchment Area',
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
    insidePoint: [90.3760, 23.7465], // [lon, lat]
    outsidePoint: [90.4167, 23.7925]
  },
  {
    name: 'Turag River Floodplain',
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
    insidePoint: [90.3350, 23.8100],
    outsidePoint: [90.3686, 23.8071]
  }
];

export default function PointInPolygon() {
  const [pointLat, setPointLat] = useState('23.7465');
  const [pointLon, setPointLon] = useState('90.3760');
  const [polygonJson, setPolygonJson] = useState(JSON.stringify(PRESETS[0].polygon, null, 2));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const applyPreset = (p, isInside) => {
    setPolygonJson(JSON.stringify(p.polygon, null, 2));
    const pt = isInside ? p.insidePoint : p.outsidePoint;
    setPointLon(pt[0].toString());
    setPointLat(pt[1].toString());
  };

  const handleRun = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const parsedPoly = JSON.parse(polygonJson);
      const res = await apiRequest('/geospatial/spatial-analysis/point-in-polygon', {
        method: 'POST',
        body: JSON.stringify({
          point: {
            type: 'Point',
            coordinates: [parseFloat(pointLon), parseFloat(pointLat)]
          },
          polygon: parsedPoly
        })
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-emerald">Implemented and tested</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status from Feature Inventory</span>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>Point-in-Polygon</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Determine geographic containment (inside, boundary, outside) using Shapely planar geometry</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <button className="btn-secondary" onClick={() => applyPreset(PRESETS[0], true)}>
          <Sparkles size={13} color="#38bdf8" /> Dhanmondi Basin (Inside)
        </button>
        <button className="btn-secondary" onClick={() => applyPreset(PRESETS[0], false)}>
          <Sparkles size={13} color="#fbbf24" /> Gulshan (Outside Dhanmondi)
        </button>
        <button className="btn-secondary" onClick={() => applyPreset(PRESETS[1], true)}>
          <Sparkles size={13} color="#38bdf8" /> Turag Floodplain (Inside)
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <div className="card">
          <form onSubmit={handleRun}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Latitude</label>
                <input required type="number" step="any" value={pointLat} onChange={e => setPointLat(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Longitude</label>
                <input required type="number" step="any" value={pointLon} onChange={e => setPointLon(e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>GeoJSON Polygon</label>
              <textarea rows={8} value={polygonJson} onChange={e => setPolygonJson(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }} />
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Evaluating...' : 'Check Containment'}
            </button>
          </form>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Spatial Result</h3>
          {error && <div style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}>{error}</div>}
          {!result && !error && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Run evaluation to test point against polygon.</p>}
          {result && (
            <div>
              <div style={{
                padding: '1rem',
                borderRadius: '0.5rem',
                marginBottom: '1rem',
                background: result.relationship === 'inside' ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)',
                border: result.relationship === 'inside' ? '1px solid rgba(244,63,94,0.4)' : '1px solid rgba(16,185,129,0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                {result.relationship === 'inside' ? <AlertCircle size={32} color="#fb7185" /> : <CheckCircle2 size={32} color="#34d399" />}
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Relationship</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, textTransform: 'capitalize', color: '#f8fafc' }}>
                    {result.relationship}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center' }}>
                <div style={{ background: '#0b1120', padding: '0.6rem', borderRadius: '0.4rem' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Covered</div>
                  <div style={{ fontWeight: 700, color: result.covered ? '#38bdf8' : '#94a3b8' }}>{result.covered ? 'TRUE' : 'FALSE'}</div>
                </div>
                <div style={{ background: '#0b1120', padding: '0.6rem', borderRadius: '0.4rem' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Strictly Inside</div>
                  <div style={{ fontWeight: 700, color: result.strictly_inside ? '#fb7185' : '#94a3b8' }}>{result.strictly_inside ? 'TRUE' : 'FALSE'}</div>
                </div>
                <div style={{ background: '#0b1120', padding: '0.6rem', borderRadius: '0.4rem' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Boundary</div>
                  <div style={{ fontWeight: 700, color: result.on_boundary ? '#fbbf24' : '#94a3b8' }}>{result.on_boundary ? 'TRUE' : 'FALSE'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

