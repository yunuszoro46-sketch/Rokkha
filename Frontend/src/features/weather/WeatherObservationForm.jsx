import React, { useState } from 'react';
import { CloudRain, Plus, Sparkles } from 'lucide-react';
import { createWeatherObservation } from './weatherApi';

const DHAKA_PRESETS = [
  { name: 'Dhaka Met Office (Agargaon)', lat: 23.7771, lon: 90.3742, rain: 45.2, temp: 28.5, humidity: 88, source: 'bmd-station' },
  { name: 'Mirpur Section 10', lat: 23.8071, lon: 90.3686, rain: 62.0, temp: 27.2, humidity: 92, source: 'urban-sensor' },
  { name: 'Dhanmondi Lake Basin', lat: 23.7465, lon: 90.3760, rain: 35.8, temp: 29.0, humidity: 84, source: 'community-gauge' },
  { name: 'Old Dhaka (Sadarghat)', lat: 23.7058, lon: 90.4101, rain: 18.5, temp: 31.0, humidity: 79, source: 'river-monitor' },
];

export default function WeatherObservationForm({ onObservationAdded }) {
  const [formData, setFormData] = useState({
    location_name: '',
    latitude: '',
    longitude: '',
    rainfall_mm: '',
    temperature_c: '',
    humidity_percent: '',
    source: 'manual',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const applyPreset = (preset) => {
    setFormData({
      location_name: preset.name,
      latitude: preset.lat.toString(),
      longitude: preset.lon.toString(),
      rainfall_mm: preset.rain.toString(),
      temperature_c: preset.temp.toString(),
      humidity_percent: preset.humidity.toString(),
      source: preset.source,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        location_name: formData.location_name.trim(),
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        rainfall_mm: parseFloat(formData.rainfall_mm),
        temperature_c: parseFloat(formData.temperature_c),
        humidity_percent: parseFloat(formData.humidity_percent),
        source: formData.source.trim() || 'manual',
      };

      const result = await createWeatherObservation(payload);
      setSuccessMsg(`Recorded observation for "${result.location_name}"`);
      setFormData({
        location_name: '',
        latitude: '',
        longitude: '',
        rainfall_mm: '',
        temperature_c: '',
        humidity_percent: '',
        source: 'manual',
      });
      if (onObservationAdded) onObservationAdded(result);
    } catch (err) {
      setError(err.message || 'Failed to submit observation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.5rem', borderRadius: '0.5rem' }}>
            <CloudRain size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Record Weather Observation</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Submit rainfall, temperature, and atmospheric readings for localized flood analysis
            </p>
          </div>
        </div>
      </div>

      {/* Dhaka Presets */}
      <div style={{ marginBottom: '1.25rem', padding: '0.75rem', background: '#0b1120', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
          <Sparkles size={14} color="#38bdf8" /> Quick Dhaka Simulation Presets:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {DHAKA_PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(p)}
              style={{
                fontSize: '0.75rem',
                padding: '0.3rem 0.6rem',
                borderRadius: '0.35rem',
                background: '#1e293b',
                color: '#cbd5e1',
                border: '1px solid #334155'
              }}
            >
              + {p.name} ({p.rain}mm)
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185', fontSize: '0.85rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', fontSize: '0.85rem', marginBottom: '1rem' }}>
          ✓ {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Station / Location Name *
            </label>
            <input
              type="text"
              name="location_name"
              placeholder="e.g. Dhaka Met Office (Agargaon)"
              value={formData.location_name}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Latitude (-90 to 90) *
            </label>
            <input
              type="number"
              step="any"
              name="latitude"
              placeholder="e.g. 23.7771"
              value={formData.latitude}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Longitude (-180 to 180) *
            </label>
            <input
              type="number"
              step="any"
              name="longitude"
              placeholder="e.g. 90.3742"
              value={formData.longitude}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Rainfall (mm) *
            </label>
            <input
              type="number"
              step="any"
              min="0"
              name="rainfall_mm"
              placeholder="e.g. 45.0"
              value={formData.rainfall_mm}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Temperature (°C) *
            </label>
            <input
              type="number"
              step="any"
              min="-90"
              max="65"
              name="temperature_c"
              placeholder="e.g. 28.5"
              value={formData.temperature_c}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Humidity (%) *
            </label>
            <input
              type="number"
              step="any"
              min="0"
              max="100"
              name="humidity_percent"
              placeholder="e.g. 85"
              value={formData.humidity_percent}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Source Identifier
            </label>
            <input
              type="text"
              name="source"
              placeholder="e.g. manual / sensor / bmd"
              value={formData.source}
              onChange={handleChange}
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          <Plus size={16} />
          {loading ? 'Submitting...' : 'Save Weather Observation'}
        </button>
      </form>
    </div>
  );
}

