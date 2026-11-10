import React, { useState } from 'react';
import { Cpu, Play, AlertOctagon, TrendingUp, Sparkles } from 'lucide-react';

const CELLS = [
  { cellId: 'CELL-DH-104', location: 'Mirpur Section 10 & 11', rain24h: '78mm', elevation: '4.9m', prob: 0.84, risk: 'High' },
  { cellId: 'CELL-DH-212', location: 'Kallyanpur Canal Basin', rain24h: '65mm', elevation: '4.2m', prob: 0.91, risk: 'Critical' },
  { cellId: 'CELL-DH-308', location: 'Dhanmondi Lake Perimeter', rain24h: '42mm', elevation: '7.8m', prob: 0.38, risk: 'Moderate' },
  { cellId: 'CELL-DH-415', location: 'Gulshan 2 & Baridhara', rain24h: '35mm', elevation: '9.5m', prob: 0.12, risk: 'Low' },
  { cellId: 'CELL-DH-520', location: 'Old Dhaka (Chawkbazar)', rain24h: '55mm', elevation: '5.2m', prob: 0.73, risk: 'High' },
  { cellId: 'CELL-DH-631', location: 'DND Embankment Inner Polder', rain24h: '85mm', elevation: '3.8m', prob: 0.96, risk: 'Critical' }
];

export default function FloodPrediction() {
  const [threshold, setThreshold] = useState(0.5);
  const [running, setRunning] = useState(false);
  const [lastInference, setLastInference] = useState('2 minutes ago');

  const runModel = () => {
    setRunning(true);
    setTimeout(() => {
      setRunning(false);
      setLastInference('Just now');
    }, 800);
  };

  const highRiskCells = CELLS.filter(c => c.prob >= threshold);

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-amber">Planned</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status from Feature Inventory</span>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>Flood prediction</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Forecast localized 24-hour flood probability across Dhaka 1km x 1km grid cells</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="card" style={{ borderLeft: '4px solid #f43f5e' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cells Above Threshold</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fb7185', marginTop: '0.25rem' }}>
            {highRiskCells.length} / {CELLS.length}
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #38bdf8' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Model Baseline Architecture</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginTop: '0.4rem' }}>
            XGBoost Spatial Regressor
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lead-time: 24 Hours • Dhaka Grid</div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Inference Status</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#34d399' }}>Synced ({lastInference})</div>
          </div>
          <button className="btn-primary" onClick={runModel} disabled={running}>
            <Cpu size={15} /> {running ? 'Predicting...' : 'Re-run Model'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Alert Probability Threshold: <strong style={{ color: '#38bdf8' }}>{(threshold * 100).toFixed(0)}%</strong>
          </label>
        </div>
        <input
          type="range"
          min="0.1"
          max="0.9"
          step="0.05"
          value={threshold}
          onChange={e => setThreshold(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#38bdf8' }}
        />
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Grid-Cell Inundation Forecast (Next 24h)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '0.85rem' }}>
          {CELLS.map(c => {
            const isTriggered = c.prob >= threshold;
            return (
              <div key={c.cellId} style={{ background: '#f8fafc', border: `1px solid ${isTriggered ? '#f43f5e' : 'var(--border-color)'}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{c.location}</strong>
                  <span className="badge" style={{
                    background: c.prob > 0.8 ? 'rgba(244,63,94,0.15)' : c.prob > 0.4 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                    color: c.prob > 0.8 ? '#fb7185' : c.prob > 0.4 ? '#fbbf24' : '#34d399'
                  }}>
                    {(c.prob * 100).toFixed(0)}% Flood Risk
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{c.cellId}</div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                  <span>Rain: {c.rain24h}</span>
                  <span>Elevation: {c.elevation}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

