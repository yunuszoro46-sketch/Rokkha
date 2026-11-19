// District helpers that keep the 0.97 MB boundary file out of pages that only need names.
//   ALL_DISTRICTS          64 districts (pcode, name, division), sorted by name: tiny, always available.
//   loadDistrictGeometry() the full COD-AB boundary GeoJSON, downloaded once, only when a page needs shapes.
import districtList from "@/data/district_list.json";

export type DistrictEntry = { pcode: string; name: string; division: string };

export const ALL_DISTRICTS: DistrictEntry[] = (districtList as { districts: DistrictEntry[] }).districts
  .slice()
  .sort((a, b) => a.name.localeCompare(b.name));

let geometry: Promise<any> | null = null;

/** The district boundary GeoJSON (same file as before), loaded on demand and cached for the session. */
export function loadDistrictGeometry(): Promise<any> {
  if (!geometry) {
    geometry = import("@/data/bangladesh_districts.json")
      .then((m) => m.default)
      .catch((err) => {
        geometry = null; // allow a retry after a failed download
        throw err;
      });
  }
  return geometry;
}

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** The district whose boundary contains the point (properties of the GeoJSON feature), or null. */
export async function findDistrictByPoint(lng: number, lat: number): Promise<any | null> {
  return districtAtPoint(await loadDistrictGeometry(), lng, lat);
}

/** Same lookup on already-loaded boundary GeoJSON. */
export function districtAtPoint(data: any, lng: number, lat: number): any | null {
  for (const f of data?.features || []) {
    const geom = f.geometry;
    if (!geom) continue;
    if (geom.type === "Polygon") {
      if (pointInRing(lng, lat, geom.coordinates[0])) return f.properties;
    } else if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates) {
        if (pointInRing(lng, lat, poly[0])) return f.properties;
      }
    }
  }
  return null;
}
