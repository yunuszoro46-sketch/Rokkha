# Climate Shield Backend

Climate Shield is a climate-risk platform under development. Its first planned use case is helping people and organizations understand localized urban flood risk in **Dhaka, Bangladesh**.

This folder contains the backend: the application that receives requests, validates data, performs calculations, and returns results to the frontend.

**What works today:** manually submitted weather observations, geographic location records, point-in-polygon checks, and geographic distance calculations.

**What does not exist yet:** a trained flood-forecasting model, live environmental-data ingestion, operational flood alerts, or persistent storage connected to the active API.

> This is a development prototype, not an operational flood-warning service. A geometric result such as “inside” does not mean a location is flooding or will flood.

## 1. Project goal

The planned minimum viable product (MVP)—the first usable version—will estimate:

> The probability that a clearly defined flood event will occur within a geographic grid cell during the next 24 hours.

A grid cell is a small area on a map. Dividing Dhaka into cells will allow the system to estimate risk for individual areas rather than giving one result for the entire city.

The model is planned to use observed flood events as training labels, together with relevant environmental and geographic information.

Several modeling decisions remain open:

- Grid-cell size: [not yet defined].
- Flood-event definition and thresholds: [not yet defined].
- Verified training-data sources: [not yet selected].
- Alert thresholds: [not yet defined].

Rainfall alone will not be treated as proof of flooding. Being inside a supplied polygon will not, by itself, establish flood risk.

## 2. Current implementation

| Capability | Current state |
| --- | --- |
| FastAPI application | Implemented; application version is `0.3.0` |
| Root information and health endpoints | Implemented |
| Weather observation creation and retrieval | Implemented with in-memory storage |
| Geographic location creation and retrieval | Implemented with in-memory storage |
| GeoJSON Point validation | Implemented |
| GeoJSON Polygon and MultiPolygon validation | Implemented |
| Point inside/outside/on-boundary analysis | Implemented |
| Polygon holes | Supported by the analysis service |
| Invalid or empty polygon rejection | Implemented in the analysis service |
| WGS84 geographic distance | Implemented using GeographicLib |
| GeoJSON LineString validation | Schema implemented; no LineString API |
| MongoDB connection helper | Implemented, but not enabled in the active application |
| Persistent API storage | Not implemented |
| Live weather or river-data ingestion | Not implemented |
| Flood prediction and alerts | Not implemented |
| Asset management and exposure analysis | Not implemented |

Weather observations are submitted through the API. The current weather module does **not** fetch live weather from an external provider.

### Temporary storage

Weather and location records are stored in Python lists:

- Records disappear when the application restarts.
- Development reloads can erase records.
- Separate application processes do not share these lists.
- List endpoints currently return all records without pagination.

Use the current storage for local development only.

## 3. Technology stack

### Used by the current backend

| Technology | Purpose |
| --- | --- |
| Python | Programming language |
| FastAPI | HTTP API and interactive API documentation |
| Pydantic v2 | Request validation and response schemas |
| pydantic-settings | Configuration loaded from environment variables and `.env` |
| Shapely | Planar geometry operations |
| GeographicLib | Geographic distance on the WGS84 ellipsoid |
| PyMongo | Asynchronous MongoDB connection helper; currently inactive |
| Uvicorn | Local ASGI server |

### Planned technologies

| Technology | Planned purpose |
| --- | --- |
| MongoDB Atlas | Primary persistent database |
| XGBoost | Initial machine-learning baseline |
| GeoPandas | Geographic dataset processing |
| Rasterio | Raster and environmental dataset processing |

The established database direction is **MongoDB Atlas**. This backend does not use PostgreSQL, PostGIS, or microservices.

## 4. How the backend is organized

The backend is a **modular monolith**: one application divided into modules for different responsibilities.

A typical request follows this path:

```text
Frontend or API client
        |
        v
Router: receives the HTTP request
        |
        v
Service: performs application logic or calculations
        |
        v
Repository: stores or retrieves records
        |
        v
Python list today / MongoDB after integration
```

Calculation-only requests, such as distance analysis, do not need repository storage.

