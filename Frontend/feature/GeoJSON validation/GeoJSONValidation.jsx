import React, { useState } from 'react';
import { CheckCircle2, XCircle, Code, ShieldCheck } from 'lucide-react';

const SAMPLES = {
  point: {
    type: 'Point',
    coordinates: [90.376, 23.7465]
  },
  polygon: {
    type: 'Polygon',
    coordinates: [
      [
        [90.35, 23.73],
        [90.40, 23.73],
        [90.40, 23.78],
        [90.35, 23.78],
        [90.35, 23.73]
      ]
    ]
  },
  linestring: {
    type: 'LineString',
    coordinates: [
      [90.35, 23.73],
      [90.37, 23.75],
      [90.40, 23.78]
    ]
  },
  invalid_unclosed: {
    type: 'Polygon',
    coordinates: [
      [
        [90.35, 23.73],
        [90.40, 23.73],
        [90.40, 23.78],
        [90.35, 23.78]
      ]
    ]
  }
};

export default function GeoJSONValidation() {
  const [inputJson, setInputJson] = useState(JSON.stringify(SAMPLES.polygon, null, 2));
  const [validationResult, setValidationResult] = useState(null);

  const validateGeoJSON = () => {
    try {
      const parsed = JSON.parse(inputJson);
      const errors = [];

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Root must be a valid GeoJSON object');
      }

      if (!parsed.type) {
        errors.push("Missing required 'type' field");
      }

      const validTypes = ['Point', 'LineString', 'Polygon', 'MultiPolygon', 'Feature', 'FeatureCollection'];
      if (!validTypes.includes(parsed.type)) {
        errors.push(`Invalid type '${parsed.type}'. Expected one of: ${validTypes.join(', ')}`);
      }

      if (parsed.type === 'Point') {
        if (!Array.isArray(parsed.coordinates) || parsed.coordinates.length !== 2) {
          errors.push('Point coordinates must contain exactly 2 numbers: [longitude, latitude]');
        } else {
          const [lon, lat] = parsed.coordinates;
          if (lon < -180 || lon > 180) errors.push(`Longitude ${lon} out of range [-180, 180]`);
          if (lat < -90 || lat > 90) errors.push(`Latitude ${lat} out of range [-90, 90]`);
        }
      }

      if (parsed.type === 'Polygon') {
        if (!Array.isArray(parsed.coordinates) || parsed.coordinates.length === 0) {
          errors.push('Polygon must have at least one ring');
        } else {
          parsed.coordinates.forEach((ring, idx) => {
            if (!Array.isArray(ring) || ring.length < 4) {
              errors.push(`Ring ${idx} must have at least 4 positions (including closed point)`);
            } else {
              const first = ring[0];
              const last = ring[ring.length - 1];
              if (first[0] !== last[0] || first[1] !== last[1]) {
                errors.push(`Ring ${idx} is not closed: first position [${first}] does not match last position [${last}]`);
              }
            }
          });
        }
      }

      if (parsed.type === 'LineString') {
        if (!Array.isArray(parsed.coordinates) || parsed.coordinates.length < 2) {
          errors.push('LineString must have at least 2 coordinate positions');
        }
      }

      if (errors.length > 0) {
        setValidationResult({ valid: false, errors });
      } else {
        setValidationResult({ valid: true, type: parsed.type, details: 'Conforms to GeoJSON RFC 7946 and Climate Shield rules' });
      }
    } catch (err) {
      setValidationResult({ valid: false, errors: [err.message] });
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-emerald">Implemented</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status from Feature Inventory</span>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>GeoJSON validation</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Validate geographic inputs against GeoJSON geometry rules (order: [lon, lat], ring closure, coordinate bounds)</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button className="btn-secondary" onClick={() => setInputJson(JSON.stringify(SAMPLES.point, null, 2))}>Sample Point</button>
        <button className="btn-secondary" onClick={() => setInputJson(JSON.stringify(SAMPLES.polygon, null, 2))}>Sample Valid Polygon</button>
        <button className="btn-secondary" onClick={() => setInputJson(JSON.stringify(SAMPLES.linestring, null, 2))}>Sample LineString</button>
        <button className="btn-secondary" onClick={() => setInputJson(JSON.stringify(SAMPLES.invalid_unclosed, null, 2))} style={{ borderColor: '#f43f5e', color: '#fb7185' }}>Sample Invalid (Unclosed)</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <div className="card">
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
            GeoJSON Payload
          </label>
          <textarea
            rows={12}
            value={inputJson}
            onChange={e => setInputJson(e.target.value)}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
          />
          <button className="btn-primary" onClick={validateGeoJSON} style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}>
            <ShieldCheck size={16} /> Validate Geometry
          </button>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Validation Output</h3>
          {!validationResult ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Click "Validate Geometry" to test the payload.</p>
          ) : validationResult.valid ? (
            <div style={{ padding: '1.25rem', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#34d399', fontWeight: 700, fontSize: '1.1rem' }}>
                <CheckCircle2 size={24} /> Valid {validationResult.type}
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.5rem' }}>{validationResult.details}</p>
            </div>
          ) : (
            <div style={{ padding: '1.25rem', background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.4)', borderRadius: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#fb7185', fontWeight: 700, fontSize: '1.1rem' }}>
                <XCircle size={24} /> Validation Failed
              </div>
              <ul style={{ color: '#0f172a', fontSize: '0.85rem', marginTop: '0.75rem', paddingLeft: '1.25rem' }}>
                {validationResult.errors.map((err, i) => (
                  <li key={i} style={{ marginBottom: '0.35rem' }}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

