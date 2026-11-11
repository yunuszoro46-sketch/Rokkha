"""
Tests for the flood prediction API (/api/v1/predictions) and the alerts built
from it (/api/v1/alerts).

They use the `flood_model` fixture: a tiny model trained on made-up numbers
("more than 100 mm of rain in 3 days = flood"). It proves the code path
(stored rain -> inputs -> model -> probability -> alert -> assets), not real
forecasting skill. The real model's quality is measured separately, on
2023-2024 data it has never seen.

Run from the Backend folder:  python -m pytest -v
"""

import os
from datetime import date, datetime, timedelta, timezone

import numpy
import pytest
from pymongo import MongoClient

from app.modules.prediction.service import _alert_level, _calibrate

from conftest import TEST_MODEL_THRESHOLDS, write_test_model_meta


TEST_MONGODB_URI = os.environ["MONGODB_URI"]
TEST_DATABASE = os.environ["MONGODB_DATABASE"]

PREDICTIONS = "/api/v1/predictions"
ALERTS = "/api/v1/alerts"

TARGET = date(2022, 6, 18)

SUNAMGANJ = "BD6090"
DHAKA = "BD3026"
KHULNA = "BD4047"          # satellites cannot observe it: unsupported

SUNAMGANJ_HAOR = [91.1428, 24.8474]


def store_recent_rain(pcode, daily_mm, days_back, target=TARGET):
    """Store GFS recent-days rain for the given days before target."""

    documents = []

    for back in days_back:
        day = target - timedelta(days=back)
        documents.append({
            "_id": f"district-{pcode}|{day.isoformat()}",
            "site_id": f"district-{pcode}",
            "date": datetime(day.year, day.month, day.day, tzinfo=timezone.utc),
            "precipitation_mm": daily_mm,
            "missing": False,
        })

    with MongoClient(TEST_MONGODB_URI) as mongo:
        mongo[TEST_DATABASE]["rain_recent_daily"].insert_many(documents)


def store_rain(pcode, daily_mm, target=TARGET, days=31, extra_days_ahead=0):
    """Store `daily_mm` of rain per day for the days before (and optionally after) target."""

    documents = []

    for back in range(-extra_days_ahead, days + 1):
        if back == 0 and not extra_days_ahead:
            continue
        day = target - timedelta(days=back)
        documents.append({
            "_id": f"district-{pcode}|{day.isoformat()}",
            "site_id": f"district-{pcode}",
            "date": datetime(day.year, day.month, day.day, tzinfo=timezone.utc),
            # Days on or after the target get an absurd value: it must never be used.
            "precipitation_mm": daily_mm if back >= 1 else 999.0,
            "missing": False,
        })

    with MongoClient(TEST_MONGODB_URI) as mongo:
        mongo[TEST_DATABASE]["rain_daily"].insert_many(documents)


def predict(client, target=TARGET):

    return client.post(PREDICTIONS, json={"target_date": target.isoformat()})


def by_pcode(body):

    return {p["pcode"]: p for p in body["predictions"]}


@pytest.fixture
def wet_and_dry(flood_model):

    store_rain(SUNAMGANJ, 60.0)     # 180 mm in 3 days
    store_rain(DHAKA, 0.0)


# ==========================================
# NO MODEL YET
# ==========================================

def test_model_status_before_training(client, no_flood_model):

    body = client.get(f"{PREDICTIONS}/model").json()

    assert body["status"] == "not_trained"
    assert body["model"] is None
    assert "No flood model has been trained yet" in body["message"]


def test_no_predictions_without_a_model(client, no_flood_model):

    store_rain(SUNAMGANJ, 60.0)

    response = predict(client)

    # No invented numbers: without a trained model there is no prediction.
    assert response.status_code == 503
    assert "No flood model has been trained yet" in response.json()["detail"]


def test_model_needing_unknown_inputs_is_not_used(client, flood_model):

    write_test_model_meta(flood_model, feature_names=["rain_3d", "moon_phase"])

    assert client.get(f"{PREDICTIONS}/model").json()["status"] == "not_trained"
    assert predict(client).status_code == 503


# ==========================================
# PREDICTIONS
# ==========================================

def test_model_status_when_ready(client, flood_model):

    body = client.get(f"{PREDICTIONS}/model").json()

    assert body["status"] == "ready"
    assert body["model"]["model_version"] == "test-model-not-real"
    assert body["model"]["alert_thresholds"] == TEST_MODEL_THRESHOLDS


def test_predictions_for_all_districts(client, wet_and_dry):

    response = predict(client)

    assert response.status_code == 201

    body = response.json()

    assert body["target_date"] == "2022-06-18"
    assert body["model_version"] == "test-model-not-real"
    assert body["count"] == 64
    assert body["count_predicted"] == 2
    assert body["alert_thresholds"] == TEST_MODEL_THRESHOLDS
    assert "Sentinel-1" in body["what_is_predicted"]
    assert any("not an official flood warning" in text for text in body["limitations"])
    assert any("Copernicus" in text for text in body["attribution"])

    districts = by_pcode(body)

    wet = districts[SUNAMGANJ]
    assert wet["status"] == "predicted"
    assert wet["probability"] > 0.7
    assert wet["alert_level"] == "alert"
    assert wet["data_through"] == "2022-06-17"

    dry = districts[DHAKA]
    assert dry["status"] == "predicted"
    assert dry["probability"] < 0.3
    assert dry["alert_level"] == "none"


