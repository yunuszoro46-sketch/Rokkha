"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Language } from "../../lib/translations";

// Homepage hero visual: an ILLUSTRATION of how Rokkha reads changing flood conditions
// (terrain -> rain -> river network -> risk overlay -> forecast time -> places to watch).
// The country outline is real (district boundaries, BBS/OCHA); the rivers are traced
// approximately; the rain, overlay and timeline are illustrative and show no data.
// It is labelled as such on screen. Real forecast numbers live in <TodayForecastStrip>.

const OUTLINE = "M144.7 161.1 L154.3 148.1 L152.8 142.9 L158.2 141.2 L164.8 146.9 L165.3 142.6 L168.7 142.1 L171.8 136.4 L171.5 124.4 L201.4 126.8 L206.7 119.6 L196.4 113.9 L194.1 103.2 L187.6 106.6 L177.7 104.1 L171.8 98.1 L172.2 93.7 L160.7 83.7 L153.3 86.0 L150.5 82.4 L149.6 76.4 L154.8 69.0 L155.3 60.8 L165.8 55.8 L172.6 45.3 L176.0 45.8 L173.6 39.5 L164.8 38.2 L169.7 27.8 L171.2 33.8 L182.8 38.9 L196.5 54.9 L201.5 51.0 L200.4 43.2 L203.7 39.8 L211.7 43.9 L215.9 61.1 L228.4 70.2 L232.6 67.6 L242.2 72.0 L245.7 66.0 L243.0 60.1 L248.4 54.7 L261.3 74.5 L257.2 83.0 L261.0 96.1 L257.1 112.7 L258.8 118.8 L266.3 117.9 L295.6 128.7 L309.5 125.1 L321.0 127.7 L346.9 124.6 L360.0 129.3 L368.2 126.6 L369.9 130.2 L377.2 126.5 L396.2 125.9 L418.7 136.6 L422.9 147.0 L417.1 148.7 L407.2 145.1 L410.7 156.4 L406.6 172.4 L402.4 170.7 L399.9 180.3 L387.7 183.5 L386.5 196.8 L377.4 190.2 L377.4 196.7 L371.6 193.0 L366.7 201.4 L353.9 199.2 L353.9 208.0 L347.3 208.6 L344.4 223.2 L339.6 225.8 L343.2 227.5 L340.4 233.0 L350.1 249.7 L351.9 267.2 L355.7 269.7 L355.8 254.8 L361.8 261.6 L364.9 275.4 L368.7 276.7 L380.8 268.9 L376.4 253.3 L379.3 247.1 L390.2 242.1 L389.7 224.3 L396.2 230.3 L402.4 223.9 L405.7 229.6 L407.3 225.3 L410.3 226.5 L417.2 257.8 L414.3 258.7 L415.6 278.2 L420.1 281.1 L425.1 296.7 L431.6 350.2 L430.1 369.9 L434.5 389.9 L429.3 392.9 L427.1 383.8 L419.6 384.8 L415.9 377.1 L404.7 387.2 L406.0 393.7 L403.1 398.1 L408.4 404.2 L415.2 428.6 L395.7 398.2 L390.4 376.4 L385.8 377.4 L382.5 373.4 L382.8 348.6 L386.5 346.7 L376.4 314.6 L370.3 314.2 L357.6 294.5 L347.5 298.3 L352.2 303.9 L350.7 307.8 L342.0 307.8 L343.2 323.5 L333.4 335.9 L335.1 340.3 L321.5 338.9 L321.5 352.7 L305.2 352.3 L304.7 349.2 L297.8 355.4 L277.4 355.5 L269.4 351.2 L270.6 343.9 L268.1 342.9 L261.9 344.6 L262.6 356.6 L252.9 353.1 L249.5 359.1 L244.8 359.8 L245.8 364.6 L214.7 365.7 L208.1 356.4 L211.0 332.3 L205.4 319.7 L206.0 310.0 L201.2 303.4 L203.7 294.7 L200.7 290.4 L204.2 284.6 L196.7 273.4 L205.2 260.1 L188.8 256.8 L187.4 253.5 L193.6 240.7 L190.2 241.5 L178.9 230.0 L179.9 215.6 L190.1 210.5 L187.3 198.8 L190.4 196.3 L189.8 187.2 L165.2 180.6 L144.7 161.1ZM354.1 311.8 L357.6 299.9 L366.2 312.9 L362.3 315.6 L354.1 311.8Z";
const RIVERS: { id: string; d: string; w: number }[] = [
  { id: "jamuna", d: "M246.6 67.4 C246.9 70.2 248.7 76.5 248.4 84.4 C248.1 92.3 244.3 104.1 244.7 114.8 C245.1 125.5 249.9 138.5 250.9 148.7 C251.9 158.9 250.3 166.8 250.9 175.8 C251.5 184.8 254.1 195.3 254.6 202.9 C255.1 210.5 254.1 218.1 254.0 221.2", w: 3.2 },
  { id: "padma", d: "M172.1 181.2 C176.2 183.1 188.7 188.5 197.0 192.7 C205.3 196.9 212.3 201.6 221.8 206.3 C231.3 211.1 244.2 216.1 254.0 221.2 C263.8 226.3 272.1 230.8 280.7 236.8 C289.3 242.8 301.4 253.7 305.5 257.1", w: 3.2 },
  { id: "meghna", d: "M361.3 148.7 C357.7 153.2 345.0 166.8 339.6 175.8 C334.2 184.8 333.8 193.3 329.1 202.9 C324.5 212.5 315.6 224.4 311.7 233.4 C307.8 242.4 306.0 248.6 305.5 257.1 C305.0 265.6 306.5 274.6 308.6 284.2 C310.7 293.8 314.8 305.7 317.9 314.7 C321.0 323.7 325.6 334.4 327.2 338.4", w: 3.4 },
  { id: "surma", d: "M407.9 138.5 C404.0 139.4 393.1 144.8 384.3 144.0 C375.5 143.2 364.1 133.0 355.1 133.8 C346.1 134.6 335.0 141.7 330.3 148.7 C325.6 155.7 327.4 166.8 327.2 175.8 C327.0 184.8 328.8 198.4 329.1 202.9", w: 2.2 },
  { id: "teesta", d: "M203.2 50.5 C206.8 53.9 218.7 64.6 224.9 70.8 C231.1 77.0 236.7 83.2 240.4 87.7 C244.1 92.2 246.1 96.2 247.2 97.9", w: 1.8 },
  { id: "brahmaputra_old", d: "M252.8 125.0 C256.9 128.4 270.9 140.2 277.6 145.3 C284.3 150.4 286.9 149.8 293.1 155.5 C299.3 161.2 308.8 171.3 314.8 179.2 C320.8 187.1 326.7 198.9 329.1 202.9", w: 1.6 },
];
// Approximate places on the outline (projected from their latitude/longitude).
const PLACES = {
  haor: { x: 355, y: 134 },     // Sunamganj haor basin
  jamuna: { x: 250, y: 176 },   // Jamuna near Sirajganj
  north: { x: 247, y: 84 },     // Brahmaputra entering near Kurigram
};

