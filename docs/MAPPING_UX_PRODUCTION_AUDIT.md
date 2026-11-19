# Mapping UX — production audit and refinement (19 November 2026)

Follows MAPPING_SYSTEM_AUDIT.md / MAPPING_ARCHITECTURE.md (the MapLibre explorer built the same day). This round
audited that explorer against the production brief and refined it. Nothing here is mocked: every value on the map
comes from Rokkha's backend; where something does not exist it says so.

## 1. What already worked (kept)

MapLibre explorer (`components/map/FloodMapExplorer.tsx`), COD-AB v03 geography (8 / 64 / 507), Bangladesh-only
camera and mask, division → district → upazila → point drill-down with breadcrumb/back/reset, search, six
district layers with distinct scales and missing-data class, Point Check against `/geospatial/flood/check` and
`/geospatial/place-name`, model information, side panel / bottom sheet, reduced-motion support.

## 2. What was weak (found in this audit)

| Area | Finding |
| --- | --- |
| Labels | District and upazila labels could overlap (no collision handling) |
| Rivers | No river network on the map; the 9 river sites Rokkha follows were invisible |
| Data status | No visible difference between server data, the saved sample and fixed records |
| Overlay control | No way to switch district colours off to read the base map |
| Point Check order | Spot history came first; current condition, forecast, rain and river were mixed in one list |
| Panel hierarchy | District values were one undifferentiated list |
| Explainability | Model panel showed tests and limits but not what the model relies on |
| Search | Places only |

## 3. Changes made

| Change | Detail |
| --- | --- |
| **River-flow stations** (overlay, on by default) | The 9 river sites from `GET /ingestion/sites?kind=river`, drawn as rings with a centre dot (never confused with an area), filled by status: flow vs the mean of the 30 days before (≥ ×2, ≥ ×1.25, ×0.8–1.25, < ×0.8, no value). Hover tooltip, click → station panel, searchable by name or river. 9 points need no clustering. |
| **Station panel** | Latest daily flow and date, comparison with usual, rising/falling/steady only from real values (latest vs 3 days earlier, ±5 %), stale-value warning (> 3 days), **hydrograph** of the last 90 days (`Hydrograph.tsx`, SVG, no new dependency): modelled history solid, forecast dashed only if forecast values exist, usual level dotted, missing days left as gaps, hover/tap read-out, text alternative. States clearly: modelled GloFAS flow, **not a gauge water level, so no danger level**; official levels at ffwc.gov.bd. Source, retrieval time, station ID and coordinates in an expandable section. |
| **Major rivers** (overlay) | Natural Earth 1:10 m river centre-lines (public domain), quiet blue lines for orientation, labelled as "not a flood layer". |
| **Colour toggle** | "Colour the districts by this layer" switch; the legend says "(colours hidden)". |
| **Data-status badges** | Per layer: *Daily update* (backend answered), *Saved sample* (backend unreachable; existing `dataSource` tracking), *Fixed record* (history, hazard), *Not available for this day*. "Live" is never claimed: the data is a daily batch. |
| **Label collisions** | After every move/zoom, labels are placed greedily by importance (selected > stations > divisions > larger areas) and overlapping ones hidden. |
| **Point Check hierarchy** | Location → Current flood condition (latest radar pass, observed) → Forecast (district, model) → Rainfall (7 days / last day, model input) → Nearby river (nearest followed station, distance, status; "may be on a different river") → Flood record at this ~93 m cell (history, modelled depth) → Sources, coordinates and limits (collapsed). Each section has its kind badge. |
| **District panel** | Grouped: Conditions now · Forecast · Rain and rivers (model inputs) · Background. |
| **Model explainability** | "What the model relies on most": training-gain share by input group from the model file (recent satellite flooding 59 %, rain 19 %, river flow and distance 12 %, season 5 %, hazard zone 5 %), with the caveat that it is across all districts and not the reason for one district's value. No per-district explanation is shown because the model does not produce one. |
| **Search** | Places + river stations, keyboard navigable. |
| **Panel order** | The selected station or point is shown first, then forecast day, layers, region. |

## 4. External data and infrastructure dependencies

| Wanted | Status | Why |
| --- | --- | --- |
| FFWC/BWDB water levels, danger levels, river forecasts | **Not integrated** | ffwc.gov.bd is a JavaScript application with no documented public API, no stated licence or terms for reuse. Scraping an undocumented interface was ruled out. Needs a data agreement or a published feed. |
| River-flow forecast (hydrograph forecast part) | **Done (19 Nov)** | The daily update now stores 7 GloFAS forecast days; the chart draws them dashed and the panel states the forecast peak. |
| Forecast inundation grids, sub-daily forecast steps | Not available | The model is district-level and daily. |
| Union boundaries | Not available | Not in COD-AB v03 or NSDI (see BANGLADESH_GEOGRAPHIC_DATA.md). |
| Verified impact / damage | Not available | No verified source connected. |
| Vector tiles | Not needed yet | National GeoJSON is ~132 KB gzip; revisit with union or grid data. |

## 5. Verification (local preview, Chromium)

Stations: 9 drawn; search "Jamuna" → 2 stations; station panel shows real values (e.g. Jamuna near Bahadurabad
4,538 m³/s on 17 Nov, lower than usual, falling 6 % in 3 days); hydrograph hover reads "19 Oct: 515 m³/s"
(Surma); toggles hide stations and close the station panel; colour toggle works. Point Check at Dharmapasha
(24.8474 N, 91.1428 E): sections in the order above, nearest station Surma near Sunamganj 34 km. Phone 390 px:
station sheet, no horizontal overflow. Type check and production build pass; backend 384 tests pass. Test data in
the local database: real production records copied read-only (18 Nov forecast, river series 1 Aug–17 Nov).

There is no ESLint configuration in the frontend, so no lint step exists; TypeScript strict type checking and
the Next.js build are the automated checks.

## 6. Known limitations / next steps

1. Get FFWC data access (water levels, danger levels, forecasts) — the biggest missing piece for river intelligence.
2. Schedule `river_forecast` ingestion in the daily update so hydrographs show the GloFAS forecast.
3. Verified Bangla upazila and station names.
4. Split the older 2.2 MB shared JavaScript chunk (saved sample data) to speed up first load on phones.
5. Add browser tests (Playwright) to CI for the map flows verified by hand here.
