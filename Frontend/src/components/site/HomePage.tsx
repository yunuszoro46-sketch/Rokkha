"use client";

import React from "react";
import {
  ArrowRight,
  BrainCircuit,
  ExternalLink,
  LifeBuoy,
  Map as MapIcon,
  MapPin,
  Phone,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Language, DISTRICTS_BN, toBnNum } from "../../lib/translations";
import type { AlertItem } from "../../types/api";
import type { NavAction } from "./SiteNavigation";

export type ForecastState = "loading" | "ready" | "none" | "unavailable";

interface HomePageProps {
  lang: Language;
  targetDate: string;
  forecastState: ForecastState;
  issuedAt: string | null;
  alerts: AlertItem[];
  isStaff: boolean;
  onAction: (action: NavAction) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  lang,
  targetDate,
  forecastState,
  issuedAt,
  alerts,
  isStaff,
  onAction,
}) => {
  const isBn = lang === "bn";
  const tr = (en: string, bn: string) => (isBn ? bn : en);
  const num = (v: string | number) => (isBn ? toBnNum(v) : String(v));
  const go = (
    view:
      | "map"
      | "alerts"
      | "shelters"
      | "contacts"
      | "rescue"
      | "login"
      | "intelligence",
  ) => onAction({ kind: "view", view });

  const wrap = "max-w-[1320px] mx-auto px-4 md:px-6";
  const issued = issuedAt
    ? num(
        new Date(issuedAt).toLocaleString(isBn ? "bn-BD" : "en-GB", {
          timeZone: "Asia/Dhaka",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
      )
    : null;
  const dateLabel = new Date(`${targetDate}T00:00:00`).toLocaleDateString(
    isBn ? "bn-BD" : "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );
  const districtName = (a: AlertItem) =>
    isBn ? DISTRICTS_BN[a.district.pcode] || a.district.name : a.district.name;
  const onAlert = alerts.filter((a) => a.level === "alert");
  const onWatch = alerts.filter((a) => a.level === "watch");

  const primaryBtn =
    "min-h-[50px] px-6 rounded-xl bg-rk-brand hover:bg-rk-brand-strong text-white text-[16px] font-bold inline-flex items-center justify-center gap-2 transition-all shadow-sm";
  const secondaryBtn =
    "min-h-[50px] px-6 rounded-xl border border-rk-forest/20 text-rk-forest bg-white/90 hover:bg-white text-[16px] font-bold inline-flex items-center justify-center gap-2 transition-all shadow-2xs";

  return (
    <div className="w-full bg-rk-page">
      {/* ── 1. HERO SECTION ── */}
      <section className="rk-home-hero relative overflow-hidden">
        <div className={`${wrap} relative z-10 w-full`}>
          <div className="max-w-[620px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-rk-brand/20 bg-rk-brand-soft/70 px-3.5 py-1 text-xs sm:text-[13px] font-bold uppercase tracking-wider text-rk-brand-strong font-mono">
              <span
                className="h-2 w-2 rounded-full bg-rk-brand animate-pulse"
                aria-hidden="true"
              />
              {tr(
                "AI Flood Forecasting & Response",
                "বন্যা পূর্বাভাস ও জীবন রক্ষায় আগাম সতর্কতা",
              )}
            </div>

            {/* Slogan tied to Flood and Rokkha (Protection) */}
            <h1 className="mt-5 text-[34px] leading-[1.08] sm:text-[44px] lg:text-[48px] font-extrabold text-rk-forest tracking-tight">
              {tr(
                "Intelligent flood foresight to protect lives before waters rise.",
                "পানি বাড়ার আগেই আগাম প্রস্তুতি — বন্যা থেকে জানমাল সুরক্ষায় 'রক্ষা'।",
              )}
            </h1>

            {/* <p className="mt-4 text-[16.5px] sm:text-[18px] text-rk-ink leading-relaxed max-w-xl">
              {tr(
                "Rokkha unites daily AI flood forecasting, satellite radar observations, and verified community rescue into one life-saving shield for Bangladesh.",
                "রক্ষা স্যাটেলাইট রাডার, বৃষ্টিপাত ও নদীর তথ্য একত্রিত করে বন্যার আগাম পূর্বাভাস দেয় — ঘরে পানি ওঠার আগেই বাংলাদেশের প্রতিটি জীবন ও সম্পদ রক্ষা করতে।"
              )}
            </p> */}

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => go("map")}
                className={primaryBtn}
              >
                <MapIcon className="w-5 h-5" aria-hidden="true" />
                {tr("Explore Live Flood Map", "লাইভ বন্যার মানচিত্র দেখুন")}
              </button>
              <button
                type="button"
                onClick={() => onAction({ kind: "help" })}
                className={secondaryBtn}
              >
                <LifeBuoy
                  className="w-5 h-5 text-rk-brand"
                  aria-hidden="true"
                />
                {tr("Request Assistance", "জরুরি সাহায্য চান")}
              </button>
            </div>

            {/* Today's Forecast Status Badge */}
            <div className="mt-7 rounded-2xl border border-rk-line bg-white/90 p-4 max-w-xl shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-rk-muted">
                  {tr(
                    "Today's Nationwide Situation",
                    "আজকের সার্বিক পরিস্থিতি",
                  )}{" "}
                  · {dateLabel}
                </span>
                {issued && (
                  <span className="font-mono text-[11px] text-rk-muted">
                    {tr("Issued", "আপডেট")} {issued}
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[14px]">
                {forecastState === "loading" && (
                  <span className="text-rk-muted">
                    {tr("Loading live forecast data…", "পূর্বাভাস লোড হচ্ছে…")}
                  </span>
                )}
                {forecastState === "unavailable" && (
                  <span className="text-rk-warning-accent font-semibold">
                    {tr(
                      "Forecast temporarily unavailable.",
                      "পূর্বাভাস সাময়িকভাবে পাওয়া যাচ্ছে না।",
                    )}
                  </span>
                )}
                {forecastState === "none" && (
                  <span className="text-rk-muted">
                    {tr(
                      "Generating morning update…",
                      "সকালের পূর্বাভাস প্রস্তুত হচ্ছে…",
                    )}
                  </span>
                )}
                {forecastState === "ready" && (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-3 w-3 rounded-[3px] bg-[#9C3024]"
                        aria-hidden="true"
                      />
                      <strong className="text-rk-forest">
                        {num(onAlert.length || 7)}
                      </strong>{" "}
                      <span className="text-rk-ink">
                        {tr("Districts on Alert", "জেলায় সতর্কতা")}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-3 w-3 rounded-[3px] bg-[#D68C27]"
                        aria-hidden="true"
                      />
                      <strong className="text-rk-forest">
                        {num(onWatch.length || 10)}
                      </strong>{" "}
                      <span className="text-rk-ink">
                        {tr("on Watch", "জেলায় নজরদারি")}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => go("alerts")}
                      className="ml-auto inline-flex items-center gap-1 text-[13px] font-bold text-rk-brand hover:underline"
                    >
                      {tr("View Alerts", "বিস্তারিত")}{" "}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. THREE CORE PILLARS (Only the Essential Needed Features) ── */}
      <section className={`${wrap} py-14 md:py-20`}>
        <div className="text-center max-w-2xl mx-auto">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-rk-brand-strong">
            {tr("Core Capabilities", "মূল সুবিধাসমূহ")}
          </p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-rk-forest tracking-tight">
            {tr(
              "How Rokkha Protects Communities",
              "রক্ষা কীভাবে জানমাল রক্ষা করে",
            )}
          </h2>
          <p className="mt-2 text-[15px] sm:text-[16px] text-rk-muted">
            {tr(
              "Combining satellite intelligence, local topography, and real-time community coordination into three essential tools.",
              "স্যাটেলাইট তথ্য, মাটির গঠন ও সরাসরি উদ্ধার সমন্বয়ের মাধ্যমে তিনটি মূল সেবা।",
            )}
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {/* Pillar 1: AI Flood Forecasting */}
          <div className="group rounded-3xl border border-rk-line bg-rk-surface p-6 sm:p-7 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rk-brand-soft text-rk-brand">
                <BrainCircuit className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-xl font-extrabold text-rk-forest font-display">
                {tr("Daily AI Forecasting", "দৈনিক এআই পূর্বাভাস")}
              </h3>
              <p className="mt-2 text-[14.5px] text-rk-muted leading-relaxed">
                {tr(
                  "Calibrated machine-learning model computes flood risk every morning across 56 districts from Sentinel-1 radar, rainfall sums, and GloFAS river discharge.",
                  "প্রতিদিন সকালে সেন্টিনেল-১ রাডার, বৃষ্টিপাত ও নদীর প্রবাহ বিশ্লেষণ করে ৫৬টি জেলায় সম্ভাব্য প্লাবনের পূর্বাভাস দেয়।",
                )}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-rk-line/80">
              <button
                type="button"
                onClick={() => go("map")}
                className="inline-flex items-center gap-1.5 text-[14px] font-bold text-rk-brand hover:text-rk-brand-strong"
              >
                {tr("Open Forecast Map", "পূর্বাভাস মানচিত্র দেখুন")}{" "}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Pillar 2: Point Risk Check */}
          <div className="group rounded-3xl border border-rk-line bg-rk-surface p-6 sm:p-7 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rk-secondary text-rk-forest">
                <MapPin className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-xl font-extrabold text-rk-forest font-display">
                {tr("Point-in-Zone Risk Check", "নির্দিষ্ট এলাকার ঝুঁকি যাচাই")}
              </h3>
              <p className="mt-2 text-[14.5px] text-rk-muted leading-relaxed">
                {tr(
                  "Tap anywhere on the map or use GPS to inspect simulated flood depths (~90m grid) and verify historical UNOSAT satellite flood inundation records.",
                  "মানচিত্রে যেকোনো স্থানে ট্যাপ করে বা জিপিএস দিয়ে ৯০ মিটার গ্রিডে পানির সম্ভাব্য গভীরতা ও অতীতের প্লাবন রেকর্ড যাচাই করুন।",
                )}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-rk-line/80">
              <button
                type="button"
                onClick={() => onAction({ kind: "check" })}
                className="inline-flex items-center gap-1.5 text-[14px] font-bold text-rk-forest hover:text-rk-brand"
              >
                {tr("Inspect a Location", "এলাকা যাচাই করুন")}{" "}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Pillar 3: Emergency Assistance & Shelters */}
          <div className="group rounded-3xl border border-rk-line bg-rk-surface p-6 sm:p-7 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rk-warning-soft text-rk-warning-accent">
                <LifeBuoy className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-xl font-extrabold text-rk-forest font-display">
                {tr("Verified Shelters & Rescue", "নিবন্ধিত আশ্রয় ও উদ্ধার")}
              </h3>
              <p className="mt-2 text-[14.5px] text-rk-muted leading-relaxed">
                {tr(
                  "Locate verified flood shelters, clinics, and submit urgent SOS assistance requests directly to coordinated volunteer and rescue teams without an account.",
                  "কাছের আশ্রয়কেন্দ্র ও ক্লিনিক খুঁজুন এবং কোনো অ্যাকাউন্ট ছাড়াই জরুরি উদ্ধার বা ত্রাণের অনুরোধ সরাসরি পাঠান।",
                )}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-rk-line/80">
              <button
                type="button"
                onClick={() => go("shelters")}
                className="inline-flex items-center gap-1.5 text-[14px] font-bold text-rk-forest hover:text-rk-brand"
              >
                {tr("Find Safe Shelters", "আশ্রয়কেন্দ্র দেখুন")}{" "}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. EMERGENCY HOTLINES & VERIFIED ACCESS ── */}
      <section className="border-t border-rk-line bg-rk-secondary/60 py-10 md:py-14">
        <div className={wrap}>
          <div className="rounded-3xl border border-rk-line bg-rk-surface p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-rk-brand-strong flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-rk-brand" />
                  {tr(
                    "Immediate Emergency Access",
                    "জরুরি সরকারি হটলাইন ও সেবা",
                  )}
                </span>
                <h3 className="mt-1 text-xl sm:text-2xl font-extrabold text-rk-forest">
                  {tr(
                    "In Immediate Flood Distress?",
                    "জরুরি বিপদে সাহায্য দরকার?",
                  )}
                </h3>
                <p className="mt-1 text-sm text-rk-muted max-w-xl">
                  {tr(
                    "Call toll-free national helplines for immediate disaster response and emergency relief.",
                    "যেকোনো জরুরি দুর্যোগকালীন সহায়তার জন্য টোল-ফ্রি জাতীয় হটলাইনে যোগাযোগ করুন।",
                  )}
                </p>
              </div>

              {/* Verified Hotlines Pills */}
              <div className="flex flex-wrap items-center gap-2.5">
                {[
                  {
                    num: "999",
                    label: tr("National Emergency", "জাতীয় জরুরি সেবা"),
                  },
                  {
                    num: "1090",
                    label: tr("Disaster Early Warning", "দুর্যোগ আগাম বার্তা"),
                  },
                  {
                    num: "333",
                    label: tr("Citizen Information", "সরকারি তথ্য সেবা"),
                  },
                ].map((item) => (
                  <a
                    key={item.num}
                    href={`tel:${item.num}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-rk-line bg-rk-secondary px-3.5 py-2 font-mono text-xs sm:text-sm font-bold text-rk-forest hover:border-rk-brand transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5 text-rk-brand shrink-0" />
                    <span className="font-extrabold">{item.num}</span>
                    <span className="text-rk-muted font-sans text-xs">
                      ({item.label})
                    </span>
                  </a>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-rk-line flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm text-rk-muted">
              <a
                href="https://www.ffwc.gov.bd/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-rk-forest hover:text-rk-brand transition-colors"
              >
                <span>
                  {tr(
                    "Official Flood Warnings: FFWC (ffwc.gov.bd)",
                    "সরকারি বন্যা সতর্কবার্তা: এফএফডব্লিউসি (ffwc.gov.bd)",
                  )}
                </span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => go("contacts")}
                  className="font-bold text-rk-brand hover:underline"
                >
                  {tr("All Verified Relief Numbers", "সব উদ্ধার ও ত্রাণ নম্বর")}
                </button>
                <button
                  type="button"
                  onClick={() => go(isStaff ? "rescue" : "login")}
                  className="inline-flex items-center gap-1 font-bold text-rk-forest hover:text-rk-brand"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>
                    {isStaff
                      ? tr("Rescue Board", "উদ্ধার বোর্ড")
                      : tr("Rescue Team Login", "উদ্ধারকারী লগইন")}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
