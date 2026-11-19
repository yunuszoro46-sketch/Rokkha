"use client";

import React from "react";
import { ExternalLink, Info, Map as MapIcon, MapPin, Phone, Building2, FlaskConical } from "lucide-react";
import type { DistrictPrediction } from "../types/api";
import { Language, toBnNum } from "../lib/translations";

/**
 * Context under the district warnings, so a quiet day still answers: is there a forecast, how fresh,
 * what does it cover, where are the OFFICIAL warnings, and what can I do. Only real values are shown;
 * nothing here turns "no Watch or Alert" into "safe".
 */
export const AlertsContext: React.FC<{
  lang: Language;
  predictions: DistrictPrediction[];
  isLoading: boolean;
  /** true when the backend did not answer and the saved sample is shown */
  sample: boolean;
  onNavigate: (view: "map" | "shelters" | "intelligence") => void;
}> = ({ lang, predictions, isLoading, sample, onNavigate }) => {
  const bn = lang === "bn";
  const tr = (en: string, b: string) => (bn ? b : en);
  const n = (v: number | string) => (bn ? toBnNum(String(v)) : String(v));

  const issued = predictions.find((p) => p.issued_at)?.issued_at;
  const predicted = predictions.filter((p) => p.status === "predicted").length;
  const unsupported = predictions.filter((p) => p.status === "unsupported").length;
  const missing = predictions.filter((p) => p.status === "inputs_missing").length;
  const issuedText = issued
    ? n(new Date(issued).toLocaleString(bn ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))
    : null;

  const card = "rounded-2xl border border-rk-line bg-white p-5 sm:p-6";
  const h = "flex items-center gap-2 text-base font-extrabold text-rk-forest";
  const link =
    "inline-flex min-h-10 items-center gap-2 rounded-lg border border-rk-line bg-rk-surface px-3.5 py-1.5 text-left text-sm font-semibold text-rk-forest hover:bg-rk-secondary transition-colors";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5" aria-label={tr("About this forecast", "এই পূর্বাভাস সম্পর্কে")} role="region">
      <section className={card} aria-labelledby="rk-ac-status">
        <h2 id="rk-ac-status" className={h}>
          <Info className="w-4.5 h-4.5 text-rk-brand" aria-hidden="true" /> {tr("This forecast", "এই পূর্বাভাস")}
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-rk-muted">{tr("Status", "অবস্থা")}</dt>
            <dd className="font-semibold text-rk-ink" aria-live="polite">
              {isLoading
                ? tr("Getting the forecast…", "পূর্বাভাস আনা হচ্ছে…")
                : sample
                ? tr("Rokkha's server did not answer: a saved sample is shown, not today's data.", "রক্ষার সার্ভার সাড়া দেয়নি: আজকের তথ্য নয়, সংরক্ষিত নমুনা দেখানো হচ্ছে।")
                : predictions.length === 0
                ? tr("No forecast stored for this day yet.", "এই দিনের পূর্বাভাস এখনো সংরক্ষিত হয়নি।")
                : tr("Forecast issued", "পূর্বাভাস তৈরি") + (issuedText ? ` ${issuedText} ${tr("(Bangladesh time)", "(বাংলাদেশ সময়)")}` : "")}
            </dd>
          </div>
          {predictions.length > 0 && !isLoading && (
            <div>
              <dt className="text-rk-muted">{tr("Coverage", "আওতা")}</dt>
              <dd className="text-rk-ink">
                {tr(`${predicted} of 64 districts forecast`, `৬৪টির মধ্যে ${n(predicted)}টি জেলার পূর্বাভাস`)}
                {unsupported > 0 && tr(` · ${unsupported} not covered (radar cannot see water there)`, ` · ${n(unsupported)}টি আওতার বাইরে (সেখানে রাডারে পানি দেখা যায় না)`)}
                {missing > 0 && tr(` · ${missing} missing inputs`, ` · ${n(missing)}টিতে তথ্য অনুপস্থিত`)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-rk-muted">{tr("What it is", "এটি কী")}</dt>
            <dd className="text-rk-ink">
              {tr(
                "The chance that satellites see flooding in each district on the chosen day, from a machine-learning model. Watch and Alert are its two warning levels. No Watch or Alert does not mean safe.",
                "বেছে নেওয়া দিনে প্রতিটি জেলায় স্যাটেলাইটে বন্যা দেখা যাওয়ার সম্ভাবনা, মেশিন-লার্নিং মডেল থেকে। নজরদারি ও সতর্কতা এর দুটি স্তর। নজরদারি বা সতর্কতা না থাকা মানে নিরাপদ নয়।"
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className={card} aria-labelledby="rk-ac-official">
        <h2 id="rk-ac-official" className={h}>
          <Building2 className="w-4.5 h-4.5 text-rk-brand" aria-hidden="true" /> {tr("Official warnings", "সরকারি সতর্কবার্তা")}
        </h2>
        <p className="mt-3 text-sm text-rk-ink">
          {tr(
            "Rokkha is a model estimate, not an official warning. River water levels, danger levels and official flood forecasts come from the Flood Forecasting and Warning Centre (FFWC, part of BWDB).",
            "রক্ষা মডেলের অনুমান, সরকারি সতর্কবার্তা নয়। নদীর পানির উচ্চতা, বিপদসীমা ও সরকারি বন্যা পূর্বাভাস দেয় বন্যা পূর্বাভাস ও সতর্কীকরণ কেন্দ্র (FFWC, পানি উন্নয়ন বোর্ডের অংশ)।"
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="https://www.ffwc.gov.bd/" target="_blank" rel="noopener noreferrer" className={link}>
            ffwc.gov.bd <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
          <a href="tel:1090" className={link}>
            <Phone className="w-4 h-4" aria-hidden="true" /> {tr("1090 (press 5): recorded flood warnings", "১০৯০ (৫ চাপুন): রেকর্ড করা বন্যা সতর্কবার্তা")}
          </a>
          <a href="tel:999" className={link}>
            <Phone className="w-4 h-4" aria-hidden="true" /> {tr("999: life in danger", "৯৯৯: জীবন ঝুঁকিতে থাকলে")}
          </a>
        </div>
      </section>

      <section className={`${card} md:col-span-2 xl:col-span-1`} aria-labelledby="rk-ac-next">
        <h2 id="rk-ac-next" className={h}>
          <MapPin className="w-4.5 h-4.5 text-rk-brand" aria-hidden="true" /> {tr("What you can do", "আপনি যা করতে পারেন")}
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm text-rk-ink list-disc pl-5">
          <li>{tr("See observed satellite flooding, rain and river flow on the map.", "মানচিত্রে স্যাটেলাইটে দেখা বন্যা, বৃষ্টি ও নদী-প্রবাহ দেখুন।")}</li>
          <li>{tr("Check a place: its flood record and modelled flood depth.", "একটি জায়গা যাচাই করুন: তার বন্যার ইতিহাস ও মডেলের গভীরতা।")}</li>
          <li>{tr("Know your nearest shelter before water rises.", "পানি বাড়ার আগেই নিকটস্থ আশ্রয়কেন্দ্র জেনে রাখুন।")}</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => onNavigate("map")} className={link}>
            <MapIcon className="w-4 h-4" aria-hidden="true" /> {tr("Open the flood map", "বন্যার মানচিত্র খুলুন")}
          </button>
          <button type="button" onClick={() => onNavigate("shelters")} className={link}>
            <Building2 className="w-4 h-4" aria-hidden="true" /> {tr("Nearest shelters", "নিকটস্থ আশ্রয়কেন্দ্র")}
          </button>
          <button type="button" onClick={() => onNavigate("intelligence")} className={link}>
            <FlaskConical className="w-4 h-4" aria-hidden="true" /> {tr("How the forecast is made", "পূর্বাভাস কীভাবে তৈরি হয়")}
          </button>
        </div>
      </section>
    </div>
  );
};
