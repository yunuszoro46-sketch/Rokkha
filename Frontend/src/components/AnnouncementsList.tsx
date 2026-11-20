"use client";

import React, { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { Announcement, getPublicAnnouncements } from "../services/admin";
import { ALL_DISTRICTS } from "../lib/districts";
import { DISTRICTS_BN, Language } from "../lib/translations";
import { formatDay } from "../lib/dates";

/**
 * Published announcements from Rokkha's administrators. Always labelled as such: they are never
 * official warnings and never model output. Shows nothing when there are none (or the server is down).
 */
export const AnnouncementsList: React.FC<{ lang: Language }> = ({ lang }) => {
  const bn = lang === "bn";
  const [items, setItems] = useState<Announcement[]>([]);
  useEffect(() => {
    getPublicAnnouncements().then((r) => setItems(r.announcements)).catch(() => setItems([]));
  }, []);
  if (items.length === 0) return null;
  const place = (codes: string[]) =>
    codes.length === 0
      ? bn ? "সারা বাংলাদেশ" : "All of Bangladesh"
      : codes.map((c) => (bn ? DISTRICTS_BN[c] : null) || ALL_DISTRICTS.find((d) => d.pcode === c)?.name || c).join(", ");
  return (
    <section aria-labelledby="rk-ann-title" className="rounded-2xl border border-rk-line bg-white p-4 sm:p-5">
      <h2 id="rk-ann-title" className="flex items-center gap-2 text-base font-extrabold text-rk-forest">
        <Megaphone className="h-4 w-4 text-rk-brand" aria-hidden="true" />
        {bn ? "রক্ষা প্রশাসকদের ঘোষণা" : "Announcements from Rokkha administrators"}
      </h2>
      <p className="mt-0.5 text-xs text-rk-muted">
        {bn ? "সরকারি সতর্কবার্তা নয় এবং মডেলের পূর্বাভাসও নয়। সরকারি সতর্কবার্তা: ffwc.gov.bd" : "Not an official warning and not a model forecast. Official warnings: ffwc.gov.bd"}
      </p>
      <ul className="mt-3 space-y-3">
        {items.map((a) => (
          <li key={a.id} className={`rounded-xl border-l-4 bg-rk-page px-4 py-3 ${a.level === "important" ? "border-l-rk-warning-accent" : "border-l-rk-brand"}`}>
            <p className="font-bold text-rk-ink">{a.title}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-rk-ink">{a.body}</p>
            <p className="mt-1 text-xs text-rk-muted">
              {place(a.district_pcodes)} · {bn ? "প্রকাশ" : "published"} {formatDay(a.published_at.slice(0, 10), bn ? "bn" : "en")}
              {a.updated_at !== a.published_at ? (bn ? " · সংশোধিত" : " · corrected") : ""}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
};
