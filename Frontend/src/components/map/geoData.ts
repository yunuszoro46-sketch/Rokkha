// Bangladesh administrative geography for the map (docs/BANGLADESH_GEOGRAPHIC_DATA.md).
// Static files in public/geo, built from ONE release (COD-AB v03, BBS/OCHA, valid 2023-05-21) by
// Backend/scripts/build_map_geography.py. Each file is fetched at most once per page load; the
// browser keeps it for a day (next.config.mjs). Upazilas load one district at a time.

import { DISTRICTS_BN, DIVISIONS_BN } from "../../lib/translations";

export type AdminLevel = 0 | 1 | 2 | 3;

export interface Place {
  level: AdminLevel;
  pcode: string;
  name: string;
  division_pcode?: string;
  division?: string;
  district_pcode?: string;
  district?: string;
  /** [west, south, east, north] */
  bbox: [number, number, number, number];
  /** A point well inside the area: label position and "go to" target. */
  label: [number, number];
}

export const GEO_ATTRIBUTION = "Boundaries © BBS & UN OCHA (COD-AB v03, 2023), CC BY-IGO";
export const BANGLADESH_BBOX: [number, number, number, number] = [88.01, 20.59, 92.68, 26.63];

const cache = new Map<string, Promise<any>>();

function load<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const p = fetch(path).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(path)); // a failed download can be retried
    cache.set(path, p);
  }
  return cache.get(path)!;
}

export const loadDistricts = () => load<GeoJSON.FeatureCollection>("/geo/districts.json");
export const loadDivisions = () => load<GeoJSON.FeatureCollection>("/geo/divisions.json");
export const loadMask = () => load<GeoJSON.FeatureCollection>("/geo/mask.json");
export const loadUpazilas = (districtPcode: string) => load<GeoJSON.FeatureCollection>(`/geo/upazilas/${districtPcode}.json`);
export const loadIndex = () => load<Place[]>("/geo/index.json");

// Geographic context (Backend/scripts/build_map_context.py; sources in docs/BANGLADESH_GEOGRAPHIC_DATA.md).
export interface RiverLabel { en: string | null; bn: string | null; rank: 1 | 2 | 3; at: [number, number] }
export interface HqPlace { name: string; level: 0 | 1 | 2; pcode: string; at: [number, number] }
export interface TerrainStat { median_m: number; below_5m: number; below_10m: number; cells: number }
export const loadRivers = () => load<GeoJSON.FeatureCollection>("/geo/rivers.json");
export const loadMinorRivers = () => load<GeoJSON.FeatureCollection>("/geo/rivers-minor.json");
export const loadRiverLabels = () => load<RiverLabel[]>("/geo/river-labels.json");
export const loadPlaces = () => load<HqPlace[]>("/geo/places.json");
export const loadTerrainStats = () => load<Record<string, TerrainStat>>("/geo/terrain-stats.json");
export const OSM_ATTRIBUTION = "Rivers, Bangla upazila names © OpenStreetMap contributors (ODbL)";
export const DEM_ATTRIBUTION = "Elevation: Copernicus DEM GLO-90 © DLR/Airbus, ESA/EU";

// Bangla upazila names: only those where OpenStreetMap and COD-AB agree on location AND English name
// (names-bn.json). Community-maintained, not an official BBS spelling; missing ones stay in English.
let UPAZILA_BN: Record<string, string> = {};
export const loadUpazilaNamesBn = () =>
  load<Record<string, string>>("/geo/names-bn.json").then((m) => {
    UPAZILA_BN = m;
    return m;
  });
export const hasUpazilaBn = (pcode: string) => !!UPAZILA_BN[pcode];

/** Display name in the chosen language. COD-AB has no Bangla names; districts and divisions use the app's own list. */
export function placeName(p: Pick<Place, "level" | "pcode" | "name">, bn: boolean): string {
  if (!bn) return p.name;
  if (p.level === 0) return "বাংলাদেশ";
  if (p.level === 1) return DIVISIONS_BN[p.name] || p.name;
  if (p.level === 2) return DISTRICTS_BN[p.pcode] || p.name;
  return UPAZILA_BN[p.pcode] || p.name;
}

export const LEVEL_LABEL: Record<AdminLevel, { en: string; bn: string }> = {
  0: { en: "Country", bn: "দেশ" },
  1: { en: "Division", bn: "বিভাগ" },
  2: { en: "District", bn: "জেলা" },
  3: { en: "Upazila", bn: "উপজেলা" },
};

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ঀ-৿]+/g, " ").trim();

/**
 * Places whose name (English, or Bangla for divisions and districts) matches the query.
 * Bangladesh only; prefix matches first, then larger areas first.
 */
export function searchPlaces(index: Place[], query: string, limit = 8): Place[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const scored: { p: Place; score: number }[] = [];
  for (const p of index) {
    if (p.level === 0) continue;
    const names = [norm(p.name), norm(placeName(p, true))];
    let score = -1;
    for (const n of names) {
      if (n === q) score = Math.max(score, 3);
      else if (n.startsWith(q)) score = Math.max(score, 2);
      else if (n.split(" ").some((w) => w.startsWith(q))) score = Math.max(score, 1.5);
      else if (n.includes(q)) score = Math.max(score, 1);
    }
    if (score >= 0) scored.push({ p, score: score - p.level * 0.1 });
  }
  return scored.sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name)).slice(0, limit).map((s) => s.p);
}
