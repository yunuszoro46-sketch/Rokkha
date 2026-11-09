import os

import pytest


# Settings requires MONGODB_URI at startup. MongoDB integration is
# postponed and no test connects to a database, so a placeholder is
# enough. This must run BEFORE "app" is imported, which is why it sits
# at the top of conftest.py (pytest loads this file first).
os.environ.setdefault("MONGODB_URI", "mongodb://placeholder")


from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture
def client():

    # A fake HTTP client that calls the FastAPI app directly,
    # without starting a real server.
    return TestClient(app)


# ==========================================
# SHARED TEST ZONES (Dhaka)
# ==========================================

@pytest.fixture
def flood_zone():

    # Rectangle: longitude 90.35–90.40, latitude 23.73–23.78.
    return {
        "type": "Polygon",
        "coordinates": [[
            [90.35, 23.73],
            [90.40, 23.73],
            [90.40, 23.78],
            [90.35, 23.78],
            [90.35, 23.73]
        ]]
    }


@pytest.fixture
def second_zone():

    # Second rectangle that contains the OUTSIDE point.
    return [[
        [90.42, 23.79],
        [90.46, 23.79],
        [90.46, 23.82],
        [90.42, 23.82],
        [90.42, 23.79]
    ]]


@pytest.fixture
def bow_tie_zone():

    # Self-intersecting polygon: geometrically invalid.
    return {
        "type": "Polygon",
        "coordinates": [[
            [90.35, 23.73],
            [90.40, 23.78],
            [90.40, 23.73],
            [90.35, 23.78],
            [90.35, 23.73]
        ]]
    }
