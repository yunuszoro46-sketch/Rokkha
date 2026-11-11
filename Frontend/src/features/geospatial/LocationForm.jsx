import React, { useState } from 'react';
import { MapPin, Plus, Sparkles } from 'lucide-react';
import { createLocation } from './geospatialApi';

const DHAKA_LOCATION_PRESETS = [
  { name: 'Mirpur Section 10 Circle', lat: 23.8071, lon: 90.3686 },
  { name: 'Dhanmondi Lake 32', lat: 23.7516, lon: 90.3780 },
  { name: 'Gulshan 2 Circle', lat: 23.7925, lon: 90.4167 },
  { name: 'Uttara Sector 3 Jashimuddin', lat: 23.8690, lon: 90.3980 },
  { name: 'Sadarghat Launch Terminal', lat: 23.7058, lon: 90.4101 },
  { name: 'Tejgaon Industrial Area', lat: 23.7663, lon: 90.3987 },
];

export default function LocationForm({ onLocationAdded }) {
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const applyPreset = (preset) => {
    setLocationName(preset.name);
    setLatitude(preset.lat.toString());
    setLongitude(preset.lon.toString());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        location_name: locationName.trim(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      };

      const result = await createLocation(payload);
      setSuccessMsg(`Registered location "${result.location_name}"`);
      setLocationName('');
      setLatitude('');
      setLongitude('');
      if (onLocationAdded) onLocationAdded(result);
    } catch (err) {
      setError(err.message || 'Failed to add location');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
        <div style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#0891b2', padding: '0.5rem', borderRadius: '0.5rem' }}>
          <MapPin size={20} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Add Geographic Location</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Register critical infrastructure, pump stations, or vulnerability checkpoints
          </p>
        </div>
      </div>

      {/* Dhaka Presets */}
      <div style={{ marginBottom: '1.25rem', padding: '0.75rem', background: '#0b1120', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
          <Sparkles size={14} color="#0891b2" /> Quick Dhaka Coordinates:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {DHAKA_LOCATION_PRESETS.map((p, idx) => (
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
              + {p.name}
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
        <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', color: '#0891b2', fontSize: '0.85rem', marginBottom: '1rem' }}>
          ✓ {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Location Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Dhanmondi Lake Pump"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
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
              placeholder="e.g. 23.7516"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
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
              placeholder="e.g. 90.3780"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              required
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" style={{ background: 'linear-gradient(135deg, #0891b2, #0e7490)' }} disabled={loading}>
          <Plus size={16} />
          {loading ? 'Creating Location...' : 'Save Location'}
        </button>
      </form>
    </div>
  );
}

