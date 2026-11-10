import React, { useState, useEffect } from 'react';
import { CloudRain, Plus, RefreshCw, Thermometer, Droplets, MapPin, Clock, Sparkles } from 'lucide-react';
import { apiRequest } from '../../src/services/apiClient';

const PRESETS = [
  { name: 'Dhaka Met Office (Agargaon)', lat: 23.7771, lon: 90.3742, rain: 48.5, temp: 28.2, humidity: 88, source: 'bmd-station' },
  { name: 'Mirpur-10 Drainage Basin', lat: 23.8071, lon: 90.3686, rain: 64.0, temp: 27.0, humidity: 93, source: 'urban-sensor' },
  { name: 'Dhanmondi Lake Pump', lat: 23.7465, lon: 90.3760, rain: 36.2, temp: 29.1, humidity: 85, source: 'lake-gauge' },
  { name: 'Sadarghat Riverfront', lat: 23.7058, lon: 90.4101, rain: 22.0, temp: 30.5, humidity: 81, source: 'river-station' }
];

export default function WeatherObservations() {
  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  const [form, setForm] = useState({
    location_name: '',
    latitude: '',
    longitude: '',
    rainfall_mm: '',
    temperature_c: '',
    humidity_percent: '',
    source: 'manual'
  });

  const loadObservations = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/weather/observations');
      setObservations(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadObservations();
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
        longitude: parseFloat(form.longitude),
        rainfall_mm: parseFloat(form.rainfall_mm),
        temperature_c: parseFloat(form.temperature_c),
        humidity_percent: parseFloat(form.humidity_percent),
        source: form.source.trim() || 'manual'
      };
      const res = await apiRequest('/weather/observations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setMsg(`Observation created for ${res.location_name}`);
      setForm({
        location_name: '',
        latitude: '',
        longitude: '',
        rainfall_mm: '',
        temperature_c: '',
        humidity_percent: '',
        source: 'manual'
      });
      loadObservations();
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
            <span className="badge badge-emerald">Basic API implemented</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status from Feature Inventory</span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>Weather observations</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Record weather measurements for localized urban flood modeling</p>
        </div>
        <button className="btn-secondary" onClick={loadObservations}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Preset bar */}
      <div style={{ background: '#0b1120', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Sparkles size={13} color="#38bdf8" /> Quick Fill Dhaka Presets:
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
                longitude: p.lon.toString(),
                rainfall_mm: p.rain.toString(),
                temperature_c: p.temp.toString(),
                humidity_percent: p.humidity.toString(),
                source: p.source
              })}
            >
              + {p.name} ({p.rain}mm)
            </button>
          ))}
        </div>
      </div>

      {error && <div style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}
      {msg && <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>✓ {msg}</div>}

      {/* Form */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <CloudRain size={18} color="#38bdf8" /> New Weather Observation
        </h3>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Location Name *</label>
              <input required value={form.location_name} onChange={e => setForm({...form, location_name: e.target.value})} placeholder="e.g. Agargaon Met Station" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Latitude (-90 to 90) *</label>
              <input required type="number" step="any" value={form.latitude} onChange={e => setForm({...form, latitude: e.target.value})} placeholder="23.7771" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Longitude (-180 to 180) *</label>
              <input required type="number" step="any" value={form.longitude} onChange={e => setForm({...form, longitude: e.target.value})} placeholder="90.3742" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Rainfall (mm) *</label>
              <input required type="number" step="any" min="0" value={form.rainfall_mm} onChange={e => setForm({...form, rainfall_mm: e.target.value})} placeholder="48.5" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Temperature (°C) *</label>
              <input required type="number" step="any" min="-90" max="65" value={form.temperature_c} onChange={e => setForm({...form, temperature_c: e.target.value})} placeholder="28.2" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Humidity (%) *</label>
              <input required type="number" step="any" min="0" max="100" value={form.humidity_percent} onChange={e => setForm({...form, humidity_percent: e.target.value})} placeholder="88" />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={formLoading}>
            <Plus size={15} /> {formLoading ? 'Submitting...' : 'Save Weather Observation'}
          </button>
        </form>
      </div>

      {/* Observations Grid */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Active In-Memory Observations ({observations.length})</h3>
        {observations.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No observations recorded yet. Fill the form above or pick a preset.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '0.85rem' }}>
            {observations.map(obs => (
              <div key={obs.id} style={{ background: '#0b1120', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#f8fafc' }}>{obs.location_name}</strong>
                  <span className="badge badge-blue">{obs.rainfall_mm} mm</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  [{obs.latitude.toFixed(4)}, {obs.longitude.toFixed(4)}] • Source: {obs.source}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                  <span>Temp: <strong style={{ color: '#f8fafc' }}>{obs.temperature_c}°C</strong></span>
                  <span>Humidity: <strong style={{ color: '#f8fafc' }}>{obs.humidity_percent}%</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

