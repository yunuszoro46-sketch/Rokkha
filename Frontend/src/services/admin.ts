// Admin Control Centre API (backend app/modules/admin). Every call is checked by the server; the
// interface only hides what the account may not do.
import { AccountUser, Role, call } from "./auth";

export type SourceStatus = "healthy" | "delayed" | "failing" | "unknown" | "fixed";

export interface RunBrief {
  id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  duration_s: number | null;
  values_written?: number | null;
  message: string | null;
}

export interface DataSource {
  id: string;
  name: string;
  category: string;
  provider: string;
  coverage: string;
  frequency: string;
  format: string;
  attribution: string;
  limitations: string;
  kind: "updated" | "fixed";
  latest_data: string | null;
  age_days: number | null;
  status: SourceStatus;
  last_success: RunBrief | null;
  last_failure: RunBrief | null;
}

export interface IngestionRun extends RunBrief {
  kind: string;
  source: string | null;
  pieces_done: number | null;
  pieces_total: number | null;
  api_calls: number | null;
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: { id: string; name: string; role: string } | null;
  action: string;
  target: { type: string; id: string | null; label: string | null } | null;
  result: "success" | "denied" | "failed";
  reason: string | null;
  details: Record<string, unknown>;
  /** Same refusal from the same account within a minute: counted here instead of stored again. */
  repeats?: number;
  last_at?: string;
}

export interface Overview {
  generated_at: string;
  users: { total: number; by_role: Record<string, number>; suspended: number };
  teams: { total: number; with_active_members: number };
  requests: {
    total: number;
    by_status: Record<string, number>;
    waiting_for_team: number;
    released_waiting: number;
    being_handled: number;
    completed: number;
    cancelled: number;
  };
  model: { target_date: string; issued_at: string | null; watch: number; alert: number; none: number; not_covered: number } | null;
  announcements_published: number;
  data: Array<{ id: string; name: string; status: SourceStatus; latest_data: string | null; age_days: number | null }>;
  recent_rescue_activity: Array<{ reference: string; district: string | null; event: string; status: string; team: string | null; at: string }>;
  recent_admin_activity: AuditEvent[];
}

export interface Analytics {
  days: string[];
  requests: Array<{ day: string; received: number; completed: number }>;
  requests_by_need: Record<string, number>;
  requests_by_district: Array<{ pcode: string; name: string; n: number }>;
  team_acceptances: Array<{ team: string | null; accepted: number }>;
  registrations: Array<{ day: string; n: number }>;
  ingestion: Array<{ day: string; completed?: number; failed?: number; paused_budget?: number; running?: number; queued?: number }>;
  ingestion_totals: { runs: number; completed: number };
  model_levels: Array<{ day: string; forecast: boolean; watch: number; alert: number }>;
  method: string;
}

export interface SystemHealth {
  checked_at: string;
  api: { status: string; note: string };
  database: { status: "up" | "down"; ping_ms: number | null };
  ingestion: { running_now: number; failed_last_7_days: number; paused_for_budget_last_7_days: number; completed_last_7_days: number };
  public_read_only: boolean;
  application_errors: { available: boolean; note: string };
}

export interface Announcement {
  id: string;
  label: string;
  title: string;
  body: string;
  level: "info" | "important";
  district_pcodes: string[];
  status?: "published" | "withdrawn";
  published_at: string;
  updated_at: string;
  published_by?: { id: string; name: string };
  withdraw_reason?: string;
  history?: Array<{ event: string; at: string; by: { id: string; name: string }; reason?: string; previous?: { title: string; body: string } }>;
}

export const adminMe = () => call<{ user: { id: string; name: string; role: Role }; permissions: string[] }>("/admin/me");
export const getOverview = () => call<Overview>("/admin/overview");
export const getAnalytics = (days: number) => call<Analytics>(`/admin/analytics?days=${days}`);
export const getDataSources = () => call<{ checked_at: string; today: string; sources: DataSource[]; status_rule: string }>("/admin/data-sources");
export const getIngestionRuns = (opts: { kind?: string; status?: string; limit?: number } = {}) => {
  const q = new URLSearchParams();
  if (opts.kind) q.set("kind", opts.kind);
  if (opts.status) q.set("status", opts.status);
  q.set("limit", String(opts.limit ?? 50));
  return call<{ runs: IngestionRun[] }>(`/admin/ingestion-runs?${q}`);
};
export const getSystemHealth = () => call<SystemHealth>("/admin/system-health");
export const getAudit = (opts: { action?: string; result?: string; q?: string; before?: string; limit?: number } = {}) => {
  const q = new URLSearchParams();
  Object.entries(opts).forEach(([k, v]) => v !== undefined && v !== "" && q.set(k, String(v)));
  return call<{ events: AuditEvent[]; actions: string[]; next_before: string | null }>(`/admin/audit?${q}`);
};
export const searchUsers = (opts: { q?: string; role?: string; status?: string; skip?: number; limit?: number }) => {
  const q = new URLSearchParams();
  Object.entries(opts).forEach(([k, v]) => v !== undefined && v !== "" && q.set(k, String(v)));
  return call<{ count: number; total: number; skip: number; users: AccountUser[] }>(`/admin/users?${q}`);
};
export const setUserStatus = (id: string, status: "active" | "suspended", reason: string) =>
  call<AccountUser>(`/admin/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, reason }) });
export const listAllAnnouncements = () => call<{ announcements: Announcement[] }>("/admin/announcements");
export const publishAnnouncement = (a: { title: string; body: string; level: "info" | "important"; district_pcodes: string[] }) =>
  call<Announcement>("/admin/announcements", { method: "POST", body: JSON.stringify(a) });
export const correctAnnouncement = (id: string, a: { title: string; body: string; reason: string }) =>
  call<Announcement>(`/admin/announcements/${id}`, { method: "PATCH", body: JSON.stringify(a) });
export const withdrawAnnouncement = (id: string, reason: string) =>
  call<Announcement>(`/admin/announcements/${id}/withdraw`, { method: "POST", body: JSON.stringify({ reason }) });
/** Public: currently published administrative announcements (never official warnings). */
export const getPublicAnnouncements = () => call<{ announcements: Announcement[]; note: string }>("/announcements", {}, false);
