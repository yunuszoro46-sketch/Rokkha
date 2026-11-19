"use client";

// Rokkha's Bangladesh flood-intelligence map (docs/MAPPING_ARCHITECTURE.md).
//
// MapLibre GL (WebGL) + official COD-AB v03 boundaries (public/geo). Interaction:
// Bangladesh → division → district → upazila → point. One district-level data layer at a time, coloured
// with feature-state (no data re-upload per change). Point Check asks our own backend (flood check +
// place name). Every value shown comes from the backend; missing values are shown as missing.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Activity,
  ArrowLeft,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Crosshair,
  FileText,
  Home,
  Info,
  Layers,
  Loader2,
  MapPin,
  Minus,
  TrendingDown,
  TrendingUp,
  Search,
  X,
} from "lucide-react";
import type { DistrictPrediction, ModelStatus, PointFloodCheck } from "../../types/api";
import { Language, depthLabel, toBnNum } from "../../lib/translations";
import { formatDay } from "../../lib/dates";
import { checkPointFlood, getAssetsExposure, getFloodDistricts, getLatestSatelliteObservations, getModelStatus, getNearestAssets, getRainForecastSummary } from "../../services/api";
import { getPlaceName, listDistrictAssets, type PlaceNameAnswer } from "../../services/rescue";
import { readGpsPosition } from "../../services/auth";
import { useSampleParts, type DataPart } from "../../services/dataSource";
import { Hydrograph } from "./Hydrograph";
import { STATION_STATUS, Station, distanceKm, loadStations } from "./riverStations";
import {
  BANGLADESH_BBOX,
  GEO_ATTRIBUTION,
  LEVEL_LABEL,
  Place,
  loadDistricts,
  loadDivisions,
  loadIndex,
  loadMask,
  loadUpazilas,
  loadRivers,
  loadMinorRivers,
  loadRiverLabels,
  loadPlaces,
  loadTerrainStats,
  loadUpazilaNamesBn,
  hasUpazilaBn,
  OSM_ATTRIBUTION,
  DEM_ATTRIBUTION,
  RiverLabel,
  HqPlace,
  TerrainStat,
  placeName,
  searchPlaces,
} from "./geoData";
import {
  GROUP_LABEL,
  KIND_LABEL,
  LAYERS,
  LayerGroup,
  RainForecastRow,
  LayerData,
  LayerId,
  UNAVAILABLE_LAYERS,
  HistoryRow,
  SatelliteLatest,
  classColor,
  isNodata,
  layerById,
} from "./mapLayers";

interface Props {
  lang: Language;
  targetDate: string;
  onChangeTargetDate: (date: string) => void;
  predictions: DistrictPrediction[];
  isForecastLoading: boolean;
  onOpenDistrictReport: (pcode: string, name: string) => void;
  /** Changes when the visitor chose "Check a place": start pick-a-place mode. */
  checkRequest?: number;
}

type Selection = { division?: Place; district?: Place; upazila?: Place };
type PointSource = "map" | "gps" | "coords";
type PointState = { lng: number; lat: number; source: PointSource; accuracy?: number | null };
type PointResult = { loading: boolean; check: PointFloodCheck | null; place: PlaceNameAnswer | null; failed: boolean };

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const MAX_BOUNDS: [[number, number], [number, number]] = [[85.8, 19.4], [95.0, 27.8]];
const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const dhakaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const eventName = (id: string) => {
  const m = id.match(/^(\d{4})-(\d{2})-(.+)$/);
  if (!m) return id;
  const month = new Date(Date.UTC(+m[1], +m[2] - 1, 1)).toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  return `${month} ${m[1]} (${m[3].replace(/-/g, " ")})`;
};

