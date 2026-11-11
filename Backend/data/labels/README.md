# Satellite flood observations per district (Copernicus GFM)

`district_flood_observations.json` records, for each of the 64 districts and
each Sentinel-1 radar pass from April to November 2016–2026 (up to the last
fetch), how much of the
district the satellite could see and how much of that was under unusual (flood)
water. These are **observations** and the candidate **labels** for the flood
model. They are not a forecast and not a modelled hazard.

Built by `scripts/build_gfm_labels.py` (needs `requirements-dev.txt`):

```bash
python scripts/build_gfm_labels.py fetch --start 2016-04 --end 2024-11   # ~1.5–2 h, resumable
python scripts/build_gfm_labels.py assemble
```

`fetch` keeps one cache file per month in `.cache/` (not committed) and skips
cached months, so an interrupted run can be started again. A month fetched
before it was over (or within 3 days after) is fetched again, so the current
month stays up to date. `scripts/daily_update.py` runs `fetch` for this month
and the last (all months, `--months 1-12`) and then `assemble`, every day.

**Model training uses 2016–2024 only** (the 21,165 passes and 632 floods
described below). Passes of 2025–2026 (4,743 labelled passes, 160 floods by the
same rule, as of 11 November 2026) are inputs for live predictions and are
kept for a later check of the model on years it has never seen. They come from
GFM v4.x, the training years from v3.1.0; the effect of that version change has
not been measured.

## Why GFM and not only the UNOSAT maps (Milestone 14)

The UNOSAT maps give only 291 usable district-event examples, 253 of them
"flooded". Satellites were tasked during floods, some floods (2019, 2023) are
missing, and seasonal haor water counts as flood. A model trained on that would
mostly learn "monsoon = flood". GFM analyses **every** Sentinel-1 pass, so it
also records ordinary days with no flood, and it removes normal seasonal water.
UNOSAT is kept as an independent check.

## Format

| Field | Meaning |
|---|---|
| `columns` | `date, observed_share, flooded_share, advisory_share` |
| `districts[].rows` | one row per pass, in date order |
| `date` | UTC day of the Sentinel-1 pass |
| `observed_share` | share (0–1) of the district's land covered by the pass **and** not in GFM's exclusion mask |
| `flooded_share` | share (0–1) of the observed land GFM marked as flood |
| `advisory_share` | share (0–1) of the observed land with a GFM advisory flag |
| `land_pixels` | the district's land in 80 m pixels (the denominator of `observed_share`) |

Rows where a pass saw less than 5 % of a district are not stored. The API
(`GET /api/v1/geospatial/flood/districts/{pcode}/satellite-observations`)
returns by default only passes that saw at least 50 % (the same rule as the
UNOSAT history).

## Method

GFM pixel values (GFM Product User Manual, sections 3.1–3.6):

- **Observed Flood Extent:** 1 = flood, 0 = no flood, 255 = not covered by
  the pass. GFM has **already removed** normal water: the Reference Water Mask
  (permanent water plus that month's seasonal water, from a 2018–2022 Sentinel-1
  reference) and the Exclusion Mask.
- **Exclusion Mask:** 1 = radar cannot map floods here (no sensitivity, such as
  cities and dense vegetation; water look-alikes; steep terrain; radar shadow).
- **Advisory Flags:** 1 = low regional backscatter (dry soil, frost), 2 = wind-
  roughened water, 3 = both. Use with caution, but the pixels are not excluded.

For each district and pass:

```
observed = district land AND covered by the pass AND NOT excluded
flooded  = observed AND flood pixel
```

- One pass is delivered as several overlapping scenes; their pixel masks are
  combined (OR), never added, so overlaps are not counted twice.
- The 20 m rasters are read at 1/4 resolution (80 m), close to the 90 m flood
  grid of Milestone 14. Only the window over Bangladesh is read, straight from
  the open archive (cloud-optimised GeoTIFF); nothing large is downloaded.
- GFM uses the Equi7 Asia projection. Its pixels over Bangladesh cover about
  2.5 % less ground than the nominal 80 m. This cancels out because every
  value is a ratio.
- All of 2016–2024 was processed with **GFM v3.1.0**
  (`gfm_processing_versions_by_year`), so the training years are comparable.
  Passes from April 2025 on come from v4.0.0 to v4.1.1.

