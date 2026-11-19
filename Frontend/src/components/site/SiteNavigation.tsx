"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import {
  ChevronDown,
  FileText,
  House,
  LifeBuoy,
  ListChecks,
  LogIn,
  LogOut,
  Menu,
  Phone,
  ShieldCheck,
  Siren,
  X,
} from "lucide-react";
import type { CitizenView } from "../SideDashboard";
import type { AccountUser } from "../../services/auth";
import type { Need } from "../../services/rescue";
import type { Language } from "../../lib/translations";

// Rokkha top navigation: direct links for the main destinations, with account actions kept separate.

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

type DropdownItem = {
  id: string;
  label: Words;
  desc?: Words;
  icon?: React.ElementType;
  action: NavAction;
};

type NavSection = {
  id: string;
  label: Words;
  action?: NavAction;
  children?: DropdownItem[];
};

function sectionsFor(): NavSection[] {
  return [
    { id: "home", label: { en: "Home", bn: "হোম" }, action: { kind: "view", view: "overview" } },
    { id: "safety", label: { en: "Check your safety", bn: "আপনার এলাকার ঝুঁকি দেখুন" }, action: { kind: "view", view: "map" } },
    { id: "warnings", label: { en: "Current warnings", bn: "বর্তমান সতর্কতা" }, action: { kind: "view", view: "alerts" } },
    {
      id: "aid",
      label: { en: "Emergency Aid", bn: "জরুরি সহায়তা" },
      children: [
        {
          id: "shelters",
          label: { en: "Nearest Shelters", bn: "নিকটস্থ আশ্রয়কেন্দ্র" },
          desc: { en: "Find safe flood shelters & clinics", bn: "কাছের আশ্রয়কেন্দ্র ও ক্লিনিক খুঁজুন" },
          icon: House,
          action: { kind: "view", view: "shelters" },
        },
        {
          id: "contacts",
          label: { en: "Emergency Contacts", bn: "জরুরি যোগাযোগ নম্বর" },
          desc: { en: "Verified rescue and relief helplines", bn: "যাচাই করা উদ্ধার ও ত্রাণ হটলাইন" },
          icon: Phone,
          action: { kind: "view", view: "contacts" },
        },
      ],
    },
    { id: "intelligence", label: { en: "AI performance", bn: "এআই পূর্বাভাসের নির্ভুলতা" }, action: { kind: "view", view: "intelligence" } },
    { id: "rescuers", label: { en: "For rescuers", bn: "উদ্ধারকর্মীদের জন্য" }, action: { kind: "view", view: "login" } },
  ];
}

function isActive(section: NavSection, view: CitizenView): boolean {
  if (section.action?.kind === "view" && section.action.view === view) return true;
  if (section.children) {
    return section.children.some((child) => child.action.kind === "view" && child.action.view === view);
  }
  return false;
}

/** A direct-link item or dropdown in the desktop navigation. */
const DesktopSection: React.FC<{
  section: NavSection;
  active: boolean;
  activeView: CitizenView;
  isBn: boolean;
  onAction: (a: NavAction) => void;
}> = ({ section, active, activeView, isBn, onAction }) => {
  const tr = (w: Words) => (isBn ? w.bn : w.en);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Bangla letters run narrower than Latin at the same size: a step up keeps both menus equally readable.
  const base = `h-10 ${isBn ? "px-3" : "px-2.5 2xl:px-3"} rounded-lg inline-flex items-center gap-1.5 ${
    isBn ? "text-[16px]" : "text-[15px]"
  } font-semibold whitespace-nowrap transition-colors ${
    active ? "text-rk-brand-strong bg-rk-brand-soft" : "text-rk-forest hover:bg-rk-secondary"
  }`;

  if (!section.children) {
    return (
      <button
        type="button"
        className={base}
        aria-current={active ? "page" : undefined}
        onClick={() => section.action && onAction(section.action)}
      >
        {tr(section.label)}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={base}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{tr(section.label)}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl border border-rk-line bg-rk-surface p-2 shadow-[var(--rk-shadow-float)] z-[900] animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="space-y-1">
            {section.children.map((child) => {
              const isChildActive = child.action.kind === "view" && child.action.view === activeView;
              const Icon = child.icon;
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onAction(child.action);
                  }}
                  className={`flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-colors ${
                    isChildActive
                      ? "bg-rk-brand-soft text-rk-brand-strong"
                      : "hover:bg-rk-secondary text-rk-forest"
                  }`}
                >
                  {Icon && (
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isChildActive ? "bg-rk-brand text-white" : "bg-rk-secondary text-rk-forest"
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold leading-snug">{tr(child.label)}</p>
                    {child.desc && (
                      <p className="text-[12px] text-rk-muted leading-tight mt-0.5">{tr(child.desc)}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
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
  const sections = sectionsFor();
  const [menuOpen, setMenuOpen] = useState(false);
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
              active={isActive(section, activeView)}
              activeView={activeView}
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

      {/* Keep the help action easy to reach on phones. */}
      <div className="sm:hidden px-4 pb-3">
        <button
          type="button"
          onClick={() => run({ kind: "help" })}
          className="w-full h-12 rounded-xl bg-rk-brand active:bg-rk-brand-strong text-white text-sm font-bold inline-flex items-center justify-center gap-2"
        >
          <LifeBuoy className="w-5 h-5" aria-hidden="true" />
          {isBn ? "সাহায্য চান" : "Request help"}
        </button>
      </div>

      {menuOpen && (
        <nav id="rk-mobile-menu" aria-label={isBn ? "প্রধান" : "Main"} className="xl:hidden border-t border-rk-line bg-rk-surface max-h-[calc(100vh-8rem)] overflow-y-auto">
          <ul className="max-w-[1240px] mx-auto px-4 py-3 space-y-1">
            {sections.map((section) => {
              if (!section.children) {
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      aria-current={isActive(section, activeView) ? "page" : undefined}
                      onClick={() => section.action && run(section.action)}
                      className={`w-full h-12 text-left px-3 rounded-lg text-base font-bold transition-colors ${
                        isActive(section, activeView)
                          ? "text-rk-brand-strong bg-rk-brand-soft"
                          : "text-rk-ink hover:bg-rk-secondary"
                      }`}
                    >
                      {tr(section.label)}
                    </button>
                  </li>
                );
              }

              // Dropdown Section in Mobile Menu
              return (
                <li key={section.id} className="pt-2 border-t border-rk-line/60">
                  <p className="px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-rk-muted">
                    {tr(section.label)}
                  </p>
                  <div className="mt-1 space-y-1 pl-1">
                    {section.children.map((child) => {
                      const isChildActive = child.action.kind === "view" && child.action.view === activeView;
                      const Icon = child.icon;
                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => run(child.action)}
                          className={`flex w-full items-center gap-3 h-11 px-3 rounded-lg text-[15px] font-semibold transition-colors ${
                            isChildActive
                              ? "text-rk-brand-strong bg-rk-brand-soft"
                              : "text-rk-ink hover:bg-rk-secondary"
                          }`}
                        >
                          {Icon && <Icon className="w-4 h-4 text-rk-brand shrink-0" />}
                          <span>{tr(child.label)}</span>
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
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
