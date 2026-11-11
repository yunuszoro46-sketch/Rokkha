import React, { useState } from 'react';
import { Layers, Shield, AlertTriangle, AlertCircle, Eye, Info } from 'lucide-react';

const DHAKA_ZONES = [
  {
    id: 'zone-1',
    name: 'Turag River Floodplain & Western Embankment',
    riskLevel: 'Extreme',
    areaSqKm: 42.5,
    drainageCapacity: 'Low',
    vulnerablePop: '320,000+',
    status: 'High Water Table',
    coordinatesCount: 16
  },
  {
    id: 'zone-2',
    name: 'DND (Dhaka-Narayanganj-Demra) Polder',
    riskLevel: 'Severe',
    areaSqKm: 56.8,
    drainageCapacity: 'Critical (Pump Reliant)',
    vulnerablePop: '1,200,000+',
    status: 'Inundation Risk',
    coordinatesCount: 24
  },
  {
    id: 'zone-3',
    name: 'Hatirjheel-Begunbari Water Retention Area',
    riskLevel: 'Moderate',
    areaSqKm: 18.2,
    drainageCapacity: 'Engineered Sluice Gate',
    vulnerablePop: '180,000',
    status: 'Operational Reservoir',
    coordinatesCount: 12
  },
  {
    id: 'zone-4',
    name: 'Balu River Eastern Inundation Marsh',
    riskLevel: 'High',
    areaSqKm: 68.0,
    drainageCapacity: 'Natural Floodplain',
    vulnerablePop: '450,000',
    status: 'Seasonal Spillover',
    coordinatesCount: 30
  }
];

export default function GeographicZones() {
  const [selectedZone, setSelectedZone] = useState(DHAKA_ZONES[0]);

  const getRiskTheme = (level) => {
    if (level === 'Extreme') {
      return {
        type: 'danger',
        badgeBg: 'rgba(239, 68, 68, 0.12)',
        badgeBorder: '1px solid rgba(239, 68, 68, 0.45)',
        badgeColor: '#dc2626',
        cardBorder: '2px solid #ef4444',
        cardBg: '#fff5f5',
        titleColor: '#dc2626',
        iconColor: '#ef4444',
        tag: 'Extreme Warning ⚠️'
      };
    }
    if (level === 'High' || level === 'Severe') {
      return {
        type: 'warning',
        badgeBg: 'rgba(245, 158, 11, 0.14)',
        badgeBorder: '1px solid rgba(245, 158, 11, 0.5)',
        badgeColor: '#d97706',
        cardBorder: '2px solid #f59e0b',
        cardBg: '#fffbeb',
        titleColor: '#d97706',
        iconColor: '#f59e0b',
        tag: 'High Warning'
      };
    }
    return {
      type: 'cyan',
      badgeBg: 'rgba(6, 182, 212, 0.12)',
      badgeBorder: '1px solid rgba(6, 182, 212, 0.4)',
      badgeColor: '#0891b2',
      cardBorder: '2px solid #06b6d4',
      cardBg: '#f0f9ff',
      titleColor: '#0891b2',
      iconColor: '#06b6d4',
      tag: 'Normal'
    };
  };

  const currentTheme = getRiskTheme(selectedZone.riskLevel);

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-cyan">Planned</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status from Feature Inventory</span>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem', color: '#0f172a' }}>Geographic zones</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Represent and delineate flood-risk areas, retention basins, and embankment polders across Dhaka
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* Left Card: List of Flood Hazard Zones */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
            <Layers size={18} color="#06b6d4" /> Delineated Flood Hazard Zones ({DHAKA_ZONES.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {DHAKA_ZONES.map(z => {
              const isSelected = selectedZone.id === z.id;
              const theme = getRiskTheme(z.riskLevel);

              return (
                <div
                  key={z.id}
                  onClick={() => setSelectedZone(z)}
                  style={{
                    padding: '0.9rem',
                    borderRadius: '0.6rem',
                    background: isSelected ? theme.cardBg : '#ffffff',
                    border: isSelected ? theme.cardBorder : '1px solid #e2e8f0',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 4px 14px rgba(6, 182, 212, 0.15)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                    <strong style={{ fontSize: '0.875rem', color: isSelected ? theme.titleColor : '#0f172a' }}>
                      {z.name}
                    </strong>
                    <span className="badge" style={{
                      background: theme.badgeBg,
                      border: theme.badgeBorder,
                      color: theme.badgeColor,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 800
                    }}>
                      {theme.type === 'danger' && <AlertTriangle size={11} />}
                      {theme.type === 'warning' && <AlertCircle size={11} />}
                      {z.riskLevel}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>Area: {z.areaSqKm} km²</span>
                    <span>Status: {z.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Card: Zone Profile & Specifications */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#0f172a' }}>
            Zone Specification & Geospatial Profile
          </h3>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <Shield size={22} color={currentTheme.iconColor} />
              <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {selectedZone.name}
              </h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1.15rem' }}>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '0.85rem', borderRadius: '0.5rem', boxShadow: '0 1px 6px rgba(6, 182, 212, 0.05)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Total Surface Area</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0891b2' }}>{selectedZone.areaSqKm} km²</div>
              </div>

              <div style={{
                background: '#ffffff',
                border: currentTheme.type === 'danger' ? '1.5px solid rgba(239, 68, 68, 0.4)' : currentTheme.type === 'warning' ? '1.5px solid rgba(245, 158, 11, 0.4)' : '1px solid #e2e8f0',
                padding: '0.85rem',
                borderRadius: '0.5rem',
                boxShadow: '0 1px 6px rgba(6, 182, 212, 0.05)'
              }}>
                <div style={{ fontSize: '0.72rem', color: currentTheme.badgeColor, marginBottom: '0.2rem', fontWeight: 700 }}>
                  Vulnerable Population {currentTheme.type !== 'cyan' && '⚠️'}
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: currentTheme.badgeColor }}>
                  {selectedZone.vulnerablePop}
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '0.85rem', borderRadius: '0.5rem', boxShadow: '0 1px 6px rgba(6, 182, 212, 0.05)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Drainage Outflow</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{selectedZone.drainageCapacity}</div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '0.85rem', borderRadius: '0.5rem', boxShadow: '0 1px 6px rgba(6, 182, 212, 0.05)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Boundary Vertices</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0891b2' }}>{selectedZone.coordinatesCount} points polygon</div>
              </div>
            </div>

            {/* Warning / Notification Box with Yellow and Cyan theme */}
            <div style={{
              padding: '0.85rem',
              borderRadius: '0.5rem',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1.5px solid rgba(245, 158, 11, 0.35)',
              color: '#b45309',
              fontSize: '0.78rem',
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}>
              <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#92400e' }}>Warning &amp; Integration Notice:</strong> Once GeoPandas boundary shapefiles are connected, this hazard zone will automatically trigger localized <span style={{ color: '#0891b2', fontWeight: 700 }}>Point-in-Polygon</span> containment alerts and dispatch warnings.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
