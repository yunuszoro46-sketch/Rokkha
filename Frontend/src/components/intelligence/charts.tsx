"use client";

// Small SVG charts for the Intelligence page. No chart library. Each chart has a text alternative (aria-label)
// and an equivalent data table for screen readers. Charts only draw values passed in from real files/APIs.

import React, { useMemo, useState } from "react";

const MONO = "var(--font-plex-mono), ui-monospace, monospace";

export interface BarRow {
  label: string;
  value: number;
  color?: string;
  note?: string;
  strong?: boolean;
}

/** Horizontal bars, values 0..max. */
export const HBars: React.FC<{ rows: BarRow[]; max?: number; format?: (v: number) => string; caption: string; dark?: boolean }> = ({
  rows,
  max,
  format = (v) => v.toFixed(3),
  caption,
  dark = false,
}) => {
  const m = max ?? Math.max(...rows.map((r) => r.value)) * 1.05;
  return (
    <figure className="m-0">
      <ul className="space-y-2.5" aria-hidden="true">
        {rows.map((r) => (
          <li key={r.label}>
            <div className={`flex items-baseline justify-between gap-3 text-[13px] ${dark ? "text-white/90" : "text-rk-ink"}`}>
              <span className={r.strong ? "font-bold" : ""}>{r.label}</span>
              <span className="shrink-0 whitespace-nowrap font-mono text-[12px]">{format(r.value)}</span>
            </div>
            <div className={`mt-1 h-2.5 rounded-full ${dark ? "bg-white/10" : "bg-rk-secondary"}`}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(1, (r.value / m) * 100)}%`, background: r.color || "#247A5B" }} />
            </div>
            {r.note && <p className={`mt-0.5 text-[11px] ${dark ? "text-white/60" : "text-rk-muted"}`}>{r.note}</p>}
          </li>
        ))}
      </ul>
      <div className="sr-only"><table>
        <caption>{caption}</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{format(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </figure>
  );
};

/** Reliability diagram: mean predicted probability (x) vs observed flood rate (y) per bin; dot size = days. */
export const Reliability: React.FC<{ bins: { bin: string; rows: number; mean_predicted: number; observed_rate: number }[]; caption: string }> = ({ bins, caption }) => {
  const W = 320;
  const H = 260;
  const P = { l: 40, r: 12, t: 12, b: 34 };
  const x = (v: number) => P.l + v * (W - P.l - P.r);
  const y = (v: number) => H - P.b - v * (H - P.t - P.b);
  const maxRows = Math.max(...bins.map((b) => b.rows));
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={caption}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={x(0)} x2={x(1)} y1={y(t)} y2={y(t)} stroke="#E0D8C8" />
            <text x={P.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="9.5" fill="#4F5F53" fontFamily={MONO}>{t}</text>
            <text x={x(t)} y={H - P.b + 14} textAnchor="middle" fontSize="9.5" fill="#4F5F53" fontFamily={MONO}>{t}</text>
          </g>
        ))}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="#71866A" strokeDasharray="4 4" />
        <text x={x(0.62)} y={y(0.7)} fontSize="9.5" fill="#71866A" transform={`rotate(-38 ${x(0.62)} ${y(0.7)})`}>perfectly calibrated</text>
        {bins.map((b) => (
          <g key={b.bin}>
            <circle cx={x(b.mean_predicted)} cy={y(b.observed_rate)} r={3 + 6 * Math.sqrt(b.rows / maxRows)} fill="#247A5B" fillOpacity=".55" stroke="#173D32" strokeWidth="1" />
          </g>
        ))}
        <text x={(x(0) + x(1)) / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="#344B45">predicted probability</text>
        <text x={10} y={(y(0) + y(1)) / 2} textAnchor="middle" fontSize="10" fill="#344B45" transform={`rotate(-90 10 ${(y(0) + y(1)) / 2})`}>observed flood rate</text>
      </svg>
      <div className="sr-only"><table>
        <caption>{caption}</caption>
        <thead>
          <tr><th>Bin</th><th>Days</th><th>Mean predicted</th><th>Observed rate</th></tr>
        </thead>
        <tbody>
          {bins.map((b) => (
            <tr key={b.bin}><td>{b.bin}</td><td>{b.rows}</td><td>{b.mean_predicted}</td><td>{b.observed_rate}</td></tr>
          ))}
        </tbody>
      </table></div>
    </figure>
  );
};

export interface FloodEvent { event_id: string; name: string; start: string; end: string; flooded_area_sqkm: number }

/** The UNOSAT flood events on a year axis; bar height = mapped flooded area. */
export const EventTimeline: React.FC<{ events: FloodEvent[]; caption: string }> = ({ events, caption }) => {
  const [hover, setHover] = useState<string | null>(null);
  const W = 640;
  const H = 210;
  const P = { l: 12, r: 12, t: 26, b: 30 };
  const y0 = 2016;
  const y1 = 2025;
  const t = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return d.getUTCFullYear() + d.getUTCMonth() / 12 + d.getUTCDate() / 365;
  };
  const x = (v: number) => P.l + ((v - y0) / (y1 - y0)) * (W - P.l - P.r);
  const max = Math.max(...events.map((e) => e.flooded_area_sqkm));
  const h = (a: number) => (a / max) * (H - P.t - P.b);
  const sel = events.find((e) => e.event_id === hover);
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="group" aria-label={caption} onPointerLeave={() => setHover(null)}>
        {Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i).map((yr) => (
          <g key={yr}>
            <line x1={x(yr)} x2={x(yr)} y1={P.t} y2={H - P.b} stroke="#FFFFFF" strokeOpacity=".08" />
            {yr < y1 && <text x={x(yr + 0.5)} y={H - P.b + 16} textAnchor="middle" fontSize="11" fill="#DCEBE5" fillOpacity=".8" fontFamily={MONO}>{yr}</text>}
          </g>
        ))}
        <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} stroke="#DCEBE5" strokeOpacity=".4" />
        {events.map((e) => {
          const cx = x((t(e.start) + t(e.end)) / 2);
          const bh = h(e.flooded_area_sqkm);
          return (
            <g key={e.event_id} onPointerEnter={() => setHover(e.event_id)} onFocus={() => setHover(e.event_id)} tabIndex={0} role="button" aria-label={`${e.name}, ${e.start} to ${e.end}, ${Math.round(e.flooded_area_sqkm).toLocaleString("en-GB")} square kilometres`}>
              <rect x={cx - 5} y={H - P.b - bh} width="10" height={bh} rx="2" fill={hover === e.event_id ? "#E9B949" : "#6FA9B5"} />
            </g>
          );
        })}
        {sel && (
          <text x={W / 2} y={16} textAnchor="middle" fontSize="12" fill="#F4F0E6" fontFamily={MONO}>
            {sel.name} · {sel.start} → {sel.end} · {Math.round(sel.flooded_area_sqkm).toLocaleString("en-GB")} km²
          </text>
        )}
      </svg>
      <div className="sr-only"><table>
        <caption>{caption}</caption>
        <thead><tr><th>Event</th><th>Start</th><th>End</th><th>Flooded area km²</th></tr></thead>
        <tbody>
          {events.map((e) => (<tr key={e.event_id}><td>{e.name}</td><td>{e.start}</td><td>{e.end}</td><td>{Math.round(e.flooded_area_sqkm)}</td></tr>))}
        </tbody>
      </table></div>
    </figure>
  );
};

/** Simple Bangladesh district map (equirectangular, cos-latitude) drawn from public/geo/districts.json. */
export const DistrictMap: React.FC<{
  fc: GeoJSON.FeatureCollection;
  fillFor: (pcode: string) => string;
  selected: string | null;
  onSelect: (pcode: string) => void;
  label: string;
}> = ({ fc, fillFor, selected, onSelect, label }) => {
  const paths = useMemo(() => {
    const k = Math.cos((23.7 * Math.PI) / 180);
    const [w, s, e, n] = [88.0, 20.55, 92.7, 26.65];
    const W = 460;
    const sc = W / ((e - w) * k);
    const H = (n - s) * sc;
    const pt = (c: number[]) => `${((c[0] - w) * k * sc).toFixed(1)},${((n - c[1]) * sc).toFixed(1)}`;
    const ring = (r: number[][]) => "M" + r.map(pt).join("L") + "Z";
    return {
      H,
      W,
      items: fc.features.map((f: any) => {
        const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
        return { pcode: f.properties.pcode, name: f.properties.name, d: polys.map((p: number[][][]) => p.map(ring).join("")).join("") };
      }),
    };
  }, [fc]);
  return (
    <svg viewBox={`0 0 ${paths.W} ${paths.H}`} className="w-full h-auto" role="group" aria-label={label}>
      {paths.items.map((it) => (
        <path
          key={it.pcode}
          d={it.d}
          fill={fillFor(it.pcode)}
          stroke={selected === it.pcode ? "#F4F0E6" : "#173D32"}
          strokeWidth={selected === it.pcode ? 2.2 : 0.6}
          className="cursor-pointer outline-none focus-visible:stroke-[#E9B949]"
          tabIndex={0}
          role="button"
          aria-label={it.name}
          aria-pressed={selected === it.pcode}
          onClick={() => onSelect(it.pcode)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              onSelect(it.pcode);
            }
          }}
        />
      ))}
    </svg>
  );
};

// ======================================================================================
// Research-grade chart kit: frame with provenance, multi-series lines, scatter, reliability by period.
// ======================================================================================

export type DataKind = "evaluation" | "observation" | "model-output";
const KIND_TEXT: Record<DataKind, string> = { evaluation: "Evaluation result", observation: "Observation", "model-output": "Model output" };

/** Every chart answers: what, units, period, source, kind, how to read, what to conclude, limitations. */
export const ChartFrame: React.FC<{
  id: string;
  title: string;
  kind: DataKind;
  measures: string;
  units: string;
  period: string;
  source: string;
  howToRead?: string;
  takeaway: string;
  limits?: string;
  controls?: React.ReactNode;
  dark?: boolean;
  children: React.ReactNode;
}> = ({ id, title, kind, measures, units, period, source, howToRead, takeaway, limits, controls, dark, children }) => (
  <figure aria-labelledby={`${id}-t`} className={`m-0 rounded-2xl border p-5 ${dark ? "border-white/15 bg-white/5 text-white" : "border-rk-line bg-rk-surface"}`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h3 id={`${id}-t`} className={`text-lg font-extrabold ${dark ? "text-white" : "text-rk-forest"}`}>{title}</h3>
      <span className={`rounded-full px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider ${kind === "evaluation" ? "bg-rk-warning-soft text-rk-warning" : kind === "observation" ? "bg-rk-info-soft text-rk-info" : "bg-rk-brand-soft text-rk-brand-strong"}`}>{KIND_TEXT[kind]}</span>
    </div>
    <dl className={`mt-2 grid gap-x-4 gap-y-0.5 text-[12px] sm:grid-cols-2 ${dark ? "text-white/75" : "text-rk-muted"}`}>
      <div><dt className="inline font-semibold">Measures: </dt><dd className="inline">{measures}</dd></div>
      <div><dt className="inline font-semibold">Units: </dt><dd className="inline">{units}</dd></div>
      <div><dt className="inline font-semibold">Period: </dt><dd className="inline">{period}</dd></div>
      <div><dt className="inline font-semibold">Source: </dt><dd className="inline">{source}</dd></div>
    </dl>
    {controls && <div className="mt-3">{controls}</div>}
    <div className="mt-3">{children}</div>
    <p className={`mt-3 border-l-2 pl-3 text-[13.5px] ${dark ? "border-rk-warning-accent text-white/90" : "border-rk-brand text-rk-ink"}`}><strong>What to take from it: </strong>{takeaway}</p>
    {(howToRead || limits) && (
      <details className="mt-2">
        <summary className={`cursor-pointer text-[13px] font-semibold ${dark ? "text-rk-mist" : "text-rk-brand-strong"}`}>How to read this chart and its limits</summary>
        <div className={`mt-1.5 space-y-1 text-[13px] ${dark ? "text-white/80" : "text-rk-ink"}`}>
          {howToRead && <p>{howToRead}</p>}
          {limits && <p><strong>Limits: </strong>{limits}</p>}
        </div>
      </details>
    )}
  </figure>
);

export interface Series {
  id: string;
  label: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
}

/** Toggleable legend: each entry really shows/hides its series. */
export const Legend: React.FC<{ series: Series[]; hidden: Set<string>; onToggle: (id: string) => void; dark?: boolean }> = ({ series, hidden, onToggle, dark }) => (
  <div role="group" aria-label="Series shown" className="flex flex-wrap gap-1.5">
    {series.map((s) => (
      <button
        key={s.id}
        type="button"
        aria-pressed={!hidden.has(s.id)}
        onClick={() => onToggle(s.id)}
        className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold ${hidden.has(s.id) ? (dark ? "border-white/15 text-white/45 line-through" : "border-rk-line text-rk-muted line-through") : dark ? "border-white/30 text-white" : "border-rk-line text-rk-ink"}`}
      >
        <span aria-hidden="true" className="inline-block h-0.5 w-4" style={{ background: s.dashed ? `repeating-linear-gradient(90deg, ${s.color} 0 4px, transparent 4px 7px)` : s.color }} />
        {s.label}
      </button>
    ))}
  </div>
);

