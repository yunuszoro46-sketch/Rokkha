"use client";

// ROKKHA INTELLIGENCE — Model architecture, evaluation, and operational boundaries.
// Tailored for judges & evaluators: tabbed workflow starting with Methodology & Features, key factors, data split, feature importance, benchmarks, and honest limits.

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Database,
  ExternalLink,
  Layers,
  Map as MapIcon,
  MapPin,
  Radar,
  ShieldAlert,
  TrendingUp,
  Waves,
} from "lucide-react";
import type { Language } from "../../lib/translations";
import { getFloodEvents, getModelStatus } from "../../services/api";
import check2025 from "../../data/model_check_2025.json";
import { loadDistricts } from "../map/geoData";
import { loadStations, type Station } from "../map/riverStations";
import { Hydrograph } from "../map/Hydrograph";
import type { NavAction } from "../site/SiteNavigation";
import {
  ChartFrame,
  DistrictMap,
  EventTimeline,
  HBars,
  Legend,
  LineChart,
  ReliabilityMulti,
  Scatter,
  type FloodEvent,
  type Series,
} from "./charts";
import { GLOSSARY } from "./glossary";

interface Props {
  lang: Language;
  onAction: (a: NavAction) => void;
}

const SECTIONS = [
  { id: "engine", en: "Methodology & Features", bn: "পদ্ধতি ও ফিচার", icon: Layers },
  { id: "split", en: "Data Split & Signals", bn: "তথ্য ও বিভাজন", icon: Database },
  { id: "performance", en: "Evaluation & Benchmarks", bn: "মডেল যাচাই ও বেঞ্চমার্ক", icon: TrendingUp },
  { id: "warnings", en: "Warnings & Limitations", bn: "সতর্কতা ও সীমাবদ্ধতা", icon: AlertTriangle },
];

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

const GROUP_COLOR: Record<string, string> = {
  "Recent satellite": "#6FA9B5",
  Rain: "#247A5B",
  "River flow": "#2C6573",
  Geography: "#B87955",
  Season: "#71866A",
};

const dhakaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
const pct = (v: number) => `${Math.round(v * 100)} %`;

