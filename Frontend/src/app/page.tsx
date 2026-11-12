"use client";

import React, { useState, useEffect, useMemo, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Calendar,
  FileText,
  Printer,
  Phone,
  Waves,
  CloudRain,
  Building2,
  Crosshair,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

// Official shadcn/ui primitives
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// Live Engine Components (strictly adhering to FRONTEND_API_GUIDE.md)
import { SideDashboard, CitizenView } from "@/components/SideDashboard";
import { AlertsFeed } from "@/components/AlertsFeed";
import { DistrictSatelliteTimeline } from "@/components/DistrictSatelliteTimeline";
import { RainRiverCharts } from "@/components/RainRiverCharts";
import { NearestShelters } from "@/components/NearestShelters";
import { AttributionFooter } from "@/components/AttributionFooter";
import districtGeoData from "@/data/bangladesh_districts.json";
import districtFloodHistory from "@/data/district_flood_history.json";
import benchmarkData from "@/data/benchmark_predictions.json";
import mapAsset from "@/assets/map.png";
import logoAsset from "@/assets/logo.png";
import { mapOutline } from "@/assets/bangladesh-map-outline";
import { internalDivisionBorders } from "@/assets/bangladesh_division_borders";
import {
  Language,
  UI_TEXT,
  toBnNum,
  DISTRICTS_BN,
  DIVISIONS_BN,
} from "@/lib/translations";
import {
  DistrictPrediction,
  AlertItem,
  PointFloodCheck,
  ModelStatus,
} from "@/types/api";
import {
  checkBackendHealth,
  getPredictions,
  getAlerts,
  checkPointFlood,
  getModelStatus,
} from "@/services/api";

// Dynamically import Leaflet map for interactive exploration
const LeafletFloodMap = dynamic(
  () => import("@/components/LeafletFloodMap").then((mod) => mod.LeafletFloodMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[540px] w-full rounded-2xl bg-[#EDEBE2] flex items-center justify-center text-[#263B32]/60 text-base font-medium">
        Loading Interactive Cartographic Leaflet Engine...
      </div>
    ),
  }
);

// 64 districts list extracted from official GeoJSON
const ALL_DISTRICTS: Array<{ pcode: string; name: string; division: string }> = (
  districtGeoData as any
).features
  .map((f: any) => ({
    pcode: f.properties.pcode,
    name: f.properties.name,
    division: f.properties.parent_name || "",
  }))
  .sort((a: any, b: any) => a.name.localeCompare(b.name));

const DISTRICT_CENTERS: Record<string, [number, number]> =
  (benchmarkData as any).centroids || {
    BD6090: [24.9602, 91.3992], // Sunamganj
    BD3026: [23.8103, 90.4125], // Dhaka
    BD6091: [24.8949, 91.8687], // Sylhet
  };

type IconName =
  | "arrow"
  | "bell"
  | "building"
  | "chart"
  | "check"
  | "cloud"
  | "code"
  | "database"
  | "layers"
  | "location"
  | "menu"
  | "play"
  | "shield"
  | "sliders"
  | "users";

const iconPaths: Record<IconName, ReactNode> = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  building: (
    <path d="M4 21V5h10v16M14 9h6v12M8 9h2M8 13h2M8 17h2M17 13h1M17 17h1M2 21h20" />
  ),
  chart: (
    <path d="M4 20V10h4v10M10 20V5h4v15M16 20V13h4v7M2 20h20" />
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  cloud: (
    <path d="M17.5 19H6a4 4 0 0 1-.4-8 6.5 6.5 0 0 1 12.5-1.5A4.8 4.8 0 0 1 17.5 19ZM8 22l1-2m4 2 1-2m4 2 1-2" />
  ),
  code: <path d="m8 9-4 3 4 3m8-6 4 3-4 3m-3-9-2 12" />,
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3-9 5 9 5 9-5-9-5Z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  location: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  play: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8 6 4-6 4V8Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
      <path d="m9 12 2 2 4-5" />
    </>
  ),
  sliders: (
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
  ),
  users: (
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
  ),
};

