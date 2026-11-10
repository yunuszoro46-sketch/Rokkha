# Climate Shield — API guide for the frontend

Climate Shield helps protect **lives and assets from floods in Bangladesh**.
The backend already knows where floods have happened (satellite
observations, 2016–2024), where they could happen (a flood model), the
district boundaries, Dhaka's rivers and canals, and which buildings
("assets") we are protecting. This guide is everything you need to build
screens on top of it.

> **Not built yet:** flood *forecasts* / probabilities, alerts and user
> accounts. Don't design screens that
> show "chance of flooding tomorrow" as real data yet.

---

## 1. Run the backend on your machine

You need Python 3.12+ and Git.

```bash
git clone https://github.com/yunuszoro46-sketch/Rokkha.git
cd Rokkha/Backend
python -m venv .venv
source .venv/bin/activate            # Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

The backend needs a **MongoDB** database to start (assets are stored there).
Two options:

**Option 1 — your own local MongoDB in Docker (easiest, no account needed):**

```bash
docker run -d --name rokkha-dev-mongo --restart unless-stopped -p 127.0.0.1:27017:27017 mongo:8.2
```

Then create `Backend/.env` (it is git-ignored, never commit it) with:

```
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=climate_shield
```

(`mongo:8.0` does not start on Linux kernel 6.19+; `8.2` does. Don't use port
27018: that is the backend developer's *test* database, which tests wipe.)

**Option 2 — the shared MongoDB Atlas database:** ask the backend developer
for access; put the connection string in `Backend/.env` the same way. Never
paste it into chat or commit it.

Start the API:

```bash
uvicorn app.main:app --reload
```

`GET http://localhost:8000/api/v1/health/database` → `{"database": "MongoDB", "status": "connected"}`
confirms the database works. If the API does not start, it is almost always
the database: check `.env`, that the Docker container runs, or (Atlas) that
your IP is allowed in Atlas → Network Access.

- API base URL: **`http://localhost:8000/api/v1`**
- Interactive docs (try every endpoint in the browser): **http://localhost:8000/docs**
- Machine-readable spec: **http://localhost:8000/openapi.json** — you can
  generate TypeScript types from it, e.g.
  `npx openapi-typescript http://localhost:8000/openapi.json -o src/api/types.ts`

**CORS:** the API accepts browser requests from `http://localhost:3000`
and `http://localhost:5173` (React/Next.js and Vite defaults). If your dev
server uses another address, tell the backend developer, or add it to
`Backend/.env` as `CORS_ORIGINS=["http://localhost:4200"]`.

---

## 2. Rules that apply everywhere

| Rule | Detail |
|---|---|
| **Coordinates are `[longitude, latitude]`** | GeoJSON order. Dhaka is `[90.40, 23.75]`. ⚠️ **Leaflet uses `[lat, lng]`** — swap when you draw markers. Mapbox GL / MapLibre / OpenLayers use `[lng, lat]` like us. |
| A point is always GeoJSON | `{"type": "Point", "coordinates": [90.3976, 23.7258]}` |
| Units | distances in **metres** (`*_meters`) and km (`*_kilometers`); areas in **km²**; money in **BDT** (taka); shares are **0–1** (0.82 = 82 %) |
| Dates/times | ISO 8601 UTC, e.g. `2026-11-09T18:13:24.294107Z` |
| `null` | means "unknown / not available", never zero |
| JSON | send `Content-Type: application/json` |

### Errors

| Status | Meaning | Body |
|---|---|---|
| `404` | thing doesn't exist | `{"detail": "Asset not found"}` |
| `422` | invalid input (bad value, outside Bangladesh, broken JSON) | either `{"detail": "readable message"}` **or** `{"detail": [{"loc": ["body","location"], "msg": "...", "type": "..."}]}` — handle both: if `detail` is a string show it; if it's a list, show each `msg` next to the field in `loc` |
| `201` | created | the new object |
| `204` | deleted | empty body |

