"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  Analytics, Announcement, AuditEvent, correctAnnouncement, getAnalytics, getAudit, getOverview, listAllAnnouncements,
  publishAnnouncement, withdrawAnnouncement,
} from "../../services/admin";
import { getAlerts } from "../../services/api";
import { closeSos, listSos, releaseSos, SosRequest, SosStatus } from "../../services/rescue";
import { NEED_LABEL, STATUS_LABEL } from "../../lib/rescueLabels";
import { ALL_DISTRICTS } from "../../lib/districts";
import type { AlertItem } from "../../types/api";
import { ACTION_TEXT } from "./OverviewSection";
import { ConfirmDialog, DailyBars, Empty, Failed, Loading, Notice, PageHeader, Section, StatusPill, ago, btnDanger, btnPrimary, btnQuiet, field, fmtDay, fmtTime } from "./ui";

// ======================= ALERTS =======================

export const AlertsSection: React.FC = () => {
  const [model, setModel] = useState<{ date: string; issued: string | null; alerts: AlertItem[] } | null | undefined>(undefined);
  const [anns, setAnns] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", body: "", level: "info" as "info" | "important", district: "" });
  const [fix, setFix] = useState<Announcement | null>(null);
  const [fixText, setFixText] = useState({ title: "", body: "" });
  const [withdraw, setWithdraw] = useState<Announcement | null>(null);

  const loadAnns = useCallback(() => listAllAnnouncements().then((r) => setAnns(r.announcements)).catch((e) => setError((e as Error).message)), []);
  useEffect(() => {
    loadAnns();
    getOverview()
      .then(async (o) => {
        if (!o.model) return setModel(null);
        setModel({ date: o.model.target_date, issued: o.model.issued_at, alerts: await getAlerts(o.model.target_date) });
      })
      .catch(() => setModel(null));
  }, [loadAnns]);

  return (
    <div className="space-y-5">
      <PageHeader title="Alerts and announcements" lead="Three different things, kept apart: official warnings (from authorities), Rokkha's model indications, and announcements written by Rokkha administrators. None can be turned into another." />
      {notice && <Notice tone="ok">{notice}</Notice>}
      {error && <Failed what="alerts" message={error} onRetry={loadAnns} />}

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="1 · Official warnings" id="al-official" note="Not connected: FFWC publishes no documented data feed, so Rokkha does not copy or re-issue official warnings.">
          <p className="text-sm text-rk-ink">River water levels, danger levels and official flood forecasts come from the Flood Forecasting and Warning Centre (FFWC, part of BWDB). Recorded warnings: 1090 (press 5).</p>
          <a href="https://www.ffwc.gov.bd/" target="_blank" rel="noopener noreferrer" className={`${btnQuiet} mt-3`}>Open ffwc.gov.bd <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
        </Section>

        <Section title="2 · Rokkha model indications" id="al-model" note="Produced by the forecast model and stored with its version and issue time. Read-only here: administrators cannot change, raise or remove a model level.">
          {model === undefined ? (
            <Loading what="the latest forecast" />
          ) : model === null ? (
            <Empty title="No forecast stored">The daily update stores one each morning.</Empty>
          ) : model.alerts.length === 0 ? (
            <Empty title={`No district on Watch or Alert for ${fmtDay(model.date)}`}>Issued {fmtTime(model.issued)}. A low chance is not zero risk.</Empty>
          ) : (
            <ul className="divide-y divide-rk-line text-sm">
              <li className="pb-2 text-xs text-rk-muted">For {fmtDay(model.date)} · issued {fmtTime(model.issued)}</li>
              {model.alerts.map((a) => (
                <li key={a.alert_id} className="flex items-center justify-between gap-2 py-2">
                  <span>{a.district.name}</span>
                  <span className="flex items-center gap-2"><span className="font-mono text-xs">{Math.round(a.probability * 100)}%</span><StatusPill status={a.level === "alert" ? "failed" : "delayed"} label={a.level === "alert" ? "Alert (model)" : "Watch (model)"} /></span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="3 · Administrative announcements" id="al-ann"
        note="Shown to the public with the label 'Announcement from Rokkha administrators — not an official warning'. The server refuses text that claims to be an official or government warning. Corrections keep the earlier text; withdrawals need a reason.">
        <form
          className="grid gap-3 rounded-xl border border-rk-line bg-rk-page p-4 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const a = await publishAnnouncement({ title: form.title, body: form.body, level: form.level, district_pcodes: form.district ? [form.district] : [] });
              setNotice(`Published: ${a.title}`);
              setForm({ title: "", body: "", level: "info", district: "" });
              loadAnns();
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <label className="text-sm font-semibold text-rk-ink md:col-span-2">Title<input className={`${field} mt-1`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required minLength={3} maxLength={120} /></label>
          <label className="text-sm font-semibold text-rk-ink md:col-span-2">Message
            <textarea className="mt-1 w-full rounded-lg border border-rk-line bg-white p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rk-brand" rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required minLength={3} maxLength={1000} />
          </label>
          <label className="text-sm font-semibold text-rk-ink">Importance
            <select className={`${field} mt-1`} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as "info" | "important" })}>
              <option value="info">Information</option>
              <option value="important">Important</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-rk-ink">Area
            <select className={`${field} mt-1`} value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}>
              <option value="">All of Bangladesh</option>
              {ALL_DISTRICTS.map((d) => <option key={d.pcode} value={d.pcode}>{d.name} ({d.division})</option>)}
            </select>
          </label>
          <div className="md:col-span-2"><button type="submit" className={btnPrimary}>Publish announcement</button></div>
        </form>

        <div className="mt-5">
          {!anns ? (
            <Loading what="announcements" />
          ) : anns.length === 0 ? (
            <Empty title="No announcements yet" />
          ) : (
            <ul className="space-y-3">
              {anns.map((a) => (
                <li key={a.id} className="rounded-xl border border-rk-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-rk-forest">{a.title}</strong>
                    <span className="flex items-center gap-2"><StatusPill status={a.status || "published"} />{a.level === "important" && <StatusPill status="delayed" label="Important" />}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-rk-ink">{a.body}</p>
                  <p className="mt-2 text-xs text-rk-muted">
                    {a.district_pcodes.length ? a.district_pcodes.map((p) => ALL_DISTRICTS.find((d) => d.pcode === p)?.name || p).join(", ") : "All of Bangladesh"} · published {fmtTime(a.published_at)} by {a.published_by?.name || "—"}
                    {a.status === "withdrawn" && ` · withdrawn: ${a.withdraw_reason}`}
                    {(a.history?.length || 0) > 1 && ` · ${a.history!.length - 1} change${a.history!.length === 2 ? "" : "s"} recorded`}
                  </p>
                  {a.status === "published" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className={btnQuiet} onClick={() => (setFix(a), setFixText({ title: a.title, body: a.body }))}>Correct</button>
                      <button type="button" className={btnDanger} onClick={() => setWithdraw(a)}>Withdraw</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <ConfirmDialog
        open={!!fix}
        title="Correct this announcement"
        description="The earlier text is kept in the announcement's history and the audit log."
        confirmLabel="Save correction"
        onCancel={() => setFix(null)}
        onConfirm={async (reason) => {
          await correctAnnouncement(fix!.id, { ...fixText, reason });
          setNotice("Correction saved.");
          setFix(null);
          loadAnns();
        }}
      >
        <label className="mt-3 block text-sm font-semibold text-rk-ink">Title<input className={`${field} mt-1`} value={fixText.title} onChange={(e) => setFixText({ ...fixText, title: e.target.value })} maxLength={120} /></label>
        <label className="mt-3 block text-sm font-semibold text-rk-ink">Message<textarea className="mt-1 w-full rounded-lg border border-rk-line bg-white p-2.5 text-sm" rows={3} value={fixText.body} onChange={(e) => setFixText({ ...fixText, body: e.target.value })} maxLength={1000} /></label>
      </ConfirmDialog>
      <ConfirmDialog
        open={!!withdraw}
        title="Withdraw this announcement?"
        description={`"${withdraw?.title}" will no longer be shown to the public. The record and its history stay.`}
        confirmLabel="Withdraw"
        danger
        onCancel={() => setWithdraw(null)}
        onConfirm={async (reason) => {
          await withdrawAnnouncement(withdraw!.id, reason);
          setNotice("Announcement withdrawn.");
          setWithdraw(null);
          loadAnns();
        }}
      />
    </div>
  );
};

// ======================= RESCUE OVERSIGHT =======================

const ALL_STATUSES: SosStatus[] = ["available", "accepted", "en_route", "arrived", "in_progress", "completed", "cancelled"];

export const RescueSection: React.FC = () => {
  const [status, setStatus] = useState<"" | SosStatus>("");
  const [rows, setRows] = useState<SosRequest[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [district, setDistrict] = useState("");
  const [team, setTeam] = useState("");
  const [need, setNeed] = useState("");
  const [since, setSince] = useState("");
  const [releasedOnly, setReleasedOnly] = useState(false);
  const [act, setAct] = useState<{ kind: "release" | "close"; req: SosRequest } | null>(null);
  const [reasonCode, setReasonCode] = useState("other");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    listSos(status ? { status } : {})
      .then((r) => (setRows(r.requests), setCounts(r.by_status as Record<string, number>)))
      .catch((e) => setError((e as Error).message));
  }, [status]);
  useEffect(load, [load]);

  const teams = useMemo(() => Array.from(new Set((rows || []).map((r) => r.team?.name).filter(Boolean))) as string[], [rows]);
  const districts = useMemo(() => Array.from(new Map((rows || []).map((r) => [r.district.pcode, r.district.name])).entries()), [rows]);
  const shown = (rows || []).filter(
    (r) =>
      (!district || r.district.pcode === district) &&
      (!team || r.team?.name === team) &&
      (!need || r.needs.includes(need as any)) &&
      (!since || r.received_at >= since) &&
      (!releasedOnly || r.releases.length > 0)
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rescue oversight"
        lead="The shared rescue board as it is stored. This view watches the work; teams accept and update requests on their own board. Contact details are not shown here."
        actions={<button type="button" className={btnQuiet} onClick={load}>Refresh</button>}
      />
      {notice && <Notice tone="ok">{notice}</Notice>}
      <div className="grid gap-3 rounded-2xl border border-rk-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-sm font-semibold text-rk-ink">Status
          <select className={`${field} mt-1`} value={status} onChange={(e) => setStatus(e.target.value as SosStatus | "")}>
            <option value="">All open</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s].en}{counts[s] != null ? ` (${counts[s]})` : ""}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-rk-ink">District
          <select className={`${field} mt-1`} value={district} onChange={(e) => setDistrict(e.target.value)}>
            <option value="">All</option>
            {districts.map(([p, n]) => <option key={p} value={p}>{n}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-rk-ink">Team
          <select className={`${field} mt-1`} value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">All</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-rk-ink">Need
          <select className={`${field} mt-1`} value={need} onChange={(e) => setNeed(e.target.value)}>
            <option value="">All</option>
            {Object.entries(NEED_LABEL).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-rk-ink">Received since
          <input type="date" className={`${field} mt-1`} value={since} onChange={(e) => setSince(e.target.value)} />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-rk-ink">
          <input type="checkbox" className="h-5 w-5" checked={releasedOnly} onChange={(e) => setReleasedOnly(e.target.checked)} /> Released at least once
        </label>
      </div>
      {error && <Failed what="the rescue board" message={error} onRetry={load} />}
      {!rows && !error && <Loading what="requests" />}
      {rows && (
        <Section title={`${shown.length} request${shown.length === 1 ? "" : "s"}`} id="rs-list"
          note="Intervention (admin): release a request from its team, or close a duplicate or false request. Both need a reason, keep the full history and are written to the audit log. Accepting stays the teams' own atomic action; nothing here dispatches a team.">
          {shown.length === 0 ? (
            <Empty title="No request matches these filters" />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-rk-muted">
                  <tr><th className="py-2 pr-3 font-semibold">Request</th><th className="py-2 pr-3 font-semibold">Status</th><th className="py-2 pr-3 font-semibold">District</th><th className="py-2 pr-3 font-semibold">Needs</th><th className="py-2 pr-3 font-semibold">Team</th><th className="py-2 pr-3 font-semibold">Received</th><th className="py-2 pr-3 font-semibold">Last change</th><th className="py-2 font-semibold"><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody className="divide-y divide-rk-line align-top">
                  {shown.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{r.reference}{r.releases.length > 0 && <span className="block font-sans text-rk-warning">Released {r.releases.length}×</span>}</td>
                      <td className="py-2 pr-3"><span className={`whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold ${STATUS_LABEL[r.status].tone}`}>{STATUS_LABEL[r.status].en}</span></td>
                      <td className="py-2 pr-3">{r.district.name}{r.area_name && <span className="block text-xs text-rk-muted">{r.area_name}</span>}</td>
                      <td className="py-2 pr-3">{r.needs.map((n) => NEED_LABEL[n]?.en || n).join(", ")}{r.serious_injury && <span className="block text-xs font-semibold text-rk-danger">Seriously ill or injured</span>}</td>
                      <td className="py-2 pr-3">{r.team?.name || "—"}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtTime(r.received_at)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap text-rk-muted">{ago(r.updated_at)}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {r.team && ["accepted", "en_route", "arrived", "in_progress"].includes(r.status) && (
                            <button type="button" className={btnQuiet} onClick={() => (setReasonCode("other"), setAct({ kind: "release", req: r }))}>Release</button>
                          )}
                          {r.status !== "completed" && r.status !== "cancelled" && (
                            <button type="button" className={btnDanger} onClick={() => (setReasonCode("duplicate"), setAct({ kind: "close", req: r }))}>Close</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}
      <ConfirmDialog
        open={!!act}
        title={act?.kind === "release" ? `Release ${act?.req.reference} from ${act?.req.team?.name}?` : `Close ${act?.req.reference}?`}
        description={act?.kind === "release" ? "It goes back to the shared board, where any team can accept it. The team and the release stay in its history." : "Use only for duplicates or requests that are not genuine. The person who asked sees it as closed."}
        confirmLabel={act?.kind === "release" ? "Release" : "Close request"}
        danger
        onCancel={() => setAct(null)}
        onConfirm={async (note) => {
          if (!act) return;
          if (act.kind === "release") await releaseSos(act.req.id, reasonCode as any, `Admin: ${note}`);
          else await closeSos(act.req.id, reasonCode as any, note);
          setNotice(`${act.req.reference}: ${act.kind === "release" ? "released to the board" : "closed"}.`);
          setAct(null);
          load();
        }}
      >
        <label className="mt-3 block text-sm font-semibold text-rk-ink">Reason type
          <select className={`${field} mt-1`} value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
            {act?.kind === "release" ? (
              <>
                <option value="unable_to_reach">The team could not reach the place</option>
                <option value="lacks_resources">The team lacks resources</option>
                <option value="other">Other</option>
              </>
            ) : (
              <>
                <option value="duplicate">Duplicate</option>
                <option value="not_genuine">Not genuine</option>
                <option value="other">Other</option>
              </>
            )}
          </select>
        </label>
      </ConfirmDialog>
    </div>
  );
};

// ======================= ANALYTICS =======================

export const AnalyticsSection: React.FC = () => {
  const [days, setDays] = useState(30);
  const [a, setA] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    setA(null);
    getAnalytics(days).then(setA).catch((e) => setError((e as Error).message));
  }, [days]);
  useEffect(load, [load]);
  const totalNeeds = a ? Object.values(a.requests_by_need).reduce((x, y) => x + y, 0) : 0;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        lead="Counts from stored records only. No model-accuracy charts here: model evaluation is on the Intelligence page, from the held-out test years."
        actions={
          <div role="group" aria-label="Period" className="flex gap-1">
            {[30, 90, 180].map((d) => (
              <button key={d} type="button" aria-pressed={days === d} className={days === d ? btnPrimary : btnQuiet} onClick={() => setDays(d)}>{d} days</button>
            ))}
          </div>
        }
      />
      {error && <Failed what="analytics" message={error} onRetry={load} />}
      {!a && !error && <Loading what="analytics" />}
      {a && (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            <Section title="Requests for help" id="an-req">
              <DailyBars title="Requests received and completed" unit="requests" source="sos_requests (received_at; 'completed' steps in each request's history)" days={a.days}
                series={[{ key: "r", label: "Received", color: "#247A5B", values: a.requests.map((d) => d.received) }, { key: "c", label: "Completed", color: "#6FA9B5", values: a.requests.map((d) => d.completed) }]} />
            </Section>
            <Section title="Model levels" id="an-model" note="Grey ticks: no forecast stored for that day (not the same as no risk).">
              <DailyBars title="Districts on Watch or Alert (model)" unit="districts" source="flood_predictions (alert_level per district and target day)" days={a.days}
                missing={a.model_levels.map((d) => !d.forecast)}
                series={[{ key: "w", label: "Watch", color: "#E9B949", values: a.model_levels.map((d) => d.watch) }, { key: "a", label: "Alert", color: "#B3392D", values: a.model_levels.map((d) => d.alert) }]} />
            </Section>
            <Section title="Data ingestion" id="an-ing" note={a.ingestion_totals.runs ? `${a.ingestion_totals.completed} of ${a.ingestion_totals.runs} runs in this period completed.` : "No runs recorded in this period."}>
              <DailyBars title="Ingestion runs by result" unit="runs" source="ingestion_runs (started_at, status)" days={a.days}
                series={[{ key: "ok", label: "Completed", color: "#2E7046", values: a.ingestion.map((d) => d.completed || 0) }, { key: "f", label: "Failed", color: "#A63D32", values: a.ingestion.map((d) => d.failed || 0) }, { key: "p", label: "Paused (budget)", color: "#E9B949", values: a.ingestion.map((d) => d.paused_budget || 0) }]} />
            </Section>
            <Section title="Accounts" id="an-users">
              <DailyBars title="New accounts" unit="accounts" source="users (created_at)" days={a.days} series={[{ key: "n", label: "Registered", color: "#173D32", values: a.registrations.map((d) => d.n) }]} />
            </Section>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <Section title="Needs asked for" id="an-needs" note="A request can ask for several needs, so needs can add up to more than the requests.">
              {totalNeeds === 0 ? <Empty title="No requests in this period" /> : (
                <ul className="space-y-1.5 text-sm">{Object.entries(a.requests_by_need).sort((x, y) => y[1] - x[1]).map(([k, n]) => <li key={k} className="flex justify-between"><span>{NEED_LABEL[k as keyof typeof NEED_LABEL]?.en || k}</span><span className="font-mono">{n}</span></li>)}</ul>
              )}
            </Section>
            <Section title="Districts with most requests" id="an-dist">
              {a.requests_by_district.length === 0 ? <Empty title="No requests in this period" /> : (
                <ul className="space-y-1.5 text-sm">{a.requests_by_district.map((d) => <li key={d.pcode} className="flex justify-between"><span>{d.name}</span><span className="font-mono">{d.n}</span></li>)}</ul>
              )}
            </Section>
            <Section title="Team acceptances" id="an-teams">
              {a.team_acceptances.length === 0 ? <Empty title="No acceptances in this period" /> : (
                <ul className="space-y-1.5 text-sm">{a.team_acceptances.map((t) => <li key={t.team || "?"} className="flex justify-between"><span>{t.team || "Unknown team"}</span><span className="font-mono">{t.accepted}</span></li>)}</ul>
              )}
            </Section>
          </div>
          <p className="text-xs text-rk-muted">Method: {a.method}</p>
        </>
      )}
    </div>
  );
};

// ======================= AUDIT LOG =======================

export const AuditSection: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [filters, setFilters] = useState({ action: "", result: "", q: "" });
  const [query, setQuery] = useState(filters);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback((before?: string) => {
    setError(null);
    getAudit({ ...query, before, limit: 50 })
      .then((r) => {
        setEvents((prev) => (before && prev ? [...prev, ...r.events] : r.events));
        setActions(r.actions);
        setNext(r.next_before);
      })
      .catch((e) => setError((e as Error).message));
  }, [query]);
  useEffect(() => load(), [load]);
  return (
    <div className="space-y-5">
      <PageHeader title="Audit log" lead="Administrative and security events, newest first. Append-only: no one can edit or delete an entry through Rokkha. Entries never contain passwords, tokens or the contact details of people asking for help." />
      <form className="grid gap-3 rounded-2xl border border-rk-line bg-white p-4 sm:grid-cols-[1fr_1fr_1fr_auto]" role="search" onSubmit={(e) => (e.preventDefault(), setQuery(filters))}>
        <label className="text-sm font-semibold text-rk-ink">Action
          <select className={`${field} mt-1`} value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}>
            <option value="">All actions</option>
            {actions.map((x) => <option key={x} value={x}>{ACTION_TEXT[x] || x}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-rk-ink">Result
          <select className={`${field} mt-1`} value={filters.result} onChange={(e) => setFilters({ ...filters, result: e.target.value })}>
            <option value="">All</option><option value="success">Success</option><option value="denied">Denied</option><option value="failed">Failed</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-rk-ink">Search (actor, target, reason)<input className={`${field} mt-1`} value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} maxLength={100} /></label>
        <button type="submit" className={`${btnPrimary} self-end`}>Apply</button>
      </form>
      {error && <Failed what="the audit log" message={error} onRetry={() => load()} />}
      {!events && !error && <Loading what="the audit log" />}
      {events && (
        <Section title={`${events.length}${next ? "+" : ""} event${events.length === 1 ? "" : "s"}`} id="audit-list">
          {events.length === 0 ? <Empty title="No event matches" /> : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-rk-muted">
                  <tr><th className="py-2 pr-3 font-semibold">When</th><th className="py-2 pr-3 font-semibold">Actor</th><th className="py-2 pr-3 font-semibold">Action</th><th className="py-2 pr-3 font-semibold">Target</th><th className="py-2 pr-3 font-semibold">Result</th><th className="py-2 font-semibold">Reason / details</th></tr>
                </thead>
                <tbody className="divide-y divide-rk-line align-top">
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtTime(e.at)}</td>
                      <td className="py-2 pr-3">{e.actor ? <>{e.actor.name}<span className="block text-xs text-rk-muted">{e.actor.role}</span></> : <span className="text-rk-muted">No login (local server)</span>}</td>
                      <td className="py-2 pr-3">{ACTION_TEXT[e.action] || e.action}</td>
                      <td className="py-2 pr-3">{e.target ? <>{e.target.label || "—"}<span className="block font-mono text-xs text-rk-muted">{e.target.type}</span></> : "—"}</td>
                      <td className="py-2 pr-3"><StatusPill status={e.result} />{e.repeats ? <span className="mt-1 block text-xs text-rk-muted">+{e.repeats} more within a minute</span> : null}</td>
                      <td className="py-2 text-xs text-rk-ink">{e.reason && <span className="block">{e.reason}</span>}{Object.keys(e.details || {}).length > 0 && <span className="block font-mono text-rk-muted break-words">{Object.entries(e.details).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {next && <div className="mt-3"><button type="button" className={btnQuiet} onClick={() => load(next)}>Load older events</button></div>}
        </Section>
      )}
    </div>
  );
};
