"""
Tests for scripts/train_flood_model.py: the measures, the baselines, the alert
thresholds, and the whole pipeline on a small MADE-UP table (rule: more than
150 mm of rain in 3 days = flood). The made-up table checks that the code is
right; it says nothing about real floods.

The script is an offline tool that needs scikit-learn (requirements-dev.txt),
so these tests are skipped when it is not installed.
"""

import csv
import importlib.util
import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pytest
from pymongo import MongoClient

pytest.importorskip("sklearn")

from app.modules.prediction import repository  # noqa: E402
from app.modules.prediction.dataset import COLUMNS, split_for  # noqa: E402
from app.modules.prediction.features import FEATURE_NAMES  # noqa: E402

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "train_flood_model.py"
spec = importlib.util.spec_from_file_location("train_flood_model", SCRIPT)
train = importlib.util.module_from_spec(spec)
spec.loader.exec_module(train)


# ==========================================
# MEASURES
# ==========================================

Y = np.array([1, 1, 1, 0, 0, 0, 0, 0])
P = np.array([0.9, 0.6, 0.2, 0.7, 0.1, 0.1, 0.0, 0.0])


def test_decisions_count_hits_misses_and_false_alarms():

    result = train.decisions(Y, P >= 0.5)

    assert result["floods_caught"] == 2
    assert result["floods_missed"] == 1
    assert result["false_alarms"] == 1
    assert result["precision"] == 0.667          # 2 of the 3 flagged days flooded
    assert result["recall"] == 0.667             # 2 of the 3 floods were flagged
    assert result["f1"] == 0.667


def test_decisions_when_nothing_is_flagged():

    result = train.decisions(Y, P >= 2)

    assert result["floods_caught"] == 0
    assert result["floods_missed"] == 3
    assert result["precision"] is None           # undefined, not 0
    assert result["recall"] == 0.0


def test_no_score_with_too_few_floods():

    result = train.scores(Y, P)                  # only 3 floods

    assert result["floods"] == 3
    assert result["pr_auc"] is None
    assert result["brier"] is None


def test_scores_for_a_perfect_and_a_useless_ranking():

    y = np.array([1] * 10 + [0] * 90)

    perfect = train.scores(y, y.astype(float))
    assert perfect["pr_auc"] == 1.0
    assert perfect["brier"] == 0.0

    constant = train.scores(y, np.full(100, 0.1))
    assert constant["pr_auc"] == 0.1             # no better than the flood rate
    assert constant["flood_rate"] == 0.1


def test_recall_threshold_is_the_highest_cut_off_that_catches_enough():

    # Floods at 0.9, 0.6, 0.2: catching 2 of 3 (67 %) needs a cut-off of 0.6,
    # catching all three needs 0.2.
    assert train.recall_threshold(Y, P, 0.66) == 0.6
    assert train.recall_threshold(Y, P, 1.0) == 0.2


def test_alert_and_watch_thresholds():

    y = np.array([1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0])
    p = np.array([0.9, 0.8, 0.7, 0.2, 0.1, 0.5, 0.4, 0.3, 0.25, 0.05, 0.0])

    thresholds = train.choose_thresholds(y, p)

    # Alert at 0.7: 3 floods caught, no false alarm (best F1, 0.75).
    assert thresholds["alert"] == 0.7
    # Watch at 0.2: the highest cut-off that catches 4 of the 5 floods (80 %),
    # at the price of 4 false alarms.
    assert thresholds["watch"] == 0.2


def test_watch_is_never_above_alert():

    thresholds = train.choose_thresholds(Y, P)

    # Here the best-F1 cut-off (0.2) already catches every flood.
    assert thresholds["alert"] == 0.2
    assert thresholds["watch"] == 0.2


def test_reliability_table_compares_predicted_and_observed():

    table = train.reliability(np.array([0, 0, 0, 1]), np.array([0.25, 0.25, 0.25, 0.25]))

    assert table == [{"bin": "0.20-0.40", "rows": 4, "mean_predicted": 0.25, "observed_rate": 0.25}]


# ==========================================
# BASELINES
# ==========================================

def test_climatology_uses_the_training_years_only():

    usual = train.climatology(
        np.array(["A", "A", "A", "A", "B"]), np.array([6, 6, 6, 7, 6]), np.array([1, 1, 0, 0, 0])
    )

    scores = usual(np.array(["A", "A", "B", "C"]), np.array([6, 7, 6, 6]))

    assert scores[0] == pytest.approx(2 / 3)     # district A in June: 2 floods of 3 passes
    assert scores[1] == 0.0
    assert scores[2] == 0.0
    assert scores[3] == pytest.approx(0.4)       # never seen: the overall rate (2 of 5)


