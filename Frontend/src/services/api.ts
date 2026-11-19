import {
  DistrictPrediction,
  AlertItem,
  PointFloodCheck,
  SatelliteObservation,
  AssetNearResult,
  ModelStatus,
  DistrictLatestObservation,
  RegisteredAsset,
  RiverSite,
} from "../types/api";
import sitesData from "../data/sites.json";
import benchmarkData from "../data/benchmark_predictions.json";
import floodHistoryData from "../data/district_flood_history.json";
import modelMeta from "../data/flood_model_meta.json";
import { findDistrictByPoint } from "@/lib/districts";
// The saved samples below are only needed when the backend cannot be reached, so they are loaded on
// demand instead of being shipped to every visitor (~0.85 MB of JSON).
const loadSatelliteSample = async (): Promise<any> => (await import("../data/satellite_observations.json")).default;
const loadHydroSample = async (): Promise<any> => (await import("../data/hydro_sample.json")).default;
import { markLive, markSample } from "./dataSource";

import { API_BASE } from "./common/client";

const SUPPORTED_PCODES = new Set<string>((modelMeta as any).supported_pcodes || []);

/**
 * Check if the FastAPI backend is reachable and returning valid JSON
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: "GET" });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.status === "healthy";
  } catch {
    return false;
  }
}

/**
 * Get Model Status & Verification Metrics
 */
export async function getModelStatus(): Promise<ModelStatus | null> {
  try {
    const res = await fetch(`${API_BASE}/predictions/model`);
    if (res.ok) {
      markLive("model");
      return await res.json();
    }
  } catch {
    // backend not reachable: saved sample below
  }
  markSample("model");
  return {
    status: "ready",
    message: "Saved copy of the model facts; the backend was not reachable.",
    model: {
      version: (modelMeta as any).model_version,
      test_results: (modelMeta as any).test_results,
    },
  };
}

/**
 * Get Predictions for a specific target_date.
 *
 * An empty list means "no forecast for this day". It is never filled with
 * another day's predictions: showing a past flood under today's date would
 * be a false warning.
 */
export async function getPredictions(targetDate: string): Promise<DistrictPrediction[]> {
  try {
    const res = await fetch(`${API_BASE}/predictions?target_date=${targetDate}`);
    if (res.ok) {
      const data = await res.json();
      markLive("predictions");
      return data.predictions || [];
    }
    if (res.status < 500) {
      // The backend answered: it has no forecast for this day (404) or the date is invalid.
      markLive("predictions");
      return [];
    }
  } catch {
    // backend not reachable: saved sample below
  }

  markSample("predictions");
  return ((benchmarkData as any).predictions || {})[targetDate] || [];
}

/**
 * Get Alerts for a target_date. Empty when no district reached the level,
 * and also when there is no forecast for that day (check getPredictions).
 */
export async function getAlerts(
  targetDate: string,
  minLevel: string = "watch"
): Promise<AlertItem[]> {
  try {
    const res = await fetch(`${API_BASE}/alerts?target_date=${targetDate}&min_level=${minLevel}`);
    if (res.ok) {
      const data = await res.json();
      markLive("alerts");
      return Array.isArray(data.alerts) ? data.alerts : [];
    }
    if (res.status < 500) {
      markLive("alerts");
      return [];
    }
  } catch {
    // backend not reachable: saved sample below
  }

  // Saved alerts are the backend's own answers for that day, assets included.
  markSample("alerts");
  const saved: AlertItem[] = ((benchmarkData as any).alerts || {})[targetDate] || [];
  return minLevel === "alert" ? saved.filter((a) => a.level === "alert") : saved;
}

/**
 * Check flood history & hazard for any coordinate [longitude, latitude]
 */
