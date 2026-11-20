"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import districtBoundariesData from "../data/bangladesh_districts.json";
import {
  DistrictPrediction,
  PointFloodCheck,
  RegisteredAsset,
} from "../types/api";
import { getRegisteredAssets } from "../services/api";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Maximize2 } from "lucide-react";
import {
  Language,
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
  isForecastLoading?: boolean;
  userPlace?: { lng: number; lat: number; label: string | null } | null;
  onOpenEmergencyPlan?: () => void;
}

const DISTRICT_CENTERS: Record<string, [number, number]> = {
  BD6090: [25.0658, 91.395], // Sunamganj
  BD6091: [24.8949, 91.8687], // Sylhet
  BD2028: [23.0159, 91.3976], // Feni
  BD3026: [23.8103, 90.4125], // Dhaka
  BD4044: [22.8456, 89.5403], // Khulna
  BD5081: [24.3636, 88.6241], // Rajshahi
  BD5577: [25.7439, 89.2752], // Rangpur
  BD1004: [22.701, 90.3535], // Barishal
  BD2015: [22.3569, 91.7832], // Chittagong
  BD4565: [24.7471, 90.4203], // Mymensingh
};

// Depth label in Bangla
const DEPTH_BN: Record<string, string> = {
  "< 1 m": "১ মিটারের কম",
  "1 to 3 m": "১ থেকে ৩ মিটার",
  "3 to 10 m": "৩ থেকে ১০ মিটার",
  "> 10 m": "১০ মিটারের বেশি",
};

// Leaflet needs literal colours; these mirror the --rk-risk-* tokens in globals.css.
const MAP_COLORS = {
  low: "#CFD9CC",
  watch: "#E9B949",
  alert: "#B3392D",
  unknown: "#C9C5BA",
  edge: "#6F7F73",
  selected: "#173D32",
};

