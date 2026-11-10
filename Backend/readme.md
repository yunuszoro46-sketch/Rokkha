# Climate Shield Backend (Rokkha)

Climate Shield is a climate-risk platform under development for **Bangladesh**, built for the AI Builders Congress
Climate Shield challenge (repository: **Rokkha**). Its goal is to help protect **people and physical assets from
floods**: where flooding has happened, where it could happen, and which buildings and how many people are exposed.

This folder contains the backend: the application that receives requests, validates data, performs calculations,
stores records in MongoDB, and returns results to the frontend.

**What works today:**

- Geospatial tools: point-in-polygon, WGS84 distances, path lengths, multi-point and named-zone analysis.
- Real geographic data: Dhaka District and all 64 district boundaries, Dhaka's rivers, canals and drains.
- Nationwide **flood history**: 10 satellite-observed flood events (2016–2024) and a modelled river-flood hazard map.
- **Assets** (hospitals, schools, shelters, …) with people and value, their **flood exposure**, and map queries
  ("near this point", "inside this area").
- **Environmental-data ingestion**: historical rain (ERA5), river flow (GloFAS) and forecast rain (GFS) for 64
  district sites and 9 verified river sites, stored with full provenance and a call budget.
- Persistent storage in **MongoDB Atlas**, with geospatial indexes.
- 187 automated tests.

**What does not exist yet:** a trained flood-forecasting model, flood labels and an ML dataset, flood alerts,
scheduled (automatic) ingestion, user accounts.

> This is a development prototype, not an operational flood-warning service. Flood history and modelled hazard
> describe the past and possible floods; **nothing here is a forecast** or a flood probability.

## Contents

