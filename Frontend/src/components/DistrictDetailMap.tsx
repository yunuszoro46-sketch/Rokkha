"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import districtBoundariesData from "../data/bangladesh_districts.json";
import { toBnNum } from "../lib/translations";

// Names come from OpenStreetMap and the admin panel: escape them before they go into popup HTML.
const esc = (v: string) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const TYPE_LABEL: Record<string, [string, string]> = {
  flood_shelter: ["Flood shelter", "বন্যা আশ্রয়কেন্দ্র"],
  hospital: ["Hospital", "হাসপাতাল"],
  clinic: ["Clinic", "ক্লিনিক"],
  school: ["School", "বিদ্যালয়"],
};
const typeLabel = (t: string, bn: boolean) => (TYPE_LABEL[t] ? TYPE_LABEL[t][bn ? 1 : 0] : t.replace(/_/g, " "));
import { AssetNearResult } from "../types/api";

interface DistrictDetailMapProps {
  pcode: string;
  districtName: string;
  lat: number;
  lng: number;
  assets?: AssetNearResult[];
  isBn?: boolean;
}

export const DistrictDetailMap: React.FC<DistrictDetailMapProps> = ({
  pcode,
  districtName,
  lat,
  lng,
  assets = [],
  isBn = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: 12,
      minZoom: 9,
      maxZoom: 18,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Find and draw the district boundary
    const features = (districtBoundariesData as any)?.features || [];
    const districtFeature = features.find(
      (f: any) =>
        f.properties?.pcode === pcode ||
        f.properties?.ADM2_PCODE === pcode ||
        f.properties?.name?.toLowerCase() === districtName.toLowerCase()
    );

    if (districtFeature) {
      const geoLayer = L.geoJSON(districtFeature, {
        style: {
          color: "#173D32",
          weight: 3,
          fillColor: "#DCEBE5",
          fillOpacity: 0.35,
          dashArray: "3, 3",
        },
      }).addTo(map);

      try {
        const bounds = geoLayer.getBounds();
        if (bounds.isValid()) {
          // Frame tightly and ensure close-up zoom level
          map.fitBounds(bounds, { padding: [8, 8], maxZoom: 12.5 });
          if (map.getZoom() < 11) {
            map.setZoom(11.5);
          }
        } else {
          map.setView([lat, lng], 12);
        }
      } catch {
        map.setView([lat, lng], 12);
      }
    } else {
      map.setView([lat, lng], 12);
    }

    // Add prominent center pin marker with district badge
    const centerPinHtml = `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
        <div style="background:#173D32;color:#FFFFFF;font-weight:800;font-size:11px;padding:3px 9px;border-radius:12px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.35);margin-bottom:3px;letter-spacing:0.3px;">
          ${districtName}
        </div>
        <div style="width:18px;height:18px;background:#247A5B;border:3px solid #FFFFFF;border-radius:50%;box-shadow:0 2px 8px rgba(23,61,50,0.45);"></div>
      </div>
    `;
    const centerIcon = L.divIcon({
      className: "detail-map-center-pin",
      html: centerPinHtml,
      iconSize: [100, 44],
      iconAnchor: [50, 42],
    });
    L.marker([lat, lng], { icon: centerIcon }).addTo(map);

    // Add nearby shelters & medical facilities
    assets.slice(0, 6).forEach((item) => {
      const asset = item.asset;
      const lat = asset.location.coordinates[1];
      const lng = asset.location.coordinates[0];
      const isMedical =
        asset.asset_type.toLowerCase().includes("hospital") ||
        asset.asset_type.toLowerCase().includes("clinic") ||
        asset.asset_type.toLowerCase().includes("health");
      // Simple drawn symbols (no emoji): a cross for health sites, a roof for shelters.
      const iconSymbol = isMedical
        ? '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M5 1h4v4h4v4H9v4H5V9H1V5h4z" fill="#FFF"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 7 7 1.5 13 7M3 6v6h8V6" fill="none" stroke="#FFF" stroke-width="2" stroke-linejoin="round"/></svg>';
      const pinColor = isMedical ? "#8E5434" : "#2C6573";

      const shelterHtml = `
        <div style="width:26px;height:26px;background:${pinColor};color:#FFF;border:2px solid #FFF;border-radius:7px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.3);font-size:13px;cursor:pointer;">
          ${iconSymbol}
        </div>
      `;
      const shelterIcon = L.divIcon({
        className: "detail-map-shelter-pin",
        html: shelterHtml,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const distKm = item.distance_kilometers.toFixed(1);
      L.marker([lat, lng], { icon: shelterIcon, title: asset.name, alt: asset.name, keyboard: true })
        .bindPopup(
          `<div style="font-family:sans-serif;font-size:12px;line-height:1.4;">
            <strong style="color:#173D32;">${esc(asset.name)}</strong><br/>
            <span style="color:#4F5F53;">${esc(typeLabel(asset.asset_type, isBn))}</span><br/>
            <span style="color:#2C6573;font-weight:600;">${isBn ? toBnNum(distKm) : distKm} ${isBn ? "কিমি দূরে" : "km away"}</span>
          </div>`
        )
        .addTo(map);
    });

    mapRef.current = map;

    // Invalidate size to handle modal transition
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      map.remove();
      mapRef.current = null;
    };
  }, [pcode, districtName, lat, lng, assets, isBn]);

  return (
    <div className="relative w-full h-[135px] sm:h-[155px] rounded-2xl overflow-hidden border border-rk-line shadow-inner bg-rk-page">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      <div className="absolute top-2 right-2 z-10 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-lg border border-rk-line text-[10px] font-bold text-rk-brand shadow-xs flex items-center gap-1.5">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rk-danger"></span>
          {isBn ? "জেলার কেন্দ্র" : "District centre"}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-sm bg-rk-info"></span>
          {isBn ? "আশ্রয়/হাসপাতাল" : "Shelters & Medical"}
        </span>
      </div>
    </div>
  );
};
