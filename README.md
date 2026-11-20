# 🌊 Rokkha (রক্ষা) — Citizen Flood Intelligence Platform

> **Climate Intelligence, Machine Learning Predictions & Tactical Flood Safety for a Resilient Bangladesh**  
> *পূর্বাভাস। প্রস্তুতি। সুরক্ষা।*

[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript 5.7](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-4.7-blue?style=for-the-badge)](https://maplibre.org/)
[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-success?style=for-the-badge&logo=vercel)](https://rokkha-app.vercel.app)

---

## 🌐 Live Platform & Access

- **Live Citizen Portal**: [https://rokkha-app.vercel.app](https://rokkha-app.vercel.app)
- **Check Your Safety Map**: [https://rokkha-app.vercel.app/map](https://rokkha-app.vercel.app/map)
- **District Warnings & Alerts**: [https://rokkha-app.vercel.app/alerts](https://rokkha-app.vercel.app/alerts)
- **AI Performance & Evaluation**: [https://rokkha-app.vercel.app/intelligence](https://rokkha-app.vercel.app/intelligence)
- **Bilingual Interface**: Seamless instant toggle between **English** and **বাংলা** (Bengali) across all views and data reports.

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features & System Architecture](#-key-features--system-architecture)
- [Interactive Map & Flood Layer Visualizations](#-interactive-map--flood-layer-visualizations)
- [Historical Flood Events (2016–2024)](#-historical-flood-events-20162024)
- [Case Studies: August 2024 Flash Floods](#-case-studies-august-2024-flash-floods)
- [Machine Learning Architecture & Evaluation](#-machine-learning-architecture--evaluation)
- [Local Development Guide](#-local-development-guide)
- [Repository Structure](#-repository-structure)
- [Data Sources & Attributions](#-data-sources--attributions)

---

## 💡 Overview

**Rokka (রক্ষা)** is an open-access climate intelligence platform designed to address recurrent monsoon flooding and flash floods across Bangladesh. Built with rigorous machine learning models and spatial intelligence, the platform bridges the gap between raw scientific hydro-meteorological data and grassroots citizen safety.

Traditional flood notices are often static, delayed, or high-level. **Rokka** delivers:
- **Hyper-local 90-meter Point Checks**: Instant flood risk assessment for any GPS spot, upazila, or village in Bangladesh.
- **Multivariate AI Prediction**: 24-hour lookahead risk classification synthesizing river discharge, rainfall accumulation, terrain elevation, and soil wetness.
- **Verified Satellite Ground Truth**: Integration with Copernicus Sentinel-1 radar earth observations and UNOSAT flood disaster activations.
- **Tactical Emergency Aid**: Nearest shelter finder, offline emergency contact directories, and a crowdsourced rescue coordination board.

![Rokka Platform Landing Page](docs/images/landing-page.png)

---

## 🚀 Key Features & System Architecture

```mermaid
flowchart TD
    A["Copernicus Sentinel-1 SAR (Radar Inundation)"] --> D["Data Ingestion & Inundation Grid"]
    B["Copernicus GloFAS (River Discharge)"] --> D
    C["ECMWF ERA5 / NOAA GFS (Rainfall)"] --> D
    D --> E["XGBoost / LightGBM Predictive Engine"]
    E --> F["24-Hour ML District & Upazila Risk"]
    F --> G["Citizen Portal (/map, /alerts)"]
    F --> H["Tactical Emergency Rescue Console (/rescue)"]
    F --> I["AI Benchmarks & Governance (/intelligence)"]
```

### 1. Check Your Safety (Interactive GIS Map)
An ultra-responsive MapLibre GL engine displaying official UN OCHA / HDX COD-AB v03 administrative boundaries (division, district, upazila) and terrain contours:
- **Pick-a-Place Mode**: Click anywhere in Bangladesh for an instant hydrological safety diagnosis.
- **Interactive Calendar & Event Stepper**: Pick any date or jump between historical monsoon seasons in one click.
- **Live River Stations**: Station-level discharge hydrographs with danger level threshold indicators.

### 2. District Flood Warnings
- Clear danger level alerts (**Normal**, **Watch**, **Warning**, **Severe Warning**).
- Population, agricultural acreage, and critical healthcare facility exposure estimates.
- One-click filter across all 64 districts.

### 3. Tactical Rescue Coordination Board
- Citizen SOS request submission with GPS coordinates and contact phone numbers.
- Verified rescuer login and priority queue for dispatching boats and medical volunteers.

---

## 🗺️ Interactive Map & Flood Layer Visualizations

The platform visualizes diverse spatial perspectives to give authorities and citizens comprehensive situational awareness:

| Perspective | Visualization | Description |
| :--- | :--- | :--- |
| **Water System Map** | ![Water System Map](docs/images/water-system-map-view.png) | High-resolution river networks, major river discharge corridors (Jamuna, Padma, Meghna, Surma-Kushiyara), and monitoring gauges. |
| **Modelled Flood Zones** | ![Modelled Flood Zones](docs/images/modelled-river-flood-zone-map-view.png) | Predictive flood risk probabilities across all 64 districts generated by the ML model. |
| **Satellite Radar Observations** | ![Satellite Observations](docs/images/satellite-observed-map-view.png) | Copernicus Sentinel-1 Synthetic Aperture Radar (SAR) observed flood extents, cutting through cloud cover during extreme weather. |
| **Historical Flood Analysis** | ![Past Flood Map](docs/images/past-flood-map-view-2016-2024.png) | Composite district vulnerability showing flood recurrence frequency across 10 major historical activations (2016–2024). |

---

## 📅 Historical Flood Events (2016–2024)

Rokka's interactive date bar includes a dedicated event stepper allowing users to explore and analyze **10 major historical flood disaster activations**:

1. **30 Jun – 24 Jul 2016**: Monsoon flood, Central & Eastern Bangladesh (10,830 km² mapped extent)
2. **12 – 22 Aug 2017**: Extreme monsoon flood affecting Northern, Central & Southern districts (21,491 km² mapped extent)
3. **15 Jun 2018**: Flash flood, Sylhet Division (5,967 km² mapped extent)
4. **25 – 31 May 2020**: Super Cyclone Amphan, Khulna & coastal belt (1,367 km² mapped extent)
5. **9 Jul – 8 Aug 2020**: Severe prolonged nationwide monsoon inundation (30,623 km² mapped extent)
6. **27 Jul – 10 Aug 2021**: Monsoon flood, Chattogram Division (8,471 km² mapped extent)
7. **25 May – 21 Jun 2022**: Historic North-East & Sylhet inundation (15,424 km² mapped extent)
8. **1 Jun 2024**: Cyclone Remal coastal storm surge (1,030 km² mapped extent)
9. **19 Jun – 23 Jul 2024**: Early monsoon flood, Sylhet basin and Jamuna corridor (17,283 km² mapped extent)
10. **18 Aug – 4 Sep 2024**: Eastern Bangladesh flash flood (Feni, Cumilla, Noakhali, Habiganj) (13,466 km² mapped extent)

---

## 🔬 Case Studies: August 2024 Flash Floods

In late August 2024, unexpected transboundary rainfall caused unprecedented flash floods in eastern Bangladesh. Rokka benchmarked its prediction models against ground truth observations during this disaster:

### District Analyses & Benchmark Comparisons

| Case Study | Visual Record | Analysis |
| :--- | :--- | :--- |
| **Habiganj District** | ![August 21 Habiganj](docs/images/august-21-flood-habiganj.png) | Rapid upstream runoff detection along the Khowai river, triggering early warnings 24 hours prior to peak embankment breaches. |
| **Patuakhali District** | ![August 21 Patuakhali](docs/images/august-21-flood-patuakhali.png) | Coastal water level tracking combining tidal surge projections and catchment rainfall. |
| **Ablation Comparison** | ![Model vs Baseline](docs/images/august-21-flood-result-without-model.png) | Comparative analysis showing flood detection precision with the ML model versus naive baseline thresholds. |

---

## 🧠 Machine Learning Architecture & Evaluation

Rokka’s predictive core is built with strict leak-free chronological validation to prevent future-data contamination:

### 1. Chronological Dataset Partitioning
The dataset is split across non-overlapping historical time windows rather than random sampling:
- **Training Set (2016–2021)**: 13,839 district-day samples covering 6 major flood seasons.
- **Validation Set (2022)**: 3,214 district-day samples used for hyperparameter tuning and decision threshold calibration.
- **Test Set (2023–2024)**: 6,428 unseen district-day samples used for benchmark verification.
- **Out-of-Domain Check (2025)**: Continuous evaluation on fresh observations.

![Dataset Partitioning](docs/images/dataset-partitioning.png)

---

### 2. Performance Metrics & Chronological Stability
The model demonstrates high robustness across time periods, avoiding catastrophic generalization degradation:

![Evaluation Metrics Across Periods](docs/images/evaluation-metric-across-chronological-periods.png)

---

### 3. Reliability Calibration & Alert Tradeoffs
To be trusted by disaster responders, probabilistic predictions must be strictly calibrated:

![Reliability Diagram & Threshold Tradeoff](docs/images/warning-threshold-tradeoff-and-reliability-diagram.png)

- **Reliability Diagram (Brier Score)**: Confirms that a predicted 70% flood probability corresponds to true flooding in 7 out of 10 real-world observations.
- **Warning Threshold Optimization**: Tuned to maximize recall on life-threatening events while minimizing false alarms for district authorities.

---

### 4. Benchmark Performance Comparison

![Benchmark Comparison Table](docs/images/benchmark-table.png)

| Model / Baseline | PR-AUC | ROC-AUC | Brier Score | Alert Precision | Alert Recall |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Persistence Baseline (Yesterday's State)** | 0.241 | 0.612 | 0.089 | 38.2% | 41.5% |
| **Precipitation-Only Heuristic** | 0.315 | 0.694 | 0.076 | 46.1% | 52.3% |
| **GloFAS Discharge Exceedance** | 0.442 | 0.763 | 0.062 | 58.7% | 63.8% |
| **Rokka Gradient Boosted Ensemble (Active)** | **0.684** | **0.891** | **0.038** | **78.4%** | **83.1%** |

---

## 🛠️ Local Development Guide

### Prerequisites
- **Node.js**: v20 or v22 LTS
- **Python**: 3.10+ (for backend)
- **Package Manager**: `npm` or `pnpm`

### 1. Frontend Setup
```bash
# Clone the repository
git clone https://github.com/yunuszoro46-sketch/Rokkha.git
cd Rokkha/Frontend

# Install dependencies
npm install

# Start local Next.js development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

Run unit tests and type checks:
```bash
# Type check
npx tsc --noEmit

# Run unit tests
npm run test:unit
```

### 2. Backend Setup
```bash
cd ../Backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```
API documentation is accessible at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## 📁 Repository Structure

```text
Rokkha/
├── .github/
│   └── workflows/
│       ├── deploy-frontend.yml     # Automated production deployment to Vercel
│       ├── frontend-checks.yml     # CI type checks, production build & Playwright tests
│       └── daily-update.yml        # Daily hydro-meteorological ingestion cron
├── Backend/
│   ├── app/
│   │   ├── modules/
│   │   │   ├── accounts/           # User authentication & role management
│   │   │   ├── admin/              # Administrative control center & audit logs
│   │   │   ├── assets/             # Critical infrastructure & shelter proximity search
│   │   │   ├── geospatial/         # GeoJSON boundary, station & observation endpoints
│   │   │   ├── ingestion/          # Hydrology & satellite pipeline connectors
│   │   │   └── rescue/             # SOS request board & dispatch queues
│   │   └── main.py                 # FastAPI application entrypoint
│   └── scripts/                    # Geography compilation & model evaluation scripts
├── Frontend/
│   ├── src/
│   │   ├── app/                    # Next.js App Router (pages: /, /map, /alerts, /intelligence, /admin)
│   │   ├── components/
│   │   │   ├── map/                # MapLibre GL exploration, hydrographs, layers & GIS engine
│   │   │   ├── intelligence/       # AI architecture, charts, and benchmark evaluation
│   │   │   ├── site/               # Navigation, landing page, and contact directories
│   │   │   └── ui/                 # Reusable design system, calendar date picker, modals
│   │   ├── data/                   # Boundary GeoJSONs, benchmark datasets & district metadata
│   │   ├── lib/                    # Translations (EN/BN), date math, past flood events
│   │   └── services/               # Resilient API client with cached fallback datasets
│   └── public/                     # Static media, icons & high-resolution map tiles
├── docs/
│   └── images/                     # System architecture & evaluation visual assets
└── README.md
```

---

## 🌍 Data Sources & Attributions

- **Sentinel-1 Satellite Inundation**: European Union Copernicus Sentinel-1 GFM (Global Flood Monitoring / Emergency Management Service).
- **River Discharge & Water Corridors**: Copernicus GloFAS (Global Flood Awareness System).
- **Meteorological Precipitation**: ECMWF ERA5 & NOAA GFS via Open-Meteo API.
- **Historical Flood Disaster Polygons**: UNOSAT (United Nations Satellite Centre, CC BY-SA 3.0).
- **Administrative Boundaries**: Humanitarian Data Exchange (HDX / UN OCHA COD-AB v03).
- **Disaster Response & Shelter Facilities**: Ministry of Disaster Management and Relief (MoDMR), Government of Bangladesh.

---

<div align="center">
  <sub>Built with ❤️ for the resilient people of Bangladesh.</sub><br>
  <sub><b>Rokkha (রক্ষা)</b> · 2026</sub>
</div>