### Data honesty — please show these in the UI

Most flood responses include **`attribution`** and **`limitations`**.

- **`attribution` must be visible** somewhere near maps/results (a small
  footer is fine). The data licenses (UNOSAT CC BY-SA, JRC, OpenStreetMap
  ODbL, HDX CC BY-IGO) require credit.
- **`limitations`** should be reachable (e.g. an "About this data" info
  icon). The most important ones for users:
  - Satellites **can't see water between buildings**, so a city-centre spot
    showing "never flooded" may still have flooded.
  - **"Observed"** (it *did* flood) and **"modelled hazard"** (it *could*
    flood) are different — never merge them into one colour or number.
  - Exposure results are **not a forecast**.

---

## 3. Endpoints by screen

### A. Asset manager (hospitals, schools, shelters…)

> Assets are stored in **MongoDB**, so they survive restarts.

| Method | Path | What it does |
|---|---|---|
| `POST` | `/assets` | create an asset |
| `GET` | `/assets?asset_type=&criticality=&district_pcode=` | list (filters optional) + totals |
| `GET` | `/assets/{id}` | one asset |
| `PATCH` | `/assets/{id}` | change only the fields you send |
| `DELETE` | `/assets/{id}` | delete (204) |
| `GET` | `/assets/near?lng=&lat=&max_distance_m=` | assets within a radius, **nearest first** (same optional filters) |
| `POST` | `/assets/within` | assets inside an area: body `{"area": <GeoJSON Polygon or MultiPolygon>}` (same optional filters as query parameters) |

**Create — request:**

```json
{
  "name": "Dhaka Medical College Hospital",
  "asset_type": "hospital",
  "location": {"type": "Point", "coordinates": [90.3976, 23.7258]},
  "criticality": "critical",
  "occupancy": 4000,
  "replacement_value_bdt": 25000000000,
  "owner": null,
  "address": null,
  "notes": null
}
```

Only `name`, `asset_type` and `location` are required.

- `asset_type` (dropdown): `hospital`, `clinic`, `school`, `flood_shelter`,
  `power_substation`, `water_treatment`, `telecom_tower`, `warehouse`,
  `factory`, `office`, `residential`, `road_bridge`, `other`
- `criticality` (dropdown): `low`, `medium` (default), `high`, `critical`
- `occupancy` = number of people (≥ 0); `replacement_value_bdt` ≥ 0
- Location **outside Bangladesh → 422** with a readable message.

**Response (201)** — the backend adds `id`, timestamps and the **district
automatically**:

```json
{
  "id": "698ba852-0274-439f-ad0b-b9e76dc5c76c",
  "name": "Dhaka Medical College Hospital",
  "asset_type": "hospital",
  "location": {"type": "Point", "coordinates": [90.3976, 23.7258]},
  "criticality": "critical",
  "occupancy": 4000,
  "replacement_value_bdt": 25000000000,
  "owner": null, "address": null, "notes": null,
  "district": {"pcode": "BD3026", "name": "Dhaka", "division": "Dhaka"},
  "created_at": "2026-11-09T18:04:03.044683Z",
  "updated_at": "2026-11-09T18:04:03.044683Z"
}
```

**List response:** `{"count", "total_occupancy", "total_replacement_value_bdt", "assets": [...]}` — good for header cards ("12 assets · 9,400 people · ৳31 bn").

**PATCH:** send only changed fields, e.g. `{"occupancy": 4500}`. Sending
`null` clears optional fields (occupancy, owner…); `null` for name, type,
location or criticality is rejected (422). Changing `location` updates the
district automatically.


**Near** (`GET /assets/near?lng=90.4106&lat=23.7058&max_distance_m=6000`) —
"what is within 6 km of here?", e.g. around a flooded spot or a river point:

