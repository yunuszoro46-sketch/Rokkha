# Rokkha mapping architecture (Stage 2, 19 November 2026)

*Bangladesh first. Geography at every level. Intelligence on the map.*

Code: `Frontend/src/components/map/` — `FloodMapExplorer.tsx` (map, panel, interaction), `mapLayers.ts` (layer
definitions, classes, provenance), `geoData.ts` (geography loading, search). Geography: `Frontend/public/geo`
(see BANGLADESH_GEOGRAPHIC_DATA.md). Mounted on `/map` through `CitizenPortalApp` with `next/dynamic`, so the
map engine is downloaded only on that page.

## 1. Engine decision: MapLibre GL JS 4.7.1 (replacing Leaflet on `/map`)

| Need | Leaflet (before) | MapLibre GL JS |
| --- | --- | --- |
| Smooth camera to any district/upazila | `flyToBounds`, raster jumps | GPU `fitBounds`/`easeTo`, honours reduced motion |
| Hover/selection on 64 + up to 18 polygons | restyle SVG layers | `feature-state` (no re-render, no data re-upload) |
| Changing the data layer | rebuild GeoJSON layer | 64 `setFeatureState` calls (measured 31–47 ms incl. React) |
| Future forecast grids / vector tiles | plugins | native raster and vector-tile sources |
| Licence / cost | BSD | BSD-3; no API key, no vendor tiles required |
| Bundle | ~40 KB gz | ~208 KB gz, **only on /map** (separate chunk) |

Mapbox GL JS was not chosen (proprietary licence since v2, needs a token). Leaflet stays for the small map in
the district report dialog. **Labels are HTML markers**, not map glyphs: WebGL glyph rendering cannot shape
Bengali script, and there are at most ~90 labels on screen.

Basemap: OpenStreetMap raster tiles (already used before; no new service), desaturated and dimmed so the data
reads first, with attribution. Everything outside Bangladesh is covered by an ivory mask; the camera is
limited to Bangladesh (`maxBounds`), opens fitted to the country and never shows a world view.

## 2. Boundary data

Static GeoJSON from one COD-AB v03 release, cached a day by the browser (`next.config.mjs`, `/geo/*`).
National view loads districts + divisions + mask (~132 KB gzip) and the search index (21 KB). Upazilas load per
district (≈ 20 KB gzip) when that district is opened. **Why not vector tiles yet:** at these sizes GeoJSON is
smaller and simpler than running a tile server; switch to PMTiles/vector tiles if union-level or sub-district
grids are added (thousands of polygons).

## 3. Navigation

`Bangladesh → division → district → upazila → point`. Selection state `{division, district, upazila}` + point.

- Click a district (national/division view) → select it, fit its bounds (1.1 s ease; instant under reduced motion),
  load its upazilas, dim other districts.
- Click inside the selected district → select that upazila (first time: fit to it) **and** run Point Check at the
  exact spot.
- Breadcrumb `Bangladesh / Division / District / Upazila / Point` (every level clickable), **Back** (point →
  upazila → district → division → national), **Bangladesh** button (reset camera and selection).
- Search: client-side over the 579 places in `index.json` (English names; Bangla for divisions/districts),
  combobox with arrow keys/Enter/Escape; only Bangladesh places can be returned.
- Keyboard: every district is reachable without a mouse (division list → district list → upazila list in the
  panel); map canvas keeps MapLibre's keyboard pan/zoom.
- Labels: divisions at national zoom; districts from zoom 7.3 or inside a selected division; upazilas inside the
  selected district from zoom 8.4.

## 4. Point Check data flow

```
map click / "Use my location" (browser GPS) / typed lat,lng
  → marker + (GPS, typed, phones) camera ease
  → POST /geospatial/flood/check   (~93 m grid cell: UNOSAT events, JRC depth, permanent water; district history)
  ∥ GET  /geospatial/place-name    (upazila + code, district, division; our server, no outside geocoder)
  → breadcrumb follows the point's real upazila/district
  → panel: At this spot (cell) · For the whole district (forecast + inputs, labelled district-level) · location
     details (coordinates, source) · limitations and attribution from the response
```

