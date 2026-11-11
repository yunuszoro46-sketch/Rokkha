import React from 'react';
import { CloudRain, Thermometer, Droplets, MapPin, Clock, Calendar } from 'lucide-react';

export default function WeatherObservationList({ observations, loading }) {
  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        Loading weather observations...
      </div>
    );
  }

  if (!observations || observations.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <CloudRain size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.5 }} />
        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No weather observations yet</h4>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Use the form above or click a Dhaka simulation preset to submit real-time climate data.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
          Recorded Observations ({observations.length})
        </h3>
        <span className="badge badge-blue">In-Memory Active API</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1rem' }}>
        {observations.map((obs) => {
          const isHeavyRain = obs.rainfall_mm > 50;
          return (
            <div
              key={obs.id}
              style={{
                background: '#0b1120',
                border: '1px solid var(--border-color)',
                borderRadius: '0.6rem',
                padding: '1.1rem',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {isHeavyRain && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    background: '#f43f5e',
                    color: '#fff',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderBottomLeftRadius: '0.4rem',
                    textTransform: 'uppercase'
                  }}
                >
                  High Rainfall
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', marginBottom: '0.8rem' }}>
                <MapPin size={18} color="#38bdf8" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                    {obs.location_name}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    [{obs.latitude.toFixed(4)}, {obs.longitude.toFixed(4)}]
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.8rem' }}>
                <div style={{ background: '#131e33', padding: '0.6rem', borderRadius: '0.4rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: '#38bdf8', fontSize: '0.7rem' }}>
                    <CloudRain size={13} /> Rain
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: isHeavyRain ? '#fb7185' : '#f8fafc', marginTop: '0.2rem' }}>
                    {obs.rainfall_mm} <span style={{ fontSize: '0.7rem', fontWeight: 400 }}>mm</span>
                  </div>
                </div>

                <div style={{ background: '#131e33', padding: '0.6rem', borderRadius: '0.4rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: '#fb923c', fontSize: '0.7rem' }}>
                    <Thermometer size={13} /> Temp
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>
                    {obs.temperature_c}°<span style={{ fontSize: '0.7rem', fontWeight: 400 }}>C</span>
                  </div>
                </div>

                <div style={{ background: '#131e33', padding: '0.6rem', borderRadius: '0.4rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: '#0891b2', fontSize: '0.7rem' }}>
                    <Droplets size={13} /> Humidity
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>
                    {obs.humidity_percent}<span style={{ fontSize: '0.7rem', fontWeight: 400 }}>%</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.725rem', color: 'var(--text-muted)', paddingTop: '0.5rem', borderTop: '1px solid #1e293b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Clock size={12} /> {new Date(obs.observed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="badge" style={{ background: '#1e293b', color: 'var(--text-secondary)', padding: '0.15rem 0.5rem' }}>
                  {obs.source || 'manual'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

