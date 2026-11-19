// Flood-intelligence layers of the map (docs/MAPPING_ARCHITECTURE.md §5).
//
// One layer is shown at a time. Every layer is district-level, built from data the backend already serves,
// and says what KIND of information it is: a model forecast, an observation, a model input, history or a
// modelled hazard. These are never mixed in one colour scale. Colours are the flood data scales of
// docs/ROKKHA_DESIGN_SYSTEM.md §2 (MapLibre needs literal colours). Missing data is always its own class,
// drawn grey with a dashed edge, never "low".

import type { DistrictPrediction } from "../../types/api";

export type LayerKind = "forecast" | "observed" | "model-input" | "historical" | "modelled" | "reference";
export type LayerGroup = "flood" | "weather" | "water" | "geography" | "impact";
export const GROUP_LABEL: Record<LayerGroup, { en: string; bn: string }> = {
  flood: { en: "Flood", bn: "বন্যা" },
  weather: { en: "Weather", bn: "আবহাওয়া" },
  water: { en: "Water systems", bn: "নদী ও পানি" },
  geography: { en: "Geography", bn: "ভূগোল" },
  impact: { en: "Exposure", bn: "ঝুঁকিতে কী আছে" },
};
export type LayerId = "forecast" | "observed" | "history" | "rain" | "rainfc" | "river" | "hazard";

export type Words = { en: string; bn: string };

export interface LegendClass {
  id: string;
  color: string;
  label: Words;
  /** Missing / not covered: drawn with a dashed edge. */
  nodata?: boolean;
}

export interface DistrictValue {
  cls: string;
  /** Short readable value for tooltips and lists, e.g. "Watch · 23 %" */
  text: Words;
}

export interface SatelliteLatest {
  pcode: string;
  observable: boolean;
  observation: { date: string; observed_share: number; flooded_share: number; flooded: boolean | null } | null;
  days_ago: number | null;
}

export interface HistoryRow {
  pcode: string;
  events_observed: number;
  events_flooded: number;
  max_flooded_share: number | null;
  hazard_share_10yr?: number | null;
  hazard_share_100yr?: number | null;
}

export interface RainForecastRow {
  district_pcode: string;
  fetched_at: string | null;
  total_mm: number | null;
  hours_covered: number;
  window_start: string | null;
  window_end: string | null;
}

export interface LayerData {
  predictions: Map<string, DistrictPrediction>;
  forecastLoaded: boolean;
  satellite: Map<string, SatelliteLatest> | null;
  history: Map<string, HistoryRow> | null;
  /** null = not loaded yet; empty map = loaded, nothing stored. */
  rainForecast?: Map<string, RainForecastRow> | null;
}

export interface LayerDef {
  id: LayerId;
  kind: LayerKind;
  group: LayerGroup;
  label: Words;
  short: Words;
  what: Words;
  source: Words;
  /** Follows the chosen forecast day. */
  dateDependent: boolean;
  /** Always the latest stored forecast, whatever day is chosen (shown with its own time window). */
  latest?: boolean;
  needs: "predictions" | "satellite" | "history" | "rainforecast";
  classes: LegendClass[];
  value: (pcode: string, data: LayerData, bn: boolean) => DistrictValue;
}

export const KIND_LABEL: Record<LayerKind, Words> = {
  forecast: { en: "Model forecast", bn: "মডেলের পূর্বাভাস" },
  observed: { en: "Observed (satellite)", bn: "পর্যবেক্ষণ (স্যাটেলাইট)" },
  "model-input": { en: "Model input data", bn: "মডেলের ইনপুট তথ্য" },
  historical: { en: "Historical record", bn: "ঐতিহাসিক রেকর্ড" },
  modelled: { en: "Modelled hazard", bn: "মডেলভিত্তিক ঝুঁকি" },
  reference: { en: "Geographic reference", bn: "ভৌগোলিক তথ্য" },
};

