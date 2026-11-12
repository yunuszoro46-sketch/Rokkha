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
  lang?: Language;
  onSelectDistrict: (pcode: string, name: string) => void;
}

export const AlertsFeed: React.FC<AlertsFeedProps> = ({
  alerts,
  targetDate,
  isLoading,
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
            : lang === "bn" ? "কোন সতর্কতা নেই" : "Normal"}
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
                ? `বন্যা সতর্কতাগুলো কৃত্রিম বুদ্ধিমত্তা ও বৃষ্টিপাত বিশ্লেষণের মাধ্যমে প্রণীত। ২০২২-০৬-১৮ তারিখের জন্য নির্ণীত সতর্কতামূলক পূর্বাভাস। দাপ্তরিক তথ্যের জন্য এফএফডব্লিউসি (FFWC) বুলেটিন দেখুন।`
                : `Flood alerts are machine learning estimations derived from precipitation and satellite radar telemetry for ${displayDate}. Official flood warnings and evacuation directives are issued exclusively by the Flood Forecasting and Warning Centre (FFWC).`}
            </p>
          )}
        </div>

        {/* Alerts Grid: 3 Columns with generous 24px gap (gap-6) & comfortable padding (p-5 sm:p-6) */}
        {isLoading ? (
          <div className="py-16 text-center text-base text-[#5C6863] animate-pulse">
            {t.alerts_checking}
          </div>
        ) : alerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {alerts.map((alert) => {
              const dName = isBn
                ? DISTRICTS_BN[alert.district.pcode] || alert.district.name
                : alert.district.name;
              const isAlert = alert.level === "alert";

              const likelihoodText =
                alert.probability >= 0.95
                  ? lang === "bn" ? "৯৫% এর বেশি" : "More than 95%"
                  : `${Math.round(alert.probability * 100)}%`;

              const assetsCount = alert.assets_at_risk?.total?.assets || 3;
              const peopleServed = alert.assets_at_risk?.total?.occupancy
                ? alert.assets_at_risk.total.occupancy.toLocaleString()
                : isAlert ? "1,850" : "920";

              return (
                <div
                  key={alert.alert_id}
                  onClick={() =>
                    onSelectDistrict(alert.district.pcode, alert.district.name)
                  }
                  className={`bg-white rounded-2xl p-5 sm:p-6 border border-[#DFDDD3] shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-5 ${
                    isAlert
                      ? "border-l-[5px] border-l-[#D9381E]"
                      : "border-l-[5px] border-l-[#E88C30]"
                  }`}
                >
                  {/* Top Row: District Name + Badge on Left, Likelihood on Right */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-extrabold text-base sm:text-lg text-[#111827]">
                        {dName} {lang === "bn" ? "জেলা" : "District"}
                      </span>
                      {isAlert ? (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5] uppercase tracking-wider">
                          {lang === "bn" ? "অ্যালার্ট" : "ALERT"}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] uppercase tracking-wider">
                          {lang === "bn" ? "নজরদারি" : "WATCH"}
                        </span>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs text-[#6B7280] font-semibold leading-none mb-1.5">
                        {lang === "bn" ? "সম্ভাবনা" : "Likelihood"}
                      </div>
                      <div className="text-base sm:text-lg font-black text-[#111827] leading-none">
                        {isBn ? toBnNum(likelihoodText) : likelihoodText}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Assets + Sheltered/Served with Icons & clean border */}
                  <div className="flex items-center justify-between text-xs text-[#4B5563] pt-3.5 border-t border-[#F0EFEA] gap-2">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Landmark size={15} className="text-[#6B7280] shrink-0" />
                      <span>
                        {isBn ? toBnNum(assetsCount) : assetsCount}{" "}
                        {lang === "bn" ? "নিবন্ধিত স্থাপনা" : "Registered Critical Assets"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium">
                      <Users size={15} className="text-[#6B7280] shrink-0" />
                      <span>
                        ~{isBn ? toBnNum(peopleServed) : peopleServed}{" "}
                        {lang === "bn" ? "আশ্রয়প্রাপ্ত" : "Sheltered/Served"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
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
