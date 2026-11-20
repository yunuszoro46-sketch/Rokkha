// River-flow stations for the map: the 9 river sites Rokkha follows, with the GloFAS daily discharge the backend
// stores (GET /ingestion/sites?kind=river, GET /ingestion/river). These are MODELLED river flows at a river
// grid cell, not gauged water levels: there is no danger level for them. Official water levels: FFWC.
// Everything below is computed from the returned values; nothing is filled in.

import { getRiverSites, getSiteRiver } from "../../services/api";

export interface FlowPoint {
  date: string; // YYYY-MM-DD
  value: number | null;
  forecast: boolean;
}

export type FlowStatus = "high2" | "high" | "usual" | "low" | "unknown";
export type Trend = "rising" | "falling" | "steady" | null;

export interface Station {
  id: string;
  name: string;
  river: string | null;
  district_pcode: string | null;
  lng: number;
  lat: number;
  series: FlowPoint[];
  latest: FlowPoint | null;
  /** Mean of the 30 days before the latest value (needs ≥ 20 of them). */
  usual: number | null;
  ratio: number | null;
  status: FlowStatus;
  /** From the latest value vs 3 days earlier: ±5 % or more is rising/falling. */
  trend: Trend;
  change3d: number | null;
  /** Forecast days (GloFAS) after the last modelled-history day, if stored. */
  forecast: FlowPoint[];
  forecastPeak: FlowPoint | null;
  fetchedAt: string | null;
  source: string | null;
  sample: boolean;
}

export const STATION_STATUS: Record<FlowStatus, { color: string; en: string; bn: string }> = {
  high2: { color: "#1E5A6B", en: "Twice the usual or more", bn: "স্বাভাবিকের দ্বিগুণ বা বেশি" },
  high: { color: "#5E9DB3", en: "Higher than usual", bn: "স্বাভাবিকের চেয়ে বেশি" },
  usual: { color: "#E8ECE4", en: "Near usual", bn: "প্রায় স্বাভাবিক" },
  low: { color: "#D9C9A8", en: "Lower than usual", bn: "স্বাভাবিকের চেয়ে কম" },
  unknown: { color: "#C9C5BA", en: "No recent value", bn: "সাম্প্রতিক মান নেই" },
};

const day = (iso: string) => iso.slice(0, 10);
const shift = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function summarise(base: Omit<Station, "latest" | "usual" | "ratio" | "status" | "trend" | "change3d" | "forecast" | "forecastPeak">): Station {
  const observed = base.series.filter((p) => !p.forecast && p.value != null);
  const latest = observed.length ? observed[observed.length - 1] : null;
  let usual: number | null = null;
  let trend: Trend = null;
  let change3d: number | null = null;
  if (latest) {
    const window = observed.filter((p) => p.date < latest.date && p.date >= shift(latest.date, -30));
    if (window.length >= 20) usual = window.reduce((a, p) => a + (p.value as number), 0) / window.length;
    const before = observed.find((p) => p.date === shift(latest.date, -3));
    if (before && before.value) {
      change3d = ((latest.value as number) - before.value) / before.value;
      trend = change3d >= 0.05 ? "rising" : change3d <= -0.05 ? "falling" : "steady";
    }
  }
  const ratio = latest && usual ? (latest.value as number) / usual : null;
  const status: FlowStatus = ratio == null ? "unknown" : ratio >= 2 ? "high2" : ratio >= 1.25 ? "high" : ratio >= 0.8 ? "usual" : "low";
  const forecast = base.series.filter((p) => p.forecast && p.value != null);
  const forecastPeak = forecast.length ? forecast.reduce((a, b) => ((b.value as number) > (a.value as number) ? b : a)) : null;
  return { ...base, latest, usual, ratio, status, trend, change3d, forecast, forecastPeak };
}

let cached: Promise<Station[]> | null = null;

/** All stations with ~120 days of values, fetched once per page load (10 small requests). */
export function loadStations(today: string): Promise<Station[]> {
  if (cached) return cached;
  cached = (async () => {
    const sites = await getRiverSites();
    const start = shift(today, -120);
    const end = shift(today, 10); // includes forecast days if the backend stored any
    return Promise.all(
      sites.map(async (s: any) => {
        const data: any = await getSiteRiver(s.site_id, start, end).catch(() => null);
        const values: any[] = data?.values || [];
        const series: FlowPoint[] = values.map((v) => ({
          date: day(String(v.date)),
          value: v.missing || v.discharge_m3s == null ? null : Number(v.discharge_m3s),
          forecast: !!v.is_forecast,
        }));
        const last = values.length ? values[values.length - 1] : null;
        return summarise({
          id: s.site_id,
          name: s.name,
          river: s.river ?? null,
          district_pcode: s.district_pcode ?? null,
          lng: s.location.coordinates[0],
          lat: s.location.coordinates[1],
          series,
          fetchedAt: last?.fetched_at ?? null,
          source: last?.source ?? data?.attribution?.[0] ?? null,
          sample: !!data?.sample,
        });
      })
    );
  })();
  cached.catch(() => {
    cached = null;
  });
  return cached;
}

/** Great-circle distance in km. */
export function distanceKm(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
