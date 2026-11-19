# Bangladesh geographic data (Stage 1, 19 November 2026)

## Decision

All map geography — divisions, districts, upazilas, and the server's place-name lookup — comes from **one
release**: *Bangladesh – Subnational Administrative Boundaries (COD-AB)* **v03**, **valid on 2023-05-21**,
produced by the **Bangladesh Bureau of Statistics (BBS)** with OCHA ROAP, published on HDX
(<https://data.humdata.org/dataset/cod-ab-bgd>), licence **CC BY-IGO**. Downloaded 19 Nov 2026 (archive
dated 2026-01-26, dataset reviewed June 2025).

Attribution shown on the map: *Boundaries © BBS & UN OCHA (COD-AB v03, 2023), CC BY-IGO.*

## Sources examined

| Source | What it offers | Verdict |
| --- | --- | --- |
| **Survey of Bangladesh via NSDI** (<https://new.nsdi.gov.bd/datacatalog/>) | Upazila GIS database (495 upazilas, Esri geodatabase, BUTM 2010, "2023, work ongoing"); district and division maps as MXD/PDF/hard copy; no union layer; licence and public download not stated | Most authoritative producer, but no openly licensed, downloadable vector boundaries today. PDF/MXD maps are not interactive datasets. Re-check when the upazila database is published. |
| **COD-AB v03 (BBS/OCHA, HDX)** | Levels 0–3 as GeoJSON/SHP/GDB; stable P-codes with parent codes; CC BY-IGO | **Chosen.** Official statistical boundaries, open licence, all levels from one release |
| geoBoundaries gbOpen BGD ADM3 | 544 upazilas/thanas (2020 BBS/OCHA), names only, no parent codes | **Retired** from the server: older vintage than the districts (mixed releases) and no stable IDs |
| Union-level shapefiles in unofficial mirrors (R package `bangladesh`, GitHub copies of HDX data) | Admin 4 unions | Not used: unknown licence/vintage; HDX itself says ward/union boundaries are not officially confirmed |

### Discrepancies documented

- **Upazila counts differ:** COD-AB v03 has 507 admin-3 units (upazilas plus city corporations/thanas as BBS
  lists them in 2023); NSDI's SoB database states 495 upazilas; the 2020 geoBoundaries set had 544. We use
  COD-AB's 507 because it is the only open dataset of the same vintage as the 64 districts. Counts are never
  hard-coded in the UI; they come from the data.
- **Unions:** not in COD-AB v03 and not in the NSDI catalogue → the map stops at upazila, then point.

## Validation (script `Backend/scripts/build_map_geography.py`, all checks pass)

| Check | Result |
| --- | --- |
| Counts | 1 country, **8 divisions, 64 districts, 507 upazilas**, 0 unions |
| Version / vintage | every feature `version = v03`, `valid_on = 2023-05-21` |
| IDs | unique P-codes per level; every district code starts with its division code, every upazila code with its district code; all 64 district codes and names identical to the server's existing district file |
| Geometry | 0 invalid geometries in the source; every simplified output re-checked valid |
| CRS | OGC CRS84 (WGS 84 lon/lat) — used as is, no reprojection |
| Coverage | every district has upazilas (3–18 each) |
| Server lookup | `tests/test_api_place_name.py`: all 507 upazilas belong to an existing district of the same release |

Bangla names: COD-AB has none. Divisions and districts use the app's existing Bangla list; upazilas are shown
in English until a verified Bangla list is added (never machine-transliterated).

## Preprocessing

| Output | Use | Processing | Size (raw / gzip) |
| --- | --- | --- | --- |
| `Frontend/public/geo/districts.json` | national map | `coverage_simplify` tolerance 0.004 (borders move ≤ ~1 km, area ≤ 0.25 %, measured); island parts < 0.5 km² dropped; 4 decimals | 288 KB / 76 KB |
| `…/divisions.json` | division outlines | **dissolved from the simplified districts** (edges coincide exactly); parts < 2 km² dropped | 104 KB / 31 KB |
| `…/mask.json` | dims everything outside Bangladesh | country outline as holes in a world polygon | 73 KB / 25 KB |
| `…/upazilas/<district>.json` (64 files) | loaded when a district is selected | `coverage_simplify` 0.0008; parts < 0.05 km² dropped; 5 decimals; plus the district outline dissolved from them (so the selected-district line matches its upazilas) | ~20 KB gzip each (largest 32 KB) |
| `…/index.json` | search, labels, camera targets | every place: level, code, parents, bounds, label point (polylabel) | 119 KB / 21 KB |
| `…/meta.json` | provenance | source, version, counts, tolerances | — |
| `Backend/data/boundaries/bangladesh_upazilas.geojson` | server place-name lookup | `coverage_simplify` 0.0005, no parts dropped | 4.9 MB |

`coverage_simplify` simplifies each shared border once, so neighbouring areas never gap or overlap after
simplification. Dropped "parts" are only sub-pixel islands (river chars, coastal islets) at that level's zoom;
no administrative unit is ever dropped. Regenerate with:

```
cd Backend && python scripts/build_map_geography.py path/to/bgd_admin_boundaries.geojson.zip --web-out ../Frontend/public/geo
```

## Other map data

| File | Source | Licence | Use |
| --- | --- | --- | --- |
| `rivers.json`, `rivers-minor.json`, `river-labels.json` | **OpenStreetMap** `waterway=river` ways inside Bangladesh (Overpass extract 19 Nov 2026; 6,585 ways, 810 named). Merged by name, ranked by length in/near Bangladesh (≥ 150 km, ≥ 40 km, shorter), simplified 0.0008–0.0015°; unnamed lines ≥ 3 km kept separately for close zoom. 314 named rivers (135 with a Bangla name), 1,479 unnamed lines. Replaces the earlier 10-feature Natural Earth file. | © OpenStreetMap contributors, **ODbL 1.0** (attribution shown; derived files are offered under the same licence) | Geographic context, river names, search — never a flood layer |
| `places.json` | COD-AB v03 admin capitals: national (1), division (7 more) and district (56 more) headquarters — 64 in total, each district once | CC BY-IGO | HQ points and names |
| `names-bn.json` | Bangla upazila names from OpenStreetMap admin_level 6 relations, accepted **only** when the OSM centre lies inside the COD-AB upazila **and** the English names agree; " উপজেলা" suffix removed. 415 of 507 matched, 56 OSM upazilas rejected. Community-maintained spelling, not an official BBS list. | ODbL 1.0 | Bangla labels, panels, search |
| `terrain/{z}/{x}/{y}.png` (81 tiles, 5.2 MB) | **Copernicus DEM GLO-90** (31 one-degree tiles, AWS open data, 2011–2015 TanDEM-X radar; 90 m; a *surface* model incl. trees and buildings; absolute vertical accuracy a few metres). Colour relief in 9 classes (< 2 m … > 800 m) + hillshade (sun 315°/45°), Web Mercator zoom 6–9 (~280 m/px at zoom 9). | Copernicus DEM licence (free use with attribution: © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the EU and ESA) | Terrain layer |
| `terrain-stats.json` | Same DEM: per district and upazila the median height and share of 90 m cells below 5 m and 10 m inside the COD-AB boundary (571 areas) | as above | "Geography and terrain" in panels |

All context files are built by `Backend/scripts/build_map_context.py` (sources and steps in its docstring).
| River-flow stations | Rokkha backend (`/ingestion/sites`, `/ingestion/river`): 9 GloFAS river cells chosen and verified by `scripts/build_ingestion_sites.py` | GloFAS via Open-Meteo, CC BY 4.0 | Modelled discharge; not gauged water levels |