Precision is stated, never implied: the cell size comes from the response (`grid_cell_size_m`), the forecast is
labelled "per district, not for this spot", points outside Bangladesh say so, there is no nearest-cell
substitution. Typed coordinates outside Bangladesh's box are refused before asking.

## 5. Layers (one at a time, all district-level, all real)

| Layer | Kind | Source (endpoint) | Date | Classes (data scale, not brand colours) |
| --- | --- | --- | --- | --- |
| Flood forecast | model forecast | predictions (XGBoost) | yes | Alert · Watch · Low (not zero) · Not covered · No forecast |
| Satellite-observed flooding | observed | latest Sentinel-1 pass (Copernicus GFM) ≤ 30 days | yes | Flooded ≥ 10 % (GFM rule) · 2–10 % · < 2 % · No pass · Radar cannot see |
| Past floods 2016–2024 | historical | UNOSAT 10 events | no | ≥ 4 events · 2–3 · 1 · 0 · never analysed |
| Rain in the past 7 days | model input | prediction `features.rain_7d` (ERA5/GFS) | yes | ≥ 300 · 150–300 · 75–150 · 25–75 · < 25 mm · no data |
| River flow vs usual | model input | `features.river_vs_30d_mean` (GloFAS, 9 sites) | yes | ≥ ×2 · ×1.25–2 · ×0.8–1.25 · < ×0.8 · no data |
| Modelled river-flood zone | modelled | JRC 100-year zone share | no | ≥ 60 % · 30–60 · 10–30 · < 10 % · not computed |

Listed but **not drawn** (with the reason): forecast inundation extent, official FFWC gauges/warnings, impact
and damage, rain-forecast map. Missing data is its own grey class with a dashed edge in every layer — never
"low". Each layer carries its kind badge, description, source and valid date in the legend; observed water uses
blues, forecast uses the red/amber warning scale, history and modelled hazard use earth browns, inputs use
river blues — so observation, prediction, history and hazard never look alike.

**Aggregation:** none is invented. National/division summaries are **counts of districts per class** of the
active layer; the forecast's district value is the model's own district output; no averaging across layers,
no population weighting (no population data is connected).

**Forecast time:** the model issues one forecast per day for that day (data through the day before). The control
steps through forecast days (never into the future beyond today) and shows the issue time; there are no 6/12/24 h
steps because the model does not produce them.

## 6. Model information

From `GET /predictions/model`: version, method, training date, what is predicted, issue time, horizon (one day),
spatial unit (56 of 64 districts), the held-out 2023–2024 test result (share of Alert days that flooded, share of
floods caught at Watch) and the model's own limitations. Nothing is computed or rounded up in the browser.

## 7. APIs

No new endpoint was needed. One additive change: `GET /geospatial/place-name` now also returns
`upazila_pcode` and is backed by the COD-AB v03 upazilas (same release as the districts). Rescue requests and
personal data are never queried by the public map.

## 8. Panel and responsive layout

Desktop (≥ 1024 px): map + 400 px side panel (breadcrumb, forecast day, Point Check, layer chooser, region
summary, check-a-spot, model). Legend floats on the map (collapsible). Phones: map fills the screen below the
header; the same panel is a bottom sheet (collapsed 132 px: place + layer + date; expanded ≤ 62 % so the point
stays visible above it). The panel is rendered once for the current size (no duplicate controls).

## 9. Measured (local preview, Chromium, 19 Nov 2026)

| Measure | Result |
| --- | --- |
| Map shell to labels attached | 0.28–0.54 s (local server) |
| Geography for the national view | ~132 KB gzip + 21 KB search index |
| Map engine chunk (only `/map`) | 788 KB raw / 208 KB gzip |
| Layer switch (data loaded) | 31–47 ms |
| Upazila load per district | ≈ 20 KB gzip, one request, cached |
| Horizontal overflow 390 px | none |