const NODATA = "#C9C5BA";
const pct = (v: number, bn: boolean) => {
  const n = v < 0.01 ? "<1" : String(Math.round(v * 100)); // never "0 %": a calibrated 0 is still "under 1 %"
  return bn ? n.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]) + "%" : `${n} %`;
};
const num = (v: number | string, bn: boolean) => (bn ? String(v).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]) : String(v));
const W = (en: string, bn: string): Words => ({ en, bn });

export const LAYERS: LayerDef[] = [
  {
    id: "forecast",
    group: "flood",
    kind: "forecast",
    label: W("Flood forecast", "বন্যার পূর্বাভাস"),
    short: W("Forecast", "পূর্বাভাস"),
    what: W(
      "Chance that satellites see flooding in the district on the chosen day, from Rokkha's machine-learning model. Watch and Alert are the model's warning levels.",
      "বেছে নেওয়া দিনে জেলায় স্যাটেলাইটে বন্যা দেখা যাওয়ার সম্ভাবনা, রক্ষার মেশিন-লার্নিং মডেল থেকে। নজরদারি ও সতর্কতা হলো মডেলের নিজস্ব স্তর।"
    ),
    source: W("Rokkha XGBoost model · district level · not an official warning (ffwc.gov.bd)", "রক্ষা XGBoost মডেল · জেলা স্তর · সরকারি সতর্কবার্তা নয় (ffwc.gov.bd)"),
    dateDependent: true,
    needs: "predictions",
    classes: [
      { id: "alert", color: "#B3392D", label: W("Alert — be ready to move", "সতর্কতা — সরে যাওয়ার প্রস্তুতি নিন") },
      { id: "watch", color: "#E9B949", label: W("Watch — get prepared", "নজরদারি — প্রস্তুতি নিন") },
      { id: "low", color: "#CFD9CC", label: W("Low chance — not zero", "কম সম্ভাবনা — শূন্য নয়") },
      { id: "unsupported", color: NODATA, label: W("Not covered by the model", "মডেলের আওতার বাইরে"), nodata: true },
      { id: "none", color: NODATA, label: W("No forecast for this day", "এই দিনের পূর্বাভাস নেই"), nodata: true },
    ],
    value: (pcode, d, bn) => {
      if (!d.forecastLoaded) return { cls: "none", text: W("Loading…", "লোড হচ্ছে…") };
      const p = d.predictions.get(pcode);
      if (!p) return { cls: "none", text: W("No forecast", "পূর্বাভাস নেই") };
      if (p.status === "unsupported") return { cls: "unsupported", text: W("Not covered by the model", "মডেলের আওতার বাইরে") };
      if (p.status !== "predicted" || p.probability == null) return { cls: "none", text: W("No forecast (inputs missing)", "পূর্বাভাস নেই (তথ্য অনুপস্থিত)") };
      const chance = p.probability > 0.95 ? (bn ? ">৯৫%" : ">95 %") : pct(p.probability, bn);
      if (p.alert_level === "alert") return { cls: "alert", text: W(`Alert · ${chance}`, `সতর্কতা · ${chance}`) };
      if (p.alert_level === "watch") return { cls: "watch", text: W(`Watch · ${chance}`, `নজরদারি · ${chance}`) };
      return { cls: "low", text: W(`Low · ${chance}`, `কম · ${chance}`) };
    },
  },
  {
    id: "observed",
    group: "flood",
    kind: "observed",
    label: W("Satellite-observed flooding", "স্যাটেলাইটে দেখা বন্যা"),
    short: W("Observed", "পর্যবেক্ষণ"),
    what: W(
      "Flood water in the newest Sentinel-1 radar pass that saw at least half the district, up to 30 days before the chosen day. 'Flooded' means unusual water on at least 10 % of the visible land.",
      "বেছে নেওয়া দিনের আগের ৩০ দিনের মধ্যে জেলার অন্তত অর্ধেক দেখা সর্বশেষ সেন্টিনেল-১ রাডার ছবিতে বন্যার পানি। দেখা জমির অন্তত ১০% এ অস্বাভাবিক পানি থাকলে ‘প্লাবিত’।"
    ),
    source: W("Copernicus EMS Global Flood Monitoring (GFM), Sentinel-1 · observation, not a forecast", "কোপার্নিকাস EMS GFM, সেন্টিনেল-১ · পর্যবেক্ষণ, পূর্বাভাস নয়"),
    dateDependent: true,
    needs: "satellite",
    classes: [
      { id: "flooded", color: "#1F5F8B", label: W("Flooded (≥ 10 % of visible land)", "প্লাবিত (দেখা জমির ≥ ১০%)") },
      { id: "some", color: "#7FB2D5", label: W("Some flood water (2–10 %)", "কিছু বন্যার পানি (২–১০%)") },
      { id: "dry", color: "#E3EEF4", label: W("Little or none seen (< 2 %)", "সামান্য বা দেখা যায়নি (< ২%)") },
      { id: "nopass", color: NODATA, label: W("No pass in the last 30 days", "গত ৩০ দিনে ছবি নেই"), nodata: true },
      { id: "unobservable", color: "#B9B4A8", label: W("Radar cannot see this district", "রাডারে দেখা যায় না"), nodata: true },
    ],
    value: (pcode, d, bn) => {
      const s = d.satellite?.get(pcode);
      if (!d.satellite) return { cls: "nopass", text: W("Loading…", "লোড হচ্ছে…") };
      if (!s) return { cls: "nopass", text: W("No data", "তথ্য নেই") };
      if (!s.observable) return { cls: "unobservable", text: W("Radar cannot see this district", "রাডারে দেখা যায় না") };
      if (!s.observation) return { cls: "nopass", text: W("No pass in 30 days", "৩০ দিনে ছবি নেই") };
      const share = pct(s.observation.flooded_share, bn);
      const when = bn ? `${num(s.days_ago ?? 0, true)} দিন আগে` : `${s.days_ago ?? 0} d ago`;
      const cls = s.observation.flooded ? "flooded" : s.observation.flooded_share >= 0.02 ? "some" : "dry";
      return { cls, text: W(`${share} water · ${when}`, `${share} পানি · ${when}`) };
    },
  },
  {
    id: "history",
    group: "flood",
    kind: "historical",
    label: W("Past floods 2016–2024", "অতীতের বন্যা ২০১৬–২০২৪"),
    short: W("History", "ইতিহাস"),
    what: W(
      "In how many of 10 major flood events (2016–2024) satellite analyses found flood water in the district. History does not predict the next flood.",
      "১০টি বড় বন্যার (২০১৬–২০২৪) কয়টিতে স্যাটেলাইট বিশ্লেষণে জেলায় বন্যার পানি পাওয়া গেছে। ইতিহাস পরের বন্যার পূর্বাভাস নয়।"
    ),
    source: W("UNOSAT satellite flood analyses, 10 events · historical record", "UNOSAT স্যাটেলাইট বিশ্লেষণ, ১০টি ঘটনা · ঐতিহাসিক"),
    dateDependent: false,
    needs: "history",
    classes: [
      { id: "h4", color: "#7A4E2D", label: W("Flooded in 4 or more events", "৪ বা তার বেশি ঘটনায় প্লাবিত") },
      { id: "h2", color: "#B8875A", label: W("2–3 events", "২–৩টি ঘটনা") },
      { id: "h1", color: "#D9BF95", label: W("1 event", "১টি ঘটনা") },
      { id: "h0", color: "#F1E9DA", label: W("None of the observed events", "কোনো দেখা ঘটনায় নয়") },
      { id: "hnone", color: NODATA, label: W("Never covered by an analysis", "কোনো বিশ্লেষণে আসেনি"), nodata: true },
    ],
    value: (pcode, d, bn) => {
      const h = d.history?.get(pcode);
      if (!d.history) return { cls: "hnone", text: W("Loading…", "লোড হচ্ছে…") };
      if (!h || !h.events_observed) return { cls: "hnone", text: W("Never analysed", "বিশ্লেষণ হয়নি") };
      const f = h.events_flooded;
      const cls = f >= 4 ? "h4" : f >= 2 ? "h2" : f === 1 ? "h1" : "h0";
      return { cls, text: W(`${f} of ${h.events_observed} events`, `${num(h.events_observed, true)}টির ${num(f, true)}টিতে`) };
    },
  },
  {
    id: "rain",
    group: "weather",
    kind: "model-input",
    label: W("Rain in the past 7 days", "গত ৭ দিনের বৃষ্টি"),
    short: W("Rain 7 d", "বৃষ্টি ৭ দিন"),
    what: W(
      "Total rain in the 7 days before the chosen day at the district's point, as the model used it. Reanalysis and weather-model estimates, not rain gauges.",
      "বেছে নেওয়া দিনের আগের ৭ দিনে জেলার বিন্দুতে মোট বৃষ্টি, মডেল যেভাবে ব্যবহার করেছে। রিঅ্যানালাইসিস ও আবহাওয়া মডেলের অনুমান, বৃষ্টিমাপক নয়।"
    ),
    source: W("ERA5 (ECMWF) and recent GFS (NOAA) via Open-Meteo · model input", "ERA5 ও সাম্প্রতিক GFS, Open-Meteo · মডেলের ইনপুট"),
    dateDependent: true,
    needs: "predictions",
    classes: [
      { id: "r300", color: "#1B4F63", label: W("300 mm or more", "৩০০ মিমি বা বেশি") },
      { id: "r150", color: "#2F7A8C", label: W("150–300 mm", "১৫০–৩০০ মিমি") },
      { id: "r75", color: "#6FA9B5", label: W("75–150 mm", "৭৫–১৫০ মিমি") },
      { id: "r25", color: "#B9D8DA", label: W("25–75 mm", "২৫–৭৫ মিমি") },
      { id: "r0", color: "#EEF4F1", label: W("Under 25 mm", "২৫ মিমির কম") },
      { id: "rnone", color: NODATA, label: W("No rain data used for this district", "এই জেলার বৃষ্টির তথ্য নেই"), nodata: true },
    ],
    value: (pcode, d, bn) => {
      const v = d.predictions.get(pcode)?.features?.rain_7d;
      if (!d.forecastLoaded) return { cls: "rnone", text: W("Loading…", "লোড হচ্ছে…") };
      if (v == null) return { cls: "rnone", text: W("No data", "তথ্য নেই") };
      const cls = v >= 300 ? "r300" : v >= 150 ? "r150" : v >= 75 ? "r75" : v >= 25 ? "r25" : "r0";
      const mm = Math.round(v);
      return { cls, text: W(`${mm} mm`, `${num(mm, true)} মিমি`) };
    },
  },
  {
    id: "rainfc",
    group: "weather",
    kind: "forecast",
    label: W("Rain forecast, next 3 days", "বৃষ্টির পূর্বাভাস, পরের ৩ দিন"),
    short: W("Rain forecast", "বৃষ্টির পূর্বাভাস"),
    what: W(
      "Total rain the weather model forecasts at the district's point over the next 72 hours after the latest daily fetch. Forecast rain, not a flood forecast and not a gauge reading.",
      "সর্বশেষ দৈনিক সংগ্রহের পরের ৭২ ঘণ্টায় জেলার বিন্দুতে আবহাওয়া মডেলের পূর্বাভাসিত মোট বৃষ্টি। বৃষ্টির পূর্বাভাস, বন্যার পূর্বাভাস নয়; বৃষ্টিমাপকের মাপও নয়।"
    ),
    source: W("GFS (NOAA NCEP) via Open-Meteo, hourly, ~13–25 km grid · weather forecast", "GFS (NOAA), Open-Meteo, ঘণ্টাভিত্তিক · আবহাওয়ার পূর্বাভাস"),
    dateDependent: false,
    latest: true,
    needs: "rainforecast",
    classes: [
      { id: "f150", color: "#1B4F63", label: W("150 mm or more", "১৫০ মিমি বা বেশি") },
      { id: "f75", color: "#2F7A8C", label: W("75–150 mm", "৭৫–১৫০ মিমি") },
      { id: "f25", color: "#6FA9B5", label: W("25–75 mm", "২৫–৭৫ মিমি") },
      { id: "f5", color: "#B9D8DA", label: W("5–25 mm", "৫–২৫ মিমি") },
      { id: "f0", color: "#EEF4F1", label: W("Under 5 mm", "৫ মিমির কম") },
      { id: "fnone", color: NODATA, label: W("No forecast stored", "কোনো পূর্বাভাস সংরক্ষিত নেই"), nodata: true },
    ],
    value: (pcode, d, bn) => {
      if (d.rainForecast == null) return { cls: "fnone", text: W("Loading…", "লোড হচ্ছে…") };
      const r = d.rainForecast.get(pcode);
      if (!r || r.total_mm == null) return { cls: "fnone", text: W("No forecast stored", "পূর্বাভাস নেই") };
      const v = r.total_mm;
      const cls = v >= 150 ? "f150" : v >= 75 ? "f75" : v >= 25 ? "f25" : v >= 5 ? "f5" : "f0";
      const mm = Math.round(v);
      const part = r.hours_covered < 72 ? ` (${r.hours_covered} h)` : "";
      return { cls, text: W(`${mm} mm${part}`, `${num(mm, true)} মিমি${part ? ` (${num(r.hours_covered, true)} ঘ.)` : ""}`) };
    },
  },
  {
    id: "river",
    group: "water",
    kind: "model-input",
    label: W("River flow vs usual", "নদীর প্রবাহ বনাম স্বাভাবিক"),
    short: W("River flow", "নদীর প্রবাহ"),
    what: W(
      "Yesterday's modelled river flow at the nearest followed river site, compared with its average of the month before. A model of the river, not a gauge reading.",
      "নিকটতম নদী-বিন্দুতে গতকালের মডেলভিত্তিক প্রবাহ, আগের মাসের গড়ের তুলনায়। নদীর মডেল, পানির উচ্চতার মাপ নয়।"
    ),
    source: W("GloFAS river discharge (Copernicus EMS) via Open-Meteo, 9 river sites · model input", "GloFAS নদী-প্রবাহ, ৯টি নদী-বিন্দু · মডেলের ইনপুট"),
    dateDependent: true,
    needs: "predictions",
    classes: [
      { id: "v2", color: "#1E5A6B", label: W("Twice the usual or more", "স্বাভাবিকের দ্বিগুণ বা বেশি") },
      { id: "v125", color: "#7FB2C5", label: W("Higher than usual (×1.25–2)", "স্বাভাবিকের চেয়ে বেশি (×১.২৫–২)") },
      { id: "v1", color: "#E8ECE4", label: W("Near usual (×0.8–1.25)", "প্রায় স্বাভাবিক (×০.৮–১.২৫)") },
      { id: "v0", color: "#D9C9A8", label: W("Lower than usual (< ×0.8)", "স্বাভাবিকের চেয়ে কম (< ×০.৮)") },
      { id: "vnone", color: NODATA, label: W("No river data used for this district", "এই জেলার নদীর তথ্য নেই"), nodata: true },
    ],
    value: (pcode, d, bn) => {
      const v = d.predictions.get(pcode)?.features?.river_vs_30d_mean;
      if (!d.forecastLoaded) return { cls: "vnone", text: W("Loading…", "লোড হচ্ছে…") };
      if (v == null) return { cls: "vnone", text: W("No data", "তথ্য নেই") };
      const cls = v >= 2 ? "v2" : v >= 1.25 ? "v125" : v >= 0.8 ? "v1" : "v0";
      const x = v.toFixed(2);
      return { cls, text: W(`×${x} of usual`, `স্বাভাবিকের ×${num(x, true)}`) };
    },
  },
  {
    id: "hazard",
    group: "flood",
    kind: "modelled",
    label: W("Modelled river-flood zone", "মডেলভিত্তিক নদী-বন্যা এলাকা"),
    short: W("Hazard zone", "ঝুঁকি এলাকা"),
    what: W(
      "Share of the district's land inside the modelled 1-in-100-year river-flood zone. A long-term hazard model that ignores embankments; it says nothing about today.",
      "জেলার জমির কত অংশ মডেলের ১০০ বছরে একবারের নদী-বন্যা এলাকায়। দীর্ঘমেয়াদি মডেল, বাঁধের প্রভাব হিসাবে নেয় না; আজকের অবস্থা বলে না।"
    ),
    source: W("JRC GloFAS flood hazard maps v2.1.2 (© European Union) · modelled", "JRC GloFAS বন্যা-ঝুঁকি মানচিত্র v2.1.2 · মডেলভিত্তিক"),
    dateDependent: false,
    needs: "history",
    classes: [
      { id: "z60", color: "#8E5434", label: W("60 % of the land or more", "জমির ৬০% বা বেশি") },
      { id: "z30", color: "#C98F5A", label: W("30–60 %", "৩০–৬০%") },
      { id: "z10", color: "#E3C9A0", label: W("10–30 %", "১০–৩০%") },
      { id: "z0", color: "#F3EEE3", label: W("Under 10 %", "১০% এর কম") },
      { id: "znone", color: NODATA, label: W("Not computed", "হিসাব হয়নি"), nodata: true },
    ],
    value: (pcode, d, bn) => {
      const v = d.history?.get(pcode)?.hazard_share_100yr;
      if (!d.history) return { cls: "znone", text: W("Loading…", "লোড হচ্ছে…") };
      if (v == null) return { cls: "znone", text: W("Not computed", "হিসাব হয়নি") };
      const cls = v >= 0.6 ? "z60" : v >= 0.3 ? "z30" : v >= 0.1 ? "z10" : "z0";
      return { cls, text: W(`${pct(v, bn)} of land`, `জমির ${pct(v, bn)}`) };
    },
  },
];

