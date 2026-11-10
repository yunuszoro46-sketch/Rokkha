import React, { useState } from 'react';
import { DownloadCloud, Play, CheckCircle, Clock, Server } from 'lucide-react';

const FEEDS = [
  { id: 'bmd', name: 'Bangladesh Meteorological Dept (BMD) Radar', interval: 'Every 15 min', status: 'Standby', format: 'GeoTIFF / NetCDF', coverage: 'Greater Dhaka' },
  { id: 'openmeteo', name: 'Open-Meteo High-Resolution Ensemble', interval: 'Hourly', status: 'Ready to connect', format: 'JSON REST', coverage: '23.6-23.9°N, 90.3-90.5°E' },
  { id: 'ecmwf', name: 'ECMWF ERA5 / IFS Forecast', interval: 'Every 6 hours', status: 'Planned', format: 'GRIB2', coverage: 'South Asia Basin' },
  { id: 'bwdb', name: 'BWDB Hydrology Rainfall Loggers', interval: 'Every 30 min', status: 'Scheduled', format: 'CSV Stream', coverage: '5 Catchment Gauges' }
];

export default function WeatherIngestion() {
  const [activeFeeds, setActiveFeeds] = useState(FEEDS);
  const [ingesting, setIngesting] = useState(false);
  const [log, setLog] = useState([]);

  const triggerIngestion = () => {
    setIngesting(true);
    setLog(prev => [`[${new Date().toLocaleTimeString()}] Triggering manual ingestion cycle...`, ...prev]);
    setTimeout(() => {
      setLog(prev => [
        `[${new Date().toLocaleTimeString()}] Ingested 42 grid cell points from Open-Meteo (Dhaka Grid)`,
        `[${new Date().toLocaleTimeString()}] Received BMD radar reflectivity payload`,
        ...prev
      ]);
      setIngesting(false);
    }, 1200);
  };

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-amber">Planned</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status from Feature Inventory</span>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>Weather ingestion</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Automated scheduled ingestion of precipitation, barometric, and radar data from external weather services</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn-primary" onClick={triggerIngestion} disabled={ingesting}>
          <Play size={14} /> {ingesting ? 'Running Ingestion Pipeline...' : 'Test Ingestion Cycle'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Server size={18} color="#38bdf8" /> External Ingestion Pipelines ({activeFeeds.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activeFeeds.map(feed => (
              <div key={feed.id} style={{ background: '#0b1120', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                  <strong style={{ fontSize: '0.875rem', color: '#f8fafc' }}>{feed.name}</strong>
                  <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>{feed.status}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Freq: {feed.interval}</span>
                  <span>Format: {feed.format}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} color="#34d399" /> Ingestion Activity Logs
          </h3>
          <div style={{ background: '#0b1120', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.75rem', minHeight: '180px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#94a3b8' }}>
            {log.length === 0 ? (
              <span style={{ color: 'var(--text-muted)' }}>No recent ingestion activity. Click "Test Ingestion Cycle" to simulate.</span>
            ) : (
              log.map((line, idx) => (
                <div key={idx} style={{ marginBottom: '0.35rem', color: idx === 0 ? '#38bdf8' : '#94a3b8' }}>{line}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

