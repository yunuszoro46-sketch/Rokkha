import React from "react";
import logoAsset from "@/assets/logo.png";
import { Language, UI_TEXT, toBnNum } from "../lib/translations";
import { PhoneCall, ShieldCheck, Info } from "lucide-react";

interface AttributionFooterProps {
  lang?: Language;
  onOpenAbout?: () => void;
}

export const AttributionFooter: React.FC<AttributionFooterProps> = ({
  lang = "en",
  onOpenAbout,
}) => {
  const t = UI_TEXT[lang] || UI_TEXT.en;
  const isBn = lang === "bn";
  const currentYear = isBn ? toBnNum(new Date().getFullYear()) : new Date().getFullYear();

  return (
    <footer className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 text-[#11241C] pb-12 mt-4">
      <div className="w-full pt-6 border-t border-[#DFDDD3] space-y-6">
        {/* Top Tier: Brand, Helplines, and Data Feeds */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Brand & Purpose: Rokkha Flood Intelligence bottom of logo Rokkha */}
          <div className="flex flex-col items-start gap-1">
            <img
              src={logoAsset.src}
              alt="Rokkha"
              className="h-9 w-auto object-contain shrink-0"
            />
            <div>
              <div className="font-extrabold text-[#11241C] text-base sm:text-lg tracking-tight leading-tight mt-1">
                {t.footer_title}
              </div>
              <div className="text-xs sm:text-sm text-[#5C6863] mt-0.5">
                {t.footer_sub}
              </div>
            </div>
          </div>

          {/* Actionable Emergency Helplines (Citizen 1-tap call) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-[11px] font-bold text-[#11241C]/80 flex items-center gap-1.5 shrink-0 whitespace-nowrap">
              <PhoneCall className="w-3 h-3 text-[#C93B2B]" />
              {t.footer_helplines_title}:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <a
                href="tel:999"
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-[#DFDDD3] hover:border-[#C93B2B] text-[11px] font-bold text-[#11241C] hover:text-[#C93B2B] rounded-md transition-colors shadow-2xs"
                title="National Emergency Service"
              >
                📞 {t.footer_helpline_999}
              </a>
              <a
                href="tel:1090"
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-[#DFDDD3] hover:border-[#0284C7] text-[11px] font-bold text-[#11241C] hover:text-[#0284C7] rounded-md transition-colors shadow-2xs"
                title="Flood & Disaster IVR"
              >
                📞 {t.footer_helpline_1090}
              </a>
              <a
                href="tel:109"
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-[#DFDDD3] hover:border-[#16A34A] text-[11px] font-bold text-[#11241C] hover:text-[#16A34A] rounded-md transition-colors shadow-2xs"
                title="Women & Child Helpline"
              >
                📞 {t.footer_helpline_109}
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Tier: Copyright & Coordinates */}
        <div className="pt-3 border-t border-[#E5E3D8] flex flex-col sm:flex-row items-center justify-between text-xs text-[#5C6863] gap-2">
          <div>
            &copy; {currentYear} {t.footer_copyright}
          </div>
          <div className="text-xs font-medium text-[#5C6863]">
            {t.footer_coords_note}
          </div>
        </div>
      </div>
    </footer>
  );
};
