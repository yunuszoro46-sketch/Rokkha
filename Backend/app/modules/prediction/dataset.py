"""
The training table: one row per district and labelled satellite pass, with the
label (flood observed or not) and the model inputs for that day.

Pure functions, so they can be tested without a database. The script
scripts/build_training_table.py feeds them with stored rain and river data.
"""

from collections import Counter
from datetime import date
from typing import Mapping

from app.modules.prediction.features import FEATURE_NAMES, build_features, has_required_inputs

# Split by time, whole years, so a monsoon season is never cut in two and the
# model is always tested on years it has never seen.
SPLITS = {
    "train": (2016, 2021),
    "validation": (2022, 2022),
    "test": (2023, 2024),
}

ID_COLUMNS = ["pcode", "name", "division", "date", "year", "split"]
LABEL_COLUMNS = ["label", "flooded_share", "observed_share", "advisory_share"]
COLUMNS = ID_COLUMNS + LABEL_COLUMNS + FEATURE_NAMES


def split_for(year: int) -> str | None:

    for name, (first, last) in SPLITS.items():
        if first <= year <= last:
            return name

    return None


def labelled_passes(rows: list[list], rule: Mapping) -> list[list]:
    """Rows of the labels file that carry a label (the pass saw enough of the district)."""

    return [row for row in rows if row[1] >= rule["min_observed_share"]]


def build_rows(
    labels: Mapping,
    static: Mapping[str, Mapping],
    rain_by_site: Mapping[str, Mapping[date, float | None]],
    river_by_site: Mapping[str, Mapping[date, float | None]],
) -> tuple[list[dict], Counter]:
    """Returns (table rows, how many passes were dropped per year for missing rain)."""

    rule = labels["label_rule"]
    table, dropped = [], Counter()

    for district in labels["districts"]:

        passes = labelled_passes(district["rows"], rule)

        if not passes:
            continue  # the satellite never saw half of this district

        info = static[district["pcode"]]
        rain = rain_by_site.get(info["rain_site_id"], {})
        river = river_by_site.get(info["river_site_id"], {})
        observations = [(date.fromisoformat(row[0]), row[2]) for row in passes]

        for day_text, observed_share, flooded_share, advisory_share in passes:

            day = date.fromisoformat(day_text)
            split = split_for(day.year)

            if split is None:
                continue

            # build_features ignores everything dated on or after `day`.
            features = build_features(day, rain, river, observations, info)

            if not has_required_inputs(features):
                dropped[day.year] += 1
                continue

            table.append({
                "pcode": district["pcode"],
                "name": district["name"],
                "division": district["division"],
                "date": day_text,
                "year": day.year,
                "split": split,
                "label": int(flooded_share >= rule["flooded_share_threshold"]),
                "flooded_share": flooded_share,
                "observed_share": observed_share,
                "advisory_share": advisory_share,
                **features,
            })

    return table, dropped
