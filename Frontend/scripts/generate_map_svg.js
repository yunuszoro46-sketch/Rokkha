const fs = require('fs');

const districts = JSON.parse(fs.readFileSync('src/data/bangladesh_districts.json', 'utf8'));
const rivers = JSON.parse(fs.readFileSync('src/data/bangladesh_rivers.json', 'utf8'));

const width = 520;
const height = 580;
const minLng = 88.0;
const maxLng = 92.7;
const minLat = 20.6;
const maxLat = 26.7;

function project(lng, lat) {
  const x = ((lng - minLng) / (maxLng - minLng)) * (width - 40) + 20;
  const y = ((maxLat - lat) / (maxLat - minLat)) * (height - 40) + 20;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

function coordsToD(coords, type) {
  if (type === 'Polygon') {
    return coords.map(ring => {
      return ring.map((pt, i) => {
        const [x, y] = project(pt[0], pt[1]);
        return (i === 0 ? 'M' : 'L') + x + ',' + y;
      }).join(' ') + ' Z';
    }).join(' ');
  } else if (type === 'MultiPolygon') {
    return coords.map(poly => {
      return poly.map(ring => {
        return ring.map((pt, i) => {
          const [x, y] = project(pt[0], pt[1]);
          return (i === 0 ? 'M' : 'L') + x + ',' + y;
        }).join(' ') + ' Z';
      }).join(' ');
    }).join(' ');
  }
  return '';
}

function lineCoordsToD(coords, type) {
  if (type === 'LineString') {
    return coords.map((pt, i) => {
      const [x, y] = project(pt[0], pt[1]);
      return (i === 0 ? 'M' : 'L') + x + ',' + y;
    }).join(' ');
  } else if (type === 'MultiLineString') {
    return coords.map(line => {
      return line.map((pt, i) => {
        const [x, y] = project(pt[0], pt[1]);
        return (i === 0 ? 'M' : 'L') + x + ',' + y;
      }).join(' ');
    }).join(' ');
  }
  return '';
}

// Generate district paths with colors matching Image 1
const districtPaths = districts.features.map(f => {
  const name = f.properties.name;
  const pcode = f.properties.pcode;
  const d = coordsToD(f.geometry.coordinates, f.geometry.type);
  
  // Default clean sage/limestone
  let fill = '#D6E4DB';
  let stroke = '#BED4C6';
  
  // Sylhet division severe / high flood colors matching Figma design in Image 1
  if (name === 'Sunamganj' || name === 'Sylhet') {
    fill = '#E35B47'; // red / severe
    stroke = '#C74532';
  } else if (name === 'Habiganj' || name === 'Moulvibazar' || name === 'Netrokona') {
    fill = '#ED8A43'; // high / orange
    stroke = '#D47330';
  } else if (name === 'Kishoreganj' || name === 'Brahmanbaria' || name === 'Kurigram' || name === 'Gaibandha') {
    fill = '#F3BD48'; // moderate / yellow
    stroke = '#D9A132';
  } else if (name === 'Mymensingh' || name === 'Sherpur' || name === 'Jamalpur' || name === 'Sirajganj') {
    fill = '#DCE496'; // low-mod / lime
    stroke = '#C6CE80';
  } else if (name === 'Dhaka' || name === 'Gazipur' || name === 'Narayanganj') {
    fill = '#C4DDCF';
    stroke = '#A9C7B6';
  }
  
  return { name, pcode, d, fill, stroke };
});

const riverPaths = rivers.features.map(f => {
  return lineCoordsToD(f.geometry.coordinates, f.geometry.type);
}).filter(d => d.length > 0);

const tsContent = `// Auto-generated real Bangladesh cartographic projection matching Figma design
import React from "react";

const DISTRICTS_DATA = ${JSON.stringify(districtPaths)};
const RIVERS_DATA = ${JSON.stringify(riverPaths.slice(0, 160))};

export const BangladeshMapSvg: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg viewBox="0 0 520 580" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="haloGlow" cx="55%" cy="42%" r="48%">
          <stop offset="0%" stopColor="#EDEBE2" stopOpacity="0.85" />
          <stop offset="70%" stopColor="#F5F4EF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#FAFAF7" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background Soft Backdrop Circle */}
      <circle cx="280" cy="250" r="230" fill="url(#haloGlow)" />
      <circle cx="280" cy="250" r="215" stroke="#EDEBE2" strokeWidth="1" strokeDasharray="4 4" />

      {/* Real District Polygons from Official Boundary GeoJSON */}
      <g>
        {DISTRICTS_DATA.map((dist, idx) => (
          <path
            key={idx}
            d={dist.d}
            fill={dist.fill}
            stroke={dist.stroke}
            strokeWidth="0.8"
            strokeLinejoin="round"
            opacity="0.95"
            className="transition-opacity hover:opacity-80"
          >
            <title>{dist.name}</title>
          </path>
        ))}
      </g>

      {/* Real River Network Overlay */}
      <g stroke="#4E8478" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.75">
        {RIVERS_DATA.map((d, idx) => (
          <path key={idx} d={d} fill="none" />
        ))}
      </g>
    </svg>
  );
};
`;

fs.writeFileSync('src/components/BangladeshMapSvg.tsx', tsContent);
console.log('Successfully written src/components/BangladeshMapSvg.tsx');

