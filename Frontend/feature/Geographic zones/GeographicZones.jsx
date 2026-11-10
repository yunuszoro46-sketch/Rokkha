import React, { useState } from 'react';
import { Layers, Shield, AlertTriangle, Eye } from 'lucide-react';

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

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-amber">Planned</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status from Feature Inventory</span>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>Geographic zones</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Represent and delineate flood-risk areas, retention basins, and embankment polders across Dhaka</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={18} color="#f59e0b" /> Delineated Flood Hazard Zones ({DHAKA_ZONES.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {DHAKA_ZONES.map(z => {
              const isSelected = selectedZone.id === z.id;
              return (
                <div
                  key={z.id}
                  onClick={() => setSelectedZone(z)}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '0.5rem',
                    background: isSelected ? '#192640' : '#0b1120',
                    border: isSelected ? '2px solid #f59e0b' : '1px solid var(--border-color)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                    <strong style={{ fontSize: '0.875rem', color: isSelected ? '#f59e0b' : '#f8fafc' }}>{z.name}</strong>
                    <span className="badge badge-rose" style={{ fontSize: '0.65rem' }}>{z.riskLevel}</span>
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

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Zone Specification & Geospatial Profile</h3>
          <div style={{ background: '#0b1120', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Shield size={20} color="#f59e0b" />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>{selectedZone.name}</h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: '#131e33', padding: '0.75rem', borderRadius: '0.4rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Surface Area</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>{selectedZone.areaSqKm} km²</div>
              </div>
              <div style={{ background: '#131e33', padding: '0.75rem', borderRadius: '0.4rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Vulnerable Population</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fb7185' }}>{selectedZone.vulnerablePop}</div>
              </div>
              <div style={{ background: '#131e33', padding: '0.75rem', borderRadius: '0.4rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Drainage Outflow</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>{selectedZone.drainageCapacity}</div>
              </div>
              <div style={{ background: '#131e33', padding: '0.75rem', borderRadius: '0.4rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Boundary Vertices</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#34d399' }}>{selectedZone.coordinatesCount} points polygon</div>
              </div>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '0.4rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', fontSize: '0.75rem' }}>
              <strong>Planned Feature Integration:</strong> Once GeoPandas boundary shapefiles are connected, this zone geometry will automatically integrate with Point-in-Polygon containment tests.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

