"""
Build the training table for the flood model.

One row per district and labelled satellite pass (Copernicus GFM, April to
November 2016-2024): the label (flood observed or not) plus the model inputs,
made only from data dated BEFORE that day (see app/modules/prediction/features.py).

Inputs:
    data/labels/district_flood_observations.json   labels (scripts/build_gfm_labels.py)
    data/ml/district_static.json                   fixed district inputs (scripts/build_district_static.py)
    MongoDB rain_daily, river_discharge_daily      stored by the ingestion module
                                                   (the database named in Backend/.env)

Usage (from the Backend folder, after the 2016-2024 rain and river backfill):
    python scripts/build_training_table.py

Outputs:
    data/ml/training_table.csv
    data/ml/training_table.meta.json

The script only READS the database. Passes whose 30 days of rain are not stored
yet are left out and counted, so an unfinished backfill is visible, not hidden.
"""

import csv
import json
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from pymongo import MongoClient  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.modules.prediction.dataset import COLUMNS, SPLITS, build_rows  # noqa: E402
from app.modules.prediction.features import FEATURE_NAMES  # noqa: E402

DATA = BACKEND / "data"
TABLE = DATA / "ml" / "training_table.csv"
META = DATA / "ml" / "training_table.meta.json"


def read_series(database, collection, field):
    """{site_id: {day: value}} for every stored daily value."""

    series = defaultdict(dict)

    for document in database[collection].find({}, {"_id": 0, "site_id": 1, "date": 1, field: 1}):
        series[document["site_id"]][document["date"].date()] = document.get(field)

    return series


def main():
    labels = json.loads((DATA / "labels" / "district_flood_observations.json").read_text())
    static = {
        row["pcode"]: row
        for row in json.loads((DATA / "ml" / "district_static.json").read_text())["districts"]
    }

    with MongoClient(settings.MONGODB_URI, tz_aware=True) as client:
        database = client[settings.MONGODB_DATABASE]
        rain = read_series(database, "rain_daily", "precipitation_mm")
        river = read_series(database, "river_discharge_daily", "discharge_m3s")

    print(f"Read rain for {len(rain)} sites, river flow for {len(river)} sites")

    rows, dropped = build_rows(labels, static, rain, river)

    if not rows:
        sys.exit("No rows: no rain is stored for the labelled days. Run the rain_history backfill first.")

    rows.sort(key=lambda row: (row["date"], row["pcode"]))

    TABLE.parent.mkdir(parents=True, exist_ok=True)
    with TABLE.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        # Missing inputs are written as empty cells.
        writer.writerows({k: ("" if v is None else v) for k, v in row.items()} for row in rows)

    by_split = Counter(row["split"] for row in rows)
    floods = Counter(row["split"] for row in rows if row["label"])
    by_year = Counter(row["year"] for row in rows)
    missing = {name: sum(row[name] is None for row in rows) for name in FEATURE_NAMES}

    META.write_text(json.dumps({
        "generated_on": date.today().isoformat(),
        "rows": len(rows),
        "districts": len({row["pcode"] for row in rows}),
        "first_date": rows[0]["date"],
        "last_date": rows[-1]["date"],
        "label": "1 = flood observed (see label_rule), 0 = pass saw no flood",
        "label_rule": labels["label_rule"],
        "splits": {
            name: {"years": list(years), "rows": by_split[name], "floods": floods[name]}
            for name, years in SPLITS.items()
        },
        "rows_by_year": dict(sorted(by_year.items())),
        "dropped_for_missing_rain_by_year": dict(sorted(dropped.items())),
        "feature_names": FEATURE_NAMES,
        "missing_values_per_feature": missing,
        "no_leakage_rule": "inputs for day D use only data dated before D "
                           "(app/modules/prediction/features.py)",
        "sources": [
            "Labels: Copernicus Emergency Management Service, Global Flood Monitoring (GFM)",
            "Rain: ERA5 reanalysis (ECMWF, Copernicus C3S) via Open-Meteo, CC BY 4.0",
            "River flow: GloFAS (Copernicus EMS) via Open-Meteo, CC BY 4.0 (modelled)",
            "Hazard shares: JRC GloFAS flood hazard maps v2.1.2 (modelled)",
        ],
    }, indent=1))

    print(f"Wrote {TABLE.relative_to(BACKEND)}: {len(rows)} rows, {len({r['pcode'] for r in rows})} districts")
    for name in SPLITS:
        print(f"  {name:<10} {by_split[name]:>6} rows, {floods[name]:>4} floods")
    if dropped:
        print("  NOT included (rain not stored yet), passes per year:", dict(sorted(dropped.items())))


if __name__ == "__main__":
    main()