```json
{
  "count": 3,
  "max_distance_meters": 6000,
  "total_occupancy": 7200,
  "total_replacement_value_bdt": 0,
  "results": [
    {"asset": { "...full asset...": "" }, "distance_meters": 0.0,    "distance_kilometers": 0.0},
    {"asset": { "...": "" },              "distance_meters": 2581.5, "distance_kilometers": 2.5815}
  ],
  "method": "MongoDB $geoNear (2dsphere) selection; distances WGS84 geodesic"
}
```

`max_distance_m` is required, > 0 and at most 200,000 (200 km). Good for a
"radius" circle on the map; results are already sorted nearest first.

**Within** (`POST /assets/within`) — "which assets are inside this area?"
(a drawn polygon, a district shape from `bangladesh_districts.geojson`, …).
Returns the same shape as the asset list (`count`, totals, `assets`). A
self-crossing polygon → 422 "geometrically invalid".
### B. Asset exposure (the main "risk" view)

| Method | Path | What it does |
|---|---|---|
| `GET` | `/assets/{id}/exposure` | exposure of one asset |
| `GET` | `/assets/exposure?asset_type=&criticality=&district_pcode=` | all (filtered) assets + summary |

**One asset — response (shortened):**

```json
{
  "asset_id": "d77c646e-...",
  "name": "Haor flood shelter",
  "district": {"pcode": "BD6090", "name": "Sunamganj", "flood_rank": 1,
               "events_observed": 6, "events_flooded": 6},
  "observed": {
    "times_observed": 7,
    "times_flooded": 7,
    "flooded_event_ids": ["2016-07-monsoon", "...", "2024-08-eastern"],
    "last_flooded_event_id": "2024-08-eastern"
  },
  "hazard": [
    {"return_period_years": 10,  "depth_class": 2, "depth_label": "1 to 3 m"},
    {"return_period_years": 100, "depth_class": 2, "depth_label": "1 to 3 m"}
  ],
  "on_permanent_water": false,
  "waterway_coverage": false,
  "nearest_waterways": [],
  "flags": {"observed_flooding": true, "modelled_hazard_10yr": true, "modelled_hazard_100yr": true},
  "attribution": ["..."],
  "limitations": ["..."]
}
```

How to show it:

- **`flags`** → three badges, e.g. 🔴 "Flooded before" / 🟠 "In 10-year flood zone" / 🟡 "In 100-year flood zone". There is deliberately **no single risk score**.
- **`observed`** → "Flood water seen here in **7 of 7** satellite checks (latest: Aug 2024)". `times_observed` = how many times satellites looked; `times_flooded` = how many of those had water. 0 of 0 = "no satellite data", not "safe".
- **`hazard`** → `depth_label` per return period; `null` = outside the modelled flood area. "10-year flood" = a flood that happens on average once every 10 years.
- **`district.flood_rank`** → "Sunamganj is the #1 most frequently flooded of 64 districts" — useful when the asset itself shows no history (town centres).
- **`nearest_waterways`** → only inside Dhaka District (`waterway_coverage: true`), e.g. `{"waterway_type": "river", "name": "Buriganga River", "distance_meters": 223.97}`. `name` can be `null` (unnamed canal). Outside Dhaka the list is empty — hide the section.

**Report summary** (`GET /assets/exposure`):

```json
"summary": {
  "total":                      {"assets": 5, "occupancy": 7090, "replacement_value_bdt": 28350000000},
  "with_observed_flooding":     {"assets": 1, "occupancy": 800,  "replacement_value_bdt": 50000000},
  "with_modelled_hazard_10yr":  {"assets": 2, "occupancy": 840,  "replacement_value_bdt": 350000000},
  "with_modelled_hazard_100yr": {"assets": 2, "occupancy": 840,  "replacement_value_bdt": 350000000}
}
```

→ dashboard cards: "**840 people** in assets inside the 10-year flood zone".

### C. Flood history map / district ranking