Each implemented module separates its responsibilities:

| File | Responsibility |
| --- | --- |
| `schemas.py` | Defines accepted inputs, validation rules, and response formats |
| `router.py` | Defines HTTP endpoints and handles HTTP errors |
| `service.py` | Performs application logic |
| `repository.py` | Stores and retrieves records |

### Source structure

Generated `__pycache__` directories are omitted below.

```text
Rokkha/
├── Backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   ├── modules/
│   │   │   ├── __init__.py
│   │   │   ├── alerts/
│   │   │   ├── assets/
│   │   │   ├── geospatial/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── repository.py
│   │   │   │   ├── router.py
│   │   │   │   ├── schemas.py
│   │   │   │   └── service.py
│   │   │   ├── ingestion/
│   │   │   ├── prediction/
│   │   │   └── weather/
│   │   │       ├── __init__.py
│   │   │       ├── repository.py
│   │   │       ├── router.py
│   │   │       ├── schemas.py
│   │   │       └── service.py
│   │   ├── shared/
│   │   └── main.py
│   ├── ml/
│   │   └── __init__.py
│   ├── tests/
│   │   └── test_geospatial.py
│   └── readme.md
└── Frontend/
```

The alerts, assets, ingestion, prediction, shared, and ML areas are placeholders, not completed features.

## 5. Run the backend locally

### Requirements

- Git.
- Python and pip.
- A terminal.
- An editor such as VS Code or PyCharm, if you want to change the code.

**Python version:** the repository does not contain a dependency manifest or a verified supported-version declaration. The previous README mentions Python 3.15.0, but that is not a reproducible compatibility guarantee.

[Suggested starting environment: Python 3.12; compatibility has not been tested as part of this documentation review.]

### Step 1: Clone the repository

```bash
git clone https://github.com/yunuszoro46-sketch/Rokkha.git
cd Rokkha/Backend
```

Run the remaining commands from `Backend/`.

### Step 2: Create a virtual environment

A virtual environment keeps this project's installed packages separate from other projects.

```bash
python -m venv .venv
```

On systems where Python is available as `python3`, use that command instead.

### Step 3: Activate the environment

**Windows PowerShell:**

```powershell
.\.venv\Scripts\Activate.ps1
```

**Windows Command Prompt:**

```bat
.venv\Scripts\activate.bat
```

**macOS or Linux:**

```bash
source .venv/bin/activate
```

### Step 4: Install the development dependencies

There is currently no checked-in `requirements.txt` or `pyproject.toml`.

The following is a provisional installation command based on the source imports, not a tested or pinned dependency set:

```bash
python -m pip install --upgrade pip
python -m pip install fastapi "uvicorn[standard]" "pydantic>=2,<3" pydantic-settings shapely geographiclib "pymongo[srv]"
```

A maintained dependency file and a verified Python version should be added before expecting reproducible installations.

### Step 5: Create a local `.env` file

Create `Backend/.env` containing:

```dotenv
PROJECT_NAME="Climate Shield"
API_V1_PREFIX="/api/v1"
MONGODB_URI="mongodb://localhost:27017"
MONGODB_DATABASE="climate_shield"
DEBUG=true
```

**Why a MongoDB URI is needed:** configuration currently requires `MONGODB_URI`, even though the active application does not establish a database connection.

The local URI above satisfies that configuration requirement. It does not enable persistence, and the active in-memory API does not require a local MongoDB server.

When MongoDB integration is enabled, replace it with a working connection URI and configure access appropriately.

Do not commit `.env` or real database credentials. No `.gitignore` or `.env.example` was present in the inspected root/backend directory listings; add suitable ignore rules before committing local files.

### Step 6: Start the server

```bash
python -m uvicorn app.main:app --reload
```

`--reload` restarts the application when source files change. It is intended for development.

### Step 7: Open the application

- Project information: http://127.0.0.1:8000/
- Health check: http://127.0.0.1:8000/api/v1/health
- Interactive Swagger UI: http://127.0.0.1:8000/docs
- Alternative documentation: http://127.0.0.1:8000/redoc
- OpenAPI schema: http://127.0.0.1:8000/openapi.json

