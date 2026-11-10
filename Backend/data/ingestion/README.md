# Ingestion measuring sites

`sites.json` lists the points where the ingestion module (`app/modules/ingestion/`)
collects rain and river data. Built by `scripts/build_ingestion_sites.py`.

## District sites (64) — rain

One point inside each district of Bangladesh: Shapely's `representative_point()`
of the district polygon (`data/boundaries/bangladesh_districts.geojson`, HDX COD-AB
v03, CC BY-IGO). A representative point is always inside the polygon; a centroid can
fall outside an oddly shaped district. Site ids: `district-<pcode>`, e.g.
`district-BD3026` (Dhaka).

ERA5 rain is on a ~0.25° (~25 km) grid, so neighbouring districts can share a grid
cell; every stored value records the grid point it really came from
(`grid_location`).

## River sites (9) — river discharge

Well-known river gauge locations. The starting coordinates are **approximate** desk
positions near the named place. GloFAS (the river model) works on a ~5 km grid, and a
point slightly off the channel can land on a small stream: near Sunamganj two
neighbouring cells carry 5.6 and 1,051 m³/s. So each candidate was **snapped** to the
GloFAS cell with the highest mean discharge (July–August 2020) within ±0.05° (~5.5 km)
and **verified** (≥ 100 m³/s). The site's `location` is the snapped cell;
`approximate_location` is the starting point.

| Site id | Name | GloFAS cell [lon, lat] | Mean Jul–Aug 2020 (m³/s) | Moved (km) |
|---|---|---|---|---|
| surma-sunamganj | Surma near Sunamganj | [91.375, 25.075] | 1,240 | 2.6 |
| kushiyara-sherpur | Kushiyara near Sherpur (Moulvibazar) | [91.625, 24.625] | 2,219 | 5.6 |
| jamuna-bahadurabad | Jamuna (Brahmaputra) near Bahadurabad (Jamalpur) | [89.675, 25.075] | 59,548 | 8.7 |
| jamuna-sirajganj | Jamuna (Brahmaputra) near Sirajganj | [89.725, 24.425] | 60,298 | 3.2 |
| ganges-hardinge-bridge | Ganges (Padma) near Hardinge Bridge | [88.975, 24.075] | 42,134 | 5.6 |
| padma-goalundo | Padma near Goalundo (Rajbari) | [89.775, 23.775] | 104,259 | 3.2 |
| meghna-bhairab | Meghna near Bhairab Bazar (Kishoreganj) | [90.925, 24.025] | 6,607 | 6.2 |
| teesta-kaunia | Teesta near Kaunia (Rangpur) | [89.475, 25.725] | 3,480 | 7.6 |
| feni-area-river | Feni area river (name not verified) near Feni | [91.425, 22.925] | 162 | 3.8 |

Notes:

- **Jamuna at Bahadurabad moved 8.7 km** (over the 8 km check). Its flow equals the
  Jamuna at Sirajganj (~60,000 m³/s), which no other river in Bangladesh carries, so the
  identification is sound; the Jamuna is a braided river several km wide.
- **Feni:** the cell is 4 km south of the town; which river it belongs to is not
  verified, so it is named "Feni area river".
- River sites measure discharge only: the rain that drives a river falls upstream, not
  at the gauge.

## Excluded: Buriganga near Dhaka

A wider first search (±0.1°) jumped 18 km to the Dhaleshwari–Meghna system
(8,048 m³/s). At ±0.05° it picked a 670 m³/s cell east of Sadarghat, while another
cell 4 km south-west carries 364 m³/s — and both lie near OpenStreetMap lines named
"Buriganga River". GloFAS's ~5 km cells cannot separate the Buriganga from the Turag,
Dhaleshwari and Shitalakshya where they meet, so no cell can honestly be called "the
Buriganga". It is listed in `excluded_river_candidates` with this reason. Dhaka keeps
its district rain site.

## Sources and licenses

- GloFAS river discharge: Copernicus Emergency Management Service (Global Flood
  Awareness System), via the Open-Meteo Flood API — CC BY 4.0 ("Weather data by
  Open-Meteo.com").
- District boundaries: Bangladesh Bureau of Statistics and UN OCHA via HDX — CC BY-IGO.

Rebuilding costs about 9 × 4.4 ≈ 40 Open-Meteo calls per river candidate.