/** Multi-series line chart over categorical x positions, with bands, annotations, direct labels and a hover readout. */
export const LineChart: React.FC<{
  xLabels: string[];
  /** Full labels for the readout and the data table (defaults to xLabels). */
  fullLabels?: string[];
  series: Series[];
  hidden: Set<string>;
  yMin?: number;
  yMax: number;
  yTicks: number[];
  yLabel: string;
  format?: (v: number) => string;
  bands?: { from: number; to: number; label: string; color: string }[];
  notes?: { x: number; text: string }[];
  xTickEvery?: number;
  caption: string;
  height?: number;
  dark?: boolean;
}> = ({ xLabels, fullLabels, series, hidden, yMin = 0, yMax, yTicks, yLabel, format = (v) => String(v), bands = [], notes = [], xTickEvery = 1, caption, height = 280, dark }) => {
  const [hover, setHover] = useState<number | null>(null);
  const W = 680;
  const H = height;
  const P = { l: 48, r: 118, t: 24, b: 40 };
  const n = xLabels.length;
  const x = (i: number) => P.l + (n === 1 ? 0.5 : i / (n - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - yMin) / (yMax - yMin)) * (H - P.t - P.b);
  const ink = dark ? "#DCEBE5" : "#344B45";
  const grid = dark ? "rgba(255,255,255,0.12)" : "#E0D8C8";
  const shown = series.filter((s) => !hidden.has(s.id));
  const path = (vals: (number | null)[]) => {
    let d = "";
    let pen = false;
    vals.forEach((v, i) => {
      if (v == null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };
  // Direct labels at each series' last value, nudged apart.
  const ends = shown
    .map((s) => { const i = s.values.map((v, k) => (v == null ? -1 : k)).filter((k) => k >= 0).pop(); return i == null || i < 0 ? null : { s, i, yy: y(s.values[i] as number) }; })
    .filter(Boolean) as { s: Series; i: number; yy: number }[];
  ends.sort((a, b) => a.yy - b.yy);
  for (let k = 1; k < ends.length; k++) if (ends[k].yy - ends[k - 1].yy < 13) ends[k].yy = ends[k - 1].yy + 13;
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto touch-none select-none"
        role="img"
        aria-label={caption}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - P.l) / (W - P.l - P.r)) * (n - 1));
          setHover(i >= 0 && i < n ? i : null);
        }}
      >
        {bands.map((b) => (
          <g key={b.label}>
            <rect x={x(b.from) - (n > 1 ? (W - P.l - P.r) / (n - 1) / 2 : 0)} y={P.t} width={Math.max(4, x(b.to) - x(b.from) + (n > 1 ? (W - P.l - P.r) / (n - 1) : 0))} height={H - P.t - P.b} fill={b.color} />
            <text x={(x(b.from) + x(b.to)) / 2} y={P.t - 8} textAnchor="middle" fontSize="10" fill={ink} fontFamily={MONO}>{b.label}</text>
          </g>
        ))}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke={grid} />
            <text x={P.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill={ink} fontFamily={MONO}>{format(t)}</text>
          </g>
        ))}
        <text x={12} y={(P.t + H - P.b) / 2} textAnchor="middle" fontSize="10.5" fill={ink} transform={`rotate(-90 12 ${(P.t + H - P.b) / 2})`}>{yLabel}</text>
        {xLabels.map((l, i) => (i % xTickEvery === 0 ? <text key={i} x={x(i)} y={H - P.b + 16} textAnchor="middle" fontSize="10" fill={ink} fontFamily={MONO}>{l}</text> : null))}
        {notes.map((nt, k) => {
          const nearEnd = x(nt.x) > W - P.r - 120;
          return (
            <g key={nt.text}>
              <line x1={x(nt.x)} x2={x(nt.x)} y1={P.t} y2={H - P.b} stroke={dark ? "#E9B949" : "#B87955"} strokeDasharray="3 3" />
              <text x={nearEnd ? x(nt.x) - 4 : x(nt.x) + 4} y={P.t + 12 + k * 14} textAnchor={nearEnd ? "end" : "start"} fontSize="10" fill={dark ? "#E9B949" : "#8E5434"}>{nt.text}</text>
            </g>
          );
        })}
        {shown.map((s) => (
          <g key={s.id}>
            <path d={path(s.values)} fill="none" stroke={s.color} strokeWidth="2.2" strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" />
            {n <= 12 && s.values.map((v, i) => (v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r="3.6" fill={s.color} stroke={dark ? "#173D32" : "#FFFFFF"} strokeWidth="1.5" />))}
          </g>
        ))}
        {ends.map((e) => (
          <text key={e.s.id} x={x(e.i) + 8} y={e.yy + 3.5} fontSize="11" fontWeight="600" fill={e.s.color}>{e.s.label}</text>
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke={ink} strokeOpacity=".4" />}
      </svg>
      <p className={`min-h-[20px] font-mono text-[12px] ${dark ? "text-white/85" : "text-rk-ink"}`} aria-live="polite">
        {hover != null
          ? `${(fullLabels ?? xLabels)[hover] || "—"} — ` + shown.map((s) => `${s.label}: ${s.values[hover] == null ? "not measured" : format(s.values[hover] as number)}`).join(" · ")
          : "Move over the chart to read exact values."}
      </p>
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead><tr><th>Period</th>{series.map((s) => <th key={s.id}>{s.label}</th>)}</tr></thead>
          <tbody>{(fullLabels ?? xLabels).map((l, i) => <tr key={l + i}><td>{l}</td>{series.map((s) => <td key={s.id}>{s.values[i] == null ? "not measured" : format(s.values[i] as number)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
};

export interface ScatterPoint { id: string; label: string; x: number; y: number; color: string; group: string }

/** Precision (y) vs recall (x) of yes/no warning rules; each point is one rule measured on one period. */
export const Scatter: React.FC<{ points: ScatterPoint[]; hidden: Set<string>; caption: string }> = ({ points, hidden, caption }) => {
  const [hover, setHover] = useState<string | null>(null);
  const W = 520;
  const H = 360;
  const P = { l: 48, r: 16, t: 16, b: 44 };
  const x = (v: number) => P.l + v * (W - P.l - P.r);
  const y = (v: number) => H - P.b - v * (H - P.t - P.b);
  const shown = points.filter((p) => !hidden.has(p.group));
  const sel = shown.find((p) => p.id === hover);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="group" aria-label={caption}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={x(0)} x2={x(1)} y1={y(t)} y2={y(t)} stroke="#E0D8C8" />
            <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(1)} stroke="#E0D8C8" />
            <text x={P.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#4F5F53" fontFamily={MONO}>{t}</text>
            <text x={x(t)} y={H - P.b + 15} textAnchor="middle" fontSize="10" fill="#4F5F53" fontFamily={MONO}>{t}</text>
          </g>
        ))}
        <text x={(x(0) + x(1)) / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#344B45">recall — share of floods that got a warning</text>
        <text x={12} y={(y(0) + y(1)) / 2} textAnchor="middle" fontSize="11" fill="#344B45" transform={`rotate(-90 12 ${(y(0) + y(1)) / 2})`}>precision — share of warnings that were right</text>
        <text x={x(0.98)} y={y(0.96)} textAnchor="end" fontSize="10" fill="#71866A">better ↗</text>
        {shown.map((p) => (
          <g key={p.id} tabIndex={0} role="button" aria-label={`${p.label}: recall ${p.x.toFixed(2)}, precision ${p.y.toFixed(2)}`} onPointerEnter={() => setHover(p.id)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(p.id)} onBlur={() => setHover(null)}>
            <circle cx={x(p.x)} cy={y(p.y)} r={hover === p.id ? 8 : 6} fill={p.color} stroke="#173D32" strokeWidth="1.2" />
            <text x={p.x > 0.8 ? x(p.x) - 9 : x(p.x) + 9} y={y(p.y) - 7} textAnchor={p.x > 0.8 ? "end" : "start"} fontSize="10.5" fill="#344B45">{p.label}</text>
          </g>
        ))}
      </svg>
      <p className="min-h-[20px] font-mono text-[12px] text-rk-ink" aria-live="polite">{sel ? `${sel.label}: recall ${sel.x.toFixed(3)} · precision ${sel.y.toFixed(3)}` : "Hover or focus a point to read its values."}</p>
      <div className="sr-only"><table><caption>{caption}</caption><tbody>{points.map((p) => <tr key={p.id}><td>{p.label}</td><td>recall {p.x}</td><td>precision {p.y}</td></tr>)}</tbody></table></div>
    </div>
  );
};

/** Reliability for several periods: dot size = days in the bin; legend toggles periods; hover reads a bin. */
export const ReliabilityMulti: React.FC<{ sets: { id: string; label: string; color: string; bins: { bin: string; rows: number; mean_predicted: number; observed_rate: number }[] }[]; hidden: Set<string>; caption: string }> = ({ sets, hidden, caption }) => {
  const [hover, setHover] = useState<string | null>(null);
  const W = 360;
  const H = 300;
  const P = { l: 44, r: 12, t: 12, b: 40 };
  const x = (v: number) => P.l + v * (W - P.l - P.r);
  const y = (v: number) => H - P.b - v * (H - P.t - P.b);
  const maxRows = Math.max(...sets.flatMap((s) => s.bins.map((b) => b.rows)));
  const all = sets.filter((s) => !hidden.has(s.id)).flatMap((s) => s.bins.map((b) => ({ ...b, set: s })));
  const sel = all.find((b) => `${b.set.id}-${b.bin}` === hover);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="group" aria-label={caption}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={x(0)} x2={x(1)} y1={y(t)} y2={y(t)} stroke="#E0D8C8" />
            <text x={P.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#4F5F53" fontFamily={MONO}>{t}</text>
            <text x={x(t)} y={H - P.b + 15} textAnchor="middle" fontSize="10" fill="#4F5F53" fontFamily={MONO}>{t}</text>
          </g>
        ))}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="#71866A" strokeDasharray="4 4" />
        <text x={x(0.55)} y={y(0.62)} fontSize="10" fill="#71866A" transform={`rotate(-40 ${x(0.55)} ${y(0.62)})`}>perfect calibration</text>
        {all.map((b) => (
          <circle
            key={`${b.set.id}-${b.bin}`}
            cx={x(b.mean_predicted)}
            cy={y(b.observed_rate)}
            r={3 + 6 * Math.sqrt(b.rows / maxRows)}
            fill={b.set.color}
            fillOpacity=".6"
            stroke="#173D32"
            strokeWidth={hover === `${b.set.id}-${b.bin}` ? 2.5 : 1}
            tabIndex={0}
            role="button"
            aria-label={`${b.set.label}, bin ${b.bin}: ${b.rows} days, mean predicted ${b.mean_predicted}, observed ${b.observed_rate}`}
            onPointerEnter={() => setHover(`${b.set.id}-${b.bin}`)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(`${b.set.id}-${b.bin}`)}
            onBlur={() => setHover(null)}
          />
        ))}
        <text x={(x(0) + x(1)) / 2} y={H - 6} textAnchor="middle" fontSize="10.5" fill="#344B45">mean predicted probability in the bin</text>
        <text x={10} y={(y(0) + y(1)) / 2} textAnchor="middle" fontSize="10.5" fill="#344B45" transform={`rotate(-90 10 ${(y(0) + y(1)) / 2})`}>share that really flooded</text>
      </svg>
      <p className="min-h-[20px] font-mono text-[12px] text-rk-ink" aria-live="polite">{sel ? `${sel.set.label} · bin ${sel.bin}: ${sel.rows} district-days, predicted ${sel.mean_predicted}, observed ${sel.observed_rate}` : "Hover or focus a dot to read the bin."}</p>
      <div className="sr-only"><table><caption>{caption}</caption><tbody>{all.map((b) => <tr key={`${b.set.id}-${b.bin}`}><td>{b.set.label}</td><td>{b.bin}</td><td>{b.rows}</td><td>{b.mean_predicted}</td><td>{b.observed_rate}</td></tr>)}</tbody></table></div>
    </div>
  );
};