def test_prediction_shows_the_inputs_it_used(client, wet_and_dry):

    inputs = by_pcode(predict(client).json())[SUNAMGANJ]["features"]

    assert inputs["rain_1d"] == 60.0
    assert inputs["rain_3d"] == 180.0
    assert inputs["rain_30d"] == 1800.0
    assert inputs["month"] == 6
    # Real satellite pass before the target day: 16 June 2022, 17.97 % flooded.
    assert inputs["last_flooded_share"] == pytest.approx(0.1797)
    assert inputs["days_since_last_observation"] == 2
    # No river flow stored in this test: unknown, not zero.
    assert inputs["river_log_discharge"] is None


def test_unsupported_and_missing_districts_say_why(client, wet_and_dry):

    districts = by_pcode(predict(client).json())

    khulna = districts[KHULNA]
    assert khulna["status"] == "unsupported"
    assert khulna["probability"] is None
    assert khulna["alert_level"] is None
    assert "Satellites cannot observe" in khulna["reason"]

    sylhet = districts["BD6091"]              # supported, but no rain stored
    assert sylhet["status"] == "inputs_missing"
    assert sylhet["probability"] is None
    assert "not stored" in sylhet["reason"]


def test_rain_on_or_after_the_target_day_is_never_used(client, flood_model):

    # Dhaka: dry before the target day, 999 mm stored ON and AFTER it.
    store_rain(DHAKA, 0.0, extra_days_ahead=5)

    dhaka = by_pcode(predict(client).json())[DHAKA]

    assert dhaka["features"]["rain_1d"] == 0.0
    assert dhaka["features"]["rain_3d"] == 0.0
    assert dhaka["alert_level"] == "none"


def test_recent_rain_fills_the_days_era5_has_not_delivered(client, flood_model):

    # ERA5 is about 5 days late: it covers 31..7 days before the target day,
    # the GFS recent-days source covers the last 6.
    with MongoClient(TEST_MONGODB_URI) as mongo:
        mongo[TEST_DATABASE]["rain_daily"].insert_many([
            {
                "_id": f"district-{SUNAMGANJ}|{back}", "site_id": f"district-{SUNAMGANJ}",
                "date": datetime.combine(TARGET - timedelta(days=back), datetime.min.time(), tzinfo=timezone.utc),
                "precipitation_mm": 1.0, "missing": False,
            }
            for back in range(7, 32)
        ])
    store_recent_rain(SUNAMGANJ, 50.0, days_back=range(1, 7))

    district = by_pcode(predict(client).json())[SUNAMGANJ]

    assert district["status"] == "predicted"
    assert district["features"]["rain_3d"] == 150.0
    assert district["features"]["rain_30d"] == 6 * 50.0 + 24 * 1.0
    # The response says how many days came from the less exact recent source.
    assert district["recent_rain_days"] == 6


def test_era5_is_preferred_over_recent_rain(client, flood_model):

    store_rain(DHAKA, 0.0)                                    # ERA5: dry
    store_recent_rain(DHAKA, 99.0, days_back=range(1, 7))     # GFS for the same days

    district = by_pcode(predict(client).json())[DHAKA]

    assert district["features"]["rain_3d"] == 0.0
    assert district["recent_rain_days"] == 0


def test_no_rain_stored_at_all(client, flood_model):

    response = predict(client)

    assert response.status_code == 422
    assert "rain_history" in response.json()["detail"]


def test_incomplete_rain_is_not_enough(client, flood_model):

    store_rain(SUNAMGANJ, 60.0, days=20)        # only 20 of the 30 days

    assert predict(client).status_code == 422


def test_predictions_are_stored_and_replaced(client, wet_and_dry):

    first = predict(client).json()

    stored = client.get(PREDICTIONS, params={"target_date": "2022-06-18"})

    assert stored.status_code == 200
    assert by_pcode(stored.json())[SUNAMGANJ]["probability"] == by_pcode(first)[SUNAMGANJ]["probability"]

    predict(client)                               # again: replaces, never duplicates

    with MongoClient(TEST_MONGODB_URI) as mongo:
        assert mongo[TEST_DATABASE]["flood_predictions"].count_documents({}) == 64


def test_no_stored_predictions_returns_404(client, flood_model):

    assert client.get(PREDICTIONS, params={"target_date": "2022-06-18"}).status_code == 404


def test_invalid_requests_rejected(client, flood_model):

    assert client.post(PREDICTIONS, json={}).status_code == 422
    assert client.post(PREDICTIONS, json={"target_date": "tomorrow"}).status_code == 422
    assert client.get(PREDICTIONS).status_code == 422