export const FloodMapExplorer: React.FC<Props> = ({ lang, targetDate, onChangeTargetDate, predictions, isForecastLoading, onOpenDistrictReport, checkRequest = 0 }) => {
  const bn = lang === "bn";
  const tr = (en: string, b: string) => (bn ? b : en);
  const n = (v: string | number) => (bn ? toBnNum(String(v)) : String(v));

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const pointMarkerRef = useRef<maplibregl.Marker | null>(null);
  const labelsRef = useRef<{ place: Place; marker: maplibregl.Marker; el: HTMLDivElement }[]>([]);
  const upazilaLabelsRef = useRef<{ place: Place; marker: maplibregl.Marker; el: HTMLDivElement }[]>([]);
  const hoverRef = useRef<{ source: string; id: string } | null>(null);
  const satCache = useRef(new Map<string, Map<string, SatelliteLatest>>());

  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [index, setIndex] = useState<Place[] | null>(null);
  const [layerId, setLayerId] = useState<LayerId>("forecast");
  const [sel, setSel] = useState<Selection>({});
  const [point, setPoint] = useState<PointState | null>(null);
  const [pointResult, setPointResult] = useState<PointResult | null>(null);
  const [satellite, setSatellite] = useState<Map<string, SatelliteLatest> | null>(null);
  const [history, setHistory] = useState<Map<string, HistoryRow> | null>(null);
  const [rainForecast, setRainForecast] = useState<Map<string, RainForecastRow> | null>(null);
  const [rainForecastMeta, setRainForecastMeta] = useState<{ start: string | null; end: string | null; fetched: string | null } | null>(null);
  const [model, setModel] = useState<ModelStatus | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  // "Check a place": while picking, the next tap anywhere in Bangladesh checks that exact spot
  // (instead of opening a division or district). Read through a ref by the map's click handler.
  const [picking, setPicking] = useState(checkRequest > 0);
  const pickingRef = useRef(picking);
  pickingRef.current = picking;
  useEffect(() => {
    if (checkRequest > 0) setPicking(true);
  }, [checkRequest]);
  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (canvas) canvas.style.cursor = picking ? "crosshair" : "";
  }, [picking, ready]);
  const [coordText, setCoordText] = useState("");
  const [coordError, setCoordError] = useState<string | null>(null);
  const [upazilaLoading, setUpazilaLoading] = useState(false);
  // The panel is drawn once: in the side panel (≥ 1024 px) or in the phone bottom sheet.
  const [isDesktop, setIsDesktop] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  // Overlays and the river-flow stations.
  const [showFill, setShowFill] = useState(true);
  const [showRivers, setShowRivers] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const [stations, setStations] = useState<Station[] | null>(null);
  const [stationError, setStationError] = useState(false);
  const [selStation, setSelStation] = useState<string | null>(null);
  const stationLabelsRef = useRef<{ st: Station; marker: maplibregl.Marker; el: HTMLDivElement }[]>([]);
  const sampleParts = useSampleParts();
  // Geography overlays and context data.
  const [showTerrain, setShowTerrain] = useState(false);
  const [showPlaces, setShowPlaces] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);
  const [basemap, setBasemap] = useState<"streets" | "plain">("streets");
  const [terrainStats, setTerrainStats] = useState<Record<string, TerrainStat> | null>(null);
  const [rivers, setRivers] = useState<{ key: string; en: string | null; bn: string | null; rank: number; km: number; bbox: [number, number, number, number] }[] | null>(null);
  const [selRiver, setSelRiver] = useState<string | null>(null);
  const [hqPlaces, setHqPlaces] = useState<HqPlace[] | null>(null);
  const [exposure, setExposure] = useState<{ pcode: string; data: any } | null>(null);
  const [nearFacilities, setNearFacilities] = useState<{ name: string; type: string; km: number; id: string }[] | null>(null);
  const [namesReady, setNamesReady] = useState(false);
  const riverLabelsRef = useRef<RiverLabel[]>([]);
  const riverMarkersRef = useRef(new Map<string, { marker: maplibregl.Marker; el: HTMLDivElement; l: RiverLabel }>());
  const hqLabelsRef = useRef<{ p: HqPlace; marker: maplibregl.Marker; el: HTMLDivElement }[]>([]);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const layer = layerById(layerId);
  const predictionMap = useMemo(() => new Map(predictions.map((p) => [p.pcode, p])), [predictions]);
  const data: LayerData = useMemo(
    () => ({ predictions: predictionMap, forecastLoaded: !isForecastLoading, satellite, history, rainForecast }),
    [predictionMap, isForecastLoading, satellite, history, rainForecast]
  );
  const issuedAt = predictions.find((p) => p.issued_at)?.issued_at;
  const today = dhakaToday();
  const byPcode = useMemo(() => new Map((index || []).map((p) => [p.pcode, p])), [index]);
  const districtsOf = useCallback((divisionPcode: string) => (index || []).filter((p) => p.level === 2 && p.division_pcode === divisionPcode), [index]);
  const upazilasOf = useCallback((districtPcode: string) => (index || []).filter((p) => p.level === 3 && p.district_pcode === districtPcode), [index]);

  // Latest values for map event handlers (they are registered once).
  const live = useRef({ sel, layer, data, bn, index: byPcode, stations, showStations, selStation, showPlaces, showRivers, exposure });
  live.current = { sel, layer, data, bn, index: byPcode, stations, showStations, selStation, showPlaces, showRivers, exposure };

  // ---------- data: satellite (per day), history (once), model (once) ----------
  useEffect(() => {
    const needSat = layerId === "observed" || !!sel.district || !!point;
    if (!needSat) return;
    const cached = satCache.current.get(targetDate);
    if (cached) return setSatellite(cached);
    setSatellite(null);
    let cancelled = false;
    getLatestSatelliteObservations(targetDate).then((rows) => {
      const m = new Map(rows.map((r: any) => [r.pcode, r as SatelliteLatest]));
      satCache.current.set(targetDate, m);
      if (!cancelled) setSatellite(m);
    });
    return () => {
      cancelled = true;
    };
  }, [layerId, targetDate, sel.district, point]);

  useEffect(() => {
    if (history || !(layerId === "history" || layerId === "hazard" || sel.district || point)) return;
    getFloodDistricts().then((rows: any[]) => setHistory(new Map(rows.map((r) => [r.pcode, r as HistoryRow]))));
  }, [layerId, sel.district, point, history]);

  useEffect(() => {
    getModelStatus().then(setModel);
  }, []);

  // Latest rain forecast (all districts, one request), when it is shown or a place is open.
  useEffect(() => {
    if (rainForecast || !(layerId === "rainfc" || sel.district || point)) return;
    getRainForecastSummary(72).then((d: any) => {
      const rows: RainForecastRow[] = d?.districts || [];
      setRainForecast(new Map(rows.filter((r) => r.district_pcode).map((r) => [r.district_pcode, r])));
      const withData = rows.filter((r) => r.total_mm != null);
      setRainForecastMeta({ start: withData[0]?.window_start ?? null, end: withData[0]?.window_end ?? null, fetched: d?.latest_fetched_at ?? null });
    });
  }, [layerId, sel.district, point, rainForecast]);

  // Context data: small files, loaded once.
  useEffect(() => {
    loadUpazilaNamesBn().then(() => setNamesReady(true)).catch(() => undefined);
    loadTerrainStats().then(setTerrainStats).catch(() => undefined);
    loadPlaces().then(setHqPlaces).catch(() => undefined);
    loadRiverLabels().then((l) => (riverLabelsRef.current = l)).catch(() => undefined);
    loadRivers()
      .then((fc) =>
        setRivers(
          fc.features.map((f: any) => {
            const coords: number[][] = f.geometry.type === "LineString" ? f.geometry.coordinates : f.geometry.coordinates.flat();
            const xs = coords.map((c) => c[0]);
            const ys = coords.map((c) => c[1]);
            return { key: f.properties.en || f.properties.bn, en: f.properties.en, bn: f.properties.bn, rank: f.properties.rank, km: f.properties.km, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number] };
          })
        )
      )
      .catch(() => undefined);
  }, []);

  // The place index (search, region lists) loads on its own, so the lists work even if the map cannot start.
  useEffect(() => {
    loadIndex().then(setIndex).catch(() => setNotice("The list of places could not be loaded."));
  }, []);

  // ---------- map set-up (once) ----------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        bounds: BANGLADESH_BBOX,
        fitBoundsOptions: { padding: 24 },
        maxBounds: MAX_BOUNDS,
        minZoom: 5.6,
        maxZoom: 15,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: false,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              maxzoom: 19,
              attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
            },
            terrain: {
              type: "raster",
              tiles: ["/geo/terrain/{z}/{x}/{y}.png"],
              tileSize: 256,
              minzoom: 6,
              maxzoom: 9,
              bounds: [88.0, 20.5, 92.75, 26.7],
              attribution: DEM_ATTRIBUTION,
            },
          },
          layers: [
            { id: "bg", type: "background", paint: { "background-color": "#F4F0E6" } },
            { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.65, "raster-opacity": 0.82, "raster-contrast": -0.08 } },
            // Copernicus DEM GLO-90 colour relief + hillshade, pre-rendered for zoom 6-9 (Backend/scripts/build_map_context.py).
            { id: "terrain", type: "raster", source: "terrain", layout: { visibility: "none" }, paint: { "raster-opacity": 0.92 } },
          ],
        },
      });
    } catch (e) {
      setMapError((e as Error).message || "WebGL is not available");
      return;
    }
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");
    // North is always up (rotation is switched off), so no compass; a metric scale for the current zoom and latitude.
    map.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 110 }), "bottom-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: GEO_ATTRIBUTION }), "bottom-right");
    map.on("error", (e) => {
      // Tile hiccups are retried by MapLibre; only report a broken data source.
      if ((e as any)?.sourceId && (e as any).sourceId !== "osm") setNotice("Some map data could not be loaded. Try again.");
    });

    map.on("load", async () => {
      try {
        const [districts, divisions, mask, idx] = await Promise.all([loadDistricts(), loadDivisions(), loadMask(), loadIndex()]);
        map.addSource("districts", { type: "geojson", data: districts, promoteId: "pcode" });
        map.addSource("divisions", { type: "geojson", data: divisions, promoteId: "pcode" });
        map.addSource("upazilas", { type: "geojson", data: EMPTY_FC, promoteId: "pcode" });
        map.addSource("mask", { type: "geojson", data: mask });

        const hover = ["boolean", ["feature-state", "hover"], false];
        map.addLayer({
          id: "district-fill",
          type: "fill",
          source: "districts",
          paint: {
            "fill-color": ["to-color", ["coalesce", ["feature-state", "color"], "#C9C5BA"]],
            "fill-opacity": ["case", hover, 0.9, ["boolean", ["feature-state", "dim"], false], 0.28, 0.74],
            "fill-opacity-transition": { duration: 250 },
          } as any,
        });
        map.addLayer({
          id: "upazila-fill",
          type: "fill",
          source: "upazilas",
          filter: ["!=", ["get", "outline"], true],
          paint: { "fill-color": "#FFFFFF", "fill-opacity": ["case", hover, 0.3, 0] } as any,
        });
        map.addLayer({
          id: "district-nodata-line",
          type: "line",
          source: "districts",
          paint: { "line-color": "#6F7F73", "line-width": 1.1, "line-dasharray": [2, 2], "line-opacity": ["case", ["boolean", ["feature-state", "nodata"], false], 0.9, 0] } as any,
        });
        map.addLayer({
          id: "district-line",
          type: "line",
          source: "districts",
          paint: { "line-color": "#4F5F53", "line-opacity": 0.55, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.45, 9, 1] },
        });
        // River network: OpenStreetMap rivers, merged by name and ranked by length (1 ≥ 150 km, 2 ≥ 40 km, 3 shorter).
        // Geographic context only, never a flood layer. Unnamed river lines load only when zoomed in.
        map.addSource("rivers", { type: "geojson", data: "/geo/rivers.json" });
        map.addSource("rivers-minor", { type: "geojson", data: EMPTY_FC });
        const riverColor = "#4F8FA3";
        map.addLayer({ id: "river-minor", type: "line", source: "rivers-minor", minzoom: 8.6, layout: { "line-cap": "round" }, paint: { "line-color": riverColor, "line-opacity": 0.5, "line-width": 0.7 } });
        map.addLayer({ id: "river-small", type: "line", source: "rivers", minzoom: 7.4, filter: ["==", ["get", "rank"], 3], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": riverColor, "line-opacity": 0.7, "line-width": ["interpolate", ["linear"], ["zoom"], 7.4, 0.6, 10, 1.4] } });
        map.addLayer({ id: "river-medium", type: "line", source: "rivers", minzoom: 6.6, filter: ["==", ["get", "rank"], 2], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": riverColor, "line-opacity": 0.8, "line-width": ["interpolate", ["linear"], ["zoom"], 6.6, 0.7, 10, 2] } });
        map.addLayer({ id: "river-major", type: "line", source: "rivers", filter: ["==", ["get", "rank"], 1], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": riverColor, "line-opacity": 0.9, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1.3, 9, 2.8, 12, 4.5] } });
        map.addLayer({ id: "river-highlight", type: "line", source: "rivers", filter: ["==", ["get", "en"], "__none__"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#1E5A6B", "line-width": ["interpolate", ["linear"], ["zoom"], 6, 3, 10, 5], "line-opacity": 0.9 } });
        map.addLayer({
          id: "upazila-line",
          type: "line",
          source: "upazilas",
          filter: ["!=", ["get", "outline"], true],
          paint: { "line-color": "#173D32", "line-opacity": 0.5, "line-width": 0.8, "line-dasharray": [3, 2] },
        });
        map.addLayer({
          id: "division-line",
          type: "line",
          source: "divisions",
          paint: { "line-color": "#173D32", "line-opacity": 0.75, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1.4, 9, 2.6] },
        });
        map.addLayer({
          id: "hover-line",
          type: "line",
          source: "districts",
          paint: { "line-color": "#173D32", "line-width": ["case", hover, 2.4, 0] } as any,
        });
        map.addLayer({
          id: "upazila-hover-line",
          type: "line",
          source: "upazilas",
          filter: ["!=", ["get", "outline"], true],
          paint: { "line-color": "#173D32", "line-width": ["case", hover, 2, 0] } as any,
        });
        map.addLayer({ id: "sel-division", type: "line", source: "divisions", filter: ["==", ["get", "pcode"], ""], paint: { "line-color": "#173D32", "line-width": 3, "line-opacity": 0.85 } });
        map.addLayer({ id: "sel-district", type: "line", source: "districts", filter: ["==", ["get", "pcode"], ""], paint: { "line-color": "#173D32", "line-width": 3.2 } });
        map.addLayer({ id: "sel-district-fine", type: "line", source: "upazilas", filter: ["==", ["get", "outline"], true], paint: { "line-color": "#173D32", "line-width": 3.4 } });
        map.addLayer({ id: "sel-upazila", type: "line", source: "upazilas", filter: ["==", ["get", "pcode"], ""], paint: { "line-color": "#247A5B", "line-width": 3, "line-opacity": 0.95 } });
        map.addLayer({ id: "mask-fill", type: "fill", source: "mask", paint: { "fill-color": "#F4F0E6", "fill-opacity": 0.9 } });
        map.addLayer({ id: "mask-line", type: "line", source: "mask", paint: { "line-color": "#173D32", "line-width": 2, "line-opacity": 0.85 } });
        // River-flow stations: a ring with a centre dot (never mistaken for an area), status colour inside.
        map.addSource("stations", { type: "geojson", data: EMPTY_FC, promoteId: "id" });
        map.addLayer({
          id: "station-halo",
          type: "circle",
          source: "stations",
          paint: {
            "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 16, ["boolean", ["feature-state", "hover"], false], 13, 0],
            "circle-color": "#247A5B",
            "circle-opacity": 0.22,
          } as any,
        });
        map.addLayer({
          id: "station-circle",
          type: "circle",
          source: "stations",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 6, 10, 8.5],
            "circle-color": ["to-color", ["coalesce", ["feature-state", "color"], "#C9C5BA"]],
            "circle-stroke-color": "#173D32",
            "circle-stroke-width": 2.4,
          } as any,
        });
        map.addLayer({ id: "station-core", type: "circle", source: "stations", paint: { "circle-radius": 2, "circle-color": "#173D32" } });
        // District and division headquarters (COD-AB v03 admin capitals): small squares, so they are not taken for data.
        map.addSource("places", { type: "geojson", data: EMPTY_FC });
        map.addLayer({
          id: "places",
          type: "circle",
          source: "places",
          minzoom: 6.8,
          paint: {
            "circle-radius": ["case", ["<=", ["get", "level"], 1], 4.2, 3],
            "circle-color": "#FFFFFF",
            "circle-stroke-color": "#173D32",
            "circle-stroke-width": ["case", ["<=", ["get", "level"], 1], 2.2, 1.6],
          },
        });
        // Registered facilities of the selected district, coloured by their own flood record (not a damage report).
        map.addSource("facilities", { type: "geojson", data: EMPTY_FC, promoteId: "id" });
        map.addLayer({
          id: "facilities",
          type: "circle",
          source: "facilities",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3.5, 12, 6],
            "circle-color": ["match", ["get", "flag"], "observed", "#1F5F8B", "hazard", "#B87955", "#FFFFFF"],
            "circle-stroke-color": "#173D32",
            "circle-stroke-width": 1.2,
          },
        });

        // Labels as HTML (Bangla needs the browser's text shaping; map-glyph fonts cannot shape Bengali).
        labelsRef.current = idx
          .filter((p) => p.level === 1 || p.level === 2)
          .map((p) => {
            const el = document.createElement("div");
            el.className = `rk-map-label ${p.level === 1 ? "rk-map-label--division" : ""}`;
            el.setAttribute("aria-hidden", "true");
            const marker = new maplibregl.Marker({ element: el }).setLngLat(p.label).addTo(map);
            return { place: p, marker, el };
          });
        setIndex(idx);
        setReady(true);
      } catch {
        setMapError("The map boundaries could not be loaded.");
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---------- colour every district for the active layer (feature-state: no data re-upload) ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !index) return;
    const focus = sel.district?.pcode;
    const focusDivision = sel.division?.pcode;
    for (const p of index) {
      if (p.level !== 2) continue;
      const v = layer.value(p.pcode, data, bn);
      const dim = focus ? p.pcode !== focus : focusDivision ? p.division_pcode !== focusDivision : false;
      map.setFeatureState(
        { source: "districts", id: p.pcode },
        showFill ? { color: classColor(layer, v.cls), nodata: isNodata(layer, v.cls), dim } : { color: "#F4F0E6", nodata: false, dim }
      );
    }
  }, [ready, index, layer, data, bn, sel.district?.pcode, sel.division?.pcode, showFill]);

  // ---------- labels: visibility by zoom and selection, then collision culling ----------
  const updateLabels = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const z = map.getZoom();
    const { sel: s, bn: b, showStations: showSt, selStation: selSt } = live.current;
    const cands: { el: HTMLDivElement; at: [number, number]; pr: number; left?: boolean }[] = [];
    for (const { place, el } of labelsRef.current) {
      let show = false;
      if (place.level === 1) show = !s.division && z < 7.3;
      else if (s.district) show = false;
      else if (s.division) show = place.division_pcode === s.division.pcode;
      else show = z >= 7.3;
      el.style.display = show ? "block" : "none";
      el.textContent = placeName(place, b);
      const [w, so, e, no] = place.bbox;
      if (show) cands.push({ el, at: place.label, pr: (place.level === 1 ? 50 : 20) + (e - w) * (no - so) });
    }
    for (const { place, el } of upazilaLabelsRef.current) {
      const show = z >= 8.4 && s.district?.pcode === place.district_pcode;
      el.style.display = show ? "block" : "none";
      el.textContent = placeName(place, b);
      const [w, so, e, no] = place.bbox;
      if (show) cands.push({ el, at: place.label, pr: 10 + (e - w) * (no - so) * 10 + (s.upazila?.pcode === place.pcode ? 100 : 0) });
    }
    const { showPlaces: showHq, showRivers: showRv } = live.current;
    for (const { p, el } of hqLabelsRef.current) {
      const inDistrict = s.district && (p.pcode === s.district.pcode || p.pcode === s.district.division_pcode || p.level === 0);
      const show = showHq && z >= 9 && (!s.district || inDistrict || z >= 10);
      el.style.display = show ? "block" : "none";
      el.textContent = p.level === 2 && b ? placeName({ level: 2, pcode: p.pcode, name: p.name }, true) : p.name;
      if (show) cands.push({ el, at: p.at, pr: 40 - p.level * 5, left: true });
    }
    // River labels: only for rivers of a size shown at this zoom, and only those inside the view (few DOM nodes).
    const maxRank = z < 7.2 ? 1 : z < 8.8 ? 2 : 3;
    const view = map.getBounds();
    const wanted = new Set<string>();
    if (showRv) {
      for (const l of riverLabelsRef.current) {
        if (l.rank > maxRank || !view.contains(l.at as [number, number])) continue;
        const key = `${l.en ?? l.bn}|${l.at[0]}|${l.at[1]}`;
        wanted.add(key);
        let m = riverMarkersRef.current.get(key);
        if (!m) {
          const el = document.createElement("div");
          el.className = "rk-map-label rk-map-label--river";
          el.setAttribute("aria-hidden", "true");
          m = { el, l, marker: new maplibregl.Marker({ element: el }).setLngLat(l.at).addTo(map) };
          riverMarkersRef.current.set(key, m);
        }
        m.el.textContent = (b ? l.bn || l.en : l.en || l.bn) ?? "";
        m.el.style.display = "block";
        cands.push({ el: m.el, at: l.at, pr: 26 - l.rank * 6 });
      }
    }
    riverMarkersRef.current.forEach((m, key) => {
      if (!wanted.has(key)) {
        m.marker.remove();
        riverMarkersRef.current.delete(key);
      }
    });
    for (const { st, el } of stationLabelsRef.current) {
      const show = showSt && (z >= 7.6 || selSt === st.id);
      el.style.display = show ? "block" : "none";
      if (show) cands.push({ el, at: [st.lng, st.lat], pr: selSt === st.id ? 200 : 30, left: true });
    }
    // Greedy placement: most important first; a label overlapping one already placed is hidden.
    const placed: [number, number, number, number][] = [];
    cands
      .map((c) => {
        const p = map.project(c.at);
        const w = c.el.offsetWidth;
        const h = c.el.offsetHeight;
        const x0 = c.left ? p.x + 10 : p.x - w / 2;
        return { ...c, box: [x0 - 3, p.y - h / 2 - 2, x0 + w + 3, p.y + h / 2 + 2] as [number, number, number, number] };
      })
      .sort((a, b2) => b2.pr - a.pr)
      .forEach((c) => {
        const hit = placed.some((q) => c.box[0] < q[2] && c.box[2] > q[0] && c.box[1] < q[3] && c.box[3] > q[1]);
        c.el.style.visibility = hit ? "hidden" : "visible";
        if (!hit) placed.push(c.box);
      });
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.on("moveend", updateLabels);
    updateLabels();
    return () => {
      map.off("moveend", updateLabels);
    };
  }, [ready, updateLabels, sel, bn, showStations, selStation, stations]);

  // ---------- river-flow stations: load once, draw, colour by status ----------
  useEffect(() => {
    if (!showStations || stations) return;
    loadStations(today)
      .then(setStations)
      .catch(() => setStationError(true));
  }, [showStations, stations, today]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !stations) return;
    (map.getSource("stations") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: stations.map((st) => ({ type: "Feature", properties: { id: st.id, name: st.name, river: st.river }, geometry: { type: "Point", coordinates: [st.lng, st.lat] } })),
    });
    stations.forEach((st) => map.setFeatureState({ source: "stations", id: st.id }, { color: STATION_STATUS[st.status].color }));
    stationLabelsRef.current.forEach((l) => l.marker.remove());
    stationLabelsRef.current = stations.map((st) => {
      const el = document.createElement("div");
      el.className = "rk-map-label rk-map-label--station";
      el.setAttribute("aria-hidden", "true");
      el.textContent = st.name;
      return { st, el, marker: new maplibregl.Marker({ element: el, anchor: "left", offset: [10, 0] }).setLngLat([st.lng, st.lat]).addTo(map) };
    });
    updateLabels();
  }, [ready, stations, updateLabels]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const vis = (on: boolean) => (on ? "visible" : "none");
    for (const id of ["river-minor", "river-small", "river-medium", "river-major", "river-highlight"]) map.setLayoutProperty(id, "visibility", vis(showRivers));
    for (const id of ["station-halo", "station-circle", "station-core"]) map.setLayoutProperty(id, "visibility", vis(showStations));
    map.setLayoutProperty("terrain", "visibility", vis(showTerrain));
    map.setLayoutProperty("places", "visibility", vis(showPlaces));
    map.setLayoutProperty("facilities", "visibility", vis(showFacilities));
    map.setLayoutProperty("osm", "visibility", vis(basemap === "streets"));
    // With terrain shown, district colours are lighter so the relief reads through them.
    const k = showTerrain ? 0.55 : 1;
    const hover = ["boolean", ["feature-state", "hover"], false];
    map.setPaintProperty("district-fill", "fill-opacity", ["case", hover, 0.9 * k, ["boolean", ["feature-state", "dim"], false], 0.28 * k, 0.74 * k] as any);
    updateLabels();
  }, [ready, showRivers, showStations, showTerrain, showPlaces, showFacilities, basemap, updateLabels]);

  // Unnamed river lines: downloaded once, the first time someone zooms in far enough to see them.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let loaded = false;
    const onZoom = () => {
      if (loaded || map.getZoom() < 8.4 || !live.current.showRivers) return;
      loaded = true;
      loadMinorRivers()
        .then((fc) => (map.getSource("rivers-minor") as maplibregl.GeoJSONSource).setData(fc))
        .catch(() => (loaded = false));
    };
    map.on("zoomend", onZoom);
    onZoom();
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [ready]);

  // Headquarters: points + labels (labels only when zoomed in).
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !hqPlaces) return;
    (map.getSource("places") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: hqPlaces.map((p) => ({ type: "Feature", properties: { name: p.name, level: p.level, pcode: p.pcode }, geometry: { type: "Point", coordinates: p.at } })),
    });
    hqLabelsRef.current.forEach((l) => l.marker.remove());
    hqLabelsRef.current = hqPlaces.map((p) => {
      const el = document.createElement("div");
      el.className = "rk-map-label rk-map-label--hq";
      el.setAttribute("aria-hidden", "true");
      return { p, el, marker: new maplibregl.Marker({ element: el, anchor: "left", offset: [7, 0] }).setLngLat(p.at).addTo(map) };
    });
    updateLabels();
  }, [ready, hqPlaces, updateLabels]);

  // River highlight for a river chosen in search.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter("river-highlight", selRiver ? ["any", ["==", ["get", "en"], selRiver], ["==", ["get", "bn"], selRiver]] : ["==", ["get", "en"], "__none__"]);
  }, [ready, selRiver]);

  // Registered facilities of the selected district and their own flood record (GET /assets/exposure).
  useEffect(() => {
    const map = mapRef.current;
    const code = sel.district?.pcode;
    if (!ready || !map) return;
    const source = map.getSource("facilities") as maplibregl.GeoJSONSource;
    if (!code) {
      source.setData(EMPTY_FC);
      return;
    }
    let cancelled = false;
    // Exposure gives each facility's own flags; the facility list gives its location. Joined by ID.
    Promise.all([getAssetsExposure(code), listDistrictAssets(code).catch(() => [])]).then(([d, list]: [any, any[]]) => {
      if (cancelled) return;
      setExposure({ pcode: code, data: d });
      const where = new Map((list || []).map((a: any) => [a.id, a.location]));
      const assets: any[] = d?.assets || [];
      source.setData({
        type: "FeatureCollection",
        features: assets
          .filter((a) => where.get(a.asset_id))
          .map((a) => ({
            type: "Feature",
            properties: { id: a.asset_id, name: a.name, type: a.asset_type, flag: a.flags?.observed_flooding ? "observed" : a.flags?.modelled_hazard_100yr ? "hazard" : "none" },
            geometry: where.get(a.asset_id),
          })),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [ready, sel.district?.pcode]);

  const prevStation = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !stations) return;
    if (prevStation.current) map.setFeatureState({ source: "stations", id: prevStation.current }, { selected: false });
    if (selStation) map.setFeatureState({ source: "stations", id: selStation }, { selected: true });
    prevStation.current = selStation;
  }, [ready, selStation, stations]);

  const openStation = useCallback((id: string) => {
    const map = mapRef.current;
    const st = live.current.stations?.find((x) => x.id === id);
    setSelStation(id);
    setShowStations(true);
    setPoint(null);
    setPointResult(null);
    setSheetOpen(true);
    if (map && st) {
      const mobile = window.innerWidth < 1024;
      map.easeTo({
        center: [st.lng, st.lat],
        zoom: Math.max(map.getZoom(), 8.6),
        padding: mobile ? { top: 70, bottom: Math.round(map.getContainer().clientHeight * 0.62), left: 0, right: 0 } : { top: 0, bottom: 0, left: 0, right: 0 },
        duration: prefersReducedMotion() ? 0 : 900,
      });
    }
  }, []);

  // ---------- selection → map filters, upazila data, camera ----------
  const fly = useCallback((bbox: [number, number, number, number], maxZoom: number) => {
    const map = mapRef.current;
    if (!map) return;
    const mobile = window.innerWidth < 1024;
    map.fitBounds(bbox, {
      padding: mobile ? { top: 76, bottom: 170, left: 24, right: 24 } : 48,
      maxZoom,
      duration: prefersReducedMotion() ? 0 : 1100,
      essential: false,
    });
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter("sel-division", ["==", ["get", "pcode"], sel.division && !sel.district ? sel.division.pcode : ""]);
    map.setFilter("sel-district", ["==", ["get", "pcode"], sel.district?.pcode ?? ""]);
    map.setFilter("sel-upazila", ["==", ["get", "pcode"], sel.upazila?.pcode ?? ""]);
  }, [ready, sel]);

  const shownDistrict = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const code = sel.district?.pcode ?? null;
    if (shownDistrict.current === code) return;
    shownDistrict.current = code;
    upazilaLabelsRef.current.forEach((l) => l.marker.remove());
    upazilaLabelsRef.current = [];
    const source = map.getSource("upazilas") as maplibregl.GeoJSONSource;
    if (!code) {
      source.setData(EMPTY_FC);
      return;
    }
    setUpazilaLoading(true);
    loadUpazilas(code)
      .then((fc) => {
        if (shownDistrict.current !== code) return;
        source.setData(fc);
        upazilaLabelsRef.current = upazilasOf(code).map((p) => {
          const el = document.createElement("div");
          el.className = "rk-map-label rk-map-label--upazila";
          el.setAttribute("aria-hidden", "true");
          return { place: p, marker: new maplibregl.Marker({ element: el }).setLngLat(p.label).addTo(map), el };
        });
        updateLabels();
      })
      .catch(() => setNotice(tr("Upazila boundaries could not be loaded.", "উপজেলার সীমানা লোড করা যায়নি।")))
      .finally(() => setUpazilaLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sel.district?.pcode, upazilasOf, updateLabels]);

  const selectPlace = useCallback(
    (p: Place, opts: { fly?: boolean; keepPoint?: boolean } = {}) => {
      const division = p.level === 1 ? p : p.division_pcode ? byPcode.get(p.division_pcode) : undefined;
      const district = p.level === 2 ? p : p.district_pcode ? byPcode.get(p.district_pcode) : undefined;
      const upazila = p.level === 3 ? p : undefined;
      setSel(p.level === 0 ? {} : { division, district, upazila });
      setSelStation(null);
      if (!opts.keepPoint) {
        setPoint(null);
        setPointResult(null);
      }
      setNotice(null);
      if (opts.fly !== false) fly(p.bbox, p.level === 0 ? 7.2 : p.level === 1 ? 8.6 : p.level === 2 ? 10.2 : 11.6);
    },
    [byPcode, fly]
  );

  const resetToBangladesh = useCallback(() => {
    setSel({});
    setSelStation(null);
    setSelRiver(null);
    setPoint(null);
    setPointResult(null);
    setNotice(null);
    fly(BANGLADESH_BBOX, 7.2);
  }, [fly]);

  const goBack = useCallback(() => {
    if (selStation) {
      setSelStation(null);
      return;
    }
    if (selRiver) {
      setSelRiver(null);
      return;
    }
    if (point) {
      setPoint(null);
      setPointResult(null);
      return;
    }
    if (sel.upazila && sel.district) return selectPlace(sel.district);
    if (sel.district && sel.division) return selectPlace(sel.division);
    resetToBangladesh();
  }, [point, sel, selStation, selRiver, selectPlace, resetToBangladesh]);

  // ---------- Point Check ----------
  const checkPoint = useCallback(
    async (pt: PointState, flyTo: boolean) => {
      const map = mapRef.current;
      setPoint(pt);
      setSelStation(null);
      setSheetOpen(true);
      setPointResult({ loading: true, check: null, place: null, failed: false });
      if (map) {
        if (!pointMarkerRef.current) {
          const el = document.createElement("div");
          el.className = "rk-point-marker";
          el.innerHTML = '<span class="rk-point-ring"></span><span class="rk-point-dot"></span>';
          pointMarkerRef.current = new maplibregl.Marker({ element: el });
        }
        pointMarkerRef.current.setLngLat([pt.lng, pt.lat]).addTo(map);
        // On phones the details sheet covers the lower part: keep the point in the visible part above it.
        const mobile = window.innerWidth < 1024;
        const h = map.getContainer().clientHeight;
        if (flyTo || mobile) map.easeTo({
          center: [pt.lng, pt.lat],
          zoom: flyTo ? Math.max(map.getZoom(), 10.5) : map.getZoom(),
          padding: mobile ? { top: 70, bottom: Math.round(h * 0.62), left: 0, right: 0 } : { top: 0, bottom: 0, left: 0, right: 0 },
          duration: prefersReducedMotion() ? 0 : 900,
        });
      }
      const [check, place] = await Promise.all([checkPointFlood(pt.lng, pt.lat), getPlaceName(pt.lng, pt.lat)]);
      setPointResult({ loading: false, check, place, failed: !check && !place });
      setNearFacilities(null);
      if (place?.district) {
        getNearestAssets(pt.lng, pt.lat, 10000)
          .then((rs: any[]) =>
            setNearFacilities(
              rs.slice(0, 4).map((r) => ({ id: r.asset.id, name: r.asset.name, type: r.asset.asset_type, km: (r.distance_meters ?? r.distance_m ?? 0) / 1000 }))
            )
          )
          .catch(() => setNearFacilities([]));
      }
      // Keep the breadcrumb in step with where the point really is.
      const idx = live.current.index;
      const district = place?.district ? idx.get(place.district.pcode) : undefined;
      const upazila = place?.upazila_pcode ? idx.get(place.upazila_pcode) : undefined;
      if (district) {
        setSel({ division: district.division_pcode ? idx.get(district.division_pcode) : undefined, district, upazila });
      }
    },
    []
  );

  useEffect(() => {
    if (!point) pointMarkerRef.current?.remove();
  }, [point]);

  // ---------- pointer interaction (registered once) ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "rk-map-tip", offset: 14, maxWidth: "260px" });

    const pick = (e: maplibregl.MapMouseEvent): MapGeoJSONFeature | undefined => {
      const box: [maplibregl.PointLike, maplibregl.PointLike] = [[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]];
      const st = live.current.showStations ? map.queryRenderedFeatures(box, { layers: ["station-circle"] })[0] : undefined;
      if (st) return st;
      const fac = map.getLayoutProperty("facilities", "visibility") !== "none" ? map.queryRenderedFeatures(box, { layers: ["facilities"] })[0] : undefined;
      if (fac) return fac;
      const fs = map.queryRenderedFeatures(e.point, { layers: ["upazila-fill", "district-fill"] });
      return fs.find((f) => f.layer.id === "upazila-fill") ?? fs.find((f) => f.layer.id === "district-fill");
    };
    const setHover = (next: { source: string; id: string } | null) => {
      const cur = hoverRef.current;
      if (cur && (!next || cur.id !== next.id || cur.source !== next.source)) map.setFeatureState({ source: cur.source, id: cur.id }, { hover: false });
      if (next && (!cur || cur.id !== next.id || cur.source !== next.source)) map.setFeatureState({ source: next.source, id: next.id }, { hover: true });
      hoverRef.current = next;
    };

    let frame = 0;
    const onMove = (e: maplibregl.MapMouseEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const f = pick(e);
        if (!f) {
          setHover(null);
          popupRef.current?.remove();
          map.getCanvas().style.cursor = "";
          return;
        }
        const source = f.layer.id === "station-circle" ? "stations" : f.layer.id === "facilities" ? "facilities" : f.layer.id === "upazila-fill" ? "upazilas" : "districts";
        const id = String(f.id);
        const changed = !hoverRef.current || hoverRef.current.id !== id;
        setHover({ source, id });
        map.getCanvas().style.cursor = "pointer";
        const { layer: L, data: D, bn: B, index: I, stations: S } = live.current;
        if (changed && source === "facilities") {
          const pr = f.properties as any;
          const rec =
            pr.flag === "observed"
              ? B ? "আগে স্যাটেলাইটে এখানে বন্যার পানি দেখা গেছে" : "Flood water seen here before (satellite record)"
              : pr.flag === "hazard"
                ? B ? "মডেলের ১০০ বছরের বন্যা এলাকায়" : "Inside the modelled 100-year flood zone"
                : B ? "এখানে বন্যার কোনো রেকর্ড নেই" : "No flood record at this spot";
          popupRef.current!.setHTML(`<strong>${esc(pr.name)} <span>${esc(pr.type)}</span></strong><em>${esc(rec)}</em>`);
        } else if (changed && source === "stations") {
          const st = S?.find((x) => x.id === id);
          const status = st ? STATION_STATUS[st.status] : null;
          popupRef.current!.setHTML(
            `<strong>${esc(st?.name ?? id)} <span>${B ? "নদী-প্রবাহ স্টেশন" : "River-flow station"}</span></strong><em>${B ? "মডেলের প্রবাহ" : "Modelled flow"}: ${esc(status ? (B ? status.bn : status.en) : "—")}</em>`
          );
        } else if (changed) {
          const props = f.properties as any;
          const districtCode = source === "upazilas" ? props.district_pcode : id;
          const value = L.value(districtCode, D, B);
          const title = source === "upazilas" ? `${esc(placeName({ level: 3, pcode: id, name: props.name }, B))} <span>${B ? "উপজেলা" : "Upazila"}</span>` : `${esc(placeName(I.get(id) ?? { level: 2, pcode: id, name: props.name }, B))} <span>${esc(B ? "জেলা" : "District")}</span>`;
          popupRef.current!.setHTML(`<strong>${title}</strong><em>${esc(B ? L.short.bn : L.short.en)}${source === "upazilas" ? (B ? " (জেলা)" : " (district)") : ""}: ${esc(B ? value.text.bn : value.text.en)}</em>`);
        }
        popupRef.current!.setLngLat(e.lngLat).addTo(map);
      });
    };
    const onLeave = () => {
      setHover(null);
      popupRef.current?.remove();
    };
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const f = pick(e);
      const { sel: s, index: I, bn: B } = live.current;
      if (pickingRef.current && f) {
        setPicking(false);
        checkPoint({ lng: e.lngLat.lng, lat: e.lngLat.lat, source: "map" }, true);
        return;
      }
      if (!f) {
        setNotice(B ? "রক্ষা শুধু বাংলাদেশের তথ্য দেখায়।" : "Rokkha shows Bangladesh only. Choose a place inside the country.");
        return;
      }
      popupRef.current?.remove();
      const props = f.properties as any;
      if (f.layer.id === "station-circle") {
        openStation(String(f.id));
        return;
      }
      if (f.layer.id === "facilities") {
        // A facility: check its exact spot.
        const [lng, lat] = (f.geometry as any).coordinates;
        checkPoint({ lng, lat, source: "map" }, false);
        return;
      }
      if (f.layer.id === "upazila-fill") {
        const u = I.get(String(f.id));
        if (u && s.upazila?.pcode !== u.pcode) {
          // First click inside a district opens the upazila; every click checks the exact spot.
          setSel({ division: s.division, district: s.district, upazila: u });
          if (!s.upazila) fly(u.bbox, 11.6);
        }
        checkPoint({ lng: e.lngLat.lng, lat: e.lngLat.lat, source: "map" }, false);
        return;
      }
      const d = I.get(props.pcode);
      if (d) selectPlace(d);
      setSelRiver(null);
    };

    map.on("mousemove", onMove);
    map.on("mouseout", onLeave);
    map.on("click", onClick);
    return () => {
      map.off("mousemove", onMove);
      map.off("mouseout", onLeave);
      map.off("click", onClick);
      popupRef.current?.remove();
    };
  }, [ready, selectPlace, checkPoint, fly, openStation]);

  // ---------- search ----------
  type RiverItem = NonNullable<typeof rivers>[number];
  type Result = { type: "place"; p: Place } | { type: "station"; s: Station } | { type: "river"; r: RiverItem };
  const results: Result[] = useMemo(() => {
    const places: Result[] = index ? searchPlaces(index, query).map((p) => ({ type: "place" as const, p })) : [];
    const q = query.trim().toLowerCase();
    const sts: Result[] =
      q.length >= 2 && stations
        ? stations.filter((st) => st.name.toLowerCase().includes(q) || (st.river || "").toLowerCase().startsWith(q)).map((st) => ({ type: "station" as const, s: st }))
        : [];
    const rvs: Result[] =
      q.length >= 2 && rivers
        ? rivers
            .filter((r) => (r.en || "").toLowerCase().startsWith(q) || (r.bn || "").startsWith(query.trim()))
            .sort((a, b) => a.rank - b.rank)
            .map((r) => ({ type: "river" as const, r }))
        : [];
    return [...places.slice(0, 6), ...sts.slice(0, 2), ...rvs.slice(0, 3)];
  }, [index, query, stations, rivers]);
  const resultKey = (r: Result) => (r.type === "place" ? r.p.pcode : r.type === "station" ? `st-${r.s.id}` : `rv-${r.r.key}`);
  const chooseResult = (r: Result) => {
    setQuery("");
    setSearchOpen(false);
    if (r.type === "place") selectPlace(r.p);
    else if (r.type === "station") openStation(r.s.id);
    else {
      setSelRiver(r.r.key);
      setShowRivers(true);
      setSelStation(null);
      setSheetOpen(true);
      fly(r.r.bbox, 9.5);
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    setNotice(null);
    try {
      const [lng, lat] = await readGpsPosition(bn);
      checkPoint({ lng, lat, source: "gps" }, true);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setLocating(false);
    }
  };

  const submitCoords = (e: React.FormEvent) => {
    e.preventDefault();
    const m = coordText.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) return setCoordError(tr("Write latitude, longitude — for example 24.85, 91.14", "অক্ষাংশ, দ্রাঘিমাংশ লিখুন — যেমন 24.85, 91.14"));
    const lat = +m[1];
    const lng = +m[2];
    const [w, s, ea, no] = BANGLADESH_BBOX;
    if (lat < s || lat > no || lng < w || lng > ea) return setCoordError(tr("That point is outside Bangladesh.", "এই বিন্দু বাংলাদেশের বাইরে।"));
    setCoordError(null);
    checkPoint({ lng, lat, source: "coords" }, true);
  };

  // ---------- derived panel content ----------
  const current: Place | undefined = sel.upazila ?? sel.district ?? sel.division;
  const crumbs: Place[] = [byPcode.get("BD"), sel.division, sel.district, sel.upazila].filter(Boolean) as Place[];
  const valueOf = (pcode: string) => layer.value(pcode, data, bn);
  const counts = useMemo(() => {
    if (!index) return [];
    const scope = index.filter((p) => p.level === 2 && (!sel.division || p.division_pcode === sel.division.pcode));
    return layer.classes
      .map((c) => ({ c, count: scope.filter((p) => layer.value(p.pcode, data, bn).cls === c.id).length }))
      .filter((x) => x.count > 0);
  }, [index, layer, data, bn, sel.division]);
  const formatIssued = (iso?: string) =>
    iso ? n(new Date(iso).toLocaleString(bn ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) : null;
  const dateLabel = n(new Date(`${targetDate}T00:00:00Z`).toLocaleDateString(bn ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }));

  const kindBadge = (kind: keyof typeof KIND_LABEL) => (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold font-mono uppercase tracking-wide ${
        kind === "forecast" ? "bg-rk-warning-soft text-rk-warning" : kind === "observed" ? "bg-rk-info-soft text-rk-info" : kind === "historical" || kind === "modelled" ? "bg-rk-secondary text-rk-clay-text" : "bg-rk-brand-soft text-rk-brand-strong"
      }`}
    >
      {bn ? KIND_LABEL[kind].bn : KIND_LABEL[kind].en}
    </span>
  );

  // Data status, only with meanings that are really implemented: the server's daily data, the saved sample
  // (backend unreachable), a fixed historical/model record, or nothing for this day.
  const PART: Record<string, DataPart> = { forecast: "predictions", rain: "predictions", river: "predictions", observed: "satellite", history: "history", hazard: "history" };
  const statusOf = (L: typeof layer): { en: string; bn: string; tone: string } => {
    if (sampleParts.includes(PART[L.id])) return { en: "Saved sample", bn: "সংরক্ষিত নমুনা", tone: "bg-rk-warning-soft text-rk-warning" };
    if (L.latest) {
      if (rainForecast && !rainForecastMeta?.start) return { en: "Not available yet", bn: "এখনো নেই", tone: "bg-rk-danger-soft text-rk-danger" };
      return { en: "Daily update", bn: "দৈনিক হালনাগাদ", tone: "bg-rk-success-soft text-rk-success" };
    }
    if (!L.dateDependent) return { en: "Fixed record", bn: "স্থায়ী রেকর্ড", tone: "bg-rk-secondary text-rk-clay-text" };
    if (L.needs === "predictions" && !isForecastLoading && predictions.length === 0) return { en: "Not available for this day", bn: "এই দিনের জন্য নেই", tone: "bg-rk-danger-soft text-rk-danger" };
    if (L.needs === "rainforecast" && rainForecast && !rainForecastMeta?.start) return { en: "Not available yet", bn: "এখনো নেই", tone: "bg-rk-danger-soft text-rk-danger" };
    return { en: "Daily update", bn: "দৈনিক হালনাগাদ", tone: "bg-rk-success-soft text-rk-success" };
  };
  const statusBadge = (L: typeof layer) => {
    const st = statusOf(L);
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.tone}`}>{bn ? st.bn : st.en}</span>;
  };

  const Legend = ({ compact = false }: { compact?: boolean }) => (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="text-[13px] font-bold text-rk-forest">{bn ? layer.label.bn : layer.label.en}</p>
        {kindBadge(layer.kind)}
      </div>
      <div className="mt-1">{statusBadge(layer)}{!showFill && <span className="ml-1.5 text-[12px] text-rk-muted">{tr("(colours hidden)", "(রঙ লুকানো)")}</span>}</div>
      {showTerrain && <div className="mt-2 border-t border-rk-line pt-2">{TerrainLegend()}</div>}
      <ul className={`mt-2 ${compact ? "grid grid-cols-2 gap-x-3 gap-y-1" : "space-y-1"}`}>
        {layer.classes.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-[13px] text-rk-ink leading-tight">
            <span aria-hidden="true" className={`h-3.5 w-5 shrink-0 rounded-sm border ${c.nodata ? "border-dashed border-rk-muted" : "border-black/10"}`} style={{ background: c.color }} />
            {bn ? c.label.bn : c.label.en}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-rk-muted leading-snug">
        {layer.latest
          ? rainForecastMeta?.start
            ? `${tr("Latest forecast", "সর্বশেষ পূর্বাভাস")}: ${formatIssued(rainForecastMeta.start)} – ${formatIssued(rainForecastMeta.end ?? undefined)} ${tr("(BD time)", "(বাংলাদেশ সময়)")} · `
            : `${tr("No forecast stored yet", "এখনো কোনো পূর্বাভাস নেই")} · `
          : layer.dateDependent
            ? `${tr("For", "তারিখ")} ${dateLabel} · `
            : `${tr("Fixed record, not for one day", "নির্দিষ্ট দিনের নয়")} · `}
        {bn ? layer.source.bn : layer.source.en}
      </p>
    </div>
  );

  const FACT_GROUPS: { title: { en: string; bn: string }; ids: LayerId[] }[] = [
    { title: { en: "Conditions now", bn: "এখনকার অবস্থা" }, ids: ["observed"] },
    { title: { en: "Forecast", bn: "পূর্বাভাস" }, ids: ["forecast"] },
    { title: { en: "Rain and rivers", bn: "বৃষ্টি ও নদী" }, ids: ["rain", "rainfc", "river"] },
    { title: { en: "Background", bn: "পটভূমি" }, ids: ["history", "hazard"] },
  ];
  const factRow = (id: LayerId, pcode: string) => {
    const L = layerById(id);
    const v = L.value(pcode, data, bn);
    return (
      <button
        key={L.id}
        type="button"
        onClick={() => setLayerId(L.id)}
        aria-pressed={layerId === L.id}
        title={tr("Show this layer on the map", "মানচিত্রে এই স্তর দেখান")}
        className={`w-full grid grid-cols-[auto_1fr] items-center gap-x-3 px-3 py-2 text-left hover:bg-rk-secondary ${layerId === L.id ? "bg-rk-brand-soft" : ""}`}
      >
        <span aria-hidden="true" className={`h-3 w-3 rounded-sm border ${isNodata(L, v.cls) ? "border-dashed border-rk-muted" : "border-black/10"}`} style={{ background: classColor(L, v.cls) }} />
        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="text-[13px] text-rk-muted">{bn ? L.label.bn : L.label.en}</span>
          <span className="text-[14px] font-semibold text-rk-forest">{bn ? v.text.bn : v.text.en}</span>
        </span>
      </button>
    );
  };
  const DistrictFacts = ({ pcode }: { pcode: string }) => {
    const p = predictionMap.get(pcode);
    return (
      <div className="space-y-2.5">
        {FACT_GROUPS.map((g) => (
          <div key={g.title.en}>
            <h4 className="mb-1 font-mono text-[11px] uppercase tracking-wider text-rk-muted">{bn ? g.title.bn : g.title.en}</h4>
            <div className="divide-y divide-rk-line rounded-xl border border-rk-line bg-rk-surface overflow-hidden">{g.ids.map((id) => factRow(id, pcode))}</div>
          </div>
        ))}
        {p?.data_through && p.status === "predicted" && (
          <p className="font-mono text-xs text-rk-muted">
            {tr("Forecast for", "পূর্বাভাস")} {formatDay(p.target_date, bn ? "bn" : "en")} · {tr("data through", "তথ্য পর্যন্ত")} {p.data_through ? formatDay(p.data_through, bn ? "bn" : "en") : "—"}
            {p.issued_at ? ` · ${tr("issued", "তৈরি")} ${formatIssued(p.issued_at)}` : ""}
          </p>
        )}
      </div>
    );
  };

  const flowText = (st: Station) => {
    const status = STATION_STATUS[st.status];
    return bn ? status.bn : status.en;
  };
  const trendView = (st: Station) => {
    if (!st.trend || st.change3d == null) return <span className="text-rk-muted">{tr("Trend not available", "প্রবণতা নেই")}</span>;
    const pctTxt = `${Math.abs(Math.round(st.change3d * 100))} %`;
    const Icon = st.trend === "rising" ? TrendingUp : st.trend === "falling" ? TrendingDown : Minus;
    const word = st.trend === "rising" ? tr("Rising", "বাড়ছে") : st.trend === "falling" ? tr("Falling", "কমছে") : tr("Steady", "স্থির");
    return (
      <span className="block">
        <span className="inline-flex items-center gap-1 font-semibold"><Icon className="w-4 h-4" aria-hidden="true" /> {word}</span>
        {st.trend !== "steady" && <span className="block text-[12px] text-rk-muted">{n(pctTxt)} {tr("in 3 days", "৩ দিনে")}</span>}
      </span>
    );
  };
  const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(bn ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const daysOld = (iso: string) => Math.round((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${iso}T00:00:00Z`).getTime()) / 86400000);

  const TERRAIN_LEGEND: [string, string][] = [
    ["#2E6F78", "< 2 m"], ["#5D9B96", "2–5 m"], ["#97C1A0", "5–10 m"], ["#CCDCAA", "10–20 m"], ["#E5D8A0", "20–50 m"],
    ["#D6B480", "50–100 m"], ["#B88C62", "100–300 m"], ["#967056", "300–800 m"], ["#806252", "> 800 m"],
  ];
  const TerrainLegend = () => (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold text-rk-forest">{tr("Ground height (terrain)", "ভূমির উচ্চতা (ভূপ্রকৃতি)")}</p>
        {kindBadge("reference")}
      </div>
      <ul className="mt-1.5 grid grid-cols-3 gap-x-2 gap-y-1">
        {TERRAIN_LEGEND.map(([c, l]) => (
          <li key={l} className="flex items-center gap-1.5 text-[12px] text-rk-ink"><span aria-hidden="true" className="h-3 w-4 rounded-sm border border-black/10" style={{ background: c }} />{n(l)}</li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] text-rk-muted leading-snug">
        {tr(
          "Metres above sea level, with hill shading. Copernicus DEM GLO-90 (90 m, 2011–2015 radar, surface model: trees and buildings add height; errors of a few metres matter in flat land). Shown at up to ~280 m per pixel. Height alone does not predict flooding.",
          "সমুদ্রপৃষ্ঠ থেকে উচ্চতা (মিটার), ছায়াসহ। Copernicus DEM GLO-90 (৯০ মি; গাছ ও ভবনের উচ্চতাও ধরা; সমতলে কয়েক মিটার ভুল গুরুত্বপূর্ণ)। শুধু উচ্চতা দিয়ে বন্যা বলা যায় না।"
        )}
      </p>
    </div>
  );
  const terrainBlock = (code: string | undefined, label: string) => {
    const t = code && terrainStats ? terrainStats[code] : undefined;
    if (!t) return <p className="text-rk-muted">{tr("Terrain statistics are not available here.", "এখানে ভূপ্রকৃতির তথ্য নেই।")}</p>;
    return (
      <>
        <p>
          {tr(`${label}: typical ground height`, `${label}: সাধারণ ভূমির উচ্চতা`)} <strong>{n(t.median_m)} {tr("m", "মি")}</strong>
          {tr("; land below 5 m: ", "; ৫ মি-এর নিচে জমি: ")}<strong>{n(Math.round(t.below_5m * 100))} %</strong>
          {tr(", below 10 m: ", ", ১০ মি-এর নিচে: ")}<strong>{n(Math.round(t.below_10m * 100))} %</strong>
        </p>
        <p className="text-xs text-rk-muted">{tr("Median of the 90 m elevation cells inside the boundary (Copernicus DEM, a surface model). Low ground is one flood factor, not a forecast.", "সীমানার ভেতরের ৯০ মি উচ্চতা-ঘরের মধ্যমা (Copernicus DEM)। নিচু জমি বন্যার একটি কারণ মাত্র, পূর্বাভাস নয়।")}</p>
      </>
    );
  };
  const exposureBlock = (pcode: string) => {
    const ex = exposure && exposure.pcode === pcode ? exposure.data : null;
    if (!ex) return <p className="text-rk-muted">{tr("Loading registered facilities…", "নিবন্ধিত স্থাপনা লোড হচ্ছে…")}</p>;
    const sum = ex.summary;
    const flagged = (ex.assets || []).filter((a: any) => a.flags?.observed_flooding || a.flags?.modelled_hazard_100yr).slice(0, 4);
    return (
      <>
        <p>
          {tr(`${sum.total.assets} registered facilities in the district: `, `জেলায় ${n(sum.total.assets)}টি নিবন্ধিত স্থাপনা: `)}
          <strong>{n(sum.with_observed_flooding.assets)}</strong> {tr("where satellites saw flood water before", "যেখানে আগে স্যাটেলাইটে বন্যার পানি দেখা গেছে")},{" "}
          <strong>{n(sum.with_modelled_hazard_100yr.assets)}</strong> {tr("inside the modelled 100-year flood zone", "মডেলের ১০০ বছরের বন্যা এলাকায়")}.
        </p>
        {flagged.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-[13px]">
            {flagged.map((a: any) => (
              <li key={a.asset_id} className="flex gap-1.5">
                <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: a.flags?.observed_flooding ? "#1F5F8B" : "#B87955" }} />
                <span>{a.name} <span className="text-rk-muted">· {a.asset_type}</span></span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-rk-muted">{tr("Facilities from an OpenStreetMap snapshot (not complete, not checked on the ground). Flags are past satellite records and a long-term hazard model, not current damage or closures. No people count is estimated.", "OpenStreetMap থেকে নেওয়া স্থাপনা (সম্পূর্ণ নয়, মাঠে যাচাই নয়)। চিহ্ন অতীতের স্যাটেলাইট রেকর্ড ও দীর্ঘমেয়াদি মডেল, বর্তমান ক্ষতি নয়।")}</p>
      </>
    );
  };
  const RiverPanel = () => {
    const r = rivers?.find((x) => x.key === selRiver);
    if (!r) return null;
    const name = bn ? r.bn || r.en : r.en || r.bn;
    const related = (stations || []).filter((st) => r.en && (st.river || "").toLowerCase().includes(r.en.toLowerCase()));
    return (
      <section aria-labelledby="rk-river-title" className="rounded-2xl border-2 border-rk-river/50 bg-rk-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-rk-river-text">{tr("River · map context", "নদী · মানচিত্রের প্রসঙ্গ")}</p>
            <h2 id="rk-river-title" className="mt-0.5 text-lg font-extrabold text-rk-forest">{name}</h2>
            {r.en && r.bn && <p className="text-[13px] text-rk-muted">{bn ? r.en : r.bn}</p>}
          </div>
          <button type="button" onClick={() => setSelRiver(null)} className="h-9 w-9 shrink-0 rounded-lg border border-rk-line inline-flex items-center justify-center text-rk-muted hover:text-rk-forest" aria-label={tr("Close the river", "নদী বন্ধ করুন")}>
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-[14px] text-rk-ink">{tr(`About ${r.km} km of mapped river line in and near Bangladesh.`, `বাংলাদেশে ও কাছাকাছি প্রায় ${n(r.km)} কিমি নদীরেখা।`)}</p>
        {related.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {related.map((st) => (
              <li key={st.id}>
                <button type="button" onClick={() => openStation(st.id)} className="text-left text-[14px] font-semibold text-rk-brand-strong underline underline-offset-2">{st.name}</button>
                <span className="text-[13px] text-rk-muted"> · {flowText(st)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[13px] text-rk-muted">{tr("No followed river-flow station is on this river.", "এই নদীতে অনুসৃত কোনো নদী-প্রবাহ স্টেশন নেই।")}</p>
        )}
        <p className="mt-2 text-xs text-rk-muted">{tr("River line and names from OpenStreetMap (community-mapped). Geographic context only — not a flood or water-level layer.", "নদীরেখা ও নাম OpenStreetMap থেকে। কেবল ভৌগোলিক প্রসঙ্গ — বন্যা বা পানির উচ্চতার স্তর নয়।")}</p>
      </section>
    );
  };

  const StationPanel = () => {
    const st = stations?.find((x) => x.id === selStation);
    if (!st) return null;
    const district = st.district_pcode ? byPcode.get(st.district_pcode) : undefined;
    const age = st.latest ? daysOld(st.latest.date) : null;
    return (
      <section aria-labelledby="rk-station-title" className="rounded-2xl border-2 border-rk-river/60 bg-rk-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-rk-river-text">{tr("River-flow station · modelled", "নদী-প্রবাহ স্টেশন · মডেল")}</p>
            <h2 id="rk-station-title" className="mt-0.5 text-lg font-extrabold text-rk-forest">{st.name}</h2>
            <p className="text-[13px] text-rk-muted">
              {st.river ? `${tr("River", "নদী")} ${st.river}` : ""}
              {district ? ` · ${tr("District", "জেলা")} ${placeName(district, bn)}` : ""}
            </p>
          </div>
          <button type="button" onClick={() => setSelStation(null)} className="h-9 w-9 shrink-0 rounded-lg border border-rk-line inline-flex items-center justify-center text-rk-muted hover:text-rk-forest" aria-label={tr("Close the station", "স্টেশন বন্ধ করুন")}>
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        {st.latest ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-rk-page px-3 py-2">
              <p className="text-[12px] text-rk-muted">{tr("Latest daily flow", "সর্বশেষ দৈনিক প্রবাহ")}</p>
              <p className="text-xl font-extrabold text-rk-forest">{n(Math.round(st.latest.value as number).toLocaleString("en-GB"))} <span className="text-[13px] font-semibold">m³/s</span></p>
              <p className="font-mono text-[11px] text-rk-muted">{shortDate(st.latest.date)}</p>
            </div>
            <div className="rounded-xl bg-rk-page px-3 py-2">
              <p className="text-[12px] text-rk-muted">{tr("Compared with usual", "স্বাভাবিকের তুলনায়")}</p>
              <p className="flex items-center gap-1.5 text-[15px] font-bold text-rk-forest">
                <span aria-hidden="true" className="h-3 w-3 rounded-full border border-rk-forest" style={{ background: STATION_STATUS[st.status].color }} />
                {flowText(st)}
              </p>
              <p className="text-[13px] text-rk-ink">{trendView(st)}</p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-rk-muted">{tr("No recent value is stored for this station.", "এই স্টেশনের সাম্প্রতিক কোনো মান সংরক্ষিত নেই।")}</p>
        )}
        {st.forecastPeak ? (
          <p className="mt-2 rounded-lg bg-rk-secondary px-3 py-2 text-[13px] text-rk-ink">
            <span className="mb-1 block">{kindBadge("forecast")}</span>
            {tr("GloFAS forecast", "GloFAS পূর্বাভাস")} {shortDate(st.forecast[0].date)}–{shortDate(st.forecast[st.forecast.length - 1].date)}:{" "}
            {tr("highest", "সর্বোচ্চ")} <strong>{n(Math.round(st.forecastPeak.value as number).toLocaleString("en-GB"))} m³/s</strong> {tr("on", "")} {shortDate(st.forecastPeak.date)}
            {st.usual != null && (
              <span className="text-rk-muted"> · {tr("×", "×")}{n(((st.forecastPeak.value as number) / st.usual).toFixed(2))} {tr("of usual", "স্বাভাবিকের")}</span>
            )}
            <span className="mt-1 block text-[12px] text-rk-muted">{tr("A model forecast of river flow, not of water level or flooding.", "নদী-প্রবাহের মডেল পূর্বাভাস, পানির উচ্চতা বা বন্যার নয়।")}</span>
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-rk-muted">{tr("No river-flow forecast stored for this station yet.", "এই স্টেশনের নদী-প্রবাহ পূর্বাভাস এখনো সংরক্ষিত নেই।")}</p>
        )}
        {age != null && age > 3 && (
          <p className="mt-2 rounded-lg bg-rk-warning-soft px-3 py-1.5 text-[13px] text-rk-warning">{tr(`The latest value is ${age} days old.`, `সর্বশেষ মানটি ${n(age)} দিন আগের।`)}</p>
        )}
        <div className="mt-3">
          <Hydrograph series={st.series} usual={st.usual} bn={bn} />
        </div>
        <p className="mt-2 rounded-lg bg-rk-info-soft px-3 py-2 text-[13px] text-rk-ink">
          {tr(
            "This is modelled river flow (GloFAS) at a river grid cell, not a gauge water level, so there is no danger level here. Official water levels and danger levels: ",
            "এটি নদীর একটি গ্রিড ঘরে মডেলভিত্তিক প্রবাহ (GloFAS), গেজের পানির উচ্চতা নয়; তাই এখানে বিপদসীমা নেই। সরকারি পানির উচ্চতা ও বিপদসীমা: "
          )}
          <a href="https://www.ffwc.gov.bd/" target="_blank" rel="noopener noreferrer" className="font-semibold text-rk-brand-strong underline underline-offset-2">ffwc.gov.bd</a>
        </p>
        <details className="mt-2 rounded-xl border border-rk-line px-3 py-2">
          <summary className="cursor-pointer text-[13px] font-semibold text-rk-forest">{tr("Source and technical details", "উৎস ও প্রযুক্তিগত বিবরণ")}</summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
            <dt className="text-rk-muted">{tr("Station ID", "স্টেশন আইডি")}</dt><dd className="font-mono text-rk-ink">{st.id}</dd>
            <dt className="text-rk-muted">{tr("Location", "অবস্থান")}</dt><dd className="font-mono text-rk-ink">{st.lat.toFixed(4)}° N, {st.lng.toFixed(4)}° E</dd>
            <dt className="text-rk-muted">{tr("Source", "উৎস")}</dt><dd className="text-rk-ink">{st.source || "GloFAS (Copernicus EMS) via Open-Meteo"}</dd>
            {st.fetchedAt && (<><dt className="text-rk-muted">{tr("Retrieved", "সংগ্রহ")}</dt><dd className="font-mono text-rk-ink">{formatIssued(st.fetchedAt)}</dd></>)}
            {st.usual != null && (<><dt className="text-rk-muted">{tr("Usual", "স্বাভাবিক")}</dt><dd className="font-mono text-rk-ink">{n(Math.round(st.usual))} m³/s {tr("(mean of the 30 days before)", "(আগের ৩০ দিনের গড়)")}</dd></>)}
            <dt className="text-rk-muted">{tr("Status", "অবস্থা")}</dt><dd className="text-rk-ink">{st.sample ? tr("Saved sample (server not reachable)", "সংরক্ষিত নমুনা (সার্ভারে পৌঁছানো যায়নি)") : tr("Daily update from Rokkha's server", "রক্ষার সার্ভারের দৈনিক হালনাগাদ")}</dd>
          </dl>
          <p className="mt-2 text-[12px] text-rk-muted">{tr("Daily mean flow. Trend compares the latest day with 3 days earlier (±5 % or more). One of 9 river sites; the forecast model uses the nearest one for each district.", "দৈনিক গড় প্রবাহ। প্রবণতা: সর্বশেষ দিন বনাম ৩ দিন আগে (±৫% বা বেশি)। ৯টি নদী-বিন্দুর একটি।")}</p>
        </details>
      </section>
    );
  };

  const modelInfo = model?.model as any;
  const PointPanel = () => {
    if (!point || !pointResult) return null;
    const c = pointResult.check;
    const place = pointResult.place;
    const districtCode = place?.district?.pcode ?? c?.district?.pcode;
    const hazard = (rp: number) => c?.cell?.hazard?.find((h) => h.return_period_years === rp);
    const cellSize = c?.cell?.grid_cell_size_m ?? 90;
    return (
      <section aria-labelledby="rk-point-title" className="rounded-2xl border-2 border-rk-brand/40 bg-rk-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-rk-brand-strong">{tr("Point check", "জায়গা যাচাই")}</p>
            <h2 id="rk-point-title" className="mt-0.5 text-lg font-extrabold text-rk-forest">
              {pointResult.loading ? tr("Checking this spot…", "এই জায়গা যাচাই হচ্ছে…") : place?.label || c?.district?.name || tr("Outside Bangladesh", "বাংলাদেশের বাইরে")}
            </h2>
            {place?.district && (
              <p className="text-[13px] text-rk-muted">
                {place.upazila ? `${tr("Upazila", "উপজেলা")} ${place.upazila} · ` : ""}
                {tr("District", "জেলা")} {placeName({ level: 2, pcode: place.district.pcode, name: place.district.name }, bn)} · {tr("Division", "বিভাগ")}{" "}
                {placeName({ level: 1, pcode: "", name: place.district.division }, bn)}
              </p>
            )}
          </div>
          <button type="button" onClick={() => { setPoint(null); setPointResult(null); }} className="h-9 w-9 shrink-0 rounded-lg border border-rk-line inline-flex items-center justify-center text-rk-muted hover:text-rk-forest" aria-label={tr("Clear the point", "বিন্দু মুছুন")}>
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {pointResult.loading && (
          <p className="mt-3 flex items-center gap-2 text-sm text-rk-muted" role="status">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> {tr("Asking Rokkha's server…", "রক্ষার সার্ভারে জানতে চাওয়া হচ্ছে…")}
          </p>
        )}
        {!pointResult.loading && pointResult.failed && (
          <p className="mt-3 text-sm text-rk-danger" role="alert">{tr("The check could not reach the server. Try again.", "সার্ভারে পৌঁছানো যায়নি। আবার চেষ্টা করুন।")}</p>
        )}
        {!pointResult.loading && !pointResult.failed && !districtCode && (
          <p className="mt-3 text-sm text-rk-ink">{tr("This point is outside Bangladesh, so Rokkha has no data for it.", "এই বিন্দু বাংলাদেশের বাইরে, তাই রক্ষার কাছে তথ্য নেই।")}</p>
        )}

        {!pointResult.loading && districtCode && (() => {
          const obsLayer = layerById("observed");
          const obs = obsLayer.value(districtCode, data, bn);
          const fc = layerById("forecast").value(districtCode, data, bn);
          const pred = predictionMap.get(districtCode);
          const f = pred?.features;
          const nearest = stations
            ? stations.map((st) => ({ st, km: distanceKm(point.lng, point.lat, st.lng, st.lat) })).sort((a, b) => a.km - b.km)[0]
            : null;
          const section = (title: string, children: React.ReactNode, badge?: React.ReactNode) => (
            <div className="border-t border-rk-line pt-3">
              <h3 className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-rk-forest">{title} {badge}</h3>
              <div className="mt-1.5 text-[14px] text-rk-ink">{children}</div>
            </div>
          );
          return (
            <div className="mt-3 space-y-3">
              {section(
                tr("Current flood condition", "বর্তমান বন্যা পরিস্থিতি"),
                <>
                  <p className="flex items-center gap-2">
                    <span aria-hidden="true" className={`h-3 w-3 rounded-sm border ${isNodata(obsLayer, obs.cls) ? "border-dashed border-rk-muted" : "border-black/10"}`} style={{ background: classColor(obsLayer, obs.cls) }} />
                    {bn ? obs.text.bn : obs.text.en}
                  </p>
                  <p className="text-xs text-rk-muted">{tr("Latest radar pass over the whole district (Copernicus GFM).", "পুরো জেলার সর্বশেষ রাডার ছবি (Copernicus GFM)।")}</p>
                  {c?.cell?.permanent_water && <p className="mt-1">{tr("This spot is permanent water (river or lake).", "এই জায়গা স্থায়ী পানি (নদী বা জলাশয়)।")}</p>}
                </>,
                kindBadge("observed")
              )}
              {section(
                tr("Forecast", "পূর্বাভাস"),
                <>
                  <p className="font-semibold">{bn ? fc.text.bn : fc.text.en}</p>
                  <p className="text-xs text-rk-muted">
                    {tr(`For ${dateLabel}, for the whole district — not for this exact spot.`, `${dateLabel}, পুরো জেলার জন্য — এই নির্দিষ্ট জায়গার জন্য নয়।`)}
                    {pred?.issued_at ? ` ${tr("Issued", "তৈরি")} ${formatIssued(pred.issued_at)}.` : ""}
                  </p>
                </>,
                kindBadge("forecast")
              )}
              {section(
                tr("Rainfall", "বৃষ্টি"),
                f && f.rain_7d != null ? (
                  <>
                    <p>
                      {tr("Last 7 days", "গত ৭ দিন")}: <strong>{n(Math.round(f.rain_7d))} {tr("mm", "মিমি")}</strong>
                      {f.rain_1d != null && <> · {tr("last day", "শেষ দিন")}: <strong>{n(Math.round(f.rain_1d))} {tr("mm", "মিমি")}</strong></>}
                    </p>
                    <p className="text-xs text-rk-muted">{tr("At the district's weather point, up to the day before the forecast (ERA5 / GFS estimates, not rain gauges).", "জেলার আবহাওয়া-বিন্দুতে, পূর্বাভাসের আগের দিন পর্যন্ত (ERA5 / GFS অনুমান, বৃষ্টিমাপক নয়)।")}</p>
                    {(() => {
                      const rf = rainForecast?.get(districtCode);
                      return rf && rf.total_mm != null ? (
                        <p className="mt-1">
                          {tr("Forecast next", "পরের")} {n(rf.hours_covered)} {tr("h", "ঘণ্টায় পূর্বাভাস")}: <strong>{n(Math.round(rf.total_mm))} {tr("mm", "মিমি")}</strong>{" "}
                          <span className="text-xs text-rk-muted">({tr("GFS weather model, from", "GFS আবহাওয়া মডেল,")} {formatIssued(rf.window_start ?? undefined)})</span>
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-rk-muted">{tr("No rain forecast stored.", "বৃষ্টির পূর্বাভাস সংরক্ষিত নেই।")}</p>
                      );
                    })()}
                  </>
                ) : (
                  <p className="text-rk-muted">{tr("No rain data for this district and day.", "এই জেলা ও দিনের বৃষ্টির তথ্য নেই।")}</p>
                ),
                kindBadge("model-input")
              )}
              {section(
                tr("Nearby river", "কাছের নদী"),
                nearest ? (
                  <>
                    <button type="button" onClick={() => openStation(nearest.st.id)} className="text-left font-semibold text-rk-brand-strong underline underline-offset-2">
                      {nearest.st.name}
                    </button>
                    <span className="text-rk-muted"> · {n(Math.round(nearest.km))} {tr("km", "কিমি")} {tr("away", "দূরে")}</span>
                    <p className="mt-0.5 flex items-center gap-1.5">
                      <span aria-hidden="true" className="h-3 w-3 rounded-full border border-rk-forest" style={{ background: STATION_STATUS[nearest.st.status].color }} />
                      {flowText(nearest.st)}
                      {nearest.st.latest && <span className="text-rk-muted">· {shortDate(nearest.st.latest.date)}</span>}
                    </p>
                    <p className="text-xs text-rk-muted">{tr("Nearest of 9 followed river sites; modelled flow, not a gauge reading. It may be on a different river from this spot.", "অনুসৃত ৯টি নদী-বিন্দুর নিকটতম; মডেলের প্রবাহ, গেজ নয়। এটি অন্য নদীতেও হতে পারে।")}</p>
                  </>
                ) : (
                  <p className="text-rk-muted">{stationError ? tr("River stations could not be loaded.", "নদী-স্টেশন লোড করা যায়নি।") : tr("Loading river stations…", "নদী-স্টেশন লোড হচ্ছে…")}</p>
                ),
                kindBadge("model-input")
              )}
              {section(
                tr(`Flood record at this spot (~${cellSize} m cell)`, `এই জায়গার বন্যার রেকর্ড (~${cellSize} মিটার ঘর)`),
                c?.cell ? (
                  <ul className="space-y-1.5">
                    <li>
                      <span className="mb-0.5 block">{kindBadge("historical")}</span>
                      {c.cell.times_observed > 0
                        ? tr(`Flood water seen here in ${c.cell.times_flooded} of ${c.cell.times_observed} analysed events (UNOSAT, 2016–2024).`, `বিশ্লেষিত ${n(c.cell.times_observed)}টি ঘটনার ${n(c.cell.times_flooded)}টিতে এখানে বন্যার পানি দেখা গেছে (UNOSAT)।`)
                        : tr("No satellite flood analysis covered this spot.", "কোনো স্যাটেলাইট বিশ্লেষণ এই জায়গা দেখেনি।")}
                      {!!c.cell.flooded_event_ids?.length && <span className="block text-xs text-rk-muted">{c.cell.flooded_event_ids.map(eventName).join(" · ")}</span>}
                    </li>
                    <li>
                      <span className="mb-0.5 block">{kindBadge("modelled")}</span>
                      {hazard(100)?.depth_label
                        ? tr(`Modelled depth in a 1-in-100-year river flood: ${hazard(100)!.depth_label}`, `১০০ বছরে একবারের নদী-বন্যায় মডেলের গভীরতা: ${depthLabel(hazard(100)!.depth_label!, "bn")}`)
                        : tr("Outside the modelled river-flood zone (1-in-100-year).", "মডেলের নদী-বন্যা এলাকার বাইরে (১০০ বছরে একবার)।")}
                      {hazard(10)?.depth_label && <span className="block text-xs text-rk-muted">{tr("1-in-10-year flood:", "১০ বছরে একবার:")} {depthLabel(hazard(10)!.depth_label!, bn ? "bn" : "en")}</span>}
                    </li>
                  </ul>
                ) : (
                  <p className="text-rk-muted">{tr("Cell-level data needs the server; it is not available right now.", "ঘর-স্তরের তথ্যের জন্য সার্ভার দরকার; এখন পাওয়া যাচ্ছে না।")}</p>
                )
              )}
              {section(
                tr("Geography and terrain", "ভূগোল ও ভূপ্রকৃতি"),
                <>
                  {terrainBlock(place?.upazila_pcode ?? districtCode, place?.upazila_pcode ? placeName({ level: 3, pcode: place.upazila_pcode, name: place.upazila || "" }, bn) : placeName({ level: 2, pcode: districtCode, name: place?.district?.name || "" }, bn))}
                  <p className="text-xs text-rk-muted">{tr("Height at the exact spot is not shown: the terrain tiles are pictures, not measurements.", "নির্দিষ্ট জায়গার উচ্চতা দেখানো হয় না।")}</p>
                </>,
                kindBadge("reference")
              )}
              {section(
                tr("Facilities nearby", "কাছের স্থাপনা"),
                nearFacilities == null ? (
                  <p className="text-rk-muted">{tr("Looking for registered facilities…", "নিবন্ধিত স্থাপনা খোঁজা হচ্ছে…")}</p>
                ) : nearFacilities.length === 0 ? (
                  <p className="text-rk-muted">{tr("No registered facility within 10 km.", "১০ কিমির মধ্যে কোনো নিবন্ধিত স্থাপনা নেই।")}</p>
                ) : (
                  <>
                    <ul className="space-y-0.5 text-[13px]">
                      {nearFacilities.map((f) => {
                        const ex = exposure?.data?.assets?.find((a: any) => a.asset_id === f.id);
                        const flag = ex?.flags?.observed_flooding ? tr("flood water seen there before", "আগে বন্যার পানি দেখা গেছে") : ex?.flags?.modelled_hazard_100yr ? tr("in modelled 100-year zone", "মডেলের ১০০ বছরের এলাকায়") : null;
                        return (
                          <li key={f.id}>
                            {f.name} <span className="text-rk-muted">· {f.type} · {n(f.km.toFixed(1))} km{flag ? ` · ${flag}` : ""}</span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-1 text-xs text-rk-muted">{tr("Registered facilities (OpenStreetMap snapshot, not complete). Being nearby does not mean affected.", "নিবন্ধিত স্থাপনা (OpenStreetMap, সম্পূর্ণ নয়)। কাছে থাকা মানে ক্ষতিগ্রস্ত নয়।")}</p>
                  </>
                )
              )}
              <details className="rounded-xl border border-rk-line px-3 py-2">
                <summary className="cursor-pointer text-[13px] font-semibold text-rk-forest">{tr("Sources, coordinates and limits", "উৎস, স্থানাঙ্ক ও সীমাবদ্ধতা")}</summary>
                <p className="mt-2 font-mono text-xs text-rk-ink">
                  {point.lat.toFixed(5)}° N, {point.lng.toFixed(5)}° E · {point.source === "gps" ? tr("from your device", "আপনার ডিভাইস থেকে") : point.source === "coords" ? tr("typed", "লেখা") : tr("map click", "মানচিত্রে চাপ")}
                </p>
                <p className="mt-1 text-xs text-rk-muted">{tr(`Spot values describe the ~${cellSize} m grid cell containing the point (no nearest-cell substitution). District values apply to the whole district.`, `এই জায়গার মান বিন্দুটি যে ~${cellSize} মিটার ঘরে আছে তার; জেলার মান পুরো জেলার।`)}</p>
                <ul className="mt-2 list-disc pl-4 space-y-1 text-xs text-rk-muted">
                  {(c?.limitations || []).map((l) => <li key={l}>{l}</li>)}
                </ul>
                {c?.attribution && <p className="mt-2 text-[11px] text-rk-muted">{c.attribution}</p>}
                {place?.attribution && <p className="mt-1 text-[11px] text-rk-muted">{place.attribution}</p>}
              </details>
            </div>
          );
        })()}
      </section>
    );
  };

  const RegionPanel = () => {
    if (!index) return null;
    if (!current) {
      const divisions = index.filter((p) => p.level === 1);
      return (
        <section aria-labelledby="rk-region-title" className="space-y-3">
          <h2 id="rk-region-title" className="text-[15px] font-bold text-rk-forest">{tr("Across Bangladesh's 64 districts", "বাংলাদেশের ৬৪ জেলায়")}</h2>
          <ul className="flex flex-wrap gap-1.5">
            {counts.map(({ c, count }) => (
              <li key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-rk-line bg-rk-surface px-2.5 py-1 text-[13px] text-rk-ink">
                <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${c.nodata ? "border border-dashed border-rk-muted" : ""}`} style={{ background: c.color }} />
                <strong>{n(count)}</strong> {bn ? c.label.bn : c.label.en}
              </li>
            ))}
          </ul>
          <div>
            <h3 className="text-[13px] font-semibold text-rk-muted">{tr("Explore a division", "একটি বিভাগ দেখুন")}</h3>
            <ul className="mt-1.5 grid grid-cols-2 gap-1.5">
              {divisions.map((d) => (
                <li key={d.pcode}>
                  <button type="button" onClick={() => selectPlace(d)} className="w-full min-h-11 rounded-lg border border-rk-line bg-rk-surface px-3 text-left text-[14px] font-semibold text-rk-forest hover:border-rk-brand hover:bg-rk-brand-soft">
                    {placeName(d, bn)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    }
    if (current.level === 1) {
      const ds = districtsOf(current.pcode);
      return (
        <section aria-labelledby="rk-region-title" className="space-y-3">
          <h2 id="rk-region-title" className="text-[15px] font-bold text-rk-forest">{tr(`${ds.length} districts`, `${n(ds.length)}টি জেলা`)}</h2>
          <ul className="flex flex-wrap gap-1.5">
            {counts.map(({ c, count }) => (
              <li key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-rk-line bg-rk-surface px-2.5 py-1 text-[13px]">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} /> <strong>{n(count)}</strong> {bn ? c.label.bn : c.label.en}
              </li>
            ))}
          </ul>
          <ul className="divide-y divide-rk-line rounded-xl border border-rk-line bg-rk-surface">
            {ds.map((d) => {
              const v = valueOf(d.pcode);
              return (
                <li key={d.pcode}>
                  <button type="button" onClick={() => selectPlace(d)} className="w-full min-h-11 px-3 py-2 flex items-center gap-3 text-left hover:bg-rk-secondary">
                    <span aria-hidden="true" className={`h-3 w-3 rounded-sm border ${isNodata(layer, v.cls) ? "border-dashed border-rk-muted" : "border-black/10"}`} style={{ background: classColor(layer, v.cls) }} />
                    <span className="flex-1 text-[14px] font-semibold text-rk-forest">{placeName(d, bn)}</span>
                    <span className="text-[13px] text-rk-muted">{bn ? v.text.bn : v.text.en}</span>
                    <ChevronRight className="w-4 h-4 text-rk-muted" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      );
    }
    const district = sel.district!;
    const ups = upazilasOf(district.pcode);
    return (
      <section aria-labelledby="rk-region-title" className="space-y-3">
        <h2 id="rk-region-title" className="sr-only">{tr("District information", "জেলার তথ্য")}</h2>
        {current.level === 3 && (
          <p className="rounded-xl bg-rk-secondary px-3 py-2 text-[13px] text-rk-ink">
            {tr(
              `Rokkha's data is made per district. ${current.name} shows ${placeName(district, false)} district's values; tap a spot to check modelled depth and past flooding there.`,
              `রক্ষার তথ্য জেলা-ভিত্তিক। ${current.name} এ ${placeName(district, true)} জেলার মান দেখানো হচ্ছে; নির্দিষ্ট জায়গার জন্য মানচিত্রে চাপ দিন।`
            )}
          </p>
        )}
        {DistrictFacts({ pcode: district.pcode })}
        <div>
          <h4 className="mb-1 font-mono text-[11px] uppercase tracking-wider text-rk-muted">{tr("Geography and terrain", "ভূগোল ও ভূপ্রকৃতি")}</h4>
          <div className="rounded-xl border border-rk-line bg-rk-surface px-3 py-2 text-[14px] text-rk-ink space-y-1.5">
            {terrainBlock(district.pcode, placeName(district, bn))}
            {current.level === 3 && terrainBlock(current.pcode, placeName(current, bn))}
            {(() => {
              const hq = hqPlaces?.find((h) => h.pcode === district.pcode || (h.level < 2 && hqPlaces.every((x) => x.pcode !== district.pcode) && h.name === district.name));
              return hq ? <p className="text-[13px] text-rk-muted">{tr("Headquarters", "সদর দপ্তর")}: {hq.name}</p> : null;
            })()}
          </div>
        </div>
        <div>
          <h4 className="mb-1 font-mono text-[11px] uppercase tracking-wider text-rk-muted">{tr("What could be exposed", "কী ঝুঁকিতে থাকতে পারে")}</h4>
          <div className="rounded-xl border border-rk-line bg-rk-surface px-3 py-2 text-[14px] text-rk-ink">{exposureBlock(district.pcode)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onOpenDistrictReport(district.pcode, district.name)} className="h-11 px-3.5 rounded-xl bg-rk-brand hover:bg-rk-brand-strong text-white text-sm font-bold inline-flex items-center gap-2">
            <FileText className="w-4 h-4" aria-hidden="true" /> {tr("District report", "জেলার প্রতিবেদন")}
          </button>
        </div>
        {current.level === 2 && (
          <div>
            <h3 className="text-[13px] font-semibold text-rk-muted">
              {tr(`${ups.length} upazilas`, `${n(ups.length)}টি উপজেলা`)} {upazilaLoading && <Loader2 className="inline w-3.5 h-3.5 animate-spin" aria-label={tr("loading", "লোড হচ্ছে")} />}
            </h3>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {ups.map((u) => (
                <li key={u.pcode}>
                  <button type="button" onClick={() => selectPlace(u)} className="min-h-9 rounded-lg border border-rk-line bg-rk-surface px-2.5 text-[13px] font-semibold text-rk-forest hover:border-rk-brand hover:bg-rk-brand-soft">
                    {u.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  };

  const PanelBody = () => (
    <div className="space-y-4">
      {/* The selected object comes first. */}
      {selStation && StationPanel()}
      {selRiver && !selStation && RiverPanel()}
      {point && PointPanel()}

      {/* Forecast day */}
      <div className="rounded-xl border border-rk-line bg-rk-surface px-3 py-2.5">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onChangeTargetDate(addDays(targetDate, -1))} className="h-9 w-9 rounded-lg border border-rk-line inline-flex items-center justify-center text-rk-forest hover:bg-rk-secondary" aria-label={tr("Previous day", "আগের দিন")}>
            <ChevronDown className="w-4 h-4 rotate-90" aria-hidden="true" />
          </button>
          <div className="flex-1 text-center">
            <p className="font-mono text-[11px] uppercase tracking-wider text-rk-muted">{tr("Forecast day", "পূর্বাভাসের দিন")}</p>
            <p className="text-[15px] font-bold text-rk-forest">{dateLabel}{targetDate === today ? ` · ${tr("today", "আজ")}` : ""}</p>
          </div>
          <button type="button" disabled={targetDate >= today} onClick={() => onChangeTargetDate(addDays(targetDate, 1))} className="h-9 w-9 rounded-lg border border-rk-line inline-flex items-center justify-center text-rk-forest hover:bg-rk-secondary disabled:opacity-40" aria-label={tr("Next day", "পরের দিন")}>
            <ChevronDown className="w-4 h-4 -rotate-90" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-xs text-rk-muted" aria-live="polite">
          {isForecastLoading
            ? tr("Getting the forecast…", "পূর্বাভাস আনা হচ্ছে…")
            : predictions.length === 0
              ? (
                  <>
                    {tr("No forecast issued for this day — not the same as no risk.", "এই দিনের পূর্বাভাস নেই — এর মানে ঝুঁকি নেই, তা নয়।")}{" "}
                    <button type="button" onClick={() => onChangeTargetDate(addDays(targetDate, -1))} className="font-semibold text-rk-brand-strong underline underline-offset-2">
                      {tr("See the day before", "আগের দিন দেখুন")}
                    </button>
                  </>
                )
              : `${tr("One-day forecast, issued", "এক দিনের পূর্বাভাস, তৈরি")} ${formatIssued(issuedAt) ?? "—"} ${tr("(Bangladesh time)", "(বাংলাদেশ সময়)")}`}
        </p>
      </div>


      {RegionPanel()}

      {/* Map layers, grouped. One district data layer at a time (radio); overlays are switches. */}
      <div>
        <h2 className="flex items-center gap-1.5 text-[13px] font-bold text-rk-forest">
          <Layers className="w-4 h-4 text-rk-brand" aria-hidden="true" /> {tr("Map layers", "মানচিত্রের স্তর")}
        </h2>
        <div className="mt-2 space-y-2">
          {(["flood", "weather", "water", "geography", "impact"] as LayerGroup[]).map((g) => {
            const radios = LAYERS.filter((L) => L.group === g);
            const missing = UNAVAILABLE_LAYERS.filter((u) => u.group === g);
            const activeHere = radios.some((L) => L.id === layerId);
            return (
              <details key={g} open={g === "flood" || activeHere || g === "water"} className="rounded-xl border border-rk-line bg-rk-surface">
                <summary className="cursor-pointer list-none px-3 py-2 flex items-center justify-between text-[13px] font-bold text-rk-forest">
                  <span>{bn ? GROUP_LABEL[g].bn : GROUP_LABEL[g].en}</span>
                  <ChevronDown className="w-4 h-4 text-rk-muted" aria-hidden="true" />
                </summary>
                <div className="px-2 pb-2 space-y-1.5">
                  {radios.map((L) => (
                    <label key={L.id} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-2.5 py-2 ${layerId === L.id ? "border-rk-brand bg-rk-brand-soft" : "border-transparent hover:bg-rk-secondary"}`}>
                      <input type="radio" name="rk-layer" value={L.id} checked={layerId === L.id} onChange={() => setLayerId(L.id)} className="mt-1 accent-[#247A5B]" />
                      <span className="flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="text-[14px] font-semibold text-rk-forest">{bn ? L.label.bn : L.label.en}</span>
                          {kindBadge(L.kind)}
                        </span>
                        {layerId === L.id && (
                          <>
                            <span className="mt-1 block text-[13px] text-rk-muted leading-snug">{bn ? L.what.bn : L.what.en}</span>
                            <span className="mt-1.5 block">{statusBadge(L)}</span>
                          </>
                        )}
                      </span>
                    </label>
                  ))}
                  {g === "water" && (
                    <>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-rk-secondary">
                        <input type="checkbox" checked={showStations} onChange={(e) => { setShowStations(e.target.checked); if (!e.target.checked) setSelStation(null); }} className="mt-1 h-4 w-4 accent-[#247A5B]" />
                        <span className="flex-1">
                          <span className="flex flex-wrap items-center justify-between gap-1.5 text-[14px] font-semibold text-rk-forest">{tr("River-flow stations", "নদী-প্রবাহ স্টেশন")} {kindBadge("model-input")}</span>
                          <span className="block text-[13px] text-rk-muted">{tr("9 river sites; modelled daily flow compared with its usual level. Not gauge water levels.", "৯টি নদী-বিন্দু; স্বাভাবিকের তুলনায় মডেলের দৈনিক প্রবাহ। গেজের পানির উচ্চতা নয়।")}</span>
                          {showStations && (
                            <span className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
                              {(Object.keys(STATION_STATUS) as (keyof typeof STATION_STATUS)[]).map((k) => (
                                <span key={k} className="flex items-center gap-1.5 text-[12px] text-rk-ink">
                                  <span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-rk-forest" style={{ background: STATION_STATUS[k].color }} />
                                  {bn ? STATION_STATUS[k].bn : STATION_STATUS[k].en}
                                </span>
                              ))}
                            </span>
                          )}
                          {showStations && !stations && !stationError && <span className="mt-1 flex items-center gap-1.5 text-[12px] text-rk-muted"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />{tr("Loading stations…", "স্টেশন লোড হচ্ছে…")}</span>}
                          {stationError && <span className="mt-1 block text-[12px] text-rk-danger">{tr("Stations could not be loaded.", "স্টেশন লোড করা যায়নি।")}</span>}
                        </span>
                      </label>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-rk-secondary">
                        <input type="checkbox" checked={showRivers} onChange={(e) => setShowRivers(e.target.checked)} className="mt-1 h-4 w-4 accent-[#247A5B]" />
                        <span className="flex-1">
                          <span className="flex items-center gap-2 text-[14px] font-semibold text-rk-forest"><span aria-hidden="true" className="inline-block h-0.5 w-5 rounded bg-[#4F8FA3]" /> {tr("Rivers", "নদী")}</span>
                          <span className="block text-[13px] text-rk-muted">{tr("314 named rivers by size, smaller ones as you zoom in (OpenStreetMap). Context only, not a flood layer.", "আকার অনুযায়ী ৩১৪টি নামযুক্ত নদী; কাছে গেলে ছোটগুলো (OpenStreetMap)। শুধু প্রসঙ্গ, বন্যার স্তর নয়।")}</span>
                        </span>
                      </label>
                    </>
                  )}
                  {g === "geography" && (
                    <>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-rk-secondary">
                        <input type="checkbox" checked={showTerrain} onChange={(e) => setShowTerrain(e.target.checked)} className="mt-1 h-4 w-4 accent-[#247A5B]" />
                        <span className="flex-1">
                          <span className="flex flex-wrap items-center justify-between gap-1.5 text-[14px] font-semibold text-rk-forest">{tr("Terrain and elevation", "ভূপ্রকৃতি ও উচ্চতা")} {kindBadge("reference")}</span>
                          <span className="block text-[13px] text-rk-muted">{tr("Ground height with hill shading (Copernicus DEM, 90 m). Off by default so flood colours stay clear.", "ছায়াসহ ভূমির উচ্চতা (Copernicus DEM, ৯০ মি)।")}</span>
                          {showTerrain && <span className="mt-2 block">{TerrainLegend()}</span>}
                        </span>
                      </label>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-rk-secondary">
                        <input type="checkbox" checked={showPlaces} onChange={(e) => setShowPlaces(e.target.checked)} className="mt-1 h-4 w-4 accent-[#247A5B]" />
                        <span className="flex-1">
                          <span className="text-[14px] font-semibold text-rk-forest">{tr("District and division headquarters", "জেলা ও বিভাগীয় সদর")}</span>
                          <span className="block text-[13px] text-rk-muted">{tr("Official headquarters points (BBS/OCHA COD-AB). Names show when zoomed in.", "সরকারি সদরের অবস্থান (BBS/OCHA)। কাছে গেলে নাম দেখায়।")}</span>
                        </span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-rk-ink hover:bg-rk-secondary">
                        <input type="checkbox" checked={showFill} onChange={(e) => setShowFill(e.target.checked)} className="h-4 w-4 accent-[#247A5B]" />
                        {tr("Colour the districts by the data layer", "ডেটা-স্তর অনুযায়ী জেলায় রঙ দিন")}
                      </label>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] text-rk-ink" role="radiogroup" aria-label={tr("Base map", "ভিত্তি মানচিত্র")}>
                        <span className="text-rk-muted">{tr("Base map", "ভিত্তি মানচিত্র")}:</span>
                        {(["streets", "plain"] as const).map((b) => (
                          <label key={b} className={`cursor-pointer rounded-lg border px-2.5 py-1 ${basemap === b ? "border-rk-brand bg-rk-brand-soft font-semibold" : "border-rk-line"}`}>
                            <input type="radio" name="rk-basemap" className="sr-only" checked={basemap === b} onChange={() => setBasemap(b)} />
                            {b === "streets" ? tr("Street map", "রাস্তার মানচিত্র") : tr("Plain (less data)", "সাধারণ (কম ডেটা)")}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                  {g === "impact" && (
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-rk-secondary">
                      <input type="checkbox" checked={showFacilities} onChange={(e) => setShowFacilities(e.target.checked)} className="mt-1 h-4 w-4 accent-[#247A5B]" />
                      <span className="flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-1.5 text-[14px] font-semibold text-rk-forest">{tr("Facilities and their flood record", "স্থাপনা ও তাদের বন্যার রেকর্ড")} {kindBadge("historical")}</span>
                        <span className="block text-[13px] text-rk-muted">{tr("Hospitals, clinics, shelters and schools of the selected district (OpenStreetMap snapshot). Coloured by each one's own record — not current damage.", "নির্বাচিত জেলার হাসপাতাল, ক্লিনিক, আশ্রয়কেন্দ্র ও স্কুল। প্রতিটির নিজের রেকর্ড অনুযায়ী রঙ — বর্তমান ক্ষতি নয়।")}</span>
                        <span className="mt-1.5 grid gap-1 text-[12px] text-rk-ink">
                          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full border border-rk-forest bg-[#1F5F8B]" />{tr("Flood water seen there before (satellite)", "আগে বন্যার পানি দেখা গেছে")}</span>
                          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full border border-rk-forest bg-[#B87955]" />{tr("In the modelled 100-year flood zone", "মডেলের ১০০ বছরের বন্যা এলাকায়")}</span>
                          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full border border-rk-forest bg-white" />{tr("No flood record there", "বন্যার রেকর্ড নেই")}</span>
                        </span>
                        {!sel.district && <span className="mt-1 block text-[12px] text-rk-muted">{tr("Choose a district to see them.", "দেখতে একটি জেলা বেছে নিন।")}</span>}
                      </span>
                    </label>
                  )}
                  {missing.map((u) => (
                    <div key={u.label.en} className="rounded-lg border border-dashed border-rk-line px-2.5 py-1.5" aria-disabled="true">
                      <span className="flex items-center justify-between gap-2 text-[13px] font-semibold text-rk-muted">
                        {bn ? u.label.bn : u.label.en}
                        <span className="shrink-0 whitespace-nowrap rounded-full bg-rk-secondary px-2 py-0.5 text-[11px] font-semibold">{tr("Not available", "নেই")}</span>
                      </span>
                      <span className="block text-[12px] text-rk-muted">{bn ? u.why.bn : u.why.en}</span>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </div>

      <div className="lg:hidden rounded-xl border border-rk-line bg-rk-surface p-3">
        {Legend({ compact: true })}
      </div>

      {/* Point Check: other ways to choose a spot */}
      <div className="rounded-xl border border-rk-line bg-rk-surface p-3">
        <h2 className="text-[13px] font-bold text-rk-forest flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-rk-brand" aria-hidden="true" /> {tr("Check a spot", "একটি জায়গা যাচাই")}
        </h2>
        <p className="mt-1 text-[13px] text-rk-muted">{tr("Choose a district, then tap the exact place on the map — or:", "একটি জেলা বেছে নিয়ে মানচিত্রে নির্দিষ্ট জায়গায় চাপ দিন — অথবা:")}</p>
        <button type="button" onClick={useMyLocation} disabled={locating} className="mt-2 h-11 w-full rounded-xl border border-rk-line font-semibold text-rk-forest inline-flex items-center justify-center gap-2 hover:bg-rk-secondary">
          {locating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Crosshair className="w-4 h-4" aria-hidden="true" />}
          {tr("Use my location", "আমার অবস্থান ব্যবহার করুন")}
        </button>
        <details className="mt-2">
          <summary className="cursor-pointer text-[13px] font-semibold text-rk-muted">{tr("Enter coordinates (advanced)", "স্থানাঙ্ক লিখুন (উন্নত)")}</summary>
          <form onSubmit={submitCoords} className="mt-2 flex gap-2">
            <label htmlFor="rk-coords" className="sr-only">{tr("Latitude, longitude", "অক্ষাংশ, দ্রাঘিমাংশ")}</label>
            <input id="rk-coords" value={coordText} onChange={(e) => setCoordText(e.target.value)} placeholder="24.85, 91.14" inputMode="decimal" className="h-11 flex-1 min-w-0 rounded-xl border border-rk-line px-3 font-mono text-[15px]" aria-describedby={coordError ? "rk-coords-err" : undefined} />
            <button type="submit" className="h-11 px-4 rounded-xl bg-rk-brand text-white font-bold">{tr("Check", "যাচাই")}</button>
          </form>
          {coordError && <p id="rk-coords-err" className="mt-1 text-[13px] text-rk-danger" role="alert">{coordError}</p>}
        </details>
      </div>

      {/* Model information (real metadata from GET /predictions/model) */}
      <details className="rounded-xl border border-rk-line bg-rk-surface px-3 py-2.5">
        <summary className="cursor-pointer text-[13px] font-bold text-rk-forest flex items-center gap-1.5">
          <BrainCircuit className="w-4 h-4 text-rk-brand" aria-hidden="true" /> {tr("About the forecast model", "পূর্বাভাস মডেল সম্পর্কে")}
        </summary>
        {!modelInfo ? (
          <p className="mt-2 text-[13px] text-rk-muted">{tr("Model details are not available right now.", "মডেলের বিবরণ এখন পাওয়া যাচ্ছে না।")}</p>
        ) : (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
            <dt className="text-rk-muted">{tr("Model", "মডেল")}</dt>
            <dd className="font-mono text-rk-ink break-all">{modelInfo.model_version || modelInfo.version}</dd>
            {modelInfo.algorithm && (<><dt className="text-rk-muted">{tr("Method", "পদ্ধতি")}</dt><dd className="text-rk-ink">{modelInfo.algorithm}</dd></>)}
            {modelInfo.trained_on && (<><dt className="text-rk-muted">{tr("Trained", "প্রশিক্ষণ")}</dt><dd className="font-mono text-rk-ink">{modelInfo.trained_on}</dd></>)}
            {modelInfo.what_is_predicted && (<><dt className="text-rk-muted">{tr("Predicts", "অনুমান করে")}</dt><dd className="text-rk-ink">{modelInfo.what_is_predicted}</dd></>)}
            {modelInfo.issue_time && (<><dt className="text-rk-muted">{tr("Issued", "তৈরি")}</dt><dd className="text-rk-ink">{modelInfo.issue_time}</dd></>)}
            <dt className="text-rk-muted">{tr("Horizon", "সময়সীমা")}</dt>
            <dd className="text-rk-ink">{tr("One day (the forecast day). No hourly forecasts.", "এক দিন (পূর্বাভাসের দিন)। ঘণ্টাভিত্তিক নয়।")}</dd>
            <dt className="text-rk-muted">{tr("Area", "এলাকা")}</dt>
            <dd className="text-rk-ink">{tr(`One value per district; ${modelInfo.supported_pcodes?.length ?? 56} of 64 districts.`, `প্রতি জেলায় একটি মান; ৬৪টির মধ্যে ${n(modelInfo.supported_pcodes?.length ?? 56)}টি জেলা।`)}</dd>
            {modelInfo.test_results?.model?.at_alert && (
              <>
                <dt className="text-rk-muted">{tr("Tested", "যাচাই")}</dt>
                <dd className="text-rk-ink">
                  {tr(
                    `On 2023–2024 (unseen): of districts on Alert, ${Math.round(modelInfo.test_results.model.at_alert.precision * 100)} % flooded; Watch caught ${Math.round(modelInfo.test_results.model.at_watch.recall * 100)} % of floods.`,
                    `২০২৩–২০২৪ এ (প্রশিক্ষণে না-দেখা বছর): সতর্কতা স্তরের জেলার ${n(Math.round(modelInfo.test_results.model.at_alert.precision * 100))}% এ বন্যা হয়েছে; নজরদারি স্তর ${n(Math.round(modelInfo.test_results.model.at_watch.recall * 100))}% বন্যা ধরেছে।`
                  )}
                </dd>
              </>
            )}
          </dl>
        )}
        {modelInfo?.input_importance && (() => {
          const imp = modelInfo.input_importance as Record<string, number>;
          const groups = [
            { en: "Recent satellite flooding", bn: "সাম্প্রতিক স্যাটেলাইটে দেখা বন্যা", keys: ["last_flooded_share", "max_flooded_share_14d", "days_since_last_observation"] },
            { en: "Rain", bn: "বৃষ্টি", keys: ["rain_1d", "rain_3d", "rain_7d", "rain_14d", "rain_30d"] },
            { en: "River flow and distance", bn: "নদীর প্রবাহ ও দূরত্ব", keys: ["river_log_discharge", "river_change_3d", "river_vs_30d_mean", "river_distance_km"] },
            { en: "Season (month)", bn: "ঋতু (মাস)", keys: ["month"] },
            { en: "Flood hazard zone", bn: "বন্যা-ঝুঁকি এলাকা", keys: ["hazard_share_10yr", "hazard_share_100yr"] },
          ]
            .map((g) => ({ ...g, share: g.keys.reduce((a, k) => a + (imp[k] || 0), 0) }))
            .sort((a, b) => b.share - a.share);
          return (
            <div className="mt-3">
              <h4 className="text-[12px] font-bold text-rk-forest">{tr("What the model relies on most", "মডেল কীসের ওপর বেশি নির্ভর করে")}</h4>
              <ul className="mt-1.5 space-y-1.5">
                {groups.map((g) => (
                  <li key={g.en} className="text-[12px] text-rk-ink">
                    <span className="flex justify-between"><span>{bn ? g.bn : g.en}</span><span className="font-mono">{n(Math.round(g.share * 100))} %</span></span>
                    <span className="mt-0.5 block h-1.5 rounded-full bg-rk-secondary" aria-hidden="true">
                      <span className="block h-full rounded-full bg-rk-brand" style={{ width: `${Math.round(g.share * 100)}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] text-rk-muted">{tr("Share of the model's learning (training gain) by input group, across all districts. It is not the reason for one district's value.", "ইনপুট-গোষ্ঠী অনুযায়ী মডেলের শেখার অংশ (training gain), সব জেলা মিলিয়ে। এটি কোনো এক জেলার মানের কারণ নয়।")}</p>
            </div>
          );
        })()}
        {modelInfo?.limitations && (
          <ul className="mt-2 list-disc pl-4 space-y-1 text-xs text-rk-muted">
            {modelInfo.limitations.map((l: string) => <li key={l}>{l}</li>)}
          </ul>
        )}
      </details>
    </div>
  );

  const placeTitle = current ? placeName(current, bn) : tr("Bangladesh", "বাংলাদেশ");

  return (
    <div className="rk-map-explorer relative grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-4 lg:h-[calc(100vh-96px)] lg:min-h-[620px]">
      {/* MAP */}
      <div className="relative h-[calc(100svh-150px)] min-h-[440px] lg:h-full overflow-hidden rounded-2xl border border-rk-line bg-rk-page">
        {/* MapLibre's CSS makes its container position:relative, so it sits inside a positioned box. */}
        <div className="absolute inset-0">
          <div ref={containerRef} className="h-full w-full" role="region" aria-label={tr("Interactive flood map of Bangladesh", "বাংলাদেশের ইন্টারঅ্যাকটিভ বন্যা মানচিত্র")} />
        </div>
        {!ready && !mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-rk-page/80" role="status">
            <Loader2 className="w-5 h-5 animate-spin text-rk-brand mr-2" aria-hidden="true" /> <span className="text-sm text-rk-muted">{tr("Loading the map of Bangladesh…", "বাংলাদেশের মানচিত্র লোড হচ্ছে…")}</span>
          </div>
        )}
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center" role="alert">
            <p className="max-w-sm text-sm text-rk-ink">{tr("The interactive map could not start on this device", "এই ডিভাইসে মানচিত্র চালু হয়নি")} ({mapError}). {tr("The district list on this page still works.", "এই পাতার জেলার তালিকা তবুও কাজ করে।")}</p>
          </div>
        )}

        {/* Search (Bangladesh places only) */}
        <div className="absolute left-3 right-14 top-3 sm:right-auto sm:w-[340px] z-10">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 w-4 h-4 text-rk-muted" aria-hidden="true" />
            <input
              type="search"
              role="combobox"
              aria-expanded={searchOpen && results.length > 0}
              aria-controls="rk-map-search-list"
              aria-autocomplete="list"
              aria-activedescendant={searchOpen && results[activeResult] ? `rk-res-${resultKey(results[activeResult])}` : undefined}
              aria-label={tr("Search a division, district, upazila or river station", "বিভাগ, জেলা, উপজেলা বা নদী-স্টেশন খুঁজুন")}
              placeholder={tr("Search a place or river station", "জায়গা বা নদী-স্টেশন খুঁজুন")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
                setActiveResult(0);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setActiveResult((i) => Math.min(i + 1, results.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setActiveResult((i) => Math.max(i - 1, 0)); }
                else if (e.key === "Enter" && results[activeResult]) { e.preventDefault(); chooseResult(results[activeResult]); }
                else if (e.key === "Escape") { setQuery(""); setSearchOpen(false); }
              }}
              className="h-12 w-full rounded-xl border border-rk-line bg-rk-surface/95 pl-9 pr-3 text-[16px] text-rk-ink shadow-[var(--rk-shadow-float)] backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-rk-brand"
            />
          </div>
          {searchOpen && query.trim().length >= 2 && (
            <ul id="rk-map-search-list" role="listbox" className="mt-1.5 max-h-[50vh] overflow-auto rounded-xl border border-rk-line bg-rk-surface p-1 shadow-[var(--rk-shadow-float)]">
              {results.length === 0 && <li className="px-3 py-2 text-[14px] text-rk-muted">{tr("No division, district, upazila or river station of Bangladesh by that name.", "এই নামে বাংলাদেশের কোনো বিভাগ, জেলা, উপজেলা বা নদী-স্টেশন নেই।")}</li>}
              {results.map((res, i) => (
                <li key={resultKey(res)} id={`rk-res-${resultKey(res)}`} role="option" aria-selected={i === activeResult}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chooseResult(res)} className={`w-full rounded-lg px-3 py-2 text-left ${i === activeResult ? "bg-rk-brand-soft" : "hover:bg-rk-secondary"}`}>
                    {res.type === "place" ? (
                      <>
                        <span className="block text-[15px] font-semibold text-rk-forest">{placeName(res.p, bn)}</span>
                        <span className="block text-xs text-rk-muted">
                          {bn ? LEVEL_LABEL[res.p.level].bn : LEVEL_LABEL[res.p.level].en}
                          {res.p.district ? ` · ${placeName({ level: 2, pcode: res.p.district_pcode!, name: res.p.district }, bn)}` : ""}
                          {res.p.division && res.p.level > 1 ? ` · ${placeName({ level: 1, pcode: "", name: res.p.division }, bn)}` : ""}
                        </span>
                      </>
                    ) : res.type === "river" ? (
                      <>
                        <span className="block text-[15px] font-semibold text-rk-forest">{bn ? res.r.bn || res.r.en : res.r.en || res.r.bn}</span>
                        <span className="block text-xs text-rk-muted">{tr("River (map context)", "নদী (মানচিত্রের প্রসঙ্গ)")} · ~{n(res.r.km)} {tr("km", "কিমি")}</span>
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-1.5 text-[15px] font-semibold text-rk-forest">
                          <Activity className="w-4 h-4 text-rk-river-text" aria-hidden="true" /> {res.s.name}
                        </span>
                        <span className="block text-xs text-rk-muted">{tr("River-flow station (modelled)", "নদী-প্রবাহ স্টেশন (মডেল)")}{res.s.river ? ` · ${res.s.river}` : ""}</span>
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick actions under the zoom buttons */}
        <div className="absolute right-[10px] top-[124px] z-10 flex flex-col gap-1.5">
          <button type="button" onClick={resetToBangladesh} title={tr("Show all of Bangladesh", "পুরো বাংলাদেশ")} aria-label={tr("Show all of Bangladesh", "পুরো বাংলাদেশ দেখুন")} className="h-[29px] w-[29px] rounded bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.1)] inline-flex items-center justify-center text-rk-forest hover:bg-rk-secondary">
            <Home className="w-4 h-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={useMyLocation} disabled={locating} title={tr("Check my location", "আমার অবস্থান যাচাই")} aria-label={tr("Check my location", "আমার অবস্থান যাচাই")} className="h-[29px] w-[29px] rounded bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.1)] inline-flex items-center justify-center text-rk-forest hover:bg-rk-secondary">
            {locating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Crosshair className="w-4 h-4" aria-hidden="true" />}
          </button>
        </div>

        {/* Desktop legend on the map */}
        <div className="hidden lg:block absolute left-3 bottom-3 z-10 w-[290px] rounded-xl border border-rk-line bg-rk-surface/95 shadow-[var(--rk-shadow-float)] backdrop-blur">
          <button type="button" onClick={() => setLegendOpen((v) => !v)} aria-expanded={legendOpen} className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-semibold text-rk-muted">
            {tr("Legend", "রঙের অর্থ")}
            {legendOpen ? <ChevronDown className="w-4 h-4" aria-hidden="true" /> : <ChevronUp className="w-4 h-4" aria-hidden="true" />}
          </button>
          {legendOpen && <div className="px-3 pb-3 -mt-1">{Legend({})}</div>}
        </div>

        {picking && (
          <div className="absolute left-1/2 top-[68px] z-20 w-[min(92%,520px)] -translate-x-1/2 rounded-2xl border border-rk-brand/40 bg-rk-surface px-4 py-3 shadow-[var(--rk-shadow-float)]" role="region" aria-label={tr("Check a place", "একটি জায়গা যাচাই")}>
            <p className="flex items-center gap-2 text-[15px] font-bold text-rk-forest">
              <MapPin className="w-4 h-4 text-rk-brand" aria-hidden="true" /> {tr("Tap the place you want to check", "যে জায়গাটি যাচাই করতে চান, মানচিত্রে সেখানে চাপুন")}
            </p>
            <p className="mt-0.5 text-[13px] text-rk-muted">{tr("You will see its flood record, modelled flood depth, the district forecast and nearby help. Or search a place above.", "আপনি দেখবেন সেখানকার বন্যার ইতিহাস, মডেলের গভীরতা, জেলার পূর্বাভাস ও কাছের সহায়তা। অথবা ওপরে জায়গা খুঁজুন।")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => (setPicking(false), useMyLocation())} disabled={locating} className="h-10 px-3 rounded-lg bg-rk-brand text-white font-semibold inline-flex items-center gap-1.5 hover:bg-rk-brand-strong">
                {locating ? <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-hidden="true" /> : <Crosshair className="w-4 h-4" aria-hidden="true" />} {tr("Use my location", "আমার অবস্থান ব্যবহার করুন")}
              </button>
              <button type="button" onClick={() => setPicking(false)} className="h-10 px-3 rounded-lg border border-rk-line font-semibold text-rk-forest hover:bg-rk-secondary">{tr("Cancel", "বাতিল")}</button>
            </div>
          </div>
        )}

        {notice && !picking && (
          <div className="absolute left-1/2 top-[68px] z-20 -translate-x-1/2 max-w-[90%] rounded-xl bg-rk-forest px-4 py-2 text-[14px] text-white shadow-lg flex items-center gap-2" role="status">
            <Info className="w-4 h-4 shrink-0" aria-hidden="true" /> {notice}
            <button type="button" onClick={() => setNotice(null)} aria-label={tr("Dismiss", "বন্ধ")} className="ml-1 h-7 w-7 inline-flex items-center justify-center rounded hover:bg-white/10"><X className="w-4 h-4" aria-hidden="true" /></button>
          </div>
        )}

        {/* PANEL — phones: bottom sheet over the map */}
        <div className={`lg:hidden absolute inset-x-0 bottom-0 z-20 rounded-t-2xl border-t border-rk-line bg-rk-page shadow-[0_-8px_24px_rgb(23_61_50/0.12)] transition-[max-height] duration-300 ${sheetOpen ? "max-h-[62%]" : "max-h-[132px]"} flex flex-col`}>
          <button type="button" onClick={() => setSheetOpen((v) => !v)} aria-expanded={sheetOpen} aria-controls="rk-sheet-body" className="w-full px-4 pt-2 pb-2 text-left">
            <span aria-hidden="true" className="mx-auto mb-2 block h-1 w-10 rounded-full bg-rk-line" />
            <span className="flex items-center gap-2">
              <span className="flex-1 min-w-0">
                <span className="block truncate text-[17px] font-extrabold text-rk-forest">{selStation ? stations?.find((x) => x.id === selStation)?.name ?? placeTitle : point && pointResult?.place?.label ? pointResult.place.label : placeTitle}</span>
                <span className="block truncate text-[13px] text-rk-muted">{bn ? layer.label.bn : layer.label.en} · {dateLabel}</span>
              </span>
              {sheetOpen ? <ChevronDown className="w-5 h-5 text-rk-forest" aria-hidden="true" /> : <ChevronUp className="w-5 h-5 text-rk-forest" aria-hidden="true" />}
              <span className="sr-only">{sheetOpen ? tr("Hide details", "বিবরণ লুকান") : tr("Show details", "বিবরণ দেখুন")}</span>
            </span>
          </button>
          <div className="px-4 pb-2">{Breadcrumbs()}</div>
          <div id="rk-sheet-body" className={`overflow-y-auto px-4 pb-6 ${sheetOpen ? "" : "hidden"}`}>
            {!isDesktop && PanelBody()}
          </div>
        </div>
      </div>

      {/* PANEL — desktop side panel */}
      <aside className="hidden lg:flex flex-col min-h-0 rounded-2xl border border-rk-line bg-rk-page" aria-label={tr("Map details", "মানচিত্রের বিবরণ")}>
        <div className="border-b border-rk-line px-4 pt-4 pb-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-rk-brand-strong">{tr("Flood intelligence map", "বন্যা তথ্য মানচিত্র")}</p>
          <h1 className="mt-0.5 text-2xl font-extrabold text-rk-forest">{placeTitle}</h1>
          <div className="mt-1.5">{Breadcrumbs()}</div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {isDesktop && PanelBody()}
        </div>
        <p className="border-t border-rk-line px-4 py-2 text-[11px] text-rk-muted">{GEO_ATTRIBUTION} · © OpenStreetMap contributors</p>
      </aside>
    </div>
  );

  function Breadcrumbs() {
    // At country level the title already says "Bangladesh"; a one-item trail would only repeat it.
    if (crumbs.length <= 1 && !point && !selStation && !selRiver) {
      return (
        <p className="text-[13px] text-rk-muted">
          {tr("Choose a division or district, search a place, or tap the map for a Point Check.", "একটি বিভাগ বা জেলা বেছে নিন, স্থান খুঁজুন, অথবা কোনো জায়গা যাচাই করতে মানচিত্রে চাপুন।")}
        </p>
      );
    }
    return (
      <nav aria-label={tr("Where you are on the map", "মানচিত্রে আপনি কোথায়")} className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[13px]">
        {(sel.division || point || selStation || selRiver) && (
          <button type="button" onClick={goBack} className="mr-1 h-8 px-2 rounded-lg border border-rk-line bg-rk-surface inline-flex items-center gap-1 font-semibold text-rk-forest hover:bg-rk-secondary">
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> {tr("Back", "পেছনে")}
          </button>
        )}
        <ol className="flex flex-wrap items-center gap-x-1">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1 && !point && !selStation && !selRiver;
            return (
              <li key={c.pcode} className="inline-flex items-center gap-1">
                {i > 0 && <span aria-hidden="true" className="text-rk-muted">/</span>}
                {last ? (
                  <span aria-current="location" className="font-bold text-rk-forest">{placeName(c, bn)}</span>
                ) : (
                  <button type="button" onClick={() => (c.level === 0 ? resetToBangladesh() : selectPlace(c))} className="font-semibold text-rk-brand-strong underline underline-offset-2 decoration-rk-brand/30 hover:decoration-rk-brand">
                    {placeName(c, bn)}
                  </button>
                )}
              </li>
            );
          })}
          {point && (
            <li className="inline-flex items-center gap-1">
              <span aria-hidden="true" className="text-rk-muted">/</span>
              <span aria-current="location" className="font-bold text-rk-forest">{tr("Point", "বিন্দু")}</span>
            </li>
          )}
          {selRiver && !selStation && (
            <li className="inline-flex items-center gap-1">
              <span aria-hidden="true" className="text-rk-muted">/</span>
              <span aria-current="location" className="font-bold text-rk-forest">{tr("River", "নদী")}</span>
            </li>
          )}
          {selStation && (
            <li className="inline-flex items-center gap-1">
              <span aria-hidden="true" className="text-rk-muted">/</span>
              <span aria-current="location" className="font-bold text-rk-forest">{tr("River station", "নদী-স্টেশন")}</span>
            </li>
          )}
        </ol>
      </nav>
    );
  }
};

export default FloodMapExplorer;
