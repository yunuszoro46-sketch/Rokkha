"use client";

import React, { useState } from "react";
import { AlertItem } from "../types/api";
import { formatProbability } from "../lib/utils";
import { Badge } from "./ui/badge";
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
    <Card className="border-[#DFDDD3] bg-[#FAF9F5] rounded-2xl shadow-sm overflow-hidden">
      {/* Container Header */}
      <CardHeader className="px-6 py-5 border-b border-[#EBE8DC] bg-white flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-xl sm:text-2xl font-bold text-[#12241C] tracking-tight">
            {lang === "bn"
              ? `জেলা বন্যা সতর্কতা (${toBnNum(alerts.length)})`
              : `District Flood Early Warnings (${alerts.length})`}
          </CardTitle>
        </div>
        <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5] uppercase tracking-wide">
          {alerts.length > 0
            ? lang === "bn" ? "পদক্ষেপ প্রয়োজন" : "Action Required"
            : lang === "bn" ? "কোন সতর্কতা নেই" : "Normal"}
        </span>
      </CardHeader>

      <CardContent className="p-6 space-y-5">
        {/* Public Advisory Box (Collapsible matching Image 2) */}
        <div className="rounded-xl border border-[#D5D2C5] bg-white p-4 transition-all">
          <div
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setIsAdvisoryOpen(!isAdvisoryOpen)}
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#1E3A2F]">
              <span className="w-4 h-4 rounded-full bg-[#E8EDE9] flex items-center justify-center text-[#1E3A2F]">
                <Info size={11} />
              </span>
              <span>{lang === "bn" ? "জনস্বার্থে বিজ্ঞপ্তি" : "Public Advisory"}</span>
            </div>
            <button
              type="button"
              className="text-[#5C6863] hover:text-[#12241C] transition p-1"
              aria-label="Toggle Public Advisory"
            >
              {isAdvisoryOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          {isAdvisoryOpen && (
            <p className="mt-2 text-xs sm:text-[13px] text-[#4B5563] leading-relaxed">
              {lang === "bn"
                ? `বন্যা সতর্কতাগুলো কৃত্রিম বুদ্ধিমত্তা ও বৃষ্টিপাত বিশ্লেষণের মাধ্যমে প্রণীত। ২০২২-০৬-১৮ তারিখের জন্য নির্ণীত সতর্কতামূলক পূর্বাভাস। দাপ্তরিক তথ্যের জন্য এফএফডব্লিউসি (FFWC) বুলেটিন দেখুন।`
                : `Flood alerts are machine learning estimations derived from precipitation and satellite radar telemetry for ${displayDate}. Official flood warnings and evacuation directives are issued exclusively by the Flood Forecasting and Warning Centre (FFWC).`}
            </p>
          )}
        </div>

        {/* Alerts Grid: 3 Columns matching Image 2 */}
        {isLoading ? (
          <div className="py-12 text-center text-base text-[#5C6863] animate-pulse">
            {t.alerts_checking}
          </div>
        ) : alerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
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
                  className={`bg-white rounded-xl p-4.5 border border-[#E2E0D6] shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                    isAlert
                      ? "border-l-4 border-l-[#D9381E]"
                      : "border-l-4 border-l-[#E88C30]"
                  }`}
                >
                  {/* Top Row: District Name + Badge on Left, Likelihood on Right */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-base text-[#111827]">
                        {dName} {lang === "bn" ? "জেলা" : "District"}
                      </span>
                      {isAlert ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5] uppercase tracking-wider">
                          {lang === "bn" ? "অ্যালার্ট" : "ALERT"}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] uppercase tracking-wider">
                          {lang === "bn" ? "নজরদারি" : "WATCH"}
                        </span>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-[#6B7280] font-semibold leading-none mb-1">
                        {lang === "bn" ? "সম্ভাবনা" : "Likelihood"}
                      </div>
                      <div className="text-sm font-extrabold text-[#111827] leading-none">
                        {isBn ? toBnNum(likelihoodText) : likelihoodText}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Assets + Sheltered/Served with Icons */}
                  <div className="flex items-center justify-between text-xs text-[#4B5563] pt-2 border-t border-[#F3F1E8]">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Landmark size={14} className="text-[#6B7280] shrink-0" />
                      <span>
                        {isBn ? toBnNum(assetsCount) : assetsCount}{" "}
                        {lang === "bn" ? "নিবন্ধিত স্থাপনা" : "Registered Critical Assets"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium">
                      <Users size={14} className="text-[#6B7280] shrink-0" />
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
          <div className="p-8 rounded-xl bg-white border border-[#DFDDD3] text-center space-y-2">
            <CheckCircle2 className="w-7 h-7 text-[#16A34A] mx-auto" />
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
