import { apiRequest } from '../../services/apiClient';

export async function fetchLocations() {
  return apiRequest('/geospatial/locations');
}

export async function fetchLocationById(locationId) {
  return apiRequest(`/geospatial/locations/${locationId}`);
}

export async function createLocation(payload) {
  return apiRequest('/geospatial/locations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

