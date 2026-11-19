"use client";

// Small building blocks shared by the Admin Control Centre sections. They use the existing Rokkha
// tokens and the existing Radix dialog; nothing here invents data.
import React, { useState } from "react";
import { AlertTriangle, Info, Loader2, RotateCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";

export const fmtTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
export const fmtDay = (iso?: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
export const ago = (iso?: string | null) => {
  if (!iso) return "—";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
};

export const PageHeader: React.FC<{ title: string; lead?: React.ReactNode; actions?: React.ReactNode }> = ({ title, lead, actions }) => (
  <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <h1 className="text-2xl font-extrabold tracking-tight text-rk-forest">{title}</h1>
      {lead && <p className="mt-1 max-w-3xl text-sm text-rk-muted">{lead}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </header>
);

export const Section: React.FC<{ title: string; id?: string; aside?: React.ReactNode; children: React.ReactNode; note?: React.ReactNode }> = ({ title, id, aside, children, note }) => (
  <section aria-labelledby={id} className="min-w-0 rounded-2xl border border-rk-line bg-white">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rk-line px-4 py-3 sm:px-5">
      <h2 id={id} className="text-base font-extrabold text-rk-forest">{title}</h2>
      {aside}
    </div>
    <div className="p-4 sm:p-5">{children}</div>
    {note && <p className="border-t border-rk-line px-4 py-2.5 text-xs text-rk-muted sm:px-5">{note}</p>}
  </section>
);

const TONE: Record<string, string> = {
  healthy: "bg-rk-success-soft text-rk-success",
  up: "bg-rk-success-soft text-rk-success",
  completed: "bg-rk-success-soft text-rk-success",
  success: "bg-rk-success-soft text-rk-success",
  active: "bg-rk-success-soft text-rk-success",
  published: "bg-rk-success-soft text-rk-success",
  delayed: "bg-rk-warning-soft text-rk-warning",
  paused_budget: "bg-rk-warning-soft text-rk-warning",
  running: "bg-rk-info-soft text-rk-info",
  queued: "bg-rk-info-soft text-rk-info",
  failing: "bg-rk-danger-soft text-rk-danger",
  failed: "bg-rk-danger-soft text-rk-danger",
  down: "bg-rk-danger-soft text-rk-danger",
  denied: "bg-rk-danger-soft text-rk-danger",
  suspended: "bg-rk-danger-soft text-rk-danger",
  unknown: "bg-rk-secondary text-rk-muted",
  fixed: "bg-rk-secondary text-rk-ink",
  withdrawn: "bg-rk-secondary text-rk-muted",
};
const STATUS_TEXT: Record<string, string> = {
  healthy: "Up to date", delayed: "Delayed", failing: "Last run failed", unknown: "No data stored", fixed: "Fixed dataset",
  paused_budget: "Paused (call budget)", up: "Up", down: "Down",
};

/** Status chip: colour plus a word, never colour alone. */
export const StatusPill: React.FC<{ status: string; label?: string }> = ({ status, label }) => (
  <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[status] || "bg-rk-secondary text-rk-ink"}`}>
    {label || STATUS_TEXT[status] || status.replace(/_/g, " ")}
  </span>
);

/** A number with its definition: what is counted, from where. */
export const Metric: React.FC<{ label: string; value: React.ReactNode; definition: string; tone?: "default" | "attention" }> = ({ label, value, definition, tone = "default" }) => (
  <div className={`rounded-xl border p-4 ${tone === "attention" ? "border-rk-warning-accent/60 bg-rk-warning-soft/40" : "border-rk-line bg-rk-surface"}`}>
    <dt className="text-xs font-semibold uppercase tracking-wide text-rk-muted">{label}</dt>
    <dd className="mt-1 font-mono text-2xl font-bold text-rk-forest">{value}</dd>
    <dd className="mt-1 text-xs leading-snug text-rk-muted">{definition}</dd>
  </div>
);

export const Loading: React.FC<{ what: string }> = ({ what }) => (
  <p role="status" className="flex items-center gap-2 py-8 text-sm text-rk-muted">
    <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> Loading {what}…
  </p>
);

export const Failed: React.FC<{ what: string; message?: string; onRetry?: () => void }> = ({ what, message, onRetry }) => (
  <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-rk-danger-accent/40 bg-rk-danger-soft px-4 py-3 text-sm text-rk-danger">
    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
    <span className="font-semibold">Could not load {what}.</span>
    {message && <span className="text-rk-ink">{message}</span>}
    {onRetry && (
      <button type="button" onClick={onRetry} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-rk-line bg-white px-3 font-semibold text-rk-forest hover:bg-rk-secondary">
        <RotateCw className="h-4 w-4" aria-hidden="true" /> Try again
      </button>
    )}
  </div>
);

export const Empty: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-xl border border-dashed border-rk-line bg-rk-page px-4 py-6 text-center">
    <Info className="mx-auto h-5 w-5 text-rk-muted" aria-hidden="true" />
    <p className="mt-2 text-sm font-semibold text-rk-ink">{title}</p>
    {children && <p className="mx-auto mt-1 max-w-xl text-sm text-rk-muted">{children}</p>}
  </div>
);

export const Notice: React.FC<{ tone: "ok" | "error"; children: React.ReactNode }> = ({ tone, children }) => (
  <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${tone === "error" ? "border-rk-danger-accent/40 bg-rk-danger-soft text-rk-danger" : "border-rk-success/40 bg-rk-success-soft text-rk-success"}`}>
    {children}
  </div>
);

export const btn = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rk-brand focus-visible:ring-offset-2 disabled:opacity-50";
export const btnPrimary = `${btn} bg-rk-brand text-white hover:bg-rk-brand-strong`;
export const btnQuiet = `${btn} border border-rk-line bg-white text-rk-forest hover:bg-rk-secondary`;
export const btnDanger = `${btn} border border-rk-danger-accent/50 bg-white text-rk-danger hover:bg-rk-danger-soft`;
export const field = "h-10 w-full rounded-lg border border-rk-line bg-white px-3 text-sm text-rk-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rk-brand";

/**
 * Confirmation for an administrative change. A written reason is required whenever the action is
 * recorded in the audit log with a reason (suspension, intervention, withdrawal, correction).
 */
export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  needReason?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
  children?: React.ReactNode;
}> = ({ open, title, description, confirmLabel, danger, needReason = true, onCancel, onConfirm, children }) => {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = !needReason || reason.trim().length >= 3;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && (setReason(""), setError(null), onCancel())}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-lg font-extrabold text-rk-forest">{title}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-rk-ink">{description}</DialogDescription>
        {children}
        {needReason && (
          <label className="mt-4 block text-sm font-semibold text-rk-ink">
            Reason (kept in the audit log)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              rows={3}
              required
              className="mt-1 w-full rounded-lg border border-rk-line bg-white p-2.5 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rk-brand"
            />
            <span className="text-xs font-normal text-rk-muted">At least 3 characters. Do not include personal contact details.</span>
          </label>
        )}
        {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className={btnQuiet} disabled={busy} onClick={() => (setReason(""), setError(null), onCancel())}>Cancel</button>
          <button
            type="button"
            className={danger ? `${btn} bg-rk-danger text-white hover:bg-rk-danger/90` : btnPrimary}
            disabled={!ok || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onConfirm(reason.trim());
                setReason("");
              } catch (e) {
                setError((e as Error).message || "The change was not saved.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />} {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Accessible vertical bar chart for daily counts. Title, units, period and source are given by the
 * caller; a table alternative is always rendered for screen readers.
 */
export const DailyBars: React.FC<{
  title: string;
  unit: string;
  source: string;
  days: string[];
  series: Array<{ key: string; label: string; color: string; values: number[] }>;
  missing?: boolean[];
}> = ({ title, unit, source, days, series, missing }) => {
  const [hover, setHover] = useState<number | null>(null);
  const W = 520, H = 170, L = 30, B = 22, T = 8;
  const totals = days.map((_, i) => series.reduce((s, x) => s + (x.values[i] || 0), 0));
  const max = Math.max(1, ...totals);
  const step = (W - L - 4) / days.length;
  const bw = Math.max(2, step * 0.7);
  const y = (v: number) => H - B - (v / max) * (H - B - T);
  const ticks = [0, Math.ceil(max / 2), max];
  const sum = series.map((s) => s.values.reduce((a, b) => a + b, 0));
  return (
    // relative: keeps the screen-reader table (sr-only, absolutely positioned) inside the chart's box.
    <figure className="relative">
      <figcaption className="text-sm font-semibold text-rk-forest">
        {title} <span className="font-normal text-rk-muted">· {unit} per day · {fmtDay(days[0])} – {fmtDay(days[days.length - 1])} (Bangladesh time)</span>
      </figcaption>
      <ul className="mt-1 flex flex-wrap gap-3 text-xs text-rk-ink">
        {series.map((s, i) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /> {s.label} ({sum[i]})
          </li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full" role="group" aria-label={`${title}, ${days.length} days`} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="#E0D8C8" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="12" fill="#4F5F53">{t}</text>
          </g>
        ))}
        {days.map((d, i) => {
          let acc = 0;
          const x = L + i * step + (step - bw) / 2;
          return (
            <g key={d} onPointerEnter={() => setHover(i)}>
              <rect x={L + i * step} y={T} width={step} height={H - B - T} fill="transparent" />
              {missing?.[i] ? (
                <rect x={x} y={H - B - 3} width={bw} height={3} fill="#C9C5BA" />
              ) : (
                series.map((s) => {
                  const v = s.values[i] || 0;
                  const top = y(acc + v);
                  const r = <rect key={s.key} x={x} y={top} width={bw} height={y(acc) - top} fill={s.color} />;
                  acc += v;
                  return r;
                })
              )}
              {(i === 0 || i === days.length - 1 || i % Math.ceil(days.length / 6) === 0) && (
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="12" fill="#4F5F53">{fmtDay(d).replace(/ \d{4}$/, "")}</text>
              )}
            </g>
          );
        })}
        {hover != null && <rect x={L + hover * step} y={T} width={step} height={H - B - T} fill="#173D32" opacity={0.06} pointerEvents="none" />}
      </svg>
      <p className="min-h-5 text-xs text-rk-ink" aria-live="polite">
        {hover != null
          ? `${fmtDay(days[hover])}: ${missing?.[hover] ? "no record for this day" : series.map((s) => `${s.label} ${s.values[hover] || 0}`).join(" · ")}`
          : "Point at a day to read its values."}
      </p>
      <p className="text-xs text-rk-muted">Source: {source}</p>
      {/* sr-only on a wrapper: a table ignores sr-only's 1px width and would widen the page. */}
      <div className="sr-only">
      <table>
        <caption>{title}</caption>
        <thead><tr><th>Day</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
        <tbody>{days.map((d, i) => <tr key={d}><td>{d}</td>{series.map((s) => <td key={s.key}>{missing?.[i] ? "no record" : s.values[i] || 0}</td>)}</tr>)}</tbody>
      </table>
      </div>
    </figure>
  );
};
