import React, { useState } from 'react';
import { Waves, AlertTriangle, ArrowUp, ArrowDown, Minus } from 'lucide-react';

const RIVER_STATIONS = [
  { id: 'st-1', river: 'Buriganga', station: 'Dhaka (Mill Barrack)', currentLevel: 5.65, dangerLevel: 6.00, warningLevel: 5.50, trend: 'rising', delta24h: '+0.25m' },
  { id: 'st-2', river: 'Turag', station: 'Mirpur Bridge', currentLevel: 6.10, dangerLevel: 5.94, warningLevel: 5.50, trend: 'rising', delta24h: '+0.42m' },
  { id: 'st-3', river: 'Balu', station: 'Demra', currentLevel: 4.80, dangerLevel: 5.75, warningLevel: 5.20, trend: 'steady', delta24h: '0.00m' },
  { id: 'st-4', river: 'Tongi Khal', station: 'Tongi Bridge', currentLevel: 5.90, dangerLevel: 6.10, warningLevel: 5.60, trend: 'rising', delta24h: '+0.18m' },
  { id: 'st-5', river: 'Shitalakshya', station: 'Narayanganj', currentLevel: 5.10, dangerLevel: 5.50, warningLevel: 5.00, trend: 'falling', delta24h: '-0.10m' }
];

export default function RiverMonitoring() {
  const [stations, setStations] = useState(RIVER_STATIONS);

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-amber">Planned</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status from Feature Inventory</span>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>River monitoring</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Monitor water stages and gauge telemetry across rivers encircling the Dhaka metropolitan basin</p>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Waves size={18} color="#06b6d4" /> Peripheral River Telemetry Gauges ({stations.length})
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {stations.map(st => {
            const isDanger = st.currentLevel >= st.dangerLevel;
            const isWarning = !isDanger && st.currentLevel >= st.warningLevel;
            const statusColor = isDanger ? '#fb7185' : isWarning ? '#fbbf24' : '#34d399';

            return (
              <div key={st.id} style={{ background: '#0b1120', border: `1px solid ${isDanger ? 'rgba(244,63,94,0.4)' : 'var(--border-color)'}`, borderRadius: '0.6rem', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>{st.river}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{st.station}</div>
                  </div>
                  <span className="badge" style={{
                    background: isDanger ? 'rgba(244,63,94,0.15)' : isWarning ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                    color: statusColor
                  }}>
                    {isDanger ? 'ABOVE DANGER' : isWarning ? 'WARNING' : 'NORMAL'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: '0.75rem 0' }}>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: statusColor }}>{st.currentLevel.toFixed(2)}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>meters PWD</span>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <div>Danger Level: <strong>{st.dangerLevel.toFixed(2)}m</strong></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    Trend:
                    {st.trend === 'rising' && <ArrowUp size={12} color="#fb7185" />}
                    {st.trend === 'falling' && <ArrowDown size={12} color="#34d399" />}
                    {st.trend === 'steady' && <Minus size={12} color="#94a3b8" />}
                    <span>{st.delta24h}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