type Phase = 0 | 1 | 2;

export const HeroIntelligenceMap: React.FC<{ lang: Language }> = ({ lang }) => {
  const isBn = lang === "bn";
  const tr = (en: string, bn: string) => (isBn ? bn : en);
  const [phase, setPhase] = useState<Phase>(0);
  const [auto, setAuto] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  // Steps through the illustrative timeline; never under reduced motion, stops once the visitor picks a step.
  useEffect(() => {
    if (!auto) return;
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: number | undefined;
    const start = window.setTimeout(() => {
      timer = window.setInterval(() => setPhase((p) => ((p + 1) % 3) as Phase), 3200);
    }, 3600);
    return () => {
      window.clearTimeout(start);
      if (timer) window.clearInterval(timer);
    };
  }, [auto]);

  const steps: { label: string; note: string }[] = [
    { label: tr("Now", "এখন"), note: tr("Rain arriving over the hills", "পাহাড়ে বৃষ্টি আসছে") },
    { label: tr("+6 h", "+৬ ঘ."), note: tr("Rivers start to rise", "নদীর পানি বাড়তে শুরু করে") },
    { label: tr("+24 h", "+২৪ ঘ."), note: tr("Low land downstream may flood", "ভাটির নিচু জমি প্লাবিত হতে পারে") },
  ];

  // Contour lines: gentle waves across the land, clipped to the country.
  const contours = Array.from({ length: 13 }, (_, i) => {
    const y = 40 + i * 32;
    const a = 7 + (i % 4) * 2;
    return `M-20 ${y} C 80 ${y - a} 150 ${y + a} 250 ${y} S 420 ${y - a} 580 ${y + a / 2}`;
  });

  return (
    <div ref={rootRef} className="rk-hero-map relative w-full" data-phase={phase}>
      <div className="relative overflow-hidden rounded-[28px] bg-rk-forest shadow-[var(--rk-shadow-float)]">
        <svg viewBox="0 0 560 460" className="block w-full h-auto" role="img" aria-labelledby="rk-hero-map-title rk-hero-map-desc">
          <title id="rk-hero-map-title">{tr("Illustration: how Rokkha reads a flood", "চিত্র: রক্ষা কীভাবে বন্যা বোঝে")}</title>
          <desc id="rk-hero-map-desc">
            {tr(
              "A drawing of Bangladesh with its main rivers. Rain moves in from the north-east, a shaded area grows along the rivers over 24 hours and a few places are marked to watch. It is an illustration, not a forecast.",
              "প্রধান নদীসহ বাংলাদেশের একটি ছবি। উত্তর-পূর্ব দিক থেকে বৃষ্টি আসে, ২৪ ঘণ্টায় নদীর পাশে ছায়াঘেরা এলাকা বাড়ে এবং কয়েকটি জায়গা চিহ্নিত হয়। এটি একটি চিত্র, পূর্বাভাস নয়।"
            )}
          </desc>
          <defs>
            <linearGradient id="rk-hm-bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#173D32" />
              <stop offset="0.6" stopColor="#315D50" />
              <stop offset="1" stopColor="#4F8C8E" />
            </linearGradient>
            <radialGradient id="rk-hm-risk" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#B3392D" stopOpacity="0.85" />
              <stop offset="0.45" stopColor="#D9822B" stopOpacity="0.55" />
              <stop offset="1" stopColor="#E9B949" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="rk-hm-watch" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#E9B949" stopOpacity="0.7" />
              <stop offset="1" stopColor="#E9B949" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="rk-hm-rain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#DCEBE5" stopOpacity="0" />
              <stop offset="1" stopColor="#DCEBE5" stopOpacity="0.9" />
            </linearGradient>
            <clipPath id="rk-hm-land">
              <path d={OUTLINE} />
            </clipPath>
          </defs>

          <rect width="560" height="460" fill="url(#rk-hm-bg)" />
          {/* graticule */}
          <g className="rk-hm-terrain" stroke="#DCEBE5" strokeOpacity="0.07" strokeWidth="1">
            {[80, 160, 240, 320, 400, 480].map((x) => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="460" />)}
            {[80, 160, 240, 320, 400].map((y) => <line key={`h${y}`} x1="0" y1={y} x2="560" y2={y} />)}
          </g>

          {/* Phase 1: terrain */}
          <g className="rk-hm-terrain">
            <path d={OUTLINE} fill="#DCEBE5" fillOpacity="0.09" stroke="#DCEBE5" strokeOpacity="0.55" strokeWidth="1.4" strokeLinejoin="round" />
            <g clipPath="url(#rk-hm-land)" fill="none" stroke="#C9DDB8" strokeOpacity="0.16" strokeWidth="1">
              {contours.map((d, i) => <path key={i} d={d} />)}
            </g>
          </g>

          {/* Phase 3: illustrative risk overlay along the rivers (grows with the timeline) */}
          <g clipPath="url(#rk-hm-land)" className="rk-hm-overlay">
            <ellipse className="rk-hm-blob rk-hm-b1" cx={PLACES.haor.x - 8} cy={PLACES.haor.y + 6} rx="58" ry="40" fill="url(#rk-hm-risk)" />
            <ellipse className="rk-hm-blob rk-hm-b2" cx={PLACES.jamuna.x + 6} cy={PLACES.jamuna.y - 30} rx="34" ry="78" fill="url(#rk-hm-watch)" />
            <ellipse className="rk-hm-blob rk-hm-b3" cx={PLACES.north.x + 4} cy={PLACES.north.y + 10} rx="30" ry="36" fill="url(#rk-hm-watch)" />
          </g>

          {/* Rivers */}
          <g fill="none" stroke="#8FC3CC" strokeLinecap="round" strokeLinejoin="round">
            {RIVERS.map((r, i) => (
              <path key={r.id} d={r.d} strokeWidth={r.w} pathLength={1} className="rk-hm-river" style={{ animationDelay: `${600 + i * 180}ms` }} />
            ))}
          </g>

          {/* Phase 2: rain moving in from the north-east */}
          <g className="rk-hm-rainband">
            <ellipse cx="420" cy="88" rx="110" ry="54" fill="#DCEBE5" fillOpacity="0.10" />
            <g className="rk-hm-drops" stroke="url(#rk-hm-rain)" strokeWidth="1.4" strokeLinecap="round">
              {Array.from({ length: 26 }, (_, i) => {
                const x = 330 + ((i * 37) % 190);
                const y = 40 + ((i * 53) % 110);
                return <line key={i} x1={x} y1={y} x2={x - 5} y2={y + 14} />;
              })}
            </g>
          </g>

          {/* Phase 5: places to watch (no values) */}
          <g className="rk-hm-markers">
            {[PLACES.haor, PLACES.jamuna, PLACES.north].map((p, i) => (
              <g key={i} transform={`translate(${p.x} ${p.y})`}>
                {i === 0 && <circle r="15" fill="none" stroke="#E9B949" strokeWidth="1.5" className="rk-hm-halo" />}
                <circle r="6" fill={i === 0 ? "#E9B949" : "#F4F0E6"} stroke="#173D32" strokeWidth="2" />
              </g>
            ))}
          </g>

          {/* Restrained labels, words only */}
          <g className="rk-hm-labels max-sm:hidden" fontFamily="var(--font-plex-mono), monospace" fontSize="11" fill="#DCEBE5">
            <text x="452" y="160" textAnchor="middle" letterSpacing={isBn ? 0 : 1.5}>{tr("RAINFALL", "বৃষ্টি")}</text>
            <text x="150" y="250" letterSpacing={isBn ? 0 : 1.5}>{tr("RIVER NETWORK", "নদীপথ")}</text>
            <g transform={`translate(${PLACES.haor.x + 20} ${PLACES.haor.y + 30})`}>
              <rect x="0" y="-13" width={isBn ? 104 : 112} height="20" rx="10" fill="#173D32" fillOpacity="0.85" stroke="#E9B949" strokeOpacity="0.8" />
              <text x="10" y="1" letterSpacing={isBn ? 0 : 1}>{tr("AREA TO WATCH", "নজরে রাখুন")}</text>
            </g>
          </g>
        </svg>

        {/* Honest label */}
        <p className="absolute left-3 top-3 sm:left-4 sm:top-4 rounded-full bg-rk-forest/80 backdrop-blur px-3 py-1 font-mono text-[11px] sm:text-xs tracking-wider text-rk-mist">
          {tr("ILLUSTRATION · NOT A LIVE FORECAST", "চিত্র · সরাসরি পূর্বাভাস নয়")}
        </p>

        {/* Illustrative forecast timeline (under the map so it never hides the coast) */}
        <div className="relative border-t border-white/10 bg-rk-forest px-3 py-3 sm:px-4 text-rk-mist">
          <div className="flex items-center gap-1.5" role="group" aria-label={tr("Illustrative forecast time", "চিত্রের সময়")}>
            {steps.map((s, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={phase === i}
                onClick={() => {
                  setAuto(false);
                  setPhase(i as Phase);
                }}
                className={`flex-1 min-h-9 rounded-lg font-mono text-xs sm:text-[13px] font-semibold transition-colors ${
                  phase === i ? "bg-rk-mist text-rk-forest" : "text-rk-mist hover:bg-white/10"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="mt-2 h-1 rounded-full bg-white/15 overflow-hidden" aria-hidden="true">
            <div className="h-full rounded-full bg-rk-warning-accent transition-[width] duration-700 ease-out" style={{ width: `${((phase + 1) / 3) * 100}%` }} />
          </div>
          <p className="mt-1.5 text-[13px] leading-snug" aria-live="polite">{steps[phase].note}</p>
        </div>
      </div>
    </div>
  );
};
