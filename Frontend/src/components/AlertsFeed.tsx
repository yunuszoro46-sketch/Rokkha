"use client";

import React, { useState } from "react";
import { AlertItem } from "../types/api";
import { Card, CardHeader, CardContent } from "./ui/card";
import {
  Info,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from "lucide-react";
import { addDays, dhakaToday, formatDay } from "@/lib/dates";
import { ALL_DISTRICTS } from "@/lib/districts";
import { CalendarDatePicker } from "./ui/CalendarDatePicker";
import {
  Language,
  UI_TEXT,
  DISTRICTS_BN,
  DIVISIONS_BN,
  toBnNum,
} from "../lib/translations";


interface AlertsFeedProps {
  alerts: AlertItem[];
  targetDate: string;
  isLoading: boolean;
  /** false = no forecast exists for this day (different from "no alerts"). */
  hasForecast?: boolean;
  lang?: Language;
  selectedDistrictPcode?: string;
  onSelectDistrict: (pcode: string, name: string) => void;
  /** Lets the visitor step to another forecast day (same control as the map). */
  onChangeTargetDate?: (iso: string) => void;
}

export const AlertsFeed: React.FC<AlertsFeedProps> = ({
  alerts,
  targetDate,
  isLoading,
  hasForecast = true,
  lang = "en",
  selectedDistrictPcode,
  onSelectDistrict,
  onChangeTargetDate,
}) => {
  const t = UI_TEXT[lang] || UI_TEXT.en;
  const isBn = lang === "bn";
  const displayDate = formatDay(targetDate, isBn ? "bn" : "en");
  const today = dhakaToday();
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
    <Card className="border-rk-line bg-white rounded-3xl shadow-sm overflow-hidden">
      {/* Top of Section: Just Title and a Dropdown with 64 District List */}
      <CardHeader className="px-5 sm:px-8 py-5 border-b border-rk-line flex flex-col lg:flex-row lg:items-center justify-between gap-4 space-y-0">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold text-rk-forest tracking-tight leading-tight">
            {lang === "bn" ? "জেলার বন্যা সতর্কবার্তা" : "District flood warnings"}
          </h1>
          <p className="mt-1 text-sm text-rk-muted">
            {lang === "bn"
              ? "রক্ষা মডেলের এক দিনের পূর্বাভাস · সরকারি সতর্কবার্তা নয় (ffwc.gov.bd)"
              : "Rokkha model, one-day forecast · not an official warning (ffwc.gov.bd)"}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          {onChangeTargetDate && (
            <div className="flex items-center gap-1.5 rounded-xl border border-rk-line bg-rk-surface px-1.5 py-1" role="group" aria-label={lang === "bn" ? "পূর্বাভাসের দিন" : "Forecast day"}>
              <button type="button" onClick={() => onChangeTargetDate(addDays(targetDate, -1))} className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-rk-forest hover:bg-rk-secondary transition-colors" aria-label={lang === "bn" ? "আগের দিন" : "Previous day"}>
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>
              <CalendarDatePicker
                selectedDate={targetDate}
                today={today}
                onChangeDate={onChangeTargetDate}
                lang={lang}
              >
                <button
                  type="button"
                  className="flex-1 min-w-[8.5rem] px-2 py-1 rounded-lg text-center text-sm font-bold text-rk-forest hover:bg-rk-secondary transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer group"
                  aria-label={lang === "bn" ? "ক্যালেন্ডার খুলুন" : "Open calendar"}
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-rk-brand group-hover:scale-110 transition-transform" aria-hidden="true" />
                  <span className="whitespace-nowrap">
                    {displayDate}{targetDate === today ? (lang === "bn" ? " · আজ" : " · today") : ""}
                  </span>
                </button>
              </CalendarDatePicker>
              <button type="button" disabled={targetDate >= today} onClick={() => onChangeTargetDate(addDays(targetDate, 1))} className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-rk-forest hover:bg-rk-secondary transition-colors disabled:opacity-40 disabled:hover:bg-transparent" aria-label={lang === "bn" ? "পরের দিন" : "Next day"}>
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* 64 District Dropdown */}
          <div className="relative w-full sm:w-auto">
            <label htmlFor="rk-alert-district" className="sr-only">{lang === "bn" ? "জেলা বেছে নিন" : "Show one district"}</label>
            <select
              id="rk-alert-district"
              value={selectedDistrictFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDistrictFilter(val);
                if (val) {
                  const d = ALL_DISTRICTS.find((item) => item.pcode === val);
                  if (d) onSelectDistrict(d.pcode, d.name);
                }
              }}
              className="appearance-none bg-rk-page hover:bg-rk-secondary border border-rk-line text-rk-ink font-semibold text-sm rounded-xl pl-3.5 pr-9 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rk-brand cursor-pointer w-full sm:w-auto sm:min-w-[210px] h-11 transition-colors"
            >
              <option value="">
                {lang === "bn" ? "সকল জেলা (৬৪টি)" : "All districts (64)"}
              </option>
              {ALL_DISTRICTS.map((d) => (
                <option key={d.pcode} value={d.pcode}>
                  {lang === "bn"
                    ? `${DISTRICTS_BN[d.pcode] || d.name} (${DIVISIONS_BN[d.division] || d.division})`
                    : `${d.name} (${d.division})`}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-rk-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-8 space-y-6">
        {/* Alerts Grid: Fully responsive 1, 2, or 3 columns */}
        {isLoading ? (
          <div role="status" className="py-16 text-center text-base text-rk-muted motion-safe:animate-pulse">
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
                  ? lang === "bn" ? "৯৫% এর বেশি" : ">95%"
                  : `${percentNum}%`;

              return (
                <button
                  type="button"
                  key={alert.alert_id}
                  onClick={() =>
                    onSelectDistrict(alert.district.pcode, alert.district.name)
                  }
                  className={`text-left w-full bg-white rounded-2xl p-4 sm:p-5 border border-rk-line shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md hover:-translate-y-px motion-reduce:hover:translate-y-0 transition-[box-shadow,transform] duration-200 cursor-pointer flex flex-col gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rk-brand focus-visible:ring-offset-2 ${isAlert
                      ? "border-l-[6px] border-l-rk-risk-alert"
                      : "border-l-[6px] border-l-rk-risk-watch"
                    }`}
                >
                  {/* District name + badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-base sm:text-lg text-rk-forest truncate">
                      {dName}
                    </span>
                    {isAlert ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rk-danger-soft text-rk-danger border border-rk-danger-accent/40 uppercase tracking-wider shrink-0">
                        {lang === "bn" ? "সতর্কতা" : "ALERT"}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rk-warning-soft text-rk-warning border border-rk-warning-accent/60 uppercase tracking-wider shrink-0">
                        {lang === "bn" ? "নজরদারি" : "WATCH"}
                      </span>
                    )}
                  </div>

                  {/* Probability bar + percentage */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-rk-muted">
                      <span>{lang === "bn" ? "বন্যার সম্ভাবনা" : "Flood probability"}</span>
                      <span className="font-bold text-rk-forest">
                        {isBn ? toBnNum(likelihoodText) : likelihoodText}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-rk-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isAlert
                            ? "bg-gradient-to-r from-rk-danger-accent/70 to-rk-danger-accent"
                            : "bg-gradient-to-r from-rk-warning-accent/70 to-rk-warning-accent"
                          }`}
                        style={{ width: `${Math.min(100, Math.max(8, alert.probability * 100))}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : !hasForecast ? (
          <div role="status" className="p-8 sm:p-10 rounded-2xl bg-rk-page border border-rk-line text-center space-y-3">
            <Info className="w-8 h-8 text-rk-muted mx-auto" aria-hidden="true" />
            <div className="text-lg sm:text-xl font-bold text-rk-ink text-balance">
              {lang === "bn"
                ? `${displayDate} তারিখের কোনো পূর্বাভাস নেই`
                : `No forecast for ${displayDate}`}
            </div>
            <p className="text-sm text-rk-muted max-w-xl mx-auto">
              {lang === "bn"
                ? "এই দিনের জন্য মডেল চালানো হয়নি (সাধারণত সকালে তৈরি হয়), তাই সতর্কতা আছে কি নেই তা বলা যাচ্ছে না। এর মানে ঝুঁকি নেই, তা নয়।"
                : "The model has not been run for this day yet (it is usually ready in the morning), so it is unknown whether any district would be on watch or alert. This does not mean there is no risk."}
            </p>
            {onChangeTargetDate && (
              <button type="button" onClick={() => onChangeTargetDate(addDays(targetDate, -1))} className="mt-1 inline-flex h-10 items-center gap-1.5 rounded-lg border border-rk-line bg-white px-4 text-sm font-semibold text-rk-brand-strong hover:bg-rk-secondary transition-colors">
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                {lang === "bn" ? "আগের দিনের পূর্বাভাস দেখুন" : "See the day before"}
              </button>
            )}
          </div>
        ) : selectedDistrictFilter ? (
          <div role="status" className="p-8 sm:p-12 rounded-2xl bg-rk-page border border-rk-line text-center space-y-2">
            <Info className="w-8 h-8 text-rk-muted mx-auto" aria-hidden="true" />
            <div className="text-lg sm:text-xl font-bold text-rk-ink">
              {lang === "bn"
                ? `${selDistrictName} জেলায় ${displayDate} তারিখে কোনো ওয়াচ বা অ্যালার্ট নেই`
                : `No watch or alert for ${selDistrictName} on ${displayDate}`}
            </div>
            <p className="text-sm text-rk-muted max-w-xl mx-auto">
              {lang === "bn"
                ? "কম সম্ভাবনা মানে শূন্য ঝুঁকি নয়। জেলাটি মডেলের আওতায় না-ও থাকতে পারে; মানচিত্রে দেখুন।"
                : "A low chance is not zero risk. The district may also be outside the model's coverage; the map shows which."}
            </p>
          </div>
        ) : (
          <div role="status" className="p-8 sm:p-10 rounded-2xl bg-rk-page border border-rk-line text-center space-y-2">
            <Info className="w-8 h-8 text-rk-muted mx-auto" aria-hidden="true" />
            <div className="text-xl font-bold text-rk-ink">
              {t.alerts_none_title.replace("{date}", displayDate)}
            </div>
            <p className="text-sm text-rk-muted max-w-xl mx-auto">
              {t.alerts_none_sub}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
