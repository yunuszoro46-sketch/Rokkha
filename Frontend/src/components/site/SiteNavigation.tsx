"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, FileText, LifeBuoy, ListChecks, LogIn, LogOut, Menu, ShieldCheck, Siren, X } from "lucide-react";
import type { CitizenView } from "../SideDashboard";
import type { AccountUser } from "../../services/auth";
import type { Need } from "../../services/rescue";
import type { Language } from "../../lib/translations";

// Rokkha top navigation (docs/ROKKHA_DESIGN_SYSTEM.md §7): logo left; on desktop
// a few sections with small dropdowns and a "Request help" button on the right;
// on phones a menu button with tap-to-expand sections. Every item leads to
// something that exists and works.

type Words = { en: string; bn: string };
export type NavAction =
  | { kind: "view"; view: CitizenView }
  | { kind: "help"; needs?: Need[] }
  | { kind: "track" }
  | { kind: "about" }
  /** Open the map ready to check one exact place (tap, GPS or search). */
  | { kind: "check" }
  | { kind: "anchor"; view: CitizenView; id: string }
  | { kind: "external"; href: string };

type NavItem = { label: Words; hint?: Words; action: NavAction };
type NavSection = { id: string; label: Words; items: NavItem[]; action?: NavAction };

function sectionsFor(user: AccountUser | null): NavSection[] {
  const staff = !!user && (user.role === "rescuer" || user.role === "admin");
  const rescueItems: NavItem[] = staff
    ? [{ label: { en: "Rescue board", bn: "উদ্ধার বোর্ড" }, hint: { en: "Shared requests for your team", bn: "সব উদ্ধারকারী দলের একই অনুরোধ-তালিকা" }, action: { kind: "view", view: "rescue" } }]
    : [{ label: { en: "Rescue team login", bn: "উদ্ধারকারী দলের লগ ইন" }, hint: { en: "For registered rescue organisations", bn: "নিবন্ধিত উদ্ধারকারী সংস্থার জন্য" }, action: { kind: "view", view: "login" } }];
  if (user?.role === "admin") {
    rescueItems.push({ label: { en: "Admin: teams and accounts", bn: "অ্যাডমিন: দল ও অ্যাকাউন্ট" }, action: { kind: "view", view: "admin" } });
  }

  // Order follows the product: flood intelligence first, assistance second.
  return [
    { id: "home", label: { en: "Home", bn: "হোম" }, items: [], action: { kind: "view", view: "overview" } },
    {
      id: "intel",
      label: { en: "Flood intelligence", bn: "বন্যা তথ্য" },
      items: [
        { label: { en: "Forecast map", bn: "পূর্বাভাসের মানচিত্র" }, hint: { en: "Every district by today's forecast level", bn: "আজকের পূর্বাভাস অনুযায়ী প্রতিটি জেলা" }, action: { kind: "view", view: "map" } },
        { label: { en: "Check a place", bn: "একটি জায়গা যাচাই" }, hint: { en: "Modelled depth and past flooding at a spot", bn: "একটি জায়গায় মডেলের গভীরতা ও আগের বন্যা" }, action: { kind: "check" } },
        { label: { en: "How Rokkha's intelligence works", bn: "রক্ষার তথ্য ও মডেল" }, hint: { en: "Data, model, evidence and limits", bn: "তথ্য, মডেল, প্রমাণ ও সীমাবদ্ধতা" }, action: { kind: "view", view: "intelligence" } },
        { label: { en: "Model performance", bn: "মডেলের কার্যকারিতা" }, action: { kind: "anchor", view: "intelligence", id: "performance" } },
      ],
    },
    {
      id: "updates",
      label: { en: "Forecasts & alerts", bn: "পূর্বাভাস ও সতর্কতা" },
      items: [
        { label: { en: "Current warnings", bn: "বর্তমান সতর্কতা" }, hint: { en: "Districts on Watch or Alert", bn: "নজরদারি বা সতর্কতা স্তরের জেলা" }, action: { kind: "view", view: "alerts" } },
        { label: { en: "Flood safety guidance", bn: "বন্যায় নিরাপত্তা" }, action: { kind: "anchor", view: "overview", id: "safety-title" } },
        { label: { en: "Official warnings (FFWC)", bn: "সরকারি সতর্কবার্তা (FFWC)" }, hint: { en: "Opens ffwc.gov.bd", bn: "ffwc.gov.bd খোলে" }, action: { kind: "external", href: "https://www.ffwc.gov.bd/" } },
      ],
    },
    {
      id: "help",
      label: { en: "Get help", bn: "সাহায্য" },
      items: [
        { label: { en: "Emergency rescue", bn: "জরুরি উদ্ধার" }, hint: { en: "Trapped by water, need to get out", bn: "পানিতে আটকা, বের হতে হবে" }, action: { kind: "help", needs: ["evacuation"] } },
        { label: { en: "Food and drinking water", bn: "খাবার ও খাবার পানি" }, action: { kind: "help", needs: ["food_water"] } },
        { label: { en: "Medical assistance", bn: "চিকিৎসা সহায়তা" }, action: { kind: "help", needs: ["medical"] } },
        { label: { en: "Shelter and housing safety", bn: "আশ্রয় ও ঘরের নিরাপত্তা" }, hint: { en: "Your house is unsafe", bn: "ঘর নিরাপদ নয়" }, action: { kind: "help", needs: ["house_danger"] } },
        { label: { en: "Find a nearby shelter", bn: "কাছের আশ্রয়কেন্দ্র" }, action: { kind: "view", view: "shelters" } },
        { label: { en: "Rescue and relief phone numbers", bn: "উদ্ধার ও ত্রাণের ফোন নম্বর" }, hint: { en: "Verified public numbers", bn: "যাচাই করা সরকারি ও প্রতিষ্ঠানের নম্বর" }, action: { kind: "view", view: "contacts" } },
        { label: { en: "Track my request", bn: "আমার অনুরোধের খবর" }, action: { kind: "track" } },
      ],
    },
    { id: "teams", label: { en: "Rescue teams", bn: "উদ্ধারকারী দল" }, items: rescueItems },
    {
      id: "about",
      label: { en: "About", bn: "পরিচিতি" },
      items: [
        { label: { en: "About Rokkha and its limits", bn: "রক্ষা ও এর সীমাবদ্ধতা" }, action: { kind: "about" } },
      ],
    },
  ];
}

