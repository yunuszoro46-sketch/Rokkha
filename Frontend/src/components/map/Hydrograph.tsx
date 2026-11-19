"use client";

import React, { useMemo, useState } from "react";
import type { FlowPoint } from "./riverStations";

// Daily river flow chart. Modelled history solid, forecast dashed (only if forecast values exist),
// a vertical line at the last modelled-history day, the 30-day "usual" level dotted. Missing days are gaps:
// the line is never drawn across them. Hover/tap shows the value of one day.

interface Props {
  series: FlowPoint[];
  usual: number | null;
  bn: boolean;
  days?: number;
}

const W = 340;
const H = 150;
const PAD = { l: 44, r: 10, t: 10, b: 24 };

export const Hydrograph: React.FC<Props> = ({ series, usual, bn, days = 90 }) => {
  const tr = (en: string, b: string) => (bn ? b : en);
  const [hover, setHover] = useState<number | null>(null);
  const pts = useMemo(() => series.slice(-days), [series, days]);
  const vals = pts.map((p) => p.value).filter((v): v is number => v != null);
  if (pts.length < 2 || vals.length < 2) {
    return <p className="text-[13px] text-rk-muted">{tr("Not enough values to draw a chart.", "চার্ট আঁকার মতো যথেষ্ট মান নেই।")}</p>;
  }
  const max = Math.max(...vals, usual ?? 0) * 1.08;
  const min = 0;
  const x = (i: number) => PAD.l + (i / (pts.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);

  // Separate path segments: break at missing values and at the observed → forecast change.
  const segments: { d: string; forecast: boolean }[] = [];
  let cur: string[] = [];
  let curForecast = false;
  pts.forEach((p, i) => {
    if (p.value == null || (cur.length && p.forecast !== curForecast)) {
      if (cur.length > 1) segments.push({ d: cur.join(" "), forecast: curForecast });
      cur = [];
    }
    if (p.value != null) {
      if (!cur.length) curForecast = p.forecast;
      cur.push(`${cur.length ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`);
    }
  });
  if (cur.length > 1) segments.push({ d: cur.join(" "), forecast: curForecast });

  const lastObs = pts.map((p, i) => ({ p, i })).filter(({ p }) => !p.forecast && p.value != null).pop();
  const hasForecast = pts.some((p) => p.forecast && p.value != null);
  const ticks = [0, 0.5, 1].map((f) => Math.round((max * f) / 10) * 10);
  const dateLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(bn ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const fmt = (v: number) => (bn ? Math.round(v).toLocaleString("bn-BD") : Math.round(v).toLocaleString("en-GB"));
  const h = hover != null ? pts[hover] : null;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto touch-none select-none"
        role="img"
        aria-label={tr(
          `River flow for the last ${pts.length} days, from ${dateLabel(pts[0].date)} to ${dateLabel(pts[pts.length - 1].date)}; latest ${lastObs ? fmt(lastObs.p.value as number) : "—"} cubic metres per second.`,
          `গত ${pts.length} দিনের নদী-প্রবাহ; সর্বশেষ ${lastObs ? fmt(lastObs.p.value as number) : "—"} ঘনমিটার/সেকেন্ড।`
        )}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (pts.length - 1));
          setHover(Math.max(0, Math.min(pts.length - 1, i)));
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#E0D8C8" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="9.5" fill="#4F5F53" fontFamily="var(--font-plex-mono), monospace">{fmt(t)}</text>
          </g>
        ))}
        {usual != null && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(usual)} y2={y(usual)} stroke="#71866A" strokeDasharray="2 3" strokeWidth="1.2" />
          </g>
        )}
        {lastObs && hasForecast && <line x1={x(lastObs.i)} x2={x(lastObs.i)} y1={PAD.t} y2={H - PAD.b} stroke="#173D32" strokeOpacity=".35" strokeDasharray="3 3" />}
        {segments.map((s, k) => (
          <path key={k} d={s.d} fill="none" stroke={s.forecast ? "#B87955" : "#2C6573"} strokeWidth="2" strokeDasharray={s.forecast ? "5 4" : undefined} strokeLinejoin="round" />
        ))}
        {lastObs && <circle cx={x(lastObs.i)} cy={y(lastObs.p.value as number)} r="3.5" fill="#2C6573" stroke="#FFFFFF" strokeWidth="1.5" />}
        <text x={PAD.l} y={H - 6} fontSize="9.5" fill="#4F5F53" fontFamily="var(--font-plex-mono), monospace">{dateLabel(pts[0].date)}</text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize="9.5" fill="#4F5F53" fontFamily="var(--font-plex-mono), monospace">{dateLabel(pts[pts.length - 1].date)}</text>
        {h && hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#173D32" strokeOpacity=".5" />
            {h.value != null && <circle cx={x(hover)} cy={y(h.value)} r="3" fill="#173D32" />}
          </g>
        )}
      </svg>
      <figcaption className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-rk-muted">
        <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="inline-block h-0.5 w-4 bg-[#2C6573]" />{tr("Modelled flow (m³/s)", "মডেলের প্রবাহ (ঘনমি/সে)")}</span>
        {hasForecast && <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="inline-block w-4 border-t-2 border-dashed border-[#B87955]" />{tr("Forecast", "পূর্বাভাস")}</span>}
        {usual != null && <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="inline-block w-4 border-t-2 border-dotted border-[#71866A]" />{tr("Usual (30-day mean)", "স্বাভাবিক (৩০ দিনের গড়)")}</span>}
        <span className="font-mono" aria-live="polite">
          {h ? `${dateLabel(h.date)}: ${h.value != null ? fmt(h.value) + " m³/s" : tr("no value", "মান নেই")}${h.forecast ? tr(" (forecast)", " (পূর্বাভাস)") : ""}` : ""}
        </span>
      </figcaption>
      {!hasForecast && <p className="mt-1 text-[12px] text-rk-muted">{tr("No river-flow forecast is stored for this site, so the chart ends at the last modelled day.", "এই স্থানের নদী-প্রবাহের পূর্বাভাস সংরক্ষিত নেই; চার্ট সর্বশেষ দিনে শেষ।")}</p>}
    </figure>
  );
};
