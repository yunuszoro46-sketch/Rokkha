import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import path from "path";
import { searchPlaces, type Place } from "../../src/components/map/geoData";
import { LAYERS, UNAVAILABLE_LAYERS, layerById, isNodata, type LayerData } from "../../src/components/map/mapLayers";

const GEO = path.join(__dirname, "..", "..", "public", "geo");
const index: Place[] = JSON.parse(readFileSync(path.join(GEO, "index.json"), "utf8"));

const emptyData = (over: Partial<LayerData> = {}): LayerData => ({ predictions: new Map(), forecastLoaded: true, satellite: new Map(), history: new Map(), ...over });

test("the geography index holds 1 country, 8 divisions, 64 districts and 507 upazilas with parent codes", () => {
  const by = (l: number) => index.filter((p) => p.level === l);
  expect(by(0)).toHaveLength(1);
  expect(by(1)).toHaveLength(8);
  expect(by(2)).toHaveLength(64);
  expect(by(3)).toHaveLength(507);
  for (const u of by(3)) expect(u.pcode.startsWith(u.district_pcode!)).toBe(true);
  for (const d of by(2)) expect(d.pcode.startsWith(d.division_pcode!)).toBe(true);
});

test("search finds real places only, larger areas first", () => {
  const r = searchPlaces(index, "chatto");
  expect(r[0].level).toBe(1);
  expect(r.map((p) => p.name)).toContain("Chattogram");
  expect(searchPlaces(index, "kolkata")).toHaveLength(0);
  expect(searchPlaces(index, "x")).toHaveLength(0); // too short
});

test("search also matches Bangla district names", () => {
  expect(searchPlaces(index, "সুনামগঞ্জ")[0]?.pcode).toBe("BD6090");
});

test("missing data is its own class in every layer, never 'low'", () => {
  for (const L of LAYERS) {
    const v = L.value("BD6090", emptyData(), false);
    expect(isNodata(L, v.cls), `${L.id} with no data`).toBe(true);
  }
});

test("a forecast is never shown as 0 %, and levels map to their classes", () => {
  const L = layerById("forecast");
  const p = (probability: number, alert_level: any) =>
    new Map([["BD6090", { pcode: "BD6090", name: "Sunamganj", division: "Sylhet", target_date: "2026-11-18", status: "predicted", probability, alert_level, reason: null } as any]]);
  expect(L.value("BD6090", emptyData({ predictions: p(0, "none") }), false).text.en).toBe("Low · <1 %");
  expect(L.value("BD6090", emptyData({ predictions: p(0.5, "alert") }), false).cls).toBe("alert");
  expect(L.value("BD6090", emptyData({ predictions: p(0.2, "watch") }), false).cls).toBe("watch");
  expect(L.value("BD6090", emptyData({ predictions: p(0.99, "alert") }), false).text.en).toBe("Alert · >95 %");
});

test("unavailable layers are listed with a reason in their group", () => {
  for (const u of UNAVAILABLE_LAYERS) {
    expect(u.why.en.length).toBeGreaterThan(20);
    expect(["flood", "weather", "water", "geography", "impact"]).toContain(u.group);
  }
});

test("context files: rivers ranked and named, Bangla upazila names keyed by real codes, terrain stats plausible", () => {
  const rivers = JSON.parse(readFileSync(path.join(GEO, "rivers.json"), "utf8"));
  expect(rivers.features.length).toBeGreaterThan(100);
  for (const f of rivers.features) expect([1, 2, 3]).toContain(f.properties.rank);
  const names: Record<string, string> = JSON.parse(readFileSync(path.join(GEO, "names-bn.json"), "utf8"));
  const codes = new Set(index.filter((p) => p.level === 3).map((p) => p.pcode));
  for (const k of Object.keys(names)) expect(codes.has(k)).toBe(true);
  const stats = JSON.parse(readFileSync(path.join(GEO, "terrain-stats.json"), "utf8"));
  expect(stats.BD2003.median_m).toBeGreaterThan(50); // Bandarban hills
  expect(stats.BD1078.median_m).toBeLessThan(10); // Patuakhali coast
});

test("rain forecast: classes by total, partial coverage is stated, nothing stored is 'no forecast'", () => {
  const L = layerById("rainfc");
  const rf = (total_mm: number | null, hours_covered: number) =>
    new Map([["BD6090", { district_pcode: "BD6090", fetched_at: "2026-11-19T03:30:00Z", total_mm, hours_covered, window_start: null, window_end: null }]]);
  expect(L.value("BD6090", emptyData({ rainForecast: rf(163, 72) }), false)).toEqual({ cls: "f150", text: { en: "163 mm", bn: "১৬৩ মিমি" } });
  expect(L.value("BD6090", emptyData({ rainForecast: rf(10, 50) }), false).text.en).toBe("10 mm (50 h)");
  expect(isNodata(L, L.value("BD6090", emptyData({ rainForecast: rf(null, 0) }), false).cls)).toBe(true);
  expect(isNodata(L, L.value("BD6090", emptyData({ rainForecast: new Map() }), false).cls)).toBe(true);
});
