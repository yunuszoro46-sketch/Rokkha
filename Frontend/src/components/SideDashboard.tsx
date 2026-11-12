"use client";

import React from "react";
import logoAsset from "@/assets/logo.png";
import { Language, UI_TEXT, toBnNum } from "@/lib/translations";
import {
  Home,
  Map,
  AlertOctagon,
  CloudRain,
  Satellite,
  LifeBuoy,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export type CitizenView =
  | "overview"
  | "map"
  | "alerts"
  | "satellite"
  | "hydro"
  | "shelters";

interface SideDashboardProps {
  activeView: CitizenView;
  onSelectView: (view: CitizenView) => void;
  onOpenAbout: () => void;
  activeAlertCount: number;
  isBackendConnected: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  lang?: Language;
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
      id: "satellite" as CitizenView,
      label: t.side_satellite,
      icon: Satellite,
    },
    {
      id: "hydro" as CitizenView,
      label: t.side_hydro,
      icon: CloudRain,
    },
    {
      id: "shelters" as CitizenView,
      label: t.side_shelters,
      icon: LifeBuoy,
    },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 h-screen z-40 bg-[#11241C] text-white flex flex-col justify-between border-r border-[#1F382D] transition-all duration-300 shadow-2xl ${
        isCollapsed ? "w-20" : "w-80"
      }`}
    >
      {/* Top Brand Header */}
      <div>
        <div className="h-[92px] px-5 flex items-center justify-between border-b border-[#1F382D]">
          <div
            className="flex items-center space-x-3 overflow-hidden cursor-pointer"
            onClick={() => onSelectView("overview")}
          >
            {isCollapsed ? (
              <div className="w-11 h-11 rounded-xl bg-white p-1 flex items-center justify-center flex-shrink-0 shadow-sm">
                <img
                  src={logoAsset.src}
                  alt="Rokkha"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <div className="bg-white rounded-xl px-3.5 py-2 shadow-sm flex items-center">
                  <img
                    src={logoAsset.src}
                    alt="Rokkha"
                    className="h-9 w-auto object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition hidden md:block"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}
          </button>
        </div>

        {/* Navigation Items (Strict 16px text-base) */}
        <nav className="p-4 space-y-2.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center space-x-4 px-4 py-3.5 rounded-xl text-left transition group relative ${
                  isActive
                    ? "bg-[#223A2F] text-white shadow-md border border-[#C69A50]/60"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon
                  size={22}
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
                      <span className="bg-[#C9443A] text-white text-base font-bold px-2.5 py-0.5 rounded-full ml-2">
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

      {/* Bottom Actions & Status */}
      <div className="p-4 border-t border-[#1F382D] space-y-3">
        <button
          onClick={onOpenAbout}
          className="w-full flex items-center space-x-3.5 px-4 py-3 rounded-xl text-base font-semibold text-white/85 hover:bg-white/10 hover:text-white transition border border-transparent hover:border-white/15"
          title="Data Transparency & Limits"
        >
          <Info size={22} className="text-white/75 flex-shrink-0" />
          {!isCollapsed && (
            <span className="text-left truncate">{t.side_about}</span>
          )}
        </button>

        <div
          className={`pt-3 flex items-center ${
            isCollapsed ? "justify-center" : "justify-between px-3"
          } text-base text-white/70 border-t border-[#1F382D]`}
        >
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
            {!isCollapsed && (
              <span className="font-medium text-base text-white/90 tracking-wide">
                {isBackendConnected ? t.side_status_feed : t.side_status_active}
              </span>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
