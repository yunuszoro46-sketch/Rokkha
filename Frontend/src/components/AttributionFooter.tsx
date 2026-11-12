import React from "react";
import logoAsset from "@/assets/logo.png";
import { Language, UI_TEXT, toBnNum } from "../lib/translations";

interface AttributionFooterProps {
  lang?: Language;
}

export const AttributionFooter: React.FC<AttributionFooterProps> = ({
  lang = "en",
}) => {
  const t = UI_TEXT[lang] || UI_TEXT.en;
  const isBn = lang === "bn";
  const currentYear = isBn ? toBnNum(new Date().getFullYear()) : new Date().getFullYear();

  return (
    <footer className="w-full border-t border-brand-limestone bg-brand-white text-brand-forest/80 py-10">
      <div className="w-full px-[4%] space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-limestone pb-6">
          <div className="flex items-center space-x-3">
            <img
              src={logoAsset.src}
              alt="Rokkha"
              className="h-10 w-auto rounded object-contain"
            />
            <div>
              <div className="font-extrabold text-brand-forest text-2xl tracking-tight">
                {t.footer_title}
              </div>
              <div className="text-base text-brand-forest/60">
                {t.footer_sub}
              </div>
            </div>
          </div>

          <div className="text-base text-brand-forest/70 max-w-md">
            {t.footer_desc}
          </div>
        </div>

        {/* Mandatory Attribution & Licenses per Backend API Guide */}
        <div className="space-y-2 text-base text-brand-forest/60">
          <div className="font-bold uppercase tracking-wider text-brand-forest/70 text-base">
            {t.footer_attributions_title}
          </div>
          <p className="leading-relaxed">
            {t.footer_attributions_desc}
          </p>
        </div>

        <div className="pt-4 border-t border-brand-limestone flex flex-col sm:flex-row items-center justify-between text-base text-brand-forest/60 gap-2">
          <div>
            &copy; {currentYear} {t.footer_copyright}
          </div>
          <div className="font-medium text-brand-forest/70">
            {t.footer_coords_note}
          </div>
        </div>
      </div>
    </footer>
  );
};
