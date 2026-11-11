"""
Tests for the model inputs (app/modules/prediction/features.py) and the
training table (app/modules/prediction/dataset.py).

The most important rule tested here: inputs for day D use only data dated
BEFORE D. Otherwise the model would "predict" floods using information from
the future (leakage) and look far better in tests than it really is.

Pure functions: no database, no network.
"""

from datetime import date, timedelta

import pytest

from app.modules.prediction.dataset import COLUMNS, build_rows, split_for
from app.modules.prediction.features import (
    FEATURE_NAMES,
    as_row,
    build_features,
    has_required_inputs,
)


TARGET = date(2022, 6, 18)

STATIC = {
    "rain_site_id": "district-BD6090",
    "river_site_id": "surma-sunamganj",
    "river_distance_km": 20.8,
    "hazard_share_10yr": 0.6629,
    "hazard_share_100yr": 0.7752,
}


def days_before(target, count, value):
    """{day: value} for the `count` days before target."""

    return {target - timedelta(days=back): value for back in range(1, count + 1)}


def features(rain=None, river=None, observations=(), target=TARGET):

    return build_features(
        target,
        days_before(target, 31, 10.0) if rain is None else rain,
        days_before(target, 31, 1000.0) if river is None else river,
        observations,
        STATIC,
    )


# ==========================================
# RAIN
# ==========================================

def test_rain_totals_over_each_window():

    rain = days_before(TARGET, 31, 0.0)
    rain[TARGET - timedelta(days=1)] = 104.1     # yesterday
    rain[TARGET - timedelta(days=2)] = 74.9
    rain[TARGET - timedelta(days=5)] = 20.0

    result = features(rain=rain)

    assert result["rain_1d"] == 104.1
    assert result["rain_3d"] == 179.0
    assert result["rain_7d"] == 199.0
    assert result["rain_14d"] == 199.0
    assert result["rain_30d"] == 199.0


def test_rain_total_is_unknown_when_a_day_is_missing():

    rain = days_before(TARGET, 31, 10.0)
    del rain[TARGET - timedelta(days=10)]

    result = features(rain=rain)

    # Windows that do not reach the gap are fine; the others are unknown,
    # never a too-small total.
    assert result["rain_7d"] == 70.0
    assert result["rain_14d"] is None
    assert result["rain_30d"] is None
    assert has_required_inputs(result) is False


def test_complete_rain_is_enough_to_predict():

    assert has_required_inputs(features(river={}, observations=())) is True


# ==========================================
# RIVER
# ==========================================

def test_river_features():

    river = days_before(TARGET, 31, 1000.0)
    river[TARGET - timedelta(days=1)] = 2000.0    # doubled since 4 days ago

    result = features(river=river)

    assert result["river_log_discharge"] == pytest.approx(3.301, abs=0.001)
    assert result["river_change_3d"] == 1.0
    assert result["river_vs_30d_mean"] == 2.0
    assert result["river_distance_km"] == 20.8


def test_river_features_are_unknown_without_river_data():

    result = features(river={})

    assert result["river_log_discharge"] is None
    assert result["river_change_3d"] is None
    assert result["river_vs_30d_mean"] is None


# ==========================================
# SATELLITE OBSERVATIONS
# ==========================================

def test_latest_recent_observation_is_used():

    result = features(observations=[
        (date(2022, 5, 23), 0.5859),      # 26 days before: recent, but not the latest
        (date(2022, 6, 11), 0.1090),
        (date(2022, 6, 16), 0.1797),      # the latest before the target day
    ])

    assert result["last_flooded_share"] == 0.1797
    assert result["days_since_last_observation"] == 2
    assert result["max_flooded_share_14d"] == 0.1797


def test_old_observations_do_not_count():

    result = features(observations=[(TARGET - timedelta(days=31), 0.9)])

    assert result["last_flooded_share"] is None
    assert result["days_since_last_observation"] is None
    assert result["max_flooded_share_14d"] is None


def test_static_inputs_and_month():

    result = features()

    assert result["hazard_share_10yr"] == 0.6629
    assert result["hazard_share_100yr"] == 0.7752
    assert result["month"] == 6


# ==========================================
# NO LEAKAGE
# ==========================================

