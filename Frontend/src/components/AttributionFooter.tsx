import React from "react";
import logoAsset from "@/assets/logo.png";

export const AttributionFooter: React.FC = () => {
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
                Rokkha Flood Intelligence
              </div>
              <div className="text-base text-brand-forest/60">
                Citizen Portal · Open Climate Safety for Bangladesh
              </div>
            </div>
          </div>

          <div className="text-base text-brand-forest/70 max-w-md">
            Built to provide actionable district-level flood awareness, shelter
            access, and transparent climate data to every citizen and community
            responder.
          </div>
        </div>

        {/* Mandatory Attribution & Licenses per Backend API Guide */}
        <div className="space-y-2 text-base text-brand-forest/60">
          <div className="font-bold uppercase tracking-wider text-brand-forest/70 text-base">
            Mandatory Data Attributions & Licensing
          </div>
          <p className="leading-relaxed">
            Satellite radar observations sourced from{" "}
            <strong>
              Copernicus Sentinel-1 Global Flood Monitoring (GFM)
            </strong>{" "}
            under the Copernicus Emergency Management Service. Hydrological
            discharge from <strong>Copernicus GloFAS</strong> and reanalysis
            rainfall from <strong>ECMWF ERA5 / NOAA GFS</strong> via{" "}
            <strong>Open-Meteo</strong>. Historical satellite flood polygons
            from <strong>UNOSAT</strong> (licensed under CC BY-SA). National
            district administrative shapes provided by{" "}
            <strong>Humanitarian Data Exchange (HDX)</strong> (CC BY-IGO).
            Basemap cartography &copy;{" "}
            <strong>OpenStreetMap contributors</strong> (ODbL) and CartoDB.
          </p>
        </div>

        <div className="pt-4 border-t border-brand-limestone flex flex-col sm:flex-row items-center justify-between text-base text-brand-forest/60 gap-2">
          <div>
            &copy; {new Date().getFullYear()} Rokkha. Open Public Safety
            Intelligence.
          </div>
          <div className="font-medium text-brand-forest/70">
            Cartographic data adheres to WGS84 Geodesic Coordinates.
          </div>
        </div>
      </div>
    </footer>
  );
};
