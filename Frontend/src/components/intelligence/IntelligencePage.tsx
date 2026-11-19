"use client";

// ROKKHA INTELLIGENCE — the data, model, evaluation and limits behind Rokkha (docs/ROKKHA_AI_ML_TECHNICAL_AUDIT.md).
// Every number on this page is read at run time from the backend (GET /predictions/model, /predictions,
// /geospatial/flood/events, /geospatial/flood/districts, /ingestion/river) or from evidence files copied from the
// backend (src/data/model_check_2025.json, public/geo/*). Nothing is typed in by hand except dates of commits.

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Database,
  FileCheck2,
  Layers,
  Map as MapIcon,
  MapPin,
  Radar,
  ShieldCheck,
  Waves,
} from "lucide-react";
import type { Language } from "../../lib/translations";
import type { DistrictPrediction } from "../../types/api";
import { getFloodDistricts, getFloodEvents, getModelStatus, getPredictions } from "../../services/api";
import check2025 from "../../data/model_check_2025.json";
import { loadDistricts, loadTerrainStats, placeName, type TerrainStat } from "../map/geoData";
import { loadStations, type Station } from "../map/riverStations";
import { Hydrograph } from "../map/Hydrograph";
import type { NavAction } from "../site/SiteNavigation";
import { ChartFrame, DistrictMap, EventTimeline, HBars, Legend, LineChart, ReliabilityMulti, Scatter, type FloodEvent, type Series } from "./charts";
import { GLOSSARY, Term } from "./glossary";
import coverage from "../../data/gfm_coverage.json";

interface Props {
  lang: Language;
  onAction: (a: NavAction) => void;
}

const SECTIONS = [
  { id: "overview", en: "Overview", bn: "সারসংক্ষেপ" },
  { id: "data", en: "Data sources", bn: "তথ্যের উৎস" },
  { id: "pipeline", en: "Processing pipeline", bn: "প্রক্রিয়া" },
  { id: "engine", en: "ML methodology", bn: "মডেলের পদ্ধতি" },
  { id: "performance", en: "Model evaluation", bn: "মডেল যাচাই" },
  { id: "outputs", en: "Research insights", bn: "গবেষণার ফলাফল" },
  { id: "bangladesh", en: "Geospatial analysis", bn: "ভৌগোলিক বিশ্লেষণ" },
  { id: "milestones", en: "Engineering milestones", bn: "প্রকৌশল অগ্রগতি" },
  { id: "limitations", en: "Limitations", bn: "সীমাবদ্ধতা" },
  { id: "details", en: "Technical breakdown", bn: "প্রযুক্তিগত বিবরণ" },
];

// Plain names for the 15 model inputs (app/modules/prediction/features.py).
const FEATURE_INFO: Record<string, { label: string; group: string; unit?: string }> = {
  rain_1d: { label: "Rain, last day", group: "Rain", unit: "mm" },
  rain_3d: { label: "Rain, last 3 days", group: "Rain", unit: "mm" },
  rain_7d: { label: "Rain, last 7 days", group: "Rain", unit: "mm" },
  rain_14d: { label: "Rain, last 14 days", group: "Rain", unit: "mm" },
  rain_30d: { label: "Rain, last 30 days", group: "Rain", unit: "mm" },
  river_log_discharge: { label: "River flow (log10 m³/s)", group: "River flow" },
  river_change_3d: { label: "River flow change over 3 days", group: "River flow" },
  river_vs_30d_mean: { label: "River flow vs its 30-day mean", group: "River flow" },
  river_distance_km: { label: "Distance to the river site", group: "Geography", unit: "km" },
  hazard_share_10yr: { label: "Land in 10-year flood zone", group: "Geography" },
  hazard_share_100yr: { label: "Land in 100-year flood zone", group: "Geography" },
  last_flooded_share: { label: "Flooded share, latest pass", group: "Recent satellite" },
  days_since_last_observation: { label: "Days since that pass", group: "Recent satellite", unit: "days" },
  max_flooded_share_14d: { label: "Highest flooded share, 14 days", group: "Recent satellite" },
  month: { label: "Month", group: "Season" },
};
const GROUP_COLOR: Record<string, string> = { "Recent satellite": "#6FA9B5", Rain: "#247A5B", "River flow": "#2C6573", Geography: "#B87955", Season: "#71866A" };

// Real milestones: dates and subjects of commits on the main branch (git log). "In development" = uncommitted.
const MILESTONES: { date: string; title: string; detail: string; evidence: string; status: "deployed" | "development" }[] = [
  { date: "8 Nov 2026", title: "Backend foundation", detail: "FastAPI service for flood and geography questions.", evidence: "commit “Backend updated”, app/main.py", status: "deployed" },
  { date: "9 Nov", title: "Geospatial engine and official boundaries", detail: "Point-in-zone, distance and path endpoints; COD-AB v03 boundaries (Dhaka first, then all 64 districts with the national flood history); first automated tests; a ~90 m flood grid (UNOSAT events + JRC hazard).", evidence: "commits “Add Dhaka administrative boundaries (HDX COD-AB v03)”, “Add nationwide flood history and flood grid”, “Add pytest suite”", status: "deployed" },
  { date: "10 Nov", title: "Environmental data pipelines", detail: "Rain and river ingestion (ERA5, GloFAS, GFS) with call budget and resumable runs; satellite flood labels per district from Copernicus GFM; MongoDB with geospatial indexes; facility exposure analysis.", evidence: "commits “Add rain and river data ingestion”, “Add satellite flood labels per district from Copernicus GFM”", status: "deployed" },
  { date: "11 Nov", title: "Machine-learning model, measured honestly", detail: "Training pipeline, year-separated evaluation against two baselines, prediction API and alerts; the delivered model then checked on 2025, a year never used.", evidence: "commits “Train the flood model and publish its measured results”, “Check the flood model on 2025”", status: "deployed" },
  { date: "13 Nov", title: "Running every day, hosted", detail: "Backend hosted on Render; daily update on GitHub Actions (rain → river → satellite → predict → alerts); accounts, rescue requests, roles and real facilities.", evidence: "commits “Run the daily update on GitHub Actions”, “Prepare the backend for hosting on Render”", status: "deployed" },
  { date: "16–17 Nov", title: "Hardening", detail: "Closed an SOS limit bypass, browser security headers; on-time daily start through an outside timer, restart-safe update.", evidence: "commits “Close an SOS limit bypass…”, “Start the daily update on time…”", status: "deployed" },
  { date: "18–19 Nov", title: "Geospatial intelligence map", detail: "Shared rescue board; MapLibre map with official 8 / 64 / 507 geography, six district layers, Point Check, river stations and hydrographs, OpenStreetMap rivers, Copernicus DEM terrain, exposure; river and rain forecasts in the daily update; 387 backend and 28 browser/unit tests.", evidence: "feature branches (not yet merged or deployed)", status: "development" },
];

/** "Technical details" disclosure. Defined outside the page so open sections survive re-renders. */
/** "Investigate" level: an optional deeper explanation with a descriptive action label. */
const Deep: React.FC<{ title: string; action?: string; children: React.ReactNode; dark?: boolean; bn?: boolean }> = ({ title, action, children, dark, bn }) => (
  <details className={`group mt-4 rounded-xl border px-4 py-3 ${dark ? "border-white/15 bg-white/5" : "border-rk-line bg-rk-surface"}`}>
    <summary className={`cursor-pointer text-[14px] font-bold ${dark ? "text-rk-mist" : "text-rk-forest"}`}>
      {action ?? (bn ? "প্রযুক্তিগত পদ্ধতি পড়ুন: " : "Read the technical methodology: ")}
      {title}
    </summary>
    <div className={`mt-3 space-y-2 text-[14px] leading-relaxed ${dark ? "text-white/85" : "text-rk-ink"}`}>{children}</div>
  </details>
);

/** Marks the three reading levels: Understand → Explore → Investigate. */
const Lvl: React.FC<{ level: "Understand" | "Explore" | "Investigate"; dark?: boolean }> = ({ level, dark }) => (
  <p className={`mt-8 mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] ${dark ? "text-rk-warning-accent" : "text-rk-clay-text"}`}>
    {level === "Understand" ? "① Understand" : level === "Explore" ? "② Explore" : "③ Investigate"}
  </p>
);

type Stage = { id: string; lane: "A" | "B" | "C" | "M" | "D"; title: string; in: string; does: string; out: string; tech: string; status: string };

const StageBtn: React.FC<{ s: Stage; active: boolean; onPick: (id: string) => void }> = ({ s, active, onPick }) => (
  <button
    type="button"
    onClick={() => onPick(s.id)}
    aria-pressed={active}
    className={`w-full rounded-xl border px-3 py-2.5 text-left text-[13px] font-semibold transition-colors ${
      active ? "border-rk-warning-accent bg-white/15 text-white" : "border-white/15 bg-white/5 text-rk-mist hover:bg-white/10"
    }`}
  >
    <span className="block font-mono text-[11px] uppercase tracking-wider text-rk-mist">
      {s.lane === "A" ? "Satellite" : s.lane === "B" ? "Weather & rivers" : s.lane === "C" ? "Geography" : s.lane === "D" ? "Point record" : "Model"}
    </span>
    {s.title}
  </button>
);

const dhakaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
const back = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
const pct = (v: number) => `${Math.round(v * 100)} %`;

