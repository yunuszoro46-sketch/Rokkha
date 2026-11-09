# Dhaka administrative boundaries

`dhaka_boundaries.geojson` holds Dhaka District (admin level 2) and the
7 upazilas / city corporations inside it (admin level 3).

| pcode | Name | Level |
|---|---|---|
| BD3026 | Dhaka (District) | 2 |
| BD30260014 | Dhamrai | 3 |
| BD30260018 | Dohar | 3 |
| BD30260038 | Keraniganj | 3 |
| BD30260062 | Nawabganj | 3 |
| BD30260072 | Savar | 3 |
| BD30262000 | Dhaka South City Corporation | 3 |
| BD30262500 | Dhaka North City Corporation | 3 |

## Source and license

- **Dataset:** Bangladesh – Subnational Administrative Boundaries (COD-AB), version 03
- **Source:** Bangladesh Bureau of Statistics (BBS)
- **Contributed by:** OCHA Regional Office for Asia and the Pacific (ROAP)
- **Published by:** OCHA Field Information Services Section (FISS) and the Humanitarian Data Exchange (HDX)
- **URL:** https://data.humdata.org/dataset/cod-ab-bgd
- **License:** Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)
- **Valid on:** 2023-05-21 (dataset reviewed June 2025)

Attribution: *Administrative boundaries © Bangladesh Bureau of Statistics (BBS)
and UN OCHA, via the Humanitarian Data Exchange, licensed under CC BY-IGO.*

## Changes made from the original

- Kept only Dhaka District (`adm2_pcode = BD3026`) and its admin level 3 units.
- Renamed properties to `name`, `pcode`, `admin_level`, `parent_name`,
  `parent_pcode`, `area_sqkm`, `valid_on`, `version`.
- Rounded coordinates to 6 decimal places (about 0.1 m).

Regenerate with `scripts/extract_dhaka_boundaries.py` (see its docstring).

## Known limitations

- **No ward boundaries.** HDX states ward-level (admin 4) boundaries are not
  officially confirmed or maintained, so they are not included.
- Boundary alignment follows BBS as of March 2025; other sources
  (e.g. OpenStreetMap) may differ slightly.
