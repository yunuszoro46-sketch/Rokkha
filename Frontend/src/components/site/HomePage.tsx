"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BellRing,
  BrainCircuit,
  ChevronDown,
  CloudRain,
  Droplets,
  ExternalLink,
  HeartPulse,
  House,
  Layers,
  LifeBuoy,
  Map as MapIcon,
  MapPin,
  Phone,
  Radar,
  Sailboat,
  ShieldCheck,
  Users,
  Waves,
} from "lucide-react";
import { Language, DISTRICTS_BN, toBnNum } from "../../lib/translations";
import type { AlertItem } from "../../types/api";
import { Notice } from "../rk/Notice";
import { HeroIntelligenceMap } from "./HeroIntelligenceMap";
import type { NavAction } from "./SiteNavigation";

// The public homepage (docs/ROKKHA_DESIGN_SYSTEM.md, "Earth & Emerald").
// Order follows the product: flood intelligence first (A–D), assistance second (E).
// Everything stated here exists in the app; every number shown is real data or absent.

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

/** Fades a block in when it scrolls into view. Visible without JavaScript and with reduced motion. */
const Reveal: React.FC<{ children: React.ReactNode; className?: string; delay?: number }> = ({ children, className = "", delay = 0 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "hidden" | "in">("idle");
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen: never hide it
    setState("hidden");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`${state === "hidden" ? "rk-reveal-hidden" : state === "in" ? "rk-reveal-in" : ""} ${className}`}
      style={state === "in" && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
};

/** Faint contour lines used as a background texture on dark sections. Decorative. */
const Contours: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} preserveAspectRatio="none" viewBox="0 0 800 400">
    <g fill="none" stroke="currentColor" strokeWidth="1">
      {Array.from({ length: 11 }, (_, i) => {
        const y = 20 + i * 38;
        return <path key={i} d={`M-20 ${y} C 140 ${y - 26} 260 ${y + 30} 420 ${y} S 700 ${y - 22} 820 ${y + 12}`} />;
      })}
    </g>
  </svg>
);

