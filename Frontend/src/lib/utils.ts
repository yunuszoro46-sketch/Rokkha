import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * GeoJSON uses [longitude, latitude]
 * Leaflet uses [latitude, longitude]
 */
export function toLeafletLatLng(coords: [number, number]): [number, number] {
  return [coords[1], coords[0]];
}

export function toGeoJsonCoord(latLng: [number, number]): [number, number] {
  return [latLng[1], latLng[0]];
}

/**
 * Format probability according to frontend guide rules:
 * - 0 to 1 range
 * - Display as percentage
 * - Anything > 0.95 displayed as "More than 95%" (never 100%)
 */
export function formatProbability(prob: number | null | undefined): string {
  if (prob === null || prob === undefined) return "N/A";
  if (prob > 0.95) return "More than 95%";
  return `${Math.round(prob * 100)}%`;
}

