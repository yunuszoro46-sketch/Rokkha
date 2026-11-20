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
import type { CitizenView } from "@/components/SideDashboard";
import { NavAction, SiteHeader } from "@/components/site/SiteNavigation";
import type { Need } from "@/services/rescue";
import { HomePage, ForecastState } from "@/components/site/HomePage";
import { ContactDirectory } from "@/components/site/ContactDirectory";
import { useSampleParts } from "@/services/dataSource";
import { AlertsFeed } from "@/components/AlertsFeed";
import { AlertsContext } from "@/components/AlertsContext";
import { AnnouncementsList } from "@/components/AnnouncementsList";
import { usePlaceLabel } from "@/lib/placeName";
import { displayName } from "@/lib/facilities";
import { NearestShelters } from "@/components/NearestShelters";
import { AttributionFooter } from "@/components/AttributionFooter";
import { PortalAccessPage } from "@/components/PortalAccessPage";
import { ALL_DISTRICTS } from "@/lib/districts";
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
  depthLabel,
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
import {
  AccountUser,
  SESSION_ENDED,
  getCurrentUser,
  logOut,
} from "@/services/auth";
import {
  GpsFix,
  LocationError,
  accuracyText,
  readPreciseLocation,
} from "@/services/location";

// Dynamically import Leaflet map for interactive exploration
// Admin Control Centre: staff-only code, loaded only on /admin pages.
const AdminConsole = dynamic(
  () =>
    import("@/components/admin/AdminConsole").then((mod) => mod.AdminConsole),
  {
    ssr: false,
    loading: () => (
      <div className="py-16 text-center text-sm text-rk-muted" role="status">
        Loading the control centre…
      </div>
    ),
  },
);

// Rokkha Intelligence page (charts and long text): loaded only on /intelligence.
const IntelligencePage = dynamic(
  () =>
    import("@/components/intelligence/IntelligencePage").then(
      (mod) => mod.IntelligencePage,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[60vh] w-full flex items-center justify-center text-sm text-rk-muted"
        role="status"
      >
        Loading…
      </div>
    ),
  },
);

// Bangladesh flood-intelligence map (MapLibre, docs/MAPPING_ARCHITECTURE.md). Loaded only on /map.
const FloodMapExplorer = dynamic(
  () =>
    import("@/components/map/FloodMapExplorer").then(
      (mod) => mod.FloodMapExplorer,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[60vh] w-full rounded-2xl border border-rk-line bg-rk-page flex items-center justify-center text-sm text-rk-muted"
        role="status"
      >
        Loading the map…
      </div>
    ),
  },
);

// Dynamically import focused district map for the details modal
const DistrictDetailMap = dynamic(
  () =>
    import("@/components/DistrictDetailMap").then(
      (mod) => mod.DistrictDetailMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[260px] sm:h-[300px] w-full rounded-2xl bg-rk-page flex items-center justify-center text-rk-muted text-sm font-medium animate-pulse">
        Loading District Map...
      </div>
    ),
  },
);