export const HomePage: React.FC<HomePageProps> = ({ lang, targetDate, forecastState, issuedAt, alerts, isStaff, onAction }) => {
  const isBn = lang === "bn";
  const tr = (en: string, bn: string) => (isBn ? bn : en);
  const num = (v: string | number) => (isBn ? toBnNum(v) : String(v));
  const [safetyOpen, setSafetyOpen] = useState(false);
  const go = (view: "map" | "alerts" | "shelters" | "contacts" | "rescue" | "login") => onAction({ kind: "view", view });
  const wrap = "max-w-[1240px] mx-auto px-4 md:px-6";
  const issued = issuedAt
    ? num(new Date(issuedAt).toLocaleString(isBn ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }))
    : null;
  const dateLabel = new Date(`${targetDate}T00:00:00`).toLocaleDateString(isBn ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  const districtName = (a: AlertItem) => (isBn ? DISTRICTS_BN[a.district.pcode] || a.district.name : a.district.name);
  const onAlert = alerts.filter((a) => a.level === "alert");
  const onWatch = alerts.filter((a) => a.level === "watch");

  const primaryBtn = "h-13 min-h-[52px] px-6 rounded-xl bg-rk-brand hover:bg-rk-brand-strong text-white text-[17px] font-bold inline-flex items-center justify-center gap-2 transition-colors";
  const secondaryBtn = "h-13 min-h-[52px] px-6 rounded-xl border border-rk-forest/25 text-rk-forest bg-rk-surface/80 hover:bg-rk-surface text-[17px] font-bold inline-flex items-center justify-center gap-2 transition-colors";
  const eyebrow = "rk-eyebrow font-mono text-xs sm:text-[13px] font-semibold tracking-[0.14em] uppercase";
  const h2 = "text-[28px] md:text-[40px] leading-[1.12] font-extrabold text-rk-forest";
  const lead = "mt-4 text-[17px] md:text-lg text-rk-muted leading-relaxed max-w-2xl";

  return (
    <div>
      {/* A — Hero: flood intelligence first */}
      <section className="relative overflow-hidden bg-grad-earth border-b border-rk-line">
        <Contours className="text-rk-moss opacity-[0.13]" />
        <div className={`${wrap} relative py-10 md:py-16 lg:py-20 grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-center`}>
          <div>
            <p className={`${eyebrow} text-rk-brand-strong inline-flex items-center gap-2`}>
              <span className="h-2 w-2 rounded-full bg-rk-brand" aria-hidden="true" />
              {tr("Flood intelligence & early warning", "বন্যা তথ্য ও আগাম সতর্কতা")}
            </p>
            <h1 className="mt-5 text-[38px] leading-[1.06] sm:text-[48px] lg:text-[58px] font-extrabold text-rk-forest">
              {tr("See the risk before the water rises.", "পানি বাড়ার আগেই ঝুঁকি দেখুন।")}
            </h1>
            <p className="mt-5 text-[18px] md:text-xl text-rk-ink leading-relaxed max-w-xl">
              {tr(
                "Rokkha brings flood forecasting, geographic intelligence and early warnings together to help people and communities in Bangladesh understand changing flood risk and prepare ahead.",
                "রক্ষা বন্যার পূর্বাভাস, ভৌগোলিক তথ্য ও আগাম সতর্কতা একসাথে এনে বাংলাদেশের মানুষ ও এলাকাকে বদলে যাওয়া বন্যা ঝুঁকি বুঝতে ও আগে থেকে প্রস্তুত হতে সাহায্য করে।"
              )}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-3 [&>button]:whitespace-nowrap">
              <button type="button" onClick={() => go("map")} className={primaryBtn}>
                <MapIcon className="w-5 h-5" aria-hidden="true" />
                {tr("Explore flood intelligence", "বন্যা তথ্য দেখুন")}
              </button>
              <button type="button" onClick={() => onAction({ kind: "help" })} className={secondaryBtn}>
                <LifeBuoy className="w-5 h-5 text-rk-brand" aria-hidden="true" />
                {tr("Request assistance", "সাহায্য চান")}
              </button>
            </div>
            <a href="#how" className="mt-4 inline-flex min-h-11 items-center gap-1.5 font-semibold text-rk-brand-strong underline underline-offset-4 decoration-rk-brand/40 hover:decoration-rk-brand">
              {tr("How Rokkha works", "রক্ষা কীভাবে কাজ করে")}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>

            {/* Today's real forecast, or an honest "not available" */}
            <div className="mt-7 rounded-2xl border border-rk-line bg-rk-surface/85 backdrop-blur px-4 py-3 max-w-xl" aria-live="polite">
              <p className={`${eyebrow} !text-[11px] text-rk-muted`}>
                {tr("Today's model forecast", "আজকের মডেল পূর্বাভাস")} · {dateLabel}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[15px] text-rk-ink">
                {forecastState === "loading" && <span>{tr("Getting the forecast…", "পূর্বাভাস আনা হচ্ছে…")}</span>}
                {forecastState === "unavailable" && <span>{tr("Forecast currently unavailable.", "পূর্বাভাস এখন পাওয়া যাচ্ছে না।")}</span>}
                {forecastState === "none" && <span>{tr("Not issued yet for this day (usually ready in the morning).", "এই দিনের পূর্বাভাস এখনো তৈরি হয়নি (সাধারণত সকালে হয়)।")}</span>}
                {forecastState === "ready" && (
                  <>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm bg-rk-risk-alert" aria-hidden="true" />
                      <strong>{num(onAlert.length)}</strong> {tr("on Alert", "জেলায় সতর্কতা")}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm bg-rk-risk-watch" aria-hidden="true" />
                      <strong>{num(onWatch.length)}</strong> {tr("on Watch", "জেলায় নজরদারি")}
                    </span>
                    {issued && <span className="font-mono text-[13px] text-rk-muted">{tr("issued", "তৈরি")} {issued}</span>}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[580px]">
            <HeroIntelligenceMap lang={lang} />
          </div>
        </div>
      </section>

      {/* B — Understand the changing risk */}
      <section className={`${wrap} py-16 md:py-24`} aria-labelledby="risk-title">
        <Reveal>
          <p className={`${eyebrow} text-rk-clay-text`}>{tr("What Rokkha shows", "রক্ষা কী দেখায়")}</p>
          <h2 id="risk-title" className={`mt-3 ${h2}`}>{tr("Understand the changing risk", "বদলে যাওয়া ঝুঁকি বুঝুন")}</h2>
          <p className={lead}>
            {tr(
              "Floods build up from rain, rivers and the shape of the land. Rokkha puts these together every day so you can see where water may rise and when to get ready.",
              "বৃষ্টি, নদী আর মাটির গঠন মিলে বন্যা হয়। রক্ষা প্রতিদিন এগুলো একসাথে দেখে, যাতে আপনি বুঝতে পারেন কোথায় পানি বাড়তে পারে এবং কখন প্রস্তুত হতে হবে।"
            )}
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-12">
          {/* Feature card (forecast): dark, with a gradient */}
          <Reveal className="lg:col-span-7 lg:row-span-2">
            <button
              type="button"
              onClick={() => go("map")}
              className="group relative h-full w-full overflow-hidden rounded-3xl bg-rk-forest text-left text-white p-7 md:p-9 min-h-[300px] flex flex-col"
              style={{ backgroundImage: "var(--rk-grad-forest)" }}
            >
              <Contours className="text-white opacity-[0.08]" />
              <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/20">
                <BrainCircuit className="w-6 h-6" aria-hidden="true" />
              </span>
              <h3 className="relative mt-5 text-2xl md:text-[28px] font-extrabold">{tr("Daily flood forecasts", "প্রতিদিনের বন্যা পূর্বাভাস")}</h3>
              <p className="relative mt-3 text-[16px] md:text-[17px] text-white/90 leading-relaxed max-w-lg">
                {tr(
                  "Every morning a machine-learning model estimates the chance of flooding in each district that day, from recent rain, river flow and satellite observations.",
                  "প্রতিদিন সকালে একটি মেশিন-লার্নিং মডেল সাম্প্রতিক বৃষ্টি, নদীর প্রবাহ ও স্যাটেলাইট পর্যবেক্ষণ থেকে প্রতিটি জেলায় সেদিনের বন্যার সম্ভাবনা হিসাব করে।"
                )}
              </p>
              <div className="relative mt-auto pt-8 flex flex-wrap items-end justify-between gap-4">
                <ul className="flex flex-wrap gap-2 text-[13px] font-semibold" aria-label={tr("Forecast levels", "পূর্বাভাসের স্তর")}>
                  <li className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1"><span className="h-2.5 w-2.5 rounded-full bg-rk-risk-low" aria-hidden="true" />{tr("Low chance", "কম সম্ভাবনা")}</li>
                  <li className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1"><span className="h-2.5 w-2.5 rounded-full bg-rk-risk-watch" aria-hidden="true" />{tr("Watch", "নজরদারি")}</li>
                  <li className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1"><span className="h-2.5 w-2.5 rounded-full bg-rk-risk-alert ring-1 ring-white/60" aria-hidden="true" />{tr("Alert", "সতর্কতা")}</li>
                </ul>
                <span className="inline-flex items-center gap-1.5 font-bold group-hover:gap-2.5 transition-all">
                  {tr("Open the forecast map", "পূর্বাভাসের মানচিত্র খুলুন")} <ArrowRight className="w-5 h-5" aria-hidden="true" />
                </span>
              </div>
            </button>
          </Reveal>
          {[
            {
              icon: Layers,
              en: "Geographic risk view",
              bn: "ভৌগোলিক ঝুঁকি",
              den: "Tap any spot on the map to see its modelled flood depth and whether satellites saw it flooded before.",
              dbn: "মানচিত্রে যেকোনো জায়গায় চাপ দিয়ে দেখুন সেখানে মডেল অনুযায়ী পানির গভীরতা এবং আগে স্যাটেলাইটে বন্যা দেখা গেছে কি না।",
              run: () => go("map"),
              tint: "bg-rk-mist",
            },
            {
              icon: BellRing,
              en: "Early warnings",
              bn: "আগাম সতর্কতা",
              den: "Districts move to Watch or Alert when the chance is high, with registered shelters and hospitals in each one.",
              dbn: "সম্ভাবনা বেশি হলে জেলা নজরদারি বা সতর্কতা স্তরে যায়, সাথে সেই জেলার নিবন্ধিত আশ্রয়কেন্দ্র ও হাসপাতাল।",
              run: () => go("alerts"),
              tint: "bg-rk-warning-soft",
            },
          ].map((card, i) => (
            <Reveal key={card.en} delay={(i + 1) * 90} className="lg:col-span-5">
              <button type="button" onClick={card.run} className="rk-lift group h-full w-full rounded-3xl border border-rk-line bg-rk-surface p-6 md:p-7 text-left flex gap-5">
                <span className={`h-12 w-12 shrink-0 rounded-xl ${card.tint} text-rk-forest flex items-center justify-center`}>
                  <card.icon className="w-6 h-6" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-xl font-extrabold text-rk-forest font-display">{tr(card.en, card.bn)}</span>
                  <span className="mt-1.5 block text-[15px] text-rk-muted leading-relaxed">{tr(card.den, card.dbn)}</span>
                  <span className="mt-3 inline-flex items-center gap-1 text-[15px] font-bold text-rk-brand-strong">
                    {tr("Open", "খুলুন")} <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                  </span>
                </span>
              </button>
            </Reveal>
          ))}
        </div>
        <Reveal delay={200}>
          <div className="mt-4 rounded-3xl border border-rk-line bg-rk-secondary/70 p-6 md:p-7 grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
            <span className="h-12 w-12 rounded-xl bg-rk-surface text-rk-river-text flex items-center justify-center">
              <Radar className="w-6 h-6" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-xl font-extrabold text-rk-forest">{tr("Environmental monitoring", "পরিবেশ পর্যবেক্ষণ")}</h3>
              <p className="mt-1.5 text-[15px] text-rk-muted leading-relaxed max-w-3xl">
                {tr(
                  "Rain, river flow and radar-satellite flood observations are collected for every district each day. Missing data is shown as missing, never as safe.",
                  "প্রতিদিন প্রতিটি জেলার বৃষ্টি, নদীর প্রবাহ ও রাডার-স্যাটেলাইটের বন্যা পর্যবেক্ষণ সংগ্রহ করা হয়। তথ্য না থাকলে তা না থাকা হিসেবেই দেখানো হয়, কখনো নিরাপদ হিসেবে নয়।"
                )}
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* C — From environmental data to awareness (the real pipeline, in plain words) */}
      <section id="how" className="relative overflow-hidden text-white scroll-mt-20" style={{ backgroundImage: "var(--rk-grad-river)" }} aria-labelledby="how-title">
        <Contours className="text-white opacity-[0.07]" />
        <div className={`${wrap} relative py-16 md:py-24`}>
          <Reveal>
            <p className={`${eyebrow} text-rk-mist/90`}>{tr("How Rokkha works", "রক্ষা কীভাবে কাজ করে")}</p>
            <h2 id="how-title" className="mt-3 text-[28px] md:text-[40px] leading-[1.12] font-extrabold">
              {tr("From environmental data to awareness", "পরিবেশের তথ্য থেকে সচেতনতা")}
            </h2>
            <p className="mt-4 text-[17px] md:text-lg text-white/85 leading-relaxed max-w-2xl">
              {tr("Four steps run every day. Each one uses open, named data sources.", "প্রতিদিন চারটি ধাপ চলে। প্রতিটিতে প্রকাশ্য, নাম-উল্লেখ করা তথ্যসূত্র ব্যবহার হয়।")}
            </p>
          </Reveal>

          <ol className="mt-12 relative grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <svg aria-hidden="true" className="hidden lg:block absolute left-[6%] right-[6%] top-7 h-2 w-[88%]" preserveAspectRatio="none" viewBox="0 0 100 2">
              <line x1="0" y1="1" x2="100" y2="1" stroke="#DCEBE5" strokeOpacity=".5" strokeWidth="2" className="rk-flow" vectorEffect="non-scaling-stroke" />
            </svg>
            {[
              {
                icon: CloudRain,
                en: "Environmental information",
                bn: "পরিবেশের তথ্য",
                den: "Daily rain, river flow and satellite flood observations for each district.",
                dbn: "প্রতিটি জেলার দৈনিক বৃষ্টি, নদীর প্রবাহ ও স্যাটেলাইটে দেখা বন্যা।",
                tags: ["ERA5", "GFS", "GloFAS", "Sentinel-1"],
              },
              {
                icon: MapPin,
                en: "Geographic analysis",
                bn: "ভৌগোলিক বিশ্লেষণ",
                den: "Each district's distance to big rivers, its modelled flood hazard and how often it flooded before.",
                dbn: "প্রতিটি জেলার বড় নদী থেকে দূরত্ব, মডেলের বন্যা-ঝুঁকি ও আগে কতবার বন্যা হয়েছে।",
                tags: ["JRC hazard", "district level"],
              },
              {
                icon: BrainCircuit,
                en: "Forecast interpretation",
                bn: "পূর্বাভাস তৈরি",
                den: "A machine-learning model, trained on floods seen by satellite since 2016, estimates the chance of flooding.",
                dbn: "২০১৬ থেকে স্যাটেলাইটে দেখা বন্যা দিয়ে শেখানো একটি মেশিন-লার্নিং মডেল বন্যার সম্ভাবনা হিসাব করে।",
                tags: ["XGBoost", "daily"],
              },
              {
                icon: BellRing,
                en: "Risk awareness and alerts",
                bn: "ঝুঁকি জানানো ও সতর্কতা",
                den: "When the chance is high a district goes to Watch or Alert. A model estimate, not an official warning.",
                dbn: "সম্ভাবনা বেশি হলে জেলা নজরদারি বা সতর্কতা স্তরে যায়। এটি মডেলের অনুমান, সরকারি সতর্কবার্তা নয়।",
                tags: ["Watch", "Alert"],
              },
            ].map((step, i) => (
              <li key={step.en} className="relative">
                <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-rk-forest ring-1 ring-white/25 shadow-lg">
                  <step.icon className="w-6 h-6 text-rk-mist" aria-hidden="true" />
                </span>
                <Reveal delay={i * 110}>
                  <p className="mt-5 font-mono text-[13px] text-rk-mist/80">{num(`0${i + 1}`)}</p>
                  <h3 className="mt-1 text-xl font-extrabold">{tr(step.en, step.bn)}</h3>
                  <p className="mt-2 text-[15px] text-white/85 leading-relaxed">{tr(step.den, step.dbn)}</p>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {step.tags.map((t) => (
                      <li key={t} className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs text-rk-mist">{t}</li>
                    ))}
                  </ul>
                </Reveal>
              </li>
            ))}
          </ol>
          <Reveal>
            <p className="mt-12 text-[15px] text-white/85 max-w-3xl">
              {tr(
                "The model was checked on the 2023–2024 floods, which it never saw while learning. It can miss floods and give false alarms; it covers districts, not single villages.",
                "মডেলটি ২০২৩–২০২৪ সালের বন্যা দিয়ে যাচাই করা হয়েছে, যা শেখার সময় সে দেখেনি। এটি বন্যা মিস করতে পারে বা ভুল সতর্কতা দিতে পারে; এটি জেলা স্তরের, আলাদা গ্রামের নয়।"
              )}{" "}
              <button type="button" onClick={() => onAction({ kind: "view", view: "intelligence" })} className="font-bold text-white underline underline-offset-4 decoration-white/50 hover:decoration-white">
                {tr("Read about the model and its limits", "মডেল ও এর সীমাবদ্ধতা পড়ুন")}
              </button>
            </p>
          </Reveal>
        </div>
      </section>

      {/* D — Explore flood intelligence (real data preview + working routes) */}
      <section className={`${wrap} py-16 md:py-24`} aria-labelledby="explore-title">
        <Reveal>
          <p className={`${eyebrow} text-rk-clay-text`}>{tr("Explore", "দেখুন")}</p>
          <h2 id="explore-title" className={`mt-3 ${h2}`}>{tr("Explore flood intelligence", "বন্যা তথ্য দেখুন")}</h2>
        </Reveal>
        <div className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <Reveal className="h-full">
            <div className="h-full rounded-3xl border border-rk-line bg-rk-surface p-6 md:p-8" aria-live="polite">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xl md:text-2xl font-extrabold text-rk-forest">{tr("Districts to watch today", "আজ নজরে রাখার জেলা")}</h3>
                <span className="font-mono text-[13px] text-rk-muted">{dateLabel}</span>
              </div>
              <p className="mt-1 text-sm text-rk-muted">
                {tr("Model estimate, not an official warning. Official warnings: ", "মডেলের অনুমান, সরকারি সতর্কবার্তা নয়। সরকারি সতর্কবার্তা: ")}
                <a href="https://www.ffwc.gov.bd/" target="_blank" rel="noopener noreferrer" className="font-semibold text-rk-brand-strong underline underline-offset-2">ffwc.gov.bd</a>
              </p>
              <div className="mt-5 space-y-3">
                {forecastState === "loading" && <p className="text-rk-muted">{tr("Getting the forecast…", "পূর্বাভাস আনা হচ্ছে…")}</p>}
                {forecastState === "unavailable" && (
                  <Notice tone="warning" title={tr("Forecast currently unavailable", "পূর্বাভাস এখন পাওয়া যাচ্ছে না")}>
                    {tr("Please try again later. You can still request assistance.", "পরে আবার চেষ্টা করুন। আপনি তবুও সহায়তা চাইতে পারেন।")}
                  </Notice>
                )}
                {forecastState === "none" && (
                  <Notice tone="neutral" title={tr("No forecast for this day yet", "এই দিনের পূর্বাভাস এখনো নেই")}>
                    {tr("The daily forecast is usually ready in the morning, Bangladesh time.", "দৈনিক পূর্বাভাস সাধারণত সকালে (বাংলাদেশ সময়) তৈরি হয়।")}
                  </Notice>
                )}
                {forecastState === "ready" && (
                  <>
                    {onAlert.length > 0 && (
                      <Notice tone="danger" title={tr(`Alert in ${onAlert.length} district${onAlert.length === 1 ? "" : "s"}`, `${num(onAlert.length)}টি জেলায় সতর্কতা`)}>
                        {onAlert.slice(0, 6).map(districtName).join(", ")}{onAlert.length > 6 ? "…" : ""}
                      </Notice>
                    )}
                    {onWatch.length > 0 && (
                      <Notice tone="warning" title={tr(`Watch in ${onWatch.length} district${onWatch.length === 1 ? "" : "s"}`, `${num(onWatch.length)}টি জেলায় নজরদারি`)}>
                        {onWatch.slice(0, 6).map(districtName).join(", ")}{onWatch.length > 6 ? "…" : ""}
                      </Notice>
                    )}
                    {alerts.length === 0 && (
                      <Notice tone="neutral" title={tr("No district on Watch or Alert", "কোনো জেলা নজরদারি বা সতর্কতা স্তরে নেই")}>
                        {tr("A low chance is not zero. Keep following local news.", "কম সম্ভাবনা মানে শূন্য নয়। স্থানীয় খবর দেখতে থাকুন।")}
                      </Notice>
                    )}
                    {issued && <p className="font-mono text-[13px] text-rk-muted">{tr("Issued", "তৈরি")} {issued} {tr("(Bangladesh time)", "(বাংলাদেশ সময়)")}</p>}
                  </>
                )}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button type="button" onClick={() => go("alerts")} className="h-11 px-4 rounded-xl bg-rk-brand hover:bg-rk-brand-strong text-white font-bold inline-flex items-center gap-2">
                  {tr("All current warnings", "সব বর্তমান সতর্কতা")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </Reveal>

          <div className="grid gap-3 content-start">
            {[
              { icon: MapIcon, en: "Forecast map", bn: "পূর্বাভাসের মানচিত্র", den: "Every district coloured by today's forecast level.", dbn: "আজকের পূর্বাভাস অনুযায়ী প্রতিটি জেলার রঙ।", run: () => go("map") },
              { icon: MapPin, en: "Check a place", bn: "একটি জায়গা যাচাই", den: "Use your location or tap the map for that exact spot.", dbn: "আপনার অবস্থান দিন বা মানচিত্রে চাপ দিন।", run: () => onAction({ kind: "check" }) },
              { icon: House, en: "Nearby shelters", bn: "কাছের আশ্রয়কেন্দ্র", den: "Registered shelters, schools and clinics near you.", dbn: "আপনার কাছের নিবন্ধিত আশ্রয়কেন্দ্র, স্কুল ও ক্লিনিক।", run: () => go("shelters") },
            ].map((l, i) => (
              <Reveal key={l.en} delay={i * 70}>
                <button type="button" onClick={l.run} className="rk-lift group w-full rounded-2xl border border-rk-line bg-rk-surface p-4 md:p-5 text-left flex items-center gap-4">
                  <span className="h-11 w-11 shrink-0 rounded-xl bg-rk-brand-soft text-rk-brand-strong flex items-center justify-center">
                    <l.icon className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-[17px] font-bold text-rk-forest">{tr(l.en, l.bn)}</span>
                    <span className="block text-sm text-rk-muted">{tr(l.den, l.dbn)}</span>
                  </span>
                  <ArrowRight className="w-5 h-5 text-rk-brand-strong group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                </button>
              </Reveal>
            ))}

            {/* Safety guidance (the navigation links here: #safety-title) */}
            <Reveal delay={220}>
              <div className="rounded-2xl border border-rk-line bg-rk-surface p-4 md:p-5">
                <h3 id="safety-title" className="text-[17px] font-bold text-rk-forest flex items-center gap-2 scroll-mt-28">
                  <ShieldCheck className="w-5 h-5 text-rk-brand" aria-hidden="true" />
                  {tr("Flood safety guidance", "বন্যায় নিরাপত্তা")}
                </h3>
                <ul className="mt-3 space-y-2 text-[15px] text-rk-ink leading-relaxed list-disc pl-5 marker:text-rk-brand">
                  <li>{tr("Keep a bag ready: papers in plastic, medicine, torch, charger, dry food.", "একটি ব্যাগ তৈরি রাখুন: প্লাস্টিকে কাগজপত্র, ওষুধ, টর্চ, চার্জার, শুকনো খাবার।")}</li>
                  <li>{tr("Do not walk, swim or drive through moving water.", "স্রোতের পানিতে হাঁটবেন না, সাঁতার কাটবেন না বা গাড়ি চালাবেন না।")}</li>
                  <li>{tr("After the flood, drink only boiled or treated water.", "বন্যার পর শুধু ফোটানো বা বিশুদ্ধ পানি পান করুন।")}</li>
                </ul>
                {safetyOpen && (
                  <ul id="rk-safety-more" className="mt-2 space-y-2 text-[15px] text-rk-ink leading-relaxed list-disc pl-5 marker:text-rk-brand">
                    <li>{tr("Store clean drinking water in covered containers.", "ঢাকনা দেওয়া পাত্রে নিরাপদ খাবার পানি রাখুন।")}</li>
                    <li>{tr("Move valuables, food and animal feed up high.", "মূল্যবান জিনিস, খাবার ও পশুখাদ্য উঁচুতে রাখুন।")}</li>
                    <li>{tr("Switch off electricity at the main switch if water comes in.", "পানি ঢুকলে মেইন সুইচে বিদ্যুৎ বন্ধ করুন।")}</li>
                    <li>{tr("Keep children and elderly people close and away from the water.", "শিশু ও বয়স্কদের কাছে রাখুন, পানি থেকে দূরে রাখুন।")}</li>
                    <li>{tr("Check walls and roof before going back inside; beware of snakes and broken wires.", "ঘরে ফেরার আগে দেয়াল ও ছাদ দেখে নিন; সাপ ও ছেঁড়া তার থেকে সাবধান।")}</li>
                  </ul>
                )}
                <button
                  type="button"
                  aria-expanded={safetyOpen}
                  aria-controls="rk-safety-more"
                  onClick={() => setSafetyOpen((v) => !v)}
                  className="mt-2 h-11 font-bold text-rk-brand-strong inline-flex items-center gap-1"
                >
                  {safetyOpen ? tr("Show less", "কম দেখুন") : tr("More safety advice", "আরও নিরাপত্তা পরামর্শ")}
                  <ChevronDown className={`w-4 h-4 transition-transform ${safetyOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* E — Preparedness and assistance (secondary, still clear) */}
      <section className="bg-rk-secondary border-y border-rk-line" aria-labelledby="assist-title">
        <div className={`${wrap} py-14 md:py-20 grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-start`}>
          <Reveal>
            <p className={`${eyebrow} text-rk-clay-text`}>{tr("When flooding affects you", "বন্যায় ক্ষতিগ্রস্ত হলে")}</p>
            <h2 id="assist-title" className="mt-3 text-[26px] md:text-[34px] leading-[1.15] font-extrabold text-rk-forest">
              {tr("Preparedness and assistance", "প্রস্তুতি ও সহায়তা")}
            </h2>
            <p className="mt-3 text-[17px] text-rk-ink leading-relaxed max-w-xl">
              {tr(
                "If you are affected by flooding you can ask for help without an account. Choose what you need:",
                "বন্যায় ক্ষতিগ্রস্ত হলে অ্যাকাউন্ট ছাড়াই সাহায্য চাইতে পারেন। কী দরকার বেছে নিন:"
              )}
            </p>
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {[
                { icon: Sailboat, en: "Rescue and evacuation", bn: "উদ্ধার ও সরিয়ে নেওয়া", needs: ["evacuation"] as const },
                { icon: Droplets, en: "Food and drinking water", bn: "খাবার ও খাবার পানি", needs: ["food_water"] as const },
                { icon: HeartPulse, en: "Medical assistance", bn: "চিকিৎসা সহায়তা", needs: ["medical"] as const },
                { icon: House, en: "Shelter and housing safety", bn: "আশ্রয় ও ঘরের নিরাপত্তা", needs: ["house_danger"] as const },
              ].map((n) => (
                <li key={n.en}>
                  <button
                    type="button"
                    onClick={() => onAction({ kind: "help", needs: [...n.needs] })}
                    className="w-full min-h-[52px] rounded-xl border border-rk-line bg-rk-surface px-4 py-3 text-left flex items-center gap-3 font-semibold text-rk-forest hover:border-rk-brand hover:bg-rk-brand-soft transition-colors"
                  >
                    <n.icon className="w-5 h-5 text-rk-brand shrink-0" aria-hidden="true" />
                    {tr(n.en, n.bn)}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px]">
              <button type="button" onClick={() => onAction({ kind: "track" })} className="min-h-11 font-bold text-rk-brand-strong inline-flex items-center gap-1.5">
                {tr("Track my request", "আমার অনুরোধের খবর")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => go("contacts")} className="min-h-11 font-bold text-rk-brand-strong inline-flex items-center gap-1.5">
                <Phone className="w-4 h-4" aria-hidden="true" /> {tr("Verified rescue and relief numbers", "যাচাই করা উদ্ধার ও ত্রাণ নম্বর")}
              </button>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-3xl border border-rk-line bg-rk-surface p-6 md:p-8">
              <span className="h-12 w-12 rounded-xl bg-rk-mist text-rk-forest flex items-center justify-center">
                <Users className="w-6 h-6" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-xl md:text-2xl font-extrabold text-rk-forest">{tr("For rescue and relief teams", "উদ্ধার ও ত্রাণ দলের জন্য")}</h3>
              <p className="mt-2 text-[15px] text-rk-muted leading-relaxed">
                {tr(
                  "Authorised organisations share one board of requests. One team accepts a request, confirms when it sets off and updates progress, so others can see it is handled and two teams do not go to the same home.",
                  "অনুমোদিত সংস্থাগুলো একটি যৌথ অনুরোধ-বোর্ড ব্যবহার করে। একটি দল অনুরোধ গ্রহণ করে, রওনা দিলে নিশ্চিত করে ও অগ্রগতি জানায়, ফলে অন্যরা দেখে কাজটি চলছে এবং এক বাড়িতে দুই দল যায় না।"
                )}
              </p>
              <button
                type="button"
                onClick={() => go(isStaff ? "rescue" : "login")}
                className="mt-6 h-12 px-5 rounded-xl border border-rk-forest/25 text-rk-forest font-bold inline-flex items-center gap-2 hover:bg-rk-secondary"
              >
                {isStaff ? tr("Open the rescue board", "উদ্ধার বোর্ড খুলুন") : tr("Rescue team login", "উদ্ধারকারী দলের লগ ইন")}
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* F — Closing call to action */}
      <section className={`${wrap} py-14 md:py-20`}>
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] text-white px-7 py-12 md:px-14 md:py-16" style={{ backgroundImage: "var(--rk-grad-forest)" }}>
            <Contours className="text-white opacity-[0.09]" />
            <Waves className="absolute -right-6 -bottom-8 w-56 h-56 text-white/[0.06]" aria-hidden="true" />
            <div className="relative max-w-2xl">
              <h2 className="text-[28px] md:text-[40px] leading-[1.12] font-extrabold">
                {tr("Better awareness today can help communities prepare for tomorrow.", "আজকের সচেতনতা আগামীকালের প্রস্তুতিতে সাহায্য করে।")}
              </h2>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <button type="button" onClick={() => go("map")} className="min-h-[52px] px-6 rounded-xl bg-rk-page text-rk-forest hover:bg-white text-[17px] font-bold inline-flex items-center justify-center gap-2">
                  <MapIcon className="w-5 h-5 text-rk-brand" aria-hidden="true" />
                  {tr("Explore flood intelligence", "বন্যা তথ্য দেখুন")}
                </button>
                <button type="button" onClick={() => onAction({ kind: "help" })} className="min-h-[52px] px-6 rounded-xl border border-white/60 text-white hover:bg-white/10 text-[17px] font-bold inline-flex items-center justify-center gap-2">
                  <LifeBuoy className="w-5 h-5" aria-hidden="true" />
                  {tr("Request assistance", "সাহায্য চান")}
                </button>
              </div>
              <a href="https://www.ffwc.gov.bd/" target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-[15px] text-white/85 hover:text-white underline underline-offset-4 decoration-white/40">
                {tr("Official flood warnings: Flood Forecasting and Warning Centre", "সরকারি বন্যা সতর্কবার্তা: বন্যা পূর্বাভাস ও সতর্কীকরণ কেন্দ্র")}
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
};
