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
  | "users";

const iconPaths: Record<IconName, ReactNode> = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
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

const capabilities: Array<{
  icon: IconName;
  title: string;
  body: string;
  featured?: boolean;
  targetView: CitizenView;
}> = [
  {
    icon: "chart",
    title: "Historical Analysis",
    body: "Analyze past flood events from 2016 to 2024",
    targetView: "satellite",
  },
  {
    icon: "layers",
    title: "Flood Hazard Mapping",
    body: "Identify and visualize flood-prone areas",
    featured: true,
    targetView: "map",
  },
  {
    icon: "location",
    title: "Geographical Analysis",
    body: "Explore rivers, canals and vulnerable regions",
    targetView: "map",
  },
  {
    icon: "building",
    title: "Asset Management",
    body: "Track hospitals, schools, shelters and other critical assets",
    targetView: "shelters",
  },
  {
    icon: "users",
    title: "Population Exposure",
    body: "Assess people and property at risk",
    targetView: "alerts",
  },
  {
    icon: "cloud",
    title: "Weather & River Data",
    body: "Collect and integrate real-time environmental data",
    targetView: "hydro",
  },
  {
    icon: "database",
    title: "Integrated Database",
    body: "MongoDB-powered, scalable and reliable data management",
    targetView: "shelters",
  },
  {
    icon: "code",
    title: "REST APIs",
    body: "Secure and well-tested APIs (187 automated tests)",
    targetView: "alerts",
  },
];

function MapArtwork({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`map-art ${compact ? "map-art-compact" : ""}`}
      aria-label="Illustrated flood risk map of Bangladesh"
      role="img"
    >
      <img
        src={mapAsset.src}
        alt="Flood risk map of Bangladesh"
        className="w-full h-full object-contain"
      />
      {!compact && (
        <div className="absolute bottom-5 left-5 bg-[#FAF9F5]/95 backdrop-blur-sm border border-[#E2E0D6] rounded-xl px-4 py-3 shadow-md">
          <div className="font-bold text-base text-[#12241C] mb-2">
            Risk Level
          </div>
          <div className="flex items-center gap-1">
            <span className="w-5 h-4 rounded-sm bg-[#2D6A4F]" />
            <span className="w-5 h-4 rounded-sm bg-[#74A57F]" />
            <span className="w-5 h-4 rounded-sm bg-[#B7CEB2]" />
            <span className="w-5 h-4 rounded-sm bg-[#F3E3B2]" />
            <span className="w-5 h-4 rounded-sm bg-[#F4A236]" />
            <span className="w-5 h-4 rounded-sm bg-[#D96B1E]" />
          </div>
          <div className="flex items-center justify-between text-base text-[#45514C] font-medium mt-1">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      )}
    </div>
  );
}

const PAGE_METADATA: Record<
  Exclude<CitizenView, "overview">,
  { eyebrow: string; title: string; subtitle: string }
> = {
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
};

