import React, { useState, useEffect } from 'react';
import LocationForm from './LocationForm';
import LocationList from './LocationList';
import { fetchLocations } from './geospatialApi';
import { MapPin, RefreshCw, AlertTriangle, Layers } from 'lucide-react';

export default function GeospatialFeature() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLocations();
      setLocations(data);
    } catch (err) {
      setError(err.message || 'Could not fetch locations from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLocationAdded = (newLoc) => {
    setLocations((prev) => [newLoc, ...prev]);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <MapPin size={26} color="#0891b2" /> Geospatial Locations
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Manage geographical assets, monitoring stations, and vulnerable urban coordinates
          </p>
        </div>
        <div>
          <button className="btn-secondary" onClick={loadData} title="Refresh locations">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', borderRadius: '0.5rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <AlertTriangle size={18} />
          <div>{error}</div>
        </div>
      )}

      <LocationForm onLocationAdded={handleLocationAdded} />
      <LocationList locations={locations} loading={loading} />
    </div>
  );
}