Check: the trial for Sunamganj 2022 shows 0.5–7.8 % on ordinary days, a first
wave from 13 to 30 May (peak 58.6 % on 23 May) and a second wave in June
(30.7 % on 18 June, the day after ERA5's 104 mm rain peak). This agrees with
UNOSAT's event window (25 May – 21 June).

## Label rule: when is a pass a "flood observation"?

```
flooded = observed_share >= 0.5  AND  flooded_share >= 0.10
```

Passes that saw less than half a district get **no label** (unknown).
The rule is stored in the file (`label_rule`), so the API and the future
dataset builder use the same definition.

How 10 % was chosen:

| Check | 5 % | 10 % |
|---|---|---|
| Sunamganj trial: ordinary days 0.5–7.8 %, flood days ≥ 14.8 % | ordinary haor days would count as floods | separates them |
| UNOSAT "not flooded" district-events that GFM also calls dry | 26 / 28 | 26 / 28 |
| Flood observations (passes seeing ≥ 50 %) | 1,547 of 21,165 (7.3 %) | 632 of 21,165 (3.0 %) |
| Big flood years (2017, 2020, 2022, 2024) vs quiet years (2021, 2023) | stand out | stand out (2022: 4.4 %, 2021: 1.0 %) |
| Peak months | July | June–July |
| Top districts | Sylhet, Moulvibazar, Netrakona, Kishoreganj | Sylhet, Kishoreganj, Moulvibazar, Netrakona |

GFM and UNOSAT agree in direction (correlation 0.6 between UNOSAT's flooded
share and GFM's highest share during the same event, over 260 district-events).
They are not expected to match exactly: UNOSAT counts **all** water above
permanent rivers as flood, including the haors' normal monsoon water, so most
UNOSAT "flooded" districts sit below 10 % in GFM. The raw shares stay in the
file, so a 5 % rule can be tested later as a sensitivity check.

## Districts without labels

No pass ever saw half of these 8 districts, because the radar cannot map floods
there (GFM exclusion mask). The flood model cannot be trained or checked for them:

| District | Best observed share | Why |
|---|---|---|
| Bandarban | – (fully excluded) | steep hills |
| Rangamati | 14.7 % | hills, Kaptai lake |
| Khagrachhari | 10.8 % | hills |
| Chattogram | 38.6 % | hills |
| Cox's Bazar | 47.6 % | hills, coast |
| Gazipur | 45.4 % | sal forest, built-up land |
| Bagerhat | 45.1 % | Sundarbans mangrove forest |
| Khulna | 49.5 % | Sundarbans mangrove forest |

## Archive gaps

- 259 scenes (one south-eastern tile, 2017–2021) have **no advisory-flag file**
  in the archive (HTTP 404). Their flood data is used; the advisory share is
  computed from the other scenes, or is null (`advisory_flags_missing`).
- 4 scenes do not list a flood or exclusion layer and are skipped
  (`skipped_scenes`).

## Known limitations

- Passes come every few days; a short flood between passes is missed.
- A pass usually sees only part of a district. Unseen land is **unknown**, not
  dry.
- Radar underestimates water in built-up areas and under dense vegetation, so
  city waterlogging (for example Dhaka streets) is largely missed.
- GFM is an automated product. Its flood extent can include false detections,
  such as wet-soil look-alikes; the advisory share shows where confidence is lower.
- `advisory_share` is often high (0.8–1.0) **during** big floods, such as Sunamganj in May–June 2022. The
  "low regional backscatter" flag fires when a whole region looks dark to the radar, and widespread flood
  water does exactly that. Treat it as a caution note, not as evidence against the flood.
- The licence says the data is for information only and is **not a flood
  warning**.

## Source and licence

Copernicus Emergency Management Service, Global Flood Monitoring (GFM),
Sentinel-1 ensemble flood extent, exclusion mask and advisory flags. Read from
the EODC open archive (STAC: `https://stac.eodc.eu/api/v1`, collection `GFM`).
The CEMS-FLOODS licence allows reproduction, distribution and adaptation, with
this notice:

> Contains modified Copernicus Emergency Management Service information [2016-2024].

Data is provided "as is", for information only, and does not constitute a
flood warning.

References:
- Salamon, P. et al. (2021), *The New, Systematic Global Flood Monitoring
  Product of the Copernicus Emergency Management Service*, IGARSS 2021.
- GFM Product User Manual (GFM D5.2, 2025).

District boundaries: Bangladesh Bureau of Statistics and UN OCHA via HDX, CC BY-IGO.
