import React, { useState, useEffect } from 'react';
import WeatherObservationForm from './WeatherObservationForm';
import WeatherObservationList from './WeatherObservationList';
import { fetchWeatherObservations } from './weatherApi';
import { RefreshCw, CloudRain, AlertTriangle } from 'lucide-react';

export default function WeatherFeature() {
  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeatherObservations();
      setObservations(data);
    } catch (err) {
      setError(err.message || 'Could not fetch observations from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleObservationAdded = (newObs) => {
    setObservations((prev) => [newObs, ...prev]);
  };

  const highRainCount = observations.filter(o => o.rainfall_mm > 50).length;
  const avgTemp = observations.length > 0 
    ? (observations.reduce((acc, c) => acc + c.temperature_c, 0) / observations.length).toFixed(1)
    : '--';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CloudRain size={26} color="#38bdf8" /> Weather Observations
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Environmental telemetry & rain measurement module for localized Dhaka flood forecasting
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn-secondary" onClick={loadData} title="Refresh data">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ borderLeft: '4px solid #38bdf8' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Observations
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem', color: '#f8fafc' }}>
            {observations.length}
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #f43f5e' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Heavy Rainfall Alerts (&gt;50mm)
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem', color: highRainCount > 0 ? '#fb7185' : '#0891b2' }}>
            {highRainCount}
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #fb923c' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Average Temperature
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem', color: '#f8fafc' }}>
            {avgTemp}°C
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', borderRadius: '0.5rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <AlertTriangle size={18} />
          <div>{error}</div>
        </div>
      )}

      <WeatherObservationForm onObservationAdded={handleObservationAdded} />
      <WeatherObservationList observations={observations} loading={loading} />
    </div>
  );
}

