"""
Model inputs (features) for the flood model.

ONE function builds the inputs for a district and a target day. The training
table and the live prediction both call it, so the model always sees inputs
made the same way.

The no-leakage rule lives here: a prediction for day D may only use data dated
BEFORE D (issued at 00:00 UTC of D, with data through D-1). Whatever the
caller passes in, values dated D or later are ignored.
"""

import math
from datetime import date, timedelta
from typing import Iterable, Mapping

# Rain totals over the last N days before the target day.
RAIN_WINDOWS = (1, 3, 7, 14, 30)

# A satellite observation older than this says little about today.
RECENT_OBSERVATION_DAYS = 30

# Days of rain and river history needed before the target day.
HISTORY_DAYS = 31

FEATURE_NAMES = [
    # ERA5 rain at the district's rain site, mm
    "rain_1d",
    "rain_3d",
    "rain_7d",
    "rain_14d",
    "rain_30d",
    # GloFAS river flow at the nearest verified river site (modelled)
    "river_log_discharge",        # log10 of yesterday's flow, m3/s
    "river_change_3d",            # relative change over the last 3 days
    "river_vs_30d_mean",          # yesterday's flow / mean of the 30 days before
    "river_distance_km",          # how far that river site is
    # JRC modelled river-flood hazard: share of the district inside the zone
    "hazard_share_10yr",
    "hazard_share_100yr",
    # Copernicus GFM satellite passes before the target day
    "last_flooded_share",         # flooded share at the latest recent pass
    "days_since_last_observation",
    "max_flooded_share_14d",
    # Season
    "month",
]


def _values(series: Mapping[date, float | None], target: date, first_back: int, last_back: int):
    """Values for the days target-first_back .. target-last_back, or None if any is missing."""

    values = [series.get(target - timedelta(days=back)) for back in range(first_back, last_back - 1, -1)]

    return None if any(value is None for value in values) else values


def build_features(
    target: date,
    rain: Mapping[date, float | None],
    river: Mapping[date, float | None],
    observations: Iterable[tuple[date, float]],
    static: Mapping,
) -> dict[str, float | None]:
    """Inputs for one district and one target day. None = not available.

    rain          {day: mm} at the district's rain site
    river         {day: m3/s} at the district's river site
    observations  (day, flooded_share) of labelled satellite passes
    static        the district's row of data/ml/district_static.json
    """

    features: dict[str, float | None] = {}

    for days in RAIN_WINDOWS:
        values = _values(rain, target, days, 1)
        features[f"rain_{days}d"] = None if values is None else round(sum(values), 2)

    yesterday = river.get(target - timedelta(days=1))
    three_days_before = river.get(target - timedelta(days=4))
    month_before = _values(river, target, 31, 2)

    features["river_log_discharge"] = (
        round(math.log10(yesterday), 4) if yesterday is not None and yesterday > 0 else None
    )
    features["river_change_3d"] = (
        round((yesterday - three_days_before) / three_days_before, 4)
        if yesterday is not None and three_days_before else None
    )
    features["river_vs_30d_mean"] = (
        round(yesterday / (sum(month_before) / len(month_before)), 4)
        if yesterday is not None and month_before and sum(month_before) > 0 else None
    )
    features["river_distance_km"] = static["river_distance_km"]

    features["hazard_share_10yr"] = static["hazard_share_10yr"]
    features["hazard_share_100yr"] = static["hazard_share_100yr"]

    # Only passes strictly before the target day, and not too old.
    oldest = target - timedelta(days=RECENT_OBSERVATION_DAYS)
    recent = sorted((day, share) for day, share in observations if oldest <= day < target)

    if recent:
        last_day, last_share = recent[-1]
        two_weeks = [share for day, share in recent if day >= target - timedelta(days=14)]
        features["last_flooded_share"] = last_share
        features["days_since_last_observation"] = (target - last_day).days
        features["max_flooded_share_14d"] = max(two_weeks) if two_weeks else None
    else:
        features["last_flooded_share"] = None
        features["days_since_last_observation"] = None
        features["max_flooded_share_14d"] = None

    features["month"] = target.month

    return features


def has_required_inputs(features: Mapping[str, float | None]) -> bool:
    """Rain is required. River and satellite inputs may be missing (the model handles gaps)."""

    return all(features[f"rain_{days}d"] is not None for days in RAIN_WINDOWS)


def as_row(features: Mapping[str, float | None], names: list[str]) -> list[float]:
    """Values in the model's column order; missing values become NaN."""

    return [float("nan") if features[name] is None else float(features[name]) for name in names]
