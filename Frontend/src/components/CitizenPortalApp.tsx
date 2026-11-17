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
  Shield,
  LifeBuoy,
} from "lucide-react";

// Official shadcn/ui primitives
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { PortalAccessPage } from "@/components/PortalAccessPage";
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
  getNearestAssets,
} from "@/services/api";
import { AssetNearResult } from "@/types/api";
import { MyLocationReport } from "@/components/MyLocationReport";
import { SosCenter } from "@/components/SosCenter";
import { RescuePanel } from "@/components/RescuePanel";
import { AdminPanel } from "@/components/AdminPanel";
import { AccountUser, getCurrentUser, logOut } from "@/services/auth";
import { GpsFix, LocationError, accuracyText, readPreciseLocation } from "@/services/location";

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

// Dynamically import focused district map for the details modal
const DistrictDetailMap = dynamic(
  () => import("@/components/DistrictDetailMap").then((mod) => mod.DistrictDetailMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[260px] sm:h-[300px] w-full rounded-2xl bg-[#EDEBE2] flex items-center justify-center text-[#263B32]/60 text-sm font-medium animate-pulse">
        Loading District Map...
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
      className={`map-art ${compact ? "map-art-compact" : ""} relative overflow-hidden flex items-center justify-center`}
      aria-label="Illustrated flood risk map of Bangladesh with real-time river flow"
      role="img"
    >
      {/* Background Soft Radar Aura Circle (Matching Image 2) */}
      <div
        className="absolute inset-0 pointer-events-none flex items-center justify-center z-0"
        aria-hidden="true"
      >
        <div className="w-[88%] h-[88%] rounded-full border border-[#D5D2C5]/50 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-75" />
        <div className="w-[64%] h-[64%] rounded-full border border-[#D5D2C5]/30" />
      </div>

      {/* Base Bangladesh District & River Network Map (Natural, organic river flow without artificial vector overlays) */}
      <img
        src={mapAsset.src}
        alt="Flood risk map of Bangladesh"
        className="w-full h-full object-contain relative z-10 select-none pointer-events-none"
      />

      {/* Flood Risk Level Legend on Bottom-Left (Matching Image 2) */}
      {!compact && (
        <div className="absolute bottom-5 left-5 z-30 bg-white/95 backdrop-blur-sm border border-[#E2E0D6] rounded-2xl p-4 shadow-md min-w-[130px]">
          <div className="font-bold text-xs text-[#1F2937] mb-2.5">
            {lang === "bn" ? "বন্যা ঝুঁকির মাত্রা" : "Flood Risk Level"}
          </div>
          <div className="flex flex-col gap-2 text-xs font-medium text-[#374151]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#5A9E75] inline-block shadow-sm" />
              <span>{lang === "bn" ? "কম (Low)" : "Low"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#F5C242] inline-block shadow-sm" />
              <span>{lang === "bn" ? "মাঝারি (Moderate)" : "Moderate"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#E88C30] inline-block shadow-sm" />
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
    Exclude<CitizenView, "overview" | "login">,
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
    rescue: {
      eyebrow: "RESCUE COORDINATION",
      title: "Requests for Help",
      subtitle:
        "Requests sent with the SOS button, longest-waiting first. For rescuer and admin accounts only.",
    },
    admin: {
      eyebrow: "ADMINISTRATION",
      title: "Roles & Registered Places",
      subtitle:
        "Give accounts the rescuer or admin role, and add or remove registered places. For admin accounts only.",
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
    rescue: {
      eyebrow: "উদ্ধার সমন্বয়",
      title: "সাহায্যের অনুরোধ",
      subtitle:
        "জরুরি সাহায্য বোতাম দিয়ে পাঠানো অনুরোধ; যিনি সবচেয়ে বেশি অপেক্ষা করছেন তিনি আগে। শুধু উদ্ধারকারী ও অ্যাডমিন অ্যাকাউন্টের জন্য।",
    },
    admin: {
      eyebrow: "প্রশাসন",
      title: "ভূমিকা ও নিবন্ধিত স্থান",
      subtitle:
        "অ্যাকাউন্টকে উদ্ধারকারী বা অ্যাডমিনের ভূমিকা দিন, এবং নিবন্ধিত স্থান যোগ করুন বা মুছুন। শুধু অ্যাডমিন অ্যাকাউন্টের জন্য।",
    },
  },
};

function LoadingScreen({ lang = "en" }: { lang?: Language }) {
  const isBn = lang === "bn";
  const loadingText = isBn ? "বন্যা তথ্য প্রস্তুত হচ্ছে" : "Preparing flood intelligence";

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
        <p>{loadingText}</p>
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
  // The date whose forecast has finished loading (null while the first one loads).
  const [forecastLoadedFor, setForecastLoadedFor] = useState<string | null>(null);
  // Places registered in the backend near the selected district (never invented).
  const [reportAssets, setReportAssets] = useState<AssetNearResult[]>([]);
  // The logged-in account (null = guest). Set only from the backend's answers.
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const [selectedPcode, setSelectedPcode] = useState("BD6090"); // Sunamganj default
  const [selectedName, setSelectedName] = useState("Sunamganj");
  const [inspectedPoint, setInspectedPoint] = useState<{ lat: number; lng: number } | null>({
    lat: 24.9602,
    lng: 91.3992,
  });
  const [pointCheckResult, setPointCheckResult] = useState<PointFloodCheck | null>(null);
  const [isCheckingPoint, setIsCheckingPoint] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [aboutLang, setAboutLang] = useState<Language>("en");
  const [isSosOpen, setIsSosOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [landingFeatureTab, setLandingFeatureTab] = useState<"map" | "alerts" | "satellite" | "hydro" | "shelters">("map");
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

  // "GPS": read the user's own position as exactly as the device allows and
  // check THAT point (the backend finds the district it lies in), instead of
  // jumping to the nearest district centre.
  const [gpsState, setGpsState] = useState<
    { kind: "idle" } | { kind: "locating" } | { kind: "found"; fix: GpsFix } | { kind: "error"; message: string }
  >({ kind: "idle" });

  const handleDetectMyLocation = async () => {
    setGpsState({ kind: "locating" });
    try {
      const fix = await readPreciseLocation({ isBn: lang === "bn" });
      setGpsState({ kind: "found", fix });
      await handleInspectPoint(fix.lat, fix.lng);
    } catch (error) {
      setGpsState({
        kind: "error",
        message: error instanceof LocationError ? error.message : String((error as Error)?.message || error),
      });
    }
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
    const shareText = (share: number | null | undefined) =>
      share === null || share === undefined
        ? isBn ? "তথ্য নেই" : "not available"
        : isBn
        ? `${toBnNum((share * 100).toFixed(0))}%`
        : `${(share * 100).toFixed(0)}%`;

    // The badge and the probability come only from the model's prediction for
    // this day. Without one, say so: flood history is not a forecast.
    const hasProbability =
      pred?.probability !== null && pred?.probability !== undefined;
    const riskBadge =
      pred?.alert_level === "alert"
        ? {
            text: isBn ? "জরুরি সতর্কতা (অ্যালার্ট)" : "CRITICAL ALERT",
            color: "bg-[#C9443A] text-white",
          }
        : pred?.alert_level === "watch"
        ? {
            text: isBn ? "নজরদারি (ওয়াচ)" : "FLOOD WATCH",
            color: "bg-[#E08A24] text-white",
          }
        : pred?.alert_level === "none"
        ? {
            text: isBn ? "সতর্কতা সীমার নিচে" : "BELOW ALERT LEVEL",
            color: "bg-[#22C55E] text-white",
          }
        : pred?.status === "unsupported"
        ? {
            text: isBn ? "এই জেলায় পূর্বাভাস সম্ভব নয়" : "NO FORECAST POSSIBLE HERE",
            color: "bg-[#6B7280] text-white",
          }
        : {
            text: isBn ? "এই দিনের পূর্বাভাস নেই" : "NO FORECAST FOR THIS DAY",
            color: "bg-[#6B7280] text-white",
          };

    const formattedProb = hasProbability
      ? (pred!.probability as number) > 0.95
        ? isBn
          ? "৯৫% এর বেশি"
          : "more than 95%"
        : isBn
        ? `${toBnNum(Math.round((pred!.probability as number) * 100))}%`
        : `${Math.round((pred!.probability as number) * 100)}%`
      : isBn
      ? "নেই"
      : "not available";

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
      // Share of the district inside the modelled flood zones (from the backend, via the saved copy).
      hazardShare10: shareText(hist?.hazard_share_10yr),
      hazardShare100: shareText(hist?.hazard_share_100yr),
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
      if (!mounted) return;
      setPredictions(data);
      setForecastLoadedFor(targetDate);
    });
    getAlerts(targetDate).then((data) => {
      if (mounted) setAlerts(data);
    });

    return () => {
      mounted = false;
    };
  }, [targetDate]);

  // Registered places near the selected district's centre, from the backend only.
  useEffect(() => {
    let mounted = true;
    const center = DISTRICT_CENTERS[selectedPcode];
    setReportAssets([]);
    if (!center) return;
    getNearestAssets(center[1], center[0], 50000).then((data) => {
      if (mounted) setReportAssets(data.slice(0, 5));
    });
    return () => {
      mounted = false;
    };
  }, [selectedPcode]);

  // A login kept in this browser from an earlier visit: ask the backend whether it still holds.
  useEffect(() => {
    let mounted = true;
    getCurrentUser()
      .then((user) => {
        if (mounted && user) setAccountUser(user);
      })
      .catch(() => {
        // Backend not reachable: stay a guest; the saved-sample banner explains the rest.
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Once the user's saved place is known, show the report for that exact point
  // (not just its district), unless they already picked a place with GPS.
  const accountPcode = accountUser?.district?.pcode;
  const accountLng = accountUser?.location?.coordinates?.[0];
  const accountLat = accountUser?.location?.coordinates?.[1];
  useEffect(() => {
    if (gpsState.kind === "found") return;
    if (accountLat !== undefined && accountLng !== undefined) {
      handleInspectPoint(accountLat, accountLng);
    } else if (accountPcode) {
      setSelectedPcode(accountPcode);
      const d = ALL_DISTRICTS.find((item) => item.pcode === accountPcode);
      if (d) setSelectedName(d.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountPcode, accountLat, accountLng]);

  const handleLogOut = () => {
    logOut().finally(() => setAccountUser(null));
  };

  // The backend makes one forecast per UTC day (daily update, about 09:30 in Bangladesh).
  const todayUtc = new Date().toISOString().slice(0, 10);

  const isForecastLoading = forecastLoadedFor !== targetDate;
  const hasForecast = predictions.length > 0;

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
  // On a phone the open menu covers the page, so it starts closed there and
  // closes again after a page is picked.
  useEffect(() => {
    if (window.innerWidth < 768) setIsSidebarCollapsed(true);
  }, []);

  const navigateToPage = (view: CitizenView) => {
    setActiveView(view);
    if (typeof window !== "undefined") {
      if (window.innerWidth < 768) setIsSidebarCollapsed(true);
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
        path === "shelters" ||
        path === "rescue" ||
        path === "admin" ||
        path === "login"
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
      {/* 1. Left Side Dashboard Rail - Multi-Page Navigation (only shown on functional pages, hidden on landing/overview and login) */}
      {activeView !== "overview" && activeView !== "login" && (
        <SideDashboard
          activeView={activeView}
          onSelectView={navigateToPage}
          onOpenAbout={() => setIsAboutOpen(true)}
          activeAlertCount={alerts.length}
          isBackendConnected={isBackendConnected}
          role={accountUser?.role || null}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          lang={lang}
        />
      )}

      {/* Main Content Area */}
      <div
        className={`flex-1 w-full max-w-full bg-[#EDEBE2] bg-[url('/topo-pattern.svg')] bg-repeat transition-all duration-300 min-w-0 flex flex-col justify-between overflow-x-hidden ${
          activeView === "overview" || activeView === "login"
            ? "pl-0"
            : isSidebarCollapsed
            ? "pl-16 sm:pl-20"
            : "pl-64 lg:pl-72"
        }`}
      >
        <main className="w-full max-w-full flex-1 flex flex-col justify-between overflow-x-hidden">
          <div className="w-full">
            {/* Top Header / Site Header */}
            <header className="w-full border-b border-[#DFDDD3]/50">
              <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 site-header">
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
                <nav aria-label="Primary navigation" className="flex items-center gap-7 sm:gap-9">
                  <a
                    className={`text-[17px] font-semibold transition pb-1 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 select-none ${
                      activeView === "overview"
                        ? "active text-[#183026] border-b-2 border-[#183026]"
                        : "text-[#263B32]/80 hover:text-[#183026]"
                    }`}
                    href="#overview"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToPage("overview");
                    }}
                  >
                    {t.nav_home}
                  </a>
                  <a
                    className={`text-[17px] font-semibold transition pb-1 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 select-none ${
                      activeView === "map"
                        ? "active text-[#183026] border-b-2 border-[#183026]"
                        : "text-[#263B32]/80 hover:text-[#183026]"
                    }`}
                    href="#map"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToPage("map");
                    }}
                  >
                    {t.nav_map}
                  </a>
                  <a
                    className={`text-[17px] font-semibold transition pb-1 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 select-none ${
                      activeView === "alerts"
                        ? "active text-[#183026] border-b-2 border-[#183026]"
                        : "text-[#263B32]/80 hover:text-[#183026]"
                    }`}
                    href="#alerts"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToPage("alerts");
                    }}
                  >
                    {t.nav_alerts}
                  </a>
                  <a
                    className={`text-[17px] font-semibold transition pb-1 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 select-none ${
                      activeView === "satellite"
                        ? "active text-[#183026] border-b-2 border-[#183026]"
                        : "text-[#263B32]/80 hover:text-[#183026]"
                    }`}
                    href="#satellite"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToPage("satellite");
                    }}
                  >
                    {t.nav_data}
                  </a>
                  <button
                    type="button"
                    onClick={() => setIsAboutOpen(true)}
                    className="text-left font-semibold text-[17px] text-[#263B32]/80 hover:text-[#183026] transition cursor-pointer pb-1 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 select-none"
                  >
                    {t.nav_about}
                  </button>
                </nav>
                <div className="header-actions flex items-center gap-2 sm:gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={toggleLanguage}
                    className="h-11 px-2.5 sm:px-3.5 rounded-xl border border-[#DFDDD3] bg-white text-sm font-bold text-[#183026] hover:bg-[#FAF9F5] shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    title="Switch Language / ভাষা পরিবর্তন করুন"
                  >
                    <span className={lang === "bn" ? "text-[#183026] font-extrabold" : "text-[#183026]/40"}>
                      বাংলা
                    </span>
                    <span className="text-[#183026]/30 font-medium">|</span>
                    <span className={lang === "en" ? "text-[#183026] font-extrabold" : "text-[#183026]/40"}>
                      EN
                    </span>
                  </button>
                  {/* Account: who is logged in, or a way to log in. */}
                  {accountUser ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="hidden sm:flex items-center gap-1.5 h-11 px-3 rounded-xl border border-[#DFDDD3] bg-white text-sm font-bold text-[#183026] max-w-[180px]"
                        title={accountUser.email}
                      >
                        <span className="w-6 h-6 rounded-full bg-[#1F513F] text-white text-xs flex items-center justify-center shrink-0" aria-hidden="true">
                          {(accountUser.name || accountUser.email).trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate">{accountUser.name}</span>
                      </span>
                      <Button
                        onClick={handleLogOut}
                        variant="outline"
                        className="h-11 px-2.5 sm:px-3.5 rounded-xl border-[#DFDDD3] text-[13px] sm:text-sm font-bold text-[#183026] cursor-pointer whitespace-nowrap"
                        aria-label={lang === "bn" ? `লগ আউট (${accountUser.name})` : `Log out (${accountUser.name})`}
                      >
                        {lang === "bn" ? "লগ আউট" : "Log out"}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => navigateToPage("login")}
                      className="button shadow-sm text-[14px] sm:text-[15px] font-bold h-11 px-3 sm:px-5 rounded-xl bg-[#11241C] hover:bg-[#0A1812] text-white flex items-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <span>{lang === "bn" ? "লগ ইন" : "Log in"}</span>
                      <span className="hidden sm:inline-flex"><Icon name="arrow" size={16} /></span>
                    </Button>
                  )}
                </div>
              </div>
            </header>

            {/* PAGE 1: PLATFORM OVERVIEW */}
            {activeView === "overview" && (
              <>
                {/* Hero Section */}
                <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10">
                  <section className="hero" id="overview">
                    <div className="hero-copy">
                      <div className="eyebrow">
                        <Icon name="shield" size={16} /> {t.hero_tagline}
                      </div>
                      <div className="hero-headline-bar">
                        <h1 className="text-[35px] font-extrabold leading-[1.15] tracking-tight text-[#121f17]">
                          {t.hero_title_1}
                          <br />
                          {t.hero_title_2}
                        </h1>
                        <p className="text-xl sm:text-2xl font-bold text-[#11241C] mt-2">
                          {t.hero_subtitle}
                        </p>
                      </div>
                      <p>
                        {t.hero_desc}
                      </p>
                      <div className="button-row flex items-center gap-4">
                        <Button
                          onClick={() => navigateToPage("map")}
                          className="button gap-2 text-[14px] font-bold h-14 px-7 rounded-2xl shadow-sm m-0 cursor-pointer"
                        >
                          <span>{t.btn_get_started}</span>
                          <Icon name="arrow" size={16} />
                        </Button>

                        <button
                          type="button"
                          onClick={() => setIsSosOpen(true)}
                          className="flex items-center gap-3.5 px-6 py-2.5 h-14 rounded-full bg-[linear-gradient(90deg,#3B7E5D_0%,#E9B441_34%,#E67328_67%,#D93829_100%)] hover:opacity-95 text-white shadow-[0_8px_24px_rgba(217,56,41,0.25)] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                          aria-label="Emergency Rescue Request"
                        >
                          <div className="w-9 h-9 rounded-full border-2 border-white/95 flex items-center justify-center shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                            <LifeBuoy className="w-5 h-5 text-white stroke-[2.5]" />
                          </div>
                          <div className="flex flex-col text-left leading-[1.1]">
                            <span className="text-[12px] font-black tracking-wider text-white uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
                              {lang === "bn" ? "জরুরি" : "EMERGENCY"}
                            </span>
                            <span className="text-[12px] font-black tracking-wider text-white uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
                              {lang === "bn" ? "উদ্ধার" : "RESCUE"}
                            </span>
                            <span className="text-[12px] font-black tracking-wider text-white uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
                              {lang === "bn" ? "অনুরোধ" : "REQUEST"}
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>
                    <div className="hero-map">
                      <MapArtwork lang={lang} />
                    </div>
                  </section>
                </div>

                {/* Metrics Statistics Row */}
                <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 mt-6">
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
                </div>


                {/* End-to-End Architecture */}
                <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 my-10 sm:my-14 md:my-16">
                  <section id="architecture">
                    <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
                      <span className="inline-block px-3.5 py-1 text-xs font-bold tracking-wider text-[#1F513F] bg-[#D8E6DF] rounded-full uppercase mb-4">
                        END-TO-END ARCHITECTURE
                      </span>
                      <h2 className="text-3xl md:text-4xl font-extrabold text-[#12241C] tracking-tight leading-tight mb-4">
                        How Rokkha Predicts & Protects
                      </h2>
                      <p className="text-sm md:text-base text-[#56635D] leading-relaxed">
                        The model was tested on years it never saw (2023–2025) against simple baselines, and the backend is checked by 352 automated tests.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Card 01 */}
                      <Card className="bg-white rounded-2xl p-7 border border-[#E4E2D8] shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-6">
                            <div className="w-9 h-9 rounded-full bg-[#11241C] text-white flex items-center justify-center font-bold text-xs tracking-wider">
                              01
                            </div>
                            <Badge variant="outline" className="text-xs font-semibold text-[#526059] bg-[#F4F3ED] border-[#E2E0D6] rounded-md px-2.5 py-1">
                              Data Ingestion
                            </Badge>
                          </div>
                          <h3 className="text-xl font-bold text-[#12241C] mb-3">
                            Rain, Rivers & Satellites
                          </h3>
                          <p className="text-sm text-[#5C6863] leading-relaxed">
                            Collects daily rain (ERA5 and GFS), modelled river flow (GloFAS) and Sentinel-1 satellite flood maps (Copernicus GFM) for all 64 districts.
                          </p>
                        </div>
                      </Card>

                      {/* Card 02 */}
                      <Card className="bg-white rounded-2xl p-7 border border-[#E4E2D8] shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-6">
                            <div className="w-9 h-9 rounded-full bg-[#1F513F] text-white flex items-center justify-center font-bold text-xs tracking-wider">
                              02
                            </div>
                            <Badge variant="outline" className="text-xs font-semibold text-[#0369A1] bg-[#E0F2FE] border-[#BAE6FD] rounded-md px-2.5 py-1">
                              Machine Learning Model
                            </Badge>
                          </div>
                          <h3 className="text-xl font-bold text-[#12241C] mb-3">
                            24-Hour Flood Forecast
                          </h3>
                          <p className="text-sm text-[#5C6863] leading-relaxed">
                            A model trained on 2016–2022 floods gives each district a flood probability for the day. Modelled flood-depth zones (JRC) show long-term risk at any point.
                          </p>
                        </div>
                      </Card>

                      {/* Card 03 */}
                      <Card className="bg-white rounded-2xl p-7 border border-[#E4E2D8] shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-6">
                            <div className="w-9 h-9 rounded-full bg-[#11241C] text-white flex items-center justify-center font-bold text-xs tracking-wider">
                              03
                            </div>
                            <Badge variant="outline" className="text-xs font-semibold text-[#047857] bg-[#DCFCE7] border-[#BBF7D0] rounded-md px-2.5 py-1">
                              Citizens & Rescuers
                            </Badge>
                          </div>
                          <h3 className="text-xl font-bold text-[#12241C] mb-3">
                            Alerts and Help Requests
                          </h3>
                          <p className="text-sm text-[#5C6863] leading-relaxed">
                            Shows district alerts, nearby hospitals and shelters, and a personal location report. The SOS button sends help requests to volunteer rescuers.
                          </p>
                        </div>
                      </Card>
                    </div>
                  </section>
                </div>

                {/* Banner Card: Building a more flood-resilient Bangladesh (Matching Image 2) */}
                <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 my-6 sm:my-8 md:my-10">
                  <div className="bg-white rounded-3xl border border-[#DFDDD3] p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex flex-col sm:flex-row items-center gap-5 w-full md:w-auto">
                      <img
                        src="/bangladesh-river.jpg"
                        alt="Bangladesh flood resilience"
                        className="w-full sm:w-64 h-24 rounded-2xl object-cover shadow-sm"
                      />
                      <div className="space-y-1 text-center sm:text-left">
                        <div className="flex items-center justify-center sm:justify-start gap-1.5 text-base sm:text-lg font-extrabold text-[#11241C]">
                          <Shield size={16} className="text-[#16A34A] shrink-0" />
                          <span>
                            {lang === "bn"
                              ? "বন্যা-সহনশীল বাংলাদেশ বিনির্মাণে"
                              : "Building a more flood-resilient Bangladesh"}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-[#5C6863]">
                          {lang === "bn"
                            ? "উপাত্ত, পূর্বাভাস ও প্রস্তুতি—নিরাপদ জনগোষ্ঠীর লক্ষ্যে একসাথে।"
                            : "Data, prediction, and preparedness—together for safer communities."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* DEDICATED FEATURE PAGES (map, alerts, satellite, hydro, shelters) */}
            {activeView !== "overview" && activeView !== "login" && (
              <section className="w-full max-w-[1360px] mx-auto px-3 sm:px-6 md:px-8 py-2 sm:py-3 space-y-2 sm:space-y-3">
                {/* Page Header & Global Context Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-0.5">
                  <div className="space-y-0.5 max-w-xl">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-[#11241B] tracking-tight leading-tight">
                      {PAGE_METADATA[lang][activeView].title}
                    </h1>
                    <p className="text-xs text-[#4E5C55] leading-relaxed hidden sm:block">
                      {PAGE_METADATA[lang][activeView].subtitle}
                    </p>
                  </div>

                  {/* Active District & Date Context Bar */}
                  <Card className="p-2 border-[#DFDDD3] bg-white rounded-xl shadow-xs flex flex-wrap items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#5C6863]" />
                      <span className="text-xs font-bold text-[#12241C]">
                        {t.label_district}:
                      </span>
                      <Select
                        value={selectedPcode}
                        onValueChange={(val) => handleSelectDistrict(val)}
                      >
                        <SelectTrigger className="h-7.5 w-36 sm:w-44 text-xs font-semibold bg-[#FAF9F5] border-[#DFDDD3] rounded-lg">
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
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#5C6863]" />
                        <span className="text-xs font-bold text-[#12241C]">
                          {t.label_date}:
                        </span>
                        <Input
                          type="date"
                          value={targetDate}
                          onChange={(e) => setTargetDate(e.target.value)}
                          className="h-7.5 w-32 font-mono text-xs bg-[#FAF9F5] border-[#DFDDD3] rounded-lg"
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        onClick={() => setIsDistrictReportOpen(true)}
                        className="bg-[#122B1E] hover:bg-[#0C1F15] text-white font-bold text-xs px-2.5 h-7.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-all"
                        title={`View comprehensive flood report for ${selectedName}`}
                      >
                        <FileText className="w-3 h-3 text-[#4ADE80]" />
                        <span>{t.btn_my_district}</span>
                        <span className="text-[10px] px-1 py-0.5 rounded bg-white/20 text-white font-semibold">
                          {lang === "bn" ? (DISTRICTS_BN[selectedPcode] || selectedName) : selectedName}
                        </span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDetectMyLocation}
                        disabled={gpsState.kind === "locating"}
                        className="h-7.5 px-2 border-[#DFDDD3] text-[#12241C] hover:bg-[#FAF9F5] flex items-center gap-1 text-xs font-semibold rounded-lg"
                        title={lang === "bn" ? "আমার সঠিক অবস্থানের বন্যা তথ্য দেখুন" : "Check the flood report for my exact location"}
                      >
                        <Crosshair className={`w-3 h-3 text-[#12241C] ${gpsState.kind === "locating" ? "animate-spin" : ""}`} />
                        <span>{gpsState.kind === "locating" ? (lang === "bn" ? "খোঁজা হচ্ছে..." : "Locating...") : t.btn_gps}</span>
                      </Button>
                    </div>
                    {gpsState.kind !== "idle" && (
                      <p
                        role="status"
                        aria-live="polite"
                        className={`mt-1.5 text-[11px] leading-snug ${gpsState.kind === "error" ? "text-[#B23A30] font-semibold" : "text-[#4B5563]"}`}
                      >
                        {gpsState.kind === "locating" &&
                          (lang === "bn" ? "আপনার অবস্থান নেওয়া হচ্ছে (কয়েক সেকেন্ড লাগতে পারে)..." : "Reading your location (can take a few seconds)...")}
                        {gpsState.kind === "found" &&
                          (lang === "bn"
                            ? `আপনার অবস্থান: ${toBnNum(gpsState.fix.lat.toFixed(4))}°N, ${toBnNum(gpsState.fix.lng.toFixed(4))}°E ${accuracyText(gpsState.fix, true)}`
                            : `Your location: ${gpsState.fix.lat.toFixed(4)}°N, ${gpsState.fix.lng.toFixed(4)}°E ${accuracyText(gpsState.fix)}`)}
                        {gpsState.kind === "error" && gpsState.message}
                      </p>
                    )}
                  </Card>
                </div>

                {accountUser && activeView === "alerts" && (
                  <MyLocationReport
                    user={accountUser}
                    targetDate={targetDate}
                    lang={lang}
                    onUserChange={setAccountUser}
                    onLoggedOut={() => setAccountUser(null)}
                    onLogOut={handleLogOut}
                  />
                )}

                {activeView === "alerts" &&
                  !isForecastLoading &&
                  !hasForecast && (
                    <div
                      role="status"
                      className="mb-4 rounded-2xl border border-[#DFDDD3] bg-white px-5 py-4 text-sm text-[#12241C]"
                    >
                      <span className="font-extrabold">
                        {lang === "bn"
                          ? `${toBnNum(targetDate)} তারিখের কোনো পূর্বাভাস নেই।`
                          : `No forecast for ${targetDate}.`}
                      </span>{" "}
                      {lang === "bn"
                        ? "এর মানে ঝুঁকি নেই, তা নয়। অন্য তারিখ বেছে নিন।"
                        : "This does not mean there is no risk. Choose another date."}
                    </div>
                  )}

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
                    isForecastLoading={isForecastLoading}
                    userPlace={
                      accountUser?.location
                        ? {
                            lng: accountUser.location.coordinates[0],
                            lat: accountUser.location.coordinates[1],
                            label: accountUser.location_label,
                          }
                        : null
                    }
                    onOpenEmergencyPlan={() => setIsDistrictReportOpen(true)}
                  />
                )}

                {/* PAGE 3: FORECAST & EARLY WARNINGS */}
                {activeView === "alerts" && (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-[#12241C] text-xs">
                        {lang === "bn" ? "পূর্বাভাস দৃশ্যপট:" : "Scenario Timeline:"}
                      </span>
                      <Button
                        size="sm"
                        variant={targetDate === "2022-06-18" ? "default" : "outline"}
                        className={
                          targetDate === "2022-06-18"
                            ? "bg-[#122B1E] hover:bg-[#0C1F15] text-white font-bold h-8 px-3 rounded-lg text-xs shadow-sm"
                            : "bg-white border-[#DFDDD3] text-[#12241C] hover:bg-[#FAF9F5] h-8 px-3 rounded-lg text-xs font-medium shadow-sm"
                        }
                        onClick={() => setTargetDate("2022-06-18")}
                      >
                        {t.scenario_sylhet}
                      </Button>
                      <Button
                        size="sm"
                        variant={targetDate === "2024-08-22" ? "default" : "outline"}
                        className={
                          targetDate === "2024-08-22"
                            ? "bg-[#122B1E] hover:bg-[#0C1F15] text-white font-bold h-8 px-3 rounded-lg text-xs shadow-sm"
                            : "bg-white border-[#DFDDD3] text-[#12241C] hover:bg-[#FAF9F5] h-8 px-3 rounded-lg text-xs font-medium shadow-sm"
                        }
                        onClick={() => setTargetDate("2024-08-22")}
                      >
                        {t.scenario_feni}
                      </Button>
                      <Button
                        size="sm"
                        variant={targetDate === "2023-04-10" ? "default" : "outline"}
                        className={
                          targetDate === "2023-04-10"
                            ? "bg-[#122B1E] hover:bg-[#0C1F15] text-white font-bold h-8 px-3 rounded-lg text-xs shadow-sm"
                            : "bg-white border-[#DFDDD3] text-[#12241C] hover:bg-[#FAF9F5] h-8 px-3 rounded-lg text-xs font-medium shadow-sm"
                        }
                        onClick={() => setTargetDate("2023-04-10")}
                      >
                        {t.scenario_dry}
                      </Button>
                      <Button
                        size="sm"
                        variant={targetDate === todayUtc ? "default" : "outline"}
                        className={
                          targetDate === todayUtc
                            ? "bg-[#122B1E] hover:bg-[#0C1F15] text-white font-bold h-8 px-3 rounded-lg text-xs shadow-sm"
                            : "bg-white border-[#DFDDD3] text-[#12241C] hover:bg-[#FAF9F5] h-8 px-3 rounded-lg text-xs font-medium shadow-sm"
                        }
                        onClick={() => setTargetDate(todayUtc)}
                      >
                        {lang === "bn" ? "আজ" : "Today"}
                      </Button>
                    </div>

                    <AlertsFeed
                      alerts={alerts}
                      targetDate={targetDate}
                      isLoading={isForecastLoading}
                      hasForecast={hasForecast}
                      lang={lang}
                      selectedDistrictPcode={selectedPcode}
                      onSelectDistrict={(pcode, name) => {
                        handleSelectDistrict(pcode, name);
                      }}
                    />

                    {/* Satellite Inundation Timeline & Graph for that district */}
                    <div className="pt-2">
                      <DistrictSatelliteTimeline
                        districtPcode={selectedPcode}
                        districtName={selectedName}
                        lang={lang}
                        onSelectDistrict={(pcode, name) =>
                          handleSelectDistrict(pcode, name)
                        }
                      />
                    </div>
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

                {/* Rescuers: requests for help */}
                {activeView === "rescue" && (
                  <RescuePanel
                    user={accountUser}
                    lang={lang}
                    onOpenLogin={() => navigateToPage("login")}
                  />
                )}

                {/* Admins: roles and registered places */}
                {activeView === "admin" && (
                  <AdminPanel
                    user={accountUser}
                    lang={lang}
                    onOpenLogin={() => navigateToPage("login")}
                    districtPcode={selectedPcode}
                    districtName={selectedName}
                    pickedPoint={inspectedPoint}
                  />
                )}
              </section>
            )}
          </div>

          {/* Data Transparency & Honesty Modal (shadcn Dialog with EN / BN support) */}
          <Dialog open={isAboutOpen} onOpenChange={setIsAboutOpen}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader className="border-b border-[#EDEBE2] pb-3">
                <div className="flex items-center justify-between gap-3 pr-6">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-6 h-6 text-[#C69A50] shrink-0" />
                    <DialogTitle className="text-xl sm:text-2xl font-black text-[#183026]">
                      {aboutLang === "bn"
                        ? "তথ্যের স্বচ্ছতা, মডেলের সক্ষমতা ও প্রাতিষ্ঠানিক সীমাবদ্ধতা"
                        : "Data Honesty, Model Performance & Institutional Limitations"}
                    </DialogTitle>
                  </div>
                  {/* EN | BN Switcher */}
                  <div className="flex items-center shrink-0 bg-[#EDEBE2]/70 p-0.5 rounded-full border border-[#DFDDD3]">
                    <button
                      type="button"
                      onClick={() => setAboutLang("en")}
                      className={`px-2.5 py-0.5 text-xs font-black rounded-full transition-all ${
                        aboutLang === "en"
                          ? "bg-white text-[#183026] shadow-xs border border-[#183026]"
                          : "text-[#5C6863] hover:text-[#183026]"
                      }`}
                    >
                      EN
                    </button>
                    <span className="text-[#A3ADA6] text-[11px] font-bold select-none px-0.5">|</span>
                    <button
                      type="button"
                      onClick={() => setAboutLang("bn")}
                      className={`px-2.5 py-0.5 text-xs font-black rounded-full transition-all ${
                        aboutLang === "bn"
                          ? "bg-white text-[#183026] shadow-xs border border-[#183026]"
                          : "text-[#5C6863] hover:text-[#183026]"
                      }`}
                    >
                      BN
                    </button>
                  </div>
                </div>
                <DialogDescription className="pt-2 text-sm text-[#5C6863]">
                  {aboutLang === "bn"
                    ? "তথ্যের উৎস, স্যাটেলাইট রাডারের সীমাবদ্ধতা এবং সরকারি সতর্কতা ও মডেল পূর্বাভাসের মধ্যকার পার্থক্য জানুন।"
                    : "Understanding data sources, radar boundaries, and the distinction between model predictions and official government alerts."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-base text-[#263B32]/90 leading-relaxed py-2">
                <div className="p-4 rounded-xl bg-[#FAFAF7] border border-[#EDEBE2] space-y-1.5">
                  <h4 className="font-bold text-xl text-[#263B32] flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#78958A] shrink-0" />
                    {aboutLang === "bn"
                      ? "১. এটি কোনো সরকারি বন্যা উচ্ছেদ বা স্থানান্তর সতর্কতা নয়"
                      : "1. Not an Official Flood Evacuation Warning"}
                  </h4>
                  <p>
                    {aboutLang === "bn" ? (
                      <>
                        রক্ষা (Rokkha) মানবিক ত্রাণ সমন্বয় এবং জনসচেতনতা বৃদ্ধির লক্ষ্যে উন্মুক্ত পূর্বাভাসমূলক তথ্য সরবরাহ করে।
                        আনুষ্ঠানিকভাবে বন্যার সতর্কতা জারি, বিপৎসীমা ঘোষণা এবং স্থানান্তর নির্দেশনার একমাত্র এখতিয়ার
                        <strong> বন্যা পূর্বাভাস ও সতর্কীকরণ কেন্দ্র (FFWC)</strong> এবং
                        <strong> বাংলাদেশ পানি উন্নয়ন বোর্ডের (BWDB)</strong>।
                      </>
                    ) : (
                      <>
                        Rokkha provides open predictive intelligence for humanitarian coordination and community awareness.
                        Official flood warnings, stage levels, and evacuation orders are mandated solely to the
                        <strong> Flood Forecasting and Warning Centre (FFWC)</strong> and the
                        <strong> Bangladesh Water Development Board (BWDB)</strong>.
                      </>
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#FAFAF7] border border-[#EDEBE2] space-y-1.5">
                  <h4 className="font-bold text-xl text-[#263B32] flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-[#C69A50] shrink-0" />
                    {aboutLang === "bn"
                      ? "২. শহর ও পাহাড়ি অঞ্চলে স্যাটেলাইট রাডারের সীমাবদ্ধতা"
                      : "2. Satellite Radar Limitations in Cities & Hills"}
                  </h4>
                  <p>
                    {aboutLang === "bn" ? (
                      <>
                        কোপারনিকাস সেন্টিনেল-১ সিন্থেটিক অ্যাপারচার রাডার (SAR) গ্রামীণ ও হাওর অঞ্চলের জমে থাকা বন্যার পানি
                        ম্যাপ করে। তবে বহুতল ভবনের কারণে শহরের কেন্দ্রে (যেমন ঢাকা, চট্টগ্রাম) রাডার সিগন্যাল বাধাগ্রস্ত হয়
                        এবং গভীর বনভূমি ও পাহাড়ি অঞ্চলে (বান্দরবান, রাঙ্গামাটি, খাগড়াছড়ি) প্রবেশ করতে পারে না।
                      </>
                    ) : (
                      <>
                        Copernicus Sentinel-1 Synthetic Aperture Radar (SAR) maps standing flood water across rural and
                        haor wetlands. However, radar pulses bounce between high-rise buildings in city centres (e.g. Dhaka,
                        Chattogram) and cannot penetrate dense forested mountains (Bandarban, Rangamati, Khagrachhari).
                      </>
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#FAFAF7] border border-[#EDEBE2] space-y-1.5">
                  <h4 className="font-bold text-xl text-[#263B32] flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-[#B94A48] shrink-0" />
                    {aboutLang === "bn"
                      ? "৩. বাস্তবে পর্যবেক্ষণকৃত বন্যা বনাম মডেলভিত্তিক ঝুঁকি অঞ্চল"
                      : "3. Observed Flooding vs. Modelled Hazard"}
                  </h4>
                  <p>
                    {aboutLang === "bn" ? (
                      <>
                        আমরা স্যাটেলাইটে বাস্তবে শনাক্তকৃত বন্যা (যেখানে ২০১৬ থেকে ২০২৪ সালের মধ্যে স্যাটেলাইট চিত্রে পানি ধরা পড়েছে)
                        এবং গাণিতিক মডেলভিত্তিক বন্যা ঝুঁকি অঞ্চলকে (যেখানে হাইড্রোলজিক্যাল ফিজিক্স অনুযায়ী ১০ বা ১০০ বছর মেয়াদী বন্যার পানি পৌঁছাতে পারে)
                        সুস্পষ্টভাবে আলাদা রাখি।
                      </>
                    ) : (
                      <>
                        We deliberately separate <strong>Observed Floods</strong> (where satellite imagery actually captured
                        water between 2016 and 2024) from <strong>Modelled Hazard Zones</strong> (where hydrological physics
                        indicate a 10-year or 100-year return period flood could reach).
                      </>
                    )}
                  </p>
                </div>

                {modelStatus && (
                  <div className="p-3.5 rounded-lg bg-[#EDEBE2]/50 border border-[#EDEBE2] text-base">
                    <span className="font-bold text-[#263B32]">
                      {aboutLang === "bn" ? "বর্তমান এআই মডেল অবস্থা: " : "Current ML Model Status: "}
                    </span>
                    <span className="font-mono text-[#263B32]/80 uppercase">
                      {modelStatus.status || "Ready"}
                    </span>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button onClick={() => setIsAboutOpen(false)} className="font-bold">
                  {aboutLang === "bn" ? "আমি বুঝতে পেরেছি" : "I Understand"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* MY DISTRICT REPORT MODAL - Detailed Location Map & Emergency Intelligence */}
          <Dialog
            open={isDistrictReportOpen}
            onOpenChange={setIsDistrictReportOpen}
          >
            <DialogContent className="max-w-xl md:max-w-2xl w-[94vw] sm:w-[90vw] max-h-[84vh] overflow-y-auto bg-[#FAF9F5] border border-[#DFDDD3] rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-2xl space-y-2.5 sm:space-y-3 text-left">
              <DialogHeader className="space-y-0.5 text-center pr-6">
                <DialogTitle className="text-lg sm:text-xl font-bold tracking-wide text-[#8B5E3C]">
                  {districtReport.name} - {lang === "bn" ? "বিস্তারিত বন্যা প্রতিবেদন ও জরুরি পরিকল্পনা" : "Detailed Flood Report & Emergency Plan"}
                </DialogTitle>
                <div className="text-[10px] sm:text-xs text-[#4B5563]">
                  {districtReport.division} {lang === "bn" ? "বিভাগ" : "Division"} • {lang === "bn" ? "জাতীয় র‍্যাংক #" : "National Rank #"}{lang === "bn" ? toBnNum(districtReport.rank) : districtReport.rank} / {lang === "bn" ? "৬৪" : "64"} • {lang === "bn" ? "পূর্বাভাস তারিখ:" : "Forecast Date:"} {lang === "bn" ? toBnNum(targetDate) : targetDate}
                </div>
              </DialogHeader>

              {/* User's Own Flood Place Report (Shown after clicking See Details) */}
              {accountUser && (
                <div className="space-y-1">
                  <MyLocationReport
                    user={accountUser}
                    targetDate={targetDate}
                    lang={lang}
                    onUserChange={setAccountUser}
                    onLoggedOut={() => setAccountUser(null)}
                    onLogOut={handleLogOut}
                  />
                </div>
              )}

              {/* 1. Map of that location */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#183026]">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#C9443A]" />
                    {lang === "bn" ? "এলাকার বিশদ মানচিত্র ও আশ্রয়কেন্দ্র:" : "Location Map & Emergency Shelters:"}
                  </span>
                  <span className="text-[#5C6863] font-mono text-[10px]">
                    {lang === "bn" ? toBnNum(currentCoords.lat.toFixed(4)) : currentCoords.lat.toFixed(4)}°N, {lang === "bn" ? toBnNum(currentCoords.lng.toFixed(4)) : currentCoords.lng.toFixed(4)}°E
                  </span>
                </div>
                <DistrictDetailMap
                  pcode={selectedPcode}
                  districtName={districtReport.name}
                  lat={currentCoords.lat}
                  lng={currentCoords.lng}
                  assets={reportAssets}
                  isBn={lang === "bn"}
                />
              </div>

              {/* 2. Core Metrics 4-Card Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                {/* 1: Risk — the model's level for this district and day, never invented */}
                {(() => {
                  const isBn = lang === "bn";
                  const pred = districtReport.prediction;
                  const level = pred?.status === "predicted" ? pred.alert_level : null;
                  const label =
                    level === "alert" ? (isBn ? "বিপদ" : "Alert")
                    : level === "watch" ? (isBn ? "সতর্কতা" : "Watch")
                    : level === "none" ? (isBn ? "নিম্ন" : "Low")
                    : (isBn ? "নেই" : "No forecast");
                  const color =
                    level === "alert" ? "text-[#C9443A]" : level === "watch" ? "text-[#E08A24]" : level === "none" ? "text-[#475569]" : "text-[#6B7280]";
                  const note =
                    level === "none" ? (isBn ? "কম, তবে শূন্য নয়" : "Low, not zero")
                    : level ? (isBn ? "মডেল পূর্বাভাস" : "Model forecast")
                    : (isBn ? "এই দিনের জন্য নেই" : "None for this day");

                  const point = pointCheckResult?.district?.pcode === selectedPcode ? pointCheckResult : null;
                  const h100 = point?.cell?.hazard?.find((h: any) => h.return_period_years === 100);
                  const depth = !point?.cell
                    ? "—"
                    : point.cell.permanent_water
                    ? (isBn ? "জলাশয়" : "Water body")
                    : h100?.depth_label
                    ? (isBn ? ({ "< 1 m": "১ মি.-এর কম", "1 to 3 m": "১–৩ মি.", "3 to 10 m": "৩–১০ মি.", "> 10 m": "১০ মি.-এর বেশি" } as Record<string, string>)[h100.depth_label] || h100.depth_label : h100.depth_label)
                    : (isBn ? "বাইরে" : "Outside");
                  const depthNote = !point?.cell
                    ? (isBn ? "মানচিত্রে স্থান বাছুন" : "Pick a spot on the map")
                    : h100?.depth_label
                    ? (isBn ? "১০০ বছরের বন্যা, মডেল" : "1-in-100-yr flood, modelled")
                    : point.cell.permanent_water
                    ? (isBn ? "নদী বা স্থায়ী পানি" : "River or permanent water")
                    : (isBn ? "মডেল বন্যা এলাকার বাইরে" : "Outside modelled flood zone");

                  const cardCls = "bg-white rounded-xl border border-[#DFDDD3] p-2 sm:p-2.5 text-center shadow-xs flex flex-col justify-between";
                  return (
                    <>
                      <div className={cardCls}>
                        <span className="text-[10px] sm:text-[11px] font-semibold text-[#5C6863]">{isBn ? "বন্যা ঝুঁকি" : "Flood Risk"}</span>
                        <div className={`text-lg sm:text-xl font-bold my-0.5 ${color}`}>{label}</div>
                        <span className="text-[9px] sm:text-[10px] font-medium text-[#4B5563]">{note}</span>
                      </div>

                      {/* 2: Forecast — the real probability, or "not available" */}
                      <div className={cardCls}>
                        <span className="text-[10px] sm:text-[11px] font-semibold text-[#5C6863]">{isBn ? "বন্যার সম্ভাবনা" : "Chance of flooding"}</span>
                        <div className="text-lg sm:text-xl font-bold text-[#1F513F] my-0.5">{districtReport.probabilityText}</div>
                        <span className="text-[9px] sm:text-[10px] font-medium text-[#1F513F]">{isBn ? "জেলা, এই দিনের" : "District, this day"}</span>
                      </div>

                      {/* 3: Depth — JRC modelled depth at the checked spot */}
                      <div className={cardCls}>
                        <span className="text-[10px] sm:text-[11px] font-semibold text-[#5C6863]">{isBn ? "গভীরতা (এই স্থানে)" : "Depth (this spot)"}</span>
                        <div className="text-lg sm:text-xl font-bold text-[#11241C] my-0.5">{depth}</div>
                        <span className="text-[9px] sm:text-[10px] font-medium text-[#4B5563]">{depthNote}</span>
                      </div>
                    </>
                  );
                })()}

                {/* 4: Rank */}
                <div className="bg-white rounded-xl border border-[#DFDDD3] p-2 sm:p-2.5 text-center shadow-xs flex flex-col justify-between">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-[#5C6863]">
                    {lang === "bn" ? "জাতীয় র‍্যাংক" : "National Rank"}
                  </span>
                  <div className="text-lg sm:text-xl font-bold text-[#11241C] my-0.5">
                    #{lang === "bn" ? toBnNum(districtReport.rank) : districtReport.rank}
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-medium text-[#4B5563]">
                    {lang === "bn" ? "৬৪ জেলার মধ্যে" : "Out of 64"}
                  </span>
                </div>
              </div>

              {/* 3. Active District Alerts & Warnings */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#11241C] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#C9443A]" />
                  {lang === "bn" ? "সক্রিয় সতর্কতা ও আবহাওয়া বার্তা" : "Active Alerts & Weather Warnings"}
                </h4>
                {alerts.filter(a => a.district.pcode === selectedPcode || a.district.division === districtReport.division).length > 0 ? (
                  <div className="space-y-1.5">
                    {alerts.filter(a => a.district.pcode === selectedPcode || a.district.division === districtReport.division).slice(0, 3).map((alert) => (
                      <div
                        key={alert.alert_id}
                        className={`p-2.5 rounded-xl border flex items-start gap-2 text-xs ${
                          alert.level === "alert"
                            ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                            : "bg-[#FFFBEB] border-[#FCD34D] text-[#92400E]"
                        }`}
                      >
                        <span className="font-extrabold uppercase px-1.5 py-0.5 rounded text-[10px] shrink-0 bg-white/70">
                          {alert.level === "alert" ? (lang === "bn" ? "জরুরি অ্যালার্ট" : "ALERT") : (lang === "bn" ? "সতর্কবার্তা" : "WATCH")}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold">{alert.district.name} ({lang === "bn" ? `${toBnNum(Math.round(alert.probability * 100))}% ঝুঁকি` : `${Math.round(alert.probability * 100)}% Risk`})</div>
                          <div className="text-[11px] leading-snug mt-0.5">{alert.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] text-xs flex items-center gap-2 font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#16A34A]"></span>
                    <span>{lang === "bn" ? "এই জেলায় বর্তমানে কোনো চরম লাল সতর্কবার্তা নেই।" : "No extreme red flood alert active for this district currently."}</span>
                  </div>
                )}
              </div>

              {/* 4. Hydrology Hazard Return Periods */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#11241C]">
                  {lang === "bn" ? "দীর্ঘমেয়াদী প্লাবন ঝুঁকি (JRC / GloFAS)" : "LONG-TERM FLOOD RETURN PERIODS"}
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="bg-white rounded-xl border border-[#DFDDD3] p-3 text-center shadow-xs">
                    <div className="text-[11px] font-bold text-[#11241C]">
                      {lang === "bn" ? "১০-বছরের বন্যা চক্র" : "10-Year Flood Cycle"}
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-[#11241C] my-0.5">
                      {districtReport.hazardShare10}
                    </div>
                    <div className="text-[10px] text-[#6B7280]">
                      {lang === "bn" ? "১০ বছরে অন্তত একবার প্লাবিত হওয়ার সম্ভাব্য এলাকা" : "Expected once every 10 years"}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-[#DFDDD3] p-3 text-center shadow-xs">
                    <div className="text-[11px] font-bold text-[#11241C]">
                      {lang === "bn" ? "১০০-বছরের চরম বন্যা" : "100-Year Severe Flood"}
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-[#C9443A] my-0.5">
                      {districtReport.hazardShare100}
                    </div>
                    <div className="text-[10px] text-[#6B7280]">
                      {lang === "bn" ? "শতবর্ষের মহা-প্লাবনের সর্বোচ্চ ঝুঁকি এলাকা" : "Expected once every 100 years"}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Actionable Emergency Evacuation Plan */}
              <div className="space-y-2 bg-white rounded-2xl border border-[#DFDDD3] p-3.5 sm:p-4 shadow-xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#183026] flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#C9443A]" />
                  {lang === "bn" ? "জরুরি উচ্ছেদ ও নিরাপত্তা নির্দেশনা" : "EMERGENCY EVACUATION & ACTION GUIDELINES"}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#263B32] leading-relaxed">
                  <div className="p-2 sm:p-2.5 rounded-xl bg-[#FAF9F5] border border-[#DFDDD3] space-y-0.5">
                    <div className="font-bold text-[#183026] text-[11px]">
                      {lang === "bn" ? "১. আশ্রয়কেন্দ্রে স্থানান্তর:" : "1. Immediate Evacuation:"}
                    </div>
                    <div className="text-[11px]">
                      {lang === "bn"
                        ? "শিশু, বয়োবৃদ্ধ ও গবাদিপশু দ্রুত নিকটবর্তী পাকা আশ্রয়কেন্দ্র বা বন্যা প্রতিরোধী ভবনে সরিয়ে নিন।"
                        : "Move children, elderly, and livestock immediately to the nearest designated elevated shelter."}
                    </div>
                  </div>
                  <div className="p-2 sm:p-2.5 rounded-xl bg-[#FAF9F5] border border-[#DFDDD3] space-y-0.5">
                    <div className="font-bold text-[#183026] text-[11px]">
                      {lang === "bn" ? "২. নিরাপদ পানি ও শুকনো খাবার:" : "2. Safe Water & Provisions:"}
                    </div>
                    <div className="text-[11px]">
                      {lang === "bn"
                        ? "কমপক্ষে ৭২ ঘণ্টার নিরাপদ খাওয়ার পানি, হ্যালোজেন ট্যাবলেট, ওরাল স্যালাইন ও শুকনো খাবার সংরক্ষণ করুন।"
                        : "Secure 72 hours of clean drinking water, purification tablets (Halazone), saline, and dry rations."}
                    </div>
                  </div>
                  <div className="p-2 sm:p-2.5 rounded-xl bg-[#FAF9F5] border border-[#DFDDD3] space-y-0.5">
                    <div className="font-bold text-[#183026] text-[11px]">
                      {lang === "bn" ? "৩. বিদ্যুৎ ও যোগাযোগ ব্যবস্থা:" : "3. Power & Device Safety:"}
                    </div>
                    <div className="text-[11px]">
                      {lang === "bn"
                        ? "পানি ঘরে ঢোকার আগেই মেইন সুইচ বন্ধ করুন। মোবাইল ও পাওয়ারব্যাংক ওয়াটারপ্রুফ পলিথিনে সিল করে রাখুন।"
                        : "Turn off main electrical breakers before water enters. Seal mobile phones and powerbanks in waterproof bags."}
                    </div>
                  </div>
                  <div className="p-2 sm:p-2.5 rounded-xl bg-[#FAF9F5] border border-[#DFDDD3] space-y-0.5">
                    <div className="font-bold text-[#183026] text-[11px]">
                      {lang === "bn" ? "৪. জরুরি হটলাইন নম্বরসমূহ:" : "4. Emergency Helplines:"}
                    </div>
                    <div className="text-[11px]">
                      {lang === "bn"
                        ? "উদ্ধার সহায়তা: ৯৯৯ | দুর্যোগ তথ্য: ১০৯০ | নারী ও শিশু সহায়তা: ১০৯"
                        : "National Rescue: 999 | Flood IVR: 1090 | Women & Child Helpline: 109"}
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Registered Emergency Shelters & Hospitals */}
              {reportAssets.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#11241C]">
                    {lang === "bn" ? "নিকটবর্তী নিবন্ধিত আশ্রয়কেন্দ্র ও চিকিৎসাকেন্দ্র" : "NEARBY REGISTERED SHELTERS & HOSPITALS"}
                  </h4>
                  <div className="space-y-1.5">
                    {reportAssets.map((item) => (
                      <div
                        key={item.asset.id}
                        className="bg-white rounded-xl border border-[#DFDDD3] p-2.5 flex items-center justify-between shadow-xs text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">
                            {item.asset.asset_type.toLowerCase().includes("hospital") || item.asset.asset_type.toLowerCase().includes("clinic") ? "🏥" : "⛺"}
                          </span>
                          <div>
                            <div className="font-bold text-[#11241C] text-[11px]">{item.asset.name}</div>
                            <div className="text-[10px] text-[#5C6863]">{item.asset.asset_type}</div>
                          </div>
                        </div>
                        <div className="font-bold text-[#183026] text-right text-xs">
                          {item.distance_kilometers.toFixed(1)} km {lang === "bn" ? "দূরে" : "away"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. Footer Actions */}
              <div className="pt-1 flex flex-col sm:flex-row items-center gap-2.5">
                <Button
                  onClick={() => {
                    setIsDistrictReportOpen(false);
                    setIsSosOpen(true);
                  }}
                  className="w-full sm:flex-1 h-10 text-[11px] font-black tracking-wider uppercase text-white rounded-xl sm:rounded-2xl shadow-md border-0 cursor-pointer transition-all active:scale-98 flex items-center justify-center gap-1.5 [background:linear-gradient(90deg,#3B7E5D_0%,#E9B441_34%,#E67328_67%,#D93829_100%)] hover:opacity-95"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-white animate-bounce" />
                  <span>{lang === "bn" ? "জরুরি এসওএস উদ্ধার অনুরোধ পাঠান" : "Request Immediate SOS Rescue"}</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsDistrictReportOpen(false)}
                  className="w-full sm:w-auto h-10 px-5 rounded-xl sm:rounded-2xl border-[#DFDDD3] font-bold text-xs text-[#11241C] hover:bg-[#FAF9F5]"
                >
                  {lang === "bn" ? "প্রতিবেদন বন্ধ করুন" : "Close Report"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Bottom Footer Bar matching Image 2 */}
          <AttributionFooter lang={lang} onOpenAbout={() => setIsAboutOpen(true)} />
        </main>
      </div>
      {/* Portal Access Login/Register Modal & Page (Matching User Reference Image) */}
      {activeView !== "login" && !isLoginOpen && (
        <SosCenter
          lang={lang}
          contactName={accountUser?.name || ""}
          isOpen={isSosOpen}
          onOpenChange={setIsSosOpen}
          hideFloatingButton={activeView === "overview"}
          savedPlace={
            accountUser?.location
              ? {
                  lng: accountUser.location.coordinates[0],
                  lat: accountUser.location.coordinates[1],
                  label: accountUser.location_label,
                }
              : null
          }
        />
      )}

      <PortalAccessPage
        isOpen={isLoginOpen || activeView === "login"}
        onClose={() => {
          setIsLoginOpen(false);
          if (activeView === "login") navigateToPage("overview");
        }}
        onLoginSuccess={(user) => {
          if (user) setAccountUser(user);
          setIsLoginOpen(false);
          setIsPageLoading(true);
          window.setTimeout(() => {
            setIsPageLoading(false);
            navigateToPage("map");
          }, 2400);
        }}
        lang={lang}
        onToggleLanguage={toggleLanguage}
      />
    </div>
    </>
  );
}

export default CitizenPortalApp;
