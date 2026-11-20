"use client";

import React, { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RotateCcw } from "lucide-react";
import { toBnNum } from "@/lib/translations";

const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const BN_MONTHS = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
];

const EN_WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const BN_WEEKDAYS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];

interface CalendarDatePickerProps {
  selectedDate: string; // YYYY-MM-DD
  today: string;        // YYYY-MM-DD
  onChangeDate: (iso: string) => void;
  lang?: "en" | "bn";
  maxDate?: string;
  minDate?: string;
  children: React.ReactNode;
  align?: "center" | "start" | "end";
}

export const CalendarDatePicker: React.FC<CalendarDatePickerProps> = ({
  selectedDate,
  today,
  onChangeDate,
  lang = "en",
  maxDate = today,
  minDate = "2024-01-01",
  children,
  align = "center",
}) => {
  const [open, setOpen] = useState(false);

  // Initialize view year/month to selected date or today
  const parseIso = (iso: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date();
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const [viewDate, setViewDate] = useState<Date>(() => parseIso(selectedDate || today));

  useEffect(() => {
    if (selectedDate) {
      setViewDate(parseIso(selectedDate));
    }
  }, [selectedDate]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const prevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const isNextDisabled = () => {
    if (!maxDate) return false;
    const max = parseIso(maxDate);
    return (
      viewYear > max.getFullYear() ||
      (viewYear === max.getFullYear() && viewMonth >= max.getMonth())
    );
  };

  const isPrevDisabled = () => {
    if (!minDate) return false;
    const min = parseIso(minDate);
    return (
      viewYear < min.getFullYear() ||
      (viewYear === min.getFullYear() && viewMonth <= min.getMonth())
    );
  };

  // Calendar calculations
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const days: { day: number; iso: string; isDisabled: boolean; isSelected: boolean; isToday: boolean }[] = [];
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isDisabled = (maxDate && iso > maxDate) || (minDate && iso < minDate) || false;
    const isSelected = iso === selectedDate;
    const isToday = iso === today;
    days.push({ day: d, iso, isDisabled, isSelected, isToday });
  }

  const handleSelectDay = (iso: string) => {
    onChangeDate(iso);
    setOpen(false);
  };

  const handleJumpToToday = () => {
    onChangeDate(today);
    setViewDate(parseIso(today));
    setOpen(false);
  };

  const monthLabel = lang === "bn" ? BN_MONTHS[viewMonth] : EN_MONTHS[viewMonth];
  const yearLabel = lang === "bn" ? toBnNum(viewYear) : String(viewYear);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={8}
        className="w-[304px] p-3.5 bg-rk-page border border-rk-line shadow-2xl rounded-2xl select-none"
      >
        {/* Calendar Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-rk-line">
          <button
            type="button"
            onClick={prevMonth}
            disabled={isPrevDisabled()}
            className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-rk-forest hover:bg-rk-secondary transition-colors disabled:opacity-30 disabled:pointer-events-none"
            aria-label={lang === "bn" ? "পূর্ববর্তী মাস" : "Previous month"}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-center font-bold text-sm text-rk-forest">
            {monthLabel} {yearLabel}
          </div>

          <button
            type="button"
            onClick={nextMonth}
            disabled={isNextDisabled()}
            className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-rk-forest hover:bg-rk-secondary transition-colors disabled:opacity-30 disabled:pointer-events-none"
            aria-label={lang === "bn" ? "পরবর্তী মাস" : "Next month"}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mt-2.5 mb-1.5 text-center text-[11px] font-semibold text-rk-muted">
          {(lang === "bn" ? BN_WEEKDAYS : EN_WEEKDAYS).map((wd, i) => (
            <div key={i} className="py-0.5">
              {wd}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Leading blank slots */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="h-8 w-8" />
          ))}

          {/* Month days */}
          {days.map(({ day, iso, isDisabled, isSelected, isToday }) => {
            const displayDay = lang === "bn" ? toBnNum(day) : day;

            return (
              <button
                key={iso}
                type="button"
                disabled={isDisabled}
                onClick={() => handleSelectDay(iso)}
                className={`h-8 w-8 text-xs font-semibold rounded-lg flex items-center justify-center transition-all ${
                  isSelected
                    ? "bg-rk-brand text-white font-bold shadow-sm"
                    : isToday
                    ? "border border-rk-brand text-rk-brand-strong bg-rk-brand/5 hover:bg-rk-brand/10 font-bold"
                    : isDisabled
                    ? "text-rk-muted/30 cursor-not-allowed pointer-events-none"
                    : "text-rk-ink hover:bg-rk-secondary hover:text-rk-forest"
                }`}
                title={iso}
              >
                {displayDay}
              </button>
            );
          })}
        </div>

        {/* Footer with Today shortcut */}
        <div className="mt-3 pt-2.5 border-t border-rk-line flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={handleJumpToToday}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-rk-brand font-semibold hover:bg-rk-secondary transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{lang === "bn" ? "আজকের দিন" : "Today"}</span>
          </button>

          <span className="text-[11px] text-rk-muted">
            {lang === "bn" ? "তারিখ নির্বাচন করুন" : "Select date"}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
};
