"use client";

import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { ChevronLeft, ChevronRight, Waves, Calendar, Check, ExternalLink } from "lucide-react";
import { PAST_FLOOD_EVENTS, PastFloodEvent, findMatchingPastEvent } from "@/lib/pastFloodEvents";

interface PastFloodEventsBarProps {
  currentDate: string;
  onSelectDate: (iso: string) => void;
  lang?: "en" | "bn";
  className?: string;
}

export const PastFloodEventsBar: React.FC<PastFloodEventsBarProps> = ({
  currentDate,
  onSelectDate,
  lang = "en",
  className = "",
}) => {
  const [open, setOpen] = useState(false);

  const matchedEvent = findMatchingPastEvent(currentDate);
  const currentIndex = matchedEvent
    ? PAST_FLOOD_EVENTS.findIndex((e) => e.id === matchedEvent.id)
    : -1;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex <= 0) {
      // Wrap to last event or select first
      onSelectDate(PAST_FLOOD_EVENTS[PAST_FLOOD_EVENTS.length - 1].targetDate);
    } else {
      onSelectDate(PAST_FLOOD_EVENTS[currentIndex - 1].targetDate);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex === -1 || currentIndex >= PAST_FLOOD_EVENTS.length - 1) {
      // Wrap to first event
      onSelectDate(PAST_FLOOD_EVENTS[0].targetDate);
    } else {
      onSelectDate(PAST_FLOOD_EVENTS[currentIndex + 1].targetDate);
    }
  };

  const handleSelectEvent = (event: PastFloodEvent) => {
    onSelectDate(event.targetDate);
    setOpen(false);
  };

  const displayLabel = matchedEvent
    ? (lang === "bn" ? matchedEvent.labelBn : matchedEvent.label)
    : (lang === "bn" ? "১০টি ঐতিহাসিক বন্যা" : "10 Past Flood Events");

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Left arrow to previous past event */}
      <button
        type="button"
        onClick={handlePrev}
        className="h-8 w-8 rounded-lg border border-rk-line bg-rk-page hover:bg-rk-secondary inline-flex items-center justify-center text-rk-forest transition-colors shrink-0"
        aria-label={lang === "bn" ? "পূর্ববর্তী ঐতিহাসিক বন্যা" : "Previous past flood event"}
        title={lang === "bn" ? "আগের ঐতিহাসিক বন্যা" : "Previous past flood"}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Popover trigger button showing current event / past flood button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`flex-1 min-w-0 h-8 px-2.5 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all text-center ${
              matchedEvent
                ? "border-rk-brand bg-rk-brand/10 text-rk-brand-strong hover:bg-rk-brand/15"
                : "border-rk-line bg-rk-page hover:bg-rk-secondary text-rk-forest"
            }`}
            aria-label={lang === "bn" ? "ঐতিহাসিক বন্যার তালিকা" : "Past flood events list"}
          >
            <Waves className="w-3.5 h-3.5 text-rk-brand shrink-0" />
            <span className="truncate">
              {displayLabel}
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="center"
          sideOffset={6}
          className="w-[320px] max-h-[380px] overflow-y-auto p-2.5 bg-rk-page border border-rk-line shadow-2xl rounded-2xl select-none"
        >
          <div className="px-2 py-1.5 border-b border-rk-line flex items-center justify-between">
            <span className="text-xs font-bold text-rk-forest uppercase tracking-wider flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-rk-brand" />
              {lang === "bn" ? "ঐতিহাসিক বন্যার পূর্বাভাস (২০১৬–২০২৪)" : "Past Flood Predictions (2016–2024)"}
            </span>
            <span className="text-[11px] font-mono text-rk-muted">10 events</span>
          </div>

          <div className="mt-1.5 space-y-1">
            {PAST_FLOOD_EVENTS.map((event, idx) => {
              const isSelected = matchedEvent?.id === event.id;

              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => handleSelectEvent(event)}
                  className={`w-full text-left p-2 rounded-xl transition-all flex items-start justify-between gap-2 text-xs ${
                    isSelected
                      ? "bg-rk-brand text-white font-medium shadow-sm"
                      : "hover:bg-rk-secondary text-rk-ink"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-mono text-[11px] font-bold ${isSelected ? "text-white" : "text-rk-forest"}`}>
                        {lang === "bn" ? event.labelBn : event.label}
                      </span>
                    </div>
                    <p className={`text-[11px] truncate mt-0.5 ${isSelected ? "text-white/90" : "text-rk-muted"}`}>
                      {lang === "bn" ? event.nameBn : event.name}
                    </p>
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Right arrow to next past event */}
      <button
        type="button"
        onClick={handleNext}
        className="h-8 w-8 rounded-lg border border-rk-line bg-rk-page hover:bg-rk-secondary inline-flex items-center justify-center text-rk-forest transition-colors shrink-0"
        aria-label={lang === "bn" ? "পরবর্তী ঐতিহাসিক বন্যা" : "Next past flood event"}
        title={lang === "bn" ? "পরের ঐতিহাসিক বন্যা" : "Next past flood"}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