The health endpoint returns:

```json
{
  "status": "healthy"
}
```

This confirms that the endpoint responds. It does not verify a database connection, data freshness, or prediction readiness.

## 6. API endpoints

The following paths assume the default `API_V1_PREFIX=/api/v1`.

The current health route is hardcoded as `/api/v1/health`; unlike the module routes, it does not follow a changed prefix setting.

### General

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/` | Basic project information |
| GET | `/api/v1/health` | Basic application health response |

### Weather

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/v1/weather/observations` | Create a weather observation |
| GET | `/api/v1/weather/observations` | List all stored observations |
| GET | `/api/v1/weather/observations/{record_id}` | Retrieve one observation |

### Geospatial

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/v1/geospatial/locations` | Create a named point location |
| GET | `/api/v1/geospatial/locations` | List all stored locations |
| GET | `/api/v1/geospatial/locations/{location_id}` | Retrieve one location |
| POST | `/api/v1/geospatial/spatial-analysis/point-in-polygon` | Check a point against a Polygon or MultiPolygon |
| POST | `/api/v1/geospatial/spatial-analysis/distance` | Calculate WGS84 geographic distance |

Successful creation requests return HTTP `201`. Successful retrieval and calculation requests normally return HTTP `200`.

There are currently no update/delete endpoints, prediction endpoints, alert endpoints, or LineString endpoints.

## 7. Try the API without writing code

1. Start the backend.
2. Open http://127.0.0.1:8000/docs.
3. Expand an endpoint.
4. Click **Try it out**.
5. Paste an example request body below.
6. Click **Execute**.

All examples below are synthetic development inputs, not verified weather observations or official flood-zone data.

### Example A: Create a location

Send to `POST /api/v1/geospatial/locations`:

```json
{
  "location_name": "Dhaka demo location",
  "latitude": 23.7465,
  "longitude": 90.376
}
```

The response includes a generated UUID and a GeoJSON Point:

```json
{
  "id": "[generated UUID]",
  "location_name": "Dhaka demo location",
  "latitude": 23.7465,
  "longitude": 90.376,
  "geometry": {
    "type": "Point",
    "coordinates": [90.376, 23.7465]
  }
}
```

Copy the returned `id` to retrieve that record using the single-location endpoint.

### Example B: Submit a weather observation

Send to `POST /api/v1/weather/observations`:

```json
{
  "location_name": "Dhaka demo station",
  "latitude": 23.7465,
  "longitude": 90.376,
  "rainfall_mm": 12.5,
  "temperature_c": 29,
  "humidity_percent": 80,
  "source": "manual-demo"
}
```

The response includes a generated `id` and `observed_at`.

**Current timestamp limitation:** `observed_at` is assigned by the server at record creation in UTC. The request does not accept the actual observation time.

**Current rainfall limitation:** `rainfall_mm` has no accumulation-window field. Do not assume it represents hourly or daily rainfall.

These limitations must be resolved before using these records as a reliable historical modeling dataset.

### Example C: Check whether a point is inside an area

Send to `POST /api/v1/geospatial/spatial-analysis/point-in-polygon`:

```json
{
  "point": {
    "type": "Point",
    "coordinates": [90.376, 23.7465]
  },
  "polygon": {
    "type": "Polygon",
    "coordinates": [
      [
        [90.35, 23.73],
        [90.4, 23.73],
        [90.4, 23.78],
        [90.35, 23.78],
        [90.35, 23.73]
      ]
    ]
  }
}
```

Expected from the implemented geometry logic:

```json
{
  "covered": true,
  "strictly_inside": true,
  "on_boundary": false,
  "relationship": "inside"
}
```

This rectangle is fictional. The response describes geometry only, not real-world flood conditions.

#### Understanding the result

| Point position | `covered` | `strictly_inside` | `on_boundary` | `relationship` |
| --- | --- | --- | --- | --- |
| Inside the area | true | true | false | `inside` |
| On a boundary | true | false | true | `boundary` |
| Outside the area | false | false | false | `outside` |
| Inside a polygon hole, away from its boundary | false | false | false | `outside` |

A MultiPolygon—several polygons represented as one geometry—can also be supplied in the `polygon` field.

### Example D: Calculate geographic distance

Send to `POST /api/v1/geospatial/spatial-analysis/distance`:

```json
{
  "point_a": {
    "type": "Point",
    "coordinates": [90.376, 23.7465]
  },
  "point_b": {
    "type": "Point",
    "coordinates": [90.376, 23.7465]
  }
}
```

These points are identical, so the expected response is:

```json
{
  "distance_meters": 0.0,
  "distance_kilometers": 0.0,
  "method": "WGS84 geodesic"
}
```

Change either point to calculate the shortest surface distance on the WGS84 ellipsoid. This is not a driving, walking, or evacuation-route distance.

## 8. Coordinate and validation rules

### Coordinate order

GeoJSON uses:

```text
[longitude, latitude]
```

For example:

```json
[90.376, 23.7465]
```

Location and weather creation requests use separate named `latitude` and `longitude` fields.

### Geographic geometry rules

- Longitude must be between `-180` and `180`.
- Latitude must be between `-90` and `90`.
- Points contain exactly two coordinate values.
- Each Polygon has at least one ring.
- Each ring contains at least four positions, including the closing position.
- The first and last positions of each ring must match.
- The first ring is the outer boundary; additional rings represent holes.
- MultiPolygons contain at least one polygon.
- LineStrings contain at least two positions, but currently have schema support only.
- The point-in-polygon service rejects empty or geometrically invalid polygons.

### Weather input rules

| Field | Validation |
| --- | --- |
| `location_name` | 2–100 characters |
| `latitude` | -90 to 90 |
| `longitude` | -180 to 180 |
| `rainfall_mm` | Zero or greater |
| `temperature_c` | -90 to 65 |
| `humidity_percent` | 0–100 |
| `source` | Optional; defaults to `manual`; maximum 100 characters |

### Why two geometry libraries are used

**Shapely** performs planar geometric operations, including containment and boundary checks.

**GeographicLib** calculates geographic distance on the WGS84 ellipsoid.

Longitude and latitude are angles measured in degrees, not meters. Ordinary Shapely distance on these coordinates must not be described as a distance in meters.

The current containment implementation operates on longitude/latitude as planar coordinates. It should not be assumed to handle global geometry or antimeridian-crossing polygons correctly.

## 9. Errors and troubleshooting

### HTTP errors

| Status | Meaning |
| --- | --- |
| `404` | The requested location or weather observation was not found |
| `422` | Request validation failed, or the analysis polygon was rejected as invalid |

Example missing-location response:

```json
{
  "detail": "Location not found"
}
```

### `MONGODB_URI` validation error on startup

Create `Backend/.env` as shown above, or provide the variable in the process environment.

Run the server from `Backend/`, because configuration looks for `.env` relative to the working directory.

### `ModuleNotFoundError`

Confirm that your virtual environment is active, install the dependencies, and run commands from `Backend/`.

### Records disappeared

The repositories use temporary memory. Restarting or reloading the application clears records.

### Frontend browser requests are blocked by CORS

The active application does not configure CORS middleware. Before connecting a frontend served from another origin, explicitly configure the allowed frontend origins.

### `/api/v1/health/database` returns 404

That endpoint appears only in an inactive, triple-quoted block in `main.py`. It is not registered in the active application.

## 10. MongoDB integration status

`app/core/database.py` contains an asynchronous PyMongo helper with methods to:

- Create a client.
- Ping MongoDB.
- Select the configured database.
- Close the client.

However, the active application does not call this helper during startup or shutdown, and the repositories do not use it.

An earlier application implementation containing database lifecycle wiring is retained inside a triple-quoted string in `main.py`. It does not execute.

Therefore:

- Setting `MONGODB_URI` does not turn on persistence.
- The basic health response does not prove MongoDB is connected.
- Database startup/shutdown integration and database-backed repositories remain unfinished.

## 11. Testing

The checked-in file `tests/test_geospatial.py` is a standalone Shapely demonstration. It prints `contains` and `covers` results for three points relative to a fictional rectangle.

Run it from `Backend/`:

```bash
python tests/test_geospatial.py
```

Expected geometry behavior:

| Case | `contains` | `covers` |
| --- | --- | --- |
| Inside | true | true |
| Outside | false | false |
| Boundary | false | true |

The script does not contain assertions or test functions. It is not a comprehensive automated regression suite, and it does not exercise the API or application services.

The previous README reports additional manual checks, but corresponding automated tests are not present in the inspected test directory.

Recommended automated coverage:

- Valid and invalid coordinate inputs.
- Polygon closure and minimum ring size.
- Invalid and self-intersecting geometry.
- Polygon holes and boundaries.
- MultiPolygon components and boundaries.
- LineString schema validation.
- Distance calculations against known reference values.
- API creation, retrieval, missing-record, and validation behavior.
- Database lifecycle and persistence after integration.

No tests were executed as part of this README review.

## 12. Development roadmap

The following items are planned, not claims of completed functionality.

1. **Make local development reproducible**
   - Establish a supported Python version.
   - Add a maintained dependency manifest.
   - Add `.env.example` and appropriate `.gitignore` rules.
   - Replace print-only checks with automated tests.
   - Remove tracked generated bytecode in a separate cleanup change.

2. **Extend geospatial functionality**
   - Add LineString service and API support.
   - Introduce verified Dhaka boundaries and relevant geographic datasets.
   - Represent rivers, drainage networks, and flood zones.
   - Add asset records and exposure analysis.

3. **Enable MongoDB persistence**
   - Connect database startup and shutdown lifecycle.
   - Implement MongoDB-backed repositories.
   - Add appropriate geospatial indexes and queries.
   - Add database integration tests.

4. **Build environmental-data ingestion**
   - Select and document data sources.
   - Ingest weather, river-level, and observed flood-event data.
   - Preserve actual observation times, units, accumulation periods, and provenance.
   - Add cleaning, quality checks, and missing-data handling.

5. **Develop the forecasting baseline**
   - Define the flood event and map grid.
   - Build the labeled dataset.
   - Train an XGBoost baseline.
   - Prevent temporal and geographic data leakage.
   - Evaluate and calibrate predicted probabilities.

6. **Integrate predictions and alerts**
   - Add prediction endpoints and risk-map outputs.
   - Connect asset exposure analysis.
   - Define and validate alert thresholds.
   - Complete frontend integration and end-to-end testing.

## 13. Planned machine-learning evaluation

There is no trained model or measured forecasting performance in the current backend.

Planned evaluation includes:

- Precision: how often predicted flood events are correct.
- Recall: how many actual flood events are detected.
- F1-score: a combined precision/recall measure.
- PR-AUC: precision/recall performance across thresholds.
- Brier score: accuracy of predicted probabilities.
- Calibration: whether predicted probabilities match observed frequencies.
- False-alarm and missed-event measures, with their definitions stated explicitly.

Training and evaluation must use only information available at the forecast issue time. Time-based and geographic separation should be designed to prevent leakage and test the intended deployment conditions.

A predicted flood probability is not the same as model confidence. Neither should be presented as validated until supported by suitable evaluation.

## 14. Working on the project

Backend and frontend work are separated into `Backend/` and `Frontend/`. The intended integration is through versioned REST APIs.

When contributing:

- Keep HTTP handling in routers.
- Keep application logic in services.
- Keep storage access in repositories.
- Keep validation and response contracts in schemas.
- Preserve GeoJSON coordinate order.
- Document input units, observation times, and data sources.
- Add automated tests for changed behavior.
- Update this README when behavior changes.
- Label planned functionality separately from implemented functionality.
- Never present synthetic examples as real hazard data.

The current backend does not implement authentication, authorization, or rate limiting. Keep it in a controlled development environment until appropriate operational safeguards are implemented.

**Climate Shield — building toward reliable climate-risk intelligence for Dhaka.**
