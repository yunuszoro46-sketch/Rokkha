# Rokkha AI/ML and data — technical audit (19 November 2026)

Source of truth: the backend code and files named below (repository `Backend/`), not frontend text. Every figure
on the `/intelligence` page comes from the files in this audit, mostly at run time from `GET /predictions/model`.

Status labels: **VERIFIED** (implemented, evaluated or tested) · **IMPLEMENTED, NOT FULLY VALIDATED** ·
**PARTIAL** · **EXPERIMENTAL** · **PLANNED** · **UNAVAILABLE**.

## 1. Models

| Model | Status | Evidence |
| --- | --- | --- |
| District flood model: XGBoost 3.4.1 gradient-boosted trees, `binary:logistic`, 49 trees, max depth 3, eta 0.05, subsample/colsample 0.8, seed 7; settings chosen from 12 candidates by best 2022 PR-AUC | VERIFIED | `scripts/train_flood_model.py`, `data/models/flood_model.json`, `flood_model.meta.json` (`settings`) |
| Isotonic calibration of the probability, fitted on 2022 | VERIFIED | meta `calibration`; calibration tables in `data/models/README.md` |
| Two decision thresholds: Watch ≥ 0.1818 (highest cut-off still catching ≥ 80 % of 2022 floods), Alert ≥ 0.375 (best 2022 F1) | VERIFIED | meta `alert_thresholds` |
| Any neural network, deep learning, LLM or "AI" text generation | UNAVAILABLE | none in the repository |
| Pixel/grid flood-extent model | UNAVAILABLE | the model is district-level |

**Target (what is predicted):** probability that a Sentinel-1 pass on the target day observes flooding in the district
(Copernicus GFM, unusual water on ≥ 10 % of the observed land, pass must observe ≥ 50 % of the district). Issued for the
target day at 00:00 UTC with data through the day before. One horizon: the target day.

## 2. Inputs (15 features, `app/modules/prediction/features.py`)

| Group | Features | Source |
| --- | --- | --- |
| Rain (5) | `rain_1d`, `rain_3d`, `rain_7d`, `rain_14d`, `rain_30d` (sums before the target day) | ERA5 via Open-Meteo; GFS for the last ~5 days in live use |
| River flow (3) | `river_log_discharge`, `river_change_3d`, `river_vs_30d_mean` at the nearest of 9 river sites | GloFAS via Open-Meteo |
| Static geography (3) | `river_distance_km`, `hazard_share_10yr`, `hazard_share_100yr` | `data/ml/district_static.json` (JRC GloFAS hazard maps, site geometry) |
| Recent satellite (3) | `last_flooded_share`, `days_since_last_observation`, `max_flooded_share_14d` | Copernicus GFM passes before the target day |
| Season (1) | `month` | — |

Missing inputs are passed as NaN (XGBoost handles them); a prediction requires all rain windows (`has_required_inputs`).

## 3. Data and pipelines (separate until feature building)

| Pipeline | What happens | Code | Status |
| --- | --- | --- | --- |
| A. Satellite labels | GFM rasters (EODC open archive, COG) read over Bangladesh; per district and pass: observed share, flooded share, advisory share; April 2016 → now | `scripts/build_gfm_labels.py` → `data/labels/district_flood_observations.json` | VERIFIED; refreshed by the daily job |
| B. Weather and river | Open-Meteo: ERA5 daily rain (64 district points), GFS recent rain, GloFAS daily discharge (9 river cells); call budget, resumable runs | `app/modules/ingestion/` → MongoDB | VERIFIED (tests) |
| B2. Forecasts for the map | GFS hourly rain (4 days), GloFAS 7-day discharge | daily update steps 7–8 | IMPLEMENTED, NOT YET DEPLOYED (19 Nov) |
| C. Static geography | COD-AB v03 boundaries; JRC 10/100-year hazard share per district; distance to river site | `scripts/build_flood_data.py`, `build_district_static.py` | VERIFIED |
| D. Point record | ~90 m grid (`data/flood/flood_grid.npz`): 10 UNOSAT events 2016–2024, JRC depth classes, permanent water | `scripts/build_flood_data.py`, `POST /geospatial/flood/check` | VERIFIED (tests) |
| Training table | joins A (label), B, C per district-day | `scripts/build_training_table.py` → `data/ml/training_table.csv` (sha256 in meta) | VERIFIED |
| Inference | builds features for 64 districts, predicts 56, stores in MongoDB with model version and issue time | `app/modules/prediction/service.py` | VERIFIED |
| Schedule | GitHub Actions + cron-job.org at 09:30 Bangladesh time: river → rain → recent rain → satellite → predict → alerts | `.github/workflows/daily-update.yml`, `scripts/daily_update.py` | VERIFIED (running daily since 13 Nov) |
| Alerts and exposure | Watch/Alert districts with registered facilities and their flood flags | `app/modules/alerts`, `app/modules/assets` | VERIFIED |

## 4. Evaluation (all from `flood_model.meta.json`, `README.md`, `check_2025.json`)

Split by year, never shuffled: train 2016–2021 (13,839 district-days, 411 floods), validation 2022 (2,543 / 112),
test 2023–2024 (4,783 / 109), separate check 2025 (2,485 / 83). Flood rate 2.3 % in test.

