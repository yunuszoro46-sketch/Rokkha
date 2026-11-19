# Rokkha flood intelligence — gap analysis (19 November 2026)

Scope: the `/map` experience (`Frontend/src/components/map/`) against the "Advanced Bangladesh Flood Intelligence
Map" brief. **Existing** = there before this round; **Added** = built and verified in this round; **Missing** =
not possible honestly with the data Rokkha has. Related: MAPPING_ARCHITECTURE.md, BANGLADESH_GEOGRAPHIC_DATA.md,
MAPPING_UX_PRODUCTION_AUDIT.md.

## 1. Map capabilities

| Capability | Status |
| --- | --- |
| MapLibre map limited to Bangladesh, mask outside, smooth camera, reduced motion | Existing |
| Division → district → upazila → point drill-down, breadcrumb, back, reset, search | Existing |
| Six district data layers with kind badges, legends, status badges | Existing |
| Point Check (place, ~93 m cell history + JRC depth, district values, nearest river station) | Existing |
| 9 river-flow stations, station panel, 90-day hydrograph | Existing |
| **OpenStreetMap river network**: 314 named rivers by size (18 / 83 / 213), 1,479 unnamed lines when zoomed in, river names in English and Bangla, searchable, river panel with related stations | Added |
| **Terrain and elevation** layer (Copernicus DEM GLO-90 colour relief + hillshade), legend, source, limits; off by default | Added |
| **Elevation statistics** per district and upazila (median, share below 5 m / 10 m) in district and Point Check panels | Added |
| **District and division headquarters** (COD-AB admin capitals) | Added |
| **Facilities and their flood record** (registered hospitals, clinics, shelters, schools of the selected district; coloured by their own past satellite flooding / 100-year modelled zone; summary counts) and **facilities near a checked point** | Added (data existed in the backend, not on the map) |
| **Grouped layer control**: Flood · Weather · Water systems · Geography · Exposure, unavailable items inside their group with the reason | Added |
| **Bangla upazila names** (415 of 507) in labels, panels and search | Added |
| Distinct boundary styles (country, division, district, dashed upazila); label collision handling incl. river and HQ labels | Refined |
| Scale bar (metric), full-screen, base map switch (street map / plain = less data) | Added |
| Automated tests: 8 unit + 20 browser tests (Playwright, system Chrome) — 28/28 pass | Added |
| **Rain forecast layer** (GFS, next 72 h, all districts; legend with the real valid window) and rain-forecast lines in district and Point Check panels | Added (step 1 below) |
| **River-flow forecast** (GloFAS, 7 days) in the station hydrograph and a labelled forecast peak | Added (step 1 below) |

## 2–6. Data Rokkha has

| Data | Kind | Resolution / time | Used where |
| --- | --- | --- | --- |
| COD-AB v03 boundaries + admin capitals | reference | 8/64/507 units, 2023 | boundaries, HQs, search |
| Daily XGBoost forecast | forecast | district, one day, 56 of 64 districts | Flood forecast layer, panels |
| Copernicus GFM Sentinel-1 per district | observed | district, per pass (every few days) | Observed flooding layer |
| UNOSAT 10 events 2016–2024 | historical | ~93 m cells / district counts | Past floods, Point Check |
| JRC GloFAS hazard maps | modelled | ~90 m, 10/100-year | Hazard layer, Point Check, facility flags |
| ERA5 / GFS rain at district points | model input | daily, district point | Rain layer, panels |
| GloFAS discharge, 9 river cells | model input (modelled flow) + 7-day forecast | daily | stations, river layer, hydrograph forecast |
| GFS hourly rain forecast, 64 district points | weather forecast | hourly, 72 h after each morning fetch | Rain forecast layer, panels |
| Registered facilities (OSM snapshot 2026-11-04) + exposure | reference + history/model flags | point | Exposure group, panels |
| OSM rivers + names (extract 19 Nov 2026) | reference | line | rivers, labels, search |
| Copernicus DEM GLO-90 | reference (surface model) | 90 m; tiles to ~280 m/px | terrain layer, elevation statistics |

## 7–8. Missing information and why

| Wanted | Why not shown |
| --- | --- |
| Forecast inundation extent | The model is district-level; a district value is never turned into a flood map |
| Sub-daily forecast steps | The model forecasts one day |
| Official gauge levels, danger levels, FFWC warnings | No documented public API or reuse licence |
| Population exposure | No population grid connected (WorldPop / GHSL would be the candidates) |
| Damage, blocked roads | No verified source; intersecting a flood polygon is not evidence of damage |
| Union boundaries | Not in COD-AB v03 or the NSDI catalogue |
| Haor regions, wetlands as areas | No openly licensed authoritative polygon set found; the JRC permanent-water raster exists in the backend but has no map tiles |
| Elevation at the exact clicked spot | Terrain tiles are rendered pictures; a value needs a backend DEM sample (next step) |
| Bangla names for 92 upazilas, stations, most small rivers | OSM and COD-AB did not agree on both checks, or no Bangla name exists; shown in English, never transliterated |

## 9. Visual and interaction notes

National view: divisions, distinct boundary weights, 18 major rivers named, 9 stations, headquarters from
zoom 6.8. District view: upazila dashed lines and names, medium/small rivers, HQ names, facilities. Point view:
eight structured sections. Rivers are styled as context (thin blue, italic labels) and never coloured by data.

## 10. Recommended next steps (by user value ÷ effort)

1. ~~Schedule `rain_forecast` and `river_forecast` ingestion in the daily update~~ — **done 19 Nov 2026**:
   `scripts/daily_update.py` steps 7–8 (best effort, after the predictions), retention of 3 days of rain-forecast
   fetches, `GET /ingestion/rain-forecast/summary`, map layer and station forecasts. Live on production after the
   backend and portal are deployed; the next morning run then stores the first forecasts.
2. Backend DEM sampling endpoint (point elevation) using the same GLO-90 files.
3. Population grid (WorldPop 100 m, CC BY 4.0) with a documented exposure method per district.
4. FFWC data agreement (gauges, danger levels).
5. Verified Bangla names list (BBS / LGED) to replace the OSM-derived names.
