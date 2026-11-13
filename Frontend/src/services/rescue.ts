// Rescue requests (SOS): the sender's side with its on-phone queue, the
// rescuers' side, and the admin calls (backend sections 3 I and 3 J of
// Backend/docs/FRONTEND_API_GUIDE.md).
//
// Honesty rule for the sender: a request is "saved on this phone" until the
// server has answered. Nothing here ever claims a request was received, seen
// or answered unless the backend said so.

import { AccountUser, AuthError, Role, call } from "./auth";
import { RegisteredAsset } from "../types/api";

const QUEUE_KEY = "rokkha_sos_queue";

export type Need = "rescue" | "medical" | "food_water" | "shelter" | "other";
export type SosStatus = "new" | "acknowledged" | "team_sent" | "resolved" | "cancelled";

export interface SosDraft {
  lng: number;
  lat: number;
  accuracy_m: number | null;
  people: number;
  need: Need;
  note: string;
  contact_name: string;
  contact_phone: string;
}

/** What the server tells the sender (no personal details). */
export interface SosReceipt {
  id: string;
  status: SosStatus;
  district: { pcode: string; name: string; division: string };
  received_at: string;
  updated_at: string;
  history: Array<{ status: SosStatus; at: string }>;
  message_to_sender: string | null;
}

/** What a rescuer sees. */
export interface SosRequest extends SosReceipt {
  location: { type: "Point"; coordinates: [number, number] };
  accuracy_m: number | null;
  people: number;
  need: Need;
  note: string | null;
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

export function readQueue(): StoredSos[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(QUEUE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
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

const FINAL: SosStatus[] = ["resolved", "cancelled"];

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
        location: { type: "Point", coordinates: [d.lng, d.lat] },
        accuracy_m: d.accuracy_m,
        people: d.people,
        need: d.need,
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

/** A short text for SMS when there is no internet (voice signal often survives). */
export function smsText(item: StoredSos): string {
  const d = item.draft;
  const needs: Record<Need, string> = {
    rescue: "rescue",
    medical: "medical help",
    food_water: "food and water",
    shelter: "shelter",
    other: "help",
  };
  return [
    `SOS: ${d.people} ${d.people === 1 ? "person needs" : "people need"} ${needs[d.need]}.`,
    `Location ${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}`,
    `https://www.openstreetmap.org/?mlat=${d.lat.toFixed(5)}&mlon=${d.lng.toFixed(5)}#map=16/${d.lat.toFixed(5)}/${d.lng.toFixed(5)}`,
    d.note,
    d.contact_name ? `From ${d.contact_name}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

// ==========================================
// RESCUERS
// ==========================================

export interface SosList {
  count: number;
  by_status: Partial<Record<SosStatus, number>>;
  requests: SosRequest[];
}

export function listSos(status?: SosStatus): Promise<SosList> {
  return call<SosList>(`/sos${status ? `?status=${status}` : ""}`);
}

export function updateSos(id: string, status: SosStatus, message?: string): Promise<SosRequest> {
  return call<SosRequest>(`/sos/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, message_to_sender: message ?? null }),
  });
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