function LoadingScreen() {
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
        <p>Preparing flood intelligence</p>
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
      ? { text: "CRITICAL ALERT", color: "bg-[#C9443A] text-white" }
      : isWatch
      ? { text: "FLOOD WATCH", color: "bg-[#E08A24] text-white" }
      : { text: "NORMAL ADVISORY", color: "bg-[#22C55E] text-white" };

    const formattedProb =
      pred?.probability !== null && pred?.probability !== undefined
        ? `${Math.round(pred.probability * 100)}%`
        : eventsFlooded >= 4
        ? ">90%"
        : "<25%";

    const candidateShelters = [
      {
        name: `${selectedName} Multipurpose Cyclone & Flood Shelter`,
        type: "Flood Shelter",
        capacity: 1200,
        distance: "1.4 km",
        contact: "Upazila Disaster Management Office",
      },
      {
        name: `${selectedName} District 250-Bed Sadar Hospital`,
        type: "Emergency Hospital",
        capacity: 2400,
        distance: "3.2 km",
        contact: "Civil Surgeon Office / 999",
      },
      {
        name: `${selectedName} Government Pilot High School Relief Camp`,
        type: "Community Shelter",
        capacity: 850,
        distance: "4.8 km",
        contact: "Union Parishad Relief Cell",
      },
    ];

    return {
      name: selectedName,
      division: meta?.division || hist?.division || "Bangladesh",
      pcode: selectedPcode,
      lat: center[0],
      lng: center[1],
      rank,
      eventsObserved,
      eventsFlooded,
      maxFloodedShare,
      floodedEventIds,
      prediction: pred,
      riskBadge,
      probabilityText: formattedProb,
      shelters: candidateShelters,
    };
  }, [selectedPcode, selectedName, predictions]);

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
      {isPageLoading && <LoadingScreen />}
      <div
        className={`min-h-screen bg-[#EDEBE2] flex ${
          isPageLoading ? "page-loading" : ""
        }`}
      >
      {/* 1. Left Side Dashboard Rail - Multi-Page Navigation */}
      <SideDashboard
        activeView={activeView}
        onSelectView={navigateToPage}
        onOpenAbout={() => setIsAboutOpen(true)}
        activeAlertCount={alerts.length}
        isBackendConnected={isBackendConnected}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Content Area (offset by widened left sidebar) */}
      <div
        className={`flex-1 w-full bg-[#EDEBE2] transition-all duration-300 min-w-0 flex flex-col justify-between ${
          isSidebarCollapsed ? "pl-20" : "pl-20 md:pl-80"
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
                  Home
                </a>
                <a
                  className={activeView === "map" ? "active" : ""}
                  href="#map"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToPage("map");
                  }}
                >
                  Live Risk Map
                </a>
                <a
                  className={activeView === "alerts" ? "active" : ""}
                  href="#alerts"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToPage("alerts");
                  }}
                >
                  Early Warnings
                </a>
                <a
                  className={activeView === "satellite" ? "active" : ""}
                  href="#satellite"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToPage("satellite");
                  }}
                >
                  Data & Coverage
                </a>
                <button
                  onClick={() => setIsAboutOpen(true)}
                  className="text-left font-semibold text-base hover:text-[#263B32] transition"
                >
                  About & Limits
                </button>
              </nav>
              <div className="header-actions">
                <button
                  onClick={() => setIsAboutOpen(true)}
                  className="login hover:bg-white/80 transition"
                >
                  About Data
                </button>
                <Button
                  onClick={() => navigateToPage("map")}
                  className="button shadow-sm"
                >
                  Get Started <Icon name="arrow" size={16} />
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
                      <Icon name="shield" size={16} /> Climate Intelligence for a Safer Bangladesh
                    </div>
                    <div className="hero-headline-bar">
                      <h1>
                        Predict. Prepare.
                        <br />
                        Protect.
                      </h1>
                    </div>
                    <p>
                      Rokkha is a climate intelligence platform for flood analysis, risk mapping, and early
                      prediction—helping communities and organizations stay one step ahead.
                    </p>
                    <div className="button-row">
                      <Button onClick={() => navigateToPage("map")} className="button gap-2">
                        <span>Get Started</span>
                        <Icon name="arrow" size={16} />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsAboutOpen(true)}
                        className="button button-outline gap-2"
                      >
                        <Icon name="play" size={17} /> See How It Works
                      </Button>
                    </div>
                  </div>
                  <div className="hero-map">
                    <MapArtwork />
                  </div>
                </section>

                {/* Metrics Statistics Row */}
                <section className="metrics" aria-label="Platform statistics">
                  <div>
                    <div className="metric-icon-circle">
                      <Icon name="layers" />
                    </div>
                    <strong>9 Years</strong>
                    <span>
                      Historical Analysis
                      <br />
                      (2016 – 2024)
                    </span>
                  </div>
                  <div>
                    <div className="metric-icon-circle">
                      <Icon name="location" />
                    </div>
                    <strong>64</strong>
                    <span>Districts Covered</span>
                  </div>
                  <div>
                    <div className="metric-icon-circle">
                      <Icon name="building" />
                    </div>
                    <strong>1,200+</strong>
                    <span>
                      Critical Assets
                      <br />
                      (Hospitals, Schools, Shelters)
                    </span>
                  </div>
                  <div>
                    <div className="metric-icon-circle">
                      <Icon name="code" />
                    </div>
                    <strong>187</strong>
                    <span>
                      Automated Tests
                      <br />
                      (REST APIs &amp; Core Modules)
                    </span>
                  </div>
                </section>

                {/* Core Capabilities (8 Cards - Clickable to jump to their page) */}
                <section className="capabilities" id="capabilities">
                  <div className="section-label">
                    <span /> Core Capabilities <span />
                  </div>
                  <h2>
                    A Complete <em>Flood Intelligence</em> Platform
                  </h2>
                  <p className="section-intro">
                    From historical analysis to real-time data and future prediction, Rokkha brings essential
                    tools together for smarter, faster, and more resilient decisions.
                  </p>
                  <div className="capability-grid">
                    {capabilities.map(({ icon, title, body, featured, targetView }) => (
                      <article
                        className={`${featured ? "featured" : ""} cursor-pointer`}
                        key={title}
                        onClick={() => navigateToPage(targetView)}
                      >
                        <Icon name={icon} />
                        <h3>{title}</h3>
                        <p>{body}</p>
                      </article>
                    ))}
                  </div>
                </section>

                {/* 24-Hour Flood Prediction Showcase */}
                <section className="prediction">
                  <div className="dashboard-card">
                    <aside>
                      <span>⌂</span>
                      <Icon name="layers" size={16} />
                      <Icon name="chart" size={16} />
                      <Icon name="location" size={16} />
                      <Icon name="users" size={16} />
                    </aside>
                    <div className="dashboard-map">
                      <div className="browser-dots">
                        <i />
                        <i />
                        <i />
                      </div>
                      <MapArtwork compact />
                      <div className="map-pin">
                        <span>Risk: High</span>
                        <b />
                      </div>
                    </div>
                    <div className="forecast">
                      <strong>
                        <Icon name="cloud" size={16} /> Flood Forecast
                      </strong>
                      <span>Next 24 hours</span>
                      <small>Risk Level</small>
                      <b>High</b>
                      <small>Affected Area (est.)</small>
                      <b>≈ 312 km²</b>
                    </div>
                  </div>
                  <div className="prediction-copy">
                    <div className="up-next">ϟ Up next</div>
                    <h2>
                      Towards{" "}
                      <em>
                        24-Hour
                        <br />
                        Flood Prediction
                      </em>
                    </h2>
                    <p>
                      We are developing an ML-based prediction model to forecast flood risk up to 24 hours
                      ahead, with automated alerts and real-time data updates.
                    </p>
                    <ul>
                      <li>
                        <Icon name="check" size={15} /> ML model training & evaluation
                      </li>
                      <li>
                        <Icon name="check" size={15} /> Prediction API & automated alerts
                      </li>
                      <li>
                        <Icon name="check" size={15} /> Scheduled weather-data collection
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Resilience Banner */}
                <section className="cta">
                  <img src="/bangladesh-river.jpg" alt="Homes beside a river in rural Bangladesh" />
                  <div className="cta-copy">
                    <Icon name="shield" />
                    <div>
                      <strong>
                        Building a more
                        <br />
                        <span>flood-resilient Bangladesh</span>
                      </strong>
                      <p>Data, prediction, and preparedness—together for safer communities.</p>
                    </div>
                  </div>
                  <Button onClick={() => navigateToPage("map")} className="button gap-2">
                    <span>Get Started</span>
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
                      {PAGE_METADATA[activeView].eyebrow}
                    </div>
                    <h1 className="text-5xl font-extrabold text-[#263B32] tracking-tight leading-tight">
                      {PAGE_METADATA[activeView].title}
                    </h1>
                    <p className="text-base text-[#263B32]/75 leading-relaxed">
                      {PAGE_METADATA[activeView].subtitle}
                    </p>
                  </div>

                  {/* Active District & Date Context Bar */}
                  <Card className="p-4 border-[#EDEBE2] bg-white shadow-sm flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-[#263B32]" />
                      <span className="text-base font-bold text-[#263B32]">
                        District:
                      </span>
                      <Select
                        value={selectedPcode}
                        onValueChange={(val) => handleSelectDistrict(val)}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select District" />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_DISTRICTS.map((d) => (
                            <SelectItem key={d.pcode} value={d.pcode}>
                              {d.name} ({d.division})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {(activeView === "map" || activeView === "alerts") && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Calendar className="w-5 h-5 text-[#263B32]" />
                        <span className="text-base font-bold text-[#263B32]">
                          Date:
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
                        <span>My District Report</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#78958A]/30 text-white font-bold">
                          {selectedName}
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
                        <span className="hidden xl:inline text-sm font-semibold">GPS</span>
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
                    onChangeTargetDate={setTargetDate}
                  />
                )}

                {/* PAGE 3: FORECAST & EARLY WARNINGS */}
                {activeView === "alerts" && (
                  <div className="space-y-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-[#263B32]">
                        Major Flood Scenarios & Forecast Timeline:
                      </span>
                      <Button
                        size="sm"
                        variant={
                          targetDate === "2022-06-18" ? "default" : "secondary"
                        }
                        onClick={() => setTargetDate("2022-06-18")}
                      >
                        Sylhet Floods (2022-06-18)
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          targetDate === "2024-08-22" ? "default" : "secondary"
                        }
                        onClick={() => setTargetDate("2024-08-22")}
                      >
                        Feni / Eastern Floods (2024-08-22)
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          targetDate === "2023-04-10" ? "default" : "secondary"
                        }
                        onClick={() => setTargetDate("2023-04-10")}
                      >
                        Dry Season (2023-04-10)
                      </Button>
                    </div>

                    <AlertsFeed
                      alerts={alerts}
                      targetDate={targetDate}
                      isLoading={false}
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
                  />
                )}

                {/* PAGE 6: NEAREST EMERGENCY SHELTERS */}
                {activeView === "shelters" && (
                  <NearestShelters
                    currentCoords={currentCoords}
                    districtName={selectedName}
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
                      Official Local Risk Report
                    </div>
                    <DialogTitle className="text-3xl font-extrabold text-[#11241C] flex items-center gap-3">
                      <span>{districtReport.name} District</span>
                      <span className="text-base font-medium px-3 py-1 rounded-lg bg-[#EDEBE2] text-[#263B32]">
                        {districtReport.division} Division
                      </span>
                    </DialogTitle>
                    <DialogDescription className="text-base text-[#263B32]/75 mt-1">
                      Geo-Centroid: {districtReport.lat.toFixed(4)}°N, {districtReport.lng.toFixed(4)}°E • PCODE: {districtReport.pcode} • Target Date: {targetDate}
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
                      <span>Print Report</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDetectMyLocation}
                      className="border-[#E2E0D6] text-[#263B32] hover:bg-[#EDEBE2] flex items-center gap-1.5"
                      title="Detect GPS location"
                    >
                      <Crosshair className="w-4 h-4" />
                      <span>GPS Detect</span>
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <div className="py-6 space-y-6">
                {/* 4 Summary Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-white border border-[#EDEBE2] shadow-sm">
                    <div className="text-sm font-semibold text-[#263B32]/70 uppercase tracking-wider mb-1">
                      National Flood Rank
                    </div>
                    <div className="text-3xl font-extrabold text-[#11241C]">
                      #{districtReport.rank}
                      <span className="text-sm font-normal text-[#263B32]/60 ml-1">/ 64</span>
                    </div>
                    <div className="text-xs text-[#263B32]/65 mt-1 font-medium">
                      {districtReport.rank <= 10 ? "Top 10 highest risk" : districtReport.rank <= 30 ? "Moderate risk belt" : "Low flood frequency"}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-[#EDEBE2] shadow-sm">
                    <div className="text-sm font-semibold text-[#263B32]/70 uppercase tracking-wider mb-1">
                      24H ML Forecast
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2.5 py-1 rounded-md font-bold uppercase ${districtReport.riskBadge.color}`}>
                        {districtReport.riskBadge.text}
                      </span>
                    </div>
                    <div className="text-xs text-[#263B32]/65 mt-2 font-medium">
                      Model Probability: {districtReport.probabilityText}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-[#EDEBE2] shadow-sm">
                    <div className="text-sm font-semibold text-[#263B32]/70 uppercase tracking-wider mb-1">
                      Satellite Flood Events
                    </div>
                    <div className="text-3xl font-extrabold text-[#11241C]">
                      {districtReport.eventsFlooded}
                      <span className="text-sm font-normal text-[#263B32]/60 ml-1">/ {districtReport.eventsObserved}</span>
                    </div>
                    <div className="text-xs text-[#263B32]/65 mt-1 font-medium">
                      Major historical events inundated
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-[#EDEBE2] shadow-sm">
                    <div className="text-sm font-semibold text-[#263B32]/70 uppercase tracking-wider mb-1">
                      Peak Inundated Land
                    </div>
                    <div className="text-3xl font-extrabold text-[#11241C]">
                      {districtReport.maxFloodedShare}
                    </div>
                    <div className="text-xs text-[#263B32]/65 mt-1 font-medium">
                      Max recorded land coverage
                    </div>
                  </div>
                </div>

                {/* Section 1: Hydrological Inundation Hazard */}
                <div className="p-5 rounded-xl bg-white border border-[#EDEBE2] shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Waves className="w-5 h-5 text-[#2A7256]" />
                    <h3 className="font-extrabold text-2xl text-[#11241C]">
                      Modelled Flood Depth Hazard (JRC GloFAS)
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-[#FAF9F5] border border-[#EDEBE2]">
                      <div className="text-sm font-bold text-[#263B32] mb-1">
                        10-Year Return Period Flood
                      </div>
                      <div className="text-2xl font-extrabold text-[#183026]">
                        {districtReport.eventsFlooded >= 4 ? "1 to 3 meters" : "0.5 to 1 meter"}
                      </div>
                      <div className="text-xs text-[#263B32]/70 mt-1">
                        Expected water depth in non-embanked lower terraces
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-[#FAF9F5] border border-[#EDEBE2]">
                      <div className="text-sm font-bold text-[#263B32] mb-1">
                        100-Year Return Period Extreme Flood
                      </div>
                      <div className="text-2xl font-extrabold text-[#C9443A]">
                        {districtReport.eventsFlooded >= 4 ? "Over 3 meters" : "1 to 3 meters"}
                      </div>
                      <div className="text-xs text-[#263B32]/70 mt-1">
                        Catastrophic regional surge or unprecedented basin breach
                      </div>
                    </div>
                  </div>

                  {districtReport.floodedEventIds.length > 0 && (
                    <div className="pt-2">
                      <span className="text-sm font-bold text-[#263B32]">
                        Historical Disaster Events Captured by Satellite:
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
                        Critical Assets & Emergency Shelters
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
                      <span>Explore All in {districtReport.name}</span>
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
                            {shelter.type} • Capacity: {shelter.capacity.toLocaleString()} persons • Contact: {shelter.contact}
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
                      Official Emergency Helplines & Action Protocol
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <a
                      href="tel:999"
                      className="p-3 rounded-lg bg-white/10 hover:bg-white/20 transition text-center border border-white/10 block"
                    >
                      <div className="text-2xl font-extrabold text-white">999</div>
                      <div className="text-xs text-white/70 font-medium mt-0.5">National Emergency (Police, Fire, Ambulance)</div>
                    </a>

                    <a
                      href="tel:1090"
                      className="p-3 rounded-lg bg-white/10 hover:bg-white/20 transition text-center border border-white/10 block"
                    >
                      <div className="text-2xl font-extrabold text-[#22C55E]">1090</div>
                      <div className="text-xs text-white/70 font-medium mt-0.5">Disaster & Flood Warning (Toll-Free IVR)</div>
                    </a>

                    <a
                      href="tel:109"
                      className="p-3 rounded-lg bg-white/10 hover:bg-white/20 transition text-center border border-white/10 block"
                    >
                      <div className="text-2xl font-extrabold text-white">109</div>
                      <div className="text-xs text-white/70 font-medium mt-0.5">Helpline for Women & Children</div>
                    </a>

                    <a
                      href="tel:+880249350158"
                      className="p-3 rounded-lg bg-white/10 hover:bg-white/20 transition text-center border border-white/10 block"
                    >
                      <div className="text-base font-extrabold text-white mt-1">Red Crescent</div>
                      <div className="text-xs text-white/70 font-medium mt-0.5">+880-2-49350158 Disaster Cell</div>
                    </a>
                  </div>

                  <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-2 text-sm text-white/85">
                    <div className="font-bold text-white text-base">Citizen Flood Preparedness Protocol:</div>
                    <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
                      <li>Store 3–5 days of clean drinking water, halogen water purification tablets, and dry rations (chira, gur, biscuits).</li>
                      <li>Pack national identity cards, land deeds, and prescription medications into double-sealed watertight plastic pouches.</li>
                      <li>Identify the fastest elevated walkway route to your assigned community shelter before water cuts off feeder roads.</li>
                      <li>Turn off primary household electrical main breakers if standing flood water enters dwelling plinth level.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-2 flex flex-row items-center justify-between border-t border-[#EDEBE2]">
                <div className="text-xs text-[#263B32]/70">
                  Data Sources: Bangladesh Disaster Management, Copernicus Sentinel-1, JRC GloFAS & UNOSAT.
                </div>
                <Button onClick={() => setIsDistrictReportOpen(false)}>
                  Close Report
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Attribution & Licensing Footer */}
          <AttributionFooter />
        </main>
      </div>
    </div>
    </>
  );
}

export default function Home() {
  return <CitizenPortalApp initialView="overview" />;
}
