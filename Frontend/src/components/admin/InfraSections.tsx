"use client";

import React, { useCallback, useEffect, useState } from "react";
import { DataSource, getDataSources, getIngestionRuns, getSystemHealth, IngestionRun, SystemHealth } from "../../services/admin";
import { getModelStatus } from "../../services/api";
import { AccountUser } from "../../services/auth";
import { Empty, Failed, Loading, Metric, PageHeader, Section, StatusPill, btnQuiet, field, fmtDay, fmtTime } from "./ui";

const KINDS = ["rain_history", "rain_recent", "rain_forecast", "river_history", "river_forecast"];

export const DataSourcesSection: React.FC = () => {
  const [sources, setSources] = useState<{ sources: DataSource[]; status_rule: string; checked_at: string } | null>(null);
  const [runs, setRuns] = useState<IngestionRun[] | null>(null);
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getDataSources().then(setSources).catch((e) => setError((e as Error).message));
  }, []);
  const loadRuns = useCallback(() => {
    getIngestionRuns({ kind, status, limit: 50 }).then((r) => setRuns(r.runs)).catch((e) => setError((e as Error).message));
  }, [kind, status]);
  useEffect(load, [load]);
  useEffect(loadRuns, [loadRuns]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Data sources"
        lead="The sources Rokkha really uses, the newest data stored from each, and the ingestion runs that brought it. This page reads the data; it cannot change forecasts, observations or the model."
        actions={<button type="button" className={btnQuiet} onClick={() => (load(), loadRuns())}>Refresh</button>}
      />
      {error && <Failed what="the data sources" message={error} onRetry={load} />}
      {!sources && !error && <Loading what="data sources" />}
      {sources && (
        <Section title="Source directory" id="ds-list" note={<>How status is decided: {sources.status_rule} Checked {fmtTime(sources.checked_at)}.</>}>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-rk-muted">
                <tr><th className="py-2 pr-3 font-semibold">Source</th><th className="py-2 pr-3 font-semibold">Category</th><th className="py-2 pr-3 font-semibold">Updates</th><th className="py-2 pr-3 font-semibold">Newest data</th><th className="py-2 pr-3 font-semibold">Last run</th><th className="py-2 pr-3 font-semibold">Status</th><th className="py-2"><span className="sr-only">Details</span></th></tr>
              </thead>
              <tbody className="divide-y divide-rk-line align-top">
                {sources.sources.map((s) => (
                  <React.Fragment key={s.id}>
                    <tr>
                      <td className="py-2 pr-3"><span className="font-semibold text-rk-ink">{s.name}</span><span className="block text-xs text-rk-muted">{s.provider}</span></td>
                      <td className="py-2 pr-3">{s.category}</td>
                      <td className="py-2 pr-3 text-xs">{s.frequency}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{s.latest_data ? fmtDay(s.latest_data) : "—"}{s.age_days != null && <span className="block text-xs text-rk-muted">{s.age_days} day{s.age_days === 1 ? "" : "s"} old</span>}</td>
                      <td className="py-2 pr-3 text-xs">
                        {s.last_success ? <>OK {fmtTime(s.last_success.finished_at || s.last_success.started_at)}</> : s.kind === "fixed" ? "—" : ["gfm", "model"].includes(s.id) ? "Daily update job (not logged as a run)" : "No run recorded"}
                        {s.last_failure && <span className="block text-rk-danger">Failed {fmtTime(s.last_failure.started_at)}</span>}
                      </td>
                      <td className="py-2 pr-3"><StatusPill status={s.status} /></td>
                      <td className="py-2"><button type="button" className={btnQuiet} aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>{open === s.id ? "Hide" : "Details"}</button></td>
                    </tr>
                    {open === s.id && (
                      <tr className="bg-rk-page">
                        <td colSpan={7} className="px-3 py-3">
                          <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                            <div><dt className="text-xs text-rk-muted">Coverage</dt><dd>{s.coverage}</dd></div>
                            <div><dt className="text-xs text-rk-muted">Format</dt><dd>{s.format}</dd></div>
                            <div><dt className="text-xs text-rk-muted">Attribution</dt><dd>{s.attribution}</dd></div>
                            <div><dt className="text-xs text-rk-muted">Limitations</dt><dd>{s.limitations}</dd></div>
                            {s.last_failure?.message && <div className="sm:col-span-2"><dt className="text-xs text-rk-muted">Last failure message</dt><dd className="font-mono text-xs text-rk-danger break-words">{s.last_failure.message}</dd></div>}
                          </dl>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section
        title="Ingestion runs"
        id="ds-runs"
        aside={
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="run-kind">Kind</label>
            <select id="run-kind" className={field.replace("w-full", "w-auto")} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">All kinds</option>
              {KINDS.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
            </select>
            <label className="sr-only" htmlFor="run-status">Status</label>
            <select id="run-status" className={field.replace("w-full", "w-auto")} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All results</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="paused_budget">Paused (budget)</option>
              <option value="running">Running</option>
            </select>
          </div>
        }
        note="The satellite labels and the model are run by the daily update job; their newest dates appear in the directory above. Error text comes from the data provider and never contains keys."
      >
        {!runs ? (
          <Loading what="runs" />
        ) : runs.length === 0 ? (
          <Empty title="No runs match">Runs appear here when the daily update or a manual ingestion stores data.</Empty>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-rk-muted">
                <tr><th className="py-2 pr-3 font-semibold">Started</th><th className="py-2 pr-3 font-semibold">Kind</th><th className="py-2 pr-3 font-semibold">Result</th><th className="py-2 pr-3 font-semibold">Duration</th><th className="py-2 pr-3 font-semibold">Values written</th><th className="py-2 font-semibold">Message</th></tr>
              </thead>
              <tbody className="divide-y divide-rk-line">
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtTime(r.started_at)}</td>
                    <td className="py-2 pr-3">{r.kind?.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-3"><StatusPill status={r.status} /></td>
                    <td className="py-2 pr-3 font-mono">{r.duration_s != null ? `${r.duration_s} s` : "—"}</td>
                    <td className="py-2 pr-3 font-mono">{r.values_written ?? "—"}</td>
                    <td className="py-2 text-xs text-rk-muted break-words">{r.message || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
};

export const HealthSection: React.FC = () => {
  const [h, setH] = useState<SystemHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    getSystemHealth().then(setH).catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);
  return (
    <div className="space-y-5">
      <PageHeader title="System health" lead="Checked when this page loads. Only what the backend can measure is shown." actions={<button type="button" className={btnQuiet} onClick={load}>Check again</button>} />
      {error && <Failed what="system health" message={`${error} If the API cannot be reached, it may be down or waking up (the free server sleeps when idle).`} onRetry={load} />}
      {!h && !error && <Loading what="system health" />}
      {h && (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="API" value={<StatusPill status={h.api.status} />} definition={h.api.note} />
            <Metric label="Database" value={<StatusPill status={h.database.status} />} definition={h.database.ping_ms != null ? `Ping answered in ${h.database.ping_ms} ms.` : "No answer to a ping."} />
            <Metric label="Runs failed (7 days)" value={h.ingestion.failed_last_7_days} tone={h.ingestion.failed_last_7_days ? "attention" : "default"} definition={`${h.ingestion.completed_last_7_days} completed, ${h.ingestion.paused_for_budget_last_7_days} paused for the call budget.`} />
            <Metric label="Runs in progress" value={h.ingestion.running_now} definition="Queued or running ingestion runs right now." />
          </dl>
          <Section title="Not monitored yet" id="health-gaps">
            <ul className="list-disc space-y-1 pl-5 text-sm text-rk-ink">
              <li>{h.application_errors.note}</li>
              <li>Request rates and response times are not recorded.</li>
              <li>The hosting provider's own status (Render, Vercel) is on their dashboards, not here.</li>
            </ul>
          </Section>
          <p className="text-xs text-rk-muted">Checked {fmtTime(h.checked_at)}. Public read-only mode: {h.public_read_only ? "on" : "off"}.</p>
        </>
      )}
    </div>
  );
};

export const SettingsSection: React.FC<{ user: AccountUser; permissions: string[] }> = ({ user, permissions }) => {
  const [model, setModel] = useState<{ version?: string; status?: string } | null>(null);
  useEffect(() => {
    getModelStatus()
      .then((m: any) => setModel({ version: m?.model?.model_version, status: m?.status }))
      .catch(() => setModel({}));
  }, []);
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" lead="Read-only information about your account and the platform. There is no general settings editor: configuration and secrets stay on the server." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Your administrator account" id="set-me">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-rk-muted">Name</dt><dd>{user.name}</dd>
            <dt className="text-rk-muted">Email</dt><dd className="break-all">{user.email}</dd>
            <dt className="text-rk-muted">Role</dt><dd>Platform admin</dd>
            <dt className="text-rk-muted">Last log in</dt><dd>{fmtTime(user.last_login_at)}</dd>
          </dl>
          <p className="mt-3 text-xs text-rk-muted">Sessions last 30 days unless you log out; suspension ends them at once. There is no password reset or change screen yet; that is a known gap.</p>
        </Section>
        <Section title="What this account may do" id="set-perms" note="Checked by the server on every request; the menu only hides what is not allowed.">
          <ul className="flex flex-wrap gap-1.5">
            {permissions.map((p) => <li key={p} className="rounded-full bg-rk-secondary px-2.5 py-0.5 font-mono text-xs text-rk-ink">{p}</li>)}
          </ul>
        </Section>
        <Section title="Platform" id="set-platform">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-rk-muted">Flood model</dt><dd className="font-mono text-xs">{model?.version || "—"} {model?.status ? `(${model.status})` : ""}</dd>
            <dt className="text-rk-muted">API address</dt><dd className="font-mono text-xs break-all">{process.env.NEXT_PUBLIC_API_URL || "—"}</dd>
          </dl>
        </Section>
      </div>
    </div>
  );
};