def test_data_from_the_target_day_or_later_is_ignored():

    rain = days_before(TARGET, 31, 10.0)
    river = days_before(TARGET, 31, 1000.0)
    observations = [(date(2022, 6, 16), 0.1797)]

    honest = build_features(TARGET, rain, river, observations, STATIC)

    # Add huge values on the target day and after it: nothing may change.
    for ahead in range(0, 10):
        rain[TARGET + timedelta(days=ahead)] = 999.0
        river[TARGET + timedelta(days=ahead)] = 99999.0
        observations.append((TARGET + timedelta(days=ahead), 1.0))

    assert build_features(TARGET, rain, river, observations, STATIC) == honest


def test_every_feature_is_built_and_ordered_for_the_model():

    result = features(river={})

    assert list(result) == FEATURE_NAMES

    row = as_row(result, FEATURE_NAMES)

    assert len(row) == len(FEATURE_NAMES)
    assert row[FEATURE_NAMES.index("rain_1d")] == 10.0
    # A missing input becomes NaN (NaN is the only value not equal to itself).
    river_value = row[FEATURE_NAMES.index("river_log_discharge")]
    assert river_value != river_value


# ==========================================
# TRAINING TABLE
# ==========================================

LABELS = {
    "label_rule": {"min_observed_share": 0.5, "flooded_share_threshold": 0.10},
    "districts": [
        {
            "pcode": "BD6090", "name": "Sunamganj", "division": "Sylhet",
            "rows": [
                ["2021-07-10", 0.90, 0.02, 0.1],     # train, no flood
                ["2022-06-16", 0.91, 0.18, 0.7],     # validation, flood
                ["2022-06-18", 0.30, 0.90, 0.8],     # saw too little: no label
                ["2023-07-01", 0.88, 0.10, None],    # test, exactly at the threshold
                ["2024-08-01", 0.88, 0.01, 0.2],     # test, but no rain stored
            ],
        },
        {
            "pcode": "BD4047", "name": "Khulna", "division": "Khulna",
            "rows": [["2022-06-16", 0.45, 0.50, 0.1]],   # never labelled
        },
    ],
}

TABLE_STATIC = {"BD6090": STATIC, "BD4047": {**STATIC, "rain_site_id": "district-BD4047"}}


def table(rain_days):

    rain = {}
    for day in rain_days:
        rain.update(days_before(date.fromisoformat(day), 31, 5.0))

    return build_rows(LABELS, TABLE_STATIC, {"district-BD6090": rain, "district-BD4047": rain}, {})


def test_years_are_split_by_time():

    assert [split_for(year) for year in (2016, 2021, 2022, 2023, 2024)] == [
        "train", "train", "validation", "test", "test"
    ]
    assert split_for(2015) is None
    assert split_for(2025) is None


def test_table_has_one_row_per_labelled_pass():

    rows, dropped = table(["2021-07-10", "2022-06-16", "2022-06-18", "2023-07-01"])

    assert [(r["date"], r["split"], r["label"]) for r in rows] == [
        ("2021-07-10", "train", 0),
        ("2022-06-16", "validation", 1),
        ("2023-07-01", "test", 1),
    ]
    assert all(r["pcode"] == "BD6090" for r in rows)       # Khulna is never labelled
    assert all(list(r) == COLUMNS for r in rows)
    assert dropped == {2024: 1}                            # counted, not hidden


def test_table_row_carries_inputs_from_before_the_pass():

    rows, _ = table(["2022-06-16"])
    row = rows[0]

    assert row["rain_3d"] == 15.0
    assert row["rain_30d"] == 150.0
    # No earlier labelled pass within 30 days of 2022-06-16 in this small example.
    assert row["last_flooded_share"] is None


def test_table_never_uses_the_label_day_itself_as_an_input():

    rows, _ = table(["2022-06-16", "2023-07-01"])

    for row in rows:
        # A pass can only be an input for LATER days. If the day's own flooded
        # share leaked in, last_flooded_share would equal flooded_share here.
        assert row["last_flooded_share"] is None


def test_other_years_can_be_put_in_a_table_under_another_name():
    # scripts/check_flood_model.py builds a table of years outside the training split.
    assert split_for(2025, {"check": (2025, 2026)}) == "check"
    assert split_for(2024, {"check": (2025, 2026)}) is None
