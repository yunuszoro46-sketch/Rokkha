"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import districtBoundariesData from "../data/bangladesh_districts.json";
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
          color: "#8B5E3C",
          weight: 3.5,
          fillColor: "#C9443A",
          fillOpacity: 0.26,
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
        <div style="background:#183026;color:#FFFFFF;font-weight:800;font-size:11px;padding:3px 9px;border-radius:12px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.35);margin-bottom:3px;letter-spacing:0.3px;">
          ${districtName}
        </div>
        <div style="width:18px;height:18px;background:#C9443A;border:3px solid #FFFFFF;border-radius:50%;box-shadow:0 0 12px rgba(201,68,58,0.85);"></div>
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
      const iconSymbol = isMedical ? "🏥" : "⛺";
      const pinColor = isMedical ? "#7C3AED" : "#2563EB";

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
      L.marker([lat, lng], { icon: shelterIcon })
        .bindPopup(
          `<div style="font-family:sans-serif;font-size:12px;line-height:1.4;">
            <strong style="color:#11241C;">${asset.name}</strong><br/>
            <span style="color:#5C6863;">${asset.asset_type}</span><br/>
            <span style="color:#2563EB;font-weight:600;">${distKm} km ${isBn ? "দূরে" : "away"}</span>
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
    <div className="relative w-full h-[260px] sm:h-[300px] rounded-2xl overflow-hidden border border-[#DFDDD3] shadow-inner bg-[#EDEBE2]">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      <div className="absolute top-2.5 right-2.5 z-10 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-[#DFDDD3] text-[11px] font-bold text-[#183026] shadow-xs flex items-center gap-2">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#C9443A]"></span>
          {isBn ? "ঝুঁকিপূর্ণ কেন্দ্র" : "District Epicenter"}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-[#7C3AED]"></span>
          {isBn ? "আশ্রয়/হাসপাতাল" : "Shelters & Medical"}
        </span>
      </div>
    </div>
  );
};
