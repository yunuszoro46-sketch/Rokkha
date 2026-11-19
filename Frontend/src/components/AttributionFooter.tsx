import React from "react";
import logoAsset from "@/assets/logo.png";
import { Language, UI_TEXT, toBnNum } from "../lib/translations";
import { ShieldCheck, Info } from "lucide-react";

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
    <footer className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 text-rk-ink pb-12 mt-4">
      <div className="w-full pt-6 border-t border-rk-line space-y-6">
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
              <div className="font-extrabold text-rk-ink text-base sm:text-lg tracking-tight leading-tight mt-1">
                {t.footer_title}
              </div>
              <div className="text-xs sm:text-sm text-rk-muted mt-0.5">
                {t.footer_sub}
              </div>
            </div>
          </div>

          {/* Secondary emergency reference (verified on bangladesh.gov.bd, 18 Nov 2026). */}
          <p className="text-sm text-rk-muted">
            {isBn ? "জীবন ঝুঁকিতে থাকলে জাতীয় জরুরি সেবা " : "If a life is in danger, call the national emergency number "}
            <a href="tel:999" className="font-bold text-rk-ink underline">{isBn ? "৯৯৯" : "999"}</a>
            {isBn ? "। বন্যার রেকর্ড করা সতর্কবার্তা: " : ". Recorded flood warnings: "}
            <a href="tel:1090" className="font-bold text-rk-ink underline">{isBn ? "১০৯০" : "1090"}</a>
            {isBn ? " (৫ চাপুন)।" : " (press 5)."}
          </p>
        </div>

        {/* Bottom Tier: Copyright & Coordinates */}
        <div className="pt-3 border-t border-rk-line flex flex-col sm:flex-row items-center justify-between text-xs text-rk-muted gap-2">
          <div>
            &copy; {currentYear} {t.footer_copyright}
          </div>
          <div className="text-xs font-medium text-rk-muted">
            {isBn ? "এটি সরকারি জরুরি সেবা নয়।" : "Rokkha is not a government emergency service."}
          </div>
        </div>
      </div>
    </footer>
  );
};