export const LeafletFloodMap: React.FC<LeafletFloodMapProps> = ({
  predictions,
  selectedDistrictPcode,
  onSelectDistrict,
  onInspectPoint,
  inspectedPoint,
  pointCheckResult,
  targetDate = "",
  lang = "en",
  isForecastLoading = false,
  onOpenEmergencyPlan,
}) => {
  const isBn = lang === "bn";
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const centerPinRef = useRef<L.Marker | null>(null);
  const [assets, setAssets] = useState<RegisteredAsset[]>([]);
  // Tapping the map checks that exact spot (the fallback when GPS is not available).
  const onInspectRef = useRef(onInspectPoint);
  onInspectRef.current = onInspectPoint;
  const onSelectDistrictRef = useRef(onSelectDistrict);
  onSelectDistrictRef.current = onSelectDistrict;

  const currentDistrictPcode = selectedDistrictPcode || "BD6090"; // default Sunamganj
  const currentPred = predictions.find((p) => p.pcode === currentDistrictPcode);

  // Fill for one district from the real forecast (design system §2: data colours are not brand colours).
  const fillFor = (pcode: string | undefined): { color: string; opacity: number; unknown: boolean } => {
    const p = pcode ? predictions.find((x) => x.pcode === pcode) : undefined;
    if (isForecastLoading || !p || p.status !== "predicted") return { color: MAP_COLORS.unknown, opacity: 0.45, unknown: true };
    if (p.alert_level === "alert") return { color: MAP_COLORS.alert, opacity: 0.62, unknown: false };
    if (p.alert_level === "watch") return { color: MAP_COLORS.watch, opacity: 0.62, unknown: false };
    return { color: MAP_COLORS.low, opacity: 0.5, unknown: false };
  };

  // Find district feature from boundaries data
  const feature = (districtBoundariesData as any).features?.find(
    (f: any) =>
      f.properties?.pcode === currentDistrictPcode ||
      f.properties?.admin2Pcode === currentDistrictPcode
  );
  const districtRawName = feature?.properties?.name || feature?.properties?.admin2Name || "Sunamganj";
  const districtDisplayName = isBn ? DISTRICTS_BN[currentDistrictPcode] || districtRawName : districtRawName;

  // Everything on this card comes from the backend: the model's forecast for
  // the district on this day, and the flood check for the exact point.
  // When something is missing we say so; we never fill in a number.
  const level = currentPred?.status === "predicted" ? currentPred.alert_level : null;
  const isHighRisk = level === "alert";
  const isWatch = level === "watch";
  const riskLabel =
    isForecastLoading ? (isBn ? "লোড হচ্ছে…" : "Loading…")
    : level === "alert" ? (isBn ? "বিপদ (অ্যালার্ট)" : "Alert")
    : level === "watch" ? (isBn ? "সতর্কতা (ওয়াচ)" : "Watch")
    : level === "none" ? (isBn ? "নিম্ন" : "Low")
    : currentPred?.status === "unsupported" ? (isBn ? "পূর্বাভাস নেই" : "Not covered")
    : (isBn ? "পূর্বাভাস নেই" : "No forecast");
  // "Low" is grey-blue, never green: low chance is not "safe".
  const riskColor = isHighRisk ? "text-rk-danger" : isWatch ? "text-rk-warning" : "text-rk-muted";
  const riskNote =
    isForecastLoading ? (isBn ? "পূর্বাভাস আনা হচ্ছে" : "Getting the forecast")
    : level === "alert" ? (isBn ? "প্রস্তুত থাকুন; সরকারি নির্দেশ মেনে চলুন" : "Be ready to move; follow official orders")
    : level === "watch" ? (isBn ? "প্রস্তুতি নিন ও খবর রাখুন" : "Get prepared and keep checking")
    : level === "none" ? (isBn ? "আজ সম্ভাবনা কম — শূন্য নয়" : "Low chance today — not zero")
    : currentPred?.status === "unsupported" ? (isBn ? "এই জেলায় মডেল কাজ করে না" : "The model does not cover this district")
    : (isBn ? "এই দিনের পূর্বাভাস পাওয়া যায়নি" : "No forecast stored for this day");

  // Probability: the real number, or a dash.
  const probability = currentPred?.status === "predicted" ? currentPred.probability : null;
  let forecastProbabilityStr = "—";
  let probabilityNote = isBn ? "পূর্বাভাস নেই" : "not available";
  if (probability !== null && probability !== undefined) {
    const pct = Math.round(probability * 100);
    if (probability > 0.95) {
      // A model is never certain: don't show 100%.
      forecastProbabilityStr = isBn ? ">৯৫%" : ">95%";
      probabilityNote = isBn ? "১০ বারে ৯ বারের বেশি" : "more than 9 in 10";
    } else {
      const inTen = Math.max(0, Math.round(probability * 10));
      // A tiny chance is shown as "<1%", not "0%" (low is not zero).
      forecastProbabilityStr = pct < 1 ? (isBn ? "<১%" : "<1%") : `${isBn ? toBnNum(pct) : pct}%`;
      probabilityNote =
        inTen === 0
          ? (isBn ? "১০ বারে ১ বারেরও কম" : "less than 1 in 10")
          : isBn ? `প্রায় ১০ বারে ${toBnNum(inTen)} বার` : `about ${inTen} in 10`;
    }
  }

  // Depth: JRC's modelled river-flood depth for the ~90 m cell at the checked
  // point, in a 1-in-100-year flood. A model, not a measurement.
  const pointInDistrict = pointCheckResult?.district?.pcode === currentDistrictPcode;
  const hazard100 = pointInDistrict
    ? pointCheckResult?.cell?.hazard?.find((h: any) => h.return_period_years === 100)
    : undefined;
  let peakDepthStr = "—";
  let depthNote = isBn ? "মানচিত্রে ট্যাপ করুন বা জিপিএস ব্যবহার করুন" : "Tap the map or use GPS";
  if (pointInDistrict && pointCheckResult?.cell) {
    if (pointCheckResult.cell.permanent_water) {
      peakDepthStr = isBn ? "স্থায়ী জলাশয়" : "Water body";
      depthNote = isBn ? "নদী বা স্থায়ী পানি" : "River or permanent water";
    } else if (hazard100?.depth_label) {
      peakDepthStr = isBn ? DEPTH_BN[hazard100.depth_label] || hazard100.depth_label : hazard100.depth_label;
      depthNote = isBn ? "১০০ বছরে একবারের বন্যায়, মডেল (JRC)" : "in a 1-in-100-year flood, modelled (JRC)";
    } else {
      peakDepthStr = isBn ? "বাইরে" : "Outside";
      depthNote = isBn ? "মডেলের নদী-বন্যা এলাকার বাইরে (JRC)" : "the modelled river-flood zone (JRC)";
    }
  }

  // Load assets for this district
  useEffect(() => {
    let cancelled = false;
    getRegisteredAssets(currentDistrictPcode).then((data) => {
      if (!cancelled) setAssets(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [currentDistrictPcode]);

  // Bounding box of all Bangladesh to ensure the full country is visible
  const BD_BOUNDS: L.LatLngBoundsLiteral = [
    [20.55, 88.0],
    [26.65, 92.7],
  ];

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [23.75, 90.35],
      zoom: 7,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false, // page scrolling is not captured; a click on the map turns wheel zoom on
      minZoom: 6,
      maxZoom: 16,
    });

    // Clean OpenStreetMap Tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      subdomains: ["a", "b", "c"],
      opacity: 0.8, // a little quieter so the forecast colours read first
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors · Boundaries: BBS/OCHA',
    }).addTo(map);
    map.attributionControl.setPrefix(false);

    map.fitBounds(BD_BOUNDS, { padding: [16, 16] });

    map.on("click", (e: L.LeafletMouseEvent) => onInspectRef.current?.(e.latlng.lat, e.latlng.lng));

    map.on("click focus", () => map.scrollWheelZoom.enable());
    map.on("mouseout blur", () => map.scrollWheelZoom.disable());
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update District Polygons, Green Cover, and Pin Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old geoLayer
    if (geoLayerRef.current) {
      map.removeLayer(geoLayerRef.current);
      geoLayerRef.current = null;
    }
    if (centerPinRef.current) {
      map.removeLayer(centerPinRef.current);
      centerPinRef.current = null;
    }

    let selectedLayerBounds: L.LatLngBounds | null = null;

    // Every district coloured by its real forecast level for the chosen day (legend below the map).
    // No forecast / not covered is grey with a dashed edge: never drawn as "low".
    const geoLayer = L.geoJSON(districtBoundariesData as any, {
      style: (feat) => {
        const pcode = feat?.properties?.pcode || feat?.properties?.admin2Pcode;
        const isSelected = pcode === currentDistrictPcode;
        const fill = fillFor(pcode);
        return {
          color: isSelected ? MAP_COLORS.selected : MAP_COLORS.edge,
          weight: isSelected ? 3.5 : 1,
          opacity: isSelected ? 1 : 0.7,
          dashArray: fill.unknown && !isSelected ? "3 3" : undefined,
          fillColor: fill.color,
          fillOpacity: fill.opacity,
        };
      },
      onEachFeature: (feat, layer) => {
        const pcode = feat.properties?.pcode || feat.properties?.admin2Pcode;
        const name = feat.properties?.name || feat.properties?.admin2Name || "";
        const isSelected = pcode === currentDistrictPcode;

        if (isSelected) {
          selectedLayerBounds = (layer as any).getBounds();
          setTimeout(() => {
            (layer as any).bringToFront?.();
          }, 0);
        }

        const displayName = isBn ? DISTRICTS_BN[pcode] || name : name;
        layer.bindTooltip(displayName, {
          sticky: true,
          direction: "top",
          className: "rokkha-district-tooltip",
        });

        layer.on({
          mouseover: (e) => {
            if (pcode !== currentDistrictPcode) {
              const target = e.target;
              target.setStyle({ weight: 2.5, color: MAP_COLORS.selected });
            }
          },
          mouseout: (e) => {
            if (pcode !== currentDistrictPcode) {
              geoLayer.resetStyle(e.target);
            }
          },
          click: (e) => {
            L.DomEvent.stopPropagation(e);
            if (pcode) {
              onSelectDistrictRef.current?.(pcode, name);
            }
            onInspectRef.current?.(e.latlng.lat, e.latlng.lng);
          },
        });
      },
    }).addTo(map);

    geoLayerRef.current = geoLayer;

    // Add Green Map Pin matching selected district
    const bounds = selectedLayerBounds || (feature ? L.geoJSON(feature as any).getBounds() : null);
    const centerPoint =
      pointInDistrict && inspectedPoint
        ? L.latLng(inspectedPoint.lat, inspectedPoint.lng)
        : bounds && bounds.isValid()
        ? bounds.getCenter()
        : L.latLng(DISTRICT_CENTERS[currentDistrictPcode] || [23.75, 90.35]);

    const greenPinHtml = `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;transform:translate(-50%,-100%);">
        <div style="width:34px;height:42px;position:relative;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
          <svg viewBox="0 0 384 512" width="34" height="42" fill="#173D32" style="display:block;">
            <path d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"/>
          </svg>
          <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);width:11px;height:11px;background:#FFFFFF;border-radius:50%;"></div>
        </div>
        <div style="background:rgba(255,255,255,0.95);color:#173D32;font-weight:800;font-size:12px;padding:2px 8px;border-radius:6px;box-shadow:0 2px 5px rgba(0,0,0,0.2);margin-top:2px;white-space:nowrap;letter-spacing:-0.2px;">
          ${districtDisplayName}
        </div>
      </div>
    `;

    const pinIcon = L.divIcon({
      className: "rokkha-green-pin",
      html: greenPinHtml,
      iconSize: [0, 0],
    });

    const marker = L.marker(centerPoint, { icon: pinIcon }).addTo(map);
    centerPinRef.current = marker;

    // Pan smoothly toward selected district while preserving national perspective
    map.panTo(centerPoint, { animate: true });

    // Invalidate size in case of container sizing transition
    const t = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => clearTimeout(t);
  }, [currentDistrictPcode, districtDisplayName, isHighRisk, pointInDistrict, inspectedPoint?.lat, inspectedPoint?.lng, predictions, isForecastLoading]);

  return (
    <Card className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-rk-line shadow-md bg-white p-3.5 sm:p-5 space-y-3 sm:space-y-4">
      {/* 1. Header: My Location Report - [District Name] matching Image 2 */}
      <div className="text-center pt-0.5">
        <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold text-rk-forest">
          {isBn ? `বন্যা ঝুঁকি প্রতিবেদন · ${districtDisplayName}` : `Flood risk report · ${districtDisplayName}`}
        </h2>
      </div>

      {/* 2. 3 Stat Cards in a row matching Image 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        {/* Card 1: Current Flood Risk */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-rk-line shadow-xs p-3 sm:p-4 text-center flex flex-col items-center justify-center space-y-0.5">
          <span className="text-rk-muted text-xs sm:text-sm font-semibold">
            {isBn ? `বন্যা ঝুঁকি · ${toBnNum(targetDate)}` : `Flood risk · ${targetDate}`}
          </span>
          <div className={`text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight my-0.5 ${riskColor}`}>
            {riskLabel}
          </div>
          <span className="text-[11px] sm:text-xs text-rk-muted font-medium">
            {riskNote}
          </span>
        </div>

        {/* Card 2: 24H Forecast */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-rk-line shadow-xs p-3 sm:p-4 text-center flex flex-col items-center justify-center space-y-0.5">
          <span className="text-rk-muted text-xs sm:text-sm font-semibold">
            {isBn ? "২৪ ঘণ্টার পূর্বাভাস" : "24H Forecast"}
          </span>
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-rk-brand tracking-tight my-0.5">
            {forecastProbabilityStr}
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[11px] sm:text-xs font-semibold text-rk-brand">
              {isBn ? "বন্যার সম্ভাবনা (জেলা)" : "Chance of flooding (district)"}
            </span>
            <span className="text-[10px] sm:text-[11px] text-rk-muted font-medium">
              {probabilityNote}
            </span>
          </div>
        </div>

        {/* Card 3: Peak Flood Depth */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-rk-line shadow-xs p-3 sm:p-4 text-center flex flex-col items-center justify-center space-y-0.5">
          <span className="text-rk-muted text-xs sm:text-sm font-semibold">
            {isBn ? "বন্যার গভীরতা (এই স্থানে)" : "Flood depth (this spot)"}
          </span>
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-rk-ink tracking-tight my-0.5">
            {peakDepthStr}
          </div>
          <span className="text-[10px] sm:text-xs text-rk-muted font-medium">
            {depthNote}
          </span>
        </div>
      </div>

      {/* When and for which day the forecast was made: never implied, always stated. */}
      <p className="text-xs text-rk-muted -mt-1">
        {isForecastLoading
          ? null
          : currentPred?.issued_at
            ? isBn
              ? `${toBnNum(targetDate)} তারিখের মডেল পূর্বাভাস, তৈরি ${toBnNum(new Date(currentPred.issued_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }))} (বাংলাদেশ সময়)। সরকারি সতর্কবার্তা নয়: ffwc.gov.bd দেখুন।`
              : `Model forecast for ${targetDate}, issued ${new Date(currentPred.issued_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} (Bangladesh time). Not an official warning: see ffwc.gov.bd.`
            : isBn
              ? `${toBnNum(targetDate)} তারিখের কোনো পূর্বাভাস নেই।`
              : `No forecast for ${targetDate}.`}
      </p>

      {/* 3. Expansive Full Bangladesh Map Canvas with Green District Cover */}
      <div className="w-full">
        <div className="h-[480px] sm:h-[560px] md:h-[640px] w-full rounded-2xl overflow-hidden border border-rk-line relative shadow-inner bg-rk-page">
          <div ref={mapContainerRef} className="h-full w-full z-0" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => mapRef.current?.fitBounds(BD_BOUNDS, { padding: [16, 16] })}
            className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur-md hover:bg-white text-rk-ink border-rk-line font-bold text-xs h-7.5 px-2.5 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
            title={isBn ? "পুরো বাংলাদেশ দেখুন" : "View Full Bangladesh"}
          >
            <Maximize2 className="w-3.5 h-3.5 text-rk-brand" />
            <span>{isBn ? "পুরো বাংলাদেশ" : "Full Bangladesh"}</span>
          </Button>
        </div>
      </div>

      {/* Legend: what each map colour means (the same words as the forecast levels). */}
      <div className="rounded-xl border border-rk-line bg-rk-page/60 px-3 py-2.5" aria-label={isBn ? "মানচিত্রের রঙের অর্থ" : "Map legend"}>
        <p className="font-mono text-[11px] tracking-wider uppercase text-rk-muted">
          {isBn ? `জেলার পূর্বাভাস · ${toBnNum(targetDate)}` : `District forecast · ${targetDate}`}
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-rk-ink">
          <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3.5 w-5 rounded-sm border border-black/10" style={{ background: MAP_COLORS.alert }} />{isBn ? "বিপদ (অ্যালার্ট)" : "Alert — be ready to move"}</li>
          <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3.5 w-5 rounded-sm border border-black/10" style={{ background: MAP_COLORS.watch }} />{isBn ? "সতর্কতা (ওয়াচ)" : "Watch — get prepared"}</li>
          <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3.5 w-5 rounded-sm border border-black/10" style={{ background: MAP_COLORS.low }} />{isBn ? "কম সম্ভাবনা — শূন্য নয়" : "Low chance — not zero"}</li>
          <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3.5 w-5 rounded-sm border border-dashed border-rk-muted" style={{ background: MAP_COLORS.unknown }} />{isBn ? "পূর্বাভাস নেই / আওতার বাইরে" : "No forecast / not covered"}</li>
          <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3.5 w-5 rounded-sm border-[3px]" style={{ borderColor: MAP_COLORS.selected }} />{isBn ? "বেছে নেওয়া জেলা" : "Selected district"}</li>
        </ul>
        <p className="mt-1.5 text-xs text-rk-muted">
          {isBn ? "মডেলের অনুমান, জেলা স্তরে; সরকারি সতর্কবার্তা নয়।" : "Model estimate at district level; not an official warning."}
        </p>
      </div>

      {/* 4. Full-Width Dark Green Button: See Details & Emergency Plan matching Image 2 */}
      <Button
        type="button"
        onClick={() => onOpenEmergencyPlan?.()}
        className="w-full h-10 sm:h-11 bg-rk-brand hover:bg-rk-brand-strong text-white font-extrabold text-xs sm:text-sm md:text-base rounded-xl sm:rounded-2xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
      >
        <span>{isBn ? "বিস্তারিত ও জরুরি পরিকল্পনা দেখুন" : "See Details & Emergency Plan"}</span>
      </Button>
    </Card>
  );
};
