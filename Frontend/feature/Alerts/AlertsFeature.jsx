import React, { useState } from 'react';
import { Bell, AlertTriangle, Send, CheckCircle2, ShieldAlert } from 'lucide-react';

const SAMPLE_ALERTS = [
  { id: 'alt-1', title: 'Flash Flood Warning - Mirpur & Kallyanpur', severity: 'Warning', timestamp: '15 mins ago', audience: 'Ward 11, 12, 14 Residents & Disaster Volunteers', status: 'Dispatched', message: 'Rainfall exceeds 60mm/3hr. Turag river level approaching danger mark. Ground floor residents advise moving assets to higher ground.' },
  { id: 'alt-2', title: 'Waterlogging Advisory - Dhanmondi Lake Basin', severity: 'Advisory', timestamp: '1 hour ago', audience: 'Dhanmondi Ward 15', status: 'Active', message: 'Lake drainage gates opened. Road 27 waterlogged. Commuters seek alternate bypass.' },
  { id: 'alt-3', title: 'River Stage Alert - Buriganga Mill Barrack', severity: 'Watch', timestamp: '3 hours ago', audience: 'Old Dhaka Riverfront Authorities', status: 'Monitoring', message: 'Water level at 5.65m PWD (0.35m below Danger level). High tide expected at 18:00.' }
];

export default function AlertsFeature() {
  const [alerts, setAlerts] = useState(SAMPLE_ALERTS);
  const [form, setForm] = useState({ title: '', severity: 'Warning', audience: '', message: '' });
  const [msg, setMsg] = useState(null);

  const handleCreateAlert = (e) => {
    e.preventDefault();
    const newAlert = {
      id: `alt-${Date.now()}`,
      title: form.title.trim(),
      severity: form.severity,
      timestamp: 'Just now',
      audience: form.audience.trim() || 'All Citizens in Affected Zones',
      status: 'Dispatched',
      message: form.message.trim()
    };
    setAlerts([newAlert, ...alerts]);
    setMsg(`Alert dispatched: "${newAlert.title}"`);
    setForm({ title: '', severity: 'Warning', audience: '', message: '' });
  };

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-amber">Planned</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status from Feature Inventory</span>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>Alerts</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Notify citizens, utility managers, and emergency responders of imminent urban flood danger</p>
      </div>

      {msg && <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>✓ {msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={18} color="#fb7185" /> Broadcast Emergency Flood Alert
          </h3>
          <form onSubmit={handleCreateAlert}>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Alert Title *</label>
              <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Flash Flood Evacuation Notice" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Severity Level</label>
                <select value={form.severity} onChange={e => setForm({...form, severity: e.target.value})}>
                  <option>Warning</option>
                  <option>Watch</option>
                  <option>Advisory</option>
                  <option>Emergency Evacuation</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Target Audience</label>
                <input value={form.audience} onChange={e => setForm({...form, audience: e.target.value})} placeholder="e.g. Turag Basin Residents" />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Notification Message *</label>
              <textarea required rows={4} value={form.message} onChange={e => setForm({...form, message: e.target.value})} placeholder="Details on expected water levels, affected roads, shelter coordinates..." />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
              <Send size={15} /> Dispatch Emergency Alert
            </button>
          </form>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Active Alerts Feed ({alerts.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {alerts.map(alt => {
              const isCrit = alt.severity.includes('Warning') || alt.severity.includes('Evacuation');
              return (
                <div key={alt.id} style={{ background: '#f8fafc', border: `1px solid ${isCrit ? 'rgba(244,63,94,0.4)' : 'var(--border-color)'}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{alt.title}</strong>
                    <span className="badge" style={{
                      background: isCrit ? 'rgba(244,63,94,0.15)' : 'rgba(245,158,11,0.15)',
                      color: isCrit ? '#fb7185' : '#fbbf24'
                    }}>
                      {alt.severity}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    {alt.timestamp} • Target: {alt.audience}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                    {alt.message}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

