import React from 'react';
import { MapPin, Globe, ExternalLink } from 'lucide-react';

export default function LocationList({ locations, loading }) {
  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        Loading location points...
      </div>
    );
  }

  if (!locations || locations.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <MapPin size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.5 }} />
        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No registered locations</h4>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Add locations above to start monitoring geographic points and risk zones.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
          Registered Locations ({locations.length})
        </h3>
        <span className="badge badge-emerald">GeoJSON Validated</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {locations.map((loc) => {
          const [lon, lat] = loc.geometry?.coordinates || [loc.longitude, loc.latitude];
          return (
            <div
              key={loc.id}
              style={{
                background: '#0b1120',
                border: '1px solid var(--border-color)',
                borderRadius: '0.6rem',
                padding: '1.1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#0891b2', padding: '0.4rem', borderRadius: '0.4rem' }}>
                    <MapPin size={16} />
                  </div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                    {loc.location_name}
                  </h4>
                </div>
                <span className="badge" style={{ background: '#1e293b', color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                  {loc.id.substring(0, 8)}...
                </span>
              </div>

              <div style={{ background: '#131e33', padding: '0.75rem', borderRadius: '0.4rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Latitude:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8', fontWeight: 600 }}>{loc.latitude.toFixed(6)}° N</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Longitude:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8', fontWeight: 600 }}>{loc.longitude.toFixed(6)}° E</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>GeoJSON Point:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#0891b2', fontSize: '0.7rem' }}>
                    [{lon}, {lat}]
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${loc.latitude}&mlon=${loc.longitude}#map=16/${loc.latitude}/${loc.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.75rem',
                    color: '#38bdf8',
                    textDecoration: 'none'
                  }}
                >
                  <Globe size={13} /> Open in Map <ExternalLink size={11} />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

