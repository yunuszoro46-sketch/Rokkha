import { apiRequest } from '../../services/apiClient';

export async function fetchWeatherObservations() {
  return apiRequest('/weather/observations');
}

export async function fetchWeatherObservationById(recordId) {
  return apiRequest(`/weather/observations/${recordId}`);
}

export async function createWeatherObservation(payload) {
  return apiRequest('/weather/observations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

