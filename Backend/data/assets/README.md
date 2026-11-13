# Facilities from OpenStreetMap

`osm_facilities.json` holds the hospitals, clinics and flood/cyclone shelters that
`scripts/import_osm_facilities.py import` adds to the `assets` collection.

| | |
| --- | --- |
| Source | OpenStreetMap, through the Humanitarian OpenStreetMap Team (HOT) exports on HDX: [health facilities](https://data.humdata.org/dataset/hotosm_bgd_health_facilities) and [points of interest](https://data.humdata.org/dataset/hotosm_bgd_points_of_interest) |
| Snapshot | 4 November 2026 |
| Licence | Open Database License (ODbL) 1.0. Credit: **© OpenStreetMap contributors** |
| Built on | 13 November 2026 |
| Rows | 3,260: 2,118 hospitals, 978 clinics, 164 shelters. 3,162 lie inside the district boundaries and were imported; 98 fall just outside (the export's box reaches a little past the border) |

## What was selected

- **hospital**: `amenity=hospital` or `healthcare=hospital`
- **clinic**: `amenity=clinic`, or `healthcare=clinic` / `centre`
- **flood_shelter**: any place whose name says cyclone/flood shelter or centre (often a school that doubles as a shelter)
- Only places with a name. Pharmacies, dentists and single doctors are left out.
- A building outline becomes one point inside it.

## What this data is not

- **Not complete.** Volunteers mapped it; towns are covered better than remote areas. Only 164 shelters carry a
  shelter name, far fewer than exist. A missing place does not mean there is none.
- **Not checked on the ground.** A place may have closed, moved or be mis-tagged.
- **No capacity and no value.** OpenStreetMap had a capacity for none of the selected places, so `occupancy` is
  empty; `replacement_value_bdt` is always empty. Totals of people or money over these assets are therefore 0,
  which means "unknown", not "nobody".
- **`criticality` is a rule, not a fact**: hospital = critical, clinic and shelter = high.

Every imported asset has `source: "OpenStreetMap"` and says so in its `notes`.

## Rebuild or undo

```bash
python scripts/import_osm_facilities.py build --health <health_facilities.geojson> --poi <points_of_interest.geojson> --snapshot YYYY-MM-DD
python scripts/import_osm_facilities.py import     # adds only what is not stored yet
python scripts/import_osm_facilities.py remove     # deletes only the OpenStreetMap assets
```
