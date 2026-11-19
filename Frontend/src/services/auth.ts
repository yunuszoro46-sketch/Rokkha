// User accounts: register, log in, save a home location and read the flood
// report for it (backend: /auth, see Backend/docs/FRONTEND_API_GUIDE.md 3 H).
//
// Unlike the public data in api.ts there is NO saved sample here: an account
// only exists on the backend, so every function throws AuthError when the
// backend cannot be reached or refuses the request.

import { DistrictPrediction, AssetNearResult } from "../types/api";
import { readPreciseLocation } from "./location";

import { API_BASE } from "./common/client";

const TOKEN_KEY = "rokkha_token";

export interface GeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export type Role = "user" | "rescuer" | "admin";

export interface AccountUser {
  id: string;
  name: string;
  email: string;
  // What the account may do. Decided by the backend only; the page uses it
  // to choose which screens to show, the backend to allow or refuse calls.
  role: Role;
  // The rescue team the account works in (set by an admin), or null.
  team: { id: string; name: string; organization: string } | null;
  location: GeoPoint | null;
  location_label: string | null;
  district: { pcode: string; name: string; division: string } | null;
  location_updated_at: string | null;
  created_at: string;
  /** "suspended" accounts cannot log in (set by an admin). Older backends do not send it. */
  status?: "active" | "suspended";
  last_login_at?: string | null;
}

export interface LocationReport {
  target_date: string;
  location: GeoPoint;
  location_label: string | null;
  district: { pcode: string; name: string; division: string };
  forecast_status: "available" | "no_forecast_for_this_day";
  forecast: DistrictPrediction | null;
  alert_thresholds: { watch: number; alert: number } | null;
  flood_history: {
    district: {
      rank?: number;
      events_observed?: number;
      events_flooded?: number;
      max_flooded_share?: number;
    } | null;
    cell: {
      times_observed: number;
      times_flooded: number;
      flooded_event_ids: string[];
      permanent_water: boolean;
      hazard: Array<{ return_period_years: number; depth_class: number | null; depth_label: string | null }>;
    } | null;
  };
  nearest_assets: AssetNearResult[];
  nearest_assets_radius_meters: number;
  attribution: string[];
  limitations: string[];
}

/** `status` 0 = the backend could not be reached at all. */
export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

function readDetail(body: any, fallback: string): string {
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  // Validation errors come as a list: show each message.
  if (Array.isArray(detail)) {
    return detail
      .map((d: any) => String(d?.msg || "").replace(/^Value error, /, ""))
      .filter(Boolean)
      .join(" ");
  }
  return fallback;
}

/** Fired on window when the server rejects the stored login (401). */
export const SESSION_ENDED = "rokkha:session-ended";

/** One call to the backend, with the login token when there is one. Throws AuthError. */
export async function call<T>(path: string, init: RequestInit = {}, withToken = true): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (withToken && token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new AuthError(0, "The server could not be reached. Accounts need a connection.");
  }

  if (res.status === 204) return undefined as T;

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body
  }

  if (!res.ok) {
    // The login is no longer valid: forget it so the page shows the login form.
    if (res.status === 401 && withToken && token) {
      setToken(null);
      // Tell the page at once (expired session, suspended account, logged out elsewhere).
      if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_ENDED));
    }
    throw new AuthError(res.status, readDetail(body, `Request failed (${res.status}).`));
  }
  return body as T;
}

type Session = { token: string; expires_at: string; user: AccountUser };

export async function registerAccount(name: string, email: string, password: string): Promise<AccountUser> {
  const session = await call<Session>(
    "/auth/register",
    { method: "POST", body: JSON.stringify({ name, email, password }) },
    false
  );
  setToken(session.token);
  return session.user;
}

export async function logIn(email: string, password: string): Promise<AccountUser> {
  const session = await call<Session>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    false
  );
  setToken(session.token);
  return session.user;
}

export async function logOut(): Promise<void> {
  try {
    if (getToken()) await call<void>("/auth/logout", { method: "POST" });
  } catch {
    // Even if the server cannot be told, this browser forgets the login.
  }
  setToken(null);
}

/** The logged-in user, or null when nobody is logged in on this browser. */
export async function getCurrentUser(): Promise<AccountUser | null> {
  if (!getToken()) return null;
  try {
    return await call<AccountUser>("/auth/me");
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) return null;
    throw error;
  }
}

export function saveMyLocation(lng: number, lat: number, label?: string): Promise<AccountUser> {
  return call<AccountUser>("/auth/me/location", {
    method: "PUT",
    body: JSON.stringify({ location: { type: "Point", coordinates: [lng, lat] }, label: label || null }),
  });
}

export function removeMyLocation(): Promise<AccountUser> {
  return call<AccountUser>("/auth/me/location", { method: "DELETE" });
}

export function getMyReport(targetDate: string): Promise<LocationReport> {
  return call<LocationReport>(`/auth/me/report?target_date=${targetDate}`);
}

/** The browser's position as [longitude, latitude], as accurate as the device allows.
 * Asks the user for permission. See services/location.ts. */
export async function readGpsPosition(isBn = false): Promise<[number, number]> {
  const fix = await readPreciseLocation({ isBn });
  return [fix.lng, fix.lat];
}