def test_calibration_curve_is_applied():

    calibration = {"x": [0.0, 0.5, 1.0], "y": [0.0, 0.2, 0.9]}

    result = _calibrate(numpy.array([0.0, 0.25, 0.5, 0.75, 1.0]), calibration)

    assert result.tolist() == pytest.approx([0.0, 0.1, 0.2, 0.55, 0.9])
    # No calibration stored: the model's own value is used.
    assert _calibrate(numpy.array([0.4]), None).tolist() == [0.4]


def test_alert_levels_follow_the_thresholds():

    thresholds = {"watch": 0.3, "alert": 0.7}

    assert [_alert_level(p, thresholds) for p in (0.0, 0.29, 0.3, 0.69, 0.7, 1.0)] == [
        "none", "none", "watch", "watch", "alert", "alert"
    ]


# ==========================================
# ALERTS
# ==========================================

def add_asset(client, name, coordinates, asset_type="flood_shelter", occupancy=500):

    response = client.post("/api/v1/assets", json={
        "name": name,
        "asset_type": asset_type,
        "location": {"type": "Point", "coordinates": coordinates},
        "occupancy": occupancy,
    })

    assert response.status_code == 201

    return response.json()["id"]


def alerts(client, **params):

    return client.get(ALERTS, params={"target_date": "2022-06-18", **params})


def test_alert_lists_the_district_and_its_assets(client, wet_and_dry):

    shelter = add_asset(client, "Haor flood shelter", SUNAMGANJ_HAOR)
    add_asset(client, "Dhaka Medical College Hospital", [90.3976, 23.7258], "hospital", 2600)

    predict(client)

    response = alerts(client)

    assert response.status_code == 200

    body = response.json()

    assert body["count"] == 1
    assert body["districts_predicted"] == 2
    assert any("not an official flood warning" in text for text in body["limitations"])

    alert = body["alerts"][0]

    assert alert["alert_id"] == "BD6090|2022-06-18"
    assert alert["level"] == "alert"
    assert alert["district"] == {"pcode": "BD6090", "name": "Sunamganj", "division": "Sylhet"}
    assert alert["probability"] > 0.7
    assert alert["message"].startswith("Flood alert for Sunamganj district on 2022-06-18")
    assert "1 registered asset in this district" in alert["message"]

    at_risk = alert["assets_at_risk"]

    assert at_risk["total"] == {"assets": 1, "occupancy": 500, "replacement_value_bdt": 0}
    assert at_risk["with_observed_flooding"]["assets"] == 1
    assert [a["asset_id"] for a in at_risk["assets"]] == [shelter]     # not the Dhaka hospital
    assert at_risk["assets"][0]["flags"]["observed_flooding"] is True


def test_alert_for_a_district_without_assets(client, wet_and_dry):

    predict(client)

    alert = alerts(client).json()["alerts"][0]

    assert alert["assets_at_risk"]["total"]["assets"] == 0
    assert alert["assets_at_risk"]["assets"] == []
    assert "0 registered assets" in alert["message"]


def test_watch_level_and_minimum_level_filter(client, wet_and_dry, flood_model):

    dry_probability = by_pcode(predict(client).json())[DHAKA]["probability"]

    # Lower the watch threshold to just under Dhaka's probability and predict
    # again: Dhaka becomes a "watch", Sunamganj stays an "alert".
    write_test_model_meta(flood_model, alert_thresholds={"watch": dry_probability / 2, "alert": 0.7})
    predict(client)

    everything = alerts(client).json()

    assert [(a["district"]["name"], a["level"]) for a in everything["alerts"]] == [
        ("Sunamganj", "alert"),          # highest probability first
        ("Dhaka", "watch"),
    ]
    assert everything["alerts"][1]["message"].startswith("Flood watch for Dhaka district")

    only_alerts = alerts(client, min_level="alert").json()

    assert [a["district"]["name"] for a in only_alerts["alerts"]] == ["Sunamganj"]


def test_no_alerts_when_nothing_reaches_the_threshold(client, flood_model):

    store_rain(DHAKA, 0.0)
    predict(client)

    body = alerts(client).json()

    assert body["count"] == 0
    assert body["alerts"] == []
    assert body["districts_predicted"] == 1


def test_alerts_need_stored_predictions(client, flood_model):

    assert alerts(client).status_code == 404


def test_invalid_alert_requests_rejected(client, flood_model):

    assert client.get(ALERTS).status_code == 422
    assert alerts(client, min_level="panic").status_code == 422


def test_alert_message_never_claims_certainty():
    # A model cannot be 100 % sure; the wording stops at "more than 95%".
    from app.modules.alerts.service import _message

    prediction = {"name": "Sylhet", "target_date": "2022-06-18", "probability": 1.0}

    assert "a more than 95% probability" in _message("alert", prediction, 0)
    assert "100%" not in _message("alert", prediction, 0)

    prediction["probability"] = 0.6
    assert "a 60% probability" in _message("alert", prediction, 0)
