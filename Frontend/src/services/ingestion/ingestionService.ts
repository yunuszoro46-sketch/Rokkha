import { API_BASE } from "../common/client";

/**
 * Get rain observations / history for a site
 */
export async function getSiteRain(siteId: string, startDate?: string, endDate?: string) {
  try {
    let url = `${API_BASE}/ingestion/rain?site_id=${siteId}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    const res = await fetch(url);
    if (res.ok) return await res.json();
  } catch {
    // fallback handled by caller
  }
  return null;
}

/**
 * Get river discharge for a site
 */
export async function getSiteRiver(siteId: string, startDate?: string, endDate?: string) {
  try {
    let url = `${API_BASE}/ingestion/river?site_id=${siteId}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    const res = await fetch(url);
    if (res.ok) return await res.json();
  } catch {
    // fallback handled by caller
  }
  return null;
}

/**
 * Get hourly rain forecast + total precipitation for a site (Section 3.E)
 */
export async function getRainForecast(siteId: string) {
  try {
    const res = await fetch(`${API_BASE}/ingestion/rain-forecast?site_id=${siteId}`);
    if (res.ok) return await res.json();
  } catch {
    // fallback
  }
  return null;
}

/**
 * Get recent preliminary rain observations (GFS) for a site (Section 3.E)
 */
export async function getRecentRain(siteId: string, startDate?: string, endDate?: string) {
  try {
    let url = `${API_BASE}/ingestion/rain-recent?site_id=${siteId}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    const res = await fetch(url);
    if (res.ok) return await res.json();
  } catch {
    // fallback
  }
  return null;
}

/**
 * Get registered rain or river gauge monitoring sites (Section 3.E)
 */
export async function getIngestionSites(kind?: "district" | "river") {
  try {
    let url = `${API_BASE}/ingestion/sites`;
    if (kind) url += `?kind=${kind}`;
    const res = await fetch(url);
    if (res.ok) return await res.json();
  } catch {
    // fallback
  }
  return [];
}

