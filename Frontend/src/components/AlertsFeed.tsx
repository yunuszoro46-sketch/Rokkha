"use client";

import React, { useState } from "react";
import { AlertItem } from "../types/api";
import { formatProbability } from "../lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import {
  Info,
  Landmark,
  Users,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import districtGeoData from "@/data/bangladesh_districts.json";
import {
  Language,
  UI_TEXT,
  DISTRICTS_BN,
  DIVISIONS_BN,
  toBnNum,
} from "../lib/translations";

const ALL_DISTRICTS: Array<{ pcode: string; name: string; division: string }> = (
  districtGeoData as any
).features
  .map((f: any) => ({
    pcode: f.properties.pcode,
    name: f.properties.name,
    division: f.properties.parent_name || "",
  }))
  .sort((a: any, b: any) => a.name.localeCompare(b.name));

interface AlertsFeedProps {
  alerts: AlertItem[];
  targetDate: string;
  isLoading: boolean;
  /** false = no forecast exists for this day (different from "no alerts"). */
  hasForecast?: boolean;
  lang?: Language;
  selectedDistrictPcode?: string;
  onSelectDistrict: (pcode: string, name: string) => void;
}

export const AlertsFeed: React.FC<AlertsFeedProps> = ({
  alerts,
  targetDate,
  isLoading,
  hasForecast = true,
  lang = "en",
  selectedDistrictPcode,
  onSelectDistrict,
}) => {
  const t = UI_TEXT[lang] || UI_TEXT.en;
  const isBn = lang === "bn";
  const displayDate = isBn ? toBnNum(targetDate) : targetDate;
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<string>("");

  // Filter alerts by selected district from dropdown; if none selected, all show
  const filteredAlerts = selectedDistrictFilter
    ? alerts.filter((alert) => alert.district.pcode === selectedDistrictFilter)
    : alerts;

  const selDistrictMeta = ALL_DISTRICTS.find(
    (d) => d.pcode === selectedDistrictFilter
  );
  const selDistrictName = selDistrictMeta
    ? isBn
      ? DISTRICTS_BN[selDistrictMeta.pcode] || selDistrictMeta.name
      : selDistrictMeta.name
    : "";

  return (
    <Card className="border-[#DFDDD3] bg-white rounded-3xl shadow-sm overflow-hidden">
      {/* Top of Section: Just Title and a Dropdown with 64 District List */}
      <CardHeader className="px-6 sm:px-8 py-5 border-b border-[#EBE8DC] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <CardTitle className="text-xl sm:text-2xl font-extrabold text-[#12241C] tracking-tight">
          {lang === "bn"
            ? "জেলা বন্যা সতর্কতা"
            : "District Flood Early Warnings"}
        </CardTitle>

        {/* 64 District Dropdown */}
        <div className="relative">
          <select
            value={selectedDistrictFilter}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedDistrictFilter(val);
              if (val) {
                const d = ALL_DISTRICTS.find((item) => item.pcode === val);
                if (d) onSelectDistrict(d.pcode, d.name);
              }
            }}
            className="appearance-none bg-[#FAF9F5] hover:bg-[#F3EFE6] border border-[#DFDDD3] text-[#12241C] font-bold text-xs sm:text-sm rounded-xl pl-3.5 pr-9 py-2 focus:outline-none focus:ring-1 focus:ring-[#183026] shadow-2xs cursor-pointer min-w-[210px] transition-colors"
          >
            <option value="">
              {lang === "bn" ? "সকল জেলা (৬৪টি)" : "All Districts (64)"}
            </option>
            {ALL_DISTRICTS.map((d) => (
              <option key={d.pcode} value={d.pcode}>
                {lang === "bn"
                  ? `${DISTRICTS_BN[d.pcode] || d.name} (${DIVISIONS_BN[d.division] || d.division})`
                  : `${d.name} (${d.division})`}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-[#5C6863] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </CardHeader>

      <CardContent className="p-6 sm:p-8 space-y-6">
        {/* Alerts Grid: Fully responsive 1, 2, or 3 columns */}
        {isLoading ? (
          <div className="py-16 text-center text-base text-[#5C6863] animate-pulse">
            {t.alerts_checking}
          </div>
        ) : filteredAlerts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredAlerts.map((alert) => {
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
                        {lang === "bn" ? "বন্যা পূর্বাভাস নির্দেশক" : "Model flood probability"}
                      </div>
                    </div>

                    {/* Percentage Text & Linear Meter */}
                    <div className="text-right flex flex-col items-end shrink-0">
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
        ) : selectedDistrictFilter ? (
          <div className="p-8 sm:p-12 rounded-2xl bg-[#FAF9F5] border border-[#DFDDD3] text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-[#16A34A] mx-auto" />
            <div className="text-lg sm:text-xl font-bold text-[#12241C]">
              {lang === "bn"
                ? `${selDistrictName} জেলায় কোনো সক্রিয় বন্যা সতর্কতা নেই`
                : `No Active Flood Alerts for ${selDistrictName} District`}
            </div>
            <p className="text-xs sm:text-sm text-[#5C6863]">
              {lang === "bn"
                ? `নির্বাচিত তারিখে এই জেলার জন্য কোনো সতর্কতা বা ওয়াচ জারি করা হয়নি।`
                : `No flood alert or watch has been triggered for this district on the selected date.`}
            </p>
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
