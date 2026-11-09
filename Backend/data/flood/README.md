# Bangladesh flood history and flood grid

Built by `scripts/build_flood_data.py` (needs `requirements-dev.txt`).

| File | What it is |
|---|---|
| `district_flood_history.json` | For all 64 districts: in which observed flood events the district was covered by satellite analysis, what share of its land was under flood water, and a ranking by how often it flooded |
| `flood_grid.npz` | A ~90 m grid over all of Bangladesh (compressed numpy arrays): for every cell, which events observed it, which events flooded it, the modelled 10- and 100-year river-flood depth class, and whether it is permanent water |
| `../boundaries/bangladesh_districts.geojson` | The 64 district boundaries used for the statistics (simplified) |

## Two kinds of flood information — never mix them up

- **Observed** (`observed_mask`, `flooded_mask`) — flood water that
  satellites **actually saw** (UNOSAT): where flooding **did** happen.
  These are candidate *labels* for the later ML model.
- **Hazard model** (`hazard`) — **modelled** river flooding (JRC GloFAS) for a
  10-year and a 100-year flood, by depth class (< 1 m, 1–3 m, 3–10 m,
  > 10 m): where flooding **could** happen, not where it did.

## Grid format (`flood_grid.npz`)

Load with `numpy.load`. Arrays:

| Array | Type | Meaning |
|---|---|---|
| `transform` | 6 floats | affine `(a, b, c, d, e, f)`: `lon = c + col*a`, `lat = f + row*e` (cell centre at `+0.5`) |
| `event_ids` | strings | event order; bit *k* below = `event_ids[k]` |
| `observed_mask` | uint16 | bit *k* set → a satellite analysis covered this cell in event *k* |
| `flooded_mask` | uint16 | bit *k* set → flood water was seen in this cell in event *k* |
| `hazard` | uint8 | bits 0–2: 10-year depth class (0 = dry), bits 3–5: 100-year depth class, bit 6: permanent water |

Cells outside Bangladesh's districts are all zero.

Why a grid and not polygons: flood patterns are made of thousands of small
fragments. As polygons they took ~38 MB for only 9 districts (and simplifying
them lost up to 65 % of some zones' area). The grid stores all of Bangladesh
exactly at the source resolution in a few MB, and finding a point is just a
row/column calculation.

## Sources and licenses

### UNOSAT satellite-detected flood water — CC BY-SA
United Nations Satellite Centre (UNOSAT), via the Humanitarian Data
Exchange: https://data.humdata.org/organization/unosat
Event packages used (UNOSAT codes): FL20160725BGD, TC20170529BGD,
FL20170815BGD, FL20180619BGD, TC20200518BGD, FL20200713BGD,
FL20210729BGD, FL20220525BGD, FL20240502BGD, TC20240502BGD,
FL20240825BGD. Download links for each package are in the HDX dataset
pages; the exact layers used per event are listed in
`district_flood_history.json` → `events[].layers_used`.

Share-alike: the derived flood-history and flood-grid data must stay
under CC BY-SA. This applies to the data, not to the Climate Shield code.

### JRC global river flood hazard maps v2.1.2 — CC BY 4.0 / ODbL
© European Union, 1995–2026. European Commission, Joint Research Centre.
Baugh, C., Colonese, J., D'Angelo, C., Dottori, F., Neal, J., Prudhomme, C.,
Salamon, P. (2024): Modelled flood inundation for different return period
scenarios at the global scale.
https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/CEMS-GLOFAS/flood_hazard/
The folder's `copyright.txt` states CC BY 4.0, its `README.txt` states ODbL
v1.0. We attribute both and follow the stricter (ODbL share-alike) for the
derived data. Files used: `RP10` and `RP100` `*_depth_reclass.tif` and
`Permanent_WaterBodies/*_permanent_water.tif`, tiles N30_E80 and N30_E90.

### District boundaries — CC BY-IGO
Bangladesh Bureau of Statistics (BBS) and UN OCHA, via HDX COD-AB v03:
https://data.humdata.org/dataset/cod-ab-bgd
Simplified with a 0.0005° tolerance (largest border shift measured ≈ 72 m).

## Method

1. Everything is put on the JRC 3-arc-second grid (~90 m).
2. **Flooded cell = UNOSAT detected water AND NOT JRC permanent water.**
   Older UNOSAT products map *all* water (rivers included) while newer ones
   separate pre-flood water, so subtracting one permanent-water layer makes
   every event comparable.
3. Water classes used: 1 flood water, 2 flood-affected land / possible flood
   water, 3 flash-flood-affected land, 4 (2016 water extent), 99 maximum flood
   extent. Excluded: 0 pre-flood water, 6 possibly saturated soil,
   9 aquaculture, 14 tsunami. NOAA VIIRS layers (375 m) are excluded as too
   coarse. Impact and context layers are excluded: affected cropland,
   flooded wetland, flooded building footprints ("FloodedStructure"),
   affected roads, cloud masks and building-damage surveys. (UNOSAT's own
   typo "AnglysisExtent" in two 2024 layers is recognised as an analysis
   extent.)
4. Each event only uses layers whose image date falls inside the event's
   dates (UNOSAT packages are cumulative and repeat older layers).
5. An analysis extent counts as "observed" only if it belongs to a water
   analysis (same image date, or package-wide). Building-damage survey
   areas are not counted as observed.
6. An event is **skipped entirely** (listed in `skipped_events`) when it has
   no analysis extent, or when every water detection in it uses an excluded
   class — otherwise flooded places would be recorded as "observed dry".
   Cyclone Mora (2017) is skipped for this reason: UNOSAT only published
   "possibly saturated soil / possible flood water" (class 6) for it.
7. A district is **observed** in an event when ≥ 50 % of its land was inside
   the analysis extent, and **flooded** when ≥ 2 % of its observed land was
   flood water. Districts are ranked by number of flooded events, then by
   their largest flooded share.

## Known limitations

- Radar **underestimates standing water in built-up areas** and under dense
  vegetation, so urban waterlogging (e.g. Dhaka streets) is largely missed.
- Satellites only looked at some regions in each event. `not_observed` means
  *no data*, not *dry*.
- Each event is a few image dates; flood peaks between images can be missed.
- JRC hazard maps model **river** floods only, **ignore flood embankments**
  (protected areas such as central Dhaka are overstated) and do not model
  rainfall-driven waterlogging.
- UNOSAT analyses are preliminary and "not yet validated in the field".
- **Seasonal wetlands** (haors, beels) fill with water every monsoon. JRC
  does not count them as permanent water, so normal seasonal inundation is
  counted as "flood water" alongside damaging floods. Important when these
  observations are used as ML labels later.
- Results describe a ~90 m grid cell, not an exact spot.