| Method | Path | What it does |
|---|---|---|
| `GET` | `/geospatial/flood/districts?limit=&division=` | 64 districts ranked by how often they flooded |
| `GET` | `/geospatial/flood/districts/{pcode}` | one district, event by event |
| `GET` | `/geospatial/flood/events` | the 10 flood events (name, dates, flooded km²) |
| `POST` | `/geospatial/flood/check` | flood info for any point: `{"point": {"type": "Point", "coordinates": [lng, lat]}}` |

District row: `{"rank": 1, "pcode": "BD6090", "name": "Sunamganj", "division": "Sylhet", "events_observed": 6, "events_flooded": 6, "max_flooded_share": 0.818}`

**Choropleth map:** the district shapes are in the repo at
`Backend/data/boundaries/bangladesh_districts.geojson` (64 features, ~1 MB,
`id` = `pcode`). Load that file in the frontend and colour each district by
`events_flooded` from `/geospatial/flood/districts` (join on `pcode`).

One district (`/flood/districts/BD6090`) adds `events: [{"event_id", "observed_share", "flooded_share", "status"}]` where `status` is `flooded`, `not_flooded` or `not_observed` — show `not_observed` as grey "no data", **not** as green/safe.

`/flood/check` returns `{"district": {...} | null, "cell": {...} | null}` —
both `null` when the point is outside Bangladesh. `cell` has the same
fields as the exposure `observed`/`hazard` parts (plus `permanent_water`).
Good for "click anywhere on the map".

### D. Dhaka boundaries and rivers (Dhaka District only)

| Method | Path | What it does |
|---|---|---|
| `GET` | `/geospatial/boundaries?admin_level=2\|3` | Dhaka District and its 7 units (incl. Dhaka North / South City Corporation) |
| `POST` | `/geospatial/boundaries/locate` | which of those contains a point |
| `GET` | `/geospatial/waterways?waterway_type=` | counts and km of rivers, canals, drains |
| `POST` | `/geospatial/waterways/nearest` | nearest river/canal to a point: `{"point": {...}, "waterway_types": ["river", "canal"]}` |

Shapes for drawing: `Backend/data/boundaries/dhaka_boundaries.geojson` and
`Backend/data/waterways/dhaka_waterways.geojson` (2,141 lines, ~0.9 MB).

### E. Small tools (optional)

`POST /geospatial/spatial-analysis/distance`, `.../linestring-length`,
`.../point-in-polygon`, `.../multipoint-in-zone`, `.../multipoint-distances`,
`.../point-in-zones` — see `/docs` for examples. `GET /health` → `{"status": "healthy"}`.

Also available (early versions, stored in MongoDB): manual weather observations
`POST/GET /weather/observations`, `GET /weather/observations/{record_id}`
(rainfall mm, temperature °C, humidity %), and saved named locations
`POST/GET /geospatial/locations`, `GET /geospatial/locations/{location_id}`.
Real weather data ingestion comes later.

---

## 4. Suggested first screens

1. **Map + asset list**: markers from `GET /assets`, colour by `flags` from `GET /assets/exposure`; a form for `POST /assets` (click the map to fill `location`).
2. **Asset detail**: `GET /assets/{id}/exposure` → badges, flood history timeline (`flooded_event_ids` + names/dates from `/geospatial/flood/events`), nearest river.
3. **Dashboard**: `summary` cards + district ranking table / choropleth.
4. **"Check any place"**: click the map → `POST /geospatial/flood/check`.

Test places: Dhaka Medical `[90.3976, 23.7258]`, Sunamganj haor `[91.1428, 24.8474]`
(flooded 7/7), Keraniganj `[90.3500, 23.6800]` (modelled hazard only),
Sadarghat `[90.4106, 23.7058]` (224 m from the Buriganga), Kolkata
`[88.3639, 22.5726]` (outside Bangladesh → 422 / nulls).

Questions or a field you need that isn't there? Ask the backend developer —
`/docs` always shows the current, exact shapes.
