// Rescue requests: the sender's side with its on-phone queue, the shared
// rescue board for teams, and the admin calls (Backend/docs/FRONTEND_API_GUIDE.md
// and Backend/docs/RESCUE_COORDINATION_SPEC.md).
//
// Honesty rule for the sender: a request is "saved on this phone" until the
// server has answered. Nothing here ever claims a request was received, seen
// or answered unless the backend said so.

import { AccountUser, AuthError, Role, call } from "./auth";
import { RegisteredAsset } from "../types/api";

const QUEUE_KEY = "rokkha_sos_queue";

export type Need = "food_water" | "medical" | "house_danger" | "evacuation" | "other";
export type Vulnerable = "children" | "elderly" | "disability" | "pregnant";
export type LocationSource = "gps" | "saved_place" | "manual";
export type SosStatus = "available" | "accepted" | "en_route" | "arrived" | "in_progress" | "completed" | "cancelled";
export type SosEvent =
  | "received" | "accepted" | "en_route" | "arrived" | "in_progress" | "completed"
  | "released" | "support_requested" | "support_joined" | "cancelled" | "closed";
export type ProgressStatus = "en_route" | "arrived" | "in_progress" | "completed";
export type ReleaseReason = "unable_to_reach" | "lacks_resources" | "other";

/** What the person typed. Never turned into coordinates. */
export interface Place {
  district_pcode: string | null;
  upazila?: string | null;
  union?: string | null;
  village?: string | null;
  area?: string | null;
  landmark?: string | null;
  details?: string | null;
}

export interface SosDraft {
  needs: Need[];
  people: number;
  serious_injury: boolean | null;
  vulnerable: Vulnerable[];
  // Only a point the phone or the account really gave; null when the place was described.
  location: { lng: number; lat: number } | null;
  // null only for requests saved by an older version of this page.
  location_source: LocationSource | null;
  accuracy_m: number | null;
  place: Place | null;
  // A short text of the place, as shown to the person before sending.
  place_label: string;
  note: string;
  contact_name: string;
  contact_phone: string;
}

export interface TeamName {
  name: string;
  organization: string;
}

export interface TeamRef extends TeamName {
  id: string;
}

export interface SosStep {
  event: SosEvent;
  status: SosStatus;
  at: string;
  team: TeamName | null;
  reason: string | null;
}

/** What the server tells the sender (no personal details). */
export interface SosReceipt {
  id: string;
  reference: string;
  status: SosStatus;
  needs: Need[];
  district: { pcode: string; name: string; division: string };
  team: TeamName | null;
  received_at: string;
  updated_at: string;
  history: SosStep[];
  message_to_sender: string | null;
}

/** What a rescue team sees on the board. */
export interface SosRequest extends Omit<SosReceipt, "team" | "history"> {
  team: TeamRef | null;
  support_teams: TeamRef[];
  support_request: { note: string | null; at: string } | null;
  releases: Array<{ reason: ReleaseReason; note: string | null; at: string; team: TeamRef }>;
  outcome: { people_helped: number; note: string | null } | null;
  history: Array<SosStep & { team: TeamRef | null; note: string | null }>;
  location: { type: "Point"; coordinates: [number, number] } | null;
  // "Upazila, District" from the point (server-side); null without a point.
  area_name: string | null;
  location_source: LocationSource | null;
  accuracy_m: number | null;
  place: Place | null;
  people: number;
  serious_injury: boolean | null;
  vulnerable: Vulnerable[];
  note: string | null;
  // True when contact details exist but are only shown to the team that accepts.
  contact_hidden: boolean;
  contact_name: string | null;
  contact_phone: string | null;
  saved_at: string | null;
  from_account: boolean;
}

/** One request kept on this phone. */
export interface StoredSos {
  // Random key made once on this phone; also the private key for the status.
  client_id: string;
  draft: SosDraft;
  saved_at: string;
  // "saved" = only on this phone. "received" = the server answered and holds it.
  // "refused" = the server will never accept it as it is (e.g. outside Bangladesh).
  delivery: "saved" | "received" | "refused";
  receipt: SosReceipt | null;
  // Why the last try did not get through (shown to the person).
  last_problem: string | null;
}

// ==========================================
// THE QUEUE ON THIS PHONE
// ==========================================

const OLD_NEED: Record<string, Need> = {
  rescue: "evacuation", shelter: "other", medical: "medical", food_water: "food_water", other: "other",
};

/** Requests saved by the previous version of this page had one "need" and lng/lat. */
function upgradeDraft(draft: any): SosDraft {
  if (Array.isArray(draft?.needs)) return draft as SosDraft;
  const hasPoint = typeof draft?.lng === "number" && typeof draft?.lat === "number";
  return {
    needs: [OLD_NEED[draft?.need] || "evacuation"],
    people: draft?.people || 1,
    serious_injury: null,
    vulnerable: [],
    location: hasPoint ? { lng: draft.lng, lat: draft.lat } : null,
    location_source: null, // not known: never guessed
    accuracy_m: draft?.accuracy_m ?? null,
    place: null,
    place_label: hasPoint ? `${draft.lat.toFixed(4)}°N, ${draft.lng.toFixed(4)}°E` : "",
    note: draft?.note || "",
    contact_name: draft?.contact_name || "",
    contact_phone: draft?.contact_phone || "",
  };
}

