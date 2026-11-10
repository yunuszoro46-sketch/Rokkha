import React, { useState } from 'react';
import { Ruler, Route, Sparkles } from 'lucide-react';
import { apiRequest } from '../../src/services/apiClient';

export default function GeographicDistance() {
  const [tab, setTab] = useState('point2point'); // 'point2point' | 'linestring'

  // Point to point state
  const [p1, setP1] = useState({ lat: '23.8071', lon: '90.3686', name: 'Mirpur-10' });
  const [p2, setP2] = useState({ lat: '23.7516', lon: '90.3780', name: 'Dhanmondi-32' });
  const [distResult, setDistResult] = useState(null);
  const [distLoading, setDistLoading] = useState(false);
  const [distError, setDistError] = useState(null);

  // LineString state
  const [lineJson, setLineJson] = useState(JSON.stringify({
    type: 'LineString',
    coordinates: [
      [90.3686, 23.8071], // Mirpur
      [90.3742, 23.7771], // Agargaon
      [90.3760, 23.7465], // Dhanmondi
      [90.4101, 23.7058]  // Sadarghat
    ]
  }, null, 2));
  const [lineResult, setLineResult] = useState(null);
  const [lineLoading, setLineLoading] = useState(false);
  const [lineError, setLineError] = useState(null);

  const calculateDistance = async (e) => {
    e.preventDefault();
    setDistLoading(true);
    setDistError(null);
    setDistResult(null);
    try {
      const res = await apiRequest('/geospatial/spatial-analysis/distance', {
        method: 'POST',
        body: JSON.stringify({
          point_a: { type: 'Point', coordinates: [parseFloat(p1.lon), parseFloat(p1.lat)] },
          point_b: { type: 'Point', coordinates: [parseFloat(p2.lon), parseFloat(p2.lat)] }
        })
      });
      setDistResult(res);
    } catch (err) {
      setDistError(err.message);
    } finally {
      setDistLoading(false);
    }
  };

  const calculateLineLength = async (e) => {
    e.preventDefault();
    setLineLoading(true);
    setLineError(null);
    setLineResult(null);
    try {
      const parsed = JSON.parse(lineJson);
      const res = await apiRequest('/geospatial/spatial-analysis/linestring-length', {
        method: 'POST',
        body: JSON.stringify({ line: parsed })
      });
      setLineResult(res);
    } catch (err) {
      setLineError(err.message);
    } finally {
      setLineLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-blue">Current milestone</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status from Feature Inventory</span>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>Geographic distance</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Calculate real-world distances on the WGS84 ellipsoid using GeographicLib</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          className={tab === 'point2point' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setTab('point2point')}
        >
          <Ruler size={15} /> Point-to-Point Distance
        </button>
        <button
          className={tab === 'linestring' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setTab('linestring')}
        >
          <Route size={15} /> LineString Path Length
        </button>
      </div>

      {tab === 'point2point' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Coordinates Input</h3>
            <form onSubmit={calculateDistance}>
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#0b1120', borderRadius: '0.4rem', border: '1px solid var(--border-color)' }}>
                <strong style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Point A (e.g. Origin)</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.4rem' }}>
                  <input type="number" step="any" placeholder="Latitude" value={p1.lat} onChange={e => setP1({...p1, lat: e.target.value})} required />
                  <input type="number" step="any" placeholder="Longitude" value={p1.lon} onChange={e => setP1({...p1, lon: e.target.value})} required />
                </div>
              </div>

              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#0b1120', borderRadius: '0.4rem', border: '1px solid var(--border-color)' }}>
                <strong style={{ fontSize: '0.8rem', color: '#34d399' }}>Point B (e.g. Destination)</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.4rem' }}>
                  <input type="number" step="any" placeholder="Latitude" value={p2.lat} onChange={e => setP2({...p2, lat: e.target.value})} required />
                  <input type="number" step="any" placeholder="Longitude" value={p2.lon} onChange={e => setP2({...p2, lon: e.target.value})} required />
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={distLoading} style={{ width: '100%', justifyContent: 'center' }}>
                {distLoading ? 'Computing Ellipsoidal Geodesic...' : 'Calculate Distance'}
              </button>
            </form>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>WGS84 Geodesic Output</h3>
            {distError && <div style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}>{distError}</div>}
            {!distResult && !distError && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Provide Point A and Point B to calculate surface geodesic distance.</p>}
            {distResult && (
              <div>
                <div style={{ background: '#0b1120', border: '1px solid var(--border-color)', borderRadius: '0.6rem', padding: '1.25rem', textAlign: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Kilometers</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#38bdf8' }}>
                    {distResult.distance_kilometers.toFixed(3)} <span style={{ fontSize: '1rem' }}>km</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    ({distResult.distance_meters.toFixed(1)} meters)
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <strong>Calculation method:</strong> {distResult.method || 'WGS84 geodesic'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'linestring' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Evacuation Route / Drainage LineString</h3>
            <form onSubmit={calculateLineLength}>
              <textarea rows={10} value={lineJson} onChange={e => setLineJson(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginBottom: '1rem' }} />
              <button type="submit" className="btn-primary" disabled={lineLoading} style={{ width: '100%', justifyContent: 'center' }}>
                {lineLoading ? 'Calculating Path...' : 'Calculate Line Length'}
              </button>
            </form>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Path Length Result</h3>
            {lineError && <div style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}>{lineError}</div>}
            {!lineResult && !lineError && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Submit LineString to calculate total route length.</p>}
            {lineResult && (
              <div style={{ background: '#0b1120', border: '1px solid var(--border-color)', borderRadius: '0.6rem', padding: '1.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Path Length</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#34d399' }}>
                  {lineResult.length_kilometers.toFixed(3)} <span style={{ fontSize: '1rem' }}>km</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  ({lineResult.length_meters.toFixed(1)} meters)
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