function isActive(section: NavSection, view: CitizenView): boolean {
  if (section.action?.kind === "view") return section.action.view === view;
  return section.items.some((i) => i.action.kind === "view" && i.action.view === view);
}

/** One desktop section with a dropdown: hover or click opens; Escape, leaving or tabbing away closes. */
const DesktopSection: React.FC<{
  section: NavSection;
  active: boolean;
  open: boolean;
  setOpen: (id: string | null) => void;
  isBn: boolean;
  onAction: (a: NavAction) => void;
}> = ({ section, active, open, setOpen, isBn, onAction }) => {
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);
  const tr = (w: Words) => (isBn ? w.bn : w.en);
  // Bangla letters run narrower than Latin at the same size: a step up keeps both menus equally readable.
  const base = `h-10 ${isBn ? "px-3.5" : "px-2.5 2xl:px-3"} rounded-lg inline-flex items-center gap-1 ${isBn ? "text-[16.5px]" : "text-[15px]"} font-semibold whitespace-nowrap transition-colors ${
    active || open ? "text-rk-brand-strong bg-rk-brand-soft" : "text-rk-forest hover:bg-rk-secondary"
  }`;

  if (section.items.length === 0 && section.action) {
    return (
      <button type="button" className={base} aria-current={active ? "page" : undefined} onClick={() => onAction(section.action!)}>
        {tr(section.label)}
      </button>
    );
  }

  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(section.id);
      }}
      onMouseLeave={() => {
        cancelClose();
        closeTimer.current = window.setTimeout(() => setOpen(null), 150);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(null);
          buttonRef.current?.focus();
        }
      }}
    >
      <button ref={buttonRef} type="button" className={base} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(open ? null : section.id)}>
        {tr(section.label)}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <ul id={menuId} className="absolute right-0 top-full mt-1 w-72 rounded-xl border border-rk-line bg-rk-surface shadow-[0_8px_24px_rgb(23_63_70/0.10)] p-1.5 z-[900]">
          {section.items.map((item) => (
            <li key={item.label.en}>
              {item.action.kind === "external" ? (
                <a
                  href={item.action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(null)}
                  className="block rounded-lg px-3 py-2.5 hover:bg-rk-brand-soft focus-visible:bg-rk-brand-soft"
                >
                  <span className="block text-[15px] font-semibold text-rk-forest">{tr(item.label)}</span>
                  {item.hint && <span className="block text-[13px] text-rk-muted">{tr(item.hint)}</span>}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(null);
                    onAction(item.action);
                  }}
                  className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-rk-brand-soft focus-visible:bg-rk-brand-soft"
                >
                  <span className="block text-[15px] font-semibold text-rk-forest">{tr(item.label)}</span>
                  {item.hint && <span className="block text-[13px] text-rk-muted">{tr(item.hint)}</span>}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ---------- Account (profile) menu ----------
// Identity shown here comes only from the logged-in session's /auth/me answer: name, role and team.
// The backend stores no profile photo, so the avatar is the name's initials.
const ROLE_WORDS: Record<AccountUser["role"], Words> = {
  user: { en: "User", bn: "সাধারণ ব্যবহারকারী" },
  rescuer: { en: "Rescuer", bn: "উদ্ধারকারী" },
  admin: { en: "Admin", bn: "অ্যাডমিন" },
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  // First letter (or digit) of the first and last words; brackets and other marks are skipped.
  const firstLetter = (w: string) => Array.from(w).find((ch) => /[A-Za-z0-9\u0980-\u09FF]/.test(ch)) || "";
  const words = parts.filter((w) => firstLetter(w));
  const letters = (words.length > 1 ? [words[0], words[words.length - 1]] : words).map(firstLetter);
  return letters.join("").toUpperCase() || "?";
}

function accountItems(user: AccountUser): Array<{ label: Words; icon: React.ElementType; action: NavAction }> {
  const items: Array<{ label: Words; icon: React.ElementType; action: NavAction }> = [
    { label: { en: "My place and flood report", bn: "আমার স্থান ও বন্যা প্রতিবেদন" }, icon: FileText, action: { kind: "anchor", view: "alerts", id: "my-report" } },
    { label: { en: "My help requests", bn: "আমার সাহায্যের অনুরোধ" }, icon: ListChecks, action: { kind: "track" } },
  ];
  if (user.role === "rescuer" || user.role === "admin") items.push({ label: { en: "Rescue board", bn: "উদ্ধার বোর্ড" }, icon: Siren, action: { kind: "view", view: "rescue" } });
  if (user.role === "admin") items.push({ label: { en: "Admin Control Centre", bn: "অ্যাডমিন কন্ট্রোল সেন্টার" }, icon: ShieldCheck, action: { kind: "view", view: "admin" } });
  return items;
}

const Avatar: React.FC<{ name: string; size?: "sm" | "md" }> = ({ name, size = "sm" }) => (
  <span aria-hidden="true" className={`${size === "md" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs"} shrink-0 rounded-full bg-rk-forest text-white font-bold inline-flex items-center justify-center`}>
    {initialsOf(name)}
  </span>
);

const AccountMenu: React.FC<{ user: AccountUser; isBn: boolean; onAction: (a: NavAction) => void; onLogOut: () => void }> = ({ user, isBn, onAction, onLogOut }) => {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const tr = (w: Words) => (isBn ? w.bn : w.en);
  const role = tr(ROLE_WORDS[user.role]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => boxRef.current && !boxRef.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const go = (a: NavAction) => {
    setOpen(false);
    onAction(a);
  };

  return (
    <div ref={boxRef} className="relative hidden xl:block">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${isBn ? "অ্যাকাউন্ট" : "Account"}: ${user.name}, ${role}`}
        onClick={() => setOpen((v) => !v)}
        className="h-11 pl-1.5 pr-2 rounded-xl border border-rk-line bg-rk-surface inline-flex items-center gap-2 text-left transition-colors hover:bg-rk-secondary active:bg-rk-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rk-brand focus-visible:ring-offset-2"
      >
        <Avatar name={user.name} />
        {/* Wide screens show who is logged in; laptops keep the menu room (the name is in the label and the panel). */}
        <span className="hidden 2xl:flex flex-col leading-tight max-w-[10rem]">
          <span className="truncate text-sm font-bold text-rk-ink">{user.name}</span>
          <span className="truncate text-xs text-rk-muted">{role}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-rk-muted motion-safe:transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div id={menuId} className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-rk-line bg-rk-surface p-2 shadow-[var(--rk-shadow-float)] z-[900]">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={user.name} size="md" />
            <div className="min-w-0">
              <p className="truncate font-bold text-rk-ink">{user.name}</p>
              <p className="truncate text-xs text-rk-muted">{user.email}</p>
              <p className="mt-0.5 text-xs font-semibold text-rk-brand-strong">
                {role}
                {user.team ? ` · ${user.team.name}` : ""}
              </p>
            </div>
          </div>
          <ul className="mt-1 border-t border-rk-line pt-1">
            {accountItems(user).map((item) => (
              <li key={item.label.en}>
                <button type="button" onClick={() => go(item.action)} className="flex w-full min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-left text-[15px] font-semibold text-rk-forest transition-colors hover:bg-rk-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rk-brand">
                  <item.icon className="w-4 h-4 text-rk-brand" aria-hidden="true" /> {tr(item.label)}
                </button>
              </li>
            ))}
            <li className="mt-1 border-t border-rk-line pt-1">
              <button type="button" onClick={() => (setOpen(false), onLogOut())} className="flex w-full min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-left text-[15px] font-semibold text-rk-ink transition-colors hover:bg-rk-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rk-brand">
                <LogOut className="w-4 h-4" aria-hidden="true" /> {isBn ? "লগ আউট" : "Log out"}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export const SiteHeader: React.FC<{
  lang: Language;
  activeView: CitizenView;
  user: AccountUser | null;
  logoSrc: string;
  onAction: (action: NavAction) => void;
  onToggleLanguage: () => void;
  onLogOut: () => void;
}> = ({ lang, activeView, user, logoSrc, onAction, onToggleLanguage, onLogOut }) => {
  const isBn = lang === "bn";
  const tr = (w: Words) => (isBn ? w.bn : w.en);
  const sections = sectionsFor(user);
  const [openId, setOpenId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>("intel");
  const menuButton = useRef<HTMLButtonElement>(null);

  // Phone menu: Escape closes it and gives focus back to the menu button.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const run = (action: NavAction) => {
    setMenuOpen(false);
    setOpenId(null);
    onAction(action);
  };

  return (
    <header className="rk-site-header w-full border-b border-rk-line bg-rk-surface/95 backdrop-blur sticky top-0 z-[800]">
      <div className="max-w-[1320px] 2xl:max-w-[1480px] mx-auto px-4 md:px-6 h-16 flex items-center gap-3">
        <button type="button" onClick={() => run({ kind: "view", view: "overview" })} aria-label={isBn ? "রক্ষা হোম" : "Rokkha home"} className="shrink-0 flex items-center">
          <img src={logoSrc} alt="Rokkha" className="h-9 w-auto" />
        </button>

        <nav aria-label={isBn ? "প্রধান" : "Main"} className="hidden xl:flex flex-1 min-w-0 items-center [justify-content:safe_center] gap-0.5">
          {sections.map((section) => (
            <DesktopSection
              key={section.id}
              section={section}
              active={sections.find((sec) => isActive(sec, activeView))?.id === section.id}
              open={openId === section.id}
              setOpen={setOpenId}
              isBn={isBn}
              onAction={run}
            />
          ))}
        </nav>

        <div className="ml-auto xl:ml-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleLanguage}
            className="h-11 px-3 rounded-xl border border-rk-line bg-rk-surface text-sm font-bold text-rk-ink"
            aria-label={isBn ? "Switch to English" : "বাংলায় দেখুন"}
            lang={isBn ? "en" : "bn"}
          >
            {isBn ? "EN" : "বাংলা"}
          </button>
          <button
            type="button"
            onClick={() => run({ kind: "help" })}
            className="hidden sm:inline-flex h-11 px-4 rounded-xl bg-rk-brand hover:bg-rk-brand-strong text-white font-bold items-center gap-2 whitespace-nowrap"
          >
            <LifeBuoy className="w-5 h-5" aria-hidden="true" />
            {isBn ? "সাহায্য চান" : "Request help"}
          </button>
          {user && <AccountMenu user={user} isBn={isBn} onAction={run} onLogOut={onLogOut} />}
          <button
            ref={menuButton}
            type="button"
            className="xl:hidden h-11 w-11 rounded-xl border border-rk-line bg-rk-surface inline-flex items-center justify-center text-rk-ink"
            aria-expanded={menuOpen}
            aria-controls="rk-mobile-menu"
            aria-label={menuOpen ? (isBn ? "মেনু বন্ধ করুন" : "Close menu") : isBn ? "মেনু খুলুন" : "Open menu"}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Phones: Request help always visible under the bar (the homepage hero has its own). */}
      <div className={`sm:hidden px-4 pb-3 ${activeView === "overview" ? "hidden" : ""}`}>
        <button
          type="button"
          onClick={() => run({ kind: "help" })}
          className="w-full h-12 rounded-xl bg-rk-brand active:bg-rk-brand-strong text-white text-base font-bold inline-flex items-center justify-center gap-2"
        >
          <LifeBuoy className="w-5 h-5" aria-hidden="true" />
          {isBn ? "সাহায্য চান — অ্যাকাউন্ট লাগবে না" : "Request help — no account needed"}
        </button>
      </div>

      {menuOpen && (
        <nav id="rk-mobile-menu" aria-label={isBn ? "প্রধান" : "Main"} className="xl:hidden border-t border-rk-line bg-rk-surface max-h-[calc(100vh-8rem)] overflow-y-auto">
          <ul className="max-w-[1240px] mx-auto px-4 py-3 space-y-1">
            {sections.map((section) =>
              section.items.length === 0 && section.action ? (
                <li key={section.id}>
                  <button type="button" onClick={() => run(section.action!)} className="w-full h-12 text-left px-3 rounded-lg text-base font-bold text-rk-ink hover:bg-rk-secondary">
                    {tr(section.label)}
                  </button>
                </li>
              ) : (
                <li key={section.id}>
                  <button
                    type="button"
                    aria-expanded={expanded === section.id}
                    aria-controls={`rk-m-${section.id}`}
                    onClick={() => setExpanded(expanded === section.id ? null : section.id)}
                    className="w-full h-12 px-3 rounded-lg flex items-center justify-between text-base font-bold text-rk-ink hover:bg-rk-secondary"
                  >
                    {tr(section.label)}
                    <ChevronDown className={`w-5 h-5 transition-transform ${expanded === section.id ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  {expanded === section.id && (
                    <ul id={`rk-m-${section.id}`} className="pl-3 pb-2">
                      {section.items.map((item) => (
                        <li key={item.label.en}>
                          {item.action.kind === "external" ? (
                            <a href={item.action.href} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} className="flex w-full min-h-11 items-center px-3 py-2 rounded-lg text-[15px] font-semibold text-rk-ink hover:bg-rk-brand-soft">
                              {tr(item.label)}
                            </a>
                          ) : (
                            <button type="button" onClick={() => run(item.action)} className="w-full min-h-11 text-left px-3 py-2 rounded-lg text-[15px] font-semibold text-rk-ink hover:bg-rk-brand-soft">
                              {tr(item.label)}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            )}
            <li className="pt-2 border-t border-rk-line">
              {user ? (
                <div aria-label={isBn ? "অ্যাকাউন্ট" : "Account"} role="group">
                  <div className="flex items-center gap-3 px-3 py-2">
                    <Avatar name={user.name} size="md" />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-rk-ink">{user.name}</p>
                      <p className="truncate text-xs text-rk-muted">{tr(ROLE_WORDS[user.role])}{user.team ? ` · ${user.team.name}` : ""}</p>
                    </div>
                  </div>
                  {accountItems(user).map((item) => (
                    <button key={item.label.en} type="button" onClick={() => run(item.action)} className="w-full min-h-11 text-left px-3 py-2 rounded-lg text-[15px] font-semibold text-rk-ink hover:bg-rk-brand-soft inline-flex items-center gap-2">
                      <item.icon className="w-4 h-4 text-rk-brand" aria-hidden="true" /> {tr(item.label)}
                    </button>
                  ))}
                  <button type="button" onClick={() => { setMenuOpen(false); onLogOut(); }} className="w-full h-12 text-left px-3 rounded-lg text-base font-semibold text-rk-ink inline-flex items-center gap-2 hover:bg-rk-secondary">
                    <LogOut className="w-5 h-5" aria-hidden="true" />
                    {isBn ? "লগ আউট" : "Log out"}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => run({ kind: "view", view: "login" })} className="w-full h-12 text-left px-3 rounded-lg text-base font-semibold text-rk-ink inline-flex items-center gap-2">
                  <LogIn className="w-5 h-5" aria-hidden="true" />
                  {isBn ? "লগ ইন" : "Log in"}
                </button>
              )}
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
};
