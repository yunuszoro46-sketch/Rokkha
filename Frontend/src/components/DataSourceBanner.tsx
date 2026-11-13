"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Language, toBnNum } from "../lib/translations";
import { useSampleParts, SAMPLE_GENERATED_AT, SAMPLE_DATES, DataPart } from "../services/dataSource";

const PART_NAMES: Record<DataPart, { en: string; bn: string }> = {
  predictions: { en: "forecast", bn: "পূর্বাভাস" },
  alerts: { en: "alerts", bn: "সতর্কতা" },
  model: { en: "model facts", bn: "মডেলের তথ্য" },
  history: { en: "flood history", bn: "বন্যার ইতিহাস" },
  satellite: { en: "satellite passes", bn: "স্যাটেলাইট পর্যবেক্ষণ" },
  location: { en: "place check", bn: "স্থান যাচাই" },
  shelters: { en: "shelters", bn: "আশ্রয়কেন্দ্র" },
  hydro: { en: "rain and river", bn: "বৃষ্টি ও নদী" },
};

/**
 * Shown whenever any part of the page comes from the saved sample instead of
 * the live backend. Saved data must never look live.
 */
export const DataSourceBanner: React.FC<{ lang?: Language }> = ({ lang = "en" }) => {
  const parts = useSampleParts();
  if (parts.length === 0) return null;

  const isBn = lang === "bn";
  const day = SAMPLE_GENERATED_AT.slice(0, 10);
  const names = parts.map((p) => PART_NAMES[p][isBn ? "bn" : "en"]).join(", ");
  const dates = SAMPLE_DATES.join(", ");
  const forecastFromSample = parts.includes("predictions") || parts.includes("alerts");

  return (
    <div
      role="status"
      className="w-full bg-[#FEF3C7] border-b border-[#F59E0B] text-[#78350F] px-4 py-2.5 text-sm font-semibold flex items-start gap-2"
    >
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>
        {isBn
          ? `সংরক্ষিত নমুনা (${toBnNum(day)}), সরাসরি তথ্য নয়। সার্ভার থেকে এই তথ্যগুলো পাওয়া যায়নি, তাই সংরক্ষিত ফলাফল দেখানো হচ্ছে: ${names}।`
          : `Saved sample from ${day}, not live. The backend did not answer for: ${names}. Stored results are shown for those.`}
        {forecastFromSample &&
          (isBn
            ? ` সংরক্ষিত পূর্বাভাস আছে শুধু এই তারিখগুলোর: ${toBnNum(dates)}।`
            : ` Saved forecasts exist only for ${dates}.`)}
        {parts.includes("shelters") &&
          (isBn
            ? " আশ্রয়কেন্দ্রের তালিকা সংযোগ ছাড়া দেখানো হয় না।"
            : " Shelters are not shown without a connection.")}
      </span>
    </div>
  );
};
