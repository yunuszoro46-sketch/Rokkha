"use client";

import React from "react";
import logoAsset from "@/assets/logo.png";
import { Language, UI_TEXT, toBnNum } from "@/lib/translations";
import {
  Home,
  Map,
  AlertOctagon,
  LifeBuoy,
  Info,
  ChevronLeft,
  ChevronRight,
  Siren,
  ShieldCheck,
} from "lucide-react";

export type CitizenView =
  | "overview"
  | "map"
  | "alerts"
  | "satellite"
  | "hydro"
  | "shelters"
  | "rescue"
  | "admin"
  | "login";

interface SideDashboardProps {
  activeView: CitizenView;
  onSelectView: (view: CitizenView) => void;
  onOpenAbout: () => void;
  activeAlertCount: number;
  isBackendConnected: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  lang?: Language;
  /** Role of the logged-in account; decides which extra pages are listed. */
  role?: string | null;
}

export const SideDashboard: React.FC<SideDashboardProps> = ({
  activeView,
  onSelectView,
  onOpenAbout,
  activeAlertCount,
  isBackendConnected,
  isCollapsed,
  onToggleCollapse,
  lang = "en",
  role = null,
}) => {
  const t = UI_TEXT[lang];

  // Navigation items strictly mapped to Frontend API Guide sections
  const navItems = [
    {
      id: "overview" as CitizenView,
      label: t.side_overview,
      icon: Home,
    },
    {
      id: "map" as CitizenView,
      label: t.side_map,
      icon: Map,
    },
    {
      id: "alerts" as CitizenView,
      label: t.side_alerts,
      icon: AlertOctagon,
      badge:
        activeAlertCount > 0
          ? lang === "bn"
            ? toBnNum(activeAlertCount)
            : activeAlertCount
          : undefined,
    },
    {
      id: "shelters" as CitizenView,
      label: t.side_shelters,
      icon: LifeBuoy,
    },
    // Listed only for the roles that can use them. The backend checks the
    // role again on every call, so hiding these is a convenience, not the lock.
    ...(role === "rescuer" || role === "admin"
      ? [
          {
            id: "rescue" as CitizenView,
            label: lang === "bn" ? "সাহায্যের অনুরোধ (উদ্ধারকারী)" : "Requests for Help (Rescuers)",
            icon: Siren,
          },
        ]
      : []),
    ...(role === "admin"
      ? [
          {
            id: "admin" as CitizenView,
            label: lang === "bn" ? "অ্যাডমিন: ভূমিকা ও স্থান" : "Admin: Roles & Places",
            icon: ShieldCheck,
          },
        ]
      : []),
  ];

  return (
    <aside
      className={`fixed top-0 left-0 h-screen z-40 bg-[#11241C] text-white flex flex-col justify-between border-r border-[#1F382D] transition-all duration-300 shadow-2xl ${
        isCollapsed ? "w-16 sm:w-20" : "w-64 lg:w-72"
      }`}
    >
      {/* Top Header - Clean Controls (Logo & Title removed as requested) */}
      <div>
        <div
          className={`h-[68px] px-4 flex items-center ${
            isCollapsed ? "justify-center" : "justify-end"
          } border-b border-[#1F382D]`}
        >
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition hidden md:block"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}
          </button>
        </div>

        {/* Navigation Items (16px Body Font) */}
        <nav className="p-4 space-y-2.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center space-x-4 px-4 py-3 rounded-xl text-left transition group relative ${
                  isActive
                    ? "bg-[#223A2F] text-white shadow-md border border-[#C69A50]/60"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon
                  size={20}
                  className={`flex-shrink-0 transition ${
                    isActive
                      ? "text-[#C69A50]"
                      : "text-white/70 group-hover:text-white"
                  }`}
                />
                {!isCollapsed && (
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="text-base font-semibold leading-snug text-white">
                      {item.label}
                    </span>
                    {item.badge !== undefined && (
                      <span className="bg-[#C9443A] text-white text-sm font-bold px-2.5 py-0.5 rounded-full ml-2">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
                {isCollapsed && item.badge !== undefined && (
                  <span className="absolute top-2.5 right-2.5 w-3 h-3 rounded-full bg-[#C9443A] border-2 border-[#11241C]"></span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom spacer (Removed About & Data Limits and Sensor Feed as requested) */}
      <div className="p-2"></div>
    </aside>
  );
};