/** Layers people may expect but that Rokkha cannot show honestly yet. Listed, never drawn. */
export const UNAVAILABLE_LAYERS: { group: LayerGroup; label: Words; why: Words }[] = [
  {
    group: "flood",
    label: W("Forecast flood extent (inundation map)", "পূর্বাভাসের প্লাবন-মানচিত্র"),
    why: W("The model gives one chance per district, not a map of where water will be. A district value is not turned into a flood map.", "মডেল প্রতি জেলায় একটি সম্ভাবনা দেয়, পানি কোথায় যাবে তার মানচিত্র নয়।"),
  },
  {
    group: "water",
    label: W("Official gauge water levels and danger levels (FFWC)", "সরকারি গেজের পানির উচ্চতা ও বিপদসীমা (FFWC)"),
    why: W("No documented public data access. See ffwc.gov.bd.", "প্রকাশ্য তথ্য-সংযোগ নেই। ffwc.gov.bd দেখুন।"),
  },
  {
    group: "impact",
    label: W("Population exposure", "ঝুঁকিতে থাকা জনসংখ্যা"),
    why: W("No population grid is connected, so no people count is estimated.", "কোনো জনসংখ্যা-গ্রিড যুক্ত নেই, তাই মানুষের সংখ্যা অনুমান করা হয় না।"),
  },
  {
    group: "impact",
    label: W("Damage and blocked roads", "ক্ষয়ক্ষতি ও বন্ধ রাস্তা"),
    why: W("No verified damage or road-status source is connected. Help requests are private and never shown.", "যাচাই করা ক্ষয়ক্ষতি বা রাস্তার অবস্থার কোনো উৎস নেই। সাহায্যের অনুরোধ গোপন থাকে, কখনো দেখানো হয় না।"),
  },
];

export const layerById = (id: LayerId) => LAYERS.find((l) => l.id === id)!;
export const classColor = (layer: LayerDef, cls: string) => layer.classes.find((c) => c.id === cls)?.color ?? NODATA;
export const isNodata = (layer: LayerDef, cls: string) => !!layer.classes.find((c) => c.id === cls)?.nodata;
