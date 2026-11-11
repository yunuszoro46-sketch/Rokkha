# Model inputs and training table

## `district_static.json`: fixed inputs per district

Built by `scripts/build_district_static.py` (needs `requirements-dev.txt`).

| Field | Meaning | Source |
|---|---|---|
| `hazard_share_10yr`, `hazard_share_100yr` | share (0–1) of the district's ~90 m cells inside the **modelled** 10- / 100-year river-flood zone | JRC GloFAS flood hazard maps v2.1.2 (`data/flood/flood_grid.npz`) |
| `permanent_water_share` | share of cells that are permanent water | JRC |
| `rain_site_id` | the district's rain site | `data/ingestion/sites.json` |
| `river_site_id`, `river_distance_km` | the nearest verified river site and its WGS84 distance from the rain site | `data/ingestion/sites.json` |
| `labelled` | whether satellite passes ever saw at least half the district | `data/labels/` |

Limitation: "nearest river site" is a simple rule. With only 9 verified river
sites, some districts are far from theirs (up to 191 km; Feni's and Goalundo's
sites each serve 15 districts). The distance is given to the model as an input
so it can learn how much that river matters.

## `training_table.csv`: one row per district and labelled satellite pass

Built by `scripts/build_training_table.py` from the 2016–2024 rain and river
backfill. It reads the database named in `Backend/.env` (read only). The
committed table has 21,165 rows (train 13,839 with 411 floods, validation 2,543
with 112, test 4,783 with 109); no pass was dropped for missing rain. With it,
`scripts/train_flood_model.py` can be re-run without a database.

| Columns | Meaning |
|---|---|
| `pcode`, `name`, `division`, `date`, `year` | which district and which pass (UTC day) |
| `split` | `train` (2016–2021), `validation` (2022) or `test` (2023–2024) |
| `label` | 1 = flood observed, 0 = not (the rule stored in the labels file) |
| `flooded_share`, `observed_share`, `advisory_share` | the pass itself: for analysis, **never model inputs** |
| the other 15 columns | the model inputs (`FEATURE_NAMES` in `app/modules/prediction/features.py`) |

Rules:

- **No future data.** Inputs for day D use only values dated before D. The same
  function builds the inputs for live predictions (tested).
- A rain total is empty when any day in its window is missing, never a
  too-small sum. Passes without 30 days of stored rain are left out and counted
  in `training_table.meta.json` (`dropped_for_missing_rain_by_year`).
- River and satellite inputs may be empty; the model handles gaps.
- Empty cell = value not available.

Sources: Copernicus EMS GFM (labels), ERA5 via Open-Meteo (rain), GloFAS via
Open-Meteo (river flow, modelled), JRC flood hazard maps (modelled hazard).
