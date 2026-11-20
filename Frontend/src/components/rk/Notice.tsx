import React from "react";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";

// Rokkha design system: one panel for every message (design-system/rokkha/MASTER.md §5).
export type Tone = "info" | "warning" | "danger" | "success" | "neutral";

const TONE: Record<Tone, { box: string; icon: React.ElementType }> = {
  info: { box: "bg-rk-info-soft border-rk-info/30 text-rk-info", icon: Info },
  warning: { box: "bg-rk-warning-soft border-rk-warning-accent text-rk-warning", icon: AlertTriangle },
  danger: { box: "bg-rk-danger-soft border-rk-danger-accent text-rk-danger", icon: OctagonAlert },
  success: { box: "bg-rk-success-soft border-rk-success/30 text-rk-success", icon: CheckCircle2 },
  neutral: { box: "bg-rk-surface border-rk-line text-rk-ink", icon: Info },
};

export const Notice: React.FC<{
  tone?: Tone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** "alert" only for errors that need attention now; everything else is a polite status. */
  live?: "status" | "alert" | "none";
  className?: string;
  action?: React.ReactNode;
}> = ({ tone = "neutral", title, children, live = "status", className = "", action }) => {
  const { box, icon: Icon } = TONE[tone];
  return (
    <div
      role={live === "none" ? undefined : live}
      className={`flex gap-3 rounded-xl border px-4 py-3 ${box} ${className}`}
    >
      <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-[15px] leading-snug">
        {title && <div className="font-bold">{title}</div>}
        {children && <div className={title ? "mt-0.5 text-rk-ink" : "text-rk-ink font-medium"}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
};

/** Small pill with an icon and a word: never colour alone. */
export const StatusBadge: React.FC<{ tone: Tone; icon?: React.ElementType; children: React.ReactNode }> = ({
  tone,
  icon,
  children,
}) => {
  const Icon = icon || TONE[tone].icon;
  const color = {
    info: "bg-rk-info-soft text-rk-info",
    warning: "bg-rk-warning-soft text-rk-warning",
    danger: "bg-rk-danger-soft text-rk-danger",
    success: "bg-rk-success-soft text-rk-success",
    neutral: "bg-rk-secondary text-rk-muted",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-bold ${color}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {children}
    </span>
  );
};
