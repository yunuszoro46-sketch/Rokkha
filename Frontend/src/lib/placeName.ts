"use client";

// A readable place name ("Shantiganj, Sunamganj" / "শান্তিগঞ্জ, সুনামগঞ্জ") for a point, so citizens see
// where something is instead of latitude and longitude. The upazila comes from the backend
// (/geospatial/place-name, COD-AB boundaries); Bangla upazila names come from the map's verified list
// (public/geo/names-bn.json). Falls back to the district, then to nothing (never to raw coordinates).
import { useEffect, useState } from "react";
import { getPlaceName, PlaceNameAnswer } from "../services/rescue";
import { DISTRICTS_BN } from "./translations";

let namesBn: Promise<Record<string, string>> | null = null;
const loadNamesBn = () =>
  (namesBn ??= fetch("/geo/names-bn.json")
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))) as Promise<Record<string, string>>;

const cache = new Map<string, Promise<PlaceNameAnswer | null>>();
const key = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

export async function placeLabel(lat: number, lng: number, lang: "en" | "bn"): Promise<string | null> {
  const k = key(lat, lng);
  if (!cache.has(k)) cache.set(k, getPlaceName(lng, lat));
  const answer = await cache.get(k)!;
  if (!answer) return null;
  if (lang !== "bn") return answer.label;
  const bn = await loadNamesBn();
  const upazila = (answer.upazila_pcode && bn[answer.upazila_pcode]) || answer.upazila;
  const district = answer.district ? DISTRICTS_BN[answer.district.pcode] || answer.district.name : null;
  return [upazila, district].filter(Boolean).join(", ") || null;
}

/** React hook: the place name for a point, or null while loading / when unknown. */
export function usePlaceLabel(point: { lat: number; lng: number } | null | undefined, lang: "en" | "bn"): string | null {
  const [label, setLabel] = useState<string | null>(null);
  const lat = point?.lat;
  const lng = point?.lng;
  useEffect(() => {
    let alive = true;
    setLabel(null);
    if (lat == null || lng == null) return;
    placeLabel(lat, lng, lang).then((l) => alive && setLabel(l));
    return () => {
      alive = false;
    };
  }, [lat, lng, lang]);
  return label;
}
