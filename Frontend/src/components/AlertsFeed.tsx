"use client";

import React, { useState } from "react";
import { AlertItem } from "../types/api";
import { formatProbability } from "../lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import {
  Info,
  ChevronDown,
  ChevronUp,
  Landmark,
  Users,
  CheckCircle2,
} from "lucide-react";
import {
  Language,
  UI_TEXT,
  DISTRICTS_BN,
  toBnNum,
} from "../lib/translations";

interface AlertsFeedProps {
  alerts: AlertItem[];
  targetDate: string;
  isLoading: boolean;
  /** false = no forecast exists for this day (different from "no alerts"). */
  hasForecast?: boolean;
  lang?: Language;
  onSelectDistrict: (pcode: string, name: string) => void;
}

export const AlertsFeed: React.FC<AlertsFeedProps> = ({
  alerts,
  targetDate,
  isLoading,
  hasForecast = true,
  lang = "en",
  onSelectDistrict,
}) => {
  const t = UI_TEXT[lang] || UI_TEXT.en;
  const isBn = lang === "bn";
  const displayDate = isBn ? toBnNum(targetDate) : targetDate;
  const [isAdvisoryOpen, setIsAdvisoryOpen] = useState(true);

  return (
    <Card className="border-[#DFDDD3] bg-white rounded-3xl shadow-sm overflow-hidden">
      {/* Container Header */}
      <CardHeader className="px-6 sm:px-8 py-6 border-b border-[#EBE8DC] flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-2xl sm:text-3xl font-extrabold text-[#12241C] tracking-tight">
            {lang === "bn"
              ? `জেলা বন্যা সতর্কতা (${toBnNum(alerts.length)})`
              : `District Flood Early Warnings (${alerts.length})`}
          </CardTitle>
        </div>
        <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5] uppercase tracking-wide">
          {alerts.length > 0
            ? lang === "bn" ? "পদক্ষেপ প্রয়োজন" : "Action Required"
            : !hasForecast
            ? lang === "bn" ? "পূর্বাভাস নেই" : "No forecast"
            : lang === "bn" ? "কোন সতর্কতা নেই" : "No alerts"}
        </span>
      </CardHeader>

      <CardContent className="p-6 sm:p-8 space-y-6">
        {/* Public Advisory Box (Collapsible with perfect padding & spacing) */}
        <div className="rounded-2xl border border-[#DFDDD3] bg-[#FAF9F5] p-5 transition-all">
          <div
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setIsAdvisoryOpen(!isAdvisoryOpen)}
          >
            <div className="flex items-center gap-2.5 text-sm font-bold text-[#1E3A2F]">
              <span className="w-5 h-5 rounded-full bg-[#E5EDE7] flex items-center justify-center text-[#1E3A2F]">
                <Info size={13} />
              </span>
              <span>{lang === "bn" ? "জনস্বার্থে বিজ্ঞপ্তি" : "Public Advisory"}</span>
            </div>
            <button
              type="button"
              className="text-[#5C6863] hover:text-[#12241C] transition p-1"
              aria-label="Toggle Public Advisory"
            >
              {isAdvisoryOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
          {isAdvisoryOpen && (
            <p className="mt-3 text-xs sm:text-sm text-[#4B5563] leading-relaxed">
              {lang === "bn"
                ? `বন্যা সতর্কতাগুলো কৃত্রিম বুদ্ধিমত্তা ও বৃষ্টিপাত বিশ্লেষণের মাধ্যমে প্রণীত। ${displayDate} তারিখের জন্য নির্ণীত সতর্কতামূলক পূর্বাভাস। দাপ্তরিক তথ্যের জন্য এফএফডব্লিউসি (FFWC) বুলেটিন দেখুন।`
                : `Flood alerts are machine learning estimations derived from precipitation and satellite radar telemetry for ${displayDate}. Official flood warnings and evacuation directives are issued exclusively by the Flood Forecasting and Warning Centre (FFWC).`}
            </p>
          )}
        </div>

        {/* Alerts Grid: Fully responsive 1, 2, or 3 columns */}
        {isLoading ? (
          <div className="py-16 text-center text-base text-[#5C6863] animate-pulse">
            {t.alerts_checking}
          </div>
        ) : alerts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {alerts.map((alert) => {
              const dName = isBn
                ? DISTRICTS_BN[alert.district.pcode] || alert.district.name
                : alert.district.name;
              const isAlert = alert.level === "alert";
              const percentNum = Math.round(alert.probability * 100);

              const likelihoodText =
                alert.probability >= 0.95
                  ? lang === "bn" ? "৯৫% এর বেশি" : "More than 95%"
                  : `${percentNum}%`;

              // Counts of places registered in the backend for this district; 0 is a real answer.
              const assetsCount = alert.assets_at_risk?.total?.assets ?? 0;
              const occupancy = alert.assets_at_risk?.total?.occupancy ?? 0;
              const peopleServed = occupancy.toLocaleString();

              // Circumference for radial progress (r=16, 2*PI*r ≈ 100.53)
              const radius = 16;
              const circumference = 2 * Math.PI * radius;
              const strokeDashoffset = circumference - (alert.probability * circumference);

              return (
                <div
                  key={alert.alert_id}
                  onClick={() =>
                    onSelectDistrict(alert.district.pcode, alert.district.name)
                  }
                  className={`bg-white rounded-2xl p-4 sm:p-6 border border-[#DFDDD3] shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                    isAlert
                      ? "border-l-[6px] border-l-[#D9381E]"
                      : "border-l-[6px] border-l-[#E88C30]"
                  }`}
                >
                  {/* Top Row: District Name + Badge on Left, Likelihood & Graph Chart on Right */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-base sm:text-lg text-[#111827] truncate">
                          {dName} {lang === "bn" ? "জেলা" : "District"}
                        </span>
                        {isAlert ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5] uppercase tracking-wider shrink-0">
                            {lang === "bn" ? "অ্যালার্ট" : "ALERT"}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] uppercase tracking-wider shrink-0">
                            {lang === "bn" ? "নজরদারি" : "WATCH"}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#6B7280]">
                        {lang === "bn" ? "বন্যা পূর্বাভাস নির্দেশক" : "Satellite flood radar likelihood"}
                      </div>
                    </div>

                    {/* Graph Chart (Radial Gauge + Bar Meter) */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      {/* Mini Radial Graph Gauge */}
                      <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                        <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 38 38">
                          <circle
                            cx="19"
                            cy="19"
                            r={radius}
                            className="text-[#F3F4F6]"
                            strokeWidth="3.5"
                            stroke="currentColor"
                            fill="none"
                          />
                          <circle
                            cx="19"
                            cy="19"
                            r={radius}
                            className={isAlert ? "text-[#D9381E]" : "text-[#E88C30]"}
                            strokeWidth="3.5"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            style={{ transition: "stroke-dashoffset 0.6s ease" }}
                          />
                        </svg>
                        <span className="absolute text-[11px] font-black text-[#111827]">
                          {percentNum > 95 ? ">95%" : `${percentNum}%`}
                        </span>
                      </div>

                      {/* Percentage Text & Linear Meter */}
                      <div className="text-right flex flex-col items-end">
                        <div className="text-[13px] text-[#6B7280] font-semibold leading-none mb-1">
                          {lang === "bn" ? "সম্ভাবনা" : "Likelihood"}
                        </div>
                        <div className="text-sm sm:text-base font-black text-[#111827] leading-none">
                          {isBn ? toBnNum(likelihoodText) : likelihoodText}
                        </div>
                        {/* Mini Linear Graph Bar */}
                        <div className="w-16 sm:w-20 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden mt-1.5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isAlert
                                ? "bg-gradient-to-r from-[#F87171] to-[#D9381E]"
                                : "bg-gradient-to-r from-[#FBBF24] to-[#E88C30]"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(8, alert.probability * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Assets + Sheltered/Served with Icons */}
                  <div className="flex flex-wrap items-center justify-between text-xs sm:text-[13px] text-[#4B5563] pt-3 border-t border-[#F0EFEA] gap-2">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Landmark size={14} className="text-[#6B7280] shrink-0" />
                      <span>
                        {isBn ? toBnNum(assetsCount) : assetsCount}{" "}
                        {lang === "bn" ? "নিবন্ধিত স্থাপনা" : "Registered Critical Assets"}
                      </span>
                    </div>
                    {occupancy > 0 && (
                      <div className="flex items-center gap-1.5 font-medium">
                        <Users size={14} className="text-[#6B7280] shrink-0" />
                        <span>
                          {isBn ? toBnNum(peopleServed) : peopleServed}{" "}
                          {lang === "bn" ? "ধারণক্ষমতা" : "capacity"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : !hasForecast ? (
          <div className="p-10 rounded-2xl bg-[#FAF9F5] border border-[#DFDDD3] text-center space-y-2">
            <Info className="w-8 h-8 text-[#6B7280] mx-auto" />
            <div className="text-xl font-bold text-[#12241C]">
              {lang === "bn"
                ? `${displayDate} তারিখের কোনো পূর্বাভাস নেই`
                : `No forecast for ${displayDate}`}
            </div>
            <p className="text-sm text-[#5C6863]">
              {lang === "bn"
                ? "এই দিনের জন্য মডেল চালানো হয়নি, তাই সতর্কতা আছে কি নেই তা বলা যাচ্ছে না। এর মানে ঝুঁকি নেই, তা নয়।"
                : "The model has not been run for this day, so it is unknown whether any district would be on alert. This does not mean there is no risk."}
            </p>
          </div>
        ) : (
          <div className="p-10 rounded-2xl bg-[#FAF9F5] border border-[#DFDDD3] text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-[#16A34A] mx-auto" />
            <div className="text-xl font-bold text-[#12241C]">
              {t.alerts_none_title.replace("{date}", displayDate)}
            </div>
            <p className="text-sm text-[#5C6863]">
              {t.alerts_none_sub}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
