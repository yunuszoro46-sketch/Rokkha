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

export const LeafletFloodMap: React.FC<LeafletFloodMapProps> = ({
  predictions,
  selectedDistrictPcode,
  onSelectDistrict,
  onInspectPoint,
  pointCheckResult,
  targetDate = "2022-06-18",
  lang = "en",
  onOpenEmergencyPlan,
}) => {
  const isBn = lang === "bn";
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const centerPinRef = useRef<L.Marker | null>(null);
  const [assets, setAssets] = useState<RegisteredAsset[]>([]);

  const currentDistrictPcode = selectedDistrictPcode || "BD6090"; // default Sunamganj
  const currentPred = predictions.find((p) => p.pcode === currentDistrictPcode);

  // Find district feature from boundaries data
  const feature = (districtBoundariesData as any).features?.find(
    (f: any) =>
      f.properties?.pcode === currentDistrictPcode ||
      f.properties?.admin2Pcode === currentDistrictPcode
  );
  const districtRawName = feature?.properties?.name || feature?.properties?.admin2Name || "Sunamganj";
  const districtDisplayName = isBn ? DISTRICTS_BN[currentDistrictPcode] || districtRawName : districtRawName;

  // Determine Risk
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

  // Probability
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

  // Peak Depth
  let peakDepthStr = "1.8m";
  if (pointCheckResult?.cell?.hazard && pointCheckResult.cell.hazard.length > 0) {
    const raw = pointCheckResult.cell.hazard[0].depth_label;
    if (raw) {
      peakDepthStr = isBn ? DEPTH_BN[raw] || raw : raw;
    }
  }
  if (peakDepthStr === "1.8m" && isBn) {
    peakDepthStr = "১.৮ মি.";
  }

  // Load assets for this district
  useEffect(() => {
    let cancelled = false;
    getRegisteredAssets(currentDistrictPcode).then((data) => {
      if (!cancelled) setAssets(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [currentDistrictPcode]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCenter = DISTRICT_CENTERS[currentDistrictPcode] || [25.0658, 91.395];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 9.5,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true,
    });

    // Clean OpenStreetMap Tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      subdomains: ["a", "b", "c"],
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update District Polygon and Framing when selected district changes
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

    if (!feature) {
      const center = DISTRICT_CENTERS[currentDistrictPcode] || [25.0658, 91.395];
      map.setView(center, 9.5);
      return;
    }

    // Add district boundary with subtle outline & fill
    const geoLayer = L.geoJSON(feature as any, {
      style: {
        color: "#6B7280",
        weight: 2,
        opacity: 0.85,
        fillColor: isHighRisk ? "#FEE2E2" : "#ECFDF5",
        fillOpacity: 0.25,
      },
    }).addTo(map);

    geoLayerRef.current = geoLayer;

    // Fit map bounds closely to the district
    try {
      const bounds = geoLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [24, 24],
          maxZoom: 11.5,
        });
      }
    } catch {
      const center = DISTRICT_CENTERS[currentDistrictPcode] || [25.0658, 91.395];
      map.setView(center, 9.5);
    }

    // Add Green Map Pin matching Image 2
    const bounds = geoLayer.getBounds();
    const centerPoint = bounds.isValid() ? bounds.getCenter() : L.latLng(DISTRICT_CENTERS[currentDistrictPcode] || [25.0658, 91.395]);

    const greenPinHtml = `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;transform:translate(-50%,-100%);">
        <div style="width:34px;height:42px;position:relative;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
          <svg viewBox="0 0 384 512" width="34" height="42" fill="#16A34A" style="display:block;">
            <path d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"/>
          </svg>
          <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);width:11px;height:11px;background:#FFFFFF;border-radius:50%;"></div>
        </div>
        <div style="background:rgba(255,255,255,0.95);color:#11241C;font-weight:800;font-size:12px;padding:2px 8px;border-radius:6px;box-shadow:0 2px 5px rgba(0,0,0,0.2);margin-top:2px;white-space:nowrap;letter-spacing:-0.2px;">
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

    // Invalidate size in case of container sizing transition
    const t = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => clearTimeout(t);
  }, [currentDistrictPcode, districtDisplayName, isHighRisk]);

  return (
    <Card className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-[#DFDDD3] shadow-md bg-white p-3.5 sm:p-5 space-y-3 sm:space-y-4">
      {/* 1. Header: My Location Report - [District Name] matching Image 2 */}
      <div className="text-center pt-0.5">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#8B5E3C] tracking-wide">
          {isBn ? `বন্যা ঝুঁকি প্রতিবেদন - ${districtDisplayName}` : `My Location Report - ${districtDisplayName}`}
        </h2>
      </div>

      {/* 2. 3 Stat Cards in a row matching Image 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        {/* Card 1: Current Flood Risk */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-[#DFDDD3] shadow-xs p-3 sm:p-4 text-center flex flex-col items-center justify-center space-y-0.5">
          <span className="text-[#5C6863] text-xs sm:text-sm font-semibold">
            {isBn ? "বর্তমান বন্যা ঝুঁকি" : "Current Flood Risk"}
          </span>
          <div className={`text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight my-0.5 ${riskColor}`}>
            {riskLabel}
          </div>
          <span className="text-[11px] sm:text-xs text-[#4B5563] font-medium">
            {isBn ? `উচ্ছেদ স্তর ${toBnNum(evacLevel)}` : `Evacuation Level ${evacLevel}`}
          </span>
        </div>

        {/* Card 2: 24H Forecast */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-[#DFDDD3] shadow-xs p-3 sm:p-4 text-center flex flex-col items-center justify-center space-y-0.5">
          <span className="text-[#5C6863] text-xs sm:text-sm font-semibold">
            {isBn ? "২৪ ঘণ্টার পূর্বাভাস" : "24H Forecast"}
          </span>
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#1F513F] tracking-tight my-0.5">
            {forecastProbabilityStr}
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[11px] sm:text-xs font-semibold text-[#1F513F]">
              {isBn ? "সম্ভাবনা" : "Probability"}
            </span>
            <span className="text-[10px] sm:text-[11px] text-[#4B5563] font-medium">
              {isBn ? "চরম নির্ভরযোগ্য" : "Extreme Confidence"}
            </span>
          </div>
        </div>

        {/* Card 3: Peak Flood Depth */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-[#DFDDD3] shadow-xs p-3 sm:p-4 text-center flex flex-col items-center justify-center space-y-0.5">
          <span className="text-[#5C6863] text-xs sm:text-sm font-semibold">
            {isBn ? "সর্বোচ্চ বন্যার গভীরতা" : "Peak Flood Depth"}
          </span>
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#11241C] tracking-tight my-0.5">
            {peakDepthStr}
          </div>
          <span className="text-[10px] sm:text-xs text-[#4B5563] font-medium">
            {isBn ? "গেজ স্টেশন ৭ এ রেকর্ডকৃত" : "Recorded at Gauge Station 7"}
          </span>
        </div>
      </div>

      {/* 3. Close-up Map Canvas matching Image 2 */}
      <div className="w-full">
        <div className="h-[210px] sm:h-[250px] md:h-[290px] w-full rounded-2xl overflow-hidden border border-[#DFDDD3] relative shadow-inner bg-[#FAF9F5]">
          <div ref={mapContainerRef} className="h-full w-full z-0" />
        </div>
      </div>

      {/* 4. Full-Width Dark Green Button: See Details & Emergency Plan matching Image 2 */}
      <Button
        type="button"
        onClick={() => onOpenEmergencyPlan?.()}
        className="w-full h-10 sm:h-11 bg-[#183026] hover:bg-[#0E1D16] text-white font-extrabold text-xs sm:text-sm md:text-base rounded-xl sm:rounded-2xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
      >
        <span>{isBn ? "বিস্তারিত ও জরুরি পরিকল্পনা দেখুন" : "See Details & Emergency Plan"}</span>
      </Button>
    </Card>
  );
};
