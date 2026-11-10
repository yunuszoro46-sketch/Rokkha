import React, { useState } from 'react';
import { AlertCircle, CheckCircle, ShieldAlert, Filter } from 'lucide-react';

const EXPOSURE_DATA = [
  { assetName: 'Mirpur WASA Sewage Pump 4', category: 'Sanitation', zone: 'Turag Floodplain', floodDepthEst: '0.8m', exposureLevel: 'Critical', impact: 'Submersion risk of primary electrical generator' },
  { assetName: 'Sayedabad Water Treatment Plant', category: 'Utility', zone: 'DND Polder Outskirts', floodDepthEst: '0.3m', exposureLevel: 'High', impact: 'Intake sludge contamination risk' },
  { assetName: 'Dhanmondi Lake Pump', category: 'Drainage', zone: 'Dhanmondi Catchment', floodDepthEst: '0.15m', exposureLevel: 'Moderate', impact: 'Pump capacity operating at 95%' },
  { assetName: 'Dhaka Medical College Hospital', category: 'Healthcare', zone: 'Central High Ground', floodDepthEst: '0.0m', exposureLevel: 'Safe', impact: 'Access road waterlogging only' }
];

export default function AssetExposure() {
  const [filter, setFilter] = useState('all');

  const filtered = EXPOSURE_DATA.filter(item => {
    if (filter === 'all') return true;
    return item.exposureLevel.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-amber">Planned</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status from Feature Inventory</span>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>Asset exposure</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Identify and rank protected urban assets exposed to localized flood inundation</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {['all', 'critical', 'high', 'moderate', 'safe'].map(f => (
          <button
            key={f}
            className={filter === f ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setFilter(f)}
            style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Exposed Infrastructure Register ({filtered.length})</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {filtered.map((item, idx) => {
            const isCrit = item.exposureLevel === 'Critical';
            const isHigh = item.exposureLevel === 'High';
            const isSafe = item.exposureLevel === 'Safe';

            return (
              <div key={idx} style={{ background: '#0b1120', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                  <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>{item.assetName}</strong>
                  <span className="badge" style={{
                    background: isCrit ? 'rgba(244,63,94,0.15)' : isHigh ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                    color: isCrit ? '#fb7185' : isHigh ? '#fbbf24' : '#34d399'
                  }}>
                    {item.exposureLevel} Exposure
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  Category: {item.category} • Hazard Zone: {item.zone} • Est. Flood Depth: <strong style={{ color: '#f8fafc' }}>{item.floodDepthEst}</strong>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                  <strong>Operational Impact:</strong> {item.impact}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

