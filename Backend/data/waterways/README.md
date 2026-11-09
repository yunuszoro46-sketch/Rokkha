# Dhaka waterways

`dhaka_waterways.geojson` holds the linear waterways (rivers, canals,
streams, drains, ditches) inside Dhaka District (pcode `BD3026`), as
GeoJSON LineStrings in `[longitude, latitude]` (WGS84).

| Type | Features |
|---|---|
| river | 91 |
| canal | 446 |
| stream | 13 |
| drain | 1567 |
| ditch | 24 |

Each feature has: `osm_id`, `waterway_type`, `name` (English name if
mapped, otherwise the main name), `name_bn` (Bengali name if mapped).

## Source and license

- **Dataset:** Waterways of Bangladesh (OpenStreetMap export)
- **Exported by:** Humanitarian OpenStreetMap Team (HOT), via the Humanitarian Data Exchange (HDX)
- **URL:** https://data.humdata.org/dataset/hotosm_bgd_waterways
- **Snapshot:** 2026-11-04
- **License:** Open Database License (ODbL) 1.0 — https://opendatacommons.org/licenses/odbl/1-0/

Attribution: *Waterway data © OpenStreetMap contributors, available under
the Open Database License (ODbL).*

**Share-alike:** this file is a derived database of OpenStreetMap data, so
this file (and any database derived from it) must remain under ODbL.
This applies to the data only, not to the Climate Shield source code.

## Changes made from the original

- Kept only features with `adm2_pcode = BD3026` (Dhaka District) and
  `waterway` in {river, canal, stream, drain, ditch} with LineString geometry.
- Rounded coordinates to 6 decimal places (about 0.1 m) and removed
  consecutive duplicate positions.
- Skipped 3 features: 2 lines that became invalid after rounding (too short),
  1 feature that was not a LineString.
- Renamed properties to `osm_id`, `waterway_type`, `name`, `name_bn`.

Regenerate with `scripts/extract_dhaka_waterways.py` (see its docstring).

## Known limitations

- **Drains are very incomplete.** Only about 75 km of drains are mapped;
  Dhaka's real storm-drain network (managed by Dhaka WASA) is much larger
  and not published as open data. Do not treat drain coverage as complete.
- **Rivers and canals are well mapped**, but many canals have no name.
- OpenStreetMap is crowd-sourced and "cannot be considered exhaustive" (HOT).
- Coverage is Dhaka District only. For points outside it, the true nearest
  waterway may not be in this file.
