import { apiRequest } from '../../services/apiClient';

export async function analyzePointInPolygon(pointCoordinates, polygonGeometry) {
  // coordinates order: [longitude, latitude]
  return apiRequest('/geospatial/spatial-analysis/point-in-polygon', {
    method: 'POST',
    body: JSON.stringify({
      point: {
        type: 'Point',
        coordinates: pointCoordinates,
      },
      polygon: polygonGeometry,
    }),
  });
}