export async function checkPointFlood(
  lng: number,
  lat: number
): Promise<PointFloodCheck | null> {
  try {
    const res = await fetch(`${API_BASE}/geospatial/flood/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        point: {
          type: "Point",
          coordinates: [lng, lat],
        },
      }),
    });
    if (res.ok) {
      markLive("location");
      return await res.json();
    }
  } catch {
    // backend not reachable: saved sample below
  }

  // Saved sample: the district and its real flood history. The ~90 m cell under
  // the point (times flooded, modelled depth) needs the backend, so it stays null.
  markSample("location");
  const prop = await findDistrictByPoint(lng, lat).catch(() => null);
  if (!prop) {
    return { district: null, cell: null };
  }

  const histDistrict = ((floodHistoryData as any).districts || []).find(
    (d: any) => d.pcode === prop.pcode
  );

  return {
    district: {
      pcode: prop.pcode,
      name: prop.name,
      division: prop.parent_name || histDistrict?.division || "Bangladesh",
      rank: histDistrict?.rank,
      events_observed: histDistrict?.events_observed,
      events_flooded: histDistrict?.events_flooded,
    },
    cell: null,
  };
}

/**
 * Get Sentinel-1 Copernicus GFM Satellite Observations for a district
 */
export async function getSatelliteObservations(
  pcode: string,
  startDate?: string,
  endDate?: string
): Promise<{
  count: number;
  unsupported?: boolean;
  observations: SatelliteObservation[];
  message?: string;
}> {
  const isSupported = SUPPORTED_PCODES.has(pcode);
  if (!isSupported) {
    return {
      count: 0,
      unsupported: true,
      observations: [],
      message:
        "Satellites cannot observe floods in this district (hills, forest or built-up land).",
    };
  }

  try {
    let url = `${API_BASE}/geospatial/flood/districts/${pcode}/satellite-observations`;
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      markLive("satellite");
      const observations = data.observations || [];
      return { count: observations.length, unsupported: false, observations };
    }
  } catch {
    // backend not reachable: saved sample below
  }

  // Saved sample: only the passes inside the asked dates (no passes = none shown).
  markSample("satellite");
  const satelliteObsData = await loadSatelliteSample();
  const allObs: SatelliteObservation[] = satelliteObsData[pcode] || [];
  const result = allObs.filter((o) => {
    if (startDate && o.date < startDate) return false;
    if (endDate && o.date > endDate) return false;
    return true;
  });
  return {
    count: result.length,
    unsupported: false,
    observations: result,
  };
}

/**
 * The newest satellite pass of every district on or before `date` (at most
 * 30 days old). For the "observed flooding" view of the map.
 */
export async function getLatestSatelliteObservations(
  date: string
): Promise<DistrictLatestObservation[]> {
  const MAX_AGE_DAYS = 30;
  try {
    const res = await fetch(
      `${API_BASE}/geospatial/flood/satellite-observations/latest?date=${date}&max_age_days=${MAX_AGE_DAYS}`
    );
    if (res.ok) {
      const data = await res.json();
      markLive("satellite");
      return data.districts || [];
    }
  } catch {
    // backend not reachable: saved sample below
  }

  // Saved sample: the same rule as the backend, applied to the saved passes.
  // Days outside the sample's years simply have no observation.
  markSample("satellite");
  const day = new Date(`${date}T00:00:00Z`).getTime();
  if (Number.isNaN(day)) return [];
  const oldest = new Date(day - MAX_AGE_DAYS * 86400000).toISOString().slice(0, 10);
  const satelliteObsData = await loadSatelliteSample();

  return ((floodHistoryData as any).districts || []).map((d: any) => {
    const passes: SatelliteObservation[] = (satelliteObsData[d.pcode] || []).filter(
      (o: SatelliteObservation) => o.date >= oldest && o.date <= date
    );
    const observation = passes.length > 0 ? passes[passes.length - 1] : null;
    return {
      pcode: d.pcode,
      name: d.name,
      division: d.division,
      observable: SUPPORTED_PCODES.has(d.pcode),
      observation,
      days_ago: observation
        ? Math.round((day - new Date(`${observation.date}T00:00:00Z`).getTime()) / 86400000)
        : null,
    };
  });
}

/**
 * The places registered in one district (hospitals, shelters, ...), for map
 * markers. One district at a time: the whole country is thousands of places.
 * No saved sample: without the backend the list is empty, never invented.
 */
export async function getRegisteredAssets(districtPcode: string): Promise<RegisteredAsset[]> {
  try {
    const res = await fetch(`${API_BASE}/assets?district_pcode=${districtPcode}`);
    if (res.ok) {
      const data = await res.json();
      return data.assets || [];
    }
  } catch {
    // backend not reachable
  }
  return [];
}

/** The river stations (GloFAS points) the backend follows. */
export async function getRiverSites(): Promise<RiverSite[]> {
  try {
    const res = await fetch(`${API_BASE}/ingestion/sites?kind=river`);
    if (res.ok) {
      const data = await res.json();
      return data.sites || [];
    }
  } catch {
    // backend not reachable: saved copy of the backend's own site list
  }
  return ((sitesData as any).sites || []).filter((s: any) => s.kind === "river");
}

/**
 * Get 64 Districts Ranked by Historical Flood Frequency (`GET /geospatial/flood/districts`)
 */
export async function getFloodDistricts() {
  try {
    const res = await fetch(`${API_BASE}/geospatial/flood/districts`);
    if (res.ok) {
      const data = await res.json();
      if (data.districts) {
        markLive("history");
        return data.districts;
      }
    }
  } catch {
    // backend not reachable: saved sample below
  }
  markSample("history");
  return (floodHistoryData as any).districts || [];
}

/**
 * Get the 10 Historical UNOSAT Flood Events (`GET /geospatial/flood/events`)
 */
export async function getFloodEvents() {
  try {
    const res = await fetch(`${API_BASE}/geospatial/flood/events`);
    if (res.ok) {
      const data = await res.json();
      if (data.events) {
        markLive("history");
        return data.events;
      }
    }
  } catch {
    // backend not reachable: saved sample below
  }
  markSample("history");
  return (floodHistoryData as any).events || [];
}

/**
 * Find nearest shelters or critical assets within radius (metres)
 */
export async function getNearestAssets(
  lng: number,
  lat: number,
  maxDistanceM: number = 25000,
  assetType?: string
): Promise<AssetNearResult[]> {
  return (await findNearestAssets(lng, lat, maxDistanceM, assetType)) ?? [];
}

/** Same request, but null when the backend could not be reached (so a page can say so instead of "none found"). */
export async function findNearestAssets(
  lng: number,
  lat: number,
  maxDistanceM: number = 25000,
  assetType?: string
): Promise<AssetNearResult[] | null> {
  try {
    let url = `${API_BASE}/assets/near?lng=${lng}&lat=${lat}&max_distance_m=${maxDistanceM}`;
    if (assetType) url += `&asset_type=${assetType}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      markLive("shelters");
      return data.results || [];
    }
  } catch {
    // backend not reachable
  }

  // No saved sample for shelters: a made-up shelter could send someone to a
  // place that does not exist. Only places registered in the backend are shown.
  markSample("shelters");
  return null;
}

