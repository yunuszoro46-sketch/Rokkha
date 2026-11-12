# 🌊 Rokkha (রক্ষা) — Citizen Flood Intelligence Platform

> **Climate Intelligence & Real-Time Flood Prediction for a Safer Bangladesh**  
> *পূর্বাভাস। প্রস্তুতি। সুরক্ষা।*

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License: CC BY-SA](https://img.shields.io/badge/License-CC_BY--SA_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by-sa/4.0/)

---

## 🌐 Live Deployment

- **Live Citizen Portal**: Deployed on Vercel at your project domain.
- **Bilingual Interface**: Instant toggle between **বাংলা** (Bengali) and **English** with deep-linking support (`?lang=bn`).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyunuszoro46-sketch%2FRokkha%2Ftree%2Fproduction%2FFrontend)

---

## 📌 Key Capabilities

1. **Interactive 64-District Risk Map & Point Inspection**:
   - Leaflet map rendering all 64 Bangladesh district administrative boundaries.
   - Click any point in Bangladesh to query historical satellite flooding and JRC GloFAS flood depth hazard.
2. **Sentinel-1 Satellite Inundation Timelines**:
   - Copernicus Sentinel-1 Global Flood Monitoring (GFM) timelines for 2022 and 2024 monsoon seasons.
   - Historical record of 10 major disaster events across 64 districts.
3. **24-Hour ML Early Warnings**:
   - Machine learning flood probabilities with critical asset and population risk breakdowns.
4. **Hydro-Meteorological Sensor Feed**:
   - Precipitation tracking (ECMWF ERA5 / NOAA GFS) and river discharge tracking (Copernicus GloFAS).
5. **Nearest Emergency Shelters**:
   - Geospatial 2dsphere proximity search for registered disaster shelters, hospitals, and clinics.
6. **"My District" Local Report Card**:
   - Detailed offline/printable disaster intelligence report with official national emergency helplines.

---

## 🚀 Local Development

To run the updated Next.js 14 citizen platform locally:

```bash
cd Frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To build for production:

```bash
npm run build
npm run start
```

---

## 📂 Project Structure

```text
Rokkha/
├── Frontend/                 # Next.js 14 Citizen Platform
│   ├── src/
│   │   ├── app/              # Next.js App Router & Pages
│   │   ├── components/       # UI Components & Leaflet Maps
│   │   ├── lib/              # i18n Translation Engine & Utilities
│   │   ├── services/         # Citizen API Client
│   │   └── data/             # 64-District Cartographic Boundaries
│   ├── public/               # Static assets & icons
│   └── package.json
└── README.md
```

---

## ⚖️ Attributions & Licensing

- **Satellite Observations**: European Union Copernicus Sentinel-1 GFM (Emergency Management Service).
- **Hydrological Discharge**: Copernicus GloFAS.
- **Precipitation**: ECMWF ERA5 & NOAA GFS via Open-Meteo.
- **Historical Polygons**: UNOSAT (CC BY-SA 3.0).
- **Administrative Boundaries**: Humanitarian Data Exchange (HDX / UN OCHA).
