"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getOverview, Overview } from "../../services/admin";
import { STATUS_LABEL } from "../../lib/rescueLabels";
import { Empty, Failed, Loading, Metric, PageHeader, Section, StatusPill, ago, btnQuiet, fmtDay, fmtTime } from "./ui";
import type { AdminSection } from "./AdminConsole";

const EVENT_TEXT: Record<string, string> = {
  received: "Request received", accepted: "Accepted by a team", en_route: "Team on its way", arrived: "Team arrived",
  in_progress: "Help in progress", completed: "Completed", released: "Released back to the board", cancelled: "Cancelled",
  closed: "Closed by an admin", support_requested: "Support requested", support_joined: "Support team joined",
};
export const ACTION_TEXT: Record<string, string> = {
  role_changed: "Role changed", account_suspended: "Account suspended", account_reactivated: "Account reactivated",
  team_created: "Team created", team_membership_changed: "Team membership changed", announcement_published: "Announcement published",
  announcement_corrected: "Announcement corrected", announcement_withdrawn: "Announcement withdrawn", permission_denied: "Permission denied",
  rescue_released_by_admin: "Request released by an admin", rescue_closed_by_admin: "Request closed by an admin",
  facility_added: "Facility added", facility_changed: "Facility changed", facility_removed: "Facility removed",
};

export const OverviewSection: React.FC<{ go: (s: AdminSection) => void }> = ({ go }) => {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    getOverview().then(setData).catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  const attention = data ? data.data.filter((d) => d.status === "failing" || d.status === "delayed" || d.status === "unknown") : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        lead="What is happening across Rokkha now. Every number is counted from the stored records when this page loads; nothing is estimated."
        actions={<button type="button" className={btnQuiet} onClick={load}>Refresh</button>}
      />
      {error && <Failed what="the overview" message={error} onRetry={load} />}
      {!data && !error && <Loading what="the overview" />}
      {data && (
        <>
          <p className="text-xs text-rk-muted">Counted {fmtTime(data.generated_at)} (Bangladesh time).</p>

          <Section title="Requests for help" id="ov-requests" aside={<button type="button" className={btnQuiet} onClick={() => go("rescue")}>Open rescue oversight</button>}>
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label="Waiting for a team" value={data.requests.waiting_for_team} tone={data.requests.waiting_for_team > 0 ? "attention" : "default"}
                definition={`Status "available": no team has accepted yet${data.requests.released_waiting ? `; ${data.requests.released_waiting} of them were released by a team` : ""}.`} />
              <Metric label="Being handled" value={data.requests.being_handled} definition="Accepted, team on its way, arrived or help in progress." />
              <Metric label="Completed" value={data.requests.completed} definition="Marked completed by the responding team (all time)." />
              <Metric label="All requests" value={data.requests.total} definition={`Every request stored, including ${data.requests.cancelled} cancelled.`} />
            </dl>
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Data infrastructure" id="ov-data" aside={<button type="button" className={btnQuiet} onClick={() => go("data")}>Details</button>}
              note="Updated daily in batches, never live. 'Up to date' means the newest stored data is within the source's normal delay.">
              {attention.length > 0 ? (
                <p className="mb-3 text-sm font-semibold text-rk-warning">{attention.length} source{attention.length === 1 ? "" : "s"} need attention.</p>
              ) : (
                <p className="mb-3 text-sm font-semibold text-rk-success">All updated sources are within their normal delay.</p>
              )}
              <ul className="divide-y divide-rk-line">
                {data.data.filter((d) => d.status !== "fixed").map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="text-rk-ink">{d.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs text-rk-muted">{d.latest_data ? fmtDay(d.latest_data) : "nothing stored"}</span>
                      <StatusPill status={d.status} />
                    </span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Forecasts and alerts" id="ov-alerts" aside={<button type="button" className={btnQuiet} onClick={() => go("alerts")}>Alert oversight</button>}
              note="Watch and Alert are Rokkha model levels, not official warnings. Official warnings are issued by FFWC (ffwc.gov.bd).">
              {data.model ? (
                <dl className="grid grid-cols-2 gap-3">
                  <Metric label="On Alert (model)" value={data.model.alert} definition={`Districts at the Alert level for ${fmtDay(data.model.target_date)}.`} />
                  <Metric label="On Watch (model)" value={data.model.watch} definition={`Issued ${fmtTime(data.model.issued_at)}. ${data.model.not_covered} districts are not covered.`} />
                </dl>
              ) : (
                <Empty title="No forecast stored yet">The model output appears here once the daily update has stored a forecast.</Empty>
              )}
              <p className="mt-3 text-sm text-rk-ink">Administrative announcements published: <strong className="font-mono">{data.announcements_published}</strong></p>
            </Section>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Accounts and teams" id="ov-people" aside={<button type="button" className={btnQuiet} onClick={() => go("users")}>Users</button>}>
              <dl className="grid grid-cols-2 gap-3">
                <Metric label="Accounts" value={data.users.total} definition={`${data.users.by_role.rescuer || 0} rescuers, ${data.users.by_role.admin || 0} admins, ${data.users.suspended} suspended.`} />
                <Metric label="Rescue teams" value={data.teams.total} definition={`${data.teams.with_active_members} have at least one active member.`} />
              </dl>
            </Section>

            <Section title="Recent administrative activity" id="ov-admin" aside={<button type="button" className={btnQuiet} onClick={() => go("audit")}>Audit log</button>}>
              {data.recent_admin_activity.length === 0 ? (
                <Empty title="No administrative actions recorded yet" />
              ) : (
                <ul className="divide-y divide-rk-line text-sm">
                  {data.recent_admin_activity.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                      <span>
                        <strong className="font-semibold text-rk-ink">{ACTION_TEXT[e.action] || e.action}</strong>
                        {e.target?.label ? <span className="text-rk-muted"> · {e.target.label}</span> : null}
                        <span className="text-rk-muted"> · {e.actor?.name || "no login"}</span>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-rk-muted">{e.result !== "success" && <StatusPill status={e.result} />}{ago(e.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <Section title="Recent rescue activity" id="ov-rescue" note="Steps from the requests' own history. Contact details are never shown here.">
            {data.recent_rescue_activity.length === 0 ? (
              <Empty title="No requests yet" />
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-rk-muted">
                    <tr><th className="py-2 pr-3 font-semibold">When</th><th className="py-2 pr-3 font-semibold">Request</th><th className="py-2 pr-3 font-semibold">District</th><th className="py-2 pr-3 font-semibold">Step</th><th className="py-2 font-semibold">Team</th></tr>
                  </thead>
                  <tbody className="divide-y divide-rk-line">
                    {data.recent_rescue_activity.map((a, i) => (
                      <tr key={`${a.reference}-${i}`}>
                        <td className="py-2 pr-3 whitespace-nowrap text-rk-muted">{fmtTime(a.at)}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{a.reference}</td>
                        <td className="py-2 pr-3">{a.district || "—"}</td>
                        <td className="py-2 pr-3">{EVENT_TEXT[a.event] || a.event} <span className="text-xs text-rk-muted">({STATUS_LABEL[a.status as keyof typeof STATUS_LABEL]?.en || a.status})</span></td>
                        <td className="py-2">{a.team || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
};
