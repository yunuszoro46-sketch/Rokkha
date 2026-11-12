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
          {/* Brand & Purpose */}
          <div className="flex items-center gap-3">
            <img
              src={logoAsset.src}
              alt="Rokkha"
              className="h-10 w-auto object-contain shrink-0"
            />
            <div>
              <div className="font-extrabold text-[#11241C] text-lg sm:text-xl tracking-tight leading-tight">
                {t.footer_title}
              </div>
              <div className="text-xs sm:text-sm text-[#5C6863] mt-0.5">
                {t.footer_sub}
              </div>
            </div>
          </div>

          {/* Actionable Emergency Helplines (Citizen 1-tap call) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm font-bold text-[#11241C]/80 flex items-center gap-1.5 shrink-0">
              <PhoneCall className="w-4 h-4 text-[#C93B2B]" />
              {t.footer_helplines_title}:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="tel:999"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#DFDDD3] hover:border-[#C93B2B] text-xs sm:text-sm font-bold text-[#11241C] hover:text-[#C93B2B] rounded-xl transition-colors shadow-sm"
                title="National Emergency Service"
              >
                📞 {t.footer_helpline_999}
              </a>
              <a
                href="tel:1090"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#DFDDD3] hover:border-[#0284C7] text-xs sm:text-sm font-bold text-[#11241C] hover:text-[#0284C7] rounded-xl transition-colors shadow-sm"
                title="Flood & Disaster IVR"
              >
                📞 {t.footer_helpline_1090}
              </a>
              <a
                href="tel:109"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#DFDDD3] hover:border-[#16A34A] text-xs sm:text-sm font-bold text-[#11241C] hover:text-[#16A34A] rounded-xl transition-colors shadow-sm"
                title="Women & Child Helpline"
              >
                📞 {t.footer_helpline_109}
              </a>
            </div>
          </div>
        </div>

        {/* Middle Tier: Verified Data Badges & Transparency Link */}
        <div className="pt-4 border-t border-[#E5E3D8] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#11241C]/80">
            <span className="font-bold text-[#11241C] flex items-center gap-1 mr-1">
              <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
              {t.footer_sources_title}:
            </span>
            <span className="inline-flex items-center px-2.5 py-1 bg-white border border-[#DFDDD3] rounded-lg text-xs font-medium text-[#374151] shadow-2xs">
              Copernicus Sentinel-1 SAR
            </span>
            <span className="inline-flex items-center px-2.5 py-1 bg-white border border-[#DFDDD3] rounded-lg text-xs font-medium text-[#374151] shadow-2xs">
              JRC GloFAS Hydrology
            </span>
            <span className="inline-flex items-center px-2.5 py-1 bg-white border border-[#DFDDD3] rounded-lg text-xs font-medium text-[#374151] shadow-2xs">
              ECMWF ERA5 / NOAA GFS
            </span>
            <span className="inline-flex items-center px-2.5 py-1 bg-white border border-[#DFDDD3] rounded-lg text-xs font-medium text-[#374151] shadow-2xs">
              UNOSAT Satellite Flood
            </span>
          </div>

          {onOpenAbout && (
            <button
              onClick={onOpenAbout}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#1F513F] hover:text-[#11241C] hover:underline self-start md:self-auto cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-[#1F513F]" />
              {t.footer_about_link}
            </button>
          )}
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
