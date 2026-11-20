"use client";

// Rokkha Admin Control Centre: one protected workspace for the platform administrator. Access is
// decided by the server (/admin/me and every admin route check a permission); this component only
// chooses what to show.
import React, { useEffect, useState } from "react";
import {
  Activity, BarChart3, Building2, Database, LayoutDashboard, LifeBuoy, Megaphone, ScrollText, Settings, ShieldAlert, Users, UsersRound,
} from "lucide-react";
import { AccountUser } from "../../services/auth";
import { adminMe } from "../../services/admin";
import { AdminPanel } from "../AdminPanel";
import { Language } from "../../lib/translations";
import { OverviewSection } from "./OverviewSection";
import { TeamsSection, UsersSection } from "./PeopleSections";
import { DataSourcesSection, HealthSection, SettingsSection } from "./InfraSections";
import { AlertsSection, AnalyticsSection, AuditSection, RescueSection } from "./OpsSections";
import { Loading, btnPrimary } from "./ui";

export const ADMIN_SECTIONS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, perm: "admin.view" },
  { id: "rescue", label: "Rescue oversight", icon: LifeBuoy, perm: "rescue.oversee" },
  { id: "alerts", label: "Alerts & announcements", icon: Megaphone, perm: "announcements.publish" },
  { id: "data", label: "Data sources", icon: Database, perm: "admin.view" },
  { id: "analytics", label: "Analytics", icon: BarChart3, perm: "admin.view" },
  { id: "users", label: "Users", icon: Users, perm: "users.manage" },
  { id: "teams", label: "Rescue teams", icon: UsersRound, perm: "teams.manage" },
  { id: "places", label: "Facilities", icon: Building2, perm: "admin.view" },
  { id: "health", label: "System health", icon: Activity, perm: "admin.view" },
  { id: "audit", label: "Audit log", icon: ScrollText, perm: "audit.view" },
  { id: "settings", label: "Settings", icon: Settings, perm: "admin.view" },
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number]["id"];
export const isAdminSection = (s: string | undefined): s is AdminSection => ADMIN_SECTIONS.some((x) => x.id === s);

export const AdminConsole: React.FC<{
  user: AccountUser | null;
  lang: Language;
  initialSection?: string;
  onOpenLogin: () => void;
  placesProps: { districtPcode: string; districtName: string; pickedPoint: { lat: number; lng: number } | null };
}> = ({ user, lang, initialSection, onOpenLogin, placesProps }) => {
  const [section, setSection] = useState<AdminSection>(isAdminSection(initialSection) ? initialSection : "overview");
  const [access, setAccess] = useState<{ permissions: string[] } | null | "denied" | "error">(null);

  useEffect(() => {
    if (!user) return;
    setAccess(null);
    adminMe()
      .then((r) => setAccess({ permissions: r.permissions }))
      .catch((e) => setAccess((e as { status?: number }).status === 403 || (e as { status?: number }).status === 401 ? "denied" : "error"));
  }, [user]);

  useEffect(() => {
    const onPop = () => {
      const s = window.location.pathname.split("/")[2];
      if (window.location.pathname.startsWith("/admin")) setSection(isAdminSection(s) ? s : "overview");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = (s: AdminSection) => {
    setSection(s);
    const path = s === "overview" ? "/admin" : `/admin/${s}`;
    if (window.location.pathname !== path) window.history.pushState({ view: "admin" }, "", path);
    document.getElementById("admin-main")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  };

  if (!user) {
    return (
      <Gate title="Admin Control Centre" text="This area is for Rokkha platform administrators. Log in with an administrator account.">
        <button type="button" className={btnPrimary} onClick={onOpenLogin}>Log in</button>
      </Gate>
    );
  }
  if (access === null) return <Loading what="your access" />;
  if (access === "denied") {
    return <Gate title="Not available for this account" text="Your account is not a platform administrator. The server refuses administrative requests from it, and the attempt is recorded." />;
  }
  if (access === "error") {
    return <Gate title="The control centre could not be checked" text="Rokkha's server did not answer. Try again in a minute; the free server may be waking up." />;
  }

  const allowed = ADMIN_SECTIONS.filter((s) => access.permissions.includes(s.perm));
  const current = allowed.find((s) => s.id === section) ? section : "overview";

  return (
    <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
      <nav aria-label="Admin sections" className="lg:sticky lg:top-20 lg:self-start">
        <p className="mb-2 hidden items-center gap-1.5 px-2 font-mono text-[11px] uppercase tracking-wider text-rk-brand-strong lg:flex">
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> Admin Control Centre
        </p>
        {/* Phones and tablets: a compact select; desktops: the full list. */}
        <div className="block lg:hidden">
          <select aria-label="Admin section" value={current} onChange={(e) => go(e.target.value as AdminSection)} className="h-11 w-full rounded-xl border border-rk-line bg-white px-3 text-sm font-semibold text-rk-forest">
            {allowed.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <ul className="hidden space-y-0.5 lg:block">
          {allowed.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => go(s.id)}
                aria-current={current === s.id ? "page" : undefined}
                className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rk-brand ${current === s.id ? "bg-rk-forest text-white" : "text-rk-forest hover:bg-rk-secondary"}`}
              >
                <s.icon className="h-4 w-4 shrink-0" aria-hidden="true" /> {s.label}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 hidden px-2 text-xs text-rk-muted lg:block">Signed in as {user.name}. Every change here is checked by the server and written to the audit log.</p>
      </nav>

      <section id="admin-main" aria-label="Admin content" tabIndex={-1} className="min-w-0 focus:outline-none">
        {current === "overview" && <OverviewSection go={go} />}
        {current === "users" && <UsersSection me={user} />}
        {current === "teams" && <TeamsSection />}
        {current === "data" && <DataSourcesSection />}
        {current === "alerts" && <AlertsSection />}
        {current === "rescue" && <RescueSection />}
        {current === "analytics" && <AnalyticsSection />}
        {current === "health" && <HealthSection />}
        {current === "audit" && <AuditSection />}
        {current === "settings" && <SettingsSection user={user} permissions={access.permissions} />}
        {current === "places" && (
          <div className="space-y-5">
            <header>
              <h1 className="text-2xl font-extrabold tracking-tight text-rk-forest">Facilities</h1>
              <p className="mt-1 max-w-3xl text-sm text-rk-muted">Registered shelters and health facilities by district. Most come from OpenStreetMap and are not checked on the ground (see the shelter data audit).</p>
            </header>
            <AdminPanel user={user} lang={lang} onOpenLogin={onOpenLogin} placesOnly {...placesProps} />
          </div>
        )}
      </section>
    </div>
  );
};

const Gate: React.FC<{ title: string; text: string; children?: React.ReactNode }> = ({ title, text, children }) => (
  <div className="mx-auto max-w-xl rounded-2xl border border-rk-line bg-white p-6 text-center">
    <ShieldAlert className="mx-auto h-6 w-6 text-rk-brand" aria-hidden="true" />
    <h1 className="mt-2 text-xl font-extrabold text-rk-forest">{title}</h1>
    <p className="mt-2 text-sm text-rk-ink">{text}</p>
    {children && <div className="mt-4">{children}</div>}
  </div>
);
