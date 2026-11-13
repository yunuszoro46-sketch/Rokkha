"""
Tests for the read-only mode used on a public server (PUBLIC_READ_ONLY=true).

Run from the Backend folder:  python -m pytest -v
"""

import pytest

from app.core.config import settings


ASSET = {
    "name": "Test shelter", "asset_type": "flood_shelter",
    "location": {"type": "Point", "coordinates": [91.15, 24.85]}, "criticality": "high",
}
POINT = {"point": {"type": "Point", "coordinates": [91.1428, 24.8474]}}


@pytest.fixture
def read_only(monkeypatch):
    monkeypatch.setattr(settings, "PUBLIC_READ_ONLY", True)


def test_by_default_data_can_be_changed(client):

    assert client.post("/api/v1/assets", json=ASSET).status_code == 201


def test_read_only_refuses_requests_that_change_shared_data(client, read_only):

    refused = [
        client.post("/api/v1/assets", json=ASSET),
        client.patch("/api/v1/assets/some-id", json={"name": "x"}),
        client.delete("/api/v1/assets/some-id"),
        client.post("/api/v1/ingestion/runs", json={"kind": "rain_forecast"}),
        client.post("/api/v1/predictions", json={"target_date": "2022-06-18"}),
        client.post("/api/v1/weather/observations", json={}),
        client.post("/api/v1/geospatial/locations", json={}),
    ]

    assert [r.status_code for r in refused] == [403] * len(refused)
    assert "read-only" in refused[0].json()["detail"]
    assert client.get("/api/v1/assets").json()["count"] == 0


def test_read_only_still_allows_reading_and_point_checks(client, read_only):

    assert client.get("/api/v1/health").status_code == 200
    assert client.get("/api/v1/geospatial/flood/districts").status_code == 200
    assert client.post("/api/v1/geospatial/flood/check", json=POINT).status_code == 200
    assert client.post(
        "/api/v1/assets/within",
        json={"area": {"type": "Polygon", "coordinates": [[[91, 24], [92, 24], [92, 25], [91, 25], [91, 24]]]}},
    ).status_code == 200


def test_read_only_still_allows_accounts(client, read_only):

    created = client.post(
        "/api/v1/auth/register",
        json={"name": "Rahima", "email": "rahima@example.org", "password": "monsoon-2026"},
    )
    assert created.status_code == 201

    headers = {"Authorization": f"Bearer {created.json()['token']}"}
    saved = client.put("/api/v1/auth/me/location", headers=headers, json={"location": POINT["point"]})
    assert saved.status_code == 200
    assert client.get("/api/v1/auth/me/report?target_date=2022-06-18", headers=headers).status_code == 200


def test_a_refusal_can_be_read_by_the_browser(client, read_only):

    # The 403 must carry the CORS header, or the frontend only sees a network error.
    response = client.post("/api/v1/assets", json=ASSET, headers={"Origin": "http://localhost:3000"})

    assert response.status_code == 403
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