| Measure (test 2023–2024) | Model | Persistence ("same as latest pass") | Climatology (district-month rate) | Model without satellite inputs |
| --- | --- | --- | --- | --- |
| PR-AUC | **0.460** | 0.420 | 0.170 | 0.249 |
| ROC-AUC | 0.936 | 0.823 | 0.844 | 0.927 |
| Brier | 0.016 | 0.019 | 0.022 | 0.025 |
| Watch: caught / missed / false alarms | 68 / 41 / 127 (precision 0.35, recall 0.62) | 51 / 58 / 58 | 26 / 83 / 98 | 101 / 8 / 1,415 |
| Alert: caught / missed / false alarms | 46 / 63 / 31 (precision 0.60, recall 0.42) | | | |

2025 check (never used for anything before): PR-AUC 0.569 vs persistence 0.499; Alert precision 0.745, recall 0.458.
Onset days (no flood in the latest pass): PR-AUC 0.148, Watch catches 18 of 58. Held-out division (new place and new
years): Sylhet 0.718, Mymensingh 0.458, Dhaka 0.429, Chattogram 0.404, Barishal 0.123, Rajshahi 0.103; Khulna and
Rangpur too few floods to score. No confidence intervals were computed. No MAE/RMSE (classification task).

## 5. Audit of the claims previously shown

| Claim | Finding | Action |
| --- | --- | --- |
| "Satellite flooding 59 %, rain 19 %, river flow 12 %" | XGBoost **gain** importance, normalised to sum 1, across all trees (training). Satellite 0.594 and rain 0.193 correct. "River flow 12 %" **includes `river_distance_km` (static, 0.035)**; river-flow features alone are 0.088. Remaining: hazard 0.046, month 0.045. | Show all six groups; river flow 8.8 % and distance 3.5 % separately; state "gain importance, not a reason for one district" |
| Sentinel-1 observations 2016–2024 | GFM passes April 2016 → present (daily job); UNOSAT events 2016–2024 for the point record | Say both, precisely |
| Observed vs modelled 10/100-year | Correct: UNOSAT/GFM observed; JRC GloFAS hazard maps v2.1.2 modelled return periods, ignore embankments | Keep, with the embankment caveat |
| "radar bounces between buildings / cannot penetrate forested mountains" | Direction correct; precise statement: GFM's exclusion mask removes land where radar cannot reliably detect water (urban, dense forest, radar shadow/layover); 8 districts are mostly excluded and not predicted | Reworded |
| "Official warnings mandated solely to FFWC and BWDB" | FFWC is part of BWDB; government (incl. Department of Disaster Management) issues orders | Reworded: official warnings from FFWC (BWDB) and government authorities |
| "Current ML model status: ready" | `GET /predictions/model` status | Shown live |
| Spatial resolution | Model: district; point record: ~90 m cells (93 m reported); GFM 20 m source pixels aggregated to districts | Stated per layer |

## 6. Limitations (from meta and docs)

Most skill comes from recent satellite observation (persistence); onset skill is weak. 56 of 64 districts.
Short floods and city waterlogging are missed by radar labels. River flow from the nearest of 9 sites, sometimes far
away. Trained on ERA5; live uses GFS for recent days. GFM v3.1 in training, v4.x since April 2025. JRC hazard ignores
embankments. Results describe 2023–2025.

## 7. Engineering achievements (verifiable)

Year-separated evaluation with two baselines, calibration, onset and held-out-division analyses; a later-year check;
reproducible training table with hash; daily automated pipeline with budget control and resumable runs; separation of
observed / modelled / forecast in API and UI; official geography from one release; 387 backend tests, 28 frontend tests.

## 8. Not substantiated / not claimed

Per-district explanations (no SHAP), confidence intervals, sub-daily or multi-day flood forecasts, flood depth
forecasts, gauge water levels, population impact, institutional partnerships, real-time data.

## 9. Where this is presented

`/intelligence` (`Frontend/src/components/intelligence/`) replaces the old "Data Honesty, Model Performance &
Institutional Limitations" modal, which is now a short entry point linking to the page (one source of truth).
Sections: overview · pipeline (real separate pipelines, interactive) · data · ML engine (architecture, gain
importance with the corrected grouping, split) · performance (PR-AUC vs baselines, decisions, calibration, 2025
check, onset weakness, held-out divisions) · outputs (newest stored real prediction, step by step) · Bangladesh
(coverage map, per-district facts) · milestones (git commit dates; uncommitted work labelled "in development") ·
limitations · technical deep dives. Numbers are read at run time from `GET /predictions/model`, `/predictions`,
`/geospatial/flood/events`, `/geospatial/flood/districts`, `/ingestion/river`, plus `src/data/model_check_2025.json`
(copied from `Backend/data/models/check_2025.json`, shown with its path and date). Browser tests:
`Frontend/tests/e2e/intelligence.spec.ts`.

### Researcher-first refinement (19 Nov 2026)

Language rewritten for researchers, engineers and students (no reviewer/judge framing). Every section follows
① Understand → ② Explore → ③ Investigate. Specialised terms open a short definition (`intelligence/glossary.tsx`,
22 terms, full list in the technical breakdown). Charts use `ChartFrame` (measures, units, period, source, kind,
how to read, takeaway, limits) and are interactive only where it changes the chart: performance across evaluation
periods (metric switch, series toggles; 2022 marked as the tuning year), precision–recall of the real warning rules
(period switch), calibration 2023–2024 vs 2025, satellite coverage by month (time range; derived file
`src/data/gfm_coverage.json` from `Backend/data/labels/district_flood_observations.json`, method recorded inside),
river flow by station, UNOSAT events, held-out divisions, and an evaluation summary table. Not shown because the
data does not exist: accuracy-versus-cost (one production model, no cost measurements), training curves (no logs
kept), confidence intervals.