const DISTRICT_CENTERS: Record<string, [number, number]> = (
  benchmarkData as any
).centroids || {
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
  chart: <path d="M4 20V10h4v10M10 20V5h4v15M16 20V13h4v7M2 20h20" />,
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

const getCapabilities = (
  t: any,
): Array<{
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
    targetView: "map",
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
    targetView: "alerts",
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
        <div className="w-[88%] h-[88%] rounded-full border border-rk-line/50 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-75" />
        <div className="w-[64%] h-[64%] rounded-full border border-rk-line/30" />
      </div>

      {/* Base Bangladesh District & River Network Map (Natural, organic river flow without artificial vector overlays) */}
      <img
        src={mapAsset.src}
        alt="Flood risk map of Bangladesh"
        className="w-full h-full object-contain relative z-10 select-none pointer-events-none"
      />

      {/* Flood Risk Level Legend on Bottom-Left (Matching Image 2) */}
      {!compact && (
        <div className="absolute bottom-5 left-5 z-30 bg-white/95 backdrop-blur-sm border border-rk-line rounded-2xl p-4 shadow-md min-w-[130px]">
          <div className="font-bold text-xs text-rk-forest mb-2.5">
            {lang === "bn" ? "বন্যা ঝুঁকির মাত্রা" : "Flood Risk Level"}
          </div>
          <div className="flex flex-col gap-2 text-xs font-medium text-rk-ink">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rk-moss inline-block shadow-sm" />
              <span>{lang === "bn" ? "কম (Low)" : "Low"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rk-warning-accent inline-block shadow-sm" />
              <span>{lang === "bn" ? "মাঝারি (Moderate)" : "Moderate"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rk-warning-accent inline-block shadow-sm" />
              <span>{lang === "bn" ? "বেশি (High)" : "High"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rk-danger-accent inline-block shadow-sm" />
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
      title: "Flood map and Point Check",
      subtitle:
        "Explore the district forecast, observed satellite flooding, river flow, rain and the flood record for any place in Bangladesh.",
    },
    alerts: {
      eyebrow: "24-HOUR ML FORECAST",
      title: "Forecasts and early warnings",
      subtitle:
        "Districts on watch or alert for the chosen day, with the registered facilities in each.",
    },
    satellite: {
      eyebrow: "COPERNICUS SENTINEL-1 & UNOSAT",
      title: "District ranking and satellite timeline",
      subtitle:
        "Compare all 64 districts by historical flood frequency (2016–2024) and inspect daily Sentinel-1 radar flood coverage.",
    },
    hydro: {
      eyebrow: "ERA5 RAINFALL & GLOFAS DISCHARGE",
      title: "Rain and river flow",
      subtitle:
        "Daily rain (ERA5/GFS) and modelled river flow (GloFAS) used as model inputs; not gauge water levels.",
    },
    shelters: {
      eyebrow: "SHELTERS AND FACILITIES",
      title: "Nearest emergency shelters",
      subtitle:
        "Locate registered flood shelters, hospitals, clinics, and schools near any district or map coordinate.",
    },
    rescue: {
      eyebrow: "RESCUE COORDINATION",
      title: "Rescue board",
      subtitle:
        "Requests sent with the SOS button, longest-waiting first. For rescuer and admin accounts only.",
    },
    contacts: {
      eyebrow: "CONTACTS",
      title: "Rescue and relief contacts",
      subtitle: "Verified public numbers for flood help.",
    },
    intelligence: {
      eyebrow: "ROKKHA INTELLIGENCE",
      title: "The data, model and limits behind Rokkha",
      subtitle:
        "How satellite, rain, river and geographic data become district flood forecasts.",
    },
    admin: {
      eyebrow: "ADMINISTRATION",
      title: "Teams, accounts and places",
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
      title: "উদ্ধার বোর্ড",
      subtitle:
        "জরুরি সাহায্য বোতাম দিয়ে পাঠানো অনুরোধ; যিনি সবচেয়ে বেশি অপেক্ষা করছেন তিনি আগে। শুধু উদ্ধারকারী ও অ্যাডমিন অ্যাকাউন্টের জন্য।",
    },
    contacts: {
      eyebrow: "যোগাযোগ",
      title: "উদ্ধার ও ত্রাণের যোগাযোগ",
      subtitle: "বন্যা সহায়তার যাচাই করা সরকারি নম্বর।",
    },
    intelligence: {
      eyebrow: "রক্ষা ইন্টেলিজেন্স",
      title: "রক্ষার পেছনের তথ্য, মডেল ও সীমাবদ্ধতা",
      subtitle:
        "স্যাটেলাইট, বৃষ্টি, নদী ও ভৌগোলিক তথ্য থেকে জেলাভিত্তিক পূর্বাভাস।",
    },
    admin: {
      eyebrow: "প্রশাসন",
      title: "দল, অ্যাকাউন্ট ও স্থান",
      subtitle:
        "অ্যাকাউন্টকে উদ্ধারকারী বা অ্যাডমিনের ভূমিকা দিন, এবং নিবন্ধিত স্থান যোগ করুন বা মুছুন। শুধু অ্যাডমিন অ্যাকাউন্টের জন্য।",
    },
  },
};

function LoadingScreen({ lang = "en" }: { lang?: Language }) {
  const isBn = lang === "bn";
  const loadingText = isBn
    ? "বন্যা তথ্য প্রস্তুত হচ্ছে"
    : "Preparing flood intelligence";

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
  adminSection,
}: {
  initialView?: CitizenView;
  /** Admin Control Centre section from the URL (/admin/<section>). */
  adminSection?: string;
}) {
  const [activeView, setActiveView] = useState<CitizenView>(initialView);
  // No artificial splash: on a help platform nothing may delay the "Request help" button.
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  // Today in Bangladesh, set after the page loads (a value fixed at build time
  // would be an old day). The 2022 Sylhet flood stays one date-pick away.
  const [targetDate, setTargetDate] = useState("");
  useEffect(() => {
    setTargetDate(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(
        new Date(),
      ),
    );
  }, []);
  const [predictions, setPredictions] = useState<DistrictPrediction[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  // The date whose forecast has finished loading (null while the first one loads).
  const [forecastLoadedFor, setForecastLoadedFor] = useState<string | null>(
    null,
  );
  // Places registered in the backend near the selected district (never invented).
  const [reportAssets, setReportAssets] = useState<AssetNearResult[]>([]);
  // The logged-in account (null = guest). Set only from the backend's answers.
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const [selectedPcode, setSelectedPcode] = useState("BD6090"); // Sunamganj default
  const [selectedName, setSelectedName] = useState("Sunamganj");
  // Incremented by "Check a place" (menu or homepage): tells the map to start pick-a-place mode.
  const [mapCheckRequest, setMapCheckRequest] = useState(0);
  const [inspectedPoint, setInspectedPoint] = useState<{
    lat: number;
    lng: number;
  } | null>({
    lat: 24.9602,
    lng: 91.3992,
  });
  // Where the current point came from, so pages can say what distances are measured from.
  const [pointSource, setPointSource] = useState<"district" | "gps" | "saved">(
    "district",
  );
  const [pointCheckResult, setPointCheckResult] =
    useState<PointFloodCheck | null>(null);
  const [isCheckingPoint, setIsCheckingPoint] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [aboutLang, setAboutLang] = useState<Language>("en");
  const [isSosOpen, setIsSosOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [landingFeatureTab, setLandingFeatureTab] = useState<
    "map" | "alerts" | "satellite" | "hydro" | "shelters"
  >("map");
  const [isDistrictReportOpen, setIsDistrictReportOpen] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [lang, setLang] = useState<Language>("en");
  // Screen readers read with the right voice when the language changes.
  useEffect(() => {
    document.documentElement.lang = lang === "bn" ? "bn" : "en";
  }, [lang]);
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
      if (
        params.get("report") === "open" ||
        params.get("district_report") === "1"
      ) {
        setIsDistrictReportOpen(true);
      }
    }
  }, []);

  // "GPS": read the user's own position as exactly as the device allows and
  // check THAT point (the backend finds the district it lies in), instead of
  // jumping to the nearest district centre.
  const [gpsState, setGpsState] = useState<
    | { kind: "idle" }
    | { kind: "locating" }
    | { kind: "found"; fix: GpsFix }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const handleDetectMyLocation = async () => {
    setGpsState({ kind: "locating" });
    try {
      const fix = await readPreciseLocation({ isBn: lang === "bn" });
      setGpsState({ kind: "found", fix });
      await handleInspectPoint(fix.lat, fix.lng, "gps");
    } catch (error) {
      setGpsState({
        kind: "error",
        message:
          error instanceof LocationError
            ? error.message
            : String((error as Error)?.message || error),
      });
    }
  };

  // Comprehensive District Intelligence Report Memo
  const districtReport = useMemo(() => {
    const meta = ALL_DISTRICTS.find((d) => d.pcode === selectedPcode);
    const hist = ((districtFloodHistory as any).districts || []).find(
      (d: any) => d.pcode === selectedPcode,
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
        ? isBn
          ? "তথ্য নেই"
          : "not available"
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
            text: isBn ? "সতর্কতা" : "ALERT",
            color: "bg-rk-danger text-white",
          }
        : pred?.alert_level === "watch"
          ? {
              text: isBn ? "নজরদারি" : "WATCH",
              color: "bg-rk-warning-accent text-white",
            }
          : pred?.alert_level === "none"
            ? {
                text: isBn ? "কম সম্ভাবনা" : "LOW CHANCE",
                color: "bg-rk-risk-low text-rk-forest",
              }
            : pred?.status === "unsupported"
              ? {
                  text: isBn
                    ? "এই জেলায় পূর্বাভাস সম্ভব নয়"
                    : "NO FORECAST POSSIBLE HERE",
                  color: "bg-rk-muted text-white",
                }
              : {
                  text: isBn
                    ? "এই দিনের পূর্বাভাস নেই"
                    : "NO FORECAST FOR THIS DAY",
                  color: "bg-rk-muted text-white",
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
    const timer = window.setTimeout(() => setIsPageLoading(false), 0);
    checkBackendHealth().then(setIsBackendConnected);
    getModelStatus().then(setModelStatus);
    checkPointFlood(91.3992, 24.9602).then(setPointCheckResult);
    return () => window.clearTimeout(timer);
  }, []);

  // Fetch Predictions & Alerts when target date changes
  useEffect(() => {
    if (!targetDate) return;
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
      handleInspectPoint(accountLat, accountLng, "saved");
    } else if (accountPcode) {
      setSelectedPcode(accountPcode);
      const d = ALL_DISTRICTS.find((item) => item.pcode === accountPcode);
      if (d) setSelectedName(d.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountPcode, accountLat, accountLng]);

  // The navbar shows who is logged in only while the server still accepts that login: a 401
  // anywhere (expired, suspended, logged out elsewhere) logs the page out; coming back to the tab
  // re-reads the account so a role change by an admin shows without a reload.
  useEffect(() => {
    const ended = () => setAccountUser(null);
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      getCurrentUser()
        .then((user) => setAccountUser(user))
        .catch(() => {
          // offline: keep what is shown
        });
    };
    window.addEventListener(SESSION_ENDED, ended);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener(SESSION_ENDED, ended);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

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
      handleInspectPoint(center[0], center[1], "district");
    }
  };

  // Handle map click point inspection
  const handleInspectPoint = async (
    lat: number,
    lng: number,
    source: "district" | "gps" | "saved",
  ) => {
    setInspectedPoint({ lat, lng });
    setPointSource(source);
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

  const sampleParts = useSampleParts();
  const homeForecastState: ForecastState =
    !targetDate || isForecastLoading
      ? "loading"
      : sampleParts.includes("predictions")
        ? "unavailable"
        : predictions.length === 0
          ? "none"
          : "ready";

  // What a navigation item does (components/site/SiteNavigation.tsx).
  const [sosPreset, setSosPreset] = useState<Need[] | undefined>(undefined);
  const handleNavAction = (action: NavAction) => {
    if (action.kind === "view") navigateToPage(action.view);
    else if (action.kind === "check") {
      // The map opens in "pick a place" mode: the next tap (or GPS, or search) checks that exact spot.
      setMapCheckRequest((n) => n + 1);
      navigateToPage("map");
    } else if (action.kind === "help") {
      setSosPreset(action.needs);
      setIsSosOpen(true);
    } else if (action.kind === "track") {
      setSosPreset(undefined);
      setIsSosOpen(true);
    } else if (action.kind === "about") setIsAboutOpen(true);
    else if (action.kind === "external")
      window.open(action.href, "_blank", "noopener,noreferrer");
    else if (action.kind === "anchor") {
      // Go to the page first (it scrolls to the top), then jump to the section once it is drawn.
      if (activeView !== action.view) navigateToPage(action.view);
      window.setTimeout(
        () =>
          document
            .getElementById(action.id)
            ?.scrollIntoView({ block: "start" }),
        700,
      );
    }
  };

  const navigateToPage = (view: CitizenView) => {
    setActiveView(view);
    // Logged in: confirm the login is still valid on each page change, so a suspension, expiry or
    // role change made elsewhere shows at the next click (a 401 logs this page out).
    if (accountUser) {
      getCurrentUser()
        .then((user) => setAccountUser(user))
        .catch(() => {
          // offline: keep what is shown
        });
    }
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
      // /admin/<section> belongs to the admin view (the console reads the section itself).
      const path = window.location.pathname
        .replace("/", "")
        .split("/")[0] as CitizenView;
      if (
        path === "map" ||
        path === "alerts" ||
        path === "satellite" ||
        path === "hydro" ||
        path === "shelters" ||
        path === "rescue" ||
        path === "admin" ||
        path === "contacts" ||
        path === "intelligence" ||
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
  // A readable name for that point (never shown as latitude / longitude to citizens).
  const currentPlace = usePlaceLabel(
    currentCoords,
    lang === "bn" ? "bn" : "en",
  );

  return (
    <>
      {isPageLoading && <LoadingScreen lang={lang} />}
      <div
        className={`min-h-screen bg-rk-page flex ${
          isPageLoading ? "page-loading" : ""
        }`}
      >
        {/* Main Content Area */}
        <div
          className={`flex-1 w-full max-w-full bg-rk-page min-w-0 flex flex-col justify-between overflow-x-hidden ${""}`}
        >
          <main className="w-full max-w-full flex-1 flex flex-col justify-between overflow-x-hidden">
            <div className="w-full">
              {/* Says when any part of the page shows the saved sample instead of live data. */}

              <SiteHeader
                lang={lang}
                activeView={activeView}
                user={accountUser}
                logoSrc={logoAsset.src}
                onAction={handleNavAction}
                onToggleLanguage={toggleLanguage}
                onLogOut={handleLogOut}
              />

              {/* PAGE 1: PUBLIC HOMEPAGE (citizens first; no engineering facts) */}
              {activeView === "overview" && (
                <HomePage
                  lang={lang}
                  targetDate={targetDate}
                  forecastState={homeForecastState}
                  issuedAt={
                    predictions.find((p) => p.issued_at)?.issued_at || null
                  }
                  alerts={alerts}
                  isStaff={
                    accountUser?.role === "rescuer" ||
                    accountUser?.role === "admin"
                  }
                  onAction={handleNavAction}
                />
              )}

              {/* DEDICATED FEATURE PAGES (map, alerts, satellite, hydro, shelters) */}
              {/* Rokkha Intelligence: full-width page */}
              {activeView === "intelligence" && (
                <IntelligencePage lang={lang} onAction={handleNavAction} />
              )}

              {activeView !== "overview" &&
                activeView !== "login" &&
                activeView !== "intelligence" && (
                  <section className="w-full max-w-[1360px] mx-auto px-3 sm:px-6 md:px-8 py-2 sm:py-3 space-y-2 sm:space-y-3">
                    {/* Page Header & Global Context Controls (hidden on Forecast & Early Warnings to avoid duplicate titles with the section header) */}
                    {activeView === "shelters" && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-0.5">
                        <div className="max-w-xl">
                          <h1 className="text-xl sm:text-2xl font-extrabold text-rk-ink tracking-tight leading-tight">
                            {PAGE_METADATA[lang][activeView].title}
                          </h1>
                        </div>

                        <Card className="p-2 border-rk-line bg-white rounded-xl shadow-xs flex flex-wrap items-center gap-2 sm:shrink-0">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0 sm:flex-none">
                            <MapPin
                              className="w-4 h-4 text-rk-muted shrink-0"
                              aria-hidden="true"
                            />
                            <span className="text-sm font-semibold text-rk-ink shrink-0">
                              {t.label_district}
                            </span>
                            <Select
                              value={selectedPcode}
                              onValueChange={(val) => handleSelectDistrict(val)}
                            >
                              <SelectTrigger
                                aria-label={t.label_district}
                                className="h-10 w-full min-w-0 sm:w-56 text-sm font-semibold bg-rk-page border-rk-line rounded-lg"
                              >
                                <SelectValue
                                  placeholder={t.placeholder_select_district}
                                />
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

                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                              onClick={() => setIsDistrictReportOpen(true)}
                              className="bg-rk-brand hover:bg-rk-brand-strong text-white font-semibold text-sm px-3 h-10 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
                              title={`View comprehensive flood report for ${selectedName}`}
                            >
                              <FileText
                                className="w-4 h-4 text-rk-mist"
                                aria-hidden="true"
                              />
                              <span>{t.btn_my_district}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-black/25 text-white font-semibold">
                                {lang === "bn"
                                  ? DISTRICTS_BN[selectedPcode] || selectedName
                                  : selectedName}
                              </span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleDetectMyLocation}
                              disabled={gpsState.kind === "locating"}
                              className="h-10 px-3 border-rk-line text-rk-ink hover:bg-rk-page flex items-center gap-1.5 text-sm font-semibold rounded-lg"
                              title={
                                lang === "bn"
                                  ? "আমার সঠিক অবস্থানের বন্যা তথ্য দেখুন"
                                  : "Check the flood report for my exact location"
                              }
                            >
                              <Crosshair
                                aria-hidden="true"
                                className={`w-4 h-4 text-rk-ink ${gpsState.kind === "locating" ? "motion-safe:animate-spin" : ""}`}
                              />
                              <span>
                                {gpsState.kind === "locating"
                                  ? lang === "bn"
                                    ? "খোঁজা হচ্ছে..."
                                    : "Locating..."
                                  : t.btn_gps}
                              </span>
                            </Button>
                          </div>
                          {gpsState.kind !== "idle" && (
                            <p
                              role="status"
                              aria-live="polite"
                              title={
                                gpsState.kind === "error"
                                  ? gpsState.message
                                  : undefined
                              }
                              className={`text-[11px] leading-snug whitespace-nowrap truncate max-w-[220px] ${gpsState.kind === "error" ? "text-rk-danger font-semibold" : "text-rk-muted"}`}
                            >
                              {gpsState.kind === "locating" &&
                                (lang === "bn"
                                  ? "অবস্থান খোঁজা হচ্ছে..."
                                  : "Locating...")}
                              {gpsState.kind === "found" &&
                                (lang === "bn"
                                  ? `আপনার অবস্থান: ${currentPlace || "নাম খোঁজা হচ্ছে…"}`
                                  : `Your location: ${currentPlace || "finding the place name…"}`)}
                              {gpsState.kind === "error" && gpsState.message}
                            </p>
                          )}
                        </Card>
                      </div>
                    )}

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

                    {/* PAGE 2: FLOOD MAP & POINT CHECK */}
                    {activeView === "map" && (
                      <FloodMapExplorer
                        lang={lang}
                        targetDate={targetDate}
                        onChangeTargetDate={setTargetDate}
                        checkRequest={mapCheckRequest}
                        predictions={predictions}
                        isForecastLoading={isForecastLoading}
                        onOpenDistrictReport={(pcode, name) => {
                          handleSelectDistrict(pcode, name);
                          setIsDistrictReportOpen(true);
                        }}
                      />
                    )}

                    {/* PAGE 3: FORECAST & EARLY WARNINGS */}
                    {activeView === "alerts" && (
                      <div className="space-y-5">
                        <AnnouncementsList lang={lang} />
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
                          onChangeTargetDate={setTargetDate}
                        />
                        <AlertsContext
                          lang={lang}
                          predictions={predictions}
                          isLoading={isForecastLoading}
                          sample={sampleParts.includes("predictions")}
                          onNavigate={(view) => navigateToPage(view)}
                        />
                      </div>
                    )}

                    {/* PAGE 4: NEAREST EMERGENCY SHELTERS */}
                    {activeView === "shelters" && (
                      <NearestShelters
                        currentCoords={currentCoords}
                        origin={{ source: pointSource, place: currentPlace }}
                        onUseMyLocation={handleDetectMyLocation}
                        locating={gpsState.kind === "locating"}
                        districtName={selectedName}
                        lang={lang}
                      />
                    )}

                    {/* Verified rescue and relief contacts (citizens). */}
                    {activeView === "contacts" && (
                      <div className="py-4">
                        <ContactDirectory lang={lang} headingLevel="h1" />
                      </div>
                    )}

                    {/* Staff pages: their own title, no citizen controls. */}
                    {activeView === "rescue" && (
                      <h1 className="pt-2 text-2xl sm:text-[28px] font-extrabold text-rk-ink tracking-tight">
                        {PAGE_METADATA[lang][activeView].title}
                      </h1>
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
                      <AdminConsole
                        user={accountUser}
                        lang={lang}
                        initialSection={adminSection}
                        onOpenLogin={() => navigateToPage("login")}
                        placesProps={{
                          districtPcode: selectedPcode,
                          districtName: selectedName,
                          pickedPoint: inspectedPoint,
                        }}
                      />
                    )}
                  </section>
                )}
            </div>

            {/* Data Transparency & Honesty Modal (shadcn Dialog with EN / BN support) */}
            {/* Short entry point; the full explanation lives on /intelligence (one source of truth). */}
            <Dialog open={isAboutOpen} onOpenChange={setIsAboutOpen}>
              <DialogContent className="max-w-lg rounded-2xl border-rk-line bg-rk-surface p-6">
                <DialogHeader>
                  <div className="flex items-center justify-between gap-2">
                    <DialogTitle className="text-xl font-extrabold text-rk-forest">
                      {aboutLang === "bn"
                        ? "রক্ষার তথ্য ও মডেল কীভাবে কাজ করে"
                        : "How Rokkha's intelligence works"}
                    </DialogTitle>
                    <div className="flex items-center gap-1 rounded-full border border-rk-line px-1 py-0.5 text-xs font-bold">
                      {(["en", "bn"] as const).map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setAboutLang(l)}
                          aria-pressed={aboutLang === l}
                          className={`rounded-full px-2 py-0.5 ${aboutLang === l ? "bg-rk-brand-soft text-rk-brand-strong" : "text-rk-muted"}`}
                        >
                          {l === "en" ? "EN" : "BN"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <DialogDescription className="text-[14.5px] text-rk-ink">
                    {aboutLang === "bn"
                      ? "রক্ষার পূর্বাভাসের পেছনের তথ্য, মডেল, পদ্ধতি, পরীক্ষার ফলাফল ও সীমাবদ্ধতা দেখুন।"
                      : "Explore the data, models, methodology, measured results and limitations behind Rokkha's flood intelligence."}
                  </DialogDescription>
                </DialogHeader>
                <ul className="space-y-2 text-[14px] text-rk-ink">
                  <li className="flex gap-2">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-rk-brand"
                      aria-hidden="true"
                    />
                    {aboutLang === "bn"
                      ? "সরকারি সতর্কবার্তা নয়: সতর্কবার্তা ও বিপদসীমা দেয় FFWC (BWDB)।"
                      : "Not an official warning: warnings and danger levels come from FFWC (BWDB)."}
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-rk-brand"
                      aria-hidden="true"
                    />
                    {aboutLang === "bn"
                      ? "পর্যবেক্ষিত বন্যা ও মডেলের ঝুঁকি-এলাকা আলাদা রাখা হয়।"
                      : "Observed flooding and modelled hazard are kept apart."}
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-rk-brand"
                      aria-hidden="true"
                    />
                    {aboutLang === "bn"
                      ? "রাডার শহর, ঘন বন ও খাড়া পাহাড়ে ভালো দেখে না; ৮টি জেলায় পূর্বাভাস নেই।"
                      : "Radar sees poorly in cities, dense forest and steep hills; 8 districts have no forecast."}
                  </li>
                </ul>
                {modelStatus && (
                  <p className="font-mono text-[12px] text-rk-muted">
                    {aboutLang === "bn" ? "মডেলের অবস্থা: " : "Model status: "}
                    {modelStatus.status}
                  </p>
                )}
                <DialogFooter className="gap-2 sm:gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsAboutOpen(false)}
                    className="rounded-xl border-rk-line"
                  >
                    {aboutLang === "bn" ? "বন্ধ করুন" : "Close"}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsAboutOpen(false);
                      navigateToPage("intelligence");
                    }}
                    className="rounded-xl bg-rk-brand font-bold text-white hover:bg-rk-brand-strong"
                  >
                    {aboutLang === "bn"
                      ? "পুরো ব্যাখ্যা দেখুন"
                      : "Explore the Intelligence System"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* MY DISTRICT REPORT MODAL - Detailed Location Map & Emergency Intelligence */}
            <Dialog
              open={isDistrictReportOpen}
              onOpenChange={setIsDistrictReportOpen}
            >
              <DialogContent className="max-w-xl md:max-w-2xl w-[94vw] sm:w-[90vw] max-h-[84vh] overflow-y-auto bg-rk-page border border-rk-line rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-2xl space-y-2.5 sm:space-y-3 text-left">
                <DialogHeader className="space-y-0.5 text-center pr-6">
                  <DialogTitle className="text-lg sm:text-xl font-bold tracking-wide text-rk-clay-text">
                    {districtReport.name} -{" "}
                    {lang === "bn"
                      ? "বিস্তারিত বন্যা প্রতিবেদন ও জরুরি পরিকল্পনা"
                      : "Detailed Flood Report & Emergency Plan"}
                  </DialogTitle>
                  <div className="text-[10px] sm:text-xs text-rk-muted">
                    {districtReport.division}{" "}
                    {lang === "bn" ? "বিভাগ" : "Division"} •{" "}
                    {lang === "bn" ? "জাতীয় র‍্যাংক #" : "National Rank #"}
                    {lang === "bn"
                      ? toBnNum(districtReport.rank)
                      : districtReport.rank}{" "}
                    / {lang === "bn" ? "৬৪" : "64"} •{" "}
                    {lang === "bn" ? "পূর্বাভাস তারিখ:" : "Forecast Date:"}{" "}
                    {lang === "bn" ? toBnNum(targetDate) : targetDate}
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
                  <div className="flex items-center justify-between text-[11px] font-bold text-rk-brand">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-rk-danger" />
                      {lang === "bn"
                        ? "এলাকার মানচিত্র ও আশ্রয়কেন্দ্র"
                        : "Area map and shelters"}
                    </span>
                    <span className="text-rk-muted text-[11px] font-semibold">
                      {currentPlace ||
                        (lang === "bn"
                          ? DISTRICTS_BN[selectedPcode] || selectedName
                          : selectedName)}
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
                  {reportAssets.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[11px] font-semibold text-rk-muted">
                        {lang === "bn"
                          ? "মানচিত্রের স্থানগুলো (কাছের থেকে দূরে, OpenStreetMap; সরেজমিনে যাচাই করা নয়):"
                          : "Places on the map (nearest first, OpenStreetMap; not checked on the ground):"}
                      </p>
                      <ol className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-rk-ink sm:grid-cols-2">
                        {reportAssets.slice(0, 8).map((a) => (
                          <li
                            key={a.asset.id}
                            className="flex justify-between gap-2"
                          >
                            <span className="truncate">
                              {displayName(a.asset.name)}
                            </span>
                            <span className="shrink-0 font-mono text-rk-muted">
                              {lang === "bn"
                                ? `${toBnNum(a.distance_kilometers.toFixed(1))} কিমি`
                                : `${a.distance_kilometers.toFixed(1)} km`}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>

                {/* 2. Core Metrics 3-Card Grid */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  {/* 1: Risk — the model's level for this district and day, never invented */}
                  {(() => {
                    const isBn = lang === "bn";
                    const pred = districtReport.prediction;
                    const level =
                      pred?.status === "predicted" ? pred.alert_level : null;
                    const label =
                      level === "alert"
                        ? isBn
                          ? "বিপদ"
                          : "Alert"
                        : level === "watch"
                          ? isBn
                            ? "সতর্কতা"
                            : "Watch"
                          : level === "none"
                            ? isBn
                              ? "নিম্ন"
                              : "Low"
                            : isBn
                              ? "নেই"
                              : "No forecast";
                    const color =
                      level === "alert"
                        ? "text-rk-danger"
                        : level === "watch"
                          ? "text-rk-warning"
                          : level === "none"
                            ? "text-rk-muted"
                            : "text-rk-muted";
                    const note =
                      level === "none"
                        ? isBn
                          ? "কম, তবে শূন্য নয়"
                          : "Low, not zero"
                        : level
                          ? isBn
                            ? "মডেল পূর্বাভাস"
                            : "Model forecast"
                          : isBn
                            ? "এই দিনের জন্য নেই"
                            : "None for this day";

                    const point =
                      pointCheckResult?.district?.pcode === selectedPcode
                        ? pointCheckResult
                        : null;
                    const h100 = point?.cell?.hazard?.find(
                      (h: any) => h.return_period_years === 100,
                    );
                    const depth = !point?.cell
                      ? "—"
                      : point.cell.permanent_water
                        ? isBn
                          ? "জলাশয়"
                          : "Water body"
                        : h100?.depth_label
                          ? depthLabel(h100.depth_label, isBn ? "bn" : "en")
                          : isBn
                            ? "বাইরে"
                            : "Outside";
                    const depthNote = !point?.cell
                      ? isBn
                        ? "মানচিত্রে স্থান বাছুন"
                        : "Pick a spot on the map"
                      : h100?.depth_label
                        ? isBn
                          ? "১০০ বছরের বন্যা, মডেল"
                          : "1-in-100-yr flood, modelled"
                        : point.cell.permanent_water
                          ? isBn
                            ? "নদী বা স্থায়ী পানি"
                            : "River or permanent water"
                          : isBn
                            ? "মডেল বন্যা এলাকার বাইরে"
                            : "Outside modelled flood zone";

                    const cardCls =
                      "bg-white rounded-xl border border-rk-line p-2 sm:p-2.5 text-center shadow-xs flex flex-col justify-between";
                    return (
                      <>
                        <div className={cardCls}>
                          <span className="text-[10px] sm:text-[11px] font-semibold text-rk-muted">
                            {isBn ? "বন্যা ঝুঁকি" : "Flood Risk"}
                          </span>
                          <div
                            className={`text-lg sm:text-xl font-bold my-0.5 ${color}`}
                          >
                            {label}
                          </div>
                          <span className="text-[9px] sm:text-[10px] font-medium text-rk-muted">
                            {note}
                          </span>
                        </div>

                        {/* 2: Forecast — the real probability, or "not available" */}
                        <div className={cardCls}>
                          <span className="text-[10px] sm:text-[11px] font-semibold text-rk-muted">
                            {isBn ? "বন্যার সম্ভাবনা" : "Chance of flooding"}
                          </span>
                          <div className="text-lg sm:text-xl font-bold text-rk-brand my-0.5">
                            {districtReport.probabilityText}
                          </div>
                          <span className="text-[9px] sm:text-[10px] font-medium text-rk-brand">
                            {isBn ? "জেলা, এই দিনের" : "District, this day"}
                          </span>
                        </div>

                        {/* 3: Depth — JRC modelled depth at the checked spot */}
                        <div className={cardCls}>
                          <span className="text-[10px] sm:text-[11px] font-semibold text-rk-muted">
                            {isBn ? "গভীরতা (এই স্থানে)" : "Depth (this spot)"}
                          </span>
                          <div className="text-lg sm:text-xl font-bold text-rk-ink my-0.5">
                            {depth}
                          </div>
                          <span className="text-[9px] sm:text-[10px] font-medium text-rk-muted">
                            {depthNote}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* 3. Active District Alerts & Warnings */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rk-ink flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rk-danger" />
                    {lang === "bn"
                      ? "এই জেলা ও বিভাগে নজরদারি বা সতর্কতা (মডেল)"
                      : "Watch or Alert in this district and division (model)"}
                  </h4>
                  {alerts.filter(
                    (a) =>
                      a.district.pcode === selectedPcode ||
                      a.district.division === districtReport.division,
                  ).length > 0 ? (
                    <div className="space-y-1.5">
                      {alerts
                        .filter(
                          (a) =>
                            a.district.pcode === selectedPcode ||
                            a.district.division === districtReport.division,
                        )
                        .slice(0, 3)
                        .map((alert) => (
                          <div
                            key={alert.alert_id}
                            className={`p-2.5 rounded-xl border flex items-start gap-2 text-xs ${
                              alert.level === "alert"
                                ? "bg-rk-danger-soft border-rk-danger-accent/40 text-rk-danger"
                                : "bg-rk-warning-soft border-rk-warning-accent text-rk-warning"
                            }`}
                          >
                            <span className="font-extrabold uppercase px-1.5 py-0.5 rounded text-[10px] shrink-0 bg-white/70">
                              {alert.level === "alert"
                                ? lang === "bn"
                                  ? "সতর্কতা"
                                  : "ALERT"
                                : lang === "bn"
                                  ? "নজরদারি"
                                  : "WATCH"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold">
                                {lang === "bn"
                                  ? DISTRICTS_BN[alert.district.pcode] ||
                                    alert.district.name
                                  : alert.district.name}{" "}
                                (
                                {lang === "bn"
                                  ? `${toBnNum(Math.round(alert.probability * 100))}% সম্ভাবনা`
                                  : `${Math.round(alert.probability * 100)}% chance`}
                                )
                              </div>
                              <div className="text-[11px] leading-snug mt-0.5">
                                {alert.message}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-rk-page border border-rk-line text-rk-ink text-xs flex items-center gap-2 font-medium">
                      <span
                        className="w-2 h-2 rounded-full bg-rk-risk-unknown"
                        aria-hidden="true"
                      ></span>
                      <span>
                        {lang === "bn"
                          ? "এই দিনে এই জেলা বা বিভাগের কোনো জেলা নজরদারি বা সতর্কতা স্তরে নেই। কম সম্ভাবনা মানে শূন্য ঝুঁকি নয়।"
                          : "Neither this district nor any other district in its division is on Watch or Alert for this day. A low chance is not zero risk."}
                      </span>
                    </div>
                  )}
                </div>

                {/* 4. Actionable Emergency Evacuation Plan */}
                <div className="space-y-2 bg-white rounded-2xl border border-rk-line p-3.5 sm:p-4 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rk-brand flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rk-danger" />
                    {lang === "bn"
                      ? "জরুরি অবস্থায় সরে যাওয়া ও নিরাপত্তা নির্দেশনা"
                      : "Emergency evacuation and safety guidance"}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-rk-forest leading-relaxed">
                    <div className="p-2 sm:p-2.5 rounded-xl bg-rk-page border border-rk-line space-y-0.5">
                      <div className="font-bold text-rk-brand text-[11px]">
                        {lang === "bn"
                          ? "১. আশ্রয়কেন্দ্রে স্থানান্তর:"
                          : "1. Immediate Evacuation:"}
                      </div>
                      <div className="text-[11px]">
                        {lang === "bn"
                          ? "শিশু, বয়োবৃদ্ধ ও গবাদিপশু দ্রুত নিকটবর্তী পাকা আশ্রয়কেন্দ্র বা বন্যা প্রতিরোধী ভবনে সরিয়ে নিন।"
                          : "Move children, elderly, and livestock immediately to the nearest designated elevated shelter."}
                      </div>
                    </div>
                    <div className="p-2 sm:p-2.5 rounded-xl bg-rk-page border border-rk-line space-y-0.5">
                      <div className="font-bold text-rk-brand text-[11px]">
                        {lang === "bn"
                          ? "২. নিরাপদ পানি ও শুকনো খাবার:"
                          : "2. Safe Water & Provisions:"}
                      </div>
                      <div className="text-[11px]">
                        {lang === "bn"
                          ? "কমপক্ষে ৭২ ঘণ্টার নিরাপদ খাওয়ার পানি, হ্যালোজেন ট্যাবলেট, ওরাল স্যালাইন ও শুকনো খাবার সংরক্ষণ করুন।"
                          : "Secure 72 hours of clean drinking water, purification tablets (Halazone), saline, and dry rations."}
                      </div>
                    </div>
                    <div className="p-2 sm:p-2.5 rounded-xl bg-rk-page border border-rk-line space-y-0.5">
                      <div className="font-bold text-rk-brand text-[11px]">
                        {lang === "bn"
                          ? "৩. বিদ্যুৎ ও যোগাযোগ ব্যবস্থা:"
                          : "3. Power & Device Safety:"}
                      </div>
                      <div className="text-[11px]">
                        {lang === "bn"
                          ? "পানি ঘরে ঢোকার আগেই মেইন সুইচ বন্ধ করুন। মোবাইল ও পাওয়ারব্যাংক ওয়াটারপ্রুফ পলিথিনে সিল করে রাখুন।"
                          : "Turn off main electrical breakers before water enters. Seal mobile phones and powerbanks in waterproof bags."}
                      </div>
                    </div>
                    <div className="p-2 sm:p-2.5 rounded-xl bg-rk-page border border-rk-line space-y-0.5">
                      <div className="font-bold text-rk-brand text-[11px]">
                        {lang === "bn"
                          ? "৪. জরুরি হটলাইন নম্বরসমূহ:"
                          : "4. Emergency Helplines:"}
                      </div>
                      <div className="text-[11px]">
                        {lang === "bn"
                          ? "উদ্ধার সহায়তা: ৯৯৯ | দুর্যোগ তথ্য: ১০৯০ | নারী ও শিশু সহায়তা: ১০৯"
                          : "National Rescue: 999 | Flood IVR: 1090 | Women & Child Helpline: 109"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. Footer Actions */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDistrictReportOpen(false);
                      setIsSosOpen(true);
                    }}
                    className="w-full sm:flex-1 h-12 px-5 rounded-xl bg-rk-brand hover:bg-rk-brand-strong text-white font-bold inline-flex items-center justify-center gap-2"
                  >
                    <LifeBuoy className="w-5 h-5" aria-hidden="true" />
                    {lang === "bn" ? "সাহায্য চান" : "Request assistance"}
                  </button>
                  <Button
                    variant="outline"
                    onClick={() => setIsDistrictReportOpen(false)}
                    className="w-full sm:w-auto h-12 px-6 rounded-xl border-rk-line font-bold text-sm text-rk-forest hover:bg-rk-page"
                  >
                    {lang === "bn" ? "প্রতিবেদন বন্ধ করুন" : "Close Report"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Bottom Footer Bar matching Image 2 */}
            <AttributionFooter
              lang={lang}
              onOpenAbout={() => setIsAboutOpen(true)}
            />
          </main>
        </div>
        {/* Portal Access Login/Register Modal & Page (Matching User Reference Image) */}
        {activeView !== "login" && !isLoginOpen && (
          <SosCenter
            lang={lang}
            contactName={accountUser?.name || ""}
            isOpen={isSosOpen}
            onOpenChange={setIsSosOpen}
            hideFloatingButton
            presetNeeds={sosPreset}
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
            // Rescue teams and admins land on their board; everyone else on the forecast for their area.
            navigateToPage(
              user && (user.role === "rescuer" || user.role === "admin")
                ? "rescue"
                : "map",
            );
          }}
          lang={lang}
          onToggleLanguage={toggleLanguage}
        />
      </div>
    </>
  );
}

export default CitizenPortalApp;