function inWindow(startDate?: string, endDate?: string) {
  return (v: { date: string }) =>
    (!startDate || v.date >= startDate) && (!endDate || v.date <= endDate);
}

/**
 * Get daily rain for a site. Values have `precipitation_mm` (null when `missing`).
 * `sample: true` means the values come from the saved sample, not the live backend.
 */
export async function getSiteRain(siteId: string, startDate?: string, endDate?: string) {
  try {
    let url = `${API_BASE}/ingestion/rain?site_id=${siteId}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    const res = await fetch(url);
    if (res.ok) {
      markLive("hydro");
      return await res.json();
    }
    if (res.status < 500) {
      markLive("hydro");
      return null;
    }
  } catch {
    // backend not reachable: saved sample below
  }
  markSample("hydro");
  const saved = ((await loadHydroSample()).rain || {})[siteId.replace("district-", "")];
  if (!saved) return null;
  return { sample: true, values: saved.filter(inWindow(startDate, endDate)) };
}

/**
 * Get daily river discharge for a site. Values have `discharge_m3s` (null when `missing`).
 */
export async function getSiteRiver(siteId: string, startDate?: string, endDate?: string) {
  try {
    let url = `${API_BASE}/ingestion/river?site_id=${siteId}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    const res = await fetch(url);
    if (res.ok) {
      markLive("hydro");
      return await res.json();
    }
    if (res.status < 500) {
      markLive("hydro");
      return null;
    }
  } catch {
    // backend not reachable: saved sample below
  }
  markSample("hydro");
  const saved = ((await loadHydroSample()).river || {})[siteId];
  if (!saved) return null;
  return { sample: true, values: saved.filter(inWindow(startDate, endDate)) };
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

/**
 * Get macro asset exposure summary report across registered assets (Section 3.B)
 */
export async function getAssetsExposure(
  districtPcode?: string,
  assetType?: string,
  criticality?: string
) {
  try {
    const params = new URLSearchParams();
    if (districtPcode) params.append("district_pcode", districtPcode);
    if (assetType) params.append("asset_type", assetType);
    if (criticality) params.append("criticality", criticality);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API_BASE}/assets/exposure${qs}`);
    if (res.ok) return await res.json();
  } catch {
    // fallback
  }
  return null;
}

/**
 * Get single asset details (Section 3.A)
 */
export async function getAssetDetail(id: string) {
  try {
    const res = await fetch(`${API_BASE}/assets/${id}`);
    if (res.ok) return await res.json();
  } catch {
    // fallback
  }
  return null;
}

/**
 * Get single asset flood exposure with flags & return periods (Section 3.B)
 */
export async function getAssetExposure(id: string) {
  try {
    const res = await fetch(`${API_BASE}/assets/${id}/exposure`);
    if (res.ok) return await res.json();
  } catch {
    // fallback
  }
  return null;
}

/**
 * Get detailed flood event history for one district (Section 3.C)
 */
export async function getDistrictDetail(pcode: string) {
  try {
    const res = await fetch(`${API_BASE}/geospatial/flood/districts/${pcode}`);
    if (res.ok) return await res.json();
  } catch {
    // backend not reachable: saved sample below
  }
  markSample("history");
  const hist = ((floodHistoryData as any).districts || []).find(
    (d: any) => d.pcode === pcode
  );
  return hist || null;
}

/**
 * Find nearest rivers and canals to a point (Dhaka District, Section 3.D)
 */
export async function getNearestWaterways(
  lng: number,
  lat: number,
  waterwayTypes: string[] = ["river", "canal"]
) {
  try {
    const res = await fetch(`${API_BASE}/geospatial/waterways/nearest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        point: { type: "Point", coordinates: [lng, lat] },
        waterway_types: waterwayTypes,
      }),
    });
    if (res.ok) return await res.json();
  } catch {
    // fallback
  }
  return null;
}

/**
 * Every district's GFS rain-forecast total for the next `hours` hours after the latest fetch
 * (GET /ingestion/rain-forecast/summary). No saved sample: without the backend there is no forecast,
 * and the map says so instead of showing an old one.
 */
export async function getRainForecastSummary(hours = 72): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE}/ingestion/rain-forecast/summary?hours=${hours}`);
    if (res.ok) return await res.json();
  } catch {
    // backend not reachable
  }
  return null;
}
