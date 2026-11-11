"""
Check the delivered flood model on years it has never seen.

The test years 2023-2024 were used once, when the model was trained. Every
later change must be judged on other data. This script measures the delivered
model (data/models/), exactly as the API uses it, on later years, next to the
same two baselines as the training report. It changes nothing in the model.

Inputs:
    data/models/flood_model.json, flood_model.meta.json   the delivered model
    data/ml/training_table.csv                            for the "usual rate" baseline
    MongoDB rain_daily, river_discharge_daily             (read only; the database in Backend/.env)
    data/labels/district_flood_observations.json          satellite passes of the checked years

Usage (from the Backend folder, after rain and river history for those years
has been ingested):
    python scripts/check_flood_model.py --first-year 2025 --last-year 2025

Outputs:
    data/ml/check_table_2025.csv          the rows that were checked
    data/models/check_2025.json           the numbers
    data/models/CHECK_2025.md             the same, readable by people

Offline script: needs requirements-dev.txt (scikit-learn).
"""

import argparse
import csv
import importlib.util
import json
import sys
from datetime import date
from pathlib import Path

import numpy as np
import xgboost

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from app.modules.prediction.dataset import COLUMNS, build_rows  # noqa: E402
from app.modules.prediction.features import FEATURE_NAMES  # noqa: E402

DATA = BACKEND / "data"


