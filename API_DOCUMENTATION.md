# Rokkha / Climate Shield — Full API Documentation

> **Platform:** Rokkha Climate Intelligence (AI Builders Congress — Climate Shield)  
> **Backend Framework:** FastAPI (Python 3.12) with MongoDB Atlas & XGBoost  
> **Backend Base URL (Local):** `http://localhost:8000/api/v1`  
> **Interactive Swagger UI:** `http://localhost:8000/docs`  
> **OpenAPI JSON Spec:** `http://localhost:8000/openapi.json`  

---

## 1. Global Specifications & Rules

| Rule | Specification |
|---|---|
| **Coordinate Order** | GeoJSON standard: `[longitude, latitude]`. Example: Dhaka is `[90.40, 23.75]`. *(Note: Leaflet uses `[lat, lng]` — swap before plotting).* |
| **Geometry Representation** | RFC 7946 GeoJSON format: `{"type": "Point", "coordinates": [lng, lat]}`. Supported: `Point`, `MultiPoint`, `LineString`, `Polygon`, `MultiPolygon`. |
| **Units** | Distances in **metres** (`*_meters`) and km (`*_kilometers`); areas in **km²**; monetary value in **BDT (Taka)**; shares / ratios are **0.0 to 1.0** (0.82 = 82%). |
| **Timestamps** | ISO 8601 UTC format: `YYYY-MM-DDTHH:MM:SS.mmmmmmZ`. Dates are `YYYY-MM-DD`. |
| **Null Values** | Explicit `null` indicates missing or unobserved data — **never treat `null` as 0 or safe**. |
| **Probability Display Rule** | If model probability exceeds `0.95` (95%), display as **"more than 95%"** (the model's top probabilities are overconfident). |
| **Data Honesty & Attribution** | All satellite observations and hazard feeds require visible attribution to Copernicus GFM, GloFAS, ECMWF ERA5, NOAA GFS, and UNOSAT. |

---

## 2. API Endpoints by Module

```
├── Health & Diagnostics
│   ├── GET  /api/v1/health
│   └── GET  /api/v1/health/database
├── Flood Predictions & Alerts
│   ├── GET  /api/v1/predictions/model
│   ├── POST /api/v1/predictions
│   ├── GET  /api/v1/predictions?target_date=YYYY-MM-DD
│   └── GET  /api/v1/alerts?target_date=YYYY-MM-DD&min_level=watch|alert
├── Geospatial & Flood Intelligence
│   ├── GET  /api/v1/geospatial/flood/events
│   ├── GET  /api/v1/geospatial/flood/districts
│   ├── GET  /api/v1/geospatial/flood/districts/{pcode}
│   ├── GET  /api/v1/geospatial/flood/districts/{pcode}/satellite-observations
│   ├── POST /api/v1/geospatial/flood/check
│   ├── GET  /api/v1/geospatial/boundaries
│   ├── POST /api/v1/geospatial/boundaries/locate
│   ├── GET  /api/v1/geospatial/waterways
│   └── POST /api/v1/geospatial/waterways/nearest
├── Assets & Flood Exposure Management
│   ├── POST /api/v1/assets
│   ├── GET  /api/v1/assets
│   ├── GET  /api/v1/assets/{asset_id}
│   ├── PATCH /api/v1/assets/{asset_id}
│   ├── DELETE /api/v1/assets/{asset_id}
│   ├── GET  /api/v1/assets/near
│   ├── POST /api/v1/assets/within
│   ├── GET  /api/v1/assets/exposure
│   └── GET  /api/v1/assets/{asset_id}/exposure
├── Environmental Ingestion & Telemetry
│   ├── GET  /api/v1/ingestion/sites
│   ├── GET  /api/v1/ingestion/rain
│   ├── GET  /api/v1/ingestion/rain-recent
│   ├── GET  /api/v1/ingestion/river
│   ├── GET  /api/v1/ingestion/rain-forecast
│   ├── GET  /api/v1/ingestion/usage
│   └── POST /api/v1/ingestion/runs
└── Weather Observations (Manual Entry)
    ├── POST /api/v1/weather/observations
    ├── GET  /api/v1/weather/observations
    └── GET  /api/v1/weather/observations/{record_id}
```

---

## 3. Detailed Endpoint Reference

### 3.1. System Health

#### `GET /api/v1/health`
Returns system service operational state.
- **Response (200 OK):**
```json
{
  "status": "healthy"
}
```

#### `GET /api/v1/health/database`
Pings MongoDB Atlas connection.
- **Response (200 OK):**
```json
{
  "database": "MongoDB",
  "status": "connected"
}
```
- **Error (503 Service Unavailable):** Database unreachable.

---

### 3.2. Flood Predictions & Alerts

#### `GET /api/v1/predictions/model`
Metadata and verification metrics of the trained XGBoost flood forecasting model.
- **Response (200 OK):**
```json
{
  "status": "ready",
  "message": "A trained model is loaded.",
  "model": {
    "model_version": "2026.11.12-xgboost-v1",
    "feature_names": ["rain_1d", "rain_3d", "river_log_discharge", "..."],
    "test_results": {
      "alert_precision": 0.60,
      "alert_recall": 0.40,
      "watch_recall": 0.60
    }
  }
}
```

#### `GET /api/v1/predictions`
Retrieve daily flood predictions for all 64 districts for a specific date.
- **Query Parameters:**
  - `target_date` (string, required): Format `YYYY-MM-DD`. Valid benchmark dates: `2022-06-18`, `2024-08-22`, `2023-04-10`.
- **Response (200 OK):**
```json
{
  "target_date": "2022-06-18",
  "model_version": "2026.11.12-xgboost-v1",
  "count": 64,
  "predictions": [
    {
      "pcode": "BD6090",
      "name": "Sunamganj",
      "division": "Sylhet",
      "target_date": "2022-06-18",
      "status": "predicted",
      "probability": 0.83,
      "alert_level": "alert",
      "reason": null,
      "features": {
        "rain_1d": 104.1,
        "rain_3d": 262.0,
        "river_log_discharge": 3.42,
        "hazard_share_10yr": 0.62,
        "last_flooded_share": 0.1797
      },
      "data_through": "2022-06-17",
      "model_version": "2026.11.12-xgboost-v1",
      "issued_at": "2026-11-12T03:00:00Z"
    }
  ]
}
```
- **Error (404 Not Found):** `{"detail": "No predictions stored for that day. Create them with POST /api/v1/predictions."}`

#### `GET /api/v1/alerts`
Retrieve early warning alerts for districts exceeding warning thresholds, along with real registered critical assets at risk.
- **Query Parameters:**
  - `target_date` (string, required): `YYYY-MM-DD`
  - `min_level` (string, optional, default `"watch"`): `"watch"` (returns watches and alerts) or `"alert"` (returns only severe alerts).
- **Response (200 OK):**
```json
{
  "target_date": "2022-06-18",
  "model_version": "2026.11.12-xgboost-v1",
  "count": 7,
  "alerts": [
    {
      "alert_id": "BD6090|2022-06-18",
      "level": "alert",
      "district": {
        "pcode": "BD6090",
        "name": "Sunamganj",
        "division": "Sylhet"
      },
      "target_date": "2022-06-18",
      "probability": 0.83,
      "message": "Flood alert for Sunamganj district on 2022-06-18: the model estimates a 83% probability of satellite-observable flooding. 3 registered assets in this district.",
      "assets_at_risk": {
        "total": {
          "assets": 3,
          "occupancy": 1400,
          "replacement_value_bdt": 450000000
        },
        "with_observed_flooding": {
          "assets": 2,
          "occupancy": 1100,
          "replacement_value_bdt": 350000000
        },
        "with_modelled_hazard_10yr": {
          "assets": 2,
          "occupancy": 1100,
          "replacement_value_bdt": 350000000
        },
        "assets": [
          {
            "asset_id": "b8f21e54-...",
            "name": "Sunamganj Haor Shelter",
            "asset_type": "flood_shelter",
            "criticality": "high",
            "occupancy": 600,
            "flags": {
              "observed_flooding": true,
              "modelled_hazard_10yr": true,
              "modelled_hazard_100yr": true
            }
          }
        ]
      },
      "issued_at": "2026-11-12T03:00:00Z",
      "model_version": "2026.11.12-xgboost-v1"
    }
  ]
}
```

---

### 3.3. Geospatial & Flood Observations

#### `GET /api/v1/geospatial/flood/districts`
Ranking of all 64 districts in Bangladesh by historical flood event frequency.
- **Query Parameters:**
  - `limit` (integer, optional): Maximum records to return.
  - `division` (string, optional): Filter by administrative division.
- **Response (200 OK):**
```json
{
  "count": 64,
  "districts": [
    {
      "rank": 1,
      "pcode": "BD6090",
      "name": "Sunamganj",
      "division": "Sylhet",
      "events_observed": 6,
      "events_flooded": 6,
      "max_flooded_share": 0.818
    }
  ]
}
```

#### `GET /api/v1/geospatial/flood/districts/{pcode}/satellite-observations`
Copernicus Sentinel-1 SAR satellite pass observation timeline (2016 to present).
- **Path Parameters:**
  - `pcode` (string, required): District P-Code (e.g. `BD6090`).
- **Query Parameters:**
  - `start_date` (string, optional): `YYYY-MM-DD`
  - `end_date` (string, optional): `YYYY-MM-DD`
  - `min_observed_share` (float, optional, default `0.5`): Minimum district visibility.
- **Response (200 OK):**
```json
{
  "pcode": "BD6090",
  "name": "Sunamganj",
  "count": 48,
  "observations": [
    {
      "date": "2022-05-23",
      "observed_share": 0.9051,
      "flooded_share": 0.5859,
      "advisory_share": 0.8369,
      "flooded": true
    }
  ]
}
```
*Note: 8 districts (Bandarban, Rangamati, Khagrachhari, Chattogram, Cox's Bazar, Gazipur, Bagerhat, Khulna) return `count: 0` because radar cannot penetrate steep terrain, forests, or dense urban land cover.*

#### `POST /api/v1/geospatial/flood/check`
Checks historical flood occurrences and modelled return-period hazards at any arbitrary GPS coordinate.
- **Request Body:**
```json
{
  "point": {
    "type": "Point",
    "coordinates": [91.1428, 24.8474]
  }
}
```
- **Response (200 OK):**
```json
{
  "district": {
    "pcode": "BD6090",
    "name": "Sunamganj",
    "division": "Sylhet",
    "flood_rank": 1
  },
  "cell": {
    "observed": {
      "times_observed": 7,
      "times_flooded": 7,
      "flooded_event_ids": ["2016-07-monsoon", "2022-06-monsoon"],
      "last_flooded_event_id": "2022-06-monsoon"
    },
    "hazard": [
      {
        "return_period_years": 10,
        "depth_class": 2,
        "depth_label": "1 to 3 m"
      },
      {
        "return_period_years": 100,
        "depth_class": 2,
        "depth_label": "1 to 3 m"
      }
    ],
    "permanent_water": false
  }
}
```

---

### 3.4. Assets & Exposure Management

#### `POST /api/v1/assets`
Register a critical infrastructure asset. The backend automatically determines the district via point-in-polygon.
- **Request Body:**
```json
{
  "name": "Sylhet Central Disaster Relief Shelter",
  "asset_type": "flood_shelter",
  "location": {
    "type": "Point",
    "coordinates": [91.8712, 24.8949]
  },
  "criticality": "critical",
  "occupancy": 1500,
  "replacement_value_bdt": 45000000,
  "owner": "Ministry of Disaster Management",
  "address": "Kotwali, Sylhet"
}
```
- **Response (201 Created):** Returns created asset with UUID `id`, `created_at`, `updated_at`, and assigned `district`.
- **Validation:** Points outside Bangladesh return `422 Unprocessable Entity`.

#### `GET /api/v1/assets/near`
Spatial radius search for assets near a coordinate, sorted nearest first.
- **Query Parameters:**
  - `lng` (float, required): Longitude
  - `lat` (float, required): Latitude
  - `max_distance_m` (float, required): Search radius in metres (1 to 200,000 m).
  - `asset_type` (string, optional): e.g. `hospital`, `flood_shelter`.
- **Response (200 OK):**
```json
{
  "count": 2,
  "max_distance_meters": 5000,
  "total_occupancy": 2100,
  "total_replacement_value_bdt": 85000000,
  "results": [
    {
      "asset": { "id": "...", "name": "...", "location": { "type": "Point", "coordinates": [...] } },
      "distance_meters": 1240.5,
      "distance_kilometers": 1.24
    }
  ]
}
```

#### `GET /api/v1/assets/exposure`
Aggregated exposure report for all registered assets across Bangladesh or filtered by district.
- **Query Parameters:**
  - `district_pcode` (string, optional): e.g. `BD6090`
  - `asset_type` (string, optional)
- **Response (200 OK):**
```json
{
  "summary": {
    "total": { "assets": 12, "occupancy": 9400, "replacement_value_bdt": 31000000000 },
    "with_observed_flooding": { "assets": 4, "occupancy": 3200, "replacement_value_bdt": 1200000000 },
    "with_modelled_hazard_10yr": { "assets": 5, "occupancy": 4100, "replacement_value_bdt": 1800000000 },
    "with_modelled_hazard_100yr": { "assets": 7, "occupancy": 5800, "replacement_value_bdt": 2400000000 }
  },
  "assets": [...]
}
```

---

### 3.5. Environmental Ingestion & Telemetry

#### `GET /api/v1/ingestion/rain`
Historical ERA5 daily precipitation telemetry for a monitoring site.
- **Query Parameters:**
  - `site_id` (string, required): e.g. `district-BD6090` (Sunamganj) or `district-BD3026` (Dhaka).
  - `start_date` (string, optional): `YYYY-MM-DD`
  - `end_date` (string, optional): `YYYY-MM-DD`

#### `GET /api/v1/ingestion/river`
Daily river discharge telemetry from Copernicus GloFAS.
- **Query Parameters:**
  - `site_id` (string, required): River site identifier (e.g. `surma-sunamganj`, `meghna-bhairab`, `jamuna-bahadurabad`).
  - `start_date`, `end_date` (optional): `YYYY-MM-DD`

#### `GET /api/v1/ingestion/rain-forecast`
Next 7-day hourly precipitation forecast from NOAA GFS.
- **Query Parameters:**
  - `site_id` (string, required): e.g. `district-BD6090`.

---

## 4. Current Backend Non-Existent Features

The following features **do NOT exist in the backend today**. The frontend must NOT simulate or fabricate responses for them without clear disclaimer indicators:

1. **User Authentication & Accounts:** No login, JWT, OAuth, or user session endpoints.
2. **Citizen SOS / Rescue Dispatch:** No SOS dispatch, responder queue, or rescue mission schemas.
3. **Automated Notification Subscriptions:** No email, SMS, or push webhook notification engines.
4. **Official Warning Authority:** The backend produces ML probability estimates; official disaster warnings must reference FFWC / BWDB.