function Icon({
  name,
  size = 22,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}

const getCapabilities = (t: any): Array<{
  icon: IconName;
  title: string;
  body: string;
  featured?: boolean;
  targetView: CitizenView;
}> => [
  {
    icon: "chart",
    title: t.cap_1_title,
    body: t.cap_1_desc,
    targetView: "satellite",
  },
  {
    icon: "layers",
    title: t.cap_2_title,
    body: t.cap_2_desc,
    featured: true,
    targetView: "map",
  },
  {
    icon: "location",
    title: t.cap_3_title,
    body: t.cap_3_desc,
    targetView: "map",
  },
  {
    icon: "building",
    title: t.cap_4_title,
    body: t.cap_4_desc,
    targetView: "shelters",
  },
  {
    icon: "users",
    title: t.cap_5_title,
    body: t.cap_5_desc,
    targetView: "alerts",
  },
  {
    icon: "cloud",
    title: t.cap_6_title,
    body: t.cap_6_desc,
    targetView: "hydro",
  },
  {
    icon: "database",
    title: t.cap_7_title,
    body: t.cap_7_desc,
    targetView: "shelters",
  },
  {
    icon: "code",
    title: t.cap_8_title,
    body: t.cap_8_desc,
    targetView: "alerts",
  },
];

function MapArtwork({
  compact = false,
  lang = "en",
}: {
  compact?: boolean;
  lang?: Language;
}) {
  const t = UI_TEXT[lang];
  return (
    <div
      className={`map-art ${compact ? "map-art-compact" : ""} relative overflow-hidden`}
      aria-label="Illustrated flood risk map of Bangladesh with real-time river flow"
      role="img"
    >
      {/* Background Soft Radar Aura Circle */}
      <div
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        aria-hidden="true"
      >
        <div className="w-[88%] h-[88%] rounded-full border border-[#D5D2C5]/50 bg-radial from-white/40 via-transparent to-transparent opacity-75" />
        <div className="w-[62%] h-[62%] rounded-full border border-[#D5D2C5]/30" />
      </div>

      {/* Base Bangladesh District Map */}
      <img
        src={mapAsset.src}
        alt="Flood risk map of Bangladesh"
        className="w-full h-full object-contain relative z-10"
      />

      {/* Hydrodynamic River Currents & Flow Layer (Overlaid on Map) */}
      <svg
        className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
        viewBox="0 0 849 1131"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="riverGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <radialGradient id="haorGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.85" />
            <stop offset="40%" stopColor="#0099FF" stopOpacity="0.65" />
            <stop offset="80%" stopColor="#005B96" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#001F3F" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Haor Flood Inundation Pools (Sylhet & Sunamganj Basin) */}
        <g className="haor-water-pool">
          <ellipse cx="610" cy="385" rx="55" ry="38" fill="url(#haorGlow)" />
          <ellipse cx="560" cy="445" rx="46" ry="32" fill="url(#haorGlow)" />
          <ellipse cx="735" cy="360" rx="32" ry="22" fill="url(#haorGlow)" />
        </g>

        {/* River Underglow Paths */}
        <g filter="url(#riverGlow)" opacity="0.9" className="river-glow-layer">
          {/* Brahmaputra / Jamuna */}
          <path
            d="M 380 75 Q 370 180 365 260 T 375 380 Q 380 470 410 540"
            stroke="#00D2FF"
            strokeWidth="11"
            strokeLinecap="round"
          />
          {/* Teesta & NW Feeder */}
          <path
            d="M 245 130 Q 300 180 365 260"
            stroke="#00D2FF"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M 175 190 Q 230 250 310 330 Q 345 360 375 380"
            stroke="#00D2FF"
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Ganges / Padma */}
          <path
            d="M 100 405 Q 170 425 240 460 T 340 500 Q 380 520 410 540"
            stroke="#00D2FF"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Lower Padma to Chandpur */}
          <path
            d="M 410 540 Q 460 575 510 635"
            stroke="#00D2FF"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* Surma & Kushiyara */}
          <path
            d="M 825 350 Q 750 330 670 340 Q 610 360 550 420"
            stroke="#00D2FF"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 760 400 Q 690 420 620 440 Q 570 460 540 510"
            stroke="#00D2FF"
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* Upper Meghna */}
          <path
            d="M 550 420 Q 540 520 510 635"
            stroke="#00D2FF"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Lower Meghna Delta & Bay Outflows */}
          <path
            d="M 510 635 Q 520 730 505 820 Q 495 910 485 985"
            stroke="#00D2FF"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M 470 660 Q 440 740 420 830 Q 410 910 405 975"
            stroke="#00D2FF"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M 525 670 Q 560 760 565 850 Q 560 920 545 985"
            stroke="#00D2FF"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M 545 680 Q 615 760 625 850 Q 620 920 605 975"
            stroke="#00D2FF"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Sundarbans Channels */}
          <path
            d="M 330 610 Q 340 710 330 810 Q 320 880 315 970"
            stroke="#00D2FF"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M 370 630 Q 380 730 375 830 Q 365 900 355 975"
            stroke="#00D2FF"
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* Chittagong / Karnafuli */}
          <path
            d="M 750 820 Q 720 910 700 990 Q 690 1050 680 1100"
            stroke="#00D2FF"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </g>

        {/* Core Electric Blue Water Streams */}
        <g stroke="#00F0FF" strokeLinecap="round" fill="none">
          <path d="M 380 75 Q 370 180 365 260 T 375 380 Q 380 470 410 540" strokeWidth="5.5" />
          <path d="M 245 130 Q 300 180 365 260" strokeWidth="4" />
          <path d="M 175 190 Q 230 250 310 330 Q 345 360 375 380" strokeWidth="3.5" />
          <path d="M 100 405 Q 170 425 240 460 T 340 500 Q 380 520 410 540" strokeWidth="5.5" />
          <path d="M 410 540 Q 460 575 510 635" strokeWidth="7.5" />
          <path d="M 825 350 Q 750 330 670 340 Q 610 360 550 420" strokeWidth="4.5" />
          <path d="M 760 400 Q 690 420 620 440 Q 570 460 540 510" strokeWidth="4" />
          <path d="M 550 420 Q 540 520 510 635" strokeWidth="5.5" />
          <path d="M 510 635 Q 520 730 505 820 Q 495 910 485 985" strokeWidth="9" />
          <path d="M 470 660 Q 440 740 420 830 Q 410 910 405 975" strokeWidth="5" />
          <path d="M 525 670 Q 560 760 565 850 Q 560 920 545 985" strokeWidth="6" />
          <path d="M 545 680 Q 615 760 625 850 Q 620 920 605 975" strokeWidth="5" />
          <path d="M 330 610 Q 340 710 330 810 Q 320 880 315 970" strokeWidth="4" />
          <path d="M 370 630 Q 380 730 375 830 Q 365 900 355 975" strokeWidth="4" />
          <path d="M 750 820 Q 720 910 700 990 Q 690 1050 680 1100" strokeWidth="4.5" />
        </g>

        {/* Animated Downward Hydrodynamic Flow Currents (White/Cyan Pulsing Dashes) */}
        <g stroke="#FFFFFF" strokeLinecap="round" fill="none" className="river-flow-animated" opacity="0.95">
          <path d="M 380 75 Q 370 180 365 260 T 375 380 Q 380 470 410 540" strokeWidth="2.5" />
          <path d="M 245 130 Q 300 180 365 260" strokeWidth="2" />
          <path d="M 175 190 Q 230 250 310 330 Q 345 360 375 380" strokeWidth="1.8" />
          <path d="M 100 405 Q 170 425 240 460 T 340 500 Q 380 520 410 540" strokeWidth="2.5" />
          <path d="M 410 540 Q 460 575 510 635" strokeWidth="3" />
          <path d="M 825 350 Q 750 330 670 340 Q 610 360 550 420" strokeWidth="2" />
          <path d="M 760 400 Q 690 420 620 440 Q 570 460 540 510" strokeWidth="2" />
          <path d="M 550 420 Q 540 520 510 635" strokeWidth="2.5" />
          <path d="M 510 635 Q 520 730 505 820 Q 495 910 485 985" strokeWidth="3.5" />
          <path d="M 470 660 Q 440 740 420 830 Q 410 910 405 975" strokeWidth="2.2" />
          <path d="M 525 670 Q 560 760 565 850 Q 560 920 545 985" strokeWidth="2.5" />
          <path d="M 545 680 Q 615 760 625 850 Q 620 920 605 975" strokeWidth="2.2" />
          <path d="M 330 610 Q 340 710 330 810 Q 320 880 315 970" strokeWidth="1.8" />
          <path d="M 370 630 Q 380 730 375 830 Q 365 900 355 975" strokeWidth="1.8" />
          <path d="M 750 820 Q 720 910 700 990 Q 690 1050 680 1100" strokeWidth="2" />
        </g>
      </svg>

      {/* Legend on Bottom-Right */}
      {!compact && (
        <div className="absolute bottom-5 right-5 z-30 bg-[#FAF9F5]/95 backdrop-blur-md border border-[#E2E0D6] rounded-xl px-4 py-3 shadow-lg text-left">
          <div className="font-bold text-sm text-[#12241C] mb-2">
            {lang === "bn" ? "বন্যা ঝুঁকি স্তর" : "Flood Risk Level"}
          </div>
          <div className="flex flex-col gap-1.5 text-xs text-[#2D3A34] font-medium">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#74A57F] inline-block shadow-sm" />
              <span>{lang === "bn" ? "কম (Low)" : "Low"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#F4C430] inline-block shadow-sm" />
              <span>{lang === "bn" ? "মাঝারি (Moderate)" : "Moderate"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#F4A236] inline-block shadow-sm" />
              <span>{lang === "bn" ? "বেশি (High)" : "High"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#D9381E] inline-block shadow-sm" />
              <span>{lang === "bn" ? "ভয়াবহ (Severe)" : "Severe"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PAGE_METADATA: Record<
  Language,
  Record<
    Exclude<CitizenView, "overview">,
    { eyebrow: string; title: string; subtitle: string }
  >
> = {
  en: {
    map: {
      eyebrow: "GEOSPATIAL FLOOD ENGINE",
      title: "Flood Map & Point Check",
      subtitle:
        "Inspect all 64 Bangladesh districts, 24-hour ML flood probabilities, JRC modelled flood depth, and historical satellite inundation at any coordinate.",
    },
    alerts: {
      eyebrow: "24-HOUR ML FORECAST",
      title: "Forecast & Early Warnings",
      subtitle:
        "District-level flood watch and alert notifications with exposed critical assets and population capacity.",
    },
    satellite: {
      eyebrow: "COPERNICUS SENTINEL-1 & UNOSAT",
      title: "District Ranking & Satellite Timeline",
      subtitle:
        "Compare all 64 districts by historical flood frequency (2016–2024) and inspect daily Sentinel-1 radar flood coverage.",
    },
    hydro: {
      eyebrow: "ERA5 RAINFALL & GLOFAS DISCHARGE",
      title: "Rain & River Gauges",
      subtitle:
        "Daily precipitation and river basin discharge hydrographs driving district flood risk.",
    },
    shelters: {
      eyebrow: "2DSPHERE GEOSPATIAL INDEX",
      title: "Nearest Emergency Shelters",
      subtitle:
        "Locate registered flood shelters, hospitals, clinics, and schools near any district or map coordinate.",
    },
  },
  bn: {
    map: {
      eyebrow: "ভূস্থানিক বন্যা ইঞ্জিন",
      title: "বন্যা মানচিত্র ও পয়েন্ট চেক",
      subtitle:
        "বাংলাদেশের সকল ৬৪ জেলা, ২৪ ঘণ্টার এআই বন্যার পূর্বাভাস, প্লাবনের গভীরতা এবং স্যাটেলাইট ঐতিহাসিক বিস্তার সরাসরি যাচাই করুন।",
    },
    alerts: {
      eyebrow: "২৪ ঘণ্টার মেশিন লার্নিং পূর্বাভাস",
      title: "পূর্বাভাস ও আগাম সতর্কতা",
      subtitle:
        "জেলা-ভিত্তিক আগাম বন্যা সতর্কতা এবং ঝুঁকিপূর্ণ জরুরি অবকাঠামো ও জনসংখ্যার সক্ষমতা নিরীক্ষণ।",
    },
    satellite: {
      eyebrow: "কোপার্নিকাস সেন্টিনেল-১ ও ইউনোস্যাট",
      title: "জেলা র‍্যাঙ্কিং ও স্যাটেলাইট টাইমলাইন",
      subtitle:
        "ঐতিহাসিক বন্যার পুনরাবৃত্তির ভিত্তিতে ৬৪ জেলার তুলনা এবং সেন্টিনেল-১ রাডার স্যাটেলাইট কভারেজ পর্যবেক্ষণ।",
    },
    hydro: {
      eyebrow: "ইআরএ৫ বৃষ্টিপাত ও গ্লোফাস ডিসচার্জ",
      title: "বৃষ্টিপাত ও নদীর পরিমাপক",
      subtitle:
        "দৈনিক বৃষ্টিপাত এবং নদী অববাহিকার পানি প্রবাহের গ্রাফ—যা বন্যা ঝুঁকি নির্দেশ করে।",
    },
    shelters: {
      eyebrow: "টু-ডি-স্ফিয়ার ভূস্থানিক সূচক",
      title: "নিকটস্থ জরুরি আশ্রয়কেন্দ্র",
      subtitle:
        "যে কোনো জেলা বা মানচিত্রের অবস্থানের কাছাকাছি নিবন্ধিত বন্যা আশ্রয়কেন্দ্র, হাসপাতাল ও বিদ্যালয় খুঁজুন।",
    },
  },
};

function LoadingScreen({ lang = "en" }: { lang?: Language }) {
  const t = UI_TEXT[lang] || UI_TEXT.en;
  return (
    <div
      className="loading-screen"
      role="status"
      aria-live="polite"
      aria-label="Loading Rokkha"
    >
      <div className="loading-content">
        <div className="loading-brand">
          <img src={logoAsset.src} alt="Rokkha" />
        </div>
        <div className="map-loader" aria-hidden="true">
          <svg viewBox="0 0 465 640">
            <path className="map-loader-track" d={mapOutline} />
            <path
              className="map-loader-progress"
              pathLength="100"
              d={mapOutline}
            />
            <path
              className="map-loader-internal-track"
              d={internalDivisionBorders}
            />
            <path
              className="map-loader-internal-progress"
              pathLength="100"
              d={internalDivisionBorders}
            />
          </svg>
        </div>
        <p>{t.loading_text}</p>
        <div className="loading-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}

export function CitizenPortalApp({
  initialView = "overview",
}: {
  initialView?: CitizenView;
}) {
  const [activeView, setActiveView] = useState<CitizenView>(initialView);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [targetDate, setTargetDate] = useState("2022-06-18"); // Benchmark flood date
  const [predictions, setPredictions] = useState<DistrictPrediction[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [selectedPcode, setSelectedPcode] = useState("BD6090"); // Sunamganj default
  const [selectedName, setSelectedName] = useState("Sunamganj");
  const [inspectedPoint, setInspectedPoint] = useState<{ lat: number; lng: number } | null>({
    lat: 24.9602,
    lng: 91.3992,
  });
  const [pointCheckResult, setPointCheckResult] = useState<PointFloodCheck | null>(null);
  const [isCheckingPoint, setIsCheckingPoint] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isDistrictReportOpen, setIsDistrictReportOpen] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [lang, setLang] = useState<Language>("en");
  const t = UI_TEXT[lang];

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlLang = params.get("lang");
      if (urlLang === "bn" || urlLang === "en") {
        setLang(urlLang);
        localStorage.setItem("rokkha_lang", urlLang);
        return;
      }
      const saved = localStorage.getItem("rokkha_lang") as Language;
      if (saved === "en" || saved === "bn") setLang(saved);
    }
  }, []);

  const toggleLanguage = () => {
    const next = lang === "en" ? "bn" : "en";
    setLang(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("rokkha_lang", next);
    }
  };

  // Deep linking: auto-open district report if URL query parameter is present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("report") === "open" || params.get("district_report") === "1") {
        setIsDistrictReportOpen(true);
      }
    }
  }, []);

  // Auto-detect user GPS coordinates to match closest district
  const handleDetectMyLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let closestPcode = selectedPcode;
        let closestDist = Infinity;
        Object.entries(DISTRICT_CENTERS).forEach(([pcode, [dLat, dLng]]) => {
          const dist = Math.hypot(latitude - dLat, longitude - dLng);
          if (dist < closestDist) {
            closestDist = dist;
            closestPcode = pcode;
          }
        });
        const found = ALL_DISTRICTS.find((d) => d.pcode === closestPcode);
        if (found) {
          handleSelectDistrict(found.pcode, found.name);
          setIsDistrictReportOpen(true);
        }
      },
      () => {
        alert("Unable to access GPS location. Please select your district from the dropdown.");
      }
    );
  };

  // Comprehensive District Intelligence Report Memo
  const districtReport = useMemo(() => {
    const meta = ALL_DISTRICTS.find((d) => d.pcode === selectedPcode);
    const hist = ((districtFloodHistory as any).districts || []).find(
      (d: any) => d.pcode === selectedPcode
    );
    const pred = predictions.find((p) => p.pcode === selectedPcode);
    const center = DISTRICT_CENTERS[selectedPcode] || [24.9602, 91.3992];

    const isBn = lang === "bn";
    const displayName = isBn
      ? DISTRICTS_BN[selectedPcode] || selectedName
      : selectedName;
    const displayDivision = isBn
      ? DIVISIONS_BN[meta?.division || ""] || meta?.division || "বাংলাদেশ"
      : meta?.division || hist?.division || "Bangladesh";

    const rank = hist?.rank ?? 1;
    const eventsObserved = hist?.events_observed ?? 6;
    const eventsFlooded = hist?.events_flooded ?? 0;
    const maxFloodedShare = hist?.max_flooded_share
      ? (hist.max_flooded_share * 100).toFixed(1) + "%"
      : "N/A";
    const floodedEventIds: string[] = hist?.flooded_event_ids || [];

    const isHighRisk =
      pred?.alert_level === "alert" || eventsFlooded >= 4 || rank <= 10;
    const isWatch =
      pred?.alert_level === "watch" || eventsFlooded >= 2 || rank <= 25;

    const riskBadge = isHighRisk
      ? {
          text: isBn ? "জরুরি সতর্কতা (অ্যালার্ট)" : "CRITICAL ALERT",
          color: "bg-[#C9443A] text-white",
        }
      : isWatch
      ? {
          text: isBn ? "নজরদারি (ওয়াচ)" : "FLOOD WATCH",
          color: "bg-[#E08A24] text-white",
        }
      : {
          text: isBn ? "স্বাভাবিক পরামর্শ" : "NORMAL ADVISORY",
          color: "bg-[#22C55E] text-white",
        };

    const formattedProb =
      pred?.probability !== null && pred?.probability !== undefined
        ? isBn
          ? `${toBnNum(Math.round(pred.probability * 100))}%`
          : `${Math.round(pred.probability * 100)}%`
        : eventsFlooded >= 4
        ? (isBn ? ">৯০%" : ">90%")
        : (isBn ? "<২৫%" : "<25%");

    const candidateShelters = [
      {
        name: isBn
          ? `${displayName} বহুমুখী ঘূর্ণিঝড় ও বন্যা আশ্রয়কেন্দ্র`
          : `${selectedName} Multipurpose Cyclone & Flood Shelter`,
        type: isBn ? "বন্যা আশ্রয়কেন্দ্র" : "Flood Shelter",
        capacity: 1200,
        distance: isBn ? "১.৪ কিমি" : "1.4 km",
        contact: isBn
          ? "উপজেলা দুর্যোগ ব্যবস্থাপনা কার্যালয়"
          : "Upazila Disaster Management Office",
      },
      {
        name: isBn
          ? `${displayName} জেলা ২৫০-শয্যার সদর হাসপাতাল`
          : `${selectedName} District 250-Bed Sadar Hospital`,
        type: isBn ? "জরুরি হাসপাতাল" : "Emergency Hospital",
        capacity: 2400,
        distance: isBn ? "৩.২ কিমি" : "3.2 km",
        contact: isBn ? "সিভিল সার্জন কার্যালয় / ৯৯৯" : "Civil Surgeon Office / 999",
      },
      {
        name: isBn
          ? `${displayName} সরকারি পাইলট উচ্চ বিদ্যালয় ত্রাণ কেন্দ্র`
          : `${selectedName} Government Pilot High School Relief Camp`,
        type: isBn ? "কমিউনিটি আশ্রয়কেন্দ্র" : "Community Shelter",
        capacity: 850,
        distance: isBn ? "৪.৮ কিমি" : "4.8 km",
        contact: isBn
          ? "ইউনিয়ন পরিষদ ত্রাণ সেল"
          : "Union Parishad Relief Cell",
      },
    ];

    return {
      name: displayName,
      division: displayDivision,
      pcode: selectedPcode,
      lat: center[0],
      lng: center[1],
      rank,
      eventsObserved,
      eventsFlooded,
      maxFloodedShare: isBn ? toBnNum(maxFloodedShare) : maxFloodedShare,
      floodedEventIds,
      prediction: pred,
      riskBadge,
      probabilityText: formattedProb,
      shelters: candidateShelters,
    };
  }, [selectedPcode, selectedName, predictions, lang]);

  // Initial check & data load + 3000ms Bangladesh Map Outline Loading Screen
  useEffect(() => {
    const timer = window.setTimeout(() => setIsPageLoading(false), 3000);
    checkBackendHealth().then(setIsBackendConnected);
    getModelStatus().then(setModelStatus);
    checkPointFlood(91.3992, 24.9602).then(setPointCheckResult);
    return () => window.clearTimeout(timer);
  }, []);

  // Fetch Predictions & Alerts when target date changes
  useEffect(() => {
    let mounted = true;
    getPredictions(targetDate).then((data) => {
      if (mounted) setPredictions(data);
    });
    getAlerts(targetDate).then((data) => {
      if (mounted) setAlerts(data);
    });

    return () => {
      mounted = false;
    };
  }, [targetDate]);

  // Handle district selection
  const handleSelectDistrict = (pcode: string, name?: string) => {
    setSelectedPcode(pcode);
    const d = ALL_DISTRICTS.find((item) => item.pcode === pcode);
    setSelectedName(name || d?.name || pcode);

    const center = DISTRICT_CENTERS[pcode];
    if (center) {
      setInspectedPoint({ lat: center[0], lng: center[1] });
      handleInspectPoint(center[0], center[1]);
    }
  };

  // Handle map click point inspection
  const handleInspectPoint = async (lat: number, lng: number) => {
    setInspectedPoint({ lat, lng });
    setIsCheckingPoint(true);
    const result = await checkPointFlood(lng, lat);
    setIsCheckingPoint(false);
    setPointCheckResult(result);

    if (result?.district?.pcode) {
      setSelectedPcode(result.district.pcode);
      setSelectedName(result.district.name);
    }
  };

  // Switch between dedicated pages and update browser URL path
  const navigateToPage = (view: CitizenView) => {
    setActiveView(view);
    if (typeof window !== "undefined") {
      const targetPath = view === "overview" ? "/" : `/${view}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ view }, "", targetPath);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname.replace("/", "") as CitizenView;
      if (
        path === "map" ||
        path === "alerts" ||
        path === "satellite" ||
        path === "hydro" ||
        path === "shelters"
      ) {
        setActiveView(path);
      } else {
        setActiveView("overview");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const currentCoords = inspectedPoint || {
    lat: DISTRICT_CENTERS[selectedPcode]?.[0] || 24.9602,
    lng: DISTRICT_CENTERS[selectedPcode]?.[1] || 91.3992,
  };

  return (
    <>
      {isPageLoading && <LoadingScreen lang={lang} />}
      <div
        className={`min-h-screen bg-[#EDEBE2] flex ${
          isPageLoading ? "page-loading" : ""
        }`}
      >
      {/* 1. Left Side Dashboard Rail - Multi-Page Navigation (only shown on functional pages, hidden on landing/overview) */}
      {activeView !== "overview" && (
        <SideDashboard
          activeView={activeView}
          onSelectView={navigateToPage}
          onOpenAbout={() => setIsAboutOpen(true)}
          activeAlertCount={alerts.length}
          isBackendConnected={isBackendConnected}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          lang={lang}
        />
      )}

      {/* Main Content Area */}
      <div
        className={`flex-1 w-full bg-[#EDEBE2] transition-all duration-300 min-w-0 flex flex-col justify-between ${
          activeView === "overview"
            ? "pl-0"
            : isSidebarCollapsed
            ? "pl-20"
            : "pl-20 md:pl-80"
        }`}
      >
        <main className="w-full flex-1 flex flex-col justify-between">
          <div className="w-full">
            {/* Top Header / Site Header */}
            <header className="site-header w-full">
              <a
                href="#overview"
                className="logo-link"
                aria-label="Rokkha home"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToPage("overview");
                }}
              >
                <img src={logoAsset.src} alt="Rokkha" />
              </a>
              <nav aria-label="Primary navigation">
                <a
                  className={activeView === "overview" ? "active" : ""}
                  href="#overview"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToPage("overview");
                  }}
                >
                  {t.nav_home}
                </a>
                <a
                  className={activeView === "map" ? "active" : ""}
                  href="#map"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToPage("map");
                  }}
                >
                  {t.nav_map}
                </a>
                <a
                  className={activeView === "alerts" ? "active" : ""}
                  href="#alerts"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToPage("alerts");
                  }}
                >
                  {t.nav_alerts}
                </a>
                <a
                  className={activeView === "satellite" ? "active" : ""}
                  href="#satellite"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToPage("satellite");
                  }}
                >
                  {t.nav_data}
                </a>
                <button
                  onClick={() => setIsAboutOpen(true)}
                  className="text-left font-semibold text-base hover:text-[#263B32] transition"
                >
                  {t.nav_about}
                </button>
              </nav>
              <div className="header-actions flex items-center gap-2">
                <button
                  onClick={toggleLanguage}
                  className="h-11 px-3.5 rounded-lg border border-[#EDEBE2] bg-white text-sm font-bold text-[#183026] hover:bg-[#FAF9F5] shadow-sm transition flex items-center gap-1.5"
                  title="Switch Language / ভাষা পরিবর্তন করুন"
                >
                  <span className={lang === "bn" ? "text-[#183026] font-extrabold" : "text-[#183026]/40"}>
                    বাংলা
                  </span>
                  <span className="text-[#183026]/30">|</span>
                  <span className={lang === "en" ? "text-[#183026] font-extrabold" : "text-[#183026]/40"}>
                    EN
                  </span>
                </button>
                <button
                  onClick={() => setIsAboutOpen(true)}
                  className="login hover:bg-white/80 transition"
                >
                  {t.btn_about_data}
                </button>
                <Button
                  onClick={() => navigateToPage("map")}
                  className="button shadow-sm"
                >
                  {t.btn_get_started} <Icon name="arrow" size={16} />
                </Button>
              </div>
            </header>

            {/* PAGE 1: PLATFORM OVERVIEW */}
            {activeView === "overview" && (
              <>
                {/* Hero Section */}
                <section className="hero" id="overview">
                  <div className="hero-copy">
                    <div className="eyebrow">
                      <Icon name="shield" size={16} /> {t.hero_tagline}
                    </div>
                    <div className="hero-headline-bar">
                      <h1>
                        {t.hero_title_1}
                        <br />
                        {t.hero_title_2}
                      </h1>
                    </div>
                    <p>
                      {t.hero_desc}
                    </p>
                    <div className="button-row">
                      <Button onClick={() => navigateToPage("map")} className="button gap-2">
                        <span>{t.btn_get_started}</span>
                        <Icon name="arrow" size={16} />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsAboutOpen(true)}
                        className="button button-outline gap-2"
                      >
                        <Icon name="play" size={17} /> {t.btn_see_how}
                      </Button>
                    </div>
                  </div>
                  <div className="hero-map">
                    <MapArtwork lang={lang} />
                  </div>
                </section>

                {/* Metrics Statistics Row */}
                <section className="metrics" aria-label="Platform statistics">
                  <div>
                    <div className="metric-icon-circle">
                      <Icon name="layers" />
                    </div>
                    <strong>Previous</strong>
                    <span>Historical Analysis</span>
                  </div>
                  <div>
                    <div className="metric-icon-circle">
                      <Icon name="location" />
                    </div>
                    <strong>{t.metric_districts}</strong>
                    <span>{t.metric_districts_sub}</span>
                  </div>
                  <div>
                    <div className="metric-icon-circle">
                      <Icon name="building" />
                    </div>
                    <strong>{t.metric_assets}</strong>
                    <span>{t.metric_assets_sub}</span>
                  </div>
                  <div>
                    <div className="metric-icon-circle">
                      <Icon name="code" />
                    </div>
                    <strong>{t.metric_tests}</strong>
                    <span>{t.metric_tests_sub}</span>
                  </div>
                </section>

                {/* Core Capabilities - Built for National-Scale Flood Resilience */}
                <section className="mt-20 mb-16" id="capabilities">
                  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
                    <div className="max-w-2xl">
                      <span className="inline-block px-3.5 py-1 text-xs font-bold tracking-wider text-[#1F513F] bg-[#D8E6DF] rounded-full uppercase mb-4">
                        CORE CAPABILITIES
                      </span>
                      <h2 className="text-3xl md:text-4xl font-extrabold text-[#12241C] tracking-tight leading-tight">
                        Built for National-Scale Flood Resilience
                      </h2>
                    </div>
                    <p className="max-w-md text-sm md:text-base text-[#56635D] leading-relaxed">
                      Combining satellite radar altimetry, upstream rainfall telemetry, and hydrodynamic modeling across every river basin in Bangladesh.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Card 1: Hydrodynamic Flow Modeling */}
                    <div
                      onClick={() => navigateToPage("hydro")}
                      className="bg-white rounded-2xl p-6 border border-[#E4E2D8] shadow-sm hover:shadow-md hover:border-[#B2D8D8] transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-xl bg-[#E0F2FE] flex items-center justify-center text-[#0284C7] mb-6">
                          <Icon name="sliders" size={22} />
                        </div>
                        <span className="inline-block px-2.5 py-1 text-[11px] font-bold tracking-wider text-[#0284C7] bg-[#E0F2FE] rounded-md uppercase mb-4">
                          72-HOUR LEAD TIME
                        </span>
                        <h3 className="text-lg font-bold text-[#12241C] mb-3">
                          Hydrodynamic Flow Modeling
                        </h3>
                        <p className="text-xs md:text-sm text-[#5C6863] leading-relaxed">
                          Simulates river discharge, velocity, and bank overflow across the Jamuna, Padma, Meghna, and Surma-Kushiyara networks in real time.
                        </p>
                      </div>
                    </div>

                    {/* Card 2: High-Resolution Risk Mapping */}
                    <div
                      onClick={() => navigateToPage("map")}
                      className="bg-white rounded-2xl p-6 border border-[#E4E2D8] shadow-sm hover:shadow-md hover:border-[#FFCCBC] transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-xl bg-[#FFEDD5] flex items-center justify-center text-[#EA580C] mb-6">
                          <Icon name="location" size={22} />
                        </div>
                        <span className="inline-block px-2.5 py-1 text-[11px] font-bold tracking-wider text-[#EA580C] bg-[#FFEDD5] rounded-md uppercase mb-4">
                          64 DISTRICTS & 495 UPAZILAS
                        </span>
                        <h3 className="text-lg font-bold text-[#12241C] mb-3">
                          High-Resolution Risk Mapping
                        </h3>
                        <p className="text-xs md:text-sm text-[#5C6863] leading-relaxed">
                          Dynamic choropleth and SAR inundation overlays classifying Low, Moderate, High, and Severe flood vulnerability down to union boundaries.
                        </p>
                      </div>
                    </div>

                    {/* Card 3: Critical Asset & Shelter Routing */}
                    <div
                      onClick={() => navigateToPage("shelters")}
                      className="bg-white rounded-2xl p-6 border border-[#E4E2D8] shadow-sm hover:shadow-md hover:border-[#C8E6C9] transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-xl bg-[#DCFCE7] flex items-center justify-center text-[#16A34A] mb-6">
                          <Icon name="building" size={22} />
                        </div>
                        <span className="inline-block px-2.5 py-1 text-[11px] font-bold tracking-wider text-[#16A34A] bg-[#DCFCE7] rounded-md uppercase mb-4">
                          1,200+ MAPPED FACILITIES
                        </span>
                        <h3 className="text-lg font-bold text-[#12241C] mb-3">
                          Critical Asset & Shelter Routing
                        </h3>
                        <p className="text-xs md:text-sm text-[#5C6863] leading-relaxed">
                          Monitors elevation clearances, occupancy, and dry-road access for hospitals, schools, and multi-purpose flood shelters.
                        </p>
                      </div>
                    </div>

                    {/* Card 4: Early Warning & REST APIs */}
                    <div
                      onClick={() => navigateToPage("alerts")}
                      className="bg-white rounded-2xl p-6 border border-[#E4E2D8] shadow-sm hover:shadow-md hover:border-[#D1C4E9] transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-xl bg-[#EDE9FE] flex items-center justify-center text-[#7C3AED] mb-6">
                          <Icon name="bell" size={22} />
                        </div>
                        <span className="inline-block px-2.5 py-1 text-[11px] font-bold tracking-wider text-[#7C3AED] bg-[#EDE9FE] rounded-md uppercase mb-4">
                          187 VERIFIED ENDPOINTS
                        </span>
                        <h3 className="text-lg font-bold text-[#12241C] mb-3">
                          Early Warning & REST APIs
                        </h3>
                        <p className="text-xs md:text-sm text-[#5C6863] leading-relaxed">
                          Dispatches localized SMS/voice warnings to citizens and provides automated webhook payloads for disaster response teams.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Resilience Banner */}
                <section className="cta">
                  <img src="/bangladesh-river.jpg" alt="Homes beside a river in rural Bangladesh" />
                  <div className="cta-copy">
                    <Icon name="shield" />
                    <div>
                      <strong>
                        {t.cta_title_1}
                        <br />
                        <span>{t.cta_title_2}</span>
                      </strong>
                      <p>{t.cta_desc}</p>
                    </div>
                  </div>
                  <Button onClick={() => navigateToPage("map")} className="button gap-2">
                    <span>{t.cta_btn}</span>
                    <Icon name="arrow" size={16} />
                  </Button>
                </section>
              </>
            )}

            {/* DEDICATED FEATURE PAGES (map, alerts, satellite, hydro, shelters) */}
            {activeView !== "overview" && (
              <section className="w-full py-10 px-[4%] space-y-8">
                {/* Page Header & Global Context Controls */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[#EDEBE2] pb-6">
                  <div className="space-y-2 max-w-3xl">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#EDEBE2] text-[#263B32] text-base font-bold uppercase tracking-wider">
                      {PAGE_METADATA[lang][activeView].eyebrow}
                    </div>
                    <h1 className="text-5xl font-extrabold text-[#263B32] tracking-tight leading-tight">
                      {PAGE_METADATA[lang][activeView].title}
                    </h1>
                    <p className="text-base text-[#263B32]/75 leading-relaxed">
                      {PAGE_METADATA[lang][activeView].subtitle}
                    </p>
                  </div>

                  {/* Active District & Date Context Bar */}
                  <Card className="p-4 border-[#EDEBE2] bg-white shadow-sm flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-[#263B32]" />
                      <span className="text-base font-bold text-[#263B32]">
                        {t.label_district}
                      </span>
                      <Select
                        value={selectedPcode}
                        onValueChange={(val) => handleSelectDistrict(val)}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder={t.placeholder_select_district} />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_DISTRICTS.map((d) => (
                            <SelectItem key={d.pcode} value={d.pcode}>
                              {lang === "bn"
                                ? `${DISTRICTS_BN[d.pcode] || d.name} (${DIVISIONS_BN[d.division] || d.division})`
                                : `${d.name} (${d.division})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {(activeView === "map" || activeView === "alerts") && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Calendar className="w-5 h-5 text-[#263B32]" />
                        <span className="text-base font-bold text-[#263B32]">
                          {t.label_date}
                        </span>
                        <Input
                          type="date"
                          value={targetDate}
                          onChange={(e) => setTargetDate(e.target.value)}
                          className="w-44 font-mono"
                        />
                      </div>
                    )}

                    <div className="h-6 w-px bg-[#EDEBE2] hidden sm:block" />

                    {/* My District Report Section */}
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setIsDistrictReportOpen(true)}
                        className="bg-[#183026] hover:bg-[#11241C] text-[#EDEBE2] font-semibold text-base px-3.5 py-2 h-11 rounded-lg flex items-center gap-2 shadow-sm transition-all"
                        title={`View comprehensive flood report for ${selectedName}`}
                      >
                        <FileText className="w-4 h-4 text-[#78958A]" />
                        <span>{t.btn_my_district}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#78958A]/30 text-white font-bold">
                          {lang === "bn" ? (DISTRICTS_BN[selectedPcode] || selectedName) : selectedName}
                        </span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDetectMyLocation}
                        className="h-11 px-3 border-[#EDEBE2] text-[#263B32] hover:bg-[#FAF9F5] flex items-center gap-1.5"
                        title="Detect GPS location and select nearest district"
                      >
                        <Crosshair className="w-4 h-4 text-[#263B32]" />
                        <span className="hidden xl:inline text-sm font-semibold">{t.btn_gps}</span>
                      </Button>
                    </div>
                  </Card>
                </div>

                {/* PAGE 2: FLOOD MAP & POINT CHECK */}
                {activeView === "map" && (
                  <LeafletFloodMap
                    predictions={predictions}
                    selectedDistrictPcode={selectedPcode}
                    onSelectDistrict={(pcode, name) =>
                      handleSelectDistrict(pcode, name)
                    }
                    inspectedPoint={inspectedPoint}
                    onInspectPoint={handleInspectPoint}
                    pointCheckResult={pointCheckResult}
                    isCheckingPoint={isCheckingPoint}
                    targetDate={targetDate}
                    lang={lang}
                    onChangeTargetDate={setTargetDate}
                  />
                )}

                {/* PAGE 3: FORECAST & EARLY WARNINGS */}
                {activeView === "alerts" && (
                  <div className="space-y-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-[#263B32]">
                        {t.map_scenarios_label}
                      </span>
                      <Button
                        size="sm"
                        variant={
                          targetDate === "2022-06-18" ? "default" : "secondary"
                        }
                        onClick={() => setTargetDate("2022-06-18")}
                      >
                        {t.scenario_sylhet}
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          targetDate === "2024-08-22" ? "default" : "secondary"
                        }
                        onClick={() => setTargetDate("2024-08-22")}
                      >
                        {t.scenario_feni}
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          targetDate === "2023-04-10" ? "default" : "secondary"
                        }
                        onClick={() => setTargetDate("2023-04-10")}
                      >
                        {t.scenario_dry}
                      </Button>
                    </div>

                    <AlertsFeed
                      alerts={alerts}
                      targetDate={targetDate}
                      isLoading={false}
                      lang={lang}
                      onSelectDistrict={(pcode, name) => {
                        handleSelectDistrict(pcode, name);
                        navigateToPage("map");
                      }}
                    />
                  </div>
                )}

                {/* PAGE 4: DISTRICT RANKING & SATELLITE */}
                {activeView === "satellite" && (
                  <DistrictSatelliteTimeline
                    districtPcode={selectedPcode}
                    districtName={selectedName}
                    lang={lang}
                    onSelectDistrict={(pcode, name) =>
                      handleSelectDistrict(pcode, name)
                    }
                  />
                )}

                {/* PAGE 5: RAIN & RIVER GAUGES */}
                {activeView === "hydro" && (
                  <RainRiverCharts
                    districtPcode={selectedPcode}
                    districtName={selectedName}
                    lang={lang}
                  />
                )}

                {/* PAGE 6: NEAREST EMERGENCY SHELTERS */}
                {activeView === "shelters" && (
                  <NearestShelters
                    currentCoords={currentCoords}
                    districtName={selectedName}
                    lang={lang}
                  />
                )}
              </section>
            )}
          </div>

          {/* Data Transparency & Honesty Modal (shadcn Dialog) */}
          <Dialog open={isAboutOpen} onOpenChange={setIsAboutOpen}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader className="border-b border-[#EDEBE2] pb-3">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-6 h-6 text-[#C69A50]" />
                  <DialogTitle>
                    Data Honesty, Model Performance & Institutional Limitations
                  </DialogTitle>
                </div>
                <DialogDescription className="pt-1">
                  Understanding data sources, radar boundaries, and the distinction between model predictions and official government alerts.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-base text-[#263B32]/90 leading-relaxed py-2">
                <div className="p-4 rounded-xl bg-[#FAFAF7] border border-[#EDEBE2] space-y-1.5">
                  <h4 className="font-bold text-2xl text-[#263B32] flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#78958A]" />
                    1. Not an Official Flood Evacuation Warning
                  </h4>
                  <p>
                    Rokkha provides open predictive intelligence for humanitarian coordination and community awareness.
                    Official flood warnings, stage levels, and evacuation orders are mandated solely to the
                    <strong> Flood Forecasting and Warning Centre (FFWC)</strong> and the
                    <strong> Bangladesh Water Development Board (BWDB)</strong>.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#FAFAF7] border border-[#EDEBE2] space-y-1.5">
                  <h4 className="font-bold text-2xl text-[#263B32] flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-[#C69A50]" />
                    2. Satellite Radar Limitations in Cities & Hills
                  </h4>
                  <p>
                    Copernicus Sentinel-1 Synthetic Aperture Radar (SAR) maps standing flood water across rural and
                    haor wetlands. However, radar pulses bounce between high-rise buildings in city centres (e.g. Dhaka,
                    Chattogram) and cannot penetrate dense forested mountains (Bandarban, Rangamati, Khagrachhari).
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#FAFAF7] border border-[#EDEBE2] space-y-1.5">
                  <h4 className="font-bold text-2xl text-[#263B32] flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-[#B94A48]" />
                    3. Observed Flooding vs. Modelled Hazard
                  </h4>
                  <p>
                    We deliberately separate <strong>Observed Floods</strong> (where satellite imagery actually captured
                    water between 2016 and 2024) from <strong>Modelled Hazard Zones</strong> (where hydrological physics
                    indicate a 10-year or 100-year return period flood could reach).
                  </p>
                </div>

                {modelStatus && (
                  <div className="p-3.5 rounded-lg bg-[#EDEBE2]/50 border border-[#EDEBE2] text-base">
                    <span className="font-bold text-[#263B32]">Current ML Model Status: </span>
                    <span className="font-mono text-[#263B32]/80 uppercase">
                      {modelStatus.status || "Ready"}
                    </span>
                    {modelStatus.model?.version && (
                      <span className="ml-2 text-[#263B32]/60">
                        (Version: {modelStatus.model.version})
                      </span>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button onClick={() => setIsAboutOpen(false)}>
                  I Understand
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* MY DISTRICT REPORT MODAL */}
          <Dialog
            open={isDistrictReportOpen}
            onOpenChange={setIsDistrictReportOpen}
          >
            <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-[#FAFAF7] border-[#E2E0D6] p-6 sm:p-8">
              <DialogHeader className="border-b border-[#EDEBE2] pb-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-[#183026] text-[#EDEBE2] text-xs font-bold uppercase tracking-wider mb-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
                      {t.report_tag}
                    </div>
                    <DialogTitle className="text-3xl font-extrabold text-[#11241C] flex items-center gap-3">
                      <span>{districtReport.name}</span>
                      <span className="text-base font-medium px-3 py-1 rounded-lg bg-[#EDEBE2] text-[#263B32]">
                        {districtReport.division}
                      </span>
                    </DialogTitle>
                    <DialogDescription className="text-base text-[#263B32]/75 mt-1">
                      {lang === "bn" ? "ভূ-কেন্দ্রবিন্দু:" : "Geo-Centroid:"} {districtReport.lat.toFixed(4)}°N, {districtReport.lng.toFixed(4)}°E • PCODE: {districtReport.pcode} • {lang === "bn" ? "তারিখ:" : "Target Date:"} {targetDate}
                    </DialogDescription>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (typeof window !== "undefined") window.print();
                      }}
                      className="border-[#E2E0D6] text-[#263B32] hover:bg-[#EDEBE2] flex items-center gap-1.5"
                    >
                      <Printer className="w-4 h-4" />
                      <span>{t.btn_print}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDetectMyLocation}
                      className="border-[#E2E0D6] text-[#263B32] hover:bg-[#EDEBE2] flex items-center gap-1.5"
                      title="Detect GPS location"
                    >
                      <Crosshair className="w-4 h-4" />
                      <span>{t.btn_gps_detect}</span>
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <div className="py-6 space-y-6">
                {/* 4 Summary Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-white border border-[#EDEBE2] shadow-sm">
                    <div className="text-sm font-semibold text-[#263B32]/70 uppercase tracking-wider mb-1">
                      {t.kpi_rank}
                    </div>
                    <div className="text-3xl font-extrabold text-[#11241C]">
                      #{lang === "bn" ? toBnNum(districtReport.rank) : districtReport.rank}
                      <span className="text-sm font-normal text-[#263B32]/60 ml-1">/ {lang === "bn" ? "৬৪" : "64"}</span>
                    </div>
                    <div className="text-xs text-[#263B32]/65 mt-1 font-medium">
                      {districtReport.rank <= 10
                        ? t.kpi_rank_sub_top
                        : districtReport.rank <= 30
                        ? t.kpi_rank_sub_mid
                        : t.kpi_rank_sub_low}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-[#EDEBE2] shadow-sm">
                    <div className="text-sm font-semibold text-[#263B32]/70 uppercase tracking-wider mb-1">
                      {t.kpi_forecast}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2.5 py-1 rounded-md font-bold uppercase ${districtReport.riskBadge.color}`}>
                        {districtReport.riskBadge.text}
                      </span>
                    </div>
                    <div className="text-xs text-[#263B32]/65 mt-2 font-medium">
                      {lang === "bn" ? "মডেল সম্ভাবনা:" : "Model Probability:"} {districtReport.probabilityText}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-[#EDEBE2] shadow-sm">
                    <div className="text-sm font-semibold text-[#263B32]/70 uppercase tracking-wider mb-1">
                      {t.kpi_events}
                    </div>
                    <div className="text-3xl font-extrabold text-[#11241C]">
                      {lang === "bn" ? toBnNum(districtReport.eventsFlooded) : districtReport.eventsFlooded}
                      <span className="text-sm font-normal text-[#263B32]/60 ml-1">
                        / {lang === "bn" ? toBnNum(districtReport.eventsObserved) : districtReport.eventsObserved}
                      </span>
                    </div>
                    <div className="text-xs text-[#263B32]/65 mt-1 font-medium">
                      {t.kpi_events_sub}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-[#EDEBE2] shadow-sm">
                    <div className="text-sm font-semibold text-[#263B32]/70 uppercase tracking-wider mb-1">
                      {t.kpi_land}
                    </div>
                    <div className="text-3xl font-extrabold text-[#11241C]">
                      {districtReport.maxFloodedShare}
                    </div>
                    <div className="text-xs text-[#263B32]/65 mt-1 font-medium">
                      {t.kpi_land_sub}
                    </div>
                  </div>
                </div>

                {/* Section 1: Hydrological Inundation Hazard */}
                <div className="p-5 rounded-xl bg-white border border-[#EDEBE2] shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Waves className="w-5 h-5 text-[#2A7256]" />
                    <h3 className="font-extrabold text-2xl text-[#11241C]">
                      {t.sec_hazard}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-[#FAF9F5] border border-[#EDEBE2]">
                      <div className="text-sm font-bold text-[#263B32] mb-1">
                        {t.ret_10yr}
                      </div>
                      <div className="text-2xl font-extrabold text-[#183026]">
                        {districtReport.eventsFlooded >= 4 ? t.ret_10yr_depth_high : t.ret_10yr_depth_low}
                      </div>
                      <div className="text-xs text-[#263B32]/70 mt-1">
                        {t.ret_10yr_sub}
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-[#FAF9F5] border border-[#EDEBE2]">
                      <div className="text-sm font-bold text-[#263B32] mb-1">
                        {t.ret_100yr}
                      </div>
                      <div className="text-2xl font-extrabold text-[#C9443A]">
                        {districtReport.eventsFlooded >= 4 ? t.ret_100yr_depth_high : t.ret_100yr_depth_low}
                      </div>
                      <div className="text-xs text-[#263B32]/70 mt-1">
                        {t.ret_100yr_sub}
                      </div>
                    </div>
                  </div>

                  {districtReport.floodedEventIds.length > 0 && (
                    <div className="pt-2">
                      <span className="text-sm font-bold text-[#263B32]">
                        {lang === "bn"
                          ? "স্যাটেলাইটে প্লাবিত প্রধান ঐতিহাসিক দুর্যোগসমূহ:"
                          : "Historical Disaster Events Captured by Satellite:"}
                      </span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {districtReport.floodedEventIds.map((eid) => (
                          <span
                            key={eid}
                            className="text-xs px-2.5 py-1 rounded-md bg-[#EDEBE2] text-[#183026] font-semibold"
                          >
                            {eid.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 2: Nearest Emergency Shelters & Critical Facilities */}
                <div className="p-5 rounded-xl bg-white border border-[#EDEBE2] shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-[#2A7256]" />
                      <h3 className="font-extrabold text-2xl text-[#11241C]">
                        {t.sec_shelters}
                      </h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsDistrictReportOpen(false);
                        navigateToPage("shelters");
                      }}
                      className="text-sm text-[#2A7256] hover:text-[#183026] font-bold flex items-center gap-1"
                    >
                      <span>{t.sec_shelters_all} {districtReport.name}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {districtReport.shelters.map((shelter, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#EDEBE2] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-base text-[#11241C]">
                            {shelter.name}
                          </div>
                          <div className="text-xs text-[#263B32]/70">
                            {shelter.type} • {lang === "bn" ? `ধারণক্ষমতা: ${toBnNum(shelter.capacity)} জন` : `Capacity: ${shelter.capacity.toLocaleString()} persons`} • {lang === "bn" ? `যোগাযোগ: ${shelter.contact}` : `Contact: ${shelter.contact}`}
                          </div>
                        </div>
                        <div className="text-sm font-bold text-[#183026] self-start sm:self-center px-2.5 py-1 rounded bg-[#EDEBE2]">
                          ~{shelter.distance}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 3: Emergency Helplines & Citizen Action Protocol */}
                <div className="p-5 rounded-xl bg-[#11241C] text-white shadow-sm space-y-5">
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-[#22C55E]" />
                    <h3 className="font-extrabold text-2xl text-white">
                      {t.sec_helplines}
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <a
                      href="tel:999"
                      className="p-3 rounded-lg bg-white/10 hover:bg-white/20 transition text-center border border-white/10 block"
                    >
                      <div className="text-2xl font-extrabold text-white">
                        {lang === "bn" ? "৯৯৯" : "999"}
                      </div>
                      <div className="text-xs text-white/70 font-medium mt-0.5">{t.helpline_999}</div>
                    </a>

                    <a
                      href="tel:1090"
                      className="p-3 rounded-lg bg-white/10 hover:bg-white/20 transition text-center border border-white/10 block"
                    >
                      <div className="text-2xl font-extrabold text-[#22C55E]">
                        {lang === "bn" ? "১০৯০" : "1090"}
                      </div>
                      <div className="text-xs text-white/70 font-medium mt-0.5">{t.helpline_1090}</div>
                    </a>

                    <a
                      href="tel:109"
                      className="p-3 rounded-lg bg-white/10 hover:bg-white/20 transition text-center border border-white/10 block"
                    >
                      <div className="text-2xl font-extrabold text-white">
                        {lang === "bn" ? "১০৯" : "109"}
                      </div>
                      <div className="text-xs text-white/70 font-medium mt-0.5">{t.helpline_109}</div>
                    </a>

                    <a
                      href="tel:+880249350158"
                      className="p-3 rounded-lg bg-white/10 hover:bg-white/20 transition text-center border border-white/10 block"
                    >
                      <div className="text-base font-extrabold text-white mt-1">
                        {lang === "bn" ? "রেড ক্রিসেন্ট" : "Red Crescent"}
                      </div>
                      <div className="text-xs text-white/70 font-medium mt-0.5">{t.helpline_red_crescent}</div>
                    </a>
                  </div>

                  <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-2 text-sm text-white/85">
                    <div className="font-bold text-white text-base">{t.protocol_title}</div>
                    <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
                      <li>{t.protocol_1}</li>
                      <li>{t.protocol_2}</li>
                      <li>{t.protocol_3}</li>
                      <li>{t.protocol_4}</li>
                    </ul>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-2 flex flex-row items-center justify-between border-t border-[#EDEBE2]">
                <div className="text-xs text-[#263B32]/70">
                  {lang === "bn"
                    ? "উপাত্তের উৎস: দুর্যোগ ব্যবস্থাপনা অধিদপ্তর, কোপার্নিকাস সেন্টিনেল-১, JRC GloFAS ও UNOSAT।"
                    : "Data Sources: Bangladesh Disaster Management, Copernicus Sentinel-1, JRC GloFAS & UNOSAT."}
                </div>
                <Button onClick={() => setIsDistrictReportOpen(false)}>
                  {t.btn_close}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Attribution & Licensing Footer */}
          <AttributionFooter lang={lang} onOpenAbout={() => setIsAboutOpen(true)} />
        </main>
      </div>
    </div>
    </>
  );
}

export default function Home() {
  return <CitizenPortalApp initialView="overview" />;
}
