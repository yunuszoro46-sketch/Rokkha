"use client";

import React from "react";
import { ArrowRight, MapPin } from "lucide-react";
import type { Language } from "../../lib/translations";
import { toBnNum } from "../../lib/translations";
import type { AlertItem } from "../../types/api";

interface HeroMapProps {
  lang: Language;
  alerts?: AlertItem[];
  onExplore?: () => void;
}

export const HeroIntelligenceMap: React.FC<HeroMapProps> = ({ lang, alerts = [], onExplore }) => {
  const isBn = lang === "bn";
  const tr = (en: string, bn: string) => (isBn ? bn : en);
  const num = (v: string | number) => (isBn ? toBnNum(v) : String(v));

  const alertCount = alerts.filter((a) => a.level === "alert").length || 7;
  const watchCount = alerts.filter((a) => a.level === "watch").length || 10;
  const outsideCount = 8;
  const lowCount = Math.max(0, 64 - alertCount - watchCount - outsideCount) || 39;

  return (
    <div
      onClick={onExplore}
      className="group relative cursor-pointer overflow-hidden rounded-3xl border border-rk-line bg-[#FAF7F2] shadow-xl transition-all duration-300 hover:shadow-2xl"
    >


      {/* ── Completely Unobstructed, Fully Visible Map ── */}
      <div className="relative aspect-[4/4.2] sm:aspect-[4/4] w-full overflow-hidden bg-[#EFECE6]">
        <img
          src="/bangladesh-flood-map.jpg"
          alt={tr("Bangladesh Flood Risk Map", "বাংলাদেশের বন্যা ঝুঁকি মানচিত্র")}
          className="h-full w-full object-contain object-center transition-transform duration-700 ease-out group-hover:scale-[1.02]"
        />

        {/* Floating Bottom Pill for Quick CTA */}
        <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-10 flex items-center gap-1.5 rounded-xl bg-rk-forest/90 backdrop-blur-md px-3.5 py-2 text-xs sm:text-[13px] font-bold text-white shadow-lg group-hover:bg-rk-brand transition-colors">
          <MapPin className="h-3.5 w-3.5 text-rk-mist" />
          <span>{tr("Click to Open Interactive Map", "ইন্টারঅ্যাক্টিভ মানচিত্র খুলুন")}</span>
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>

      </div>
      {/* ── Organized Status Header Bar (No longer obscuring the map) ── */}
      <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[#E3DDD2] bg-[#FAF7F2]">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-[15px] sm:text-[16px] font-extrabold text-[#173D32] tracking-tight">
              {tr("Across Bangladesh's 64 Districts", "বাংলাদেশের ৬৪ জেলায়")}
            </h3>
          </div>
          <span className="font-mono text-[11px] font-bold text-rk-brand bg-rk-brand-soft px-2.5 py-0.5 rounded-full border border-rk-brand/20">
            {tr("Nationwide Status", "সারাদেশের অবস্থা")}
          </span>
        </div>


        {/* 4 Status Pills in a Single Horizontal Row */}
        <div className="grid grid-cols-4 gap-2 w-full">

          {/* 1. Alert */}
          <div className="flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-[#E3DDD2] bg-white px-1.5 py-2 sm:px-3 shadow-2xs hover:border-[#9C3024]/40 transition-colors">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[#9C3024] shrink-0" aria-hidden="true" />
            <span className="text-[10px] sm:text-[12.5px] font-bold text-[#173D32] truncate">
              {tr(`${num(alertCount)} Alert`, `${num(alertCount)} সতর্কতা`)}
              <span className="hidden md:inline text-rk-muted font-normal"> — {tr("Evacuate", "সরে যান")}</span>
            </span>
          </div>

          {/* 2. Watch */}
          <div className="flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-[#E3DDD2] bg-white px-1.5 py-2 sm:px-3 shadow-2xs hover:border-[#D68C27]/40 transition-colors">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[#D68C27] shrink-0" aria-hidden="true" />
            <span className="text-[10px] sm:text-[12.5px] font-bold text-[#173D32] truncate">
              {tr(`${num(watchCount)} Watch`, `${num(watchCount)} নজরদারি`)}
              <span className="hidden md:inline text-rk-muted font-normal"> — {tr("Prepare", "প্রস্তুতি")}</span>
            </span>
          </div>

          {/* 3. Low Risk */}
          <div className="flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-[#E3DDD2] bg-white px-1.5 py-2 sm:px-3 shadow-2xs hover:border-[#BCCBC1] transition-colors">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[#BCCBC1] shrink-0" aria-hidden="true" />
            <span className="text-[10px] sm:text-[12.5px] font-bold text-[#173D32] truncate">
              {tr(`${num(lowCount)} Low Risk`, `${num(lowCount)} কম ঝুঁকি`)}
              <span className="hidden md:inline text-rk-muted font-normal"> — {tr("Not Zero", "শূন্য নয়")}</span>
            </span>
          </div>

          {/* 4. Outside Coverage */}
          <div className="flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-[#E3DDD2] bg-white px-1.5 py-2 sm:px-3 shadow-2xs hover:border-[#57645B]/40 transition-colors">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-dashed border-[#57645B] bg-[#D7DCD8] shrink-0" aria-hidden="true" />
            <span className="text-[10px] sm:text-[12.5px] font-bold text-[#173D32] truncate">
              {tr(`${num(outsideCount)} Excluded`, `${num(outsideCount)} আওতামুক্ত`)}
            </span>
          </div>

        </div>

      </div>
    </div>
  );
};

export default HeroIntelligenceMap;
