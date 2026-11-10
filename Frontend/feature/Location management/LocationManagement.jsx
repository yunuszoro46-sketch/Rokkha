import React, { useState, useEffect } from 'react';
import { MapPin, Plus, RefreshCw, Sparkles, Globe } from 'lucide-react';
import { apiRequest } from '../../src/services/apiClient';

const PRESETS = [
  { name: 'Mirpur-10 Circle', lat: 23.8071, lon: 90.3686 },
  { name: 'Dhanmondi Lake Pump', lat: 23.7516, lon: 90.3780 },
  { name: 'Gulshan-2 Circle', lat: 23.7925, lon: 90.4167 },
  { name: 'Uttara Sector 3 Station', lat: 23.8690, lon: 90.3980 },
  { name: 'Sadarghat Terminal', lat: 23.7058, lon: 90.4101 }
];

export default function LocationManagement() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  const [form, setForm] = useState({
    location_name: '',
    latitude: '',
    longitude: ''
  });

  const loadLocations = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/geospatial/locations');
      setLocations(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);
    setMsg(null);
    try {
      const payload = {
        location_name: form.location_name.trim(),
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude)
      };
      const res = await apiRequest('/geospatial/locations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setMsg(`Location registered: ${res.location_name}`);
      setForm({ location_name: '', latitude: '', longitude: '' });
      loadLocations();
    } catch (err) {
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="badge badge-emerald">Implemented with temporary storage</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status from Feature Inventory</span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>Location management</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Store and query geographic locations & GeoJSON points</p>
        </div>
        <button className="btn-secondary" onClick={loadLocations}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Presets */}
      <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Sparkles size={13} color="#34d399" /> Quick Presets for Dhaka Locations:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
              onClick={() => setForm({
                location_name: p.name,
                latitude: p.lat.toString(),
                longitude: p.lon.toString()
              })}
            >
              + {p.name}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}
      {msg && <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>✓ {msg}</div>}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <MapPin size={18} color="#34d399" /> Add New Location Record
        </h3>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Location Name *</label>
              <input required value={form.location_name} onChange={e => setForm({...form, location_name: e.target.value})} placeholder="e.g. Mirpur Pump 2" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Latitude (-90 to 90) *</label>
              <input required type="number" step="any" value={form.latitude} onChange={e => setForm({...form, latitude: e.target.value})} placeholder="23.8071" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Longitude (-180 to 180) *</label>
              <input required type="number" step="any" value={form.longitude} onChange={e => setForm({...form, longitude: e.target.value})} placeholder="90.3686" />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={formLoading} style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}>
            <Plus size={15} /> {formLoading ? 'Saving...' : 'Register Location'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Saved Locations ({locations.length})</h3>
        {locations.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No locations stored yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
            {locations.map(loc => (
              <div key={loc.id} style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{loc.location_name}</strong>
                  <span className="badge badge-emerald">Point</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  Lat: {loc.latitude.toFixed(6)} | Lon: {loc.longitude.toFixed(6)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                  GeoJSON: [{loc.geometry?.coordinates?.join(', ') || `${loc.longitude}, ${loc.latitude}`}]
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