def test_persistence_is_the_latest_flooded_share():

    X = np.full((3, len(FEATURE_NAMES)), np.nan)
    X[:2, FEATURE_NAMES.index("last_flooded_share")] = [0.3, 0.0]

    # No recent pass (NaN) counts as "no flood seen".
    assert train.persistence_score(X).tolist() == [0.3, 0.0, 0.0]


def test_calibration_curve_rises_and_is_read_by_the_api_method():

    raw = np.linspace(0, 1, 200)
    y = (raw > 0.5).astype(int)

    curve = train.calibration_curve(y, raw)

    assert curve["x"] == sorted(curve["x"])
    assert curve["y"] == sorted(curve["y"])
    assert train.calibrate(np.array([0.1, 0.9]), curve).tolist() == [0.0, 1.0]


# ==========================================
# WHOLE PIPELINE ON A MADE-UP TABLE
# ==========================================

DISTRICTS = [("BD6090", "Sunamganj", "Sylhet"), ("BD6091", "Sylhet", "Sylhet"),
             ("BD3026", "Dhaka", "Dhaka"), ("BD3056", "Manikganj", "Dhaka")]


@pytest.fixture(scope="module")
def trained(tmp_path_factory):

    folder = tmp_path_factory.mktemp("trained")
    random = np.random.default_rng(seed=3)
    rows = []

    for year in range(2016, 2025):
        for pcode, name, division in DISTRICTS:
            for step in range(60):
                day = date(year, 4, 1) + timedelta(days=4 * step)
                values = {feature: round(float(random.uniform(0, 1)), 4) for feature in FEATURE_NAMES}
                values["rain_3d"] = round(float(random.uniform(0, 300)), 1)
                values["month"] = day.month
                rows.append({
                    "pcode": pcode, "name": name, "division": division,
                    "date": day.isoformat(), "year": year, "split": split_for(year),
                    "label": int(values["rain_3d"] > 150),
                    "flooded_share": 0.0, "observed_share": 0.9, "advisory_share": 0.0,
                    **values,
                })

    table = folder / "table.csv"
    with table.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    meta = train.main(table, folder / "model")

    return folder / "model", meta


def test_pipeline_writes_model_description_and_report(trained):

    folder, meta = trained

    assert (folder / "flood_model.json").exists()
    assert json.loads((folder / "flood_model.meta.json").read_text()) == meta
    assert "## Test on 2023–2024" in (folder / "README.md").read_text()

    assert meta["feature_names"] == FEATURE_NAMES
    assert meta["years"] == {"train": "2016-2021", "validation": "2022", "test": "2023-2024"}
    assert meta["rows"]["train_2016_2021"]["rows"] == 6 * 4 * 60
    assert meta["rows"]["validation_2022"]["rows"] == 4 * 60
    assert meta["rows"]["test_2023_2024"]["rows"] == 2 * 4 * 60
    assert meta["supported_pcodes"] == sorted(p for p, _, _ in DISTRICTS)
    assert 0 <= meta["alert_thresholds"]["watch"] <= meta["alert_thresholds"]["alert"] <= 1


def test_pipeline_learns_the_made_up_rule_and_beats_the_baselines(trained):

    results = trained[1]["test_results"]

    # The rule is simple, so the model must find it on the unseen years ...
    assert results["model"]["pr_auc"] > 0.95
    assert results["model"]["at_alert"]["recall"] > 0.9
    assert results["model"]["at_alert"]["precision"] > 0.9
    # ... while the baselines cannot (the made-up floods ignore past passes and seasons).
    assert results["baseline_persistence"]["pr_auc"] < 0.7
    assert results["baseline_climatology"]["pr_auc"] < 0.7
    # rain_3d carries the rule, so it must be the input the model relies on.
    importance = trained[1]["input_importance"]
    assert max(importance, key=importance.get) == "rain_3d"
    # Works in a division it never trained on.
    assert results["held_out_division"]["Sylhet"]["pr_auc"] > 0.9
    assert results["held_out_division"]["all divisions pooled"]["rows"] == 2 * 4 * 60