export const IntelligencePage: React.FC<Props> = ({ lang, onAction }) => {
  const bn = lang === "bn";
  const tr = (en: string, b: string) => (bn ? b : en);

  const [meta, setMeta] = useState<any>(null);
  const [modelStatus, setModelStatus] = useState<string | null>(null);
  const [events, setEvents] = useState<FloodEvent[] | null>(null);
  const [example, setExample] = useState<{ date: string; p: DistrictPrediction; count: number } | null | "none">(null);
  const [districts, setDistricts] = useState<GeoJSON.FeatureCollection | null>(null);
  const [history, setHistory] = useState<Map<string, any> | null>(null);
  const [terrain, setTerrain] = useState<Record<string, TerrainStat> | null>(null);
  const [station, setStation] = useState<Station | null>(null);
  const [stage, setStage] = useState("features");
  const [selDistrict, setSelDistrict] = useState<string | null>("BD6090");
  const [active, setActive] = useState("overview");
  const [perfMetric, setPerfMetric] = useState<"pr_auc" | "roc_auc" | "brier" | "alert_precision" | "alert_recall">("pr_auc");
  const [perfHidden, setPerfHidden] = useState<Set<string>>(new Set());
  const [covHidden, setCovHidden] = useState<Set<string>>(new Set());
  const [covRange, setCovRange] = useState<"all" | "train" | "val" | "test" | "check" | "live">("all");
  const [scatterPeriod, setScatterPeriod] = useState<"test" | "check">("test");
  const [scatterHidden, setScatterHidden] = useState<Set<string>>(new Set());
  const [relHidden, setRelHidden] = useState<Set<string>>(new Set());
  const [arch, setArch] = useState("features");
  const [dataset, setDataset] = useState("gfm");
  const [stations, setStations] = useState<Station[] | null>(null);
  const toggle = (set: Set<string>, id: string) => {
    const n = new Set(set);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  };
  const progressRef = React.useRef<HTMLDivElement>(null);
  // Section bar: show that it scrolls sideways (fades + arrows) and keep the current section in view.
  const navRef = React.useRef<HTMLDivElement>(null);
  const [navEdge, setNavEdge] = useState({ left: false, right: false });
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const update = () => setNavEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>(`a[href="#${active}"]`);
    const box = navRef.current;
    if (!el || !box) return;
    const l = el.offsetLeft - box.offsetLeft;
    if (l < box.scrollLeft || l + el.offsetWidth > box.scrollLeft + box.clientWidth) {
      box.scrollTo({ left: Math.max(0, l - 24), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [active]);
  const scrollNav = (dir: 1 | -1) => navRef.current?.scrollBy({ left: dir * Math.max(160, (navRef.current?.clientWidth || 300) * 0.6), behavior: "smooth" });

  useEffect(() => {
    getModelStatus().then((s) => {
      setModelStatus(s?.status ?? null);
      setMeta(s?.model ?? null);
    });
    getFloodEvents().then((e: any[]) => setEvents(e));
    loadDistricts().then(setDistricts).catch(() => undefined);
    loadTerrainStats().then(setTerrain).catch(() => undefined);
    getFloodDistricts().then((rows: any[]) => setHistory(new Map(rows.map((r) => [r.pcode, r]))));
    loadStations(dhakaToday())
      .then((s) => {
        setStations(s);
        setStation(s.find((x) => x.id === "surma-sunamganj") ?? s[0] ?? null);
      })
      .catch(() => undefined);
    // A real stored prediction: the newest day (today or up to 3 days back) that has one.
    (async () => {
      const today = dhakaToday();
      for (let i = 0; i < 4; i++) {
        const date = back(today, i);
        const preds = await getPredictions(date);
        const ok = preds.filter((p) => p.status === "predicted" && p.probability != null);
        if (ok.length) {
          const top = ok.reduce((a, b) => ((b.probability as number) > (a.probability as number) ? b : a));
          setExample({ date, p: top, count: ok.length });
          return;
        }
      }
      setExample("none");
    })();
  }, []);

  // Section navigation: which section is on screen, and reading progress.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id);
      },
      { rootMargin: "-120px 0px -60% 0px" }
    );
    els.forEach((el) => io.observe(el));
    // Reading progress drawn straight onto the bar (no React re-render on every scroll event).
    const onScroll = () => {
      const h = document.documentElement;
      if (progressRef.current) progressRef.current.style.width = `${Math.min(1, h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100}%`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [meta]);

  const t = meta?.test_results;
  const imp: Record<string, number> | undefined = meta?.input_importance;
  const supported = useMemo(() => new Set<string>(meta?.supported_pcodes ?? []), [meta]);
  const groups = useMemo(() => {
    if (!imp) return [];
    const g: Record<string, number> = {};
    Object.entries(imp).forEach(([k, v]) => {
      const name = FEATURE_INFO[k]?.group ?? "Other";
      g[name] = (g[name] ?? 0) + v;
    });
    return Object.entries(g).sort((a, b) => b[1] - a[1]);
  }, [imp]);

  const wrap = "mx-auto max-w-[1180px] px-4 md:px-6";
  const eyebrow = "rk-eyebrow font-mono text-[12px] font-semibold uppercase tracking-[0.14em]";
  const h2 = "mt-2 text-[28px] md:text-[38px] leading-[1.1] font-extrabold";
  const lead = "mt-4 max-w-2xl text-[17px] leading-relaxed";


  // ---------- pipeline (the real data flow: separate pipelines meet at feature building) ----------
  const STAGES: Stage[] = [
    { id: "gfm", lane: "A", title: "Satellite flood observations", in: "Copernicus GFM flood rasters for every Sentinel-1 pass over Bangladesh (EODC open archive, April 2016 → now)", does: "For each district and pass: share of land the radar could map, share of that land flagged as flood water, share with GFM advisory flags.", out: "data/labels/district_flood_observations.json (one row per district and pass)", tech: "Python, rasterio (windowed COG reads), COD-AB district masks — scripts/build_gfm_labels.py; refreshed by the daily job", status: "Verified" },
    { id: "weather", lane: "B", title: "Rain and river ingestion", in: "Open-Meteo APIs: ERA5 reanalysis rain and GFS recent rain at 64 district points; GloFAS discharge at 9 river cells", does: "Budgeted (per hour/day), resumable runs in pieces; each value stored with source, unit, statistic, fetch time; missing days stored as missing.", out: "Daily series in MongoDB (rain_daily, rain_recent_daily, river_discharge_daily)", tech: "FastAPI background runs, httpx with retries, MongoDB — app/modules/ingestion", status: "Verified (tests)" },
    { id: "geo", lane: "C", title: "Static geography", in: "COD-AB v03 boundaries (BBS/OCHA), JRC GloFAS 10- and 100-year flood hazard maps, river-site locations", does: "Per district: share of land in each hazard zone and distance to its river site.", out: "data/ml/district_static.json", tech: "shapely, rasterio — scripts/build_flood_data.py, build_district_static.py", status: "Verified" },
    { id: "features", lane: "M", title: "Feature building (15 inputs)", in: "The three pipelines above, for one district and one target day", does: "Rain sums over 1/3/7/14/30 days; river flow level, 3-day change and ratio to its 30-day mean; static geography; the latest satellite pass before the day; the month. Missing inputs stay missing (NaN).", out: "One row of 15 numbers per district", tech: "app/modules/prediction/features.py (same code for training and live use)", status: "Verified" },
    { id: "model", lane: "M", title: "XGBoost model", in: "15 features", does: "49 gradient-boosted decision trees (depth 3) add up to a raw score for “will a satellite pass see this district flooded today?”.", out: "Raw probability", tech: "XGBoost 3.4.1, binary:logistic, settings chosen on 2022 by PR-AUC", status: "Verified (evaluated)" },
    { id: "calibrate", lane: "M", title: "Calibration and warning levels", in: "Raw probability", does: "Isotonic calibration (fitted on 2022) makes the probability match observed rates; Watch ≥ 0.18 and Alert ≥ 0.375 thresholds chosen on 2022.", out: "Calibrated probability + level (none / Watch / Alert)", tech: "scikit-learn IsotonicRegression in training; stored as a lookup in the model file", status: "Verified" },
    { id: "store", lane: "M", title: "Daily predictions and alerts", in: "56 predictable districts, every morning", does: "Predictions stored with model version, issue time and inputs; alerts list registered facilities in Watch/Alert districts with their own flood record.", out: "GET /predictions, GET /alerts", tech: "MongoDB; GitHub Actions at 09:30 Bangladesh time", status: "Verified (running daily)" },
    { id: "map", lane: "M", title: "Map and panels", in: "Predictions, observations, inputs, history", does: "District colours by real level, separate layers for observed / forecast / history / hazard, missing data shown as missing.", out: "/map, alerts, district reports", tech: "Next.js, MapLibre GL, COD-AB geography", status: "Verified (browser tests)" },
    { id: "point", lane: "D", title: "Point record (separate)", in: "10 UNOSAT flood analyses 2016–2024, JRC depth classes, permanent water — on a ~90 m grid", does: "For a clicked point: which analysed events flooded its cell, modelled depth for 10/100-year floods. Not part of the model.", out: "POST /geospatial/flood/check", tech: "numpy grid (data/flood/flood_grid.npz)", status: "Verified (tests)" },
  ];
  const cur = STAGES.find((s) => s.id === stage)!;

  // ---------- coverage map ----------
  const sel = selDistrict;
  const selName = sel && districts ? (districts.features.find((f: any) => f.properties.pcode === sel)?.properties as any)?.name : null;
  const ts = sel && terrain ? terrain[sel] : null;
  const hs = sel && history ? history.get(sel) : null;

  // ---------- evaluation across periods (real: model file + check_2025.json) ----------
  const c25 = check2025 as any;
  const v22 = meta?.validation_results;
  const PERIODS = ["2022 · validation", "2023–2024 · test", "2025 · later check"];
  const metricOf = (o: any, key: typeof perfMetric, rule: "alert" | "decision" = "alert"): number | null => {
    if (!o) return null;
    if (key === "alert_precision") return (rule === "alert" ? o.at_alert : o.decision)?.precision ?? null;
    if (key === "alert_recall") return (rule === "alert" ? o.at_alert : o.decision)?.recall ?? null;
    return o[key] ?? null;
  };
  const perfSeries: Series[] = t
    ? [
        { id: "model", label: "Rokkha model", color: "#247A5B", values: [metricOf(v22, perfMetric), metricOf(t.model, perfMetric), metricOf(c25.model, perfMetric)] },
        { id: "persistence", label: "Persistence", color: "#B87955", values: [null, metricOf(t.baseline_persistence, perfMetric, "decision"), metricOf(c25.persistence, perfMetric, "decision")] },
        { id: "climatology", label: "Climatology", color: "#8C8778", values: [null, metricOf(t.baseline_climatology, perfMetric, "decision"), metricOf(c25.climatology, perfMetric, "decision")] },
        ...(perfMetric === "pr_auc"
          ? [
              { id: "nosat", label: "No satellite inputs", color: "#6FA9B5", values: [null, t.without_satellite_inputs.test.pr_auc, null] },
              { id: "random", label: "Random guess", color: "#C9C5BA", dashed: true, values: [v22?.flood_rate ?? null, t.model.flood_rate, c25.model.flood_rate] },
            ]
          : []),
      ]
    : [];
  const METRICS: { id: typeof perfMetric; label: string; term: string; max: number; lowerBetter?: boolean }[] = [
    { id: "pr_auc", label: "PR-AUC", term: "prauc", max: 1 },
    { id: "roc_auc", label: "ROC-AUC", term: "rocauc", max: 1 },
    { id: "brier", label: "Brier score", term: "brier", max: 0.05, lowerBetter: true },
    { id: "alert_precision", label: "Precision at Alert", term: "precision", max: 1 },
    { id: "alert_recall", label: "Recall at Alert", term: "recall", max: 1 },
  ];
  const metric = METRICS.find((m) => m.id === perfMetric)!;

  // ---------- satellite coverage over time (real: gfm_coverage.json, derived from the label file) ----------
  const cov = coverage as any;
  const covRows: { month: string; usable: number; flood_labelled: number }[] = useMemo(() => {
    const ranges: Record<string, [string, string]> = { all: ["0000", "9999"], train: ["2016", "2021"], val: ["2022", "2022"], test: ["2023", "2024"], check: ["2025", "2025"], live: ["2026", "2026"] };
    const [a, b] = ranges[covRange];
    return cov.months.filter((m: any) => m.month.slice(0, 4) >= a && m.month.slice(0, 4) <= b);
  }, [covRange, cov]);
  // A null between seasons, so lines are not drawn across December–March (not collected).
  const covX: string[] = [];
  const covFull: string[] = [];
  const covUsable: (number | null)[] = [];
  const covFlood: (number | null)[] = [];
  covRows.forEach((r, i) => {
    if (i > 0 && r.month.slice(0, 4) !== covRows[i - 1].month.slice(0, 4)) {
      covX.push("");
      covFull.push("Dec–Mar (not collected)");
      covUsable.push(null);
      covFlood.push(null);
    }
    covX.push(r.month.endsWith("-04") ? r.month.slice(0, 4) : r.month.slice(2));
    covFull.push(r.month);
    covUsable.push(r.usable);
    covFlood.push(r.flood_labelled);
  });
  const covSeries: Series[] = [
    { id: "usable", label: "Usable passes", color: "#2C6573", values: covUsable },
    { id: "flood", label: "Flood-labelled", color: "#B3392D", values: covFlood },
  ];
  const covMax = Math.max(100, Math.ceil((Math.max(10, ...covUsable.filter((v): v is number => v != null)) * 1.08) / 100) * 100);
  const v4At = covRows.findIndex((r) => r.month === "2025-04");
  const v4X = v4At < 0 ? -1 : covX.findIndex((_, k) => k >= v4At && covX[k] === "2025");

  // ---------- precision vs recall of warning rules (real) ----------
  const scatterPoints = t
    ? scatterPeriod === "test"
      ? [
          { id: "mw", label: "Model · Watch", x: t.model.at_watch.recall, y: t.model.at_watch.precision, color: "#247A5B", group: "model" },
          { id: "ma", label: "Model · Alert", x: t.model.at_alert.recall, y: t.model.at_alert.precision, color: "#173D32", group: "model" },
          { id: "p", label: "Persistence", x: t.baseline_persistence.decision.recall, y: t.baseline_persistence.decision.precision, color: "#B87955", group: "baselines" },
          { id: "c", label: "Climatology", x: t.baseline_climatology.decision.recall, y: t.baseline_climatology.decision.precision, color: "#8C8778", group: "baselines" },
          { id: "nw", label: "No satellite · Watch", x: t.without_satellite_inputs.test.at_watch.recall, y: t.without_satellite_inputs.test.at_watch.precision, color: "#6FA9B5", group: "ablation" },
          { id: "na", label: "No satellite · Alert", x: t.without_satellite_inputs.test.at_alert.recall, y: t.without_satellite_inputs.test.at_alert.precision, color: "#2C6573", group: "ablation" },
        ]
      : [
          { id: "mw", label: "Model · Watch", x: c25.model.at_watch.recall, y: c25.model.at_watch.precision, color: "#247A5B", group: "model" },
          { id: "ma", label: "Model · Alert", x: c25.model.at_alert.recall, y: c25.model.at_alert.precision, color: "#173D32", group: "model" },
          { id: "p", label: "Persistence", x: c25.persistence.decision.recall, y: c25.persistence.decision.precision, color: "#B87955", group: "baselines" },
          { id: "c", label: "Climatology", x: c25.climatology.decision.recall, y: c25.climatology.decision.precision, color: "#8C8778", group: "baselines" },
        ]
    : [];

  // ---------- dataset catalogue (verified in docs/ROKKHA_AI_ML_TECHNICAL_AUDIT.md) ----------
  const DATASETS = [
    { id: "gfm", name: "Copernicus GFM flood extent (Sentinel-1)", provider: "Copernicus Emergency Management Service; read from the EODC open archive", desc: "Automatic flood-water maps for every Sentinel-1 radar image.", coverage: "Global; used for all 64 districts", resolution: "20 m product, summarised per district and pass", frequency: "Every pass (every few days over Bangladesh); fetched daily", range: `April 2016 → present (${cov.months.length} collected months, Apr–Nov)`, role: "Model labels (the target) and 3 inputs (latest pass, days since, 14-day maximum)", limits: "Excluded land (dense forest, built-up, steep terrain) is not observed; short floods between passes are missed; version change GFM v3.1 → v4.x in 2025." },
    { id: "era5", name: "ERA5 daily rain", provider: "ECMWF, Copernicus Climate Change Service; via Open-Meteo", desc: "Reanalysis rain: a best estimate of past rain from a weather model plus observations.", coverage: "64 district points", resolution: "~25 km grid", frequency: "Daily totals, arrives ~5 days late", range: "2016 → about 5 days ago", role: "5 rain inputs (1–30-day sums) for training and live use", limits: "A point per district, not an area mean; not a gauge; misses local storms." },
    { id: "gfs", name: "GFS rain (recent days and forecast)", provider: "NOAA NCEP; via Open-Meteo", desc: "Weather-model rain for the last few days (filling the ERA5 delay) and hourly forecasts.", coverage: "64 district points", resolution: "~13–25 km", frequency: "Daily; hourly values for forecasts", range: "Recent 7 days; next 4 days (forecast)", role: "Recent rain in live inputs; rain-forecast map layer (not a model input)", limits: "The model learned from ERA5 only, so GFS days can behave differently." },
    { id: "glofas", name: "GloFAS river discharge", provider: "Copernicus Emergency Management Service; via Open-Meteo", desc: "Modelled daily river discharge from a global hydrological model.", coverage: "9 river cells (Surma, Kushiyara, Jamuna ×2, Ganges, Padma, Meghna, Teesta, Feni area)", resolution: "~5 km river-network cells", frequency: "Daily; 7-day forecast stored daily (since 19 Nov, not yet deployed)", range: "2016 → yesterday", role: "3 river inputs (level, 3-day change, ratio to 30-day mean); river-station charts", limits: "Modelled flow, not gauge water level; the nearest of 9 sites can be far from a district." },
    { id: "jrc", name: "JRC GloFAS flood hazard maps v2.1.2", provider: "European Commission Joint Research Centre", desc: "Where water could reach in 10- and 100-year river floods, from hydrological and hydraulic models.", coverage: "Bangladesh", resolution: "~90 m", frequency: "Static", range: "Model climatology", role: "2 inputs (share of district in each zone); Point Check depth classes; facility flags", limits: "Ignores flood embankments; river floods only, not rain waterlogging." },
    { id: "unosat", name: "UNOSAT flood analyses", provider: "United Nations Satellite Centre (UNITAR)", desc: "Analyst-made flood extents for major events.", coverage: "10 events, 2016–2024", resolution: "Rasterised to a ~90 m grid", frequency: "Per event", range: "2016–2024", role: "Point Check history and district flood history (not model labels)", limits: "Only covers areas each analysis mapped; radar misses urban water." },
    { id: "codab", name: "COD-AB v03 administrative boundaries", provider: "Bangladesh Bureau of Statistics and UN OCHA, via HDX", desc: "Official divisions, districts and upazilas.", coverage: "8 divisions, 64 districts, 507 upazilas", resolution: "Vector (simplified for the web, ≤ ~1 km at national zoom)", frequency: "Release valid 2023-05-21", range: "—", role: "District aggregation, map, place names", limits: "No union level; upazila Bangla names from OpenStreetMap where verified." },
    { id: "dem", name: "Copernicus DEM GLO-90", provider: "ESA / EU, © DLR and Airbus", desc: "A digital surface model of ground height.", coverage: "Bangladesh", resolution: "90 m (map tiles to ~280 m per pixel)", frequency: "Static (radar data 2011–2015)", range: "—", role: "Map context and elevation statistics only — not a model input", limits: "Includes trees and buildings; errors of a few metres matter in flat land." },
  ];
  const dsel = DATASETS.find((d) => d.id === dataset)!;

  // ---------- model architecture stages ----------
  const ARCH = [
    { id: "inputs", k: "Model inputs", v: "15 features", d: "Rain (5 windows), river flow (3), static geography (3), recent satellite observation (3) and the month — for one district and one target day.", file: "app/modules/prediction/features.py · FEATURE_NAMES" },
    { id: "prep", k: "Data preparation", v: "Align by district and day", d: "Rain is read at the district's weather point; river flow at its nearest river site; satellite passes before the target day; missing values stay missing (NaN), never filled with zero.", file: "app/modules/prediction/service.py" },
    { id: "features", k: "Feature generation", v: "Sums, ratios, recency", d: "Rain sums over 1/3/7/14/30 days; river level (log10), 3-day change and ratio to its 30-day mean; latest flooded share, days since that pass, 14-day maximum.", file: "features.py · build_features()" },
    { id: "run", k: "Model execution", v: meta?.algorithm?.split(" (")[0] ?? "XGBoost", d: meta?.settings ? `${meta.settings.rounds} gradient-boosted trees, depth ${meta.settings.max_depth}, learning rate ${meta.settings.eta}; each tree adds to a score turned into a raw probability.` : "Gradient-boosted trees produce a raw probability.", file: "data/models/flood_model.json" },
    { id: "output", k: "Output generation", v: "Calibrated probability + level", d: `Isotonic calibration (fitted on 2022), then Watch ≥ ${meta?.alert_thresholds?.watch ?? "0.18"} and Alert ≥ ${meta?.alert_thresholds?.alert ?? "0.375"}; stored with model version, issue time and inputs.`, file: "flood_model.meta.json · calibration, alert_thresholds" },
    { id: "geo", k: "Geographic interpretation", v: "District on the map", d: "The value describes the whole district (COD-AB boundary). The map colours the district; a Watch/Alert lists the district's registered facilities and their own flood record.", file: "Frontend map · /alerts" },
  ];
  const archSel = ARCH.find((a) => a.id === arch)!;

  const ex = example && example !== "none" ? example : null;
  const lvl = ex?.p.alert_level;

  return (
    <div className="w-full min-w-0 max-w-[100vw] overflow-x-clip bg-rk-page">
      {/* Section navigation + reading progress (scrolls sideways by itself on phones) */}
      <nav aria-label={tr("Sections of this page", "এই পাতার অংশ")} className="sticky top-16 z-[700] border-b border-rk-line bg-rk-page/95 backdrop-blur">
        <div ref={progressRef} className="h-0.5 bg-rk-brand" style={{ width: "0%" }} aria-hidden="true" />
        <div className={`${wrap} flex min-w-0 items-center gap-2`}>
          <div className="relative min-w-0 flex-1">
          {navEdge.left && (
            <button type="button" onClick={() => scrollNav(-1)} aria-label={tr("Show earlier sections", "আগের অংশগুলো দেখুন")} className="absolute left-0 top-1/2 z-10 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rk-line bg-rk-page text-rk-forest shadow-sm hover:bg-rk-secondary">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <div
            ref={navRef}
            className="overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{
              maskImage: `linear-gradient(to right, ${navEdge.left ? "transparent 0, #000 56px" : "#000 0"}, ${navEdge.right ? "#000 calc(100% - 56px), transparent 100%" : "#000 100%"})`,
              WebkitMaskImage: `linear-gradient(to right, ${navEdge.left ? "transparent 0, #000 56px" : "#000 0"}, ${navEdge.right ? "#000 calc(100% - 56px), transparent 100%" : "#000 100%"})`,
            }}
          >
          <ul className="flex w-max gap-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={active === s.id ? "location" : undefined}
                  className={`inline-flex h-9 items-center whitespace-nowrap rounded-lg px-3 text-[13px] font-semibold ${active === s.id ? "bg-rk-forest text-white" : "text-rk-forest hover:bg-rk-secondary"}`}
                >
                  {bn ? s.bn : s.en}
                </a>
              </li>
            ))}
          </ul>
          </div>
          {navEdge.right && (
            <button type="button" onClick={() => scrollNav(1)} aria-label={tr("Show more sections", "আরও অংশ দেখুন")} className="absolute right-0 top-1/2 z-10 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rk-line bg-rk-page text-rk-forest shadow-sm hover:bg-rk-secondary">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          </div>
          <button type="button" onClick={() => onAction({ kind: "view", view: "map" })} className="hidden h-9 shrink-0 items-center gap-1.5 rounded-lg bg-rk-brand px-3 text-[13px] font-bold text-white hover:bg-rk-brand-strong md:inline-flex">
            <MapIcon className="h-4 w-4" aria-hidden="true" /> {tr("Open the flood map", "বন্যার মানচিত্র")}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section id="overview" className="relative overflow-hidden text-white scroll-mt-28" style={{ backgroundImage: "var(--rk-grad-river)" }}>
        <div className={`${wrap} relative grid gap-10 py-14 md:py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center`}>
          <div>
            <p className={`${eyebrow} text-rk-mist`}>Rokkha Intelligence</p>
            <h1 className="mt-3 text-[34px] leading-[1.06] md:text-[52px] font-extrabold">
              {tr("From environmental data to flood intelligence.", "পরিবেশের তথ্য থেকে বন্যার আগাম ধারণা।")}
            </h1>
            <p className="mt-5 max-w-xl text-[18px] leading-relaxed text-white/90">
              {tr(
                "Inside the data, the model and the evidence behind Rokkha: radar satellite observations, rain and river-flow data and Bangladesh's official geography, combined by a machine-learning model that is tested on years it never saw.",
                "রক্ষার পেছনের তথ্য, মডেল ও প্রমাণ: রাডার স্যাটেলাইটের পর্যবেক্ষণ, বৃষ্টি ও নদী-প্রবাহের তথ্য এবং বাংলাদেশের সরকারি ভূগোল — একটি মেশিন-লার্নিং মডেল যা না-দেখা বছরে যাচাই করা।"
              )}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a href="#pipeline" className="inline-flex min-h-[52px] whitespace-nowrap items-center justify-center gap-2 rounded-xl bg-rk-page px-6 text-[16px] font-bold text-rk-forest hover:bg-white">
                {tr("Explore the intelligence pipeline", "প্রক্রিয়াটি দেখুন")} <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </a>
              <button type="button" onClick={() => onAction({ kind: "view", view: "map" })} className="inline-flex min-h-[52px] whitespace-nowrap items-center justify-center gap-2 rounded-xl border border-white/60 px-6 text-[16px] font-bold text-white hover:bg-white/10">
                <MapIcon className="h-5 w-5" aria-hidden="true" /> {tr("Explore the flood map", "বন্যার মানচিত্র দেখুন")}
              </button>
            </div>
            <p className="mt-6 font-mono text-[12px] text-white/70">
              {tr("Model", "মডেল")}: {meta?.model_version ?? "—"} · {tr("status", "অবস্থা")}: {modelStatus ?? "—"} · {tr("trained", "প্রশিক্ষণ")} {meta?.trained_on ?? "—"}
            </p>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/5 p-4">
            {districts && supported.size > 0 ? (
              <>
                <DistrictMap fc={districts} fillFor={(p) => (supported.has(p) ? "#6FA9B5" : "#4A5E57")} selected={null} onSelect={() => undefined} label={tr("Districts the model predicts every day", "যেসব জেলায় মডেল প্রতিদিন পূর্বাভাস দেয়")} />
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/80">
                  <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#6FA9B5]" aria-hidden="true" />{supported.size} {tr("districts predicted daily", "জেলায় প্রতিদিন পূর্বাভাস")}</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#4A5E57]" aria-hidden="true" />{64 - supported.size} {tr("not covered: radar cannot observe them", "আওতার বাইরে: রাডারে দেখা যায় না")}</span>
                </p>
              </>
            ) : (
              <p className="p-6 text-white/80">{tr("Loading model coverage…", "মডেলের আওতা লোড হচ্ছে…")}</p>
            )}
          </div>
        </div>
        <div className={`${wrap} relative pb-14`}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Radar, t: tr("Satellite flood observation", "স্যাটেলাইটে বন্যা পর্যবেক্ষণ"), d: tr("Copernicus GFM flood maps from every Sentinel-1 radar pass since April 2016, summarised per district.", "এপ্রিল ২০১৬ থেকে প্রতিটি সেন্টিনেল-১ রাডার ছবির বন্যা-মানচিত্র, জেলাভিত্তিক।") },
              { icon: CloudRain, t: tr("Rain data", "বৃষ্টির তথ্য"), d: tr("ERA5 reanalysis and GFS rain at 64 district points, daily.", "৬৪টি জেলা-বিন্দুতে দৈনিক ERA5 ও GFS বৃষ্টি।") },
              { icon: Waves, t: tr("River-flow modelling", "নদী-প্রবাহ মডেল"), d: tr("GloFAS modelled discharge at 9 river sites (modelled flow, not gauge levels).", "৯টি নদী-বিন্দুতে GloFAS মডেলের প্রবাহ (গেজ নয়)।") },
              { icon: Layers, t: tr("Official geography", "সরকারি ভূগোল"), d: tr("COD-AB v03: 8 divisions, 64 districts, 507 upazilas; a ~90 m flood-record grid.", "COD-AB v03: ৮ বিভাগ, ৬৪ জেলা, ৫০৭ উপজেলা; ~৯০ মি গ্রিড।") },
              { icon: BrainCircuit, t: tr("District flood model", "জেলাভিত্তিক বন্যা মডেল"), d: tr(`XGBoost, ${supported.size || 56} districts, a new forecast every morning.`, `XGBoost, ${supported.size || 56}টি জেলা, প্রতিদিন সকালে নতুন পূর্বাভাস।`) },
              { icon: MapPin, t: tr("Point inspection", "জায়গা যাচাই"), d: tr("Any spot: its ~90 m cell's flood record and modelled depth.", "যেকোনো জায়গা: তার ~৯০ মি ঘরের বন্যা-রেকর্ড ও মডেলের গভীরতা।") },
            ].map((c) => (
              <li key={c.t} className="rounded-2xl border border-white/15 bg-white/5 p-4">
                <c.icon className="h-5 w-5 text-rk-mist" aria-hidden="true" />
                <p className="mt-2 text-[15px] font-bold">{c.t}</p>
                <p className="mt-1 text-[13.5px] text-white/80">{c.d}</p>
              </li>
            ))}
          </ul>
          {t && (
            <p className="mt-6 max-w-3xl text-[15px] text-white/90">
              {tr(
                `On 2023–2024, years it never saw while learning, the model ranks flood days better than both simple baselines (PR-AUC ${t.model.pr_auc} vs ${t.baseline_persistence.pr_auc} and ${t.baseline_climatology.pr_auc}). Most of that skill comes from recent satellite observations — see Performance for what it does less well.`,
                `২০২৩–২০২৪ এ (শেখার সময় না-দেখা বছর) মডেল দুটি সাধারণ তুলনার চেয়ে ভালো (PR-AUC ${t.model.pr_auc} বনাম ${t.baseline_persistence.pr_auc} ও ${t.baseline_climatology.pr_auc})। দক্ষতার বড় অংশ সাম্প্রতিক স্যাটেলাইট পর্যবেক্ষণ থেকে।`
              )}
            </p>
          )}
        </div>
      </section>

      {/* DATA SOURCES */}
      <section id="data" className="scroll-mt-28">
        <div className={`${wrap} py-16 md:py-20`}>
          <p className={`${eyebrow} text-rk-clay-text`}>{tr("Data sources", "তথ্যের উৎস")}</p>
          <h2 className={`${h2} text-rk-forest`}>{tr("What powers Rokkha", "রক্ষা কোন তথ্যে চলে")}</h2>
          <Lvl level="Understand" />
          <p className="max-w-3xl text-[17px] leading-relaxed text-rk-ink">
            {tr("Four kinds of open data feed the system:", "চার ধরনের উন্মুক্ত তথ্য:")}{" "}
            <Term k="sar">{tr("radar satellite", "রাডার স্যাটেলাইট")}</Term> {tr("observations of flood water, rain from a", "থেকে বন্যার পানির পর্যবেক্ষণ,")} <Term k="reanalysis">{tr("reanalysis", "রিঅ্যানালাইসিস")}</Term>{" "}
            {tr("and a weather model, modelled", "ও আবহাওয়া মডেলের বৃষ্টি, মডেলের")} <Term k="discharge">{tr("river discharge", "নদী-প্রবাহ")}</Term>
            {tr(", and official geography with flood-history and", ", এবং সরকারি ভূগোল, বন্যার ইতিহাস ও")} <Term k="hazardmap">{tr("hazard maps", "ঝুঁকি-মানচিত্র")}</Term>.{" "}
            {tr("Each has its own", "প্রতিটির নিজস্ব")} <Term k="resolution">{tr("spatial resolution", "স্থানিক রেজোলিউশন")}</Term>{tr(", update rhythm and limits.", ", হালনাগাদের ছন্দ ও সীমাবদ্ধতা আছে।")}
          </p>
          <ul className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              { icon: Radar, t: tr("Satellite radar", "স্যাটেলাইট রাডার"), d: tr("Sentinel-1 sees through cloud and at night; calm flood water looks dark.", "সেন্টিনেল-১ মেঘ ভেদ করে ও রাতে দেখে; স্থির পানি অন্ধকার দেখায়।"), c: "text-rk-river-text" },
              { icon: CloudRain, t: tr("Rain", "বৃষ্টি"), d: tr("Rain that has already fallen is the strongest weather signal for floods.", "পড়ে যাওয়া বৃষ্টি বন্যার সবচেয়ে শক্ত আবহাওয়া-সংকেত।"), c: "text-rk-brand" },
              { icon: Waves, t: tr("River flow", "নদী-প্রবাহ"), d: tr("Modelled flow at 9 river sites — not gauge water levels.", "৯টি নদী-বিন্দুতে মডেলের প্রবাহ — গেজ নয়।"), c: "text-rk-river-text" },
              { icon: Database, t: tr("Geography and history", "ভূগোল ও ইতিহাস"), d: tr("Official boundaries, 10 observed flood events, modelled hazard zones.", "সরকারি সীমানা, ১০টি পর্যবেক্ষিত বন্যা, মডেলের ঝুঁকি-এলাকা।"), c: "text-rk-clay-text" },
            ].map((c) => (
              <li key={c.t} className="border-t-2 border-rk-line pt-3">
                <c.icon className={`h-5 w-5 ${c.c}`} aria-hidden="true" />
                <p className="mt-1.5 text-[15px] font-bold text-rk-forest">{c.t}</p>
                <p className="mt-0.5 text-[14px] text-rk-muted">{c.d}</p>
              </li>
            ))}
          </ul>

          <Lvl level="Explore" />
          <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
            <div role="tablist" aria-label={tr("Explore the dataset catalogue", "তথ্যের তালিকা")} className="flex gap-1.5 overflow-x-auto lg:flex-col">
              {DATASETS.map((d) => (
                <button key={d.id} role="tab" aria-selected={dataset === d.id} aria-controls="rk-dataset-panel" type="button" onClick={() => setDataset(d.id)}
                  className={`shrink-0 rounded-xl border px-3 py-2.5 text-left text-[13.5px] font-semibold ${dataset === d.id ? "border-rk-brand bg-rk-brand-soft text-rk-forest" : "border-rk-line bg-rk-surface text-rk-ink hover:bg-rk-secondary"}`}>
                  {d.name}
                </button>
              ))}
            </div>
            <div id="rk-dataset-panel" role="tabpanel" className="rounded-2xl border border-rk-line bg-rk-surface p-5">
              <h3 className="text-xl font-extrabold text-rk-forest">{dsel.name}</h3>
              <p className="mt-1 text-[14.5px] text-rk-ink">{dsel.desc}</p>
              <dl className="mt-4 grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2">
                {[["Provider", dsel.provider], ["Coverage", dsel.coverage], ["Resolution", dsel.resolution], ["Update frequency", dsel.frequency], ["Date range", dsel.range], ["Role in Rokkha", dsel.role]].map(([k, v]) => (
                  <div key={k}><dt className="font-mono text-[11px] uppercase tracking-wider text-rk-muted">{k}</dt><dd className="mt-0.5 text-rk-ink">{v}</dd></div>
                ))}
              </dl>
              <p className="mt-4 rounded-lg bg-rk-warning-soft px-3 py-2 text-[13.5px] text-rk-ink"><strong>Known limitations: </strong>{dsel.limits}</p>
            </div>
          </div>

          <div className="mt-8">
            <ChartFrame
              id="cov"
              title={tr("How much the satellite saw, month by month", "মাসে মাসে স্যাটেলাইট কতটা দেখেছে")}
              kind="observation"
              measures="District-passes per month across 64 districts: usable (pass saw ≥ 50 % of the district) and flood-labelled (usable and ≥ 10 % of seen land flooded — the model's label rule)"
              units="count of district-passes"
              period={`April 2016 – ${cov.months[cov.months.length - 1].month}; April–November only (December–March not collected)`}
              source={`Copernicus GFM, derived from ${cov.derived_from}`}
              howToRead="Each point is one month. Gaps are the dry months that are not collected. Shaded bands show how each year is used by the model."
              takeaway="Usable passes are fairly steady from 2017 on, so the years are comparable. Flood labels cluster in monsoon months — the highest are July 2020 (55) and June 2022 (52); 2023 had the fewest (25), so the test years contain relatively few floods. Training, validation and test years never overlap."
              limits="Counts depend on satellite revisit and GFM's exclusion mask; a month with fewer passes is not a drier month. GFM processing changed to v4.x from April 2025."
              controls={
                <div className="flex flex-wrap items-center gap-3">
                  <div role="group" aria-label="Time range" className="flex flex-wrap gap-1">
                    {([["all", "All years"], ["train", "Training 2016–21"], ["val", "Validation 2022"], ["test", "Test 2023–24"], ["check", "Check 2025"], ["live", "Live 2026"]] as const).map(([k, l]) => (
                      <button key={k} type="button" aria-pressed={covRange === k} onClick={() => setCovRange(k)} className={`min-h-8 rounded-lg border px-2.5 text-[12px] font-semibold ${covRange === k ? "border-rk-brand bg-rk-brand-soft text-rk-forest" : "border-rk-line text-rk-ink"}`}>{l}</button>
                    ))}
                  </div>
                  <Legend series={covSeries} hidden={covHidden} onToggle={(id) => setCovHidden((h) => toggle(h, id))} />
                </div>
              }
            >
              <LineChart
                xLabels={covX}
                fullLabels={covFull}
                series={covSeries}
                hidden={covHidden}
                yMax={covMax}
                yTicks={Array.from({ length: Math.floor(covMax / 100) + 1 }, (_, k) => k * 100)}
                yLabel="district-passes per month"
                xTickEvery={covRange === "all" ? 9 : 1}
                notes={[
                  ...(v4X >= 0 ? [{ x: v4X, text: "GFM v4.x from Apr 2025" }] : []),
                  ...(covRows.length && covRows[covRows.length - 1].month === dhakaToday().slice(0, 7) ? [{ x: covX.length - 1, text: "month in progress" }] : []),
                ]}
                caption="Usable and flood-labelled satellite district-passes per month"
              />
            </ChartFrame>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <ChartFrame
              id="river"
              title={tr("River flow at a followed site", "একটি নদী-বিন্দুর প্রবাহ")}
              kind="model-output"
              measures="Daily mean river discharge at one GloFAS river cell; dashed = forecast days; dotted = mean of the 30 days before the latest value"
              units="m³/s"
              period="Last 90 days plus any stored forecast days"
              source="GloFAS via Open-Meteo, as stored by Rokkha's daily update"
              takeaway="Shows the river signal the model uses (level, change and ratio to its usual level) — modelled flow, not a gauge reading."
              limits="One model cell per site; no danger level exists for modelled flow."
              controls={
                stations ? (
                  <label className="flex flex-wrap items-center gap-2 text-[13px] text-rk-ink">
                    <span className="font-semibold">{tr("Station", "স্টেশন")}</span>
                    <select value={station?.id ?? ""} onChange={(e) => setStation(stations.find((x) => x.id === e.target.value) ?? null)} className="h-9 rounded-lg border border-rk-line bg-rk-surface px-2 text-[13px]">
                      {stations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </label>
                ) : null
              }
            >
              {station ? <Hydrograph series={station.series} usual={station.usual} bn={bn} /> : <p className="text-rk-muted">{tr("Loading river data…", "নদীর তথ্য লোড হচ্ছে…")}</p>}
            </ChartFrame>
            <ChartFrame
              id="events"
              title={tr("Observed flood events (UNOSAT)", "পর্যবেক্ষিত বন্যা (UNOSAT)")}
              kind="observation"
              measures="Flood area mapped in each UNOSAT satellite analysis"
              units="km² (bar height); position = event dates"
              period="2016–2024 (10 events)"
              source="UNOSAT via Rokkha's flood-history files (GET /geospatial/flood/events)"
              takeaway="These ten mapped events give Point Check its per-cell flood history; they are not the model's training labels."
              limits="An analysis maps only the area and dates it covered; areas not analysed are unknown, not dry."
            >
              <div className="rounded-xl bg-rk-forest p-3">{events && events.length ? <EventTimeline events={events} caption="Ten UNOSAT flood analyses, 2016 to 2024, by date and mapped flood area" /> : <p className="text-white/70">{tr("Loading…", "লোড হচ্ছে…")}</p>}</div>
            </ChartFrame>
          </div>

          <Lvl level="Investigate" />
          <div className="grid gap-x-8 md:grid-cols-2">
            <Deep bn={bn} action={tr("Read the technical methodology: ", "প্রযুক্তিগত পদ্ধতি পড়ুন: ")} title={tr("satellite flood labels (Copernicus GFM)", "স্যাটেলাইটের বন্যা-লেবেল (Copernicus GFM)")}>
              <p>Source: Copernicus Emergency Management Service, Global Flood Monitoring (GFM), Sentinel-1 based, read from EODC's open archive (cloud-optimised GeoTIFF; GFM product grid 20 m). Period used: April 2016 → present, refreshed daily. GFM removes normal permanent and seasonal water and applies an exclusion mask where radar cannot detect water reliably (e.g. dense forest, built-up land, radar shadow and layover in steep terrain).</p>
              <p>Rokkha's rule: a pass "observes flooding" in a district when it maps at least 50 % of the district and at least 10 % of that observed land is flood. Training used GFM v3.1; passes since April 2025 come from v4.x. Licence: CEMS-FLOODS terms (free, attribution, not a warning).</p>
            </Deep>
            <Deep bn={bn} action={tr("Read the technical methodology: ", "প্রযুক্তিগত পদ্ধতি পড়ুন: ")} title={tr("rain (ERA5 and GFS)", "বৃষ্টি (ERA5 ও GFS)")}>
              <p>ERA5 (ECMWF, Copernicus C3S) daily totals 00–24 UTC, about 5 days late; GFS (NOAA) fills the most recent days in live use (the model was trained on ERA5 only — a known difference). 64 district points chosen by scripts/build_ingestion_sites.py. Retrieved through Open-Meteo (CC BY 4.0) with an hourly/daily call budget. Rain forecasts (GFS hourly, 72 h) are collected for the map, not used by the model.</p>
            </Deep>
            <Deep bn={bn} action={tr("Read the technical methodology: ", "প্রযুক্তিগত পদ্ধতি পড়ুন: ")} title={tr("river flow (GloFAS)", "নদী-প্রবাহ (GloFAS)")}>
              <p>Nine river cells were chosen and checked by scripts/build_ingestion_sites.py: the nearby GloFAS cells were compared on their July–August 2020 mean discharge (at least 100 m³/s required) so each site sits on the main channel; the move from the named place is recorded per site. Every district uses its nearest site — sometimes far away. Inputs: log10 of yesterday's discharge, its change over 3 days and its ratio to the mean of the 30 days ending two days before.</p>
            </Deep>
            <Deep bn={bn} action={tr("Read the technical methodology: ", "প্রযুক্তিগত পদ্ধতি পড়ুন: ")} title={tr("boundaries, UNOSAT and JRC", "সীমানা, UNOSAT ও JRC")}>
              <p>COD-AB v03 (BBS/OCHA via HDX, CC BY-IGO, valid 2023-05-21): 8 / 64 / 507 units. UNOSAT satellite flood analyses (CC BY-SA), 10 events, rasterised to a ~90 m grid (data/flood/flood_grid.npz) together with JRC GloFAS flood hazard maps v2.1.2 (© EU, CC BY 4.0; ~90 m; 10- and 100-year return periods; embankments ignored) and permanent water. Terrain on the map: Copernicus DEM GLO-90 (map context only, not a model input).</p>
            </Deep>
          </div>
        </div>
      </section>

      {/* PIPELINE */}
      <section id="pipeline" className="scroll-mt-28 bg-rk-forest text-white">
        <div className={`${wrap} py-16 md:py-20`}>
          <p className={`${eyebrow} text-rk-mist/80`}>{tr("How Rokkha thinks", "রক্ষা কীভাবে কাজ করে")}</p>
          <h2 className={h2}>{tr("Three separate pipelines, one model, one map.", "তিনটি আলাদা তথ্য-ধারা, একটি মডেল, একটি মানচিত্র।")}</h2>
          <Lvl level="Understand" dark />
          <p className={`${lead} text-white/85`}>
            {tr(
              "Satellite observations, weather and river data, and geography are prepared separately and only meet when the model's 15 inputs are built. The point record used by Point Check is a fourth, separate path that never goes through the model. Choose a step to see how the data is processed: what goes in, what happens and what comes out.",
              "স্যাটেলাইট, আবহাওয়া-নদী ও ভূগোলের তথ্য আলাদাভাবে তৈরি হয় এবং মডেলের ১৫টি ইনপুট তৈরির সময় মেলে। বিন্দু-যাচাইয়ের রেকর্ড আলাদা পথ, মডেলের মধ্যে যায় না। একটি ধাপ বেছে নিন।"
            )}
          </p>
          <Lvl level="Explore" dark />
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[1fr_auto_1.2fr] md:items-center">
                <div className="space-y-2">
                  {STAGES.filter((s) => ["A", "B", "C"].includes(s.lane)).map((s) => <StageBtn key={s.id} s={s} active={stage === s.id} onPick={setStage} />)}
                </div>
                <div className="hidden md:flex flex-col items-center text-rk-mist/70" aria-hidden="true">
                  <span className="font-mono text-[11px]">join</span>
                  <ArrowRight className="h-6 w-6" />
                </div>
                <ol className="space-y-2">
                  {STAGES.filter((s) => s.lane === "M").map((s, i) => (
                    <li key={s.id}>
                      <StageBtn s={s} active={stage === s.id} onPick={setStage} />
                      {i < 4 && <div className="mx-auto h-3 w-0.5 bg-rk-mist/40" aria-hidden="true" />}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="mt-4 border-t border-white/15 pt-4 md:w-1/2">
                {STAGES.filter((s) => s.lane === "D").map((s) => <StageBtn key={s.id} s={s} active={stage === s.id} onPick={setStage} />)}
              </div>
            </div>
            <aside aria-live="polite" className="rounded-2xl border border-white/15 bg-white/5 p-5 lg:sticky lg:top-32 lg:self-start">
              <p className="font-mono text-[11px] uppercase tracking-wider text-rk-warning-accent">{cur.status}</p>
              <h3 className="mt-1 text-xl font-extrabold">{cur.title}</h3>
              <dl className="mt-3 space-y-2.5 text-[14px]">
                <div><dt className="font-mono text-[11px] uppercase tracking-wider text-rk-mist/70">In</dt><dd className="text-white/90">{cur.in}</dd></div>
                <div><dt className="font-mono text-[11px] uppercase tracking-wider text-rk-mist/70">What happens</dt><dd className="text-white/90">{cur.does}</dd></div>
                <div><dt className="font-mono text-[11px] uppercase tracking-wider text-rk-mist/70">Out</dt><dd className="text-white/90">{cur.out}</dd></div>
                <div><dt className="font-mono text-[11px] uppercase tracking-wider text-rk-mist/70">Built with</dt><dd className="font-mono text-[12.5px] text-rk-mist">{cur.tech}</dd></div>
              </dl>
            </aside>
          </div>
        </div>
      </section>

      {/* ML METHODOLOGY */}
      <section id="engine" className="scroll-mt-28 bg-rk-secondary">
        <div className={`${wrap} py-16 md:py-20`}>
          <p className={`${eyebrow} text-rk-clay-text`}>{tr("ML methodology", "মডেলের পদ্ধতি")}</p>
          <h2 className={`${h2} text-rk-forest`}>{tr("A calibrated gradient-boosted tree model", "ক্যালিব্রেট করা গ্রেডিয়েন্ট-বুস্টেড ট্রি মডেল")}</h2>
          <Lvl level="Understand" />
          <p className="max-w-3xl text-[17px] leading-relaxed text-rk-ink">
            {tr("Every morning, for each district, the model answers one question: how likely is it that a satellite pass today sees this district flooded? It is a", "প্রতিদিন সকালে প্রতিটি জেলার জন্য মডেল একটি প্রশ্নের উত্তর দেয়: আজ স্যাটেলাইটে এই জেলা প্লাবিত দেখার সম্ভাবনা কত? এটি একটি")}{" "}
            <Term k="gbt">{tr("gradient-boosted tree", "গ্রেডিয়েন্ট-বুস্টেড ট্রি")}</Term> {tr("model fed by", "মডেল, যার ইনপুট")} <Term k="feature">{tr("engineered features", "তৈরি করা বৈশিষ্ট্য")}</Term>{tr(", with", ", সঙ্গে")} <Term k="calibration">{tr("calibrated", "ক্যালিব্রেট করা")}</Term>{" "}
            {tr("probabilities. Running it on new data is called", "সম্ভাবনা। নতুন তথ্যে চালানোকে বলে")} <Term k="inference">{tr("inference", "ইনফারেন্স")}</Term>.{" "}
            {tr("It does not predict depth, extent inside the district, or floods days ahead.", "এটি গভীরতা, জেলার ভেতরের বিস্তার বা কয়েক দিন পরের বন্যা অনুমান করে না।")}
          </p>

          <Lvl level="Explore" />
          <h3 className="text-lg font-extrabold text-rk-forest">{tr("View the model architecture", "মডেলের কাঠামো দেখুন")}</h3>
          <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_380px]">
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Model architecture stages">
              {ARCH.map((a, i) => (
                <li key={a.id}>
                  <button type="button" aria-pressed={arch === a.id} onClick={() => setArch(a.id)}
                    className={`h-full w-full rounded-2xl border p-4 text-left ${arch === a.id ? "border-rk-brand bg-rk-surface shadow-[var(--rk-shadow-float)]" : "border-rk-line bg-rk-surface/70 hover:bg-rk-surface"}`}>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-rk-muted">{i + 1}. {a.k}</span>
                    <span className="mt-1 block text-[15px] font-extrabold text-rk-forest">{a.v}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div aria-live="polite" className="rounded-2xl border border-rk-line bg-rk-surface p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-rk-clay-text">{archSel.k}</p>
              <p className="mt-1 text-lg font-extrabold text-rk-forest">{archSel.v}</p>
              <p className="mt-2 text-[14.5px] text-rk-ink">{archSel.d}</p>
              <p className="mt-3 font-mono text-[12px] text-rk-muted">{archSel.file}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <ChartFrame
              id="imp"
              title={tr("What the model relies on", "মডেল কীসের ওপর নির্ভর করে")}
              kind="model-output"
              measures="Share of total gain by input group (XGBoost importance_type = gain, normalised to 1)"
              units="share of gain (%)"
              period="Training data 2016–2021"
              source="flood_model.meta.json · input_importance"
              howToRead="Longer bars mean the trees improved more by splitting on those inputs. Groups add up to 100 %."
              takeaway="Recent satellite observation dominates (about 59 %): the model leans heavily on knowing a flood is already visible. Rain is second."
              limits="Gain is a training diagnostic, not a causal explanation and not a reason for any one district's forecast. Correlated inputs share credit unpredictably."
            >
              {groups.length ? (
                <HBars rows={groups.map(([g, v]) => ({ label: g === "Geography" ? "Geography (distance to river, hazard zones)" : g, value: v, color: GROUP_COLOR[g] }))} max={0.65} format={(v) => pct(v)} caption="Share of gain by input group" />
              ) : (
                <p className="text-rk-muted">{tr("Loading…", "লোড হচ্ছে…")}</p>
              )}
              {imp && (
                <Deep bn={bn} action={tr("Explore all 15 inputs: ", "১৫টি ইনপুট দেখুন: ")} title={tr("gain per input", "প্রতিটি ইনপুটের অংশ")}>
                  <HBars
                    rows={Object.entries(imp).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: `${FEATURE_INFO[k]?.label ?? k} (${k})`, value: v, color: GROUP_COLOR[FEATURE_INFO[k]?.group] }))}
                    max={0.4}
                    format={(v) => v.toFixed(3)}
                    caption="Share of gain per input"
                  />
                  <p className="text-[12.5px] text-rk-muted">River flow (8.8 %) and the static distance to the river site (3.5 %) are shown separately; an earlier summary had combined them as “river flow 12 %”.</p>
                </Deep>
              )}
            </ChartFrame>
            <figure className="m-0 rounded-2xl border border-rk-line bg-rk-surface p-5">
              <h3 className="text-lg font-extrabold text-rk-forest">{tr("Training and data split", "প্রশিক্ষণ ও তথ্য-বিভাজন")}</h3>
              <p className="mt-1 text-[13.5px] text-rk-muted">
                {tr("Split by year, never shuffled, so each later year is a real look at the future. Unit:", "বছর অনুযায়ী ভাগ, এলোমেলো নয়। একক:")} <Term k="districtday">{tr("district-day", "জেলা-দিন")}</Term>.
              </p>
              {meta?.rows && (
                <table className="mt-4 w-full text-left text-[14px]">
                  <thead className="font-mono text-[11px] uppercase tracking-wider text-rk-muted">
                    <tr><th className="py-1.5">Years</th><th>Used for</th><th className="text-right">District-days</th><th className="text-right">Floods</th></tr>
                  </thead>
                  <tbody className="divide-y divide-rk-line">
                    <tr><td className="py-2 font-mono">2016–2021</td><td>training</td><td className="text-right font-mono">{meta.rows.train_2016_2021.rows.toLocaleString("en-GB")}</td><td className="text-right font-mono">{meta.rows.train_2016_2021.floods}</td></tr>
                    <tr><td className="py-2 font-mono">2022</td><td>settings, calibration, thresholds</td><td className="text-right font-mono">{meta.rows.validation_2022.rows.toLocaleString("en-GB")}</td><td className="text-right font-mono">{meta.rows.validation_2022.floods}</td></tr>
                    <tr><td className="py-2 font-mono">2023–2024</td><td><strong>test, used once</strong> (<Term k="heldout">held out</Term>)</td><td className="text-right font-mono">{meta.rows.test_2023_2024.rows.toLocaleString("en-GB")}</td><td className="text-right font-mono">{meta.rows.test_2023_2024.floods}</td></tr>
                    <tr><td className="py-2 font-mono">2025</td><td>later check, never used before</td><td className="text-right font-mono">{c25.model.rows.toLocaleString("en-GB")}</td><td className="text-right font-mono">{c25.model.floods}</td></tr>
                  </tbody>
                </table>
              )}
              <p className="mt-3 text-[12px] text-rk-muted">Source: flood_model.meta.json (rows), check_2025.json. A district-day enters only when its rain inputs exist and a satellite pass on that day observed at least half of the district (the label).</p>
            </figure>
          </div>

          <Lvl level="Investigate" />
          <div className="grid gap-x-8 md:grid-cols-2">
            <Deep bn={bn} action={tr("Read the technical explanation: ", "প্রযুক্তিগত ব্যাখ্যা পড়ুন: ")} title={tr("training procedure", "প্রশিক্ষণ পদ্ধতি")}>
              <p>scripts/build_training_table.py joins satellite labels, rain, river flow and static geography per district-day (table hash recorded in the model file). scripts/train_flood_model.py tries 12 settings (max depth 2/3/4/6 × min child weight 1/5/20), keeps the best by 2022 PR-AUC (eval metric aucpr), fits isotonic calibration on 2022, chooses Watch (highest cut-off catching ≥ 80 % of 2022 floods) and Alert (best F1) thresholds, then measures 2023–2024 once. Extra analyses: onset days, without satellite inputs, one division held out at a time.</p>
            </Deep>
            <Deep bn={bn} action={tr("Read the technical explanation: ", "প্রযুক্তিগত ব্যাখ্যা পড়ুন: ")} title={tr("inference in production", "চালু ব্যবস্থায় ইনফারেন্স")}>
              <p>app/modules/prediction/service.py uses the same feature code as training. Districts lacking required rain are stored as "inputs missing"; the 8 radar-excluded districts as "unsupported". Predictions are stored per district and day with model version, issue time, inputs and data-through date; re-predicting replaces. The daily GitHub Actions job runs it at 09:30 Bangladesh time.</p>
            </Deep>
          </div>
        </div>
      </section>

      {/* MODEL EVALUATION */}
      <section id="performance" className="scroll-mt-28">
        <div className={`${wrap} py-16 md:py-20`}>
          <p className={`${eyebrow} text-rk-clay-text`}>{tr("Model evaluation", "মডেল যাচাই")}</p>
          <h2 className={`${h2} text-rk-forest`}>{tr("Measured on years the model never saw", "মডেলের না-দেখা বছরে মাপা")}</h2>
          <Lvl level="Understand" />
          <p className="max-w-3xl text-[17px] leading-relaxed text-rk-ink">
            {tr("Floods are rare — about 2 of every 100 district-days — so plain accuracy would look excellent even for a model that never warns. Rokkha reports", "বন্যা বিরল — প্রতি ১০০ জেলা-দিনে প্রায় ২ — তাই সাধারণ নির্ভুলতা বিভ্রান্তিকর। রক্ষা জানায়")}{" "}
            <Term k="prauc">PR-AUC</Term>, <Term k="rocauc">ROC-AUC</Term>, <Term k="brier">{tr("Brier score", "ব্রায়ার স্কোর")}</Term>, <Term k="precision">{tr("precision", "প্রিসিশন")}</Term> {tr("and", "ও")} <Term k="recall">{tr("recall", "রিকল")}</Term>
            {tr(", and compares the model with two simple", ", এবং মডেলকে দুটি সাধারণ")} <Term k="baseline">{tr("baselines", "তুলনা-নিয়মের")}</Term> {tr("on", "সঙ্গে তুলনা করে,")} <Term k="heldout">{tr("held-out years", "আলাদা রাখা বছরে")}</Term>.
          </p>

          <Lvl level="Explore" />
          {t ? (
            <>
              <ChartFrame
                id="perf"
                title={tr("Performance across evaluation periods", "বিভিন্ন যাচাই-সময়ে কার্যকারিতা")}
                kind="evaluation"
                measures={`${metric.label} of the model and of the baselines${metric.lowerBetter ? " (lower is better)" : ""}`}
                units={metric.id === "brier" ? "squared probability error (0 = perfect)" : "0 to 1"}
                period="2022 validation · 2023–2024 test · 2025 later check"
                source="flood_model.meta.json (validation_results, test_results) and check_2025.json"
                howToRead="Choose a metric; click a legend entry to hide or show a line; move over the chart to read values. Points are evaluation periods, not a time series of daily skill."
                takeaway={
                  perfMetric === "alert_recall"
                    ? "At the Alert level the model catches fewer floods than the persistence rule (0.42 vs 0.47 in 2023–2024, 0.46 vs 0.54 in 2025) — it trades recall for precision. The Watch level catches more (see the next chart)."
                    : perfMetric === "alert_precision"
                      ? "Alert warnings are right more often than either baseline's warnings on both held-out periods. 2022 is optimistic because thresholds were chosen on it."
                      : "On this ranking/probability measure the model beats both baselines on both held-out periods. 2022 looks best only because settings, calibration and thresholds were chosen on it — read 2023–2024 and 2025 as the honest numbers."
                }
                limits="Baselines were not computed for 2022; the no-satellite variant only for 2023–2024. No confidence intervals were computed; each period is a single sample of weather."
                controls={
                  <div className="flex flex-wrap items-center gap-3">
                    <div role="group" aria-label="Metric" className="flex flex-wrap gap-1">
                      {METRICS.map((m) => (
                        <button key={m.id} type="button" aria-pressed={perfMetric === m.id} onClick={() => setPerfMetric(m.id)} className={`min-h-8 rounded-lg border px-2.5 text-[12px] font-semibold ${perfMetric === m.id ? "border-rk-brand bg-rk-brand-soft text-rk-forest" : "border-rk-line text-rk-ink"}`}>{m.label}</button>
                      ))}
                    </div>
                    <Legend series={perfSeries} hidden={perfHidden} onToggle={(id) => setPerfHidden((h) => toggle(h, id))} />
                  </div>
                }
              >
                <LineChart
                  xLabels={PERIODS}
                  series={perfSeries}
                  hidden={perfHidden}
                  yMax={metric.max}
                  yTicks={metric.max === 1 ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.01, 0.02, 0.03, 0.04, 0.05]}
                  yLabel={metric.label}
                  format={(v) => (metric.id === "brier" ? v.toFixed(4) : v.toFixed(3))}
                  bands={[{ from: 0, to: 0, label: "used for tuning", color: "rgba(233,185,73,0.12)" }]}
                  caption={`${metric.label} by evaluation period`}
                />
                <p className="text-[12px] text-rk-muted">{tr(`About ${metric.label}:`, `${metric.label} সম্পর্কে:`)} {GLOSSARY[metric.term].def}</p>
              </ChartFrame>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <ChartFrame
                  id="pr"
                  title={tr("Warnings: caught floods vs false alarms", "সতর্কতা: ধরা বন্যা বনাম ভুল সংকেত")}
                  kind="evaluation"
                  measures="Recall (x) and precision (y) of each yes/no warning rule"
                  units="share 0–1"
                  period={scatterPeriod === "test" ? "2023–2024 test" : "2025 later check"}
                  source="flood_model.meta.json / check_2025.json"
                  howToRead="Up is fewer false alarms, right is fewer missed floods. Each point is one rule on the chosen period."
                  takeaway="Watch catches more floods with more false alarms; Alert is more precise but misses more. Without satellite inputs, Watch flags almost everything (recall 0.93, precision 0.07)."
                  limits="Only these real rules are shown; the no-satellite variant was not evaluated on 2025."
                  controls={
                    <div className="flex flex-wrap items-center gap-3">
                      <div role="group" aria-label="Period" className="flex gap-1">
                        {([["test", "2023–2024"], ["check", "2025"]] as const).map(([k, l]) => (
                          <button key={k} type="button" aria-pressed={scatterPeriod === k} onClick={() => setScatterPeriod(k)} className={`min-h-8 rounded-lg border px-2.5 text-[12px] font-semibold ${scatterPeriod === k ? "border-rk-brand bg-rk-brand-soft text-rk-forest" : "border-rk-line text-rk-ink"}`}>{l}</button>
                        ))}
                      </div>
                      <Legend
                        series={[{ id: "model", label: "Model", color: "#247A5B", values: [] }, { id: "baselines", label: "Baselines", color: "#B87955", values: [] }, ...(scatterPeriod === "test" ? [{ id: "ablation", label: "No satellite inputs", color: "#6FA9B5", values: [] }] : [])]}
                        hidden={scatterHidden}
                        onToggle={(id) => setScatterHidden((h) => toggle(h, id))}
                      />
                    </div>
                  }
                >
                  <Scatter points={scatterPoints} hidden={scatterHidden} caption="Precision against recall for each warning rule" />
                </ChartFrame>
                <ChartFrame
                  id="cal"
                  title={tr("Is the probability honest?", "সম্ভাবনার হিসাব কি বাস্তবের সঙ্গে মেলে?")}
                  kind="evaluation"
                  measures="For days grouped by predicted probability: mean prediction (x) vs share that flooded (y); dot size = days in the group"
                  units="probability 0–1"
                  period="2023–2024 test and 2025 later check"
                  source="flood_model.meta.json (calibration_table) and check_2025.json (reliability)"
                  howToRead="Dots on the dashed line mean the stated probability matches reality. Toggle a period; hover a dot for its numbers."
                  takeaway="Most days sit near zero and are well calibrated; the high bins slightly over-predict in 2023–2024 (0.94 stated vs 0.81 observed)."
                  limits="Bins with few days (some have under 10) are noisy; read the dot size before reading the position."
                  controls={<Legend series={[{ id: "test", label: "2023–2024", color: "#247A5B", values: [] }, { id: "check", label: "2025", color: "#B87955", values: [] }]} hidden={relHidden} onToggle={(id) => setRelHidden((h) => toggle(h, id))} />}
                >
                  <ReliabilityMulti
                    sets={[
                      { id: "test", label: "2023–2024", color: "#247A5B", bins: t.model.calibration_table },
                      { id: "check", label: "2025", color: "#B87955", bins: c25.reliability },
                    ]}
                    hidden={relHidden}
                    caption="Calibration of predicted probabilities, test years and 2025"
                  />
                </ChartFrame>
              </div>

              <figure className="m-0 mt-6 overflow-hidden rounded-2xl border border-rk-line bg-rk-surface">
                <figcaption className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
                  <span className="text-lg font-extrabold text-rk-forest">{tr("Evaluation summary", "যাচাইয়ের সারাংশ")}</span>
                  <span className="font-mono text-[12px] text-rk-muted">model {meta?.model_version} · unit: district-day · thresholds Watch {meta?.alert_thresholds?.watch} / Alert {meta?.alert_thresholds?.alert}</span>
                </figcaption>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-[13px]">
                    <thead className="bg-rk-secondary font-mono text-[10.5px] uppercase tracking-wider text-rk-muted">
                      <tr>
                        <th className="px-4 py-2">Evaluation</th><th>Period</th><th className="text-right">District-days</th><th className="text-right">Floods</th>
                        <th className="text-right" title={GLOSSARY.prauc.def}>PR-AUC</th><th className="text-right" title={GLOSSARY.rocauc.def}>ROC-AUC</th><th className="text-right" title={GLOSSARY.brier.def}>Brier</th>
                        <th className="text-right" title={GLOSSARY.precision.def}>Alert precision</th><th className="px-4 text-right" title={GLOSSARY.recall.def}>Alert recall</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rk-line font-mono">
                      {[
                        ["Model (tuning year — optimistic)", "2022", v22, v22?.at_alert],
                        ["Model", "2023–2024", t.model, t.model.at_alert],
                        ["Persistence baseline", "2023–2024", t.baseline_persistence, t.baseline_persistence.decision],
                        ["Climatology baseline", "2023–2024", t.baseline_climatology, t.baseline_climatology.decision],
                        ["Model without satellite inputs", "2023–2024", t.without_satellite_inputs.test, t.without_satellite_inputs.test.at_alert],
                        ["Model on onset days", "2023–2024", t.onset_days.model, null],
                        ["Model", "2025", c25.model, c25.model.at_alert],
                        ["Persistence baseline", "2025", c25.persistence, c25.persistence.decision],
                        ["Climatology baseline", "2025", c25.climatology, c25.climatology.decision],
                      ].map(([name, period, o, d]: any, idx) =>
                        o ? (
                          <tr key={idx} className={String(name).startsWith("Model") && !String(name).includes("without") && !String(name).includes("onset") && !String(name).includes("tuning") ? "bg-rk-brand-soft/60" : ""}>
                            <td className="px-4 py-2 font-sans font-semibold text-rk-forest">{name}</td><td>{period}</td>
                            <td className="text-right">{o.rows?.toLocaleString("en-GB")}</td><td className="text-right">{o.floods}</td>
                            <td className="text-right">{o.pr_auc?.toFixed(3)}</td><td className="text-right">{o.roc_auc?.toFixed(3)}</td><td className="text-right">{o.brier?.toFixed(4)}</td>
                            <td className="text-right">{d ? d.precision.toFixed(2) : "—"}</td><td className="px-4 text-right">{d ? d.recall.toFixed(2) : "—"}</td>
                          </tr>
                        ) : null
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="px-5 pb-5 pt-3 text-[12px] text-rk-muted">Baselines are yes/no rules, so their precision/recall are for the rule itself, not an Alert threshold. Onset days: the latest pass showed no flood. Hover a column heading for its definition. “—” = not measured.</p>
              </figure>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border-2 border-rk-warning-accent/60 bg-rk-warning-soft p-5">
                  <h3 className="text-lg font-extrabold text-rk-forest">{tr("Where it is weak:", "দুর্বলতা:")} <Term k="onset">{tr("the start of a flood", "বন্যার শুরু")}</Term></h3>
                  <p className="mt-2 text-[14.5px] text-rk-ink">
                    {tr(
                      `On days when the latest satellite pass showed no flood (${t.onset_days.model.rows.toLocaleString("en-GB")} days, ${t.onset_days.model.floods} floods), PR-AUC drops to ${t.onset_days.model.pr_auc}; at Watch the model caught ${t.onset_days.model.at_watch.floods_caught} and missed ${t.onset_days.model.at_watch.floods_missed}. Much of the overall skill comes from knowing a flood is already under way.`,
                      `যেদিন সর্বশেষ স্যাটেলাইট ছবিতে বন্যা ছিল না, PR-AUC ${t.onset_days.model.pr_auc}; নজরদারি স্তরে ${t.onset_days.model.at_watch.floods_caught}টি ধরেছে, ${t.onset_days.model.at_watch.floods_missed}টি ধরতে পারেনি।`
                    )}
                  </p>
                </div>
                <ChartFrame
                  id="div"
                  title={tr("New places: one division held out", "নতুন জায়গা: একটি বিভাগ বাদ রেখে")}
                  kind="evaluation"
                  measures="PR-AUC when the model is trained without a division and tested on that division's 2023–2024 days"
                  units="0 to 1"
                  period="2023–2024"
                  source="flood_model.meta.json · held_out_division"
                  takeaway="Skill varies strongly by place: high in Sylhet's haor basins, low in Barishal and Rajshahi."
                  limits="Scored only with at least 5 floods; Khulna and Rangpur had too few. Small samples."
                >
                  <HBars
                    rows={Object.entries(t.held_out_division as Record<string, any>).filter(([, v]) => v.pr_auc != null).sort((a, b) => b[1].pr_auc - a[1].pr_auc).map(([k, v]) => ({ label: `${k} (${v.floods} floods, ${v.rows} days)`, value: v.pr_auc, color: "#2C6573" }))}
                    max={1}
                    caption="PR-AUC by held-out division"
                  />
                </ChartFrame>
              </div>
              <p className="mt-6 max-w-3xl rounded-xl border border-dashed border-rk-line px-4 py-3 text-[13.5px] text-rk-muted">
                <strong className="text-rk-forest">{tr("Not measured: computational cost.", "মাপা হয়নি: গণনার খরচ।")}</strong>{" "}
                {tr(
                  "There is one production model, so there is no accuracy-versus-cost comparison to draw. Producing one would need several model variants trained the same way, with inference time and memory recorded under the same hardware.",
                  "একটিই চালু মডেল, তাই নির্ভুলতা বনাম খরচের তুলনা নেই। এর জন্য একইভাবে প্রশিক্ষিত কয়েকটি মডেল ও একই হার্ডওয়্যারে সময় ও মেমরি মাপা দরকার।"
                )}
              </p>
            </>
          ) : (
            <p className="mt-8 text-rk-muted">{tr("Model results are not available right now.", "মডেলের ফলাফল এখন পাওয়া যাচ্ছে না।")}</p>
          )}

          <Lvl level="Investigate" />
          <Deep bn={bn} action={tr("View the evaluation methodology: ", "যাচাইয়ের পদ্ধতি দেখুন: ")} title={tr("splits, baselines and checks", "বিভাজন, তুলনা ও যাচাই")}>
            <p>Year-based split (no shuffling): train 2016–2021, validation 2022 (settings, isotonic calibration, thresholds), test 2023–2024 measured once, then 2025 checked with the delivered model unchanged (scripts/check_flood_model.py). Baselines measured identically: persistence (flood if the latest pass within 30 days saw ≥ 10 % flooded) and climatology (district-month flood rate from 2016–2021, cut-off with best F1 in 2022). Extra: onset days, an ablation without the three satellite inputs, and leave-one-division-out training. Not done: confidence intervals, rolling-origin cross-validation over years, cost measurements.</p>
          </Deep>
        </div>
      </section>

      {/* OUTPUTS: a real prediction, explained */}
      <section id="outputs" className="scroll-mt-28 bg-rk-forest text-white">
        <div className={`${wrap} py-16 md:py-20`}>
          <p className={`${eyebrow} text-rk-mist/80`}>{tr("Research insights", "গবেষণার ফলাফল")}</p>
          <h2 className={h2}>{tr("What the evidence shows, and one real prediction", "প্রমাণ কী বলে, এবং একটি প্রকৃত পূর্বাভাস")}</h2>
          <Lvl level="Understand" dark />
          {t && (
            <ol className="grid gap-3 md:grid-cols-2">
              {[
                [tr("Satellite memory drives skill", "স্যাটেলাইটের স্মৃতিই দক্ষতার মূল"), tr(`Recent satellite inputs carry ~59 % of the model's gain; without them PR-AUC falls from ${t.model.pr_auc} to ${t.without_satellite_inputs.test.pr_auc}.`, `সাম্প্রতিক স্যাটেলাইট ইনপুট মডেলের ~৫৯% gain; এগুলো ছাড়া PR-AUC ${t.model.pr_auc} থেকে ${t.without_satellite_inputs.test.pr_auc}।`)],
                [tr("Starting floods are hard", "বন্যার শুরু কঠিন"), tr(`On onset days PR-AUC is ${t.onset_days.model.pr_auc}: the model mostly recognises floods already under way.`, `শুরুর দিনে PR-AUC ${t.onset_days.model.pr_auc}।`)],
                [tr("Probabilities are mostly honest", "সম্ভাবনার হিসাব মোটামুটি বাস্তবসম্মত"), tr("Low-probability days match reality closely; the highest bin over-predicts somewhat.", "কম সম্ভাবনার দিন বাস্তবের সঙ্গে মেলে; সর্বোচ্চ ঘরে কিছুটা বেশি বলে।")],
                [tr("Geography matters", "ভূগোল গুরুত্বপূর্ণ"), tr("Held-out divisions range from PR-AUC 0.10 (Rajshahi) to 0.72 (Sylhet): one national model does not fit every landscape equally.", "আলাদা রাখা বিভাগে PR-AUC ০.১০ (রাজশাহী) থেকে ০.৭২ (সিলেট)।")],
              ].map(([h, d]) => (
                <li key={h} className="rounded-xl border border-white/15 bg-white/5 p-4">
                  <p className="text-[15px] font-bold text-white">{h}</p>
                  <p className="mt-1 text-[13.5px] text-white/80">{d}</p>
                </li>
              ))}
            </ol>
          )}
          <Lvl level="Explore" dark />
          <h3 className="text-xl font-extrabold">{tr("Follow one real prediction, step by step", "একটি প্রকৃত পূর্বাভাস ধাপে ধাপে")}</h3>
          {example === null && <p className="mt-6 text-white/75">{tr("Loading the newest stored prediction…", "সর্বশেষ সংরক্ষিত পূর্বাভাস লোড হচ্ছে…")}</p>}
          {example === "none" && <p className="mt-6 text-white/75">{tr("No prediction is stored for the last four days, so no example can be shown.", "গত চার দিনের কোনো পূর্বাভাস নেই, তাই উদাহরণ দেখানো যাচ্ছে না।")}</p>}
          {ex && (
            <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
                <p className="font-mono text-[12px] text-rk-mist/80">
                  {tr("Stored prediction", "সংরক্ষিত পূর্বাভাস")} · {ex.p.name} · {ex.date} · {tr("highest of", "এর মধ্যে সর্বোচ্চ")} {ex.count} {tr("districts that day", "জেলা")}
                  {ex.p.issued_at ? ` · issued ${new Date(ex.p.issued_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} BD` : ""}
                </p>
                <h3 className="mt-2 text-lg font-extrabold">1. {tr("What the model received", "মডেল কী পেয়েছে")}</h3>
                <table className="mt-2 w-full text-left text-[13px]">
                  <tbody className="divide-y divide-white/10">
                    {Object.entries(ex.p.features || {})
                      .filter(([k]) => FEATURE_INFO[k])
                      .map(([k, v]) => (
                        <tr key={k}>
                          <td className="py-1 pr-2 text-white/80">{FEATURE_INFO[k].label}</td>
                          <td className="py-1 text-right font-mono text-rk-mist">{v == null ? "missing" : `${typeof v === "number" ? +v.toFixed(3) : v}${FEATURE_INFO[k].unit ? ` ${FEATURE_INFO[k].unit}` : ""}`}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
                  <h3 className="text-lg font-extrabold">2. {tr("What it calculated", "কী হিসাব করেছে")}</h3>
                  <p className="mt-2 text-[15px] text-white/90">
                    {tr("Calibrated probability", "ক্যালিব্রেট করা সম্ভাবনা")}: <strong className="font-mono text-2xl text-white">{((ex.p.probability as number) * 100).toFixed(1)} %</strong>
                  </p>
                  <p className="mt-1 text-[13px] text-white/75">{tr("Thresholds", "সীমা")}: {tr("Watch", "নজরদারি")} ≥ {meta?.alert_thresholds?.watch ?? "—"} · {tr("Alert", "সতর্কতা")} ≥ {meta?.alert_thresholds?.alert ?? "—"} → <strong>{lvl === "alert" ? tr("Alert", "সতর্কতা") : lvl === "watch" ? tr("Watch", "নজরদারি") : tr("no warning level", "নজরদারি বা সতর্কতা স্তর নয়")}</strong></p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
                  <h3 className="text-lg font-extrabold">3. {tr("How Rokkha shows it", "রক্ষা কীভাবে দেখায়")}</h3>
                  <p className="mt-2 text-[14px] text-white/85">
                    {tr(
                      `${ex.p.name} is coloured by its level on the forecast map; the district panel shows the probability, issue time and these inputs; a Watch or Alert would list the district's registered facilities and their own flood record.`,
                      `${ex.p.name} মানচিত্রে তার স্তর অনুযায়ী রঙ পায়; জেলার প্যানেলে সম্ভাবনা, সময় ও ইনপুট দেখায়।`
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-rk-warning-accent/60 bg-rk-warning-accent/10 p-5">
                  <h3 className="text-lg font-extrabold">4. {tr("What it does not mean", "এর মানে কী নয়")}</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-white/85">
                    <li>{tr("Not an official warning (FFWC/BWDB and the government issue those).", "সরকারি সতর্কবার্তা নয় (FFWC/BWDB ও সরকার দেয়)।")}</li>
                    <li>{tr("Not a statement about any one village or house: one value for the whole district.", "কোনো গ্রাম বা বাড়ির কথা নয়: পুরো জেলার একটি মান।")}</li>
                    <li>{tr("Not a depth or a flood map, and not a forecast beyond the target day.", "গভীরতা বা প্লাবন-মানচিত্র নয়; পরের দিনের পূর্বাভাস নয়।")}</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          <div className="mt-10 grid gap-3 md:grid-cols-5" role="list" aria-label={tr("Kinds of information", "তথ্যের ধরন")}>
            {[
              ["Observed", "Satellite saw flood water (GFM passes, UNOSAT events)."],
              ["Forecast", "The model's chance for today; rain and river-flow forecasts from weather models."],
              ["Modelled hazard", "JRC: what a 10- or 100-year flood could cover; not about today."],
              ["Risk", "Not computed as one score: Rokkha shows the pieces, not a combined index."],
              ["Official warning", "Only from FFWC (BWDB) and government authorities: ffwc.gov.bd."],
            ].map(([k, v]) => (
              <div key={k} role="listitem" className="rounded-xl border border-white/15 bg-white/5 p-4">
                <p className="font-mono text-[11px] uppercase tracking-wider text-rk-warning-accent">{k}</p>
                <p className="mt-1 text-[13.5px] text-white/85">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BANGLADESH */}
      <section id="bangladesh" className="scroll-mt-28">
        <div className={`${wrap} py-16 md:py-20`}>
          <p className={`${eyebrow} text-rk-clay-text`}>{tr("Bangladesh-specific", "বাংলাদেশ-কেন্দ্রিক")}</p>
          <h2 className={`${h2} text-rk-forest`}>{tr("Different land, different data quality", "ভিন্ন ভূমি, ভিন্ন তথ্যের মান")}</h2>
          <Lvl level="Understand" />
          <p className={`${lead} text-rk-ink`}>
            {tr(
              "Haor basins in the north-east, the great river floodplains, the coast, cities and the Chattogram hills flood differently — and satellites see them differently. Rokkha uses one national model; it has no special model per region. Choose a district to see what Rokkha really has there.",
              "উত্তর-পূর্বের হাওর, বড় নদীর প্লাবনভূমি, উপকূল, শহর ও পার্বত্য চট্টগ্রাম ভিন্নভাবে প্লাবিত হয় — স্যাটেলাইটও ভিন্নভাবে দেখে। রক্ষা একটি জাতীয় মডেল ব্যবহার করে। একটি জেলা বেছে নিন।"
            )}
          </p>
          <Lvl level="Explore" />
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-start">
            <div className="rounded-3xl bg-rk-forest p-4">
              {districts && supported.size > 0 && (
                <DistrictMap fc={districts} fillFor={(p) => (supported.has(p) ? "#6FA9B5" : "#4A5E57")} selected={sel} onSelect={setSelDistrict} label={tr("Choose a district", "একটি জেলা বেছে নিন")} />
              )}
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[12px] text-white/80">
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#6FA9B5]" aria-hidden="true" />{tr("Forecast every day", "প্রতিদিন পূর্বাভাস")}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#4A5E57]" aria-hidden="true" />{tr("Not covered", "আওতার বাইরে")}</span>
                <span className="text-white/60">{tr("Tap or press Enter on a district", "জেলায় চাপ দিন বা Enter চাপুন")}</span>
              </p>
            </div>
            <div aria-live="polite" className="rounded-2xl border border-rk-line bg-rk-surface p-5">
              {sel && selName ? (
                <>
                  <h3 className="text-2xl font-extrabold text-rk-forest">{placeName({ level: 2, pcode: sel, name: selName }, bn)}</h3>
                  <dl className="mt-4 divide-y divide-rk-line text-[14.5px]">
                    <div className="flex justify-between gap-3 py-2"><dt className="text-rk-muted">{tr("Daily forecast", "দৈনিক পূর্বাভাস")}</dt><dd className="font-semibold text-rk-forest">{supported.has(sel) ? tr("Yes", "হ্যাঁ") : tr("No — radar cannot observe it, so the model could not be trained or checked", "না — রাডারে দেখা যায় না")}</dd></div>
                    {hs && <div className="flex justify-between gap-3 py-2"><dt className="text-rk-muted">{tr("Observed in UNOSAT events", "UNOSAT ঘটনায় প্লাবিত")}</dt><dd className="font-mono">{hs.events_flooded} / {hs.events_observed}</dd></div>}
                    {hs?.hazard_share_100yr != null && <div className="flex justify-between gap-3 py-2"><dt className="text-rk-muted">{tr("Land in modelled", "মডেলের")} <Term k="returnperiod">{tr("100-year", "১০০ বছরের")}</Term> {tr("zone", "এলাকায় জমি")}</dt><dd className="font-mono">{pct(hs.hazard_share_100yr)}</dd></div>}
                    {ts && <div className="flex justify-between gap-3 py-2"><dt className="text-rk-muted">{tr("Typical ground height", "সাধারণ উচ্চতা")}</dt><dd className="font-mono">{ts.median_m} m · {pct(ts.below_5m)} {tr("below 5 m", "৫ মি-এর নিচে")}</dd></div>}
                  </dl>
                  <p className="mt-3 text-[12.5px] text-rk-muted">{tr("Sources: model file (coverage), UNOSAT and JRC (district history), Copernicus DEM GLO-90 (height). No regional accuracy is shown beyond the held-out-division test above.", "উৎস: মডেল ফাইল, UNOSAT ও JRC, Copernicus DEM। উপরের বিভাগ-পরীক্ষা ছাড়া আঞ্চলিক নির্ভুলতা দেখানো হয় না।")}</p>
                </>
              ) : (
                <p className="text-rk-muted">{tr("Choose a district on the map.", "মানচিত্রে একটি জেলা বেছে নিন।")}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* MILESTONES */}
      <section id="milestones" className="scroll-mt-28 bg-rk-secondary">
        <div className={`${wrap} py-16 md:py-20`}>
          <p className={`${eyebrow} text-rk-clay-text`}>{tr("Engineering milestones", "প্রকৌশল অগ্রগতি")}</p>
          <h2 className={`${h2} text-rk-forest`}>{tr("What was built, in order", "কী তৈরি হয়েছে, ক্রমানুসারে")}</h2>
          <p className={`${lead} text-rk-ink`}>{tr("Dates are commit dates on the main branch; the last step is in development and not yet deployed.", "তারিখগুলো মূল শাখার কমিটের তারিখ; শেষ ধাপ এখনো চালু হয়নি।")}</p>
          <ol className="relative mt-10 border-l-2 border-rk-line pl-6 md:pl-8">
            {MILESTONES.map((m) => (
              <li key={m.title} className="relative pb-8 last:pb-0">
                <span aria-hidden="true" className={`absolute -left-[33px] md:-left-[41px] top-1 h-4 w-4 rounded-full border-2 ${m.status === "deployed" ? "border-rk-brand bg-rk-brand" : "border-rk-warning-accent bg-rk-page"}`} />
                <p className="font-mono text-[12px] text-rk-muted">{m.date} · {m.status === "deployed" ? tr("deployed", "চালু") : tr("in development", "তৈরি হচ্ছে")}</p>
                <h3 className="mt-0.5 text-lg font-extrabold text-rk-forest">{m.title}</h3>
                <p className="mt-1 max-w-3xl text-[14.5px] text-rk-ink">{m.detail}</p>
                <p className="mt-1 flex items-start gap-1.5 text-[12.5px] text-rk-muted"><FileCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{m.evidence}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* LIMITATIONS */}
      <section id="limitations" className="scroll-mt-28">
        <div className={`${wrap} py-16 md:py-20`}>
          <p className={`${eyebrow} text-rk-clay-text`}>{tr("Responsible intelligence", "দায়িত্বশীল তথ্য")}</p>
          <h2 className={`${h2} text-rk-forest`}>{tr("Data honesty and limitations", "তথ্যের সততা ও সীমাবদ্ধতা")}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              {
                t: tr("Not an official warning", "সরকারি সতর্কবার্তা নয়"),
                d: tr("Rokkha's forecasts support awareness and preparation. Official flood warnings, water and danger levels come from the Flood Forecasting and Warning Centre (FFWC, part of BWDB); evacuation orders from government authorities.", "সরকারি সতর্কবার্তা, পানি ও বিপদসীমা দেয় বন্যা পূর্বাভাস ও সতর্কীকরণ কেন্দ্র (FFWC, BWDB); স্থানান্তরের নির্দেশ সরকার দেয়।"),
              },
              {
                t: tr("What radar cannot see", "রাডার যা দেখে না"),
                d: tr("GFM excludes land where radar cannot reliably detect water: dense forest, built-up areas and radar shadow in steep hills. So city waterlogging is largely missed, and 8 districts (mostly hill and urban) have no forecast. Passes come every few days, so short floods can be missed.", "ঘন বন, শহর ও খাড়া পাহাড়ে রাডার নির্ভরযোগ্য নয়; তাই শহরের জলাবদ্ধতা প্রায় ধরা পড়ে না এবং ৮টি জেলায় পূর্বাভাস নেই।"),
              },
              {
                t: tr("Observed is not modelled", "পর্যবেক্ষণ আর মডেল এক নয়"),
                d: tr("Observed floods are what satellites saw on specific dates (GFM, UNOSAT 2016–2024). Modelled hazard zones (JRC, 10- and 100-year return periods — a 100-year flood has about a 1 % chance each year, not a fixed schedule) are what a hydraulic model says could flood; they ignore embankments, so protected areas such as central Dhaka are overstated.", "পর্যবেক্ষিত বন্যা স্যাটেলাইটে দেখা; মডেলের ঝুঁকি-এলাকা সম্ভাব্য, বাঁধ ধরে না।"),
              },
              {
                t: tr("Modelled river flow is not a gauge", "মডেলের প্রবাহ গেজ নয়"),
                d: tr("GloFAS discharge comes from a global model at 9 river cells, sometimes far from a district. Measured water levels and danger levels will only be shown when an authorised source is connected.", "GloFAS প্রবাহ বৈশ্বিক মডেল থেকে; মাপা পানির উচ্চতা অনুমোদিত উৎস যুক্ত হলে দেখানো হবে।"),
              },
              {
                t: tr("Spatial resolution", "স্থানিক রেজোলিউশন"),
                d: tr("The forecast is one value per district. Point Check describes the ~90 m grid cell containing a point — not a building, and not a guarantee for the exact spot.", "পূর্বাভাস প্রতি জেলায় একটি মান; বিন্দু-যাচাই ~৯০ মি ঘরের, কোনো ভবনের নয়।"),
              },
              {
                t: tr("Forecast limits", "পূর্বাভাসের সীমা"),
                d: tr("One day ahead at most; weaker at the start of a flood; trained on ERA5 rain while live use relies on GFS for recent days; satellite product versions changed in 2025. Results describe 2023–2025.", "সর্বোচ্চ এক দিন; বন্যার শুরুতে দুর্বল; প্রশিক্ষণে ERA5, ব্যবহারে GFS; ফলাফল ২০২৩–২০২৫ এর।"),
              },
            ].map((c) => (
              <details key={c.t} className="group rounded-2xl border border-rk-line bg-rk-surface p-5" open>
                <summary className="flex cursor-pointer items-center gap-2 text-lg font-extrabold text-rk-forest">
                  <ShieldCheck className="h-5 w-5 text-rk-brand" aria-hidden="true" /> {c.t}
                </summary>
                <p className="mt-2 text-[14.5px] leading-relaxed text-rk-ink">{c.d}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* DEEP DIVES */}
      <section id="details" className="scroll-mt-28 bg-rk-forest text-white">
        <div className={`${wrap} py-16 md:py-20`}>
          <p className={`${eyebrow} text-rk-mist/80`}>{tr("Technical breakdown", "প্রযুক্তিগত বিবরণ")}</p>
          <h2 className={h2}>{tr("Explore the full technical breakdown", "পূর্ণ প্রযুক্তিগত বিবরণ")}</h2>
          <p className="mt-3 max-w-2xl text-[15.5px] text-white/80">{tr("Research and engineering notes on how each part works, with file names in the repository so every statement can be checked.", "প্রতিটি অংশ কীভাবে কাজ করে, রিপোজিটরির ফাইলের নামসহ, যাতে প্রতিটি কথা যাচাই করা যায়।")}</p>
          {bn && <p className="mt-3 text-white/75">প্রযুক্তিগত বিবরণ ইংরেজিতে।</p>}
          <div className="mt-6 grid gap-x-8 md:grid-cols-2">
            <Deep dark bn={bn} action={tr("Explore the underlying architecture: ", "ভেতরের কাঠামো দেখুন: ")} title="data collection and ingestion">
              <p>Open-Meteo requests are grouped by sites, priced in "calls" (locations × max(1, days/14)), checked against hourly and daily budgets before each request (runs pause, never overspend), retried with backoff, and written as upserts keyed by site and day, so runs can resume. Run log with heartbeat; interrupted runs are closed automatically.</p>
            </Deep>
            <Deep dark bn={bn} action={tr("See how the data is processed: ", "তথ্য কীভাবে প্রক্রিয়া হয় দেখুন: ")} title="satellite processing">
              <p>Windowed reads of GFM COG tiles over Bangladesh; per district: observed share (covered and not excluded), flooded share of observed land, advisory share. Monthly cache files; assembled to one JSON the API watches for changes.</p>
            </Deep>
            <Deep dark bn={bn} action={tr("Read the technical explanation: ", "প্রযুক্তিগত ব্যাখ্যা পড়ুন: ")} title="feature engineering">
              <p>Rain windows sum days before the target; river ratio uses the mean of the 30 days ending 2 days before; change over 3 days; log10 discharge. Satellite inputs use only passes strictly before the target day (no leakage). Same function for training and inference.</p>
            </Deep>
            <Deep dark bn={bn} action={tr("View the model architecture: ", "মডেলের কাঠামো দেখুন: ")} title="model and inference">
              <p>XGBoost binary:logistic, aucpr eval, 49 rounds, depth 3, eta 0.05, subsample 0.8, colsample 0.8, seed 7. Isotonic calibration stored as x/y points. Predictions stored per district and day with model version, issue time, inputs and data-through date; re-predicting replaces.</p>
            </Deep>
            <Deep dark bn={bn} action={tr("View the evaluation methodology: ", "যাচাইয়ের পদ্ধতি দেখুন: ")} title="evaluation">
              <p>Year-based split; persistence and climatology baselines measured identically; PR-AUC, ROC-AUC, Brier; precision/recall/F1 at two thresholds; calibration table; onset days; no-satellite ablation; leave-one-division-out; separate 2025 check. Not done: confidence intervals, cross-validation over years, MAE/RMSE (not a regression).</p>
            </Deep>
            <Deep dark bn={bn} action={tr("Explore the methodology: ", "পদ্ধতি দেখুন: ")} title="freshness and provenance">
              <p>Every value carries source, unit, statistic, fetch time; API answers carry attribution and limitations; the portal labels server data, saved sample, fixed records and unavailable layers; the daily job runs at 09:30 Bangladesh time and skips if the day is already done.</p>
            </Deep>
          </div>
          <details className="mt-8 rounded-2xl border border-white/15 bg-white/5 px-5 py-4" id="glossary">
            <summary className="cursor-pointer text-[15px] font-bold text-rk-mist">{tr("Glossary of terms used on this page", "এই পাতার শব্দকোষ")} ({Object.keys(GLOSSARY).length})</summary>
            <dl className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2">
              {Object.values(GLOSSARY).map((g) => (
                <div key={g.term}>
                  <dt className="text-[14px] font-bold text-white">{g.term}</dt>
                  <dd className="text-[13.5px] text-white/80">{g.def}</dd>
                </div>
              ))}
            </dl>
          </details>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => onAction({ kind: "view", view: "map" })} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-rk-page px-6 text-[16px] font-bold text-rk-forest hover:bg-white">
              <MapIcon className="h-5 w-5 text-rk-brand" aria-hidden="true" /> {tr("Explore the flood map", "বন্যার মানচিত্র দেখুন")}
            </button>
            <a href="https://www.ffwc.gov.bd/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-white/60 px-6 text-[16px] font-bold text-white hover:bg-white/10">
              {tr("Official warnings: ffwc.gov.bd", "সরকারি সতর্কবার্তা: ffwc.gov.bd")}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default IntelligencePage;