def _script(name):
    spec = importlib.util.spec_from_file_location(name, BACKEND / "scripts" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# The measures and baselines are the training script's own functions, so the
# check and the training report are computed the same way.
train = _script("train_flood_model")

LABEL_CUT = 0.10   # the label rule: at least 10 % flooded


def build_check_table(first_year, last_year, path):
    """Rows for the checked years, built exactly like the training table."""

    from pymongo import MongoClient

    from app.core.config import settings

    table_script = _script("build_training_table")
    labels = json.loads((DATA / "labels" / "district_flood_observations.json").read_text())
    static = {row["pcode"]: row
              for row in json.loads((DATA / "ml" / "district_static.json").read_text())["districts"]}

    with MongoClient(settings.MONGODB_URI, tz_aware=True) as client:
        database = client[settings.MONGODB_DATABASE]
        rain = table_script.read_series(database, "rain_daily", "precipitation_mm")
        river = table_script.read_series(database, "river_discharge_daily", "discharge_m3s")

    rows, dropped = build_rows(labels, static, rain, river, splits={"check": (first_year, last_year)})

    if not rows:
        sys.exit(f"No rows for {first_year}-{last_year}: is rain stored for those years?")

    rows.sort(key=lambda row: (row["date"], row["pcode"]))

    with open(path, "w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows({k: ("" if v is None else v) for k, v in row.items()} for row in rows)

    return dict(sorted(dropped.items()))


def check(training_table, check_table, model_dir):
    """Measure the delivered model on the check table. Returns the numbers."""

    meta = json.loads((Path(model_dir) / "flood_model.meta.json").read_text())
    booster = xgboost.Booster()
    booster.load_model(Path(model_dir) / "flood_model.json")

    data = train.load_table(check_table)
    X, y = data["X"], data["y"]

    # Exactly what the API does: the model's raw score, then the stored calibration curve.
    raw = booster.predict(train.matrix(X, meta["feature_names"]))
    probability = np.interp(raw, meta["calibration"]["x"], meta["calibration"]["y"])
    thresholds = meta["alert_thresholds"]

    latest = train.persistence_score(X)
    onset = latest < LABEL_CUT

    # "Usual rate" baseline: learned from the training years, cut-off from the validation year.
    history = train.load_table(training_table)
    learn, validation = history["split"] == "train", history["split"] == "validation"
    usual = train.climatology(history["pcode"][learn], history["month"][learn], history["y"][learn])
    usual_cut = train.best_f1_threshold(
        history["y"][validation], usual(history["pcode"][validation], history["month"][validation]))
    usual_now = usual(data["pcode"], data["month"])

    return {
        "model_version": meta["model_version"],
        "checked_on": date.today().isoformat(),
        "years": sorted({int(year) for year in data["year"]}),
        "note": "These years were not used to train, tune, calibrate or choose thresholds.",
        "model": train.evaluate(y, probability, thresholds),
        "alert_thresholds": {"watch": thresholds["watch"], "alert": thresholds["alert"]},
        "persistence": {**train.scores(y, latest), "decision": train.decisions(y, latest >= LABEL_CUT)},
        "climatology": {**train.scores(y, usual_now), "decision": train.decisions(y, usual_now >= usual_cut)},
        "onset_days": {
            "meaning": "days where the latest satellite pass saw no flood (or there was none)",
            **train.scores(y[onset], probability[onset]),
            "at_watch": train.decisions(y[onset], probability[onset] >= thresholds["watch"]),
        },
        "reliability": train.reliability(y, probability),
    }


def report(result, dropped=None):

    f = train.fmt
    years = "–".join(str(year) for year in sorted({result["years"][0], result["years"][-1]}))
    model, persistence, usual, onset = (result[k] for k in ("model", "persistence", "climatology", "onset_days"))

    def row(name, d):
        return (f"| {name} | {d['floods_caught']} | {d['floods_missed']} | {d['false_alarms']} | "
                f"{f(d['precision'])} | {f(d['recall'])} | {f(d['f1'])} |")

    lines = [
        f"# Flood model: check on {years}",
        "",
        f"Model `{result['model_version']}`, checked {result['checked_on']}. Written by "
        "`scripts/check_flood_model.py`; do not edit by hand.",
        "",
        f"**These years were not used to train, tune, calibrate or choose thresholds.** The model and its "
        f"thresholds are the delivered ones, unchanged. {model['rows']} district-days, {model['floods']} "
        f"observed floods (flood rate {f(model['flood_rate'])}).",
        "",
        "| | PR-AUC | ROC-AUC | Brier |",
        "|---|---|---|---|",
        f"| **Model** | {f(model['pr_auc'])} | {f(model['roc_auc'])} | {f(model['brier'])} |",
        f"| Baseline: same as the latest satellite pass | {f(persistence['pr_auc'])} | {f(persistence['roc_auc'])} | {f(persistence['brier'])} |",
        f"| Baseline: usual rate for district and month | {f(usual['pr_auc'])} | {f(usual['roc_auc'])} | {f(usual['brier'])} |",
        "",
        "| Rule | Floods caught | Floods missed | False alarms | Precision | Recall | F1 |",
        "|---|---|---|---|---|---|---|",
        row(f"Model, **watch** (probability ≥ {result['alert_thresholds']['watch']})", model["at_watch"]),
        row(f"Model, **alert** (probability ≥ {result['alert_thresholds']['alert']})", model["at_alert"]),
        row("Baseline: latest pass flooded", persistence["decision"]),
        row("Baseline: usual rate", usual["decision"]),
        "",
        "## Onset days",
        "",
        f"Days where the latest satellite pass saw no flood (or there was none): {onset['rows']} days, "
        f"{onset['floods']} floods. PR-AUC {f(onset['pr_auc'])}. At the watch level: "
        f"{onset['at_watch']['floods_caught']} caught, {onset['at_watch']['floods_missed']} missed, "
        f"{onset['at_watch']['false_alarms']} false alarms.",
        "",
        "## Is the probability honest?",
        "",
        "| Predicted probability | Days | Mean predicted | Flooded in reality |",
        "|---|---|---|---|",
        *[f"| {b['bin']} | {b['rows']} | {f(b['mean_predicted'])} | {f(b['observed_rate'])} |"
          for b in result["reliability"]],
        "",
        "## Read with care",
        "",
        "- One period only; another year can score differently.",
        "- Satellite passes from April 2025 on come from newer GFM versions (v4.x) than the training years (v3.1.0).",
        "- Rain is ERA5 here, as in training. Live predictions use GFS for the last 5 days.",
    ]

    if dropped:
        lines.append(f"- Passes left out because 30 days of rain were not stored, per year: {dropped}.")

    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description="Check the delivered flood model on later years.")
    parser.add_argument("--first-year", type=int, required=True)
    parser.add_argument("--last-year", type=int, required=True)
    args = parser.parse_args()

    if args.first_year <= 2024:
        sys.exit("Years up to 2024 were used to build the model. Check later years only.")

    tag = str(args.first_year) if args.first_year == args.last_year else f"{args.first_year}_{args.last_year}"
    check_table = DATA / "ml" / f"check_table_{tag}.csv"

    dropped = build_check_table(args.first_year, args.last_year, check_table)
    result = check(DATA / "ml" / "training_table.csv", check_table, DATA / "models")
    result["dropped_for_missing_rain_by_year"] = dropped

    (DATA / "models" / f"check_{tag}.json").write_text(json.dumps(result, indent=1))
    (DATA / "models" / f"CHECK_{tag}.md").write_text(report(result, dropped))

    model, persistence, usual = result["model"], result["persistence"], result["climatology"]
    print(f"{tag}: {model['rows']} rows, {model['floods']} floods")
    print(f"PR-AUC  model {model['pr_auc']}  persistence {persistence['pr_auc']}  climatology {usual['pr_auc']}")
    print(f"Wrote data/models/CHECK_{tag}.md")


if __name__ == "__main__":
    main()