Hover work is limited to one `queryRenderedFeatures` per animation frame and a `feature-state` change only when
the hovered feature changes.

## 10. Failure and missing-data behaviour

WebGL unavailable → message, panel lists still work. Geography download fails → message; retried on next try.
Backend unreachable → existing saved-sample fallbacks (banner says so); cell-level data says it needs the live
server. No forecast for a day → grey everywhere with "not the same as no risk" and a link to the day before.

## 11. River intelligence and overlays (added in the production refinement, same day)

- **River-flow stations** (`riverStations.ts`, `Hydrograph.tsx`): the 9 river sites from `GET /ingestion/sites?kind=river`
  and up to 120 days (+10 for any stored forecast days) of `GET /ingestion/river` per site — 10 small requests,
  once per page load, only while the overlay is on. Status, usual level (mean of the 30 days before the latest,
  needs ≥ 20 values) and trend (latest vs 3 days earlier, ±5 %) are computed from those values only. Drawn as a
  MapLibre circle layer with feature-state colour/selection (no clustering needed for 9 points). Modelled GloFAS
  discharge, **not** gauge water levels: no danger level is shown.
- **Major rivers**: `public/geo/rivers.json`, Natural Earth 1:10 m river centre-lines (public domain), line layer
  below the boundaries.
- Click priority: station (6 px hit box) > upazila > district. Stations are searchable.
- **Label collision**: greedy placement by priority after each `moveend`.
- **Data-status badges**: driven by `services/dataSource.ts` (saved-sample tracking). See MAPPING_UX_PRODUCTION_AUDIT.md.

## 12. Geographic context, terrain and exposure (flood-intelligence refinement)

- **Rivers** now come from OpenStreetMap (see BANGLADESH_GEOGRAPHIC_DATA.md): `rivers.json` (~94 KB gzip, named, three
  line layers by rank with zoom thresholds 6 / 6.6 / 7.4), `rivers-minor.json` (~140 KB gzip, fetched once when the
  zoom first reaches 8.4), labels as HTML (Bengali shaping) created **only for labels in view** at the current rank
  threshold and recycled on every move; included in collision culling. River search → fit to river + highlight + river panel.
- **Terrain**: a raster source of pre-rendered tiles (zoom 6–9, over-zoomed beyond), placed under the district fills;
  when on, district fill opacity is multiplied by 0.55 so relief reads through. Off by default.
- **Headquarters**: circle layer from zoom 6.8, HTML names from zoom 9.
- **Facilities**: on district selection, `GET /assets/exposure` (flags) ⋈ `GET /assets` (locations) by ID; circle layer
  coloured observed / modelled zone / none. Hover tooltip; click runs Point Check at the facility. Point Check adds
  `GET /assets/near` (10 km, top 4).
- **Controls**: metric scale (MapLibre computes for zoom and latitude), full-screen, base map street / plain.
- **Layer UI**: five collapsible groups; the district data layer remains a single radio choice; overlays are switches.
- **Tests**: `npm run test:unit`, `npm run test:e2e` (Playwright 1.48.2, system Chrome, against a running portal +
  backend with a test database; rescuer test needs `E2E_RESCUER_EMAIL` / `E2E_RESCUER_PASSWORD`).
- **Initial geography download** grew from ~132 KB to ~240 KB gzip (rivers + labels + names + places); terrain tiles
  (5–80 KB each) load only when the layer is on.

## 13. Forecast data in the daily update (19 Nov 2026)

`Backend/scripts/daily_update.py` now ends with `river_forecast` (7 days) and `rain_forecast` (4 days of hours from
00:00 UTC = the 72 h after the 09:30 BD run) — best effort, after the predictions. The map reads
`GET /ingestion/rain-forecast/summary?hours=72` once (all districts) for the **Rain forecast, next 3 days** layer
(weather group; `latest: true`, so its legend shows the forecast's own valid window instead of the chosen day),
and the stations' `GET /ingestion/river` series already include the forecast days (`is_forecast`), which the
hydrograph draws dashed and the station panel summarises (peak and date).