1. [Project goal](#1-project-goal)
2. [Current implementation](#2-current-implementation)
3. [Technology stack](#3-technology-stack)
4. [How the backend is organized](#4-how-the-backend-is-organized)
5. [Run the backend locally](#5-run-the-backend-locally)
6. [API endpoints](#6-api-endpoints)
7. [Try the API without writing code](#7-try-the-api-without-writing-code)
8. [Coordinate and validation rules](#8-coordinate-and-validation-rules)
9. [Data sources, licenses and limitations](#9-data-sources-licenses-and-limitations)
10. [Errors and troubleshooting](#10-errors-and-troubleshooting)
11. [Testing](#11-testing)
12. [Development roadmap](#12-development-roadmap)
13. [Planned machine-learning evaluation](#13-planned-machine-learning-evaluation)
14. [Working on the project](#14-working-on-the-project)

## 1. Project goal

The planned forecasting product will estimate:

> The probability that a clearly defined flood event will occur within a geographic grid cell during the next
> 24 hours.

A grid cell is a small area on a map, so risk can be shown per area instead of one value for a whole city.

What is already decided or prepared:

- **Observed flood labels:** the flood grid in `data/flood/` records, for every ~90 m cell in Bangladesh, in which
  of 10 satellite-observed events flood water was seen. These are candidate training labels (with known gaps,
  see section 9).
- **Where floods happen most:** a ranking of all 64 districts by observed flood frequency.
- **Exposure:** assets with people (`occupancy`) and value (BDT), combined with flood history and hazard.

Still open:

- Forecast grid-cell size for the model: [not yet defined; the flood data grid is ~90 m].
- Flood-event definition and thresholds for labels: [not yet defined].
- Weather and river data: **selected and ingested** (ERA5 rain, GloFAS discharge, GFS forecast rain; section 9).
- Alert thresholds: [not yet defined].

Rainfall alone will not be treated as proof of flooding. Being inside a supplied polygon does not, by itself,
establish flood risk.

## 2. Current implementation

| Capability | Current state |
| --- | --- |
| FastAPI application | Implemented; version `0.4.0` |
| MongoDB Atlas persistence | Implemented: connected at startup, indexes created automatically |
| Health endpoints (app and database) | Implemented |
| Weather observation creation and retrieval | Implemented, stored in MongoDB (manual input only) |
| Saved locations | Implemented, stored in MongoDB |
| GeoJSON Point, MultiPoint, LineString, Polygon, MultiPolygon, Feature, FeatureCollection | Validated |
| Point inside/outside/on-boundary, polygon holes, invalid-polygon rejection | Implemented |
| WGS84 geodesic distance and path (LineString) length | Implemented (GeographicLib) |
| MultiPoint in zone, distances from a reference point, point in named zones | Implemented |
| Dhaka District boundaries (district + 7 upazilas / city corporations) | Implemented (HDX) |
| All 64 district boundaries of Bangladesh | Implemented (HDX, simplified) |
| Dhaka rivers, canals, drains; nearest waterway | Implemented (OpenStreetMap) |
| Nationwide observed flood history and modelled flood hazard | Implemented (UNOSAT, JRC) |
| Asset management (create, list, update, delete, filters, totals) | Implemented, stored in MongoDB |
| Asset flood exposure (one asset and reports) | Implemented |
| Assets near a point / inside an area | Implemented (MongoDB `2dsphere` index) |
| CORS for frontend development servers | Implemented |
| Rain and river-data ingestion (ERA5, GloFAS, GFS) with provenance, resumable runs, call budget | Implemented (started manually) |
| Satellite flood observations per district and Sentinel-1 pass, 2016–2024 (flood-model labels) | Implemented (Copernicus GFM, offline build) |
| Scheduled automatic ingestion | Not implemented |
| Flood forecasting model and alerts | Not implemented |
| Authentication, authorization, rate limiting | Not implemented |

Weather observations are submitted through the API. The weather module does **not** fetch live weather.

## 3. Technology stack

### Used by the backend

| Technology | Purpose |
| --- | --- |
| Python 3.12 (tested) | Programming language |
| FastAPI | HTTP API and interactive documentation |
| Pydantic v2, pydantic-settings | Validation, response schemas, configuration from `.env` |
| Uvicorn | Local ASGI server |
| MongoDB Atlas + PyMongo (async) | Persistent storage, geospatial indexes and queries |
| Shapely | Planar geometry (containment, validity, nearest points) |
| GeographicLib | Distances on the WGS84 ellipsoid |
| NumPy | The flood grid (compressed arrays) |
| httpx | Calls to Open-Meteo (ingestion) and the test client |
| pytest | Automated tests |

Offline data-preparation scripts additionally use **Rasterio** and **pyogrio** (`requirements-dev.txt`). The API
itself does not need them.

### Planned technologies

| Technology | Planned purpose |
| --- | --- |
| XGBoost | Initial machine-learning baseline |
| GeoPandas | Geographic dataset processing, if needed |

The database is **MongoDB Atlas**. This backend does not use PostgreSQL, PostGIS, or microservices.

## 4. How the backend is organized

The backend is a **modular monolith**: one application divided into modules.

```text
Frontend or API client
        |
        v
Router: receives the HTTP request            (router.py)
        |
        v
Service: application logic and calculations  (service.py)
        |
        v
Repository: stores or reads records          (repository.py)
        |
        v
MongoDB Atlas  /  read-only data files in data/
```

Calculation-only requests (for example distance) do not use storage. Modules talk to each other through public
service functions; for example the assets module asks the geospatial module `find_district()` instead of reading
its files.

### Source structure

```text
Rokkha/
├── .gitignore
└── Backend/
    ├── app/
    │   ├── core/
    │   │   ├── config.py          settings from .env (MongoDB, CORS)
    │   │   └── database.py        MongoDB connection + index creation
    │   ├── modules/
    │   │   ├── assets/            assets, exposure, near/within queries
    │   │   ├── geospatial/        geometry tools, boundaries, waterways, flood
    │   │   ├── weather/           weather observations
    │   │   ├── ingestion/         rain and river data from Open-Meteo
    │   │   └── alerts/, prediction/   (placeholders)
    │   └── main.py                app, startup/shutdown, routers, CORS
    ├── data/
    │   ├── boundaries/            Dhaka District + 64 districts (+ README)
    │   ├── waterways/             Dhaka rivers, canals, drains (+ README)
    │   ├── flood/                 flood history, flood grid (+ README)
    │   └── ingestion/             measuring sites: 64 districts + 9 rivers (+ README)
    ├── docs/
    │   └── FRONTEND_API_GUIDE.md  guide for the frontend developer
    ├── scripts/                   rebuild the data files from their sources
    ├── tests/                     187 automated tests
    ├── ml/                        (placeholder)
    ├── pytest.ini
    ├── requirements.txt           pinned API dependencies
    ├── requirements-dev.txt       + tools for the data scripts
    └── readme.md
```

## 5. Run the backend locally

### Requirements

- Git, Python 3.12 (tested on Linux; newer versions are untested), a terminal.
- A MongoDB database: **MongoDB Atlas** (the project database) or a **local MongoDB in Docker**.
- Docker, to run the automated tests (they use their own local test database).

### Step 1: Clone and enter the backend

```bash
git clone https://github.com/yunuszoro46-sketch/Rokkha.git
cd Rokkha/Backend
```

Run every command below from `Backend/`.

### Step 2: Create and activate a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate          # Windows PowerShell: .\.venv\Scripts\Activate.ps1
```

### Step 3: Install the dependencies

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Only to rebuild the data files: `python -m pip install -r requirements-dev.txt`.

### Step 4: Create `Backend/.env`

`.env` holds your database connection. It is in `.gitignore`: **never commit it or paste it into chats.**

**Option A — MongoDB Atlas:**

```dotenv
MONGODB_URI=mongodb+srv://<db_user>:<db_password>@<your-cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DATABASE=climate_shield
```

In Atlas, add your computer under **Network Access**. If the password contains `@ : / ? # %`, URL-encode them
(`@` → `%40`, `:` → `%3A`, `/` → `%2F`, `#` → `%23`, `%` → `%25`).

**Option B — local MongoDB in Docker (no account needed):**

```bash
docker run -d --name rokkha-dev-mongo --restart unless-stopped -p 127.0.0.1:27017:27017 mongo:8.2
```

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=climate_shield
```

`mongo:8.0` does not start on Linux kernel 6.19+ (MongoDB issue SERVER-121912); `8.2` does.

Optional: `CORS_ORIGINS=["http://localhost:4200"]` if a frontend runs on another address
(defaults: `localhost:3000` and `localhost:5173`).

### Step 5: Start the server

```bash
python -m uvicorn app.main:app --reload
```

At startup the server connects to MongoDB and creates its indexes; it prints `MongoDB connected successfully!`.
If MongoDB is unreachable, the server does not start (see section 10).

### Step 6: Open the application

- Interactive Swagger UI: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/api/v1/health → `{"status": "healthy"}`
- Database: http://127.0.0.1:8000/api/v1/health/database → `{"database": "MongoDB", "status": "connected"}`
- OpenAPI schema: http://127.0.0.1:8000/openapi.json

## 6. API endpoints

All module paths start with `/api/v1`. Full request and response shapes: `/docs`, or
[docs/FRONTEND_API_GUIDE.md](docs/FRONTEND_API_GUIDE.md).

### General

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/` | Basic project information |
| GET | `/api/v1/health` | Application health |
| GET | `/api/v1/health/database` | MongoDB connection health (503 if unavailable) |

### Weather

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/weather/observations` | Create a weather observation |
| GET | `/weather/observations` | List observations (oldest first) |
| GET | `/weather/observations/{record_id}` | One observation |

### Assets

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/assets` | Create an asset (district filled in automatically; outside Bangladesh → 422) |
| GET | `/assets?asset_type=&criticality=&district_pcode=` | List with totals of people and value |
| GET | `/assets/{asset_id}` | One asset |
| PATCH | `/assets/{asset_id}` | Change only the fields sent |
| DELETE | `/assets/{asset_id}` | Delete (204) |
| GET | `/assets/near?lng=&lat=&max_distance_m=` | Assets within a radius, nearest first |
| POST | `/assets/within` | Assets inside a Polygon or MultiPolygon |
| GET | `/assets/{asset_id}/exposure` | Flood exposure of one asset |
| GET | `/assets/exposure` | Exposure report for all (filtered) assets |

### Geospatial tools

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST, GET | `/geospatial/locations`, `/geospatial/locations/{location_id}` | Saved named locations |
| POST | `/geospatial/spatial-analysis/point-in-polygon` | Point vs Polygon / MultiPolygon |
| POST | `/geospatial/spatial-analysis/distance` | WGS84 distance between two points |
| POST | `/geospatial/spatial-analysis/linestring-length` | Length of a path |
| POST | `/geospatial/spatial-analysis/multipoint-in-zone` | Which points are inside a zone |
| POST | `/geospatial/spatial-analysis/multipoint-distances` | Distances from a reference point, nearest |
| POST | `/geospatial/spatial-analysis/point-in-zones` | Which named zones (FeatureCollection) contain a point |

### Boundaries, waterways and floods

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/geospatial/boundaries?admin_level=2\|3` | Dhaka District and its 7 units |
| POST | `/geospatial/boundaries/locate` | Which Dhaka unit contains a point |
| GET | `/geospatial/waterways?waterway_type=` | Count and length of Dhaka rivers, canals, drains |
| POST | `/geospatial/waterways/nearest` | Nearest river / canal to a point (Dhaka District) |
| GET | `/geospatial/flood/events` | The 10 observed flood events (+ skipped event, method) |
| GET | `/geospatial/flood/districts?limit=&division=` | 64 districts ranked by observed flood frequency |
| GET | `/geospatial/flood/districts/{pcode}` | One district, event by event |
| GET | `/geospatial/flood/districts/{pcode}/satellite-observations?start_date=&end_date=&min_observed_share=` | Satellite flood timeline of one district (Copernicus GFM): every Sentinel-1 pass, with `flooded` true/false/null |
| POST | `/geospatial/flood/check` | Flood history and modelled hazard at any point |

### Ingestion

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/ingestion/sites?kind=district\|river` | Measuring sites (+ excluded river candidates and why) |
| POST | `/ingestion/runs` | Start a run (202; continues in the background) |
| GET | `/ingestion/runs`, `/ingestion/runs/{run_id}` | Run log: status, pieces, values written, calls spent, message |
| GET | `/ingestion/usage` | Open-Meteo calls spent this hour / today vs the budget |
| GET | `/ingestion/rain?site_id=&start_date=&end_date=` | Daily rain (ERA5) |
| GET | `/ingestion/river?site_id=&start_date=&end_date=` | Daily river discharge (GloFAS) |
| GET | `/ingestion/rain-forecast?site_id=` | Latest hourly rain forecast (GFS) |

Run kinds: `rain_history` and `river_history` (need `start_date`, `end_date`), `rain_forecast` and `river_forecast`
(`forecast_days` 1–7). Optional `site_ids` limits a run to some sites. Only one run at a time (409 otherwise).

## 7. Try the API without writing code

1. Start the backend and open http://127.0.0.1:8000/docs.
2. Expand an endpoint, click **Try it out**, paste a body, click **Execute**.

The places below are real; the asset values are examples.

### Example A: Create an asset

`POST /api/v1/assets`:

```json
{
  "name": "Dhaka Medical College Hospital",
  "asset_type": "hospital",
  "location": {"type": "Point", "coordinates": [90.3976, 23.7258]},
  "criticality": "critical",
  "occupancy": 4000,
  "replacement_value_bdt": 25000000000
}
```

The response adds `id`, `created_at`, `updated_at` and `"district": {"pcode": "BD3026", "name": "Dhaka", "division": "Dhaka"}`.

### Example B: Flood history at a place

`POST /api/v1/geospatial/flood/check` with a haor point in Sunamganj:

```json
{"point": {"type": "Point", "coordinates": [91.1428, 24.8474]}}
```

Result: Sunamganj, rank 1 of 64 districts; the ~90 m cell was observed in 7 events and flooded in all 7; the
modelled 10-year river flood depth is "1 to 3 m".

### Example C: Assets near a point

`GET /api/v1/assets/near?lng=90.4106&lat=23.7058&max_distance_m=3000` (Sadarghat) returns assets within 3 km,
nearest first, with WGS84 distances (Dhaka Medical College Hospital: 2581.5 m).

### Example E: Ingest the 2022 Sunamganj flood rain and river data

`POST /api/v1/ingestion/runs`:

```json
{"kind": "rain_history", "start_date": "2022-06-13", "end_date": "2022-06-20", "site_ids": ["district-BD6090"]}
```

Then `{"kind": "river_history", "start_date": "2022-06-10", "end_date": "2022-06-25", "site_ids": ["surma-sunamganj"]}`.
Check `GET /api/v1/ingestion/runs` until `status` is `completed`, then
`GET /api/v1/ingestion/rain?site_id=district-BD6090&start_date=2022-06-13&end_date=2022-06-20` → about 515 mm in
8 days (104 mm on 17 June), and the Surma rising from about 890 to 1,737 m³/s on 18 June.

### Example F: Sunamganj's 2022 floods seen by satellite

`GET /api/v1/geospatial/flood/districts/BD6090/satellite-observations?start_date=2022-05-01&end_date=2022-07-31`

One entry per Sentinel-1 pass that saw at least half the district. `flooded_share` rises from about 1 % to
**58.6 % on 23 May** (`flooded: true`), stays high through June (30.7 % on 18 June, the day after ERA5's 104 mm
rain) and is back near 0.5 % by 29 July (`flooded: false`). Add `min_observed_share=0.05` to also see passes that
saw only part of the district; those carry `flooded: null` (unknown, not dry).

### Example D: Check whether a point is inside an area

`POST /api/v1/geospatial/spatial-analysis/point-in-polygon`:

```json
{
  "point": {"type": "Point", "coordinates": [90.376, 23.7465]},
  "polygon": {"type": "Polygon", "coordinates": [[[90.35, 23.73], [90.4, 23.73], [90.4, 23.78], [90.35, 23.78], [90.35, 23.73]]]}
}
```

→ `{"covered": true, "strictly_inside": true, "on_boundary": false, "relationship": "inside"}`. This rectangle
is fictional: the response describes geometry only.

| Point position | `covered` | `strictly_inside` | `on_boundary` | `relationship` |
| --- | --- | --- | --- | --- |
| Inside | true | true | false | `inside` |
| On a boundary | true | false | true | `boundary` |
| Outside, or inside a hole | false | false | false | `outside` |

## 8. Coordinate and validation rules

### Coordinate order

GeoJSON uses `[longitude, latitude]`, e.g. `[90.376, 23.7465]`. Location and weather creation requests use
separate named `latitude` and `longitude` fields.

### Geometry rules

- Longitude −180 to 180, latitude −90 to 90; a Point has exactly two values.
- Polygon rings: at least four positions, closed (first = last); the first ring is the outer boundary, the rest
  are holes. Self-intersecting ("bow tie") polygons are rejected with 422.
- MultiPolygon, MultiPoint: at least one member. LineString: at least two positions.
- Feature geometry is chosen by its `"type"` (Point, MultiPoint, LineString, Polygon, MultiPolygon).

### Asset rules

`asset_type`: hospital, clinic, school, flood_shelter, power_substation, water_treatment, telecom_tower,
warehouse, factory, office, residential, road_bridge, other. `criticality`: low, medium (default), high, critical.
`occupancy` (people) and `replacement_value_bdt` must be ≥ 0. Locations outside Bangladesh are rejected.

### Weather input rules

| Field | Validation |
| --- | --- |
| `location_name` | 2–100 characters |
| `latitude` / `longitude` | −90 to 90 / −180 to 180 |
| `rainfall_mm` | Zero or greater |
| `temperature_c` | −90 to 65 |
| `humidity_percent` | 0–100 |
| `source` | Optional; defaults to `manual`; maximum 100 characters |

**Weather limitations:** `observed_at` is set by the server when the record is created (UTC); the request cannot
give the real observation time. `rainfall_mm` has no accumulation window (hourly? daily?). Both must be fixed
before these records are used as a modelling dataset.

### Why two geometry libraries (and MongoDB) measure differently

**Shapely** works on flat x/y numbers: containment, validity, nearest points. **GeographicLib** measures distances
on the WGS84 ellipsoid; every distance this API reports in metres comes from it. Shapely distances on
longitude/latitude are in degrees and are never reported as metres. For "nearest" searches, longitudes are scaled
by cos(latitude) first (verified within 0.09 m in Dhaka). **MongoDB** `$geoNear` measures on a simple sphere; it
only selects and orders assets, and the reported distance is recomputed with GeographicLib.

## 9. Data sources, licenses and limitations

Each data folder has its own README with sources, changes and limitations.

| Data | Source | License |
| --- | --- | --- |
| Dhaka District and 64 district boundaries | Bangladesh Bureau of Statistics and UN OCHA, via HDX (COD-AB v03) | CC BY-IGO |
| Dhaka rivers, canals, drains | OpenStreetMap contributors (HOT export, 2026-11-04) | ODbL |
| Observed flood water, 10 events 2016–2024 | UNOSAT (United Nations Satellite Centre) | CC BY-SA |
| Modelled river-flood hazard (10- and 100-year), permanent water | JRC GloFAS v2.1.2, © European Union | CC BY 4.0 / ODbL |
| Historical rain | ERA5 reanalysis (ECMWF, Copernicus C3S) via Open-Meteo | CC BY 4.0 (Open-Meteo) |
| River discharge (history and forecast) | GloFAS (Copernicus EMS) via Open-Meteo | CC BY 4.0 (Open-Meteo) |
| Forecast rain | GFS (NOAA NCEP) via Open-Meteo | CC BY 4.0 (Open-Meteo) |
| Satellite flood observations per Sentinel-1 pass, Apr–Nov 2016–2024 | Copernicus EMS Global Flood Monitoring (GFM) | CEMS-FLOODS licence (free, attribution; not a flood warning) |

API responses carry `attribution` and `limitations`; frontends must show the attribution.

**Main limitations:**

- Satellite radar **misses standing water in built-up areas**, so city waterlogging is largely missed.
- `not_observed` means no satellite looked at a place in that event — it does **not** mean dry.
- The JRC model **ignores flood embankments** (protected areas such as central Dhaka are overstated) and models
  river floods only, not rainfall waterlogging.
- **Seasonal wetlands** (haors, beels) are counted as flood water alongside damaging floods.
- Drains in Dhaka are very incompletely mapped; waterway distances exist only inside Dhaka District.
- Flood results describe a ~90 m grid cell, not an exact spot.
- GFM satellite passes come every few days and usually see only part of a district; **8 districts** (hill
  districts, Sundarbans, Gazipur) are never seen well enough to be labelled. See `data/labels/README.md`.

### Ingestion: what is stored, and the call budget

Every value records its site, real date or valid time, unit, accumulation window (`24 h total, 00:00-24:00 UTC`,
`daily mean discharge`, or `1 h, the hour ending at valid_time`), source, the data-grid point it came from
(`grid_location`), fetch time and run id. Re-running replaces values instead of duplicating them; values the
source does not have are stored with `missing: true`. ERA5 arrives about 5 days late, so `rain_history` cannot end
in the last 6 days.

Open-Meteo's free tier allows < 5,000 calls per hour and < 10,000 per day for non-commercial use (it blocks IPs
that exceed it), and one call covers at most 14 days for one location. A run therefore checks
`INGESTION_MAX_CALLS_PER_HOUR` (4,000) and `INGESTION_MAX_CALLS_PER_DAY` (8,000) before every request and **pauses**
(`status: paused_budget`) instead of exceeding them. **Start the same run again later: pieces already stored are
skipped**, so it resumes where it stopped.

A full backfill of all 64 district sites for 2016–2024 needs about 64 × 9 × 26 ≈ 15,000 calls: plan it over two
days (about four re-runs). River history for the 9 river sites for 2016–2024 needs about 2,100 calls.

## 10. Errors and troubleshooting

### HTTP errors

| Status | Meaning |
| --- | --- |
| `404` | The requested record (asset, location, observation, district) was not found |
| `422` | Invalid input, invalid polygon, broken JSON, or an asset outside Bangladesh |
| `503` | `/api/v1/health/database`: MongoDB unavailable |

### The server does not start

Almost always the database. Check `Backend/.env` exists and `MONGODB_URI` is correct; with Atlas, that your IP is
allowed in **Network Access** and the password is URL-encoded; with Docker, that the container runs
(`docker ps`). Run the server from `Backend/`, because `.env` is read from the working directory.

### `ModuleNotFoundError`

Activate the virtual environment, run `python -m pip install -r requirements.txt`, and run from `Backend/`.

### Frontend requests blocked by CORS

Allowed by default: `http://localhost:3000` and `http://localhost:5173`. Add other addresses to `CORS_ORIGINS` in
`.env`.

## 11. Testing

```bash
python -m pytest -v
```

Expected: **214 passed**.

Tests that store data use a **separate local test MongoDB in Docker**, never Atlas:

```bash
docker run -d --name rokkha-test-mongo --restart unless-stopped -p 127.0.0.1:27018:27017 mongo:8.2
```

`tests/conftest.py` forces the tests onto `mongodb://127.0.0.1:27018` (database `climate_shield_test`), refuses to
run against any Atlas address, starts the container if it is stopped, and empties the collections before each
test. Use another test server with `TEST_MONGODB_URI=mongodb://host:port`.

| Test file | Covers |
| --- | --- |
| `test_api_geospatial.py` | Geometry tools, locations, health, CORS |
| `test_api_boundaries.py` | Dhaka boundaries |
| `test_api_waterways.py` | Rivers, canals, nearest waterway |
| `test_api_flood.py` | Flood history, flood grid, district ranking |
| `test_api_assets.py` | Asset create / list / update / delete |
| `test_api_asset_exposure.py` | Asset flood exposure |
| `test_api_assets_mongodb.py` | MongoDB storage, indexes, near / within |
| `test_api_weather_and_locations.py` | Weather and locations in MongoDB |
| `test_api_ingestion.py` | Ingestion: sites, runs, resuming, budget, errors, recorded real Open-Meteo responses |
| `test_api_satellite_observations.py` | GFM flood observations: data file, label rule, Sunamganj 2022, endpoint |
| `test_gfm_label_counting.py` | GFM counting rules on small hand-made rasters (skipped without rasterio) |

`tests/test_geospatial.py` is an older print-only Shapely demonstration, kept for reference.

## 12. Development roadmap

Planned items are not claims of completed functionality.

| Step | Status |
| --- | --- |
| Reproducible setup: requirements, `.gitignore`, automated tests | Done |
| LineString, MultiPoint, GeoJSON Feature/FeatureCollection support | Done |
| Dhaka and national boundaries; Dhaka rivers and drains | Done |
| Observed flood history and modelled flood hazard (nationwide) | Done |
| Asset management and flood exposure analysis | Done |
| MongoDB persistence, geospatial indexes and queries | Done |
| Environmental-data ingestion (ERA5 rain, GloFAS river flow, GFS forecast) with real times, units and provenance | Done (backfill 2016–2024 to be run) |
| Scheduled automatic ingestion | Planned (Celery/Redis only if justified) |
| Flood labels: satellite flood observations per district (Copernicus GFM) and label rule | Done |
| ML dataset (rain and river backfill 2016–2024; time- and place-based splits) | Next |
| XGBoost baseline; evaluation and probability calibration | Planned |
| Prediction API, alert generation, end-to-end tests | Planned |
| Authentication and rate limiting before any public use | Planned |

## 13. Planned machine-learning evaluation

There is no trained model or measured forecasting performance yet.

Planned evaluation: precision, recall, F1, PR-AUC, Brier score, calibration, and false-alarm and missed-event
measures with their definitions stated explicitly.

Training and evaluation must use only information available at the forecast issue time. Time-based and
geographic separation must prevent leakage. A predicted flood probability is not the same as model confidence,
rainfall alone is not flood prediction, and a rule-based score must never be presented as an ML prediction.

## 14. Working on the project

Backend and frontend are separated into `Backend/` and `Frontend/`, integrated through versioned REST APIs. The
frontend developer's guide is [docs/FRONTEND_API_GUIDE.md](docs/FRONTEND_API_GUIDE.md).

When contributing:

- Keep HTTP handling in routers, logic in services, storage access in repositories, contracts in schemas.
- Preserve GeoJSON `[longitude, latitude]` order.
- Never invent geographic or hazard data and present it as real; document sources, licenses and limitations.
- Keep "observed" (did flood) and "modelled hazard" (could flood) separate.
- Add automated tests for changed behaviour; run `python -m pytest` before committing.
- Never commit `.env` or secrets.
- Update this README when behaviour changes.

The backend has no authentication, authorization or rate limiting. Keep it in a controlled development environment
until those safeguards exist.

**Climate Shield (Rokkha) — building toward reliable flood-risk intelligence for Bangladesh.**