def test_pipeline_refuses_an_unfinished_table(tmp_path):

    # Only training years (the backfill is not finished): no model is written.
    table = tmp_path / "table.csv"
    with table.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        for step in range(40):
            writer.writerow({
                "pcode": "BD6090", "name": "Sunamganj", "division": "Sylhet",
                "date": f"2016-06-{step % 28 + 1:02d}", "year": 2016, "split": "train",
                "label": step % 2, "flooded_share": 0, "observed_share": 0.9, "advisory_share": 0,
                **{feature: 1 for feature in FEATURE_NAMES},
            })

    with pytest.raises(SystemExit) as stopped:
        train.main(table, tmp_path / "model")

    assert "backfill" in str(stopped.value)
    assert not (tmp_path / "model").exists()


def test_api_predicts_with_the_trained_files(client, trained, monkeypatch):

    monkeypatch.setattr(repository, "MODEL_DIR", trained[0])

    status = client.get("/api/v1/predictions/model").json()

    assert status["status"] == "ready"
    assert status["model"]["model_version"] == trained[1]["model_version"]

    # 60 mm a day in Sunamganj (180 mm in 3 days), none in Dhaka.
    documents = []
    for pcode, mm in (("BD6090", 60.0), ("BD3026", 0.0)):
        for back in range(1, 32):
            day = date(2022, 6, 18) - timedelta(days=back)
            documents.append({
                "_id": f"district-{pcode}|{day}", "site_id": f"district-{pcode}",
                "date": datetime(day.year, day.month, day.day, tzinfo=timezone.utc),
                "precipitation_mm": mm, "missing": False,
            })
    with MongoClient(os.environ["MONGODB_URI"]) as mongo:
        mongo[os.environ["MONGODB_DATABASE"]]["rain_daily"].insert_many(documents)

    response = client.post("/api/v1/predictions", json={"target_date": "2022-06-18"})

    assert response.status_code == 201

    districts = {p["pcode"]: p for p in response.json()["predictions"]}

    assert districts["BD6090"]["alert_level"] == "alert"
    assert districts["BD6090"]["probability"] > 0.8
    assert districts["BD3026"]["alert_level"] == "none"
    assert districts["BD3026"]["probability"] < 0.2


# ==========================================
# CHECK ON LATER YEARS (scripts/check_flood_model.py)
# ==========================================

CHECK_SCRIPT = SCRIPT.parent / "check_flood_model.py"
check_spec = importlib.util.spec_from_file_location("check_flood_model", CHECK_SCRIPT)
checker = importlib.util.module_from_spec(check_spec)
check_spec.loader.exec_module(checker)


def test_check_measures_the_delivered_model_on_a_later_year(trained, tmp_path):

    model_dir, meta = trained
    random = np.random.default_rng(seed=11)
    rows = []

    for pcode, name, division in DISTRICTS:
        for step in range(60):
            day = date(2025, 4, 1) + timedelta(days=4 * step)
            values = {feature: round(float(random.uniform(0, 1)), 4) for feature in FEATURE_NAMES}
            values["rain_3d"] = round(float(random.uniform(0, 300)), 1)
            values["month"] = day.month
            rows.append({
                "pcode": pcode, "name": name, "division": division,
                "date": day.isoformat(), "year": 2025, "split": "check",
                "label": int(values["rain_3d"] > 150),
                "flooded_share": 0.0, "observed_share": 0.9, "advisory_share": 0.0,
                **values,
            })

    table = tmp_path / "check.csv"
    with table.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    result = checker.check(model_dir.parent / "table.csv", table, model_dir)
    floods = sum(row["label"] for row in rows)

    assert result["years"] == [2025]
    assert result["model_version"] == meta["model_version"]
    assert result["model"]["rows"] == len(rows)
    assert result["model"]["floods"] == floods
    # The made-up rule is easy: the model finds it again in the new year, the baselines cannot.
    assert result["model"]["pr_auc"] > 0.95
    assert result["model"]["pr_auc"] > result["persistence"]["pr_auc"]
    assert result["model"]["pr_auc"] > result["climatology"]["pr_auc"]
    alert = result["model"]["at_alert"]
    assert alert["floods_caught"] + alert["floods_missed"] == floods
    assert result["alert_thresholds"] == {k: meta["alert_thresholds"][k] for k in ("watch", "alert")}
    assert result["onset_days"]["rows"] <= len(rows)

    text = checker.report(result)
    assert "check on 2025" in text
    assert "not used to train, tune, calibrate or choose thresholds" in text
