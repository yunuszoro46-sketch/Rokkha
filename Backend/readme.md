🌍 Climate Shield AI-Powered Climate Risk Forecasting and Asset Protection

![Python](https://img.shields.io/badge/Python-3.15-blue?logo=python) ![FastAPI](https://img.shields.io/badge/FastAPI-Backend-**009688**?logo=fastapi) ![MongoDB](https://img.shields.io/badge/Database-MongoDB%20Atlas-**47A248**?logo=mongodb) ![Shapely](https://img.shields.io/badge/Geospatial-Shapely-orange) ![Status](https://img.shields.io/badge/Status-Under%20Development-yellow)

Climate Shield is an AI-powered climate risk intelligence platform designed to help protect lives, infrastructure, and physical assets from climate-related hazards.

The initial Minimum Viable Product (**MVP**) focuses on localized flood-risk forecasting and geospatial intelligence for Dhaka, Bangladesh.

The project combines climate data, geospatial analysis, machine learning, and alert generation to support better risk assessment and decision-making.

## Project Vision

Climate-related hazards, particularly urban flooding, pose significant risks to densely populated cities.

Climate Shield aims to address this challenge by developing a platform that can:

Analyze geographic locations and vulnerable areas. Assess the spatial exposure of physical assets. Incorporate weather and environmental observations. Predict localized flood-event probabilities. Generate risk alerts to support timely decisions. Help communities and organizations understand potential climate risks.

Our long-term goal is to build an intelligent climate-risk protection system that can be extended to other cities and climate hazards.

## Initial MVP Scope

Target location: Dhaka, Bangladesh.

Initial hazard: Urban flooding.

Initial prediction objective:

Estimate the probability of a defined flood event occurring within a geographic grid cell over an initial 24-hour forecast horizon.

The prediction system will use observed flood events as labels and incorporate relevant environmental and geographic information.

Rainfall alone will not be treated as a complete flood prediction.

## Technology Stack

Technology	Purpose
Python	Primary programming language
FastAPI	Backend **REST** **API**
Pydantic	Data validation and schemas
MongoDB Atlas	Planned primary database
PyMongo	Planned MongoDB integration
Shapely	Geometric and spatial operations
GeographicLib	Accurate geodesic distance calculations
XGBoost	Planned initial ML baseline
GeoPandas	Planned geographic data processing
Rasterio	Planned raster and environmental data processing
Architecture

Climate Shield follows a Modular Monolith architecture.

It uses one FastAPI application and a modular backend structure.

We are not using microservices, PostgreSQL, or PostGIS.

MongoDB Atlas is the established primary database choice. Database integration is planned for a later development phase.

## Backend Architecture

The backend follows a layered architecture:

text
Client / Frontend
    |
    v
    FastAPI
    |
    v
    Router
    |
    v
    Service
    |
    v
    Repository
    |
    v
    Database

Responsibilities:

Router: Handles **HTTP** requests and responses. Service: Contains application logic and geospatial operations. Repository: Handles data storage and retrieval. Schemas: Validate incoming data and structure **API** responses. ### Project Structure text Backend/ │ ├── app/ │   ├── core/ │   │   ├── config.py │   │   └── database.py │   │ │   ├── modules/ │   │   ├── alerts/ │   │   ├── assets/ │   │   │ │   │   ├── geospatial/ │   │   │   ├── __init__.py │   │   │   ├── schemas.py │   │   │   ├── repository.py │   │   │   ├── service.py │   │   │   └── router.py │   │   │ │   │   ├── ingestion/ │   │   ├── prediction/ │   │   └── weather/ │   │       ├── repository.py │   │       ├── router.py │   │       ├── schemas.py │   │       └── service.py │   │ │   ├── shared/ │   └── main.py │ ├── migrations/ ├── ml/ ├── tests/ │   └── test_geospatial.py │ ├── .env ├── .gitignore └── **README**.md

This represents the current known structure. Additional modules and files will be added as development progresses.

## Implemented Features

The following backend functionality has been implemented and tested.

### Backend Foundation

FastAPI application. Modular Monolith architecture. Centralized configuration using Pydantic. **API** versioning with /api/v1. Health-check endpoint. Weather module with temporary in-memory storage. ### Geospatial Module

GeoJSON support:

Point. Polygon. MultiPolygon. LineString schema validation.

Coordinate validation:

Longitude range: -**180** to **180**. Latitude range: -90 to 90. GeoJSON coordinate order: [longitude, latitude]. Polygon ring closure validation. Minimum polygon ring positions. LineString minimum coordinate positions.

Spatial analysis:

Point-in-Polygon analysis. Point-in-MultiPolygon analysis. Interior and exterior ring support. Boundary detection. Geometric validity checking. Invalid polygon rejection.

Geographic distance:

**WGS84** geodesic distance calculation. Distance output in meters. Distance output in kilometers. GeographicLib integration. ### Important Geospatial Design Decision

Shapely is used for planar geometric operations.

GeographicLib is used for geodesic distance calculations.

Longitude and latitude are angular coordinates measured in degrees. They cannot be directly treated as meters.

Therefore, ordinary Shapely distance on longitude/latitude coordinates is not presented as a meter-based geographic distance.

## API Endpoints

Base **API** prefix:

text /api/v1

General
Method	Endpoint	Description
**GET**	/	Project information
**GET**	/api/v1/health	Backend health check
Weather

Weather endpoints are implemented in the weather module. Refer to the running Swagger documentation for their current definitions.

Geospatial
Method	Endpoint	Description
**POST**	/api/v1/geospatial/locations	Create a geographic location
**GET**	/api/v1/geospatial/locations	Retrieve all locations
**GET**	/api/v1/geospatial/locations/{location_id}	Retrieve a location
**POST**	/api/v1/geospatial/spatial-analysis/point-in-polygon	Analyze a point against a Polygon or MultiPolygon
**POST**	/api/v1/geospatial/spatial-analysis/distance	Calculate **WGS84** geodesic distance

LineString service and **API** integration are under development.

## Example API Response

Point-in-Polygon
json
{
    *covered*: true,
    *strictly_inside*: true,
    *on_boundary*: false,
    *relationship*: *inside*
}

### Geographic Distance

json
{
    *distance_meters*: **9591**.**848250510406**,
    *distance_kilometers*: 9.**591848250510406**,
    *method*: ***WGS84** geodesic*
}

## Installation and Local Development

Requirements Python 3.15.0 (current development environment). Git. PyCharm or another Python **IDE**. Step 1: Clone the repository bash git clone YOUR_GITHUB_REPOSITORY_URL cd Backend

Replace the repository **URL** with the actual GitHub repository **URL**.

Step 2: Create a virtual environment powershell python -m venv .venv

Step 3: Activate the virtual environment

Windows PowerShell:

powershell .\.venv\Scripts\Activate.ps1

Step 4: Install dependencies

Install the project's dependencies using its maintained dependency file.

If a requirements.txt has not yet been created, the team should establish one before relying on this installation step.

Step 5: Run the backend powershell uvicorn app.main:app --reload

Step 6: Open **API** documentation

Swagger UI:

text [http://**127**.0.0.1:**8000**/docs](http://**127**.0.0.1:**8000**/docs)

Alternative **API** documentation:

text [http://**127**.0.0.1:**8000**/redoc](http://**127**.0.0.1:**8000**/redoc)

## Testing

Geospatial functionality has been tested through standalone Python scripts, service-level tests, and Swagger UI.

Verified test cases include:

Valid geographic coordinates. Invalid longitude and latitude. Valid Polygon. Invalid self-intersecting Polygon. Point inside Polygon. Point outside Polygon. Point on Polygon boundary. Point inside different MultiPolygon components. Point outside MultiPolygon. MultiPolygon boundary behavior. Geographic distance between Dhaka coordinates. Valid LineString schema. LineString with insufficient positions. Invalid LineString longitude. Invalid LineString latitude.

The LineString schema validation tests have passed.

Further automated regression testing and integration testing will continue as development progresses.

## Development Roadmap

Phase 1 — Backend Foundation FastAPI application. Modular Monolith structure. Configuration. Health endpoint. Phase 2 — Weather Module Weather schemas. Weather repository. Weather service. Weather **API**. Phase 3 — Geospatial Foundation Geographic location management. GeoJSON Point. GeoJSON Polygon. GeoJSON MultiPolygon. Point-in-Polygon analysis. Geographic distance calculation. GeoJSON LineString schema. Phase 4 — Advanced Geospatial Development Shapely LineString integration. LineString **API**. Additional GeoJSON geometry support. Dhaka administrative boundaries. River and drainage network representation. Flood-zone representation. Asset management. Asset exposure analysis. MongoDB geospatial queries and indexes. Phase 5 — Database Integration MongoDB Atlas integration. PyMongo repository implementation. Weather observation persistence. River observation persistence. Geographic data persistence. Phase 6 — Data Ingestion Historical climate data collection. Weather data ingestion. River-level observation ingestion. Flood-event data collection. Data cleaning and preprocessing. Phase 7 — Machine Learning Flood-event label definition. Geographic grid construction. ML dataset creation. XGBoost baseline. Temporal and geographic leakage prevention. Model evaluation. Probability calibration. Phase 8 — Prediction and Alerts Flood probability prediction **API**. Geographic risk mapping. Asset exposure analysis. Alert generation. End-to-end integration testing. ## Machine Learning Evaluation Strategy

The initial ML target is:

Probability of a defined flood event occurring within a geographic grid cell during the next 24 hours.

Evaluation will include:

Precision. Recall. F1-score. PR-**AUC**. Brier score. False alarm rate. Missed flood events.

The project will prioritize reliable probability estimation and prevention of temporal and geographic data leakage.

Predicted probability will be distinguished from model confidence.

## Team Development

Climate Shield is being developed collaboratively.

Backend and machine learning development focus on:

**API** development. Geospatial engineering. Climate data processing. Database integration. ML model development. Risk assessment. Alert generation.

Frontend development is handled separately by another teammate.

The frontend and backend will communicate through versioned **REST** APIs.

## Project Status

Current status: Under active development.

The backend foundation, weather module, and initial geospatial capabilities are implemented.

The project is currently progressing through advanced geospatial development before moving into database integration, climate-data ingestion, and machine learning.

## Project Goals

Climate Shield aims to transform climate and geographic information into actionable intelligence that helps protect people, infrastructure, and valuable physical assets.

Built with a focus on practical climate resilience, reliable engineering, and scalable development.

Climate Shield — Predict Risk. Protect Lives. Safeguard Assets.
