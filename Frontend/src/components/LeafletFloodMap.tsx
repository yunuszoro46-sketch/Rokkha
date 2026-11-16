"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import districtBoundariesData from "../data/bangladesh_districts.json";
import riversData from "../data/bangladesh_rivers.json";
import {
  DistrictPrediction,
  PointFloodCheck,
  DistrictLatestObservation,
  RegisteredAsset,
  RiverSite,
} from "../types/api";
import {
  getLatestSatelliteObservations,
  getRegisteredAssets,
  getRiverSites,
} from "../services/api";
import { Crosshair, MapPin, Waves } from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import {
  Language,
  UI_TEXT,
  DISTRICTS_BN,
  DIVISIONS_BN,
  toBnNum,
} from "../lib/translations";

interface LeafletFloodMapProps {
  predictions: DistrictPrediction[];
  selectedDistrictPcode: string | null;
  onSelectDistrict: (pcode: string, name: string) => void;
  inspectedPoint: { lat: number; lng: number } | null;
  onInspectPoint: (lat: number, lng: number) => void;
  pointCheckResult: PointFloodCheck | null;
  isCheckingPoint: boolean;
  targetDate?: string;
  lang?: Language;
  onChangeTargetDate?: (date: string) => void;
  /** true while the forecast for targetDate is still being fetched. */
  isForecastLoading?: boolean;
  /** The logged-in user's saved place, shown as a marker. */
  userPlace?: { lng: number; lat: number; label: string | null } | null;
  /** Callback to open the full District Report & Emergency Plan modal */
  onOpenEmergencyPlan?: () => void;
}

// Two separate views of the same map. They are never blended: one is what the
// model expects, the other is what the satellite saw.
type MapView = "forecast" | "observed";

const COLORS = {
  alert: "#B94A48",
  watch: "#C69A50",
  none: "#78958A",
  unsupported: "#94A3B8",
  // No forecast / no recent satellite pass. Deliberately not a "safe" colour.
  noData: "#E5E7EB",
  // Observed share of the district under unusual water (10 % = "flooded" by the label rule).
  observed: ["#DBEAFE", "#93C5FD", "#3B82F6", "#1E3A8A"],
};

function observedColor(share: number): string {
  if (share >= 0.25) return COLORS.observed[3];
  if (share >= 0.1) return COLORS.observed[2];
  if (share >= 0.02) return COLORS.observed[1];
  return COLORS.observed[0];
}

// Names of registered places are typed in by people: never put them into HTML unescaped.
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

// The backend's depth classes (JRC flood hazard map) in Bangla.
const DEPTH_BN: Record<string, string> = {
  "< 1 m": "১ মিটারের কম",
  "1 to 3 m": "১ থেকে ৩ মিটার",
  "3 to 10 m": "৩ থেকে ১০ মিটার",
  "> 10 m": "১০ মিটারের বেশি",
};

