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
13. [The flood model: design and measured results](#13-the-flood-model-design-and-measured-results)
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
| FastAPI application | Implemented; version `0.5.0` |
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
| Satellite flood observations per district and Sentinel-1 pass, April 2016 to now (flood-model labels and live inputs) | Implemented (Copernicus GFM; refreshed by the daily update) |
| Model inputs (features) with a no-future-data rule; training table | Implemented (21,165 rows, 2016–2024, in `data/ml/`) |
| Flood prediction API (`/predictions`) and alerts with assets at risk (`/alerts`) | Implemented; uses the trained model in `data/models/` |
| Training and evaluation script (baselines, calibration, alert thresholds, report) | Implemented |
| Recent rain for the days ERA5 lacks (`rain_recent`, GFS) | Implemented |
| Daily update script (refresh data, predict today, list alerts) | Implemented; runs every morning on GitHub Actions once the `MONGODB_URI` repository secret is set (`.github/workflows/daily-update.yml`) |
| Trained flood model with measured results | Implemented: better than the baselines on 2023–2024 and again on 2025; weak on new floods (see [section 13](#13-the-flood-model-design-and-measured-results)) |
| User accounts: register, log in, save a home location, flood report for it (`/auth`) | Implemented (passwords hashed with scrypt; login slowed after 5 wrong passwords) |
| Read-only mode for a public server (`PUBLIC_READ_ONLY`) and a Render deploy file (`render.yaml`) | Implemented; the service itself must be created in the Render dashboard |
| Roles: user, rescuer, admin (`scripts/set_role.py` makes the first admin; admins change roles through `/admin`) | Implemented |
| Rescue requests (SOS): sent without a login, followed by the sender, handled by rescuers (`/sos`) | Implemented |
| Hospitals, clinics and shelters from OpenStreetMap as assets (3,162 places) | Implemented (`data/assets/`, `scripts/import_osm_facilities.py`) |
| General rate limiting, password reset, email check | Not implemented |

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
| XGBoost (`xgboost-cpu`) | Loads the trained flood model and computes predictions |
| pytest | Automated tests |

Offline scripts additionally use **Rasterio** and **pyogrio** (data preparation) and **scikit-learn** (model
evaluation and probability calibration during training), all in `requirements-dev.txt`. The API itself does not
need them.

### Planned technologies

| Technology | Planned purpose |
| --- | --- |
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
    │   │   ├── prediction/        model inputs, training table, flood predictions
    │   │   ├── alerts/            alerts from predictions + assets at risk
    │   │   ├── accounts/          user accounts, roles, login, home location, report for it
    │   │   └── rescue/            rescue requests (SOS) and their handling
    │   └── main.py                app, startup/shutdown, routers, CORS
    ├── data/
    │   ├── boundaries/            Dhaka District + 64 districts (+ README)
    │   ├── waterways/             Dhaka rivers, canals, drains (+ README)
    │   ├── flood/                 flood history, flood grid (+ README)
    │   ├── ingestion/             measuring sites: 64 districts + 9 rivers (+ README)
    │   ├── labels/                satellite flood observations = model labels (+ README)
    │   ├── ml/                    fixed district inputs, training table (+ README)
    │   └── models/                the trained model, its description and test report
    ├── docs/
    │   └── FRONTEND_API_GUIDE.md  guide for the frontend developer
    ├── scripts/                   rebuild the data files from their sources
    ├── tests/                     442 automated tests
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

### Hosting on Render

**Hosted since 13 November 2026 at `https://rokkha-backend.onrender.com`** (API under `/api/v1`, interactive
docs at `/docs`). The steps below are how it was set up, for anyone who has to repeat it.
The portal (frontend) is hosted on Vercel at **`https://rokkha-app.vercel.app`**, built from the `production` branch.
Since 17 Nov 2026 every push to `production` that changes `Frontend/` is deployed automatically by the GitHub Action
`.github/workflows/deploy-frontend.yml` (about one minute). The older address `rokkha-portal.vercel.app` no longer exists.
Login and location were checked end to end on 17 Nov 2026. The backend's register, login and location endpoints
worked; the faults were in the portal (no visible login state, GPS snapped to the district centre, invented
numbers on the location card) and were fixed on the `production` branch.

The file `render.yaml` in the repository root describes the hosted backend, so nothing has to be typed into
Render except the database secret.

1. On [render.com](https://render.com) choose **New > Blueprint** and pick this GitHub repository.
2. Render reads `render.yaml` and asks for one value: **`MONGODB_URI`**. Paste the Atlas connection string there
   (the same one as in `Backend/.env`). It is stored by Render as a secret and never enters the repository.
3. In MongoDB Atlas, under **Network Access**, allow the hosted server to connect. Render's free plan has no
   fixed address list that is easy to maintain, so the simple choice is "allow access from anywhere"
   (`0.0.0.0/0`); the database is then protected by its user name and password only, so that password must be
   long and random.
4. When the deploy is green, open `https://<service-name>.onrender.com/api/v1/health`. It must answer
   `{"status": "healthy"}`. If the deploy fails with a MongoDB timeout, step 3 is missing.
5. In Vercel, set the frontend's `NEXT_PUBLIC_API_URL` to `https://<service-name>.onrender.com/api/v1` and
   redeploy the frontend.

What the hosted copy is set to do (all in `render.yaml`):

| Setting | Value | Why |
| --- | --- | --- |
| `PUBLIC_READ_ONLY` | `true` | Anyone on the internet can reach this server. In this mode ingestion runs, new predictions, weather records and saved locations are refused with **403**, and changing assets needs an admin login. Reading, the point checks, user accounts and rescue requests work normally |
| `CORS_ORIGINS` | the Vercel address and localhost | Only these websites may call the API from a browser. Add the address here if the frontend moves |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` | One process, no `--reload` |
| Region | Singapore | Closest to Bangladesh |

Every answer also carries standard browser protections, set in `app/main.py`: `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'` (no showing the API inside another
site), `Referrer-Policy: no-referrer` and `Strict-Transport-Security` (HTTPS only). The portal sets the same in
`Frontend/next.config.mjs`.

Limits to know:

- **Memory.** The free plan gives 512 MB. Measured on 13 November 2026, the backend uses about 165 MB after
  start and about 400 MB once the flood grid is loaded (first point check), with a peak of 426 MB. That fits,
  but with little room: many logins at the same moment could push it over, and Render would restart it.
- **Sleep.** A free service sleeps after 15 minutes without requests; the next request then takes about a
  minute. Open the site a few minutes before a demo.
- **New data still comes from a developer's machine.** The daily update (ingestion and predictions) is run
  locally against the same Atlas database, so new predictions appear on the hosted server by themselves. New
  satellite passes are a file in the repository: they reach the hosted server when that file is committed.

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
| GET | `/geospatial/flood/satellite-observations/latest?date=&max_age_days=` | For a map: the newest satellite pass of every district on or before a day (default today, at most 30 days old), in one call |
| POST | `/geospatial/flood/check` | Flood history and modelled hazard at any point |

### Ingestion

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/ingestion/sites?kind=district\|river` | Measuring sites (+ excluded river candidates and why) |
| POST | `/ingestion/runs` | Start a run (202; continues in the background) |
| GET | `/ingestion/runs`, `/ingestion/runs/{run_id}` | Run log: status, pieces, values written, calls spent, message |
| GET | `/ingestion/usage` | Open-Meteo calls spent this hour / today vs the budget |
| GET | `/ingestion/rain?site_id=&start_date=&end_date=` | Daily rain (ERA5) |
| GET | `/ingestion/rain-recent?site_id=&start_date=&end_date=` | Daily rain of the last days (GFS), kept apart from ERA5 |
| GET | `/ingestion/river?site_id=&start_date=&end_date=` | Daily river discharge (GloFAS) |
| GET | `/ingestion/rain-forecast?site_id=` | Latest hourly rain forecast (GFS) |
| GET | `/ingestion/rain-forecast/summary?hours=72` | Every district's forecast rain total for the next 6–168 hours after its latest fetch, with `hours_covered` and the valid window (map layer) |

Run kinds: `rain_history` and `river_history` (need `start_date`, `end_date`), `rain_forecast` and `river_forecast`
(`forecast_days` 1–7), and `rain_recent` (`past_days` 1–30: the last finished days from GFS). Optional `site_ids` limits a run to some sites. Only one run at a time (409 otherwise).

### Flood prediction and alerts

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/predictions/model` | Is a trained model loaded? Its description, test results and alert thresholds |
| POST | `/predictions` | Predict all districts for `{"target_date": "YYYY-MM-DD"}` from stored data and store the result |
| GET | `/predictions?target_date=` | The stored predictions for a day |
| GET | `/alerts?target_date=&min_level=watch\|alert` | Districts over the alert thresholds, with the registered assets in each |

Each prediction lists the inputs it used (`features`) and `recent_rain_days`: how many of the 30 rain days came
from the GFS recent-days source because ERA5 had not delivered them yet (0 for past dates, about 5 for today).

A trained model is delivered in `data/models/`. **If those files are missing** `GET /predictions/model` says
`not_trained`, `POST /predictions` answers **503**, and there are no alerts. The backend never returns invented
predictions. Alert messages state at most "more than 95%", because the model's highest probabilities are too
confident (section 13).

### User accounts and the report for the user's location

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | Create an account from `{"name", "email", "password"}` (password at least 8 characters). Returns a login token |
| POST | `/auth/login` | Log in with `{"email", "password"}`. Returns a login token valid for 30 days |
| POST | `/auth/logout` | End this login |
| GET | `/auth/me` | The logged-in user |
| DELETE | `/auth/me` | Delete the account, its saved location and all its logins |
| PUT | `/auth/me/location` | Save the user's place: `{"location": <GeoJSON Point>, "label": "Home"}`. Must be inside Bangladesh |
| DELETE | `/auth/me/location` | Remove the saved place |
| GET | `/auth/me/report?target_date=` | Flood report for the saved place (default day: today, UTC) |

Every route except register and login needs the header `Authorization: Bearer <token>`; without a valid token
the answer is **401**.

The report combines what the backend already knows for that point: the district, the stored forecast for the
district on that day (`forecast_status` is `available` or `no_forecast_for_this_day`; another day's forecast is
never used in its place), the observed flood history and modelled hazard of the ~90 m cell under the point, and
the registered assets within 25 km, nearest first.

How the login is protected:

- **Passwords are never stored.** Only a scrypt hash is (slow and memory-hungry on purpose, with a random salt
  per user; Python standard library, no extra dependency).
- **Login tokens are random (256 bits) and only their SHA-256 hash is stored**, so a leaked database gives no
  working logins. MongoDB deletes expired logins by itself.
- **Wrong email and wrong password give the same 401 answer**, and take the same time.
- **After 5 wrong passwords for one email within 15 minutes** further logins for it answer **429** until the
  15 minutes have passed.
- **A user can only read their own profile, location and report.**

Not covered yet: no email is sent (no address check, no password reset); no general rate limiting.

### Roles and admin

Every account has a role: `user` (default), `rescuer` or `admin`. A new account is always a `user`, whatever
the request says.

| Method | Endpoint | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/admin/users?limit=` | admin | All accounts (no password data) |
| PATCH | `/admin/users/{user_id}/role` | admin | Set `{"role": "user" \| "rescuer" \| "admin"}`. An admin cannot change their own role |

The first admin is made on a developer's machine, straight in the database:
`python scripts/set_role.py someone@example.org admin` (the person registers first).

**Admin Control Centre** (`app/modules/admin`, guide section J2): permission-checked overview, analytics, data
sources, ingestion runs, system health, account suspension, administrative announcements (never official warnings)
and an append-only audit log (`admin_audit`). The admin area reads the science; it has no route that changes a
prediction, an observation or the model.

**Local test accounts for the portal's browser tests** (rescue board, two teams):
`scripts/seed_local_test_accounts.py` creates one admin and two rescuers in "Local Test Team A" and "Local Test Team B"
through the normal API (passwords hashed as for real users). It refuses to run unless the database and the API are both
on this computer, reads every email and password from the environment (`E2E_ADMIN_*`, `E2E_RESCUER_*`, `E2E_RESCUER2_*`,
kept in the git-ignored `Frontend/.env.e2e.local`) and changes nothing when run again. Usage is in the script's header.

On the public server (`PUBLIC_READ_ONLY=true`) creating, changing and deleting **assets** needs an admin
login; ingestion runs, new predictions, weather records and saved locations stay switched off there.

### Rescue requests and the shared rescue board

Since 18 November 2026. Full rules: [docs/RESCUE_COORDINATION_SPEC.md](docs/RESCUE_COORDINATION_SPEC.md); why it
is built this way: [docs/decisions/ADR-001-shared-rescue-board.md](docs/decisions/ADR-001-shared-rescue-board.md).

| Method | Endpoint | Who | Purpose |
| --- | --- | --- | --- |
| POST | `/sos` | anyone | Send a request: `client_id`, `needs`, `people`, `serious_injury`, `vulnerable`, a GPS `location` **or** a typed `place`, optional `note`, `contact_name`, `contact_phone`. 201 with a receipt and a `reference` (`RK-XXXXXX`); the same `client_id` again gives 200 and stores nothing new |
| GET | `/sos/status/{client_id}` | the sender | Status, history (with team names) and the team's message |
| POST | `/sos/status/{client_id}/cancel` | the sender | "I no longer need help" |
| GET | `/sos/mine` | logged-in user | Requests sent while logged in |
| GET | `/sos?status=&district_pcode=&mine=&limit=` | rescuer, admin | The shared board: open requests (or one status), untaken first |
| POST | `/sos/{id}/accept` | a rescuer in a team | Become the primary team; 409 if another team was first |
| POST | `/sos/{id}/progress` | the primary team | `en_route`, `arrived`, `in_progress`, `completed` (with `outcome`) |
| POST | `/sos/{id}/release` | the primary team, admin | Back to the board with a reason (`unable_to_reach`, `lacks_resources`, `other`) |
| POST | `/sos/{id}/support-request`, `/sos/{id}/support` | primary team / another team | Ask for and join as a support team |
| POST | `/sos/{id}/close` | admin | Close a duplicate or false request |
| GET, POST | `/admin/teams` | admin | List and create rescue teams (name + organisation) |
| PATCH | `/admin/users/{user_id}/team` | admin | Put an account in a team (`{"team_id": ...}` or `null`) |

How it is built:

- **No login is needed to ask for help.** The phone makes a random `client_id` when the request is first
  saved and sends it unchanged on every retry. That makes retries safe (a phone with a bad connection may send
  the same request several times) and it is also the sender's private key for reading the status. Only its
  SHA-256 hash is stored. Requests queued by the previous portal (one `need`, no `location_source`) are still
  accepted; their location source stays unknown instead of being guessed.
- **A request without GPS is allowed.** The person chooses the district and describes the place (village, area,
  landmark...). No coordinates are made up from a place name; `location` stays `null`.
- **One primary team per request.** Teams (`rescue_teams`: name, organisation) are created by an admin, who also
  puts each rescuer account into a team. Accepting is one atomic MongoDB update whose filter requires the
  status `available`: when two teams press at the same moment exactly one wins, the other gets 409 (tested with
  8 parallel accepts). Every later step also requires the expected status and the primary team in the filter.
- **Statuses:** `available` → `accepted` → `en_route` → `arrived` → (`in_progress` →) `completed`; or
  `cancelled` (by the sender, or closed by an admin). Steps cannot be skipped, so "on its way" always means the
  team confirmed it. "Unable to reach" and "released" are reasons recorded in the history: the request goes back
  to `available` at once instead of waiting on a team that gave up. An admin can release a stuck request.
- **Support:** the primary team can ask for support; another team can join as support without taking over.
- **Privacy:** the sender's view holds no personal details (only team names). On the board every rescuer sees
  what is needed to judge the request (needs, people, injury, place, location); **contact name and phone only go
  to the primary team, support teams and admins.** The acting account is stored in the history but never sent
  to the sender.
- **Flood protection:** at most 10 new requests per internet address per hour (the address is stored hashed
  and deleted after an hour). Retries are not counted. The address is the one Cloudflare (in front of Render)
  reports in `CF-Connecting-IP`; `X-Forwarded-For` is ignored because Render keeps whatever the visitor writes
  there, and a live test on 15 November 2026 showed that faking it skipped the limit (fixed the same day).
- A GPS point must be inside Bangladesh; the district is filled in from it.
- **Readable place names** (`GET /geospatial/place-name`, and `area_name` on board items): the upazila and
  district containing a GPS point, looked up on this server from `data/boundaries/bangladesh_upazilas.geojson`
  (507 upazilas, HDX COD-AB v03 — the same BBS / OCHA release as the districts, CC BY-IGO; the answer includes
  `upazila_pcode`). No outside geocoding service is used. `scripts/build_map_geography.py` rebuilds this file and
  the portal's map geography from one archive.

Not covered: requests are kept until someone deletes them (no retention period is set), there is no SMS or
push notification to teams (they must look at the board), and nothing verifies that a request is genuine.

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
| Hospitals, clinics and flood/cyclone shelters (3,162 assets) | OpenStreetMap contributors (HOT exports on HDX, snapshot 2026-11-04); not checked on the ground, see `data/assets/README.md` | ODbL |
| Observed flood water, 10 events 2016–2024 | UNOSAT (United Nations Satellite Centre) | CC BY-SA |
| Modelled river-flood hazard (10- and 100-year), permanent water | JRC GloFAS v2.1.2, © European Union | CC BY 4.0 / ODbL |
| Historical rain | ERA5 reanalysis (ECMWF, Copernicus C3S) via Open-Meteo | CC BY 4.0 (Open-Meteo) |
| River discharge (history and forecast) | GloFAS (Copernicus EMS) via Open-Meteo | CC BY 4.0 (Open-Meteo) |
| Forecast rain | GFS (NOAA NCEP) via Open-Meteo | CC BY 4.0 (Open-Meteo) |
| Satellite flood observations per Sentinel-1 pass, Apr–Nov 2016–2026 | Copernicus EMS Global Flood Monitoring (GFM) | CEMS-FLOODS licence (free, attribution; not a flood warning) |

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

Every request is tried **3 times** (waiting 5, 10, 20 s) when Open-Meteo is busy (HTTP 429 / 5xx) **or the
connection fails** (timeout, network down). If it still fails, the run ends as `failed` with a message naming the
cause. Data already stored is kept, so start the same run again later.

If the server stops or restarts during a run, that run is closed as `failed` at the next start (message:
"interrupted"), so it never blocks later runs. Start the same run again to continue.

**Recent rain.** ERA5 is the rain the model learns from, but it is about 5 days late. `rain_recent` stores the
last days from GFS in a separate collection (`rain_recent_daily`). Predictions use ERA5 wherever it exists and
fill only the missing days from GFS. GFS and ERA5 are different products, so those days are less exact.

The 2016–2024 backfill is done: March–November rain for all 64 district sites (1,257 calls per year, 17,600
values per year, spread over two days to stay inside the budget) and river flow for the 9 river sites (about
2,100 calls).

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

Expected: **442 passed**.

Tests that store data use a **separate local test MongoDB in Docker**, never Atlas:

```bash
docker run -d --name rokkha-test-mongo --restart unless-stopped -p 127.0.0.1:27018:27017 mongo:8.2
```

`tests/conftest.py` forces the tests onto `mongodb://127.0.0.1:27018` (database `climate_shield_test`), refuses to
run against any Atlas address, starts the container if it is stopped, and empties the collections before each
test. Use another test server with `TEST_MONGODB_URI=mongodb://host:port`.

| Test file | Covers |
| --- | --- |
| `test_api_accounts.py` | Register, log in and out, wrong passwords, home location, report for it, account deletion |
| `test_public_read_only.py` | Read-only mode: changes refused, reading, point checks and accounts still work; browser security headers on every answer |
| `test_api_rescue.py` | Rescue requests (send, retry, follow, cancel), the flood limit (a faked `X-Forwarded-For` does not skip it), roles and admin routes |
| `test_api_rescue_board.py` | The shared rescue board: requests without GPS, several needs, teams, one primary team (8 parallel accepts, exactly one wins), explicit progress, release, support, contact privacy, the sender's status |
| `test_osm_facilities.py` | OpenStreetMap facility selection and the built facility file |
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
| `test_prediction_features.py` | Model inputs, the no-future-data rule, training table rows and time split |
| `test_api_prediction.py` | Prediction and alert API with a test-only model: no model (503), inputs shown, stored, alert levels, assets at risk, recent-rain fallback |
| `test_train_flood_model.py` | Training script: measures, baselines, thresholds, calibration; whole pipeline on a made-up table; the API accepts its files (skipped without scikit-learn) |
| `test_daily_update.py` | Daily chain: refresh data → predict today → alerts → river and rain forecasts; no model; failing data source; a failing forecast does not undo the predictions |

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
| Environmental-data ingestion (ERA5 rain, GloFAS river flow, GFS forecast) with real times, units and provenance | Done |
| Scheduled automatic ingestion | Planned (Celery/Redis only if justified) |
| Flood labels: satellite flood observations per district (Copernicus GFM) and label rule | Done |
| Model inputs, training table, time split | Done |
| Rain and river backfill 2016–2024 | Done |
| Prediction API and alerts with assets at risk | Done |
| Training and evaluation script; recent rain; daily update script | Done |
| Train the real model and publish its measured results | Done (section 13) |
| Improve the model on new floods | Tried once (neighbour inputs): no gain, not adopted. Open: upstream and cross-border rain and river data |
| New satellite passes for live use (fetched by the daily update) | Done |
| Check the model on 2025, a year never used so far | Done (section 13) |
| Check on 2026 (kept untouched for the next model change) | Data stored 12 Nov 2026 (rain 1 Mar–5 Nov, river 15 Feb–10 Nov, satellite passes); **not measured yet on purpose** |
| User accounts and login, with a flood report for the user's saved location | Done (`/auth`) |
| Roles (admin, rescue), protecting asset and ingestion endpoints | Done (`/admin`, `/sos`; read-only guard on the hosted server) |
| General rate limiting for all endpoints | Planned, before wide public use |

## 13. The flood model: design and measured results

A model is trained (`xgb-2026-11-11-60d30b1a`, 11 November 2026). The full report, written by the training
script, is [data/models/README.md](data/models/README.md). The main numbers, measured **once** on 2023–2024
(4,783 district-days with 109 observed floods; years the model never saw):

| | PR-AUC | Floods caught | Floods missed | False alarms |
| --- | --- | --- | --- | --- |
| **Model**, `watch` level (probability ≥ 0.18) | 0.460 | 68 of 109 | 41 | 127 |
| **Model**, `alert` level (probability ≥ 0.375) | 0.460 | 46 of 109 | 63 | 31 |
| Baseline: same as the latest satellite pass | 0.420 | 51 of 109 | 58 | 58 |
| Baseline: usual flood rate of the district and month | 0.170 | 26 of 109 | 83 | 98 |
| Model without the satellite inputs (rain and river only) | 0.249 | | | |

PR-AUC measures how well flood days are ranked above other days (1 = perfect; random ≈ 0.023, the flood rate).

What these numbers say, including the weak points:

- The model is **better than both baselines, by a modest margin** over "same as the latest satellite pass"
  (0.460 against 0.420). Most of its skill comes from the latest satellite passes: a flood that is already
  visible usually continues.
- **New floods are hard.** On days where the latest pass saw no flood (58 floods), the `watch` level caught 18
  and missed 40. The persistence baseline catches none of these, but 18 of 58 is still low.
- The `watch` level was chosen to catch 80 % of floods in 2022; on the test years it caught **62 %**.
- **High probabilities are too confident.** Days given 80–100 % flooded 81 % of the time; days given 60–80 %
  flooded 62 % of the time. Alert messages therefore never state more than "more than 95%".
- **Places differ.** With a whole division held out of training, the score ranges from 0.72 (Sylhet) to about
  0.10–0.12 (Rajshahi, Barishal); Khulna and Rangpur had too few floods to score.
- **Live use can be weaker than the test.** Today's prediction uses the newest satellite passes (the daily
  update fetches them), but a district is passed only every few days, and the last 5 days of rain come from GFS
  instead of ERA5. If the satellite archive cannot be reached, the model works from older passes or from rain
  and river only (compare the 0.249 row).
- **Newer satellite passes come from newer GFM versions.** The model learned from GFM v3.1.0 maps; passes of
  2025–2026 are v4.x. Whether that changes the flooded shares has not been measured yet.

### Second check: 2025, a year never used for anything

After training, the delivered model was measured, unchanged, on 2025 (2,485 district-days, 83 observed floods)
with `python scripts/check_flood_model.py --first-year 2025 --last-year 2025`. Full report:
[data/models/CHECK_2025.md](data/models/CHECK_2025.md).

| 2025 | PR-AUC | Floods caught | Floods missed | False alarms |
| --- | --- | --- | --- | --- |
| **Model**, `watch` level | 0.569 | 54 of 83 | 29 | 68 |
| **Model**, `alert` level | 0.569 | 38 of 83 | 45 | 13 |
| Baseline: same as the latest satellite pass | 0.499 | 45 of 83 | 38 | 38 |
| Baseline: usual flood rate of the district and month | 0.213 | 16 of 83 | 67 | 41 |

- The model beat both baselines again, in a second, independent period. At the `alert` level 3 of 4 flagged
  days really flooded.
- **New floods stayed hard:** of 38 floods not already visible at the latest pass, the `watch` level caught 10.
- 2025 was a year with more floods than 2023–2024; scores differ from year to year, so neither number is "the"
  accuracy.

### An improvement that was tried and not kept

To catch more new floods, extra inputs were tried: rain and satellite-observed flooding in the 5 nearest
districts, the change between the last two passes, more rain windows, and the flow of all 9 river sites. They
were compared by leaving out one year at a time within 2016–2022 only. The best set (neighbour rain and
flooding) gained about 0.01 PR-AUC and was better in only 4 of 7 years. Trained the same way as the delivered
model and measured on 2025, it scored **0.496 against 0.569** for the delivered model, so it was **not adopted**.
The likely reason new floods are hard: they are driven by rain and river flow upstream, much of it outside
Bangladesh, which these inputs do not cover.

The design, fixed and tested before training:

| Part | Design |
| --- | --- |
| What is predicted | For a district and a day: the probability that a Sentinel-1 pass would observe flooding (Copernicus GFM, unusual water on ≥ 10 % of the visible land) |
| Issue time | 00:00 UTC of the target day, with data **through the day before** |
| Labels | `data/labels/district_flood_observations.json`: 632 flood and about 20,500 no-flood passes, 56 districts |
| Inputs | Rain totals over 1, 3, 7, 14, 30 days (ERA5); river flow level and change at the nearest river site (GloFAS); modelled hazard share (JRC); the latest satellite pass within 30 days; month |
| No leakage | One function (`app/modules/prediction/features.py`) builds the inputs for training **and** for live prediction and ignores every value dated on or after the target day (tested) |
| Split by time | Train 2016–2021, validation 2022, **test 2023–2024**, whole years |
| Split by place | A second check holding out one whole division at a time |
| Baselines | "Same as the latest satellite pass" and "usual flood rate of this district and month" |
| Measures | Precision, recall, F1, PR-AUC, Brier score, calibration, false alarms and missed floods, each with its definition |
| Not predictable | 8 districts the satellites cannot observe (`status: unsupported`) |

Rebuild the training table: `python scripts/build_training_table.py`
(reads the database named in `.env`, writes `data/ml/training_table.csv`; see `data/ml/README.md`).

Train and evaluate: `python scripts/train_flood_model.py` (needs `requirements-dev.txt`). It tries a small set of
XGBoost settings, keeps the best on 2022, calibrates the probabilities on 2022, chooses the thresholds on 2022
(`alert`: best balance of caught floods and false alarms; `watch`: catches at least 80 % of observed floods), and
only then measures everything once on 2023–2024, next to the two baselines, the onset days (where the latest
satellite pass saw no flood), a model without satellite inputs, and held-out divisions. The report is written to
`data/models/README.md`.

**Daily use.** With the backend running: `python scripts/daily_update.py` refreshes river flow, ERA5 rain and
recent rain, fetches the newest satellite passes (Copernicus GFM, this month and the last), predicts today and
prints the alerts. Then, for the map, it stores the **GloFAS river-flow forecast** (today + 6 days, 9 river sites)
and the **GFS hourly rain forecast** (4 days from 00:00 UTC, so the 72 hours after a morning run are covered, 64
district sites). These two forecast steps run after the predictions and are best effort: if one fails the update
still succeeds and says "NOT refreshed". Rain-forecast fetches older than 3 days are deleted after each new fetch,
so the collection stays small. In total about 310 Open-Meteo calls a day (free limit 10,000). To run it every
morning, add the cron line shown at the top of the script.

**Running it automatically.** `.github/workflows/daily-update.yml` runs the same script every day at 03:30 UTC
(09:30 in Bangladesh) on a GitHub machine: it starts a copy of the backend there, runs the update, and the
results (rain, river flow, today's predictions) land in MongoDB Atlas, where the hosted backend reads them.
One-time setup: in the GitHub repository open **Settings > Secrets and variables > Actions > New repository
secret**, name `MONGODB_URI`, value the Atlas connection string. It can also be started by hand from the
**Actions** tab. Rehearsed on 13 November 2026 in a clean copy of the repository: 2 minutes 19 seconds, and the
56 predictions were identical to the ones made on the developer's machine.

New satellite passes are files, not database rows, so the job commits them to `main`
(`data/labels/.cache/` month files and `district_flood_observations.json`, as the user
`rokkha-daily-update`). Render redeploys from that commit, which keeps the satellite timeline and the
"observed" map of the hosted backend up to date. **Run `git pull` before you start work**: there is usually
one such commit per day. The month cache is kept in the repository for this reason: with it, the job rebuilds
the observations file from every month exactly as a developer's machine does.

**Two things seen in live use (15 November 2026):**

- **GitHub starts scheduled jobs late**, sometimes by hours (the 14 November run started at 10:44 UTC instead of
  03:30, and the 17 November one at 12:12 UTC). Until it runs, the portal's "Today" button shows grey districts
  with "No forecast for this date". Fixed on 17 November, see below.
- **A restart of the hosted backend broke a running update (17 November).** Render and the job's own copy of the
  backend share one database, and every server start closed all "running" ingestion runs, including the job's.
  Now each run notes the time whenever it makes progress (`heartbeat_at`); a starting server, or a new run,
  closes only runs silent for more than 30 minutes (`RUN_STALE_AFTER`). If the update still fails (for example
  Open-Meteo timing out), the job tries once more after 10 minutes; it resumes where it stopped.
- **The satellite catalogue (EODC STAC) can be down** (on 15 November it answered `502 Bad Gateway`). The job then
  logs `satellite passes NOT refreshed`, predicts with the passes already stored, and still succeeds. Nothing is
  lost: every run fetches this month and the last, so the next run that reaches the catalogue adds the missed
  passes.

**Starting the daily update on time (since 17 November 2026).** GitHub's own timer is now only a backup (03:30
and 06:17 UTC). The main start comes from a free outside timer, [cron-job.org](https://cron-job.org), which at
03:30 UTC asks GitHub to run the workflow. The job's first step checks the hosted backend: if today (UTC) already
has predictions it stops within seconds, so several starts a day do no harm. To redo a day anyway, start it by
hand with **force** ticked. One-time setup (only the repository owner can do it; never paste the token anywhere
else, including chats):

1. GitHub > your picture > **Settings > Developer settings > Personal access tokens > Fine-grained tokens >
   Generate new token**. Name `rokkha-daily-timer`, expiry 90 days (put a reminder in your calendar),
   **Repository access: Only select repositories > Rokkha**, **Permissions > Repository > Actions: Read and
   write** (nothing else). Generate and copy it.
2. Sign up at cron-job.org > **Create cronjob**:
   - URL `https://api.github.com/repos/yunuszoro46-sketch/Rokkha/actions/workflows/daily-update.yml/dispatches`
   - Schedule: every day at **09:30**, time zone **Asia/Dhaka** (= 03:30 UTC).
   - **Advanced**: request method **POST**; headers `Authorization: Bearer <the token>`,
     `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`; request body `{"ref":"main"}`.
   - Save, then press **Test run**: GitHub answers `204 No Content`, and a run started by `workflow_dispatch`
     appears in the **Actions** tab within a minute.
3. If the token expires the timer's runs fail (401) and the GitHub backups take over, late again. Make a new
   token and paste it into the cron-job.org header.

What the automatic run does **not** do:

- It does not retrain or change the model.

The satellite step needs `requirements-dev.txt` (rasterio) and rewrites
`data/labels/district_flood_observations.json`; the running backend notices the new file by itself. Git will
show that file as changed: commit it when you want to publish the newer passes. If the satellite archive cannot
be reached, the update says so and still predicts with the passes already stored. `--no-satellite` skips the step.
Checked on 11 November 2026: all 56 districts had a pass from the last 30 days (41 from the day before), and
no district reached the watch level.

**Model delivery.** Training writes two files into `data/models/`: `flood_model.json` (the XGBoost model) and
`flood_model.meta.json` (model version, input names, training and test periods, measured results, the calibration
curve, and the `watch` / `alert` thresholds chosen from the validation year). The API loads them when they appear;
no code change is needed.

A predicted probability is not the same as model confidence, rainfall alone is not flood prediction, and a
rule-based score must never be presented as an ML prediction.

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

On a developer's machine every endpoint is open. On the public server `PUBLIC_READ_ONLY=true` switches the
data-changing endpoints off or makes them admin-only (see "Hosting on Render"). There is no general rate
limiting yet.

**Climate Shield (Rokkha) — building toward reliable flood-risk intelligence for Bangladesh.**