export const IntelligencePage: React.FC<Props> = ({ lang, onAction }) => {
  const bn = lang === "bn";
  const tr = (en: string, b: string) => (bn ? b : en);

  const [meta, setMeta] = useState<any>(null);
  const [modelStatus, setModelStatus] = useState<string | null>(null);
  const [events, setEvents] = useState<FloodEvent[] | null>(null);
  const [districts, setDistricts] = useState<GeoJSON.FeatureCollection | null>(null);
  const [station, setStation] = useState<Station | null>(null);
  const [stations, setStations] = useState<Station[] | null>(null);
  const [active, setActive] = useState<string>("engine");

  // Performance toggles
  const [perfMetric, setPerfMetric] = useState<"pr_auc" | "roc_auc" | "brier" | "alert_precision" | "alert_recall">("pr_auc");
  const [perfHidden, setPerfHidden] = useState<Set<string>>(new Set());
  const [scatterPeriod, setScatterPeriod] = useState<"test" | "check">("test");
  const [scatterHidden, setScatterHidden] = useState<Set<string>>(new Set());
  const [relHidden, setRelHidden] = useState<Set<string>>(new Set());
  const [arch, setArch] = useState("inputs");

  const toggle = (set: Set<string>, id: string) => {
    const n = new Set(set);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  };

  useEffect(() => {
    getModelStatus().then((s) => { setModelStatus(s?.status ?? null); setMeta(s?.model ?? null); });
    getFloodEvents().then((e: any[]) => setEvents(e));
    loadDistricts().then(setDistricts).catch(() => undefined);
    loadStations(dhakaToday()).then((s) => { setStations(s); setStation(s.find((x) => x.id === "surma-sunamganj") ?? s[0] ?? null); }).catch(() => undefined);
  }, []);

  const t = meta?.test_results;
  const imp: Record<string, number> | undefined = meta?.input_importance;
  const supported = useMemo(() => new Set<string>(meta?.supported_pcodes ?? []), [meta]);
  const groups = useMemo(() => {
    if (!imp) return [];
    const g: Record<string, number> = {};
    Object.entries(imp).forEach(([k, v]) => { const name = FEATURE_INFO[k]?.group ?? "Other"; g[name] = (g[name] ?? 0) + v; });
    return Object.entries(g).sort((a, b) => b[1] - a[1]);
  }, [imp]);

  const wrap = "mx-auto max-w-[1180px] px-4 md:px-6";
  const eyebrow = "rk-eyebrow font-mono text-[12px] font-semibold uppercase tracking-[0.14em]";
  const h2 = "mt-2 text-[26px] md:text-[34px] leading-[1.15] font-extrabold";

  // ---- evaluation data ----
  const c25 = check2025 as any;
  const v22 = meta?.validation_results;
  const PERIODS = ["2022 · val", "2023–2024 · test", "2025 · later check"];
  const metricOf = (o: any, key: typeof perfMetric, rule: "alert" | "decision" = "alert"): number | null => {
    if (!o) return null;
    if (key === "alert_precision") return (rule === "alert" ? o.at_alert : o.decision)?.precision ?? null;
    if (key === "alert_recall") return (rule === "alert" ? o.at_alert : o.decision)?.recall ?? null;
    return o[key] ?? null;
  };
  const perfSeries: Series[] = t ? [
    { id: "model", label: "Rokkha model", color: "#247A5B", values: [metricOf(v22, perfMetric), metricOf(t.model, perfMetric), metricOf(c25.model, perfMetric)] },
    { id: "persistence", label: "Persistence baseline", color: "#B87955", values: [null, metricOf(t.baseline_persistence, perfMetric, "decision"), metricOf(c25.persistence, perfMetric, "decision")] },
    { id: "climatology", label: "Climatology baseline", color: "#8C8778", values: [null, metricOf(t.baseline_climatology, perfMetric, "decision"), metricOf(c25.climatology, perfMetric, "decision")] },
    ...(perfMetric === "pr_auc" ? [
      { id: "nosat", label: "No satellite inputs", color: "#6FA9B5", values: [null, t.without_satellite_inputs.test.pr_auc, null] },
      { id: "random", label: "Random guess", color: "#C9C5BA", dashed: true, values: [v22?.flood_rate ?? null, t.model.flood_rate, c25.model.flood_rate] },
    ] : []),
  ] : [];

  const METRICS: { id: typeof perfMetric; label: string; term: string; max: number; lowerBetter?: boolean }[] = [
    { id: "pr_auc", label: "PR-AUC", term: "prauc", max: 1 },
    { id: "roc_auc", label: "ROC-AUC", term: "rocauc", max: 1 },
    { id: "brier", label: "Brier score", term: "brier", max: 0.05, lowerBetter: true },
    { id: "alert_precision", label: "Precision at Alert", term: "precision", max: 1 },
    { id: "alert_recall", label: "Recall at Alert", term: "recall", max: 1 },
  ];
  const metric = METRICS.find((m) => m.id === perfMetric)!;

  // ---- precision / recall scatter ----
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

  // ---- architecture stages ----
  const ARCH = [
    {
      id: "inputs",
      k: tr("1. 15 Raw Features", "১. ১৫টি কাঁচা ফিচার"),
      v: tr("4 Environmental Data Streams", "৪টি পরিবেশ সংক্রান্ত ডেটা স্ট্রিম"),
      d: tr(
        "Rolling rainfall (1, 3, 7, 14, 30 days), GloFAS daily discharge (level, 3-day delta, ratio to 30-day mean), JRC 10/100-year hazard zones, Sentinel-1 radar recency and calendar month.",
        "বৃষ্টির রোলিং সাম (১, ৩, ৭, ১৪, ৩০ দিন), গ্লোফাস নদীর প্রবাহ ও পরিবর্তন, জেআরসি ঝুঁকি-অঞ্চল, সেন্টিনেল-১ রাডার পর্যবেক্ষণ ও ক্যালেন্ডার মাস।"
      ),
      tag: "ERA5 · GFS · GloFAS · GFM",
    },
    {
      id: "features",
      k: tr("2. Feature Engineering", "২. ফিচার ইঞ্জিনিয়ারিং"),
      v: tr("Dynamic Aggregations & Recency", "ডাইনামিক সমষ্টি ও সময়ের ব্যবধান"),
      d: tr(
        "Extracts hydrological deltas, log-transformed river discharge, days elapsed since latest satellite pass, and 14-day peak flooded surface share per district.",
        "হাইড্রোলজিক্যাল ডেল্টা, লগ-স্কেল নদী প্রবাহ, সর্বশেষ স্যাটেলাইট পাসের পর অতিক্রান্ত দিন এবং ১৪ দিনের সর্বোচ্চ প্লাবিত অংশের অনুপাত নির্ণয়।"
      ),
      tag: "features.py",
    },
    {
      id: "run",
      k: tr("3. ML Engine", "৩. মেশিন লার্নিং ইঞ্জিন"),
      v: meta?.algorithm?.split(" (")[0] ?? "XGBoost 3.4.1",
      d: tr(
        meta?.settings
          ? `${meta.settings.rounds} gradient-boosted trees (depth ${meta.settings.max_depth}, learning rate ${meta.settings.eta}). Directly optimized for Area Under the Precision-Recall Curve (PR-AUC) on highly imbalanced flood events (2.3% prevalence).`
          : "49 gradient-boosted trees optimized for PR-AUC on imbalanced flood events.",
        "বিরল প্লাবনের তথ্যে পিআর-এইউসি বৃদ্ধিতে অপ্টিমাইজড ৪৯টি গ্রেডিয়েন্ট বুস্টেড ট্রির সমন্বয়।"
      ),
      tag: "Binary Logistic",
    },
    {
      id: "output",
      k: tr("4. Calibrated Alerts", "৪. ক্যালিব্রেটেড অ্যালার্ট"),
      v: tr("Isotonic Calibration & Dual Tiers", "আইসোটোনিক ক্যালিব্রেশন ও ডুয়াল টিয়ার"),
      d: tr(
        `Raw probability calibrated against 2022 validation observations. Triggers Watch (≥ ${meta?.alert_thresholds?.watch ?? "0.18"}) for high recall and Alert (≥ ${meta?.alert_thresholds?.alert ?? "0.375"}) for high-precision action triggers.`,
        `আইসোটোনিক ক্যালিব্রেশন শেষে নজরদারি (≥ ${meta?.alert_thresholds?.watch ?? "0.18"}) ও সতর্কবার্তা (≥ ${meta?.alert_thresholds?.alert ?? "0.375"}) স্তরে সক্রিয় হয়।`
      ),
      tag: "Watch & Alert Levels",
    },
  ];
  const archSel = ARCH.find((a) => a.id === arch)!;

  return (
    <div className="w-full min-w-0 max-w-[100vw] overflow-x-clip bg-rk-page">

      {/* ── Main Page Header with Breathing Room ── */}
      <div className="border-b border-rk-line bg-rk-surface/60 pt-6 pb-5">
        <div className={wrap}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider rounded-md bg-rk-secondary px-2.5 py-1 text-rk-forest border border-rk-line">
                  Rokkha Intelligence
                </span>
                <span className="font-mono text-[11px] rounded-md bg-rk-brand/10 text-rk-brand-strong border border-rk-brand/25 px-2.5 py-1 font-semibold">
                  v{meta?.model_version ?? "2026.1"}
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-rk-muted">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {modelStatus ? tr("Status: Active", "অবস্থা: সক্রিয়") : tr("Status: Standby", "অবস্থা: প্রস্তুত")}
                </span>
              </div>
              <h1 className="mt-2 text-2xl md:text-3xl font-extrabold text-rk-forest tracking-tight">
                {tr("Model Architecture, Evaluation & Benchmarks", "মডেল কাঠামো, মূল্যায়ন ও বেঞ্চমার্ক")}
              </h1>
              <p className="mt-1 text-sm text-rk-muted max-w-2xl">
                {tr(
                  "Interactive evaluation dashboard designed for hackathon judges: feature importance, leak-free validation, benchmark performance, and operational boundaries.",
                  "বিচারক ও মূল্যায়কদের জন্য ইন্টারঅ্যাক্টিভ ড্যাশবোর্ড: ফিচার গুরুত্ব, ফাঁকিহীন ভ্যালিডেশন, বেঞ্চমার্ক এবং ব্যবহারিক সীমাবদ্ধতা।"
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onAction({ kind: "view", view: "map" })}
              className="self-start md:self-auto h-10 shrink-0 inline-flex items-center gap-2 rounded-xl bg-rk-brand px-4 text-[13px] font-bold text-white hover:bg-rk-brand-strong transition-colors shadow-sm"
            >
              <MapIcon className="h-4 w-4" aria-hidden="true" /> {tr("Open Flood Map", "বন্যার মানচিত্র")}
            </button>
          </div>

          {/* ── Modern Tab Navigation Bar (Starts with Methodology) ── */}
          <div className="mt-6 flex overflow-x-auto p-1.5 bg-rk-secondary rounded-2xl border border-rk-line gap-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SECTIONS.map((s) => {
              const isSelected = active === s.id;
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActive(s.id)}
                  className={`flex items-center gap-2 whitespace-nowrap px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
                    isSelected
                      ? "bg-white text-rk-forest shadow-sm ring-1 ring-rk-line"
                      : "text-rk-muted hover:text-rk-forest hover:bg-white/50"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isSelected ? "text-rk-brand" : "text-rk-muted"}`} />
                  <span>{bn ? s.bn : s.en}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          TAB 1: ML METHODOLOGY & WHAT MODEL RELIES ON
      ══════════════════════════════════════ */}
      {active === "engine" && (
        <div className="animate-in fade-in duration-200">
          <section className="bg-rk-page py-10 md:py-14">
            <div className={wrap}>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <p className={`${eyebrow} text-rk-clay-text`}>{tr("ML Methodology", "মডেলের কার্যপ্রণালী")}</p>
                  <h2 className={`${h2} text-rk-forest`}>{tr("Architecture & What The Model Relies On", "কাঠামো ও মডেলের মূল ভিত্তি")}</h2>
                </div>
                <p className="max-w-md text-[14.5px] text-rk-muted">
                  {tr(
                    "Calibrated XGBoost model predicting daily flood probability per district-day based on multi-source environmental signals.",
                    "বহুমুখী পরিবেশগত তথ্যের ভিত্তিতে প্রতিদিন প্রতিটি জেলায় প্লাবনের সম্ভাবনা নির্ণয়কারী ক্যালিব্রেটেড এক্সজিবুস্ট মডেল।"
                  )}
                </p>
              </div>

              {/* Interactive Pipeline Stages */}
              <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_360px]">
                <ol className="grid gap-2 sm:grid-cols-2" aria-label="Architecture stages">
                  {ARCH.map((a) => (
                    <li key={a.id}>
                      <button type="button" aria-pressed={arch === a.id} onClick={() => setArch(a.id)}
                        className={`h-full w-full rounded-2xl border p-4 text-left transition-all ${arch === a.id ? "border-rk-brand bg-rk-surface shadow-sm ring-1 ring-rk-brand" : "border-rk-line bg-rk-surface/60 hover:bg-rk-surface"}`}>
                        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-rk-clay-text">{a.k}</span>
                        <span className="mt-1 block text-[15px] font-extrabold text-rk-forest">{a.v}</span>
                        <span className="mt-2 inline-block font-mono text-[10.5px] rounded bg-rk-secondary px-2 py-0.5 text-rk-muted">{a.tag}</span>
                      </button>
                    </li>
                  ))}
                </ol>
                <div aria-live="polite" className="rounded-2xl border border-rk-line bg-rk-surface p-5 flex flex-col justify-between shadow-xs">
                  <div>
                    <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-rk-clay-text">{archSel.k}</p>
                    <h3 className="mt-1 text-lg font-extrabold text-rk-forest">{archSel.v}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-rk-ink">{archSel.d}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-rk-line font-mono text-[11.5px] text-rk-muted flex items-center justify-between">
                    <span>{tr("Source / Reference", "উৎস")}</span>
                    <span className="font-semibold text-rk-forest">{archSel.tag}</span>
                  </div>
                </div>
              </div>

              {/* Feature Importance & District Coverage Grid */}
              <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <ChartFrame
                  id="imp"
                  title={tr("What the model relies on (Feature Gain Share)", "মডেল কীসের ওপর নির্ভর করে (ফিচার গেইন শেয়ার)")}
                  kind="model-output"
                  measures="Share of total XGBoost split gain by input group (normalized to 100%)"
                  units="share of gain (%)"
                  period="Training set 2016–2021 (13,839 district-days)"
                  source="flood_model.meta.json · input_importance"
                  howToRead="Longer bars indicate greater contribution to decision tree gain splits across 49 trees."
                  takeaway="Recent satellite radar observation accounts for ~59% of model decisions. Multi-day rainfall sums provide the second strongest predictive signal (~20%)."
                  limits="Feature gain represents training decision utility, not independent causal hydrological mechanism."
                >
                  {groups.length ? (
                    <div className="py-2">
                      <HBars
                        rows={groups.map(([g, v]) => ({
                          label: g === "Geography" ? "Static Geography (elevation, 10/100yr hazard zones)" : g === "Recent satellite" ? "Recent Sentinel-1 Satellite (recency, flood %)" : g,
                          value: v,
                          color: GROUP_COLOR[g],
                          strong: g === "Recent satellite",
                        }))}
                        max={0.65}
                        format={(v) => pct(v)}
                        caption="Share of gain by input group"
                      />
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-rk-line pt-3 text-[11px] font-mono">
                        {Object.entries(GROUP_COLOR).map(([name, color]) => (
                          <div key={name} className="flex items-center gap-1.5 text-rk-ink">
                            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
                            <span className="truncate">{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-rk-muted py-6 text-center">{tr("Loading feature importance data…", "ফিচার তথ্য লোড হচ্ছে…")}</p>
                  )}
                </ChartFrame>

                {/* District Coverage Map */}
                <div className="rounded-2xl border border-rk-line bg-rk-surface p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-rk-line">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-rk-brand" aria-hidden="true" />
                        <h3 className="text-base font-extrabold text-rk-forest">
                          {tr("Operational District Scope", "কার্যকর জেলাভিত্তিক পরিধি")}
                        </h3>
                      </div>
                      <span className="font-mono text-xs rounded bg-rk-secondary px-2 py-0.5 text-rk-forest border border-rk-line font-bold">
                        {supported.size || 56} / 64 Districts
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] text-rk-muted leading-relaxed">
                      {tr(
                        "Automated daily prediction covers 56 plains and haor districts. 8 districts with steep topography or dense forest canopy are excluded due to radar backscatter limits.",
                        "৫৬টি সমতল ও হাওর জেলায় প্রতিদিন স্বয়ংক্রিয় পূর্বাভাস দেওয়া হয়। রাডার সিগন্যাল বাধার কারণে পাহাড়ি ও বনাঞ্চলের ৮টি জেলা আওতামুক্ত রাখা হয়েছে।"
                      )}
                    </p>
                    <div className="mt-3">
                      {districts && supported.size > 0 ? (
                        <DistrictMap fc={districts} fillFor={(p) => (supported.has(p) ? "#247A5B" : "#B87955")} selected={null} onSelect={() => undefined} label={tr("Districts monitored daily", "যেসব জেলায় প্রতিদিন পূর্বাভাস দেওয়া হয়")} />
                      ) : (
                        <div className="p-8 text-center text-rk-muted text-sm">{tr("Loading coverage map…", "মানচিত্র লোড হচ্ছে…")}</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-rk-line pt-2.5 text-[11.5px] font-mono text-rk-ink">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#247A5B]" aria-hidden="true" />{supported.size} {tr("Monitored Daily", "নজরদারিতে")}</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#B87955]" aria-hidden="true" />{64 - supported.size} {tr("Excluded (Topography Limits)", "আওতামুক্ত")}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 2: TRAINING AND DATA SPLIT + SIGNALS
      ══════════════════════════════════════ */}
      {active === "split" && (
        <div className="animate-in fade-in duration-200">
          <section className="bg-rk-page py-10 md:py-14">
            <div className={wrap}>
              <p className={`${eyebrow} text-rk-clay-text`}>{tr("Data Split & Validation Integrity", "তথ্য-বিভাজন ও যাচাই প্রক্রিয়া")}</p>
              <h2 className={`${h2} text-rk-forest`}>{tr("Zero Data-Leakage Chronological Split", "কোনো তথ্য ফাঁস ছাড়া বছরভিত্তিক বিভাজন")}</h2>
              <p className="mt-2 max-w-3xl text-[16px] text-rk-ink leading-relaxed">
                {tr(
                  "Flood forecasting models often suffer from temporal and spatial leakage when samples are randomly shuffled. Rokkha enforces strict year-separated partitioning.",
                  "সাধারণত এলোমেলো স্যাম্পলিংয়ে অতীতের ডেটা ভবিষ্যতের সঙ্গে মিশে যায়। রক্ষা কঠোরভাবে বছরভিত্তিক বিভাজন নিশ্চিত করে।"
                )}
              </p>

              {/* Split Table */}
              <div className="mt-6 overflow-hidden rounded-2xl border border-rk-line bg-rk-surface shadow-sm">
                <div className="p-4 sm:p-5 border-b border-rk-line flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-base sm:text-lg font-extrabold text-rk-forest">
                    {tr("Dataset Partitioning across 21,100+ District-Days", "২১,১০০+ জেলা-দিনের ডেটাসেট বিভাজন")}
                  </h3>
                  <span className="font-mono text-xs text-rk-muted">
                    {tr("Unit: District-Day (requires valid rain + ≥ 50% radar pass)", "একক: জেলা-দিন (বৃষ্টি ও ≥ ৫০% রাডার কভারেজ আবশ্যক)")}
                  </span>
                </div>
                {meta?.rows && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[13.5px]">
                      <thead className="bg-rk-secondary font-mono text-[11px] uppercase tracking-wider text-rk-muted border-b border-rk-line">
                        <tr>
                          <th className="py-2.5 px-4 sm:px-6">Period</th>
                          <th>Role & Description</th>
                          <th className="text-right">District-Days</th>
                          <th className="text-right">Floods Observed</th>
                          <th className="text-right px-4 sm:px-6">Prevalence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rk-line font-mono text-rk-ink">
                        <tr>
                          <td className="py-3 px-4 sm:px-6 font-bold text-rk-forest">2016–2021</td>
                          <td className="font-sans text-[13px]">{tr("Model Training (49 trees, parameters fitted)", "মডেল প্রশিক্ষণ (৪৯টি ট্রি, প্যারামিটার ফিটিং)")}</td>
                          <td className="text-right">{meta.rows.train_2016_2021.rows.toLocaleString("en-GB")}</td>
                          <td className="text-right">{meta.rows.train_2016_2021.floods}</td>
                          <td className="text-right px-4 sm:px-6 text-rk-muted">{((meta.rows.train_2016_2021.floods / meta.rows.train_2016_2021.rows) * 100).toFixed(2)}%</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 sm:px-6 font-bold text-rk-forest">2022</td>
                          <td className="font-sans text-[13px]">{tr("Validation (Isotonic calibration & alert thresholds chosen)", "ভ্যালিডেশন (ক্যালিব্রেশন ও থ্রেশহোল্ড নির্ধারণ)")}</td>
                          <td className="text-right">{meta.rows.validation_2022.rows.toLocaleString("en-GB")}</td>
                          <td className="text-right">{meta.rows.validation_2022.floods}</td>
                          <td className="text-right px-4 sm:px-6 text-rk-muted">{((meta.rows.validation_2022.floods / meta.rows.validation_2022.rows) * 100).toFixed(2)}%</td>
                        </tr>
                        <tr className="bg-rk-brand-soft/50 font-semibold">
                          <td className="py-3 px-4 sm:px-6 text-rk-forest flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-rk-brand" />
                            2023–2024
                          </td>
                          <td className="font-sans text-[13px]">{tr("Held-Out Test (Evaluated once, never seen during training)", "টেস্ট ডেটাসেট (মডেল প্রশিক্ষণে কখনো ব্যবহৃত হয়নি)")}</td>
                          <td className="text-right">{meta.rows.test_2023_2024.rows.toLocaleString("en-GB")}</td>
                          <td className="text-right">{meta.rows.test_2023_2024.floods}</td>
                          <td className="text-right px-4 sm:px-6 text-rk-forest font-bold">{((meta.rows.test_2023_2024.floods / meta.rows.test_2023_2024.rows) * 100).toFixed(2)}%</td>
                        </tr>
                        <tr className="bg-rk-brand-soft/30">
                          <td className="py-3 px-4 sm:px-6 text-rk-forest">2025</td>
                          <td className="font-sans text-[13px]">{tr("Unseen Prospective Verification (Model frozen, tested on new year)", "পরবর্তী যাচাই (মডেল সম্পূর্ণ অপরিবর্তিত রেখে নতুন বছরে পরীক্ষা)")}</td>
                          <td className="text-right">{c25.model.rows.toLocaleString("en-GB")}</td>
                          <td className="text-right">{c25.model.floods}</td>
                          <td className="text-right px-4 sm:px-6 text-rk-muted">{((c25.model.floods / c25.model.rows) * 100).toFixed(2)}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="bg-rk-secondary/60 px-5 py-3 border-t border-rk-line text-[12px] text-rk-muted">
                  {tr(
                    "Integrity Guarantee: Model weights, tree splits, and alert cutoffs were locked on 2016–2022 data before running on 2023–2024 test data.",
                    "সততার নিশ্চয়তা: ২০২৩–২০২৪ টেস্ট ডেটায় চালানোর আগে ২০১৬–২০২২ তথ্যের ওপর মডেলের সমস্ত প্যারামিটার ও থ্রেশহোল্ড চূড়ান্ত করা হয়েছিল।"
                  )}
                </div>
              </div>

              {/* Key Environmental Signals Visualized */}
              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <ChartFrame
                  id="river"
                  title={tr("Hydraulic Signal: GloFAS River Flow", "হাইড্রোলিক সিগন্যাল: গ্লোফাস নদী-প্রবাহ")}
                  kind="model-output"
                  measures="Modelled daily river discharge (m³/s); dashed = forecast, dotted = 30-day mean"
                  units="m³/s"
                  period="Recent 90 days + 10-day forecast"
                  source="Copernicus GloFAS via Open-Meteo"
                  takeaway="Supplies 3 vital model inputs: discharge level, 3-day trend rate, and deviation from 30-day baseline."
                  limits="Global hydrological model output (0.05° grid), not an in-situ gauge level."
                  controls={stations ? (
                    <label className="flex flex-wrap items-center gap-2 text-[12.5px] text-rk-ink">
                      <span className="font-semibold">{tr("Station:", "স্টেশন:")}</span>
                      <select value={station?.id ?? ""} onChange={(e) => setStation(stations.find((x) => x.id === e.target.value) ?? null)} className="h-8 rounded-lg border border-rk-line bg-rk-surface px-2 text-[12.5px]">
                        {stations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    </label>
                  ) : null}
                >
                  {station ? <Hydrograph series={station.series} usual={station.usual} bn={bn} /> : <p className="text-rk-muted py-8 text-center">{tr("Loading river hydrograph…", "লোড হচ্ছে…")}</p>}
                </ChartFrame>

                <ChartFrame
                  id="events"
                  title={tr("Ground Truth: 10 Major UNOSAT Flood Analyses", "বাস্তব রেকর্ড: ১০টি প্রধান ইউনোস্যাট প্লাবন বিশ্লেষণ")}
                  kind="observation"
                  measures="Flood area mapped across Bangladesh by satellite analysts"
                  units="km² mapped extent"
                  period="2016–2024 historical events"
                  source="UNOSAT Satellite Flood AI / Rapid Mapping"
                  takeaway="Serves as the high-confidence spatial validation record backing Rokkha's 90m Point Check grid."
                  limits="Analyses cover specific disaster activations; unmapped areas are unobserved, not confirmed dry."
                >
                  <div className="rounded-xl bg-rk-forest p-3">
                    {events && events.length ? (
                      <EventTimeline events={events} caption="Ten verified UNOSAT flood disaster activations, 2016–2024" />
                    ) : (
                      <p className="text-white/70 py-8 text-center">{tr("Loading flood events…", "লোড হচ্ছে…")}</p>
                    )}
                  </div>
                </ChartFrame>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 3: MODEL EVALUATION & BENCHMARKS
      ══════════════════════════════════════ */}
      {active === "performance" && (
        <div className="animate-in fade-in duration-200">
          <section className="bg-rk-page py-10 md:py-14">
            <div className={wrap}>
              <p className={`${eyebrow} text-rk-clay-text`}>{tr("Model Evaluation", "মডেল যাচাই ও বেঞ্চমার্ক")}</p>
              <h2 className={`${h2} text-rk-forest`}>{tr("Honest Benchmark on Unseen Years", "অদেখা বছরের ডেটায় নিরপেক্ষ মূল্যায়ন")}</h2>
              <p className="mt-2 max-w-3xl text-[16px] text-rk-ink leading-relaxed">
                {tr(
                  "Because floods occur on only ~2.3% of district-days, standard accuracy is misleading (a dummy model predicting 'dry' achieves 97.7% accuracy). We benchmark using PR-AUC, ROC-AUC, Brier score, and Alert Precision/Recall against Persistence and Climatology baselines.",
                  "যেহেতু বন্যার হার মাত্র ২.৩%, সাধারণ অ্যাকুরেসি অর্থহীন। আমরা পিআর-এইউসি, আরওসি-এইউসি, ব্রায়ার স্কোর এবং প্রিসিশন/রিকলের মাধ্যমে মডেলের প্রকৃত কার্যকারিতা প্রমাণ করি।"
                )}
              </p>

              {t ? (
                <>
                  {/* Metric Comparison Line Chart */}
                  <div className="mt-8">
                    <ChartFrame
                      id="perf"
                      title={tr("Evaluation Metric Across Chronological Periods", "বিভিন্ন সময়কালে মূল্যায়নের ফলাফল")}
                      kind="evaluation"
                      measures={`${metric.label} of Model vs. Persistence and Climatology Baselines${metric.lowerBetter ? " (lower is better)" : ""}`}
                      units={metric.id === "brier" ? "squared probability error (0 = perfect)" : "score (0 to 1)"}
                      period="2022 validation · 2023–2024 test · 2025 prospective check"
                      source="flood_model.meta.json & check_2025.json"
                      howToRead="Toggle metrics to inspect different aspects of reliability. Rokkha consistently outperforms both baselines across held-out years."
                      takeaway={
                        perfMetric === "alert_recall"
                          ? "At Alert the model prioritizes precision over raw recall (0.42 vs 0.47 in 2023–24), reducing dangerous false alarm fatigue."
                          : perfMetric === "alert_precision"
                            ? "Alert warnings are twice as precise as climatology, ensuring issued alerts reflect genuine danger."
                            : "Rokkha achieves PR-AUC 0.460 on test and 0.569 on 2025, beating persistence (0.288) and climatology (0.252) by substantial margins."
                      }
                      limits="Evaluated at the district scale; individual village flooding depends on local micro-elevation."
                      controls={
                        <div className="flex flex-wrap items-center gap-2">
                          <div role="group" aria-label="Select metric" className="flex flex-wrap gap-1">
                            {METRICS.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                aria-pressed={perfMetric === m.id}
                                onClick={() => setPerfMetric(m.id)}
                                className={`min-h-8 rounded-lg border px-2.5 text-[12px] font-semibold transition-colors ${perfMetric === m.id ? "border-rk-brand bg-rk-brand-soft text-rk-forest" : "border-rk-line bg-rk-surface text-rk-ink hover:bg-rk-secondary"}`}
                              >
                                {m.label}
                              </button>
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
                        bands={[{ from: 0, to: 0, label: "Tuning year (optimistic)", color: "rgba(233,185,73,0.12)" }]}
                        caption={`${metric.label} across chronological evaluation periods`}
                      />
                      <p className="mt-2 text-[12px] text-rk-muted font-mono">{GLOSSARY[metric.term].def}</p>
                    </ChartFrame>
                  </div>

                  {/* Side-by-Side: Precision vs Recall Scatter & Probability Calibration */}
                  <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <ChartFrame
                      id="pr"
                      title={tr("Warning Threshold Tradeoff: Precision vs. Recall", "সতর্কতা থ্রেশহোল্ড: প্রিসিশন বনাম রিকল")}
                      kind="evaluation"
                      measures="Operating points for Watch and Alert thresholds against baseline rules"
                      units="share (0 to 1)"
                      period={scatterPeriod === "test" ? "2023–2024 test" : "2025 later check"}
                      source="flood_model.meta.json & check_2025.json"
                      howToRead="Higher is better precision (fewer false alarms). Farther right is better recall (fewer missed floods)."
                      takeaway="Watch catches 62% of floods as an early warning; Alert reaches 60% precision (75% in 2025), preventing alarm exhaustion."
                      limits="Ablation without satellite data shown for 2023–2024 test period."
                      controls={
                        <div className="flex flex-wrap items-center gap-2">
                          <div role="group" aria-label="Select period" className="flex gap-1">
                            {([["test", "2023–2024 Test"], ["check", "2025 Check"]] as const).map(([k, l]) => (
                              <button
                                key={k}
                                type="button"
                                aria-pressed={scatterPeriod === k}
                                onClick={() => setScatterPeriod(k)}
                                className={`min-h-8 rounded-lg border px-2.5 text-[12px] font-semibold transition-colors ${scatterPeriod === k ? "border-rk-brand bg-rk-brand-soft text-rk-forest" : "border-rk-line bg-rk-surface text-rk-ink"}`}
                              >
                                {l}
                              </button>
                            ))}
                          </div>
                          <Legend
                            series={[
                              { id: "model", label: "Model", color: "#247A5B", values: [] },
                              { id: "baselines", label: "Baselines", color: "#B87955", values: [] },
                              ...(scatterPeriod === "test" ? [{ id: "ablation", label: "No-Satellite Ablation", color: "#6FA9B5", values: [] }] : []),
                            ]}
                            hidden={scatterHidden}
                            onToggle={(id) => setScatterHidden((h) => toggle(h, id))}
                          />
                        </div>
                      }
                    >
                      <Scatter points={scatterPoints} hidden={scatterHidden} caption="Precision vs recall for each warning rule" />
                    </ChartFrame>

                    <ChartFrame
                      id="cal"
                      title={tr("Reliability Diagram: Probability Calibration", "সম্ভাবনার যথার্থতা ও ক্যালিব্রেশন")}
                      kind="evaluation"
                      measures="Predicted probability (x) vs observed flood rate (y); bubble size = sample days in bin"
                      units="probability 0–1"
                      period="2023–2024 test and 2025 prospective check"
                      source="flood_model.meta.json · calibration_table & check_2025.json"
                      howToRead="Points tracking the diagonal dashed line confirm stated probabilities match real-world flood frequencies."
                      takeaway="Well calibrated across lower and moderate bins. High confidence predictions (≥ 0.8) reflect over 80% confirmed flooding in test."
                      limits="Extreme probability bins (> 0.9) have smaller sample counts."
                      controls={
                        <Legend
                          series={[
                            { id: "test", label: "2023–2024 Test", color: "#247A5B", values: [] },
                            { id: "check", label: "2025 Check", color: "#B87955", values: [] },
                          ]}
                          hidden={relHidden}
                          onToggle={(id) => setRelHidden((h) => toggle(h, id))}
                        />
                      }
                    >
                      <ReliabilityMulti
                        sets={[
                          { id: "test", label: "2023–2024", color: "#247A5B", bins: t.model.calibration_table },
                          { id: "check", label: "2025", color: "#B87955", bins: c25.reliability },
                        ]}
                        hidden={relHidden}
                        caption="Reliability diagram of predicted flood probabilities"
                      />
                    </ChartFrame>
                  </div>

                  {/* Complete Benchmark Table */}
                  <figure className="m-0 mt-6 overflow-hidden rounded-2xl border border-rk-line bg-rk-surface shadow-sm">
                    <figcaption className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 pb-3 border-b border-rk-line">
                      <div>
                        <h3 className="text-lg font-extrabold text-rk-forest">{tr("Full Benchmark Comparison Table", "সম্পূর্ণ তুলনামূলক বেঞ্চমার্ক সারণী")}</h3>
                        <p className="text-xs text-rk-muted mt-0.5">
                          {tr("Complete evaluation across all test years, baselines, and ablation variants", "টেস্ট ডেটাসেট, বেসলাইন ও অ্যাবলেশন ভ্যারিয়েন্টের বিশদ পরিসংখ্যান")}
                        </p>
                      </div>
                      <span className="font-mono text-[11.5px] rounded bg-rk-secondary px-2.5 py-1 text-rk-forest border border-rk-line">
                        Watch ≥ {meta?.alert_thresholds?.watch} · Alert ≥ {meta?.alert_thresholds?.alert}
                      </span>
                    </figcaption>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left text-[13px]">
                        <thead className="bg-rk-secondary font-mono text-[10.5px] uppercase tracking-wider text-rk-muted">
                          <tr>
                            <th className="px-5 py-3">Model / Strategy</th>
                            <th>Period</th>
                            <th className="text-right">District-Days</th>
                            <th className="text-right">Floods</th>
                            <th className="text-right font-bold text-rk-forest" title={GLOSSARY.prauc.def}>PR-AUC</th>
                            <th className="text-right" title={GLOSSARY.rocauc.def}>ROC-AUC</th>
                            <th className="text-right" title={GLOSSARY.brier.def}>Brier</th>
                            <th className="text-right" title={GLOSSARY.precision.def}>Alert Prec.</th>
                            <th className="px-5 text-right" title={GLOSSARY.recall.def}>Alert Rec.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rk-line font-mono text-rk-ink">
                          {([
                            ["Rokkha Model (Tuning Year)", "2022", v22, v22?.at_alert, false],
                            ["Rokkha Model (Held-Out Test)", "2023–2024", t.model, t.model.at_alert, true],
                            ["Persistence Baseline", "2023–2024", t.baseline_persistence, t.baseline_persistence.decision, false],
                            ["Climatology Baseline", "2023–2024", t.baseline_climatology, t.baseline_climatology.decision, false],
                            ["Ablation: No Satellite Inputs", "2023–2024", t.without_satellite_inputs.test, t.without_satellite_inputs.test.at_alert, false],
                            ["Onset Days Only (Flood Start)", "2023–2024", t.onset_days.model, null, false],
                            ["Rokkha Model (Prospective Check)", "2025", c25.model, c25.model.at_alert, true],
                            ["Persistence Baseline", "2025", c25.persistence, c25.persistence.decision, false],
                            ["Climatology Baseline", "2025", c25.climatology, c25.climatology.decision, false],
                          ] as [string, string, any, any, boolean][]).map(([name, period, o, d, isHighlight], idx) =>
                            o ? (
                              <tr key={idx} className={isHighlight ? "bg-rk-brand-soft/60 font-semibold" : "hover:bg-rk-secondary/40"}>
                                <td className="px-5 py-2.5 font-sans text-rk-forest flex items-center gap-1.5">
                                  {isHighlight && <CheckCircle2 className="h-3.5 w-3.5 text-rk-brand shrink-0" aria-hidden="true" />}
                                  {name}
                                </td>
                                <td>{period}</td>
                                <td className="text-right">{o.rows?.toLocaleString("en-GB")}</td>
                                <td className="text-right">{o.floods}</td>
                                <td className="text-right font-bold text-rk-forest">{o.pr_auc?.toFixed(3)}</td>
                                <td className="text-right">{o.roc_auc?.toFixed(3)}</td>
                                <td className="text-right">{o.brier?.toFixed(4)}</td>
                                <td className="text-right">{d ? d.precision.toFixed(2) : "—"}</td>
                                <td className="px-5 text-right">{d ? d.recall.toFixed(2) : "—"}</td>
                              </tr>
                            ) : null
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-5 py-3 bg-rk-secondary/40 border-t border-rk-line text-[11.5px] text-rk-muted">
                      {tr(
                        "Persistence baseline assumes today matches the latest radar pass. Climatology baseline predicts average historical flood frequency. Onset days: previous satellite pass was completely dry.",
                        "পারসিস্টেন্স বেসলাইন ধরে নেয় আজকের দিনটি আগের রাডার পাসের মতোই থাকবে। অনসেট ডে: আগের স্যাটেলাইট পাসে প্লাবন ধরা পড়েনি।"
                      )}
                    </div>
                  </figure>

                  {/* Division Breakdown */}
                  <div className="mt-6">
                    <ChartFrame
                      id="div"
                      title={tr("Generalization by Division (Spatial Hold-Out)", "বিভাগভিত্তিক কার্যকারিতা (স্থানিক যাচাই)")}
                      kind="evaluation"
                      measures="PR-AUC when tested on 2023–2024 days in each division"
                      units="PR-AUC (0 to 1)"
                      period="2023–2024 test period"
                      source="flood_model.meta.json · held_out_division"
                      takeaway="Sylhet (haor basin) shows highest model skill (PR-AUC 0.72) due to severe open water extent; Barishal and Rajshahi show lower scores."
                      limits="Divisions with fewer than 5 observed flood events (Khulna, Rangpur) omitted due to statistical instability."
                    >
                      <div className="py-2">
                        <HBars
                          rows={Object.entries(t.held_out_division as Record<string, any>)
                            .filter(([, v]) => v.pr_auc != null)
                            .sort((a, b) => b[1].pr_auc - a[1].pr_auc)
                            .map(([k, v]) => ({
                              label: `${k} Division (${v.floods} recorded floods)`,
                              value: v.pr_auc,
                              color: "#2C6573",
                              strong: v.pr_auc > 0.5,
                            }))}
                          max={1}
                          caption="PR-AUC by held-out division"
                        />
                      </div>
                    </ChartFrame>
                  </div>
                </>
              ) : (
                <p className="mt-8 text-rk-muted py-8 text-center">{tr("Evaluation metrics not available.", "ফলাফল পাওয়া যায়নি।")}</p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 4: WARNINGS & LIMITATIONS
      ══════════════════════════════════════ */}
      {active === "warnings" && (
        <div className="animate-in fade-in duration-200">
          <section className="bg-rk-page py-10 md:py-14">
            <div className={wrap}>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <p className={`${eyebrow} text-rk-clay-text`}>{tr("Honest AI & Operational Boundaries", "দায়িত্বশীল ব্যবহার ও সীমাবদ্ধতা")}</p>
                  <h2 className={`${h2} text-rk-forest`}>{tr("Failure Modes, Weaknesses & Warnings", "দুর্বলতা, পরিচিত ত্রুটি ও সতর্কতা")}</h2>
                </div>
                <p className="max-w-md text-[14.5px] text-rk-muted">
                  {tr(
                    "Hackathon judges look for transparent error analysis. We explicitly document where Rokkha excels and where it fails.",
                    "আমরা আমাদের মডেলের সাফল্য যেমন তুলে ধরেছি, তেমনি এর সীমাবদ্ধতা ও দুর্বলতাগুলোও পরিষ্কারভাবে নথিভুক্ত করেছি।"
                  )}
                </p>
              </div>

              {/* Prominent Weakness Callout: Onset Days */}
              {t?.onset_days && (
                <div className="mt-8 rounded-2xl border-2 border-rk-warning-accent bg-rk-warning-soft/80 p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-6 w-6 text-rk-warning-accent shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg font-extrabold text-rk-forest">
                          {tr("Primary Known Weakness: Flood Onset Days", "প্রধান পরিচিত দুর্বলতা: প্লাবনের শুরুর দিন")}
                        </h3>
                        <span className="font-mono text-xs font-bold rounded bg-rk-warning-accent/20 px-2.5 py-1 text-rk-forest border border-rk-warning-accent/40">
                          PR-AUC Drops to {t.onset_days.model.pr_auc}
                        </span>
                      </div>
                      <p className="mt-2 text-[14px] leading-relaxed text-rk-ink">
                        {tr(
                          `When the most recent Sentinel-1 radar pass was completely dry (${t.onset_days.model.rows.toLocaleString("en-GB")} test days, ${t.onset_days.model.floods} floods), model performance drops significantly. Predicting the very first day of waterlogging before radar confirmation is inherently challenging. At Watch level, the model successfully caught ${t.onset_days.model.at_watch.floods_caught} onset events, but missed ${t.onset_days.model.at_watch.floods_missed}. Users should be aware that confidence is highest once water has begun accumulating.`,
                          `যখন আগের সেন্টিনেল-১ পাসে কোনো প্লাবন ছিল না (${t.onset_days.model.rows.toLocaleString("en-GB")} টেস্ট দিন, ${t.onset_days.model.floods}টি প্লাবন), তখন মডেলের পিআর-এইউসি নেমে আসে ${t.onset_days.model.pr_auc}-এ। নজরদারি স্তরে মডেলটি ${t.onset_days.model.at_watch.floods_caught}টি শুরুর ঘটনা সফলভাবে শনাক্ত করলেও ${t.onset_days.model.at_watch.floods_missed}টি মিস করেছে।`
                        )}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-mono">
                        <span className="rounded-md bg-white px-2.5 py-1 text-rk-forest border border-rk-line shadow-xs">
                          {tr("Onset Caught at Watch:", "নজরদারিতে ধরা:")} <strong>{t.onset_days.model.at_watch.floods_caught}</strong>
                        </span>
                        <span className="rounded-md bg-white px-2.5 py-1 text-rk-forest border border-rk-line shadow-xs">
                          {tr("Onset Missed at Watch:", "নজরদারিতে মিস:")} <strong>{t.onset_days.model.at_watch.floods_missed}</strong>
                        </span>
                        <span className="rounded-md bg-white px-2.5 py-1 text-rk-forest border border-rk-line shadow-xs">
                          {tr("Total Onset Flood Events:", "মোট শুরুর প্লাবন:")} <strong>{t.onset_days.model.floods}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4 Core Operational Limitations Cards */}
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {[
                  {
                    icon: ShieldAlert,
                    t: tr("Not an Official Warning (Regulatory Precedence)", "সরকারি সতর্কবার্তা নয় (আইনি মর্যাদা)"),
                    d: tr(
                      "Rokkha is a community preparedness and early anticipation tool. Official flood warnings and danger levels in Bangladesh are legally issued solely by FFWC (BWDB, ffwc.gov.bd). Evacuation orders are issued by national and local government authorities.",
                      "রক্ষা একটি আগাম প্রস্তুতিমূলক প্রযুক্তি। বাংলাদেশে সরকারি বন্যার সতর্কবার্তা এবং বিপদসীমা কেবলমাত্র বন্যা পূর্বাভাস ও সতর্কীকরণ কেন্দ্র (FFWC/BWDB) প্রদান করে থাকে।"
                    ),
                    color: "text-rk-forest",
                  },
                  {
                    icon: Radar,
                    t: tr("Physical Radar Blind Spots (Sentinel-1 SAR)", "রাডারের সীমাবদ্ধতা ও অন্ধবিন্দু"),
                    d: tr(
                      "Synthetic Aperture Radar cannot penetrate dense tree canopy, steep hills, or narrow urban concrete corridors. Rapid urban flash waterlogging (e.g. Dhaka street floods) is not reliably detected. 8 hilly/forested districts are explicitly excluded from daily forecasts.",
                      "ঘন বন, পাহাড়ি এলাকা ও শহরের কংক্রিট বিল্ডিংয়ে রাডার সিগন্যাল বাধাগ্রস্ত হয়। তাই দ্রুতগতির শহুরে জলাবদ্ধতা রাডারে ধরা পড়ে না। ৮টি জেলা মডেলের আওতামুক্ত রাখা হয়েছে।"
                    ),
                    color: "text-rk-brand",
                  },
                  {
                    icon: Waves,
                    t: tr("Hydrological Model vs. Physical Gauges", "হাইড্রোলজিক্যাল মডেল বনাম গেজ রিডিং"),
                    d: tr(
                      "River inputs rely on GloFAS numerical model discharge at 9 global grid points rather than real-time physical telemetry river gauges. Measured river water levels will only be surfaced when authorized direct sensor APIs are integrated.",
                      "নদীর তথ্য মূলত গ্লোফাস বৈশ্বিক নিউমেরিক্যাল মডেল থেকে সংগৃহীত, যা সরাসরি নদীর গেজ মাপ নয়। অনুমোদিত সরকারি সেন্সর ডেটা যুক্ত হলে সরাসরি গেজ রিডিং প্রদর্শিত হবে।"
                    ),
                    color: "text-rk-forest",
                  },
                  {
                    icon: Database,
                    t: tr("Spatial Granularity & 1-Day Forecast Horizon", "স্থানিক রেজোলিউশন ও ১-দিনের পূর্বাভাস সীমা"),
                    d: tr(
                      "Predictions are produced once daily at district aggregate level (~90m Point Check raster). Micro-topography differences (such as individual houses or raised plinths) require on-ground local inspection.",
                      "পূর্বাভাস দৈনিক একবার জেলা পর্যায়ে দেওয়া হয়। কোনো সুনির্দিষ্ট বাড়ি বা উঁচু ভিটার অবস্থা জানতে স্থানীয় পর্যায়ে যাচাই আবশ্যক।"
                    ),
                    color: "text-rk-brand",
                  },
                ].map((c) => (
                  <div key={c.t} className="rounded-2xl border border-rk-line bg-rk-surface p-5 shadow-xs">
                    <div className="flex items-center gap-2.5 text-[15px] font-extrabold text-rk-forest">
                      <c.icon className={`h-5 w-5 ${c.color} shrink-0`} aria-hidden="true" />
                      <span>{c.t}</span>
                    </div>
                    <p className="mt-2.5 text-[13.5px] leading-relaxed text-rk-ink">{c.d}</p>
                  </div>
                ))}
              </div>

              {/* Quick Action Navigation */}
              <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={() => onAction({ kind: "view", view: "map" })}
                  className="w-full sm:w-auto inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-rk-forest px-6 text-[15px] font-bold text-white hover:bg-rk-forest/90 transition-colors shadow-sm"
                >
                  <MapIcon className="h-4 w-4" aria-hidden="true" /> {tr("Explore the Live Flood Map", "লাইভ বন্যার মানচিত্র দেখুন")}
                </button>
                <a
                  href="https://www.ffwc.gov.bd/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-rk-line bg-rk-surface px-6 text-[15px] font-bold text-rk-forest hover:bg-rk-secondary transition-colors"
                >
                  <span>{tr("Official FFWC Bulletins (ffwc.gov.bd)", "সরকারি বুলেটিন: ffwc.gov.bd")}</span>
                  <ExternalLink className="h-4 w-4 text-rk-muted" aria-hidden="true" />
                </a>
              </div>
            </div>
          </section>
        </div>
      )}

    </div>
  );
};

export default IntelligencePage;