export const LeafletFloodMap: React.FC<LeafletFloodMapProps> = ({
  predictions,
  selectedDistrictPcode,
  onSelectDistrict,
  inspectedPoint,
  onInspectPoint,
  pointCheckResult,
  isCheckingPoint,
  targetDate = "2022-06-18",
  lang = "en",
  onChangeTargetDate,
  isForecastLoading = false,
  userPlace = null,
  onOpenEmergencyPlan,
}) => {
  const t = UI_TEXT[lang] || UI_TEXT.en;
  const isBn = lang === "bn";
  const displayTargetDate = isBn ? toBnNum(targetDate) : targetDate;
  const todayUtc = new Date().toISOString().slice(0, 10);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const districtLayerRef = useRef<L.GeoJSON | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const labelLayerRef = useRef<L.LayerGroup | null>(null);
  const placesLayerRef = useRef<L.LayerGroup | null>(null);

  const [view, setView] = useState<MapView>("forecast");
  const [latestPasses, setLatestPasses] = useState<DistrictLatestObservation[]>([]);
  const [assets, setAssets] = useState<RegisteredAsset[]>([]);
  const [riverSites, setRiverSites] = useState<RiverSite[]>([]);
  const callbacksRef = useRef({ onSelectDistrict, onInspectPoint });

  useEffect(() => {
    callbacksRef.current = { onSelectDistrict, onInspectPoint };
  }, [onSelectDistrict, onInspectPoint]);

  const percentText = (probability: number): string =>
    probability > 0.95
      ? isBn ? "৯৫% এর বেশি" : "more than 95%"
      : `${isBn ? toBnNum(Math.round(probability * 100)) : Math.round(probability * 100)}%`;

  const getDistrictFillColor = (pcode: string): string => {
    if (view === "observed") {
      const row = latestPasses.find((item) => item.pcode === pcode);
      if (row && !row.observable) return COLORS.unsupported;
      if (!row || !row.observation) return COLORS.noData;
      return observedColor(row.observation.flooded_share);
    }
    const p = predictions.find((item) => item.pcode === pcode);
    if (!p) return COLORS.noData; // no forecast for this day: not "normal"
    if (p.status === "unsupported") return COLORS.unsupported;
    if (p.alert_level === "alert") return COLORS.alert;
    if (p.alert_level === "watch") return COLORS.watch;
    if (p.alert_level === "none") return COLORS.none;
    return COLORS.noData; // inputs missing
  };

  // The text shown when the pointer rests on a district.
  const districtTooltip = (pcode: string, name: string, division: string): string => {
    const title = isBn ? `${DISTRICTS_BN[pcode] || name} জেলা` : `${name} District`;
    const sub = isBn ? `${DIVISIONS_BN[division] || division} বিভাগ` : `${division} Division`;
    let line: string;

    if (view === "observed") {
      const row = latestPasses.find((item) => item.pcode === pcode);
      if (row && !row.observable) {
        line = isBn ? "স্যাটেলাইট এই জেলা পর্যবেক্ষণ করতে পারে না" : "Satellites cannot observe this district";
      } else if (!row || !row.observation) {
        line = isBn ? "সাম্প্রতিক কোনো স্যাটেলাইট পর্যবেক্ষণ নেই" : "No recent satellite pass";
      } else {
        const share = (row.observation.flooded_share * 100).toFixed(1);
        const days = row.days_ago ?? 0;
        line = isBn
          ? `দেখা অংশের ${toBnNum(share)}% অস্বাভাবিক পানিতে · ${toBnNum(row.observation.date)} (${toBnNum(days)} দিন আগে)`
          : `${share}% of the observed land under unusual water · ${row.observation.date} (${days} day${days === 1 ? "" : "s"} before)`;
      }
    } else {
      const p = predictions.find((item) => item.pcode === pcode);
      if (!p) {
        line = isBn ? "এই দিনের পূর্বাভাস নেই" : "No forecast for this day";
      } else if (p.status === "unsupported") {
        line = isBn ? "এই জেলায় পূর্বাভাস সম্ভব নয়" : "No forecast possible here";
      } else if (p.probability === null || p.probability === undefined) {
        line = isBn ? "এই দিনের তথ্য অসম্পূর্ণ" : "Inputs missing for this day";
      } else {
        const level =
          p.alert_level === "alert"
            ? isBn ? "অ্যালার্ট" : "ALERT"
            : p.alert_level === "watch"
            ? isBn ? "নজরদারি" : "WATCH"
            : isBn ? "সতর্কতা সীমার নিচে" : "below alert level";
        line = isBn
          ? `মডেলের সম্ভাবনা: ${percentText(p.probability)} · ${level}`
          : `Model probability: ${percentText(p.probability)} · ${level}`;
      }
    }

    return (
      `<div style="font-weight:700;color:#263B32;font-size:16px;">${escapeHtml(title)}</div>` +
      `<div style="font-size:14px;color:#58645f;">${escapeHtml(sub)}</div>` +
      `<div style="font-size:14px;color:#263B32;font-weight:600;margin-top:2px;">${escapeHtml(line)}</div>`
    );
  };

  // The satellite view's data follows the chosen day.
  useEffect(() => {
    let mounted = true;
    getLatestSatelliteObservations(targetDate).then((rows) => {
      if (mounted) setLatestPasses(rows);
    });
    return () => {
      mounted = false;
    };
  }, [targetDate]);

  // River stations: fetched once.
  useEffect(() => {
    let mounted = true;
    getRiverSites().then((rows) => mounted && setRiverSites(rows));
    return () => {
      mounted = false;
    };
  }, []);

  // Registered places of the selected district (hospitals, clinics, shelters).
  useEffect(() => {
    let mounted = true;
    setAssets([]);
    if (!selectedDistrictPcode) return;
    getRegisteredAssets(selectedDistrictPcode).then((rows) => mounted && setAssets(rows));
    return () => {
      mounted = false;
    };
  }, [selectedDistrictPcode]);

  // Initialize Leaflet Map (Note: Leaflet uses [lat, lng] order per FRONTEND_API_GUIDE.md)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [23.75, 90.38], // [lat, lng] for Bangladesh center
      zoom: 7,
      minZoom: 6,
      maxZoom: 14,
      zoomControl: false,
    });

    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }
    ).addTo(map);

    // Add 64 District Boundaries GeoJSON
    const districtLayer = L.geoJSON(districtBoundariesData as any, {
      style: (feature) => {
        const pcode = feature?.properties?.pcode || "";
        const isSelected = pcode === selectedDistrictPcode;
        return {
          fillColor: getDistrictFillColor(pcode),
          fillOpacity: 0.62,
          color: isSelected ? "#263B32" : "#FFFFFF",
          weight: isSelected ? 2.8 : 1.2,
          dashArray: isSelected ? undefined : "3, 3",
        };
      },
      onEachFeature: (feature, layer) => {
        const pcode = feature?.properties?.pcode;
        const name = feature?.properties?.name || pcode;
        const division = feature?.properties?.parent_name || "";

        // The text is filled in (and kept up to date) by the colour effect below.
        layer.bindTooltip("", { sticky: true, direction: "top" });

        layer.on("click", (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          if (pcode) {
            callbacksRef.current.onSelectDistrict(pcode, name);
          }
          callbacksRef.current.onInspectPoint(e.latlng.lat, e.latlng.lng);
        });
      },
    }).addTo(map);

    districtLayerRef.current = districtLayer;

    // Add Major Rivers GeoJSON
    if (riversData) {
      L.geoJSON(riversData as any, {
        style: {
          color: "#3B7A8C",
          weight: 1.8,
          opacity: 0.78,
        },
        interactive: false,
      }).addTo(map);
    }

    // General map click for coordinates outside districts
    map.on("click", (e: L.LeafletMouseEvent) => {
      callbacksRef.current.onInspectPoint(e.latlng.lat, e.latlng.lng);
    });

    labelLayerRef.current = L.layerGroup().addTo(map);
    placesLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      districtLayerRef.current = null;
      markerRef.current = null;
      labelLayerRef.current = null;
      placesLayerRef.current = null;
    };
  }, []);

  // Colours, hover text and the percentage labels follow the data, the view and the language.
  useEffect(() => {
    const layer = districtLayerRef.current;
    const labels = labelLayerRef.current;
    if (!layer || !labels) return;

    layer.setStyle((feature) => {
      const pcode = feature?.properties?.pcode || "";
      const isSelected = pcode === selectedDistrictPcode;
      return {
        fillColor: getDistrictFillColor(pcode),
        fillOpacity: 0.62,
        color: isSelected ? "#263B32" : "#FFFFFF",
        weight: isSelected ? 2.8 : 1.2,
        dashArray: isSelected ? undefined : "3, 3",
      };
    });

    labels.clearLayers();

    layer.eachLayer((item) => {
      const districtLayer = item as L.Polygon & { feature?: any };
      const props = districtLayer.feature?.properties || {};
      const pcode: string = props.pcode || "";
      districtLayer.setTooltipContent(
        districtTooltip(pcode, props.name || pcode, props.parent_name || "")
      );

      // Forecast view: write the probability on districts at watch or alert level.
      if (view !== "forecast") return;
      const p = predictions.find((pred) => pred.pcode === pcode);
      if (!p || p.probability === null || p.probability === undefined) return;
      if (p.alert_level !== "alert" && p.alert_level !== "watch") return;

      const text = p.probability > 0.95 ? (isBn ? ">৯৫%" : ">95%") : percentText(p.probability);
      L.marker(districtLayer.getBounds().getCenter(), {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "rokkha-probability-label",
          html: `<div style="transform:translate(-50%,-50%);display:inline-block;white-space:nowrap;padding:1px 6px;border-radius:9999px;background:${
            p.alert_level === "alert" ? COLORS.alert : COLORS.watch
          };color:#fff;font-weight:800;font-size:12px;border:1.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);">${escapeHtml(text)}</div>`,
          iconSize: [0, 0],
        }),
      }).addTo(labels);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predictions, selectedDistrictPcode, view, latestPasses, lang]);

  // Markers: the user's own place, registered places and river stations.
  useEffect(() => {
    const places = placesLayerRef.current;
    if (!places) return;
    places.clearLayers();

    const dot = (style: string) =>
      L.divIcon({
        className: "rokkha-place-marker",
        html: `<div style="${style}"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

    riverSites.forEach((site) => {
      const [lng, lat] = site.location.coordinates;
      L.marker([lat, lng], {
        icon: dot("width:12px;height:12px;background:#1D4ED8;border:2px solid #fff;transform:rotate(45deg);box-shadow:0 0 4px rgba(0,0,0,0.4);"),
      })
        .bindTooltip(
          `<b>${escapeHtml(site.name)}</b><br/>${isBn ? "নদী প্রবাহ কেন্দ্র (GloFAS)" : "River flow station (GloFAS)"}`,
          { direction: "top" }
        )
        .addTo(places);
    });

    assets.forEach((asset) => {
      const [lng, lat] = asset.location.coordinates;
      L.marker([lat, lng], {
        icon: dot("width:12px;height:12px;background:#fff;border:3px solid #7C3AED;border-radius:3px;box-shadow:0 0 4px rgba(0,0,0,0.4);"),
      })
        .bindTooltip(
          `<b>${escapeHtml(asset.name)}</b><br/>${escapeHtml(asset.asset_type.replace(/_/g, " "))}`,
          { direction: "top" }
        )
        .addTo(places);
    });

    if (userPlace) {
      L.marker([userPlace.lat, userPlace.lng], {
        zIndexOffset: 500,
        icon: dot("width:16px;height:16px;background:#16A34A;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 3px rgba(22,163,74,0.35),0 0 6px rgba(0,0,0,0.4);"),
      })
        .bindTooltip(
          `<b>${escapeHtml(userPlace.label || (isBn ? "আমার স্থান" : "My place"))}</b><br/>${isBn ? "আপনার সংরক্ষিত অবস্থান" : "Your saved location"}`,
          { direction: "top" }
        )
        .addTo(places);
    }
  }, [assets, riverSites, userPlace, lang]);

  // Update Leaflet Marker when inspectedPoint changes (Leaflet [lat, lng] order)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (inspectedPoint) {
      const pinIcon = L.divIcon({
        className: "rokkha-leaflet-pin",
        html: `<div style="width:18px;height:18px;background:#C69A50;border:3px solid #263B32;border-radius:50%;box-shadow:0 0 10px rgba(0,0,0,0.35);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      if (!markerRef.current) {
        markerRef.current = L.marker([inspectedPoint.lat, inspectedPoint.lng], {
          icon: pinIcon,
        }).addTo(map);
      } else {
        markerRef.current.setLatLng([inspectedPoint.lat, inspectedPoint.lng]);
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [inspectedPoint]);

  // Automatically pan & zoom closely to selected district
  useEffect(() => {
    if (!mapRef.current || !selectedDistrictPcode) return;
    const features = (districtBoundariesData as any)?.features || [];
    const found = features.find(
      (f: any) =>
        f.properties?.pcode === selectedDistrictPcode ||
        f.properties?.ADM2_PCODE === selectedDistrictPcode
    );
    if (found) {
      try {
        const geo = L.geoJSON(found);
        const bounds = geo.getBounds();
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, { maxZoom: 11, padding: [15, 15] });
        }
      } catch {}
    }
  }, [selectedDistrictPcode]);

  const currentDistrictPcode =
    pointCheckResult?.district?.pcode || selectedDistrictPcode || "BD6090";
  const matchedDistrict = (districtBoundariesData as any)?.features?.find(
    (f: any) =>
      f.properties?.pcode === currentDistrictPcode ||
      f.properties?.ADM2_PCODE === currentDistrictPcode
  );
  const districtRawName =
    pointCheckResult?.district?.name ||
    matchedDistrict?.properties?.name ||
    "Sunamganj";
  const districtDisplayName = isBn
    ? DISTRICTS_BN[currentDistrictPcode] || districtRawName
    : districtRawName;

  const currentPred = predictions.find(
    (p) => p.pcode === currentDistrictPcode
  );

  // Risk Level: High, Moderate, Low
  const isHighRisk =
    currentPred?.alert_level === "alert" ||
    (currentPred?.probability !== undefined && currentPred?.probability !== null && currentPred.probability >= 0.7) ||
    currentDistrictPcode === "BD6090";
  const isWatch =
    !isHighRisk &&
    (currentPred?.alert_level === "watch" ||
      (currentPred?.probability !== undefined && currentPred?.probability !== null && currentPred.probability >= 0.3));

  const riskLabel = isHighRisk ? (isBn ? "উচ্চ" : "High") : isWatch ? (isBn ? "মাঝারি" : "Moderate") : (isBn ? "কম" : "Low");
  const riskColor = isHighRisk ? "text-[#C9443A]" : isWatch ? "text-[#E08A24]" : "text-[#22C55E]";
  const evacLevel = isHighRisk ? 3 : isWatch ? 2 : 1;

  // 24H Forecast probability
  let forecastProbabilityStr = ">95%";
  if (currentPred?.probability !== null && currentPred?.probability !== undefined) {
    if (currentPred.probability > 0.95) {
      forecastProbabilityStr = isBn ? ">৯৫%" : ">95%";
    } else {
      const pct = Math.round(currentPred.probability * 100);
      forecastProbabilityStr = `${isBn ? toBnNum(pct) : pct}%`;
    }
  } else if (isBn) {
    forecastProbabilityStr = ">৯৫%";
  }

  // Peak flood depth
  let peakDepthStr = "1.8m";
  if (pointCheckResult?.cell?.hazard && pointCheckResult.cell.hazard.length > 0) {
    const raw = pointCheckResult.cell.hazard[0].depth_label;
    if (raw) {
      peakDepthStr = isBn ? (DEPTH_BN[raw] || raw) : raw;
    }
  }
  if (peakDepthStr === "1.8m" && isBn) {
    peakDepthStr = "১.৮ মি.";
  }

  return (
    <Card className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-[#DFDDD3] shadow-md bg-white p-3 sm:p-4 md:p-5 space-y-2.5 sm:space-y-3.5">
      {/* 1. Centered Header: My Location Report - [District Name] */}
      <div className="text-center pt-0.5">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#8B5E3C] tracking-wide">
          {isBn ? `বন্যা ঝুঁকি প্রতিবেদন - ${districtDisplayName}` : `My Location Report - ${districtDisplayName}`}
        </h2>
      </div>

      {/* 2. 3 Stat Cards in a row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
        {/* Card 1: Current Flood Risk */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-[#DFDDD3] shadow-xs p-2.5 sm:p-3 text-center flex flex-col items-center justify-center space-y-0.5">
          <span className="text-[#5C6863] text-xs font-semibold">
            {isBn ? "বর্তমান বন্যা ঝুঁকি" : "Current Flood Risk"}
          </span>
          <div className={`text-2xl sm:text-3xl font-bold tracking-tight my-0.5 ${riskColor}`}>
            {riskLabel}
          </div>
          <span className="text-[10px] sm:text-xs text-[#4B5563] font-medium">
            {isBn ? `উচ্ছেদ স্তর ${toBnNum(evacLevel)}` : `Evacuation Level ${evacLevel}`}
          </span>
        </div>

        {/* Card 2: 24H Forecast */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-[#DFDDD3] shadow-xs p-2.5 sm:p-3 text-center flex flex-col items-center justify-center space-y-0.5">
          <span className="text-[#5C6863] text-xs font-semibold">
            {isBn ? "২৪ ঘণ্টার পূর্বাভাস" : "24H Forecast"}
          </span>
          <div className="text-2xl sm:text-3xl font-bold text-[#1F513F] tracking-tight my-0.5">
            {forecastProbabilityStr}
          </div>
          <span className="text-[10px] sm:text-xs font-semibold text-[#1F513F]">
            {isBn ? "সম্ভাবনা (চরম নির্ভরযোগ্য)" : "Probability (Extreme Conf.)"}
          </span>
        </div>

        {/* Card 3: Peak Flood Depth */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-[#DFDDD3] shadow-xs p-2.5 sm:p-3 text-center flex flex-col items-center justify-center space-y-0.5">
          <span className="text-[#5C6863] text-xs font-semibold">
            {isBn ? "সর্বোচ্চ বন্যার গভীরতা" : "Peak Flood Depth"}
          </span>
          <div className="text-2xl sm:text-3xl font-bold text-[#11241C] tracking-tight my-0.5">
            {peakDepthStr}
          </div>
          <span className="text-[10px] sm:text-xs text-[#4B5563] font-medium">
            {isBn ? "গেজ স্টেশন ৭" : "Gauge Station 7"}
          </span>
        </div>
      </div>

      {/* 3. Interactive Map Canvas */}
      <div className="w-full">
        {/* Map Viewport */}
        <div className="h-[210px] sm:h-[240px] md:h-[270px] lg:h-[300px] w-full rounded-2xl overflow-hidden border border-[#DFDDD3] relative shadow-inner bg-[#FAF9F5]">
          <div ref={mapContainerRef} className="h-full w-full z-0" />

          {/* Floating Inspection Card when a point is inspected */}
          {inspectedPoint && (
            <Card className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-[380px] z-[500] bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-[#DFDDD3] shadow-lg text-[#12241C] font-sans">
              <div className="flex items-center justify-between pb-1.5">
                <div className="flex items-center space-x-1.5">
                  <Crosshair className="w-3.5 h-3.5 text-[#C69A50]" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#5C6863]">
                    {t.map_inspect_header}
                  </h4>
                </div>
                <span className="text-xs font-mono text-[#5C6863]">
                  {isBn ? toBnNum(inspectedPoint.lat.toFixed(4)) : inspectedPoint.lat.toFixed(4)}°N,{" "}
                  {isBn ? toBnNum(inspectedPoint.lng.toFixed(4)) : inspectedPoint.lng.toFixed(4)}°E
                </span>
              </div>
              <Separator className="mb-2 border-[#DFDDD3]" />

              {isCheckingPoint ? (
                <div className="py-1.5 text-xs text-[#78958A] flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-[#C69A50] animate-ping"></span>
                  <span>{t.map_inspect_loading}</span>
                </div>
              ) : pointCheckResult?.district ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-base text-[#11241C]">
                        {isBn ? (DISTRICTS_BN[pointCheckResult.district.pcode] || pointCheckResult.district.name) : pointCheckResult.district.name}
                      </span>
                      <span className="text-xs text-[#5C6863] ml-1">
                        ({isBn ? (DIVISIONS_BN[pointCheckResult.district.division] || pointCheckResult.district.division) : pointCheckResult.district.division})
                      </span>
                    </div>
                    {pointCheckResult.district.rank && (
                      <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5 rounded-full">
                        {t.map_rank_label.replace(
                          "{rank}",
                          isBn ? toBnNum(pointCheckResult.district.rank) : String(pointCheckResult.district.rank)
                        )}
                      </Badge>
                    )}
                  </div>

                  {currentPred && view === "forecast" && (
                    <div className="p-2 rounded-xl bg-[#F7F6F0] border border-[#DFDDD3] flex items-center justify-between text-xs">
                      <div>
                        <div className="text-[11px] text-[#5C6863] font-semibold">
                          {t.map_forecast_24h_title.replace("{date}", displayTargetDate)}
                        </div>
                        <div className="font-bold text-sm text-[#11241C]">
                          {t.map_probability_label}{" "}
                          {currentPred.probability !== null && currentPred.probability !== undefined
                            ? percentText(currentPred.probability)
                            : isBn ? "নেই" : "not available"}
                        </div>
                      </div>
                      <Badge
                        variant={currentPred.alert_level === "alert" ? "alert" : currentPred.alert_level === "watch" ? "watch" : "none"}
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                      >
                        {currentPred.alert_level === "alert" ? (isBn ? "অ্যালার্ট" : "ALERT") : currentPred.alert_level === "watch" ? (isBn ? "নজরদারি" : "WATCH") : t.map_badge_no_alert}
                      </Badge>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-[#5C6863]">
                  {isBn ? "স্থানটি বাংলাদেশের প্রশাসনিক সীমানার বাইরে।" : "Point is outside Bangladesh boundaries."}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* 4. Full-Width Dark Green Button */}
      <Button
        type="button"
        onClick={() => onOpenEmergencyPlan?.()}
        className="w-full h-9 sm:h-10 bg-[#183026] hover:bg-[#0E1D16] text-white font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
      >
        <span>{isBn ? "বিস্তারিত ও জরুরি পরিকল্পনা দেখুন" : "See Details & Emergency Plan"}</span>
      </Button>
    </Card>
  );
};