export function readQueue(): StoredSos[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(QUEUE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: StoredSos) => ({ ...item, draft: upgradeDraft(item.draft) }));
  } catch {
    return [];
  }
}

function writeQueue(queue: StoredSos[]) {
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function replaceInQueue(item: StoredSos) {
  writeQueue(readQueue().map((q) => (q.client_id === item.client_id ? item : q)));
}

function newClientId(): string {
  const secure = window.crypto;
  if (typeof secure.randomUUID === "function") return secure.randomUUID();
  // Older browsers: 32 random hex characters from the secure generator.
  const bytes = new Uint8Array(16);
  secure.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Save a request on this phone first. Sending happens afterwards, in syncQueue(). */
export function saveSos(draft: SosDraft): StoredSos {
  const item: StoredSos = {
    client_id: newClientId(),
    draft,
    saved_at: new Date().toISOString(),
    delivery: "saved",
    receipt: null,
    last_problem: null,
  };
  writeQueue([item, ...readQueue()]);
  return item;
}

export function forgetSos(clientId: string) {
  writeQueue(readQueue().filter((q) => q.client_id !== clientId));
}

const FINAL: SosStatus[] = ["completed", "cancelled"];

export function isOpen(item: StoredSos): boolean {
  if (item.delivery === "refused") return false;
  return !item.receipt || !FINAL.includes(item.receipt.status);
}

async function sendOne(item: StoredSos): Promise<StoredSos> {
  const d = item.draft;
  try {
    // Always the same body for the same request: a retry is the same POST.
    const receipt = await call<SosReceipt>("/sos", {
      method: "POST",
      body: JSON.stringify({
        client_id: item.client_id,
        needs: d.needs,
        people: d.people,
        serious_injury: d.serious_injury,
        vulnerable: d.vulnerable,
        location: d.location ? { type: "Point", coordinates: [d.location.lng, d.location.lat] } : null,
        location_source: d.location_source,
        accuracy_m: d.location ? d.accuracy_m : null,
        place: d.place,
        note: d.note || null,
        contact_name: d.contact_name || null,
        contact_phone: d.contact_phone || null,
        saved_at: item.saved_at,
      }),
    });
    return { ...item, delivery: "received", receipt, last_problem: null };
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 0;
    const message = (error as Error).message;
    // 422: the server will never take this request as it is. Everything else
    // (no connection, server waking up, too many requests) is tried again.
    if (status === 422) return { ...item, delivery: "refused", last_problem: message };
    return { ...item, last_problem: status === 0 ? "No connection to the server." : message };
  }
}

async function refreshOne(item: StoredSos): Promise<StoredSos> {
  try {
    const receipt = await call<SosReceipt>(`/sos/status/${item.client_id}`, {}, false);
    return { ...item, receipt, last_problem: null };
  } catch {
    return item; // keep the last known status; its time is shown
  }
}

/** Send what is still only on this phone and refresh the status of the rest. */
export async function syncQueue(): Promise<StoredSos[]> {
  for (const item of readQueue()) {
    if (item.delivery === "saved") replaceInQueue(await sendOne(item));
    else if (item.delivery === "received" && isOpen(item)) replaceInQueue(await refreshOne(item));
  }
  return readQueue();
}

/** "I no longer need help." */
export async function cancelSos(item: StoredSos): Promise<void> {
  if (item.delivery !== "received") {
    forgetSos(item.client_id); // it never left this phone
    return;
  }
  const receipt = await call<SosReceipt>(`/sos/status/${item.client_id}/cancel`, { method: "POST" }, false);
  replaceInQueue({ ...item, receipt });
}

const NEED_WORDS: Record<Need, string> = {
  food_water: "food and water",
  medical: "medical help",
  house_danger: "help: house unsafe",
  evacuation: "rescue / evacuation",
  other: "help",
};

/** A short text for SMS when there is no internet (voice signal often survives). */
export function smsText(item: StoredSos): string {
  const d = item.draft;
  const point = d.location
    ? [
        `Location ${d.location.lat.toFixed(5)}, ${d.location.lng.toFixed(5)}`,
        `https://www.openstreetmap.org/?mlat=${d.location.lat.toFixed(5)}&mlon=${d.location.lng.toFixed(5)}#map=16/${d.location.lat.toFixed(5)}/${d.location.lng.toFixed(5)}`,
      ]
    : [];
  return [
    `SOS: ${d.people} ${d.people === 1 ? "person needs" : "people need"} ${d.needs.map((n) => NEED_WORDS[n]).join(", ")}.`,
    d.serious_injury ? "Someone is seriously ill or injured." : "",
    d.place_label ? `Place: ${d.place_label}.` : "",
    ...point,
    d.note,
    d.contact_name ? `From ${d.contact_name}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * "Tahirpur, Sunamganj" for a GPS point, from our own server (official upazila
 * boundaries; the point is not sent to any outside service). null when it
 * cannot be determined: the page then says so and never makes a name up.
 */
export async function lookupPlaceName(lng: number, lat: number): Promise<string | null> {
  try {
    const answer = await call<{ label: string | null }>(`/geospatial/place-name?lng=${lng}&lat=${lat}`, {}, false);
    return answer.label;
  } catch {
    return null;
  }
}

export interface PlaceNameAnswer {
  upazila: string | null;
  upazila_pcode?: string | null;
  district: { pcode: string; name: string; division: string } | null;
  label: string | null;
  attribution: string;
}

/** The full place-name answer (upazila and district codes) for the map's Point Check. null if unreachable. */
export async function getPlaceName(lng: number, lat: number): Promise<PlaceNameAnswer | null> {
  try {
    return await call<PlaceNameAnswer>(`/geospatial/place-name?lng=${lng}&lat=${lat}`, {}, false);
  } catch {
    return null;
  }
}

// ==========================================
// RESCUE TEAMS: THE SHARED BOARD
// ==========================================

export interface SosList {
  count: number;
  by_status: Partial<Record<SosStatus, number>>;
  requests: SosRequest[];
}

export function listSos(options: { status?: SosStatus; mine?: boolean } = {}): Promise<SosList> {
  const query = new URLSearchParams();
  if (options.status) query.set("status", options.status);
  if (options.mine) query.set("mine", "true");
  const text = query.toString();
  return call<SosList>(`/sos${text ? `?${text}` : ""}`);
}

/** Atomic on the server: a 409 AuthError means another team was first. */
export function acceptSos(id: string): Promise<SosRequest> {
  return call<SosRequest>(`/sos/${id}/accept`, { method: "POST" });
}

export function progressSos(
  id: string,
  status: ProgressStatus,
  message?: string,
  outcome?: { people_helped: number; note: string | null }
): Promise<SosRequest> {
  return call<SosRequest>(`/sos/${id}/progress`, {
    method: "POST",
    body: JSON.stringify({ status, message_to_sender: message ?? null, outcome: outcome ?? null }),
  });
}

export function releaseSos(id: string, reason: ReleaseReason, note?: string): Promise<SosRequest> {
  return call<SosRequest>(`/sos/${id}/release`, { method: "POST", body: JSON.stringify({ reason, note: note || null }) });
}

export function askSupport(id: string, note?: string): Promise<SosRequest> {
  return call<SosRequest>(`/sos/${id}/support-request`, { method: "POST", body: JSON.stringify({ note: note || null }) });
}

export function joinSupport(id: string): Promise<SosRequest> {
  return call<SosRequest>(`/sos/${id}/support`, { method: "POST" });
}

export function closeSos(id: string, reason: "duplicate" | "not_genuine" | "other", note?: string): Promise<SosRequest> {
  return call<SosRequest>(`/sos/${id}/close`, { method: "POST", body: JSON.stringify({ reason, note: note || null }) });
}

// ==========================================
// ADMIN: RESCUE TEAMS
// ==========================================

export interface Team extends TeamRef {
  created_at: string;
  members: number;
}

export async function listTeams(): Promise<Team[]> {
  return (await call<{ teams: Team[] }>("/admin/teams")).teams;
}

export function createTeam(name: string, organization: string): Promise<Team> {
  return call<Team>("/admin/teams", { method: "POST", body: JSON.stringify({ name, organization }) });
}

export function setUserTeam(userId: string, teamId: string | null): Promise<AccountUser> {
  return call<AccountUser>(`/admin/users/${userId}/team`, { method: "PATCH", body: JSON.stringify({ team_id: teamId }) });
}

// ==========================================
// ADMIN
// ==========================================

export async function listUsers(): Promise<AccountUser[]> {
  return (await call<{ users: AccountUser[] }>("/admin/users")).users;
}

export function setUserRole(userId: string, role: Role): Promise<AccountUser> {
  return call<AccountUser>(`/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
}

export async function listDistrictAssets(pcode: string): Promise<RegisteredAsset[]> {
  return (await call<{ assets: RegisteredAsset[] }>(`/assets?district_pcode=${pcode}`, {}, false)).assets;
}

export function createAsset(asset: {
  name: string;
  asset_type: string;
  lng: number;
  lat: number;
  criticality: string;
  occupancy: number | null;
}): Promise<RegisteredAsset> {
  return call<RegisteredAsset>("/assets", {
    method: "POST",
    body: JSON.stringify({
      name: asset.name,
      asset_type: asset.asset_type,
      location: { type: "Point", coordinates: [asset.lng, asset.lat] },
      criticality: asset.criticality,
      occupancy: asset.occupancy,
    }),
  });
}

export function deleteAsset(id: string): Promise<void> {
  return call<void>(`/assets/${id}`, { method: "DELETE" });
}
