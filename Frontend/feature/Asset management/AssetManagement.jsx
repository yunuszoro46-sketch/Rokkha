import React, { useState } from 'react';
import { Building2, Plus, Shield, MapPin, Sparkles } from 'lucide-react';

const INITIAL_ASSETS = [
  { id: 'ast-1', name: 'Dhaka Medical College Hospital', category: 'Healthcare', lat: 23.7259, lon: 90.3976, criticality: 'Tier-1 Critical', elevationMeters: 7.2 },
  { id: 'ast-2', name: 'Sayedabad Water Treatment Plant', category: 'Utility', lat: 23.7150, lon: 90.4320, criticality: 'Tier-1 Critical', elevationMeters: 4.8 },
  { id: 'ast-3', name: 'Mirpur WASA Sewage Pump 4', category: 'Sanitation', lat: 23.8150, lon: 90.3550, criticality: 'Tier-2 High', elevationMeters: 5.1 },
  { id: 'ast-4', name: 'Dhanmondi Govt. Boys High School (Shelter)', category: 'Shelter', lat: 23.7480, lon: 90.3790, criticality: 'Tier-2 High', elevationMeters: 8.5 }
];

export default function AssetManagement() {
  const [assets, setAssets] = useState(INITIAL_ASSETS);
  const [form, setForm] = useState({ name: '', category: 'Healthcare', lat: '', lon: '', criticality: 'Tier-1 Critical', elevationMeters: '' });
  const [msg, setMsg] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const newAsset = {
      id: `ast-${Date.now()}`,
      name: form.name.trim(),
      category: form.category,
      lat: parseFloat(form.lat),
      lon: parseFloat(form.lon),
      criticality: form.criticality,
      elevationMeters: parseFloat(form.elevationMeters || 6.0)
    };
    setAssets([newAsset, ...assets]);
    setMsg(`Registered asset: ${newAsset.name}`);
    setForm({ name: '', category: 'Healthcare', lat: '', lon: '', criticality: 'Tier-1 Critical', elevationMeters: '' });
  };

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-cyan">Planned</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status from Feature Inventory</span>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>Asset management</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Register protected critical urban infrastructure, pumps, healthcare facilities, and flood shelters</p>
      </div>

      {msg && <div style={{ background: 'rgba(6, 182, 212,0.15)', border: '1px solid rgba(6, 182, 212,0.3)', color: '#0891b2', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>✓ {msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={18} color="#38bdf8" /> Register Critical Urban Asset
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Asset Name *</label>
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Kurmitola General Hospital" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Category</label>
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  <option>Healthcare</option>
                  <option>Utility</option>
                  <option>Sanitation</option>
                  <option>Shelter</option>
                  <option>Transportation</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Criticality</label>
                <select value={form.criticality} onChange={e => setForm({...form, criticality: e.target.value})}>
                  <option>Tier-1 Critical</option>
                  <option>Tier-2 High</option>
                  <option>Tier-3 Moderate</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Latitude</label>
                <input required type="number" step="any" value={form.lat} onChange={e => setForm({...form, lat: e.target.value})} placeholder="23.82" />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Longitude</label>
                <input required type="number" step="any" value={form.lon} onChange={e => setForm({...form, lon: e.target.value})} placeholder="90.41" />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Elevation (m)</label>
                <input type="number" step="any" value={form.elevationMeters} onChange={e => setForm({...form, elevationMeters: e.target.value})} placeholder="6.5" />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              <Plus size={15} /> Save Protected Asset
            </button>
          </form>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Protected Asset Inventory ({assets.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {assets.map(a => (
              <div key={a.id} style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                  <strong style={{ fontSize: '0.875rem', color: '#0f172a' }}>{a.name}</strong>
                  <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>{a.criticality}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Category: {a.category}</span>
                  <span>Coords: [{a.lat.toFixed(4)}, {a.lon.toFixed(4)}]</span>
                  <span>Elevation: {a.elevationMeters}m</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

