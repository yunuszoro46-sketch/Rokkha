import os
import subprocess
import time

import pytest
from pymongo import MongoClient


# ==========================================
# TEST DATABASE (never Atlas)
# ==========================================
# Tests use a separate, local MongoDB in Docker, so they are fast, work
# offline and can never touch the real Atlas data in .env.
#
# One-time setup (Linux):
#   docker run -d --name rokkha-test-mongo --restart unless-stopped \
#       -p 127.0.0.1:27018:27017 mongo:8.2
# (mongo:8.0 does not start on Linux kernel 6.19+; 8.2 does.)
#
# Use another test server with:  TEST_MONGODB_URI=mongodb://host:port pytest

TEST_MONGODB_URI = os.environ.get("TEST_MONGODB_URI", "mongodb://127.0.0.1:27018")
TEST_DATABASE = "climate_shield_test"
DOCKER_CONTAINER = "rokkha-test-mongo"

if "mongodb.net" in TEST_MONGODB_URI or TEST_MONGODB_URI.startswith("mongodb+srv"):
    raise RuntimeError("Refusing to run tests against MongoDB Atlas. Use a local test database.")

# Must run BEFORE "app" is imported (pytest loads this file first).
# Environment variables beat .env, so this overrides the Atlas URI.
os.environ["MONGODB_URI"] = TEST_MONGODB_URI
os.environ["MONGODB_DATABASE"] = TEST_DATABASE


def _test_database_reachable() -> bool:

    try:
        MongoClient(TEST_MONGODB_URI, serverSelectionTimeoutMS=1500).admin.command("ping")
        return True
    except Exception:
        return False


def pytest_sessionstart(session):

    # Start the Docker test database if it exists but is stopped.
    if _test_database_reachable():
        return

    subprocess.run(["docker", "start", DOCKER_CONTAINER], capture_output=True)

    for _ in range(15):
        if _test_database_reachable():
            return
        time.sleep(1)

    pytest.exit(
        f"Test MongoDB not reachable at {TEST_MONGODB_URI}. Start it with:\n"
        f"  docker run -d --name {DOCKER_CONTAINER} --restart unless-stopped "
        f"-p 127.0.0.1:27018:27017 mongo:8.2",
        returncode=2,
    )


from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def empty_test_database():

    # Every test starts with empty collections, so tests cannot affect each
    # other. Deleting documents (not dropping the database) keeps the
    # indexes, which is much faster than rebuilding them for every test.
    with MongoClient(TEST_MONGODB_URI) as mongo:
        database = mongo[TEST_DATABASE]
        for name in database.list_collection_names():
            database[name].delete_many({})
        yield


@pytest.fixture
def client():

    # "with" runs the app's lifespan: connect to the test MongoDB and
    # create the indexes, then disconnect when the test is done.
    with TestClient(app) as test_client:
        yield test_client


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
