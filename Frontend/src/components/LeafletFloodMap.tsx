"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import districtBoundariesData from "../data/bangladesh_districts.json";
import riversData from "../data/bangladesh_rivers.json";
import { DistrictPrediction, PointFloodCheck } from "../types/api";
import { formatProbability } from "../lib/utils";
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
}

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
}) => {
  const t = UI_TEXT[lang] || UI_TEXT.en;
  const isBn = lang === "bn";
  const displayTargetDate = isBn ? toBnNum(targetDate) : targetDate;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const districtLayerRef = useRef<L.GeoJSON | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const callbacksRef = useRef({ onSelectDistrict, onInspectPoint });

  useEffect(() => {
    callbacksRef.current = { onSelectDistrict, onInspectPoint };
  }, [onSelectDistrict, onInspectPoint]);

  const getDistrictFillColor = (
    pcode: string,
    preds: DistrictPrediction[]
  ): string => {
    const p = preds.find((item) => item.pcode === pcode);
    if (!p) return "#78958A";
    if (p.status === "unsupported") return "#94A3B8"; // neutral grey for 8 radar-blind districts
    if (p.alert_level === "alert") return "#B94A48"; // clay red
    if (p.alert_level === "watch") return "#C69A50"; // amber
    return "#78958A"; // restrained sage
  };

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
          fillColor: getDistrictFillColor(pcode, predictions),
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

        layer.bindTooltip(
          `<div style="font-weight:700;color:#263B32;font-size:16px;">${name} District</div><div style="font-size:16px;color:#58645f;">${division} Division · ${pcode}</div>`,
          { sticky: true, direction: "top" }
        );

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

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      districtLayerRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update District Choropleth Colors when predictions or selectedDistrictPcode changes
  useEffect(() => {
    const layer = districtLayerRef.current;
    if (!layer) return;

    layer.setStyle((feature) => {
      const pcode = feature?.properties?.pcode || "";
      const isSelected = pcode === selectedDistrictPcode;
      return {
        fillColor: getDistrictFillColor(pcode, predictions),
        fillOpacity: 0.62,
        color: isSelected ? "#263B32" : "#FFFFFF",
        weight: isSelected ? 2.8 : 1.2,
        dashArray: isSelected ? undefined : "3, 3",
      };
    });
  }, [predictions, selectedDistrictPcode]);

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
      <div className="p-4 bg-brand-white border-b border-brand-limestone flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-brand-forest" />
            <h2 className="font-bold text-2xl text-brand-forest">
              {t.map_card_title}
            </h2>
          </div>
          <span className="text-base text-brand-forest/60">
            {t.map_card_hint}
          </span>
        </div>

        {/* Target Date Presets from Section 3.F */}
        {onChangeTargetDate && (
          <div className="flex flex-wrap items-center gap-2 text-base">
            <span className="font-medium text-brand-forest/70">
              {t.map_forecast_date_label}
            </span>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => onChangeTargetDate(e.target.value)}
              className="h-10 w-44 font-mono text-base"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant={targetDate === "2022-06-18" ? "default" : "secondary"}
                onClick={() => onChangeTargetDate("2022-06-18")}
              >
                {t.scenario_sylhet}
              </Button>
              <Button
                size="sm"
                variant={targetDate === "2024-08-22" ? "default" : "secondary"}
                onClick={() => onChangeTargetDate("2024-08-22")}
              >
                {t.scenario_feni}
              </Button>
              <Button
                size="sm"
                variant={targetDate === "2023-04-10" ? "default" : "secondary"}
                onClick={() => onChangeTargetDate("2023-04-10")}
              >
                {t.scenario_dry}
              </Button>
            </div>
          </div>
        )}

        {/* Legend using shadcn/ui Badge */}
        <div className="flex flex-wrap items-center gap-2 text-base">
          <span className="font-medium text-brand-forest/70 mr-1">{t.map_legend_label}</span>
          <Badge variant="alert" className="gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-clay"></span> {t.map_legend_alert}
          </Badge>
          <Badge variant="watch" className="gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-amber"></span> {t.map_legend_watch}
          </Badge>
          <Badge variant="none" className="gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-sage"></span> {t.map_legend_normal}
          </Badge>
          <Badge variant="unsupported" className="gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>{" "}
            {t.map_legend_unsupported}
          </Badge>
        </div>
      </div>

      {/* Leaflet Map Canvas */}
      <div className="h-[660px] w-full relative">
        <div ref={mapContainerRef} className="h-full w-full z-0" />

        {/* Floating Point-Inspection Card on Map */}
        {inspectedPoint && (
          <Card className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-[440px] z-[500] bg-brand-white/95 backdrop-blur-md rounded-xl p-4 border-brand-limestone shadow-float">
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center space-x-1.5">
                <Crosshair className="w-4 h-4 text-brand-amber" />
                <h4 className="font-bold text-base uppercase tracking-wider text-brand-forest">
                  {t.map_inspect_header}
                </h4>
              </div>
              <span className="text-base font-mono text-brand-forest/60">
                {isBn ? toBnNum(inspectedPoint.lat.toFixed(4)) : inspectedPoint.lat.toFixed(4)}°N,{" "}
                {isBn ? toBnNum(inspectedPoint.lng.toFixed(4)) : inspectedPoint.lng.toFixed(4)}°E
              </span>
            </div>
            <Separator className="mb-2.5" />

            {isCheckingPoint ? (
              <div className="py-2 text-base text-brand-sage flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-amber animate-ping"></span>
                <span>
                  {t.map_inspect_loading}
                </span>
              </div>
            ) : pointCheckResult?.district ? (
              <div className="space-y-2.5 text-base">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-extrabold text-2xl text-brand-forest">
                      {isBn ? (DISTRICTS_BN[pointCheckResult.district.pcode] || pointCheckResult.district.name) : pointCheckResult.district.name}
                    </span>
                    <span className="text-brand-forest/60 ml-1.5">
                      ({isBn ? (DIVISIONS_BN[pointCheckResult.district.division] || pointCheckResult.district.division) : pointCheckResult.district.division} {t.map_division_suffix})
                    </span>
                  </div>
                  {pointCheckResult.district.flood_rank && (
                    <Badge variant="secondary">
                      {t.map_rank_label.replace(
                        "{rank}",
                        isBn ? toBnNum(pointCheckResult.district.flood_rank) : String(pointCheckResult.district.flood_rank)
                      )}
                    </Badge>
                  )}
                </div>

                {/* 24h Forecast Status for this District */}
                {currentPred && (
                  <div className="p-3 rounded-lg bg-brand-warm border border-brand-limestone flex items-center justify-between gap-2">
                    <div>
                      <div className="text-base uppercase font-bold text-brand-forest/60">
                        {t.map_forecast_24h_title.replace("{date}", displayTargetDate)}
                      </div>
                      <div className="font-bold text-brand-forest mt-0.5">
                        {currentPred.status === "unsupported"
                          ? t.map_radar_blindspot
                          : `${t.map_probability_label} ${
                              isBn ? toBnNum(formatProbability(currentPred.probability)) : formatProbability(currentPred.probability)
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
                      className="uppercase"
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

                {pointCheckResult.cell?.observed && (
                  <div className="p-2.5 rounded bg-brand-warm border border-brand-limestone flex items-center justify-between">
                    <span className="text-brand-forest/80">
                      {t.map_observed_satellite_label}
                    </span>
                    <span className="font-bold text-brand-forest">
                      {t.map_of_major_events
                        .replace("{times}", isBn ? toBnNum(pointCheckResult.cell.observed.times_flooded) : String(pointCheckResult.cell.observed.times_flooded))
                        .replace("{total}", isBn ? toBnNum(pointCheckResult.cell.observed.times_observed) : String(pointCheckResult.cell.observed.times_observed))}
                    </span>
                  </div>
                )}

                {pointCheckResult.cell?.hazard &&
                  pointCheckResult.cell.hazard.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-base font-semibold text-brand-forest/70 uppercase">
                        {t.map_jrc_glofas_title}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {pointCheckResult.cell.hazard.map((h, i) => (
                          <div
                            key={i}
                            className="p-2 rounded bg-brand-limestone/60 text-base flex flex-col"
                          >
                            <span className="text-brand-forest/70">
                              {isBn ? toBnNum(h.return_period_years) : h.return_period_years}-{isBn ? "বছরের বন্যা" : "Year Return Period"}
                            </span>
                            <span className="font-bold text-brand-forest">
                              {isBn ? "গভীরতা: " : "Depth: "}{isBn ? (h.depth_label.includes("Over 3m") ? "৩ মিটারের বেশি" : h.depth_label.includes("1-3m") ? "১ থেকে ৩ মিটার" : "০.৫ থেকে ১ মিটার") : h.depth_label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {pointCheckResult.cell?.permanent_water && (
                  <div className="text-base text-brand-sage font-medium flex items-center gap-1.5">
                    <Waves className="w-4 h-4" /> {isBn ? "স্থানাঙ্কটি স্থায়ী নদী বা জলাশয়ের ওপর অবস্থিত।" : "Point lies on permanent river/waterway."}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-base text-brand-forest/70">
                {isBn ? "স্থানাঙ্কটি বাংলাদেশের প্রশাসনিক সীমানার বাইরে। মানচিত্রের যেকোনো জেলায় ক্লিক করুন।" : "Point is outside Bangladesh administrative boundaries. Click any district on the map to inspect."}
              </div>
            )}
          </Card>
        )}
      </div>
    </Card>
  );
};
