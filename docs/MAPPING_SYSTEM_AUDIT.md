# Mapping system audit (Stage 0, 19 November 2026)

What Rokkha's map was before the geospatial redesign, measured in the repository and on the local preview.

## Before

| Area | What existed | Problem |
| --- | --- | --- |
| Engine | Leaflet 1.9 (`LeafletFloodMap.tsx`), raster OpenStreetMap tiles, SVG polygons | Opened on a South-Asia view (India, Myanmar, Bay of Bengal took most of the screen); no camera transitions beyond `panTo`; hover restyled whole SVG layers |
| Geography | 64 districts bundled into the JavaScript (`src/data/bangladesh_districts.json`) | No divisions, no upazilas, no search; district identified by click only |
| Flood layer | None on the map | Districts were **not coloured by forecast**: the selected one was filled bright green, which reads as "safe" (fixed in the Earth & Emerald round with a forecast choropleth) |
| Point Check | Map click → `POST /geospatial/flood/check` → three stat cards (risk, 24 h %, depth) | No place name, no upazila, no model or source details, no "district-level" warning on the forecast, no GPS-in-map or coordinate entry |
| Place names | `GET /geospatial/place-name` on **geoBoundaries ADM3 (2020, 544 units, names only)** | A different boundary vintage from the districts (COD-AB v03, 2023): mixed releases, no upazila codes |
| Panel | Map embedded in a dashboard card with a separate district dropdown, date input and GPS button | The map competed with controls; no breadcrumb, back or reset |
| Mobile | Fixed-height map (480 px) + stacked cards | Page scrolling was captured by the map; no bottom sheet |
| Attribution | Hidden (`attributionControl: false`) | OpenStreetMap licence requires it (restored earlier) |

## Real data available (all already served by the backend)

| Data | Endpoint | Resolution | Kind |
| --- | --- | --- | --- |
| District flood forecast (XGBoost, calibrated probability, Watch/Alert) | `GET /predictions?target_date=` | district, one day | model forecast (56 of 64 districts) |
| Model inputs per district: rain 1–30 d, river flow vs 30-day mean, hazard share, last satellite share | inside each prediction (`features`) | district point / nearest of 9 river sites | model input |
| Latest Sentinel-1 flood observation per district (Copernicus GFM) | `GET /geospatial/flood/satellite-observations/latest?date=` | district, per pass | observed |
| Flood history (10 UNOSAT events 2016–2024) and JRC 10/100-year hazard share | `GET /geospatial/flood/districts` | district | historical / modelled |
| Point check: ~93 m grid cell — UNOSAT events seen/flooded, JRC modelled depth, permanent water | `POST /geospatial/flood/check` | ~93 m cell | historical / modelled |
| Model metadata, test results, limitations | `GET /predictions/model` | — | — |
| Readable place (upazila, district) | `GET /geospatial/place-name` | upazila | boundaries |

Not available anywhere in the system: gridded forecast inundation, hourly forecast horizons, official FFWC gauge
levels or warnings, verified impact/damage, union boundaries, a district map of forecast rain.

## Performance notes

- Initial JavaScript is dominated by an older 2.2 MB shared chunk (464 KB gzip) that bundles saved sample JSON
  for offline fallbacks. Not changed in this work; worth splitting later.
- Leaflet re-created the whole district GeoJSON layer on every selection change.

## Tests

No frontend test runner. Backend: pytest against local Docker Mongo (`tests/`), including
`test_api_place_name.py`. Map behaviour is verified in a real browser (Playwright) — see MAPPING_ARCHITECTURE.md §9.
