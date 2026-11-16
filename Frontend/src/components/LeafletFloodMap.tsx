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
import { Crosshair, FileText, MapPin, Waves } from "lucide-react";
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

  const currentPred = predictions.find(
    (p) =>
      p.pcode ===
      (pointCheckResult?.district?.pcode || selectedDistrictPcode)
  );

  return (
    <Card className="relative w-full rounded-2xl overflow-hidden border-brand-limestone shadow-card bg-brand-white">
      {/* Map Control Bar using shadcn/ui Button, Input, Badge */}
      <div className="p-4 bg-white border-b border-[#DFDDD3] flex flex-wrap items-center justify-between gap-3 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-[#11241C]" />
            <h2 className="font-bold text-[18px] text-[#11241C]">
              {t.map_card_title}
            </h2>
          </div>
          <span className="text-[13px] text-[#5C6863]">
            {t.map_card_hint}
          </span>
        </div>

        {/* Target Date Presets from Section 3.F */}
        {onChangeTargetDate && (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-semibold text-[#5C6863]">
              {t.map_forecast_date_label}
            </span>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => onChangeTargetDate(e.target.value)}
              className="h-9 w-40 font-mono text-[13px] bg-[#FAF9F5] border-[#DFDDD3] rounded-lg"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant={targetDate === "2022-06-18" ? "default" : "secondary"}
                onClick={() => onChangeTargetDate("2022-06-18")}
                className="text-[13px] font-semibold h-8.5 rounded-lg px-2.5"
              >
                {t.scenario_sylhet}
              </Button>
              <Button
                size="sm"
                variant={targetDate === "2024-08-22" ? "default" : "secondary"}
                onClick={() => onChangeTargetDate("2024-08-22")}
                className="text-[13px] font-semibold h-8.5 rounded-lg px-2.5"
              >
                {t.scenario_feni}
              </Button>
              <Button
                size="sm"
                variant={targetDate === "2023-04-10" ? "default" : "secondary"}
                onClick={() => onChangeTargetDate("2023-04-10")}
                className="text-[13px] font-semibold h-8.5 rounded-lg px-2.5"
              >
                {t.scenario_dry}
              </Button>
              <Button
                size="sm"
                variant={targetDate === todayUtc ? "default" : "secondary"}
                onClick={() => onChangeTargetDate(todayUtc)}
                className="text-[13px] font-semibold h-8.5 rounded-lg px-2.5"
              >
                {isBn ? "আজ" : "Today"}
              </Button>
            </div>
          </div>
        )}

        {/* Two views, never blended: the model's forecast, or what the satellite saw */}
        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <span className="font-semibold text-[#5C6863] mr-1">
            {isBn ? "মানচিত্রে দেখান:" : "Show on map:"}
          </span>
          <Button
            size="sm"
            variant={view === "forecast" ? "default" : "secondary"}
            onClick={() => setView("forecast")}
            className="text-[13px] font-semibold h-8.5 rounded-lg px-3"
          >
            {isBn ? "মডেলের পূর্বাভাস" : "Model forecast"}
          </Button>
          <Button
            size="sm"
            variant={view === "observed" ? "default" : "secondary"}
            onClick={() => setView("observed")}
            className="text-[13px] font-semibold h-8.5 rounded-lg px-3"
          >
            {isBn ? "স্যাটেলাইটে দেখা বন্যা" : "Observed by satellite"}
          </Button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 text-[13px] w-full">
          <span className="font-semibold text-[#5C6863] mr-1">{t.map_legend_label}</span>
          {view === "forecast" ? (
            <>
              <Badge variant="alert" className="gap-1.5 text-[13px] font-bold px-2.5 py-0.5 rounded-full">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D9381E]"></span> {t.map_legend_alert}
              </Badge>
              <Badge variant="watch" className="gap-1.5 text-[13px] font-bold px-2.5 py-0.5 rounded-full">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E88C30]"></span> {t.map_legend_watch}
              </Badge>
              <Badge variant="none" className="gap-1.5 text-[13px] font-bold px-2.5 py-0.5 rounded-full">
                <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]"></span> {t.map_legend_normal}
              </Badge>
              <Badge variant="unsupported" className="gap-1.5 text-[13px] font-bold px-2.5 py-0.5 rounded-full">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>{" "}
                {t.map_legend_unsupported}
              </Badge>
              <Badge variant="unsupported" className="gap-1.5 text-[13px] font-bold px-2.5 py-0.5 rounded-full">
                <span className="w-2.5 h-2.5 rounded-full border border-gray-400" style={{ background: COLORS.noData }}></span>{" "}
                {isBn ? "পূর্বাভাস নেই" : "No forecast"}
              </Badge>
            </>
          ) : (
            <>
              {[
                { color: COLORS.observed[0], en: "under 2%", bn: "২% এর কম" },
                { color: COLORS.observed[1], en: "2–10%", bn: "২–১০%" },
                { color: COLORS.observed[2], en: "10–25% (flooded)", bn: "১০–২৫% (প্লাবিত)" },
                { color: COLORS.observed[3], en: "over 25%", bn: "২৫% এর বেশি" },
              ].map((step) => (
                <Badge key={step.en} variant="unsupported" className="gap-1.5 text-[13px] font-semibold px-2.5 py-0.5 rounded-full">
                  <span className="w-2.5 h-2.5 rounded-full border border-gray-400" style={{ background: step.color }}></span>{" "}
                  {isBn ? step.bn : step.en}
                </Badge>
              ))}
              <Badge variant="unsupported" className="gap-1.5 text-[13px] font-semibold px-2.5 py-0.5 rounded-full">
                <span className="w-2.5 h-2.5 rounded-full border border-gray-400" style={{ background: COLORS.noData }}></span>{" "}
                {isBn ? "সাম্প্রতিক পর্যবেক্ষণ নেই" : "No recent pass"}
              </Badge>
              <Badge variant="unsupported" className="gap-1.5 text-[13px] font-semibold px-2.5 py-0.5 rounded-full">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>{" "}
                {t.map_legend_unsupported}
              </Badge>
            </>
          )}
          <span className="flex items-center gap-1.5 text-[13px] text-[#5C6863] ml-1">
            <span className="inline-block w-2.5 h-2.5 rotate-45 border border-white" style={{ background: "#1D4ED8" }}></span>
            {isBn ? "নদী কেন্দ্র" : "River station"}
          </span>
          <span className="flex items-center gap-1.5 text-[13px] text-[#5C6863]">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-white" style={{ border: "2px solid #7C3AED" }}></span>
            {isBn ? "নির্বাচিত জেলার হাসপাতাল, ক্লিনিক, আশ্রয়কেন্দ্র" : "Hospitals, clinics, shelters of the selected district"}
          </span>
          {userPlace && (
            <span className="flex items-center gap-1.5 text-[13px] text-[#5C6863]">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "#16A34A" }}></span>
              {isBn ? "আমার স্থান" : "My place"}
            </span>
          )}
        </div>
        <p className="w-full text-[13px] text-[#5C6863] leading-relaxed">
          {view === "forecast"
            ? isForecastLoading
              ? isBn ? "পূর্বাভাস আনা হচ্ছে..." : "Loading the forecast..."
              : predictions.length === 0
              ? isBn
                ? `${displayTargetDate} তারিখের কোনো পূর্বাভাস নেই, তাই জেলাগুলো ধূসর। এর মানে ঝুঁকি নেই, তা নয়।`
                : `No forecast for ${displayTargetDate}, so the districts are grey. This does not mean there is no risk.`
              : isBn
              ? `রং: ${displayTargetDate} তারিখের জন্য মডেলের জেলা-ভিত্তিক অনুমান। এটি সরকারি সতর্কতা নয়।`
              : `Colours: the model's district estimate for ${displayTargetDate}. Not an official warning.`
            : isBn
            ? `রং: ${displayTargetDate} বা তার আগের ৩০ দিনের মধ্যে সর্বশেষ স্যাটেলাইট পর্যবেক্ষণে জেলার কত অংশ অস্বাভাবিক পানিতে ছিল। এটি পর্যবেক্ষণ, পূর্বাভাস নয়।`
            : `Colours: share of each district under unusual water in its latest satellite pass on or before ${displayTargetDate} (at most 30 days earlier). An observation, not a forecast.`}
        </p>
      </div>

      {/* Leaflet Map Canvas */}
      <div className="h-[360px] sm:h-[420px] md:h-[480px] lg:h-[540px] xl:h-[600px] w-full relative">
        <div ref={mapContainerRef} className="h-full w-full z-0" />

        {/* Floating Point-Inspection Card on Map */}
        {inspectedPoint && (
          <Card className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-[440px] z-[500] bg-white/95 backdrop-blur-md rounded-2xl p-5 border border-[#DFDDD3] shadow-xl text-[#12241C] font-sans">
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center space-x-1.5">
                <Crosshair className="w-4 h-4 text-[#C69A50]" />
                <h4 className="font-bold text-[13px] uppercase tracking-wider text-[#5C6863]">
                  {t.map_inspect_header}
                </h4>
              </div>
              <span className="text-[13px] font-mono text-[#5C6863]">
                {isBn ? toBnNum(inspectedPoint.lat.toFixed(4)) : inspectedPoint.lat.toFixed(4)}°N,{" "}
                {isBn ? toBnNum(inspectedPoint.lng.toFixed(4)) : inspectedPoint.lng.toFixed(4)}°E
              </span>
            </div>
            <Separator className="mb-3 border-[#DFDDD3]" />

            {isCheckingPoint ? (
              <div className="py-2 text-[13px] text-[#78958A] flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C69A50] animate-ping"></span>
                <span>
                  {t.map_inspect_loading}
                </span>
              </div>
            ) : pointCheckResult?.district ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-[18px] text-[#11241C]">
                      {isBn ? (DISTRICTS_BN[pointCheckResult.district.pcode] || pointCheckResult.district.name) : pointCheckResult.district.name}
                    </span>
                    <span className="text-[14px] text-[#5C6863] ml-1.5">
                      ({isBn ? (DIVISIONS_BN[pointCheckResult.district.division] || pointCheckResult.district.division) : pointCheckResult.district.division} {t.map_division_suffix})
                    </span>
                  </div>
                  {pointCheckResult.district.rank && (
                    <Badge variant="secondary" className="text-[13px] font-semibold px-2.5 py-0.5 rounded-full">
                      {t.map_rank_label.replace(
                        "{rank}",
                        isBn ? toBnNum(pointCheckResult.district.rank) : String(pointCheckResult.district.rank)
                      )}
                    </Badge>
                  )}
                </div>

                {/* 24h Forecast Status for this District */}
                {currentPred && (
                  <div className="p-3.5 rounded-xl bg-[#F7F6F0] border border-[#DFDDD3] flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[13px] uppercase font-bold text-[#5C6863]">
                        {t.map_forecast_24h_title.replace("{date}", displayTargetDate)}
                      </div>
                      <div className="font-extrabold text-[18px] text-[#11241C] mt-0.5">
                        {currentPred.status === "unsupported"
                          ? t.map_radar_blindspot
                          : `${t.map_probability_label} ${
                              currentPred.probability === null || currentPred.probability === undefined
                                ? isBn ? "নেই" : "not available"
                                : percentText(currentPred.probability)
                            }`}
                      </div>
                    </div>
                    <Badge
                      variant={
                        currentPred.status === "unsupported"
                          ? "unsupported"
                          : currentPred.alert_level === "alert"
                          ? "alert"
                          : currentPred.alert_level === "watch"
                          ? "watch"
                          : "none"
                      }
                      className="text-[13px] font-bold uppercase px-3 py-1 rounded-full shadow-xs"
                    >
                      {currentPred.status === "unsupported"
                        ? t.map_badge_unsupported
                        : currentPred.alert_level === "none"
                        ? t.map_badge_no_alert
                        : currentPred.alert_level === "alert"
                        ? isBn ? "অ্যালার্ট" : "ALERT"
                        : isBn ? "নজরদারি" : "WATCH"}
                    </Badge>
                  </div>
                )}

                {!currentPred && view === "forecast" && !isForecastLoading && (
                  <div className="p-3 rounded-xl bg-[#F7F6F0] border border-[#DFDDD3] font-bold text-[14px] text-[#11241C]">
                    {isBn
                      ? `${displayTargetDate} তারিখের কোনো পূর্বাভাস নেই।`
                      : `No forecast for ${displayTargetDate}.`}
                  </div>
                )}

                {pointCheckResult.cell && pointCheckResult.cell.times_observed > 0 && (
                  <div className="p-2.5 rounded-xl bg-[#F7F6F0] border border-[#DFDDD3] flex items-center justify-between text-[13px]">
                    <span className="text-[#5C6863] font-medium">
                      {t.map_observed_satellite_label}
                    </span>
                    <span className="font-bold text-[#11241C]">
                      {t.map_of_major_events
                        .replace("{times}", isBn ? toBnNum(pointCheckResult.cell.times_flooded) : String(pointCheckResult.cell.times_flooded))
                        .replace("{total}", isBn ? toBnNum(pointCheckResult.cell.times_observed) : String(pointCheckResult.cell.times_observed))}
                    </span>
                  </div>
                )}

                {pointCheckResult.cell?.hazard &&
                  pointCheckResult.cell.hazard.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[13px] font-bold text-[#5C6863] uppercase">
                        {t.map_jrc_glofas_title}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {pointCheckResult.cell.hazard.map((h, i) => (
                          <div
                            key={i}
                            className="p-3 rounded-xl bg-[#F7F6F0] border border-[#DFDDD3] flex flex-col justify-between"
                          >
                            <span className="text-[13px] font-semibold text-[#5C6863]">
                              {isBn ? toBnNum(h.return_period_years) : h.return_period_years}-{isBn ? "বছরের বন্যা" : "Year Return Period"}
                            </span>
                            <span className="font-extrabold text-[18px] text-[#11241C] mt-0.5">
                              {h.depth_label
                                ? `${isBn ? DEPTH_BN[h.depth_label] || h.depth_label : h.depth_label}`
                                : isBn ? "বন্যা এলাকার বাইরে" : "Outside Area"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {pointCheckResult.cell?.permanent_water && (
                  <div className="text-[13px] text-[#78958A] font-semibold flex items-center gap-1.5">
                    <Waves className="w-4 h-4" /> {isBn ? "স্থানাঙ্কটি স্থায়ী নদী বা জলাশয়ের ওপর অবস্থিত।" : "Point lies on permanent river/waterway."}
                  </div>
                )}

                {onOpenEmergencyPlan && (
                  <Button
                    size="sm"
                    onClick={() => onOpenEmergencyPlan()}
                    className="w-full mt-2 h-9 bg-[#183026] hover:bg-[#0E1D16] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#4ADE80]" />
                    <span>{isBn ? "বিস্তারিত বন্যা প্রতিবেদন ও জরুরি পরিকল্পনা দেখুন" : "See Details & Emergency Plan"}</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-[13px] text-[#5C6863]">
                {isBn ? "স্থানাঙ্কটি বাংলাদেশের প্রশাসনিক সীমানার বাইরে। মানচিত্রের যেকোনো জেলায় ক্লিক করুন।" : "Point is outside Bangladesh administrative boundaries. Click any district on the map to inspect."}
              </div>
            )}
          </Card>
        )}
      </div>
    </Card>
  );
};
