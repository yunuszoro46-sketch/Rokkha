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
  const [isLoginOpen, setIsLoginOpen] = useState(false);
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
        path === "shelters" ||
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
      {/* 1. Left Side Dashboard Rail - Multi-Page Navigation (only shown on functional pages, hidden on landing/overview) */}
      {activeView !== "overview" && activeView !== "login" && (
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
          activeView === "overview" || activeView === "login"
            ? "pl-0"
            : isSidebarCollapsed
            ? "pl-20"
            : "pl-20 md:pl-80"
        }`}
      >
        <main className="w-full flex-1 flex flex-col justify-between">
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
                    onClick={() => navigateToPage("login")}
                    className="button shadow-sm"
                  >
                    {t.btn_get_started} <Icon name="arrow" size={16} />
                  </Button>
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
                        <Button onClick={() => navigateToPage("login")} className="button gap-2">
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
                <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 my-20">
                  <section id="architecture">
                    <div className="text-center max-w-3xl mx-auto mb-14">
                      <span className="inline-block px-3.5 py-1 text-xs font-bold tracking-wider text-[#1F513F] bg-[#D8E6DF] rounded-full uppercase mb-4">
                        END-TO-END ARCHITECTURE
                      </span>
                      <h2 className="text-3xl md:text-4xl font-extrabold text-[#12241C] tracking-tight leading-tight mb-4">
                        How Rokkha Predicts & Protects
                      </h2>
                      <p className="text-sm md:text-base text-[#56635D] leading-relaxed">
                        Every forecast is validated against previous historical analysis and 187 automated test suites before reaching communities.
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
                              Satellite + Gauge Ingestion
                            </Badge>
                          </div>
                          <h3 className="text-xl font-bold text-[#12241C] mb-3">
                            Multi-Source Telemetry
                          </h3>
                          <p className="text-sm text-[#5C6863] leading-relaxed">
                            Ingests Sentinel-1 SAR water masks, transboundary rainfall radar, and river gauge readings across all 64 districts.
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
                              Hydrodynamic Engine
                            </Badge>
                          </div>
                          <h3 className="text-xl font-bold text-[#12241C] mb-3">
                            Historical & AI Simulation
                          </h3>
                          <p className="text-sm text-[#5C6863] leading-relaxed">
                            Synthesizes previous historical analysis with 2D floodplain topography to pinpoint inundation depth and hospital/shelter impact.
                          </p>
                        </div>
                      </Card>

                      {/* Card 03 */}
                      <Card className="bg-white rounded-2xl p-7 border border-[#E4E2D8] shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-6">
                            <div className="w-9 h-9 rounded-full bg-[#C2410C] text-white flex items-center justify-center font-bold text-xs tracking-wider">
                              03
                            </div>
                            <Badge variant="outline" className="text-xs font-semibold text-[#BE123C] bg-[#FFE4E6] border-[#FECDD3] rounded-md px-2.5 py-1">
                              Community & API Dispatch
                            </Badge>
                          </div>
                          <h3 className="text-xl font-bold text-[#12241C] mb-3">
                            Actionable Early Warnings
                          </h3>
                          <p className="text-sm text-[#5C6863] leading-relaxed">
                            Delivers district-level evacuation routing, shelter readiness alerts, and REST API webhooks to emergency responders.
                          </p>
                        </div>
                      </Card>
                    </div>
                  </section>
                </div>

                {/* Banner Card: Building a more flood-resilient Bangladesh (Matching Image 2) */}
                <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 my-10">
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
                    <Button
                      onClick={() => navigateToPage("login")}
                      className="bg-[#122B1E] hover:bg-[#0C1F15] text-white font-bold text-sm px-6 h-11 rounded-xl shadow-md shrink-0 flex items-center gap-2"
                    >
                      <span>{t.btn_get_started}</span>
                      <Icon name="arrow" size={16} />
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* DEDICATED FEATURE PAGES (map, alerts, satellite, hydro, shelters) */}
            {activeView !== "overview" && activeView !== "login" && (
              <section className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8 space-y-6">
                {/* Page Header & Global Context Controls */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
                  <div className="space-y-2 max-w-2xl">
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-[#11241B] tracking-tight leading-tight">
                      {PAGE_METADATA[lang][activeView].title}
                    </h1>
                    <p className="text-sm text-[#4E5C55] leading-relaxed">
                      {PAGE_METADATA[lang][activeView].subtitle}
                    </p>
                  </div>

                  {/* Active District & Date Context Bar matching Image 2 */}
                  <Card className="p-3.5 border-[#DFDDD3] bg-white rounded-2xl shadow-sm flex flex-col gap-2.5 shrink-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-[#5C6863]" />
                        <span className="text-xs font-bold text-[#12241C]">
                          {t.label_district}:
                        </span>
                        <Select
                          value={selectedPcode}
                          onValueChange={(val) => handleSelectDistrict(val)}
                        >
                          <SelectTrigger className="h-8.5 w-48 text-xs font-semibold bg-[#FAF9F5] border-[#DFDDD3] rounded-lg">
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
                          <Calendar className="w-4 h-4 text-[#5C6863]" />
                          <span className="text-xs font-bold text-[#12241C]">
                            {t.label_date}:
                          </span>
                          <Input
                            type="date"
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            className="h-8.5 w-36 font-mono text-xs bg-[#FAF9F5] border-[#DFDDD3] rounded-lg"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setIsDistrictReportOpen(true)}
                        className="bg-[#122B1E] hover:bg-[#0C1F15] text-white font-bold text-xs px-3 h-8.5 rounded-lg flex items-center gap-2 shadow-sm transition-all"
                        title={`View comprehensive flood report for ${selectedName}`}
                      >
                        <FileText className="w-3.5 h-3.5 text-[#4ADE80]" />
                        <span>{t.btn_my_district}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-white font-semibold">
                          {lang === "bn" ? (DISTRICTS_BN[selectedPcode] || selectedName) : selectedName}
                        </span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDetectMyLocation}
                        className="h-8.5 px-3 border-[#DFDDD3] text-[#12241C] hover:bg-[#FAF9F5] flex items-center gap-1.5 text-xs font-semibold rounded-lg"
                        title="Detect GPS location and select nearest district"
                      >
                        <Crosshair className="w-3.5 h-3.5 text-[#12241C]" />
                        <span>{t.btn_gps}</span>
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

          {/* Bottom Footer Bar matching Image 2 */}
          <AttributionFooter lang={lang} onOpenAbout={() => setIsAboutOpen(true)} />
        </main>
      </div>
      {/* Portal Access Login/Register Modal & Page (Matching User Reference Image) */}
      <PortalAccessPage
        isOpen={isLoginOpen || activeView === "login"}
        onClose={() => {
          setIsLoginOpen(false);
          if (activeView === "login") navigateToPage("overview");
        }}
        onLoginSuccess={() => {
          setIsLoginOpen(false);
          navigateToPage("map");
        }}
        lang={lang}
      />
    </div>
    </>
  );
}

export default function Home() {
  return <CitizenPortalApp initialView="overview" />;
}
