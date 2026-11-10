"""
Train and evaluate the flood model, and write the files the API loads.

Input:   data/ml/training_table.csv   (scripts/build_training_table.py)
Outputs: data/models/flood_model.json        the XGBoost model
         data/models/flood_model.meta.json   description, test results, calibration, alert thresholds
         data/models/README.md               the evaluation report, readable by people

How the years are used (no year is used twice):
    train       2016-2021   the model learns from these
    validation  2022        choose settings, calibrate probabilities, choose alert thresholds
    test        2023-2024   touched ONCE, at the end, to measure the result

The model is compared with two simple baselines, measured the same way:
    persistence   "flooded if the latest satellite pass saw flooding"
    climatology   "the usual flood rate of this district in this month" (from the training years)

Extra checks:
    onset days    days where the latest pass saw NO flood: persistence cannot help there
    no satellite  the same model without the satellite inputs: what rain and river alone can do
    by place      hold out one whole division, train on the others, test it on 2023-2024

Offline script: needs requirements-dev.txt (scikit-learn).

Usage (from the Backend folder):
    python scripts/train_flood_model.py
"""

import csv
import hashlib
import json
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

import numpy as np
import xgboost
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from app.modules.prediction.features import FEATURE_NAMES  # noqa: E402

TABLE = BACKEND / "data" / "ml" / "training_table.csv"
MODEL_DIR = BACKEND / "data" / "models"

SATELLITE_FEATURES = ["last_flooded_share", "days_since_last_observation", "max_flooded_share_14d"]

# Settings tried; the one with the best validation PR-AUC is kept.
CANDIDATES = [
    {"max_depth": depth, "min_child_weight": weight}
    for depth in (2, 3, 4, 6)
    for weight in (1, 5, 20)
]

BASE_PARAMS = {
    "objective": "binary:logistic",
    "eval_metric": "aucpr",
    "eta": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "seed": 7,
    "nthread": 4,
}

MAX_ROUNDS = 1500
EARLY_STOPPING = 100

# A "watch" should catch most floods: the highest probability cut-off that
# still catches at least this share of the floods observed in the validation year.
WATCH_RECALL = 0.80

MIN_FLOODS_FOR_A_SCORE = 5


# ------------------------------------------------------------------
# Data
# ------------------------------------------------------------------

def load_table(path):
    with open(path, newline="") as handle:
        rows = list(csv.DictReader(handle))

    def column(name):
        return np.array([float(r[name]) if r[name] != "" else np.nan for r in rows])

    return {
        "X": np.column_stack([column(name) for name in FEATURE_NAMES]),
        "y": np.array([int(r["label"]) for r in rows]),
        "split": np.array([r["split"] for r in rows]),
        "pcode": np.array([r["pcode"] for r in rows]),
        "division": np.array([r["division"] for r in rows]),
        "month": np.array([int(r["date"][5:7]) for r in rows]),
        "year": np.array([int(r["year"]) for r in rows]),
        "rows": len(rows),
    }


def matrix(X, names, y=None):
    columns = [FEATURE_NAMES.index(name) for name in names]
    return xgboost.DMatrix(X[:, columns], label=y, feature_names=names)


# ------------------------------------------------------------------
# Measures
# ------------------------------------------------------------------

def decisions(y, flagged):
    """Counts and rates for a yes/no rule. flagged = the rule said "flood"."""
    hits = int(np.sum(flagged & (y == 1)))
    false_alarms = int(np.sum(flagged & (y == 0)))
    missed = int(np.sum(~flagged & (y == 1)))
    precision = hits / (hits + false_alarms) if hits + false_alarms else None
    recall = hits / (hits + missed) if hits + missed else None
    f1 = (2 * precision * recall / (precision + recall)) if precision and recall else None

    def rnd(value):
        return None if value is None else round(value, 3)

    return {
        "floods_caught": hits,
        "floods_missed": missed,
        "false_alarms": false_alarms,
        # precision: of the days flagged, how many really flooded
        "precision": rnd(precision),
        # recall: of the floods observed, how many were flagged
        "recall": rnd(recall),
        "f1": rnd(f1),
    }


def scores(y, probability):
    """Threshold-free measures. None when there are too few floods to measure."""
    floods = int(y.sum())
    result = {"rows": int(len(y)), "floods": floods, "flood_rate": round(floods / len(y), 4) if len(y) else None}

    if floods < MIN_FLOODS_FOR_A_SCORE or floods == len(y):
        return {**result, "pr_auc": None, "roc_auc": None, "brier": None}

    return {
        **result,
        # PR-AUC: how well floods are ranked above non-floods (1 = perfect;
        # a random guess scores about the flood rate).
        "pr_auc": round(float(average_precision_score(y, probability)), 3),
        "roc_auc": round(float(roc_auc_score(y, probability)), 3),
        # Brier: mean squared error of the probability (0 = perfect).
        "brier": round(float(brier_score_loss(y, probability)), 4),
    }


def reliability(y, probability, edges=(0, 0.02, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0001)):
    """Calibration table: among days given a probability in a bin, how often did it flood?"""
    table = []
    for low, high in zip(edges[:-1], edges[1:]):
        inside = (probability >= low) & (probability < high)
        if inside.sum():
            table.append({
                "bin": f"{low:.2f}-{min(high, 1):.2f}",
                "rows": int(inside.sum()),
                "mean_predicted": round(float(probability[inside].mean()), 3),
                "observed_rate": round(float(y[inside].mean()), 3),
            })
    return table


def best_f1_threshold(y, probability):
    best, best_f1 = 0.5, -1.0
    for threshold in np.unique(np.round(probability, 4)):
        f1 = decisions(y, probability >= threshold)["f1"] or 0.0
        if f1 > best_f1:
            best, best_f1 = float(threshold), f1
    return best


def recall_threshold(y, probability, wanted):
    """Highest cut-off that still catches at least `wanted` of the floods."""
    for threshold in sorted(np.unique(np.round(probability, 4)), reverse=True):
        if (decisions(y, probability >= threshold)["recall"] or 0) >= wanted:
            return float(threshold)
    return 0.0


def choose_thresholds(y, probability):
    alert = best_f1_threshold(y, probability)
    watch = min(recall_threshold(y, probability, WATCH_RECALL), alert)
    return {
        "watch": round(watch, 4),
        "alert": round(alert, 4),
        "chosen_on": "validation year 2022 (calibrated probabilities)",
        "alert_rule": "the cut-off with the best F1 (balance of caught floods and false alarms)",
        "watch_rule": f"the highest cut-off that still catches at least {WATCH_RECALL:.0%} of observed "
                      "floods, never above the alert cut-off",
    }


# ------------------------------------------------------------------
# Baselines
# ------------------------------------------------------------------

def persistence_score(X):
    """The flooded share at the latest satellite pass (0 when there was no recent pass)."""
    return np.nan_to_num(X[:, FEATURE_NAMES.index("last_flooded_share")], nan=0.0)


def climatology(train_pcode, train_month, train_y):
    """Usual flood rate per district and month, from the TRAINING years only."""
    totals, floods = defaultdict(int), defaultdict(int)
    for pcode, month, label in zip(train_pcode, train_month, train_y):
        totals[(pcode, int(month))] += 1
        floods[(pcode, int(month))] += int(label)
    overall = float(np.mean(train_y))

    def score(pcodes, months):
        return np.array([
            floods[(p, int(m))] / totals[(p, int(m))] if totals[(p, int(m))] else overall
            for p, m in zip(pcodes, months)
        ])

    return score


# ------------------------------------------------------------------
# Model
# ------------------------------------------------------------------

def fit(data, names, train, validation):
    """Try the candidate settings; keep the best by validation PR-AUC."""
    best = None
    for candidate in CANDIDATES:
        params = {**BASE_PARAMS, **candidate}
        booster = xgboost.train(
            params, matrix(data["X"][train], names, data["y"][train]), MAX_ROUNDS,
            evals=[(matrix(data["X"][validation], names, data["y"][validation]), "validation")],
            early_stopping_rounds=EARLY_STOPPING, verbose_eval=False,
        )
        if best is None or booster.best_score > best["score"]:
            best = {"booster": booster, "params": params, "score": booster.best_score,
                    "rounds": booster.best_iteration + 1}
    # Keep only the trees up to the best round.
    best["booster"] = best["booster"][: best["rounds"]]
    return best


def predict(booster, X, names):
    return booster.predict(matrix(X, names))


def calibration_curve(y, raw):
    """Isotonic calibration as the points of a rising curve (read with numpy.interp)."""
    isotonic = IsotonicRegression(y_min=0.0, y_max=1.0, out_of_bounds="clip").fit(raw, y)
    x = [0.0] + [float(v) for v in isotonic.X_thresholds_] + [1.0]
    yv = [float(isotonic.y_thresholds_[0])] + [float(v) for v in isotonic.y_thresholds_] + [float(isotonic.y_thresholds_[-1])]
    return {"method": "isotonic regression fitted on the validation year", "x": x, "y": yv}


def calibrate(raw, curve):
    return np.interp(raw, curve["x"], curve["y"])


def evaluate(y, probability, thresholds):
    return {
        **scores(y, probability),
        "at_watch": decisions(y, probability >= thresholds["watch"]),
        "at_alert": decisions(y, probability >= thresholds["alert"]),
    }


# ------------------------------------------------------------------
# Whole pipeline
# ------------------------------------------------------------------

def run(data):
    train = data["split"] == "train"
    validation = data["split"] == "validation"
    test = data["split"] == "test"

    for name, mask in (("train", train), ("validation", validation), ("test", test)):
        if data["y"][mask].sum() < MIN_FLOODS_FOR_A_SCORE:
            sys.exit(f"The {name} years have fewer than {MIN_FLOODS_FOR_A_SCORE} floods in the table. "
                     "Is the rain backfill complete? Rebuild the table with scripts/build_training_table.py.")

    X, y = data["X"], data["y"]

    # --- the model -------------------------------------------------
    model = fit(data, FEATURE_NAMES, train, validation)
    curve = calibration_curve(y[validation], predict(model["booster"], X[validation], FEATURE_NAMES))

    def probability(mask):
        return calibrate(predict(model["booster"], X[mask], FEATURE_NAMES), curve)

    thresholds = choose_thresholds(y[validation], probability(validation))
    p_test = probability(test)

    # --- baselines, measured the same way --------------------------
    usual = climatology(data["pcode"][train], data["month"][train], y[train])
    clim_validation = usual(data["pcode"][validation], data["month"][validation])
    clim_test = usual(data["pcode"][test], data["month"][test])
    clim_cut = best_f1_threshold(y[validation], clim_validation)

    label_cut = 0.10   # the label rule itself: at least 10 % flooded
    persistence = {
        **scores(y[test], persistence_score(X[test])),
        "rule": "flood if the latest satellite pass (within 30 days) saw at least 10 % flooded",
        "decision": decisions(y[test], persistence_score(X[test]) >= label_cut),
    }
    climatology_result = {
        **scores(y[test], clim_test),
        "rule": "usual flood rate of the district and month in 2016-2021; cut-off with the best F1 in 2022",
        "decision": decisions(y[test], clim_test >= clim_cut),
    }

    # --- onset days: the latest pass did NOT show a flood ----------
    onset = test & (persistence_score(X) < label_cut)
    p_onset = probability(onset)
    onset_result = {
        "meaning": "test days where the latest satellite pass saw no flood (or there was none): "
                   "persistence always says 'no flood' here, so it catches none of these floods",
        "model": evaluate(y[onset], p_onset, thresholds),
        "climatology": scores(y[onset], usual(data["pcode"][onset], data["month"][onset])),
    }

    # --- the same model without satellite inputs -------------------
    no_satellite_names = [n for n in FEATURE_NAMES if n not in SATELLITE_FEATURES]
    no_satellite = fit(data, no_satellite_names, train, validation)
    ns_curve = calibration_curve(y[validation], predict(no_satellite["booster"], X[validation], no_satellite_names))
    ns_validation = calibrate(predict(no_satellite["booster"], X[validation], no_satellite_names), ns_curve)
    ns_test = calibrate(predict(no_satellite["booster"], X[test], no_satellite_names), ns_curve)
    no_satellite_result = {
        "meaning": "trained without the three satellite inputs: what rain, river flow, hazard and month alone can do",
        "test": evaluate(y[test], ns_test, choose_thresholds(y[validation], ns_validation)),
    }

    # --- by place: hold out one division at a time ------------------
    by_place = {}
    pooled_y, pooled_p = [], []
    for division in sorted(set(data["division"])):
        inside = data["division"] == division
        held_out = test & inside
        if not held_out.any():
            continue
        booster = xgboost.train(model["params"], matrix(X[train & ~inside], FEATURE_NAMES, y[train & ~inside]),
                                model["rounds"])
        p = calibrate(predict(booster, X[held_out], FEATURE_NAMES), curve)
        by_place[division] = scores(y[held_out], p)
        pooled_y.append(y[held_out])
        pooled_p.append(p)
    by_place["all divisions pooled"] = scores(np.concatenate(pooled_y), np.concatenate(pooled_p))

    importance = model["booster"].get_score(importance_type="gain")
    total_gain = sum(importance.values()) or 1.0

    return {
        "booster": model["booster"],
        "meta": {
            "feature_names": FEATURE_NAMES,
            "settings": {**model["params"], "rounds": model["rounds"],
                         "chosen_by": "best validation PR-AUC among the candidates in the training script"},
            "calibration": curve,
            "alert_thresholds": thresholds,
            "rows": {name: {"rows": int(mask.sum()), "floods": int(y[mask].sum())}
                     for name, mask in (("train_2016_2021", train), ("validation_2022", validation),
                                        ("test_2023_2024", test))},
            "supported_pcodes": sorted(set(data["pcode"])),
            "test_results": {
                "model": {**evaluate(y[test], p_test, thresholds), "calibration_table": reliability(y[test], p_test)},
                "baseline_persistence": persistence,
                "baseline_climatology": climatology_result,
                "onset_days": onset_result,
                "without_satellite_inputs": no_satellite_result,
                "held_out_division": by_place,
            },
            "validation_results": evaluate(y[validation], probability(validation), thresholds),
            "input_importance": {name: round(importance.get(name, 0.0) / total_gain, 3) for name in FEATURE_NAMES},
        },
    }


# ------------------------------------------------------------------
# Output
# ------------------------------------------------------------------

def describe(meta, table_path):
    return {
        "model_version": f"xgb-{date.today().isoformat()}-{hashlib.sha256(Path(table_path).read_bytes()).hexdigest()[:8]}",
        "trained_on": date.today().isoformat(),
        "algorithm": f"XGBoost {xgboost.__version__} (gradient-boosted decision trees), binary:logistic",
        "what_is_predicted": "probability that a Sentinel-1 pass on the target day observes flooding in the "
                             "district (Copernicus GFM, unusual water on at least 10 % of the visible land)",
        "issue_time": "00:00 UTC of the target day, with data through the day before",
        "years": {"train": "2016-2021", "validation": "2022", "test": "2023-2024"},
        "training_table_sha256": hashlib.sha256(Path(table_path).read_bytes()).hexdigest(),
        **meta,
        "limitations": [
            "District-level estimate from 56 districts; 8 districts cannot be predicted.",
            "Labels come from satellite radar every few days: short floods and city waterlogging are missed.",
            "River flow is the GloFAS model at the nearest of 9 river sites, sometimes far away.",
            "Trained on rain from ERA5 reanalysis; live use needs a more recent rain source, which can differ.",
            "Test results describe 2023-2024; performance in other years can differ.",
        ],
    }


def fmt(value):
    return "–" if value is None else (f"{value:.3f}" if isinstance(value, float) else str(value))


def report(meta):
    t = meta["test_results"]
    m = t["model"]
    lines = [
        "# Flood model: evaluation report",
        "",
        f"Model `{meta['model_version']}`, trained {meta['trained_on']}. Written by `scripts/train_flood_model.py`; "
        "do not edit by hand.",
        "",
        f"**What it predicts:** {meta['what_is_predicted']}. Issued at {meta['issue_time']}.",
        "",
        "| Years | Rows | Floods | Used for |",
        "|---|---|---|---|",
        f"| 2016–2021 | {meta['rows']['train_2016_2021']['rows']} | {meta['rows']['train_2016_2021']['floods']} | training |",
        f"| 2022 | {meta['rows']['validation_2022']['rows']} | {meta['rows']['validation_2022']['floods']} | settings, calibration, alert thresholds |",
        f"| 2023–2024 | {meta['rows']['test_2023_2024']['rows']} | {meta['rows']['test_2023_2024']['floods']} | **the test below (never used before)** |",
        "",
        "## Test on 2023–2024",
        "",
        "PR-AUC: how well floods are ranked above non-floods (1 = perfect; random ≈ the flood rate, "
        f"{fmt(m['flood_rate'])}). Brier: error of the probability (0 = perfect).",
        "",
        "| | PR-AUC | ROC-AUC | Brier |",
        "|---|---|---|---|",
        f"| **Model** | {fmt(m['pr_auc'])} | {fmt(m['roc_auc'])} | {fmt(m['brier'])} |",
        f"| Baseline: same as the latest satellite pass | {fmt(t['baseline_persistence']['pr_auc'])} | {fmt(t['baseline_persistence']['roc_auc'])} | {fmt(t['baseline_persistence']['brier'])} |",
        f"| Baseline: usual rate for district and month | {fmt(t['baseline_climatology']['pr_auc'])} | {fmt(t['baseline_climatology']['roc_auc'])} | {fmt(t['baseline_climatology']['brier'])} |",
        f"| Model without satellite inputs | {fmt(t['without_satellite_inputs']['test']['pr_auc'])} | {fmt(t['without_satellite_inputs']['test']['roc_auc'])} | {fmt(t['without_satellite_inputs']['test']['brier'])} |",
        "",
        "Yes/no decisions (precision = of the days flagged, how many flooded; recall = of the floods, how many were flagged):",
        "",
        "| Rule | Floods caught | Floods missed | False alarms | Precision | Recall | F1 |",
        "|---|---|---|---|---|---|---|",
    ]

    def row(name, d):
        return (f"| {name} | {d['floods_caught']} | {d['floods_missed']} | {d['false_alarms']} | "
                f"{fmt(d['precision'])} | {fmt(d['recall'])} | {fmt(d['f1'])} |")

    th = meta["alert_thresholds"]
    lines += [
        row(f"Model, **watch** (probability ≥ {th['watch']})", m["at_watch"]),
        row(f"Model, **alert** (probability ≥ {th['alert']})", m["at_alert"]),
        row("Baseline: latest pass flooded", t["baseline_persistence"]["decision"]),
        row("Baseline: usual rate", t["baseline_climatology"]["decision"]),
        "",
        f"Thresholds: alert = {th['alert_rule']}; watch = {th['watch_rule']}. Chosen on {th['chosen_on']}.",
        "",
        "## Onset days",
        "",
        t["onset_days"]["meaning"] + ".",
        "",
        "| | Rows | Floods | PR-AUC | Caught at watch | Missed at watch | False alarms at watch |",
        "|---|---|---|---|---|---|---|",
        f"| Model | {t['onset_days']['model']['rows']} | {t['onset_days']['model']['floods']} | {fmt(t['onset_days']['model']['pr_auc'])} | "
        f"{t['onset_days']['model']['at_watch']['floods_caught']} | {t['onset_days']['model']['at_watch']['floods_missed']} | {t['onset_days']['model']['at_watch']['false_alarms']} |",
        f"| Baseline: usual rate | | | {fmt(t['onset_days']['climatology']['pr_auc'])} | | | |",
        "",
        "## Is the probability honest? (calibration, test years)",
        "",
        "| Predicted probability | Days | Mean predicted | Flooded in reality |",
        "|---|---|---|---|",
    ]
    lines += [f"| {b['bin']} | {b['rows']} | {b['mean_predicted']:.3f} | {b['observed_rate']:.3f} |" for b in m["calibration_table"]]
    lines += [
        "",
        "## Unseen places",
        "",
        "One division held out of training, then tested on its 2023–2024 days (new place **and** new years). "
        f"A score is given only with at least {MIN_FLOODS_FOR_A_SCORE} floods.",
        "",
        "| Division held out | Rows | Floods | PR-AUC | Brier |",
        "|---|---|---|---|---|",
    ]
    lines += [f"| {name} | {s['rows']} | {s['floods']} | {fmt(s['pr_auc'])} | {fmt(s['brier'])} |"
              for name, s in t["held_out_division"].items()]
    lines += [
        "",
        "## Which inputs the model relies on (share of total gain)",
        "",
        "| Input | Share |",
        "|---|---|",
    ]
    lines += [f"| `{name}` | {share:.3f} |" for name, share in sorted(meta["input_importance"].items(), key=lambda kv: -kv[1])]
    lines += ["", "## Limitations", ""] + [f"- {text}" for text in meta["limitations"]] + [""]
    return "\n".join(lines)


def main(table_path=TABLE, model_dir=MODEL_DIR):
    data = load_table(table_path)
    result = run(data)
    meta = describe(result["meta"], table_path)

    model_dir.mkdir(parents=True, exist_ok=True)
    result["booster"].save_model(model_dir / "flood_model.json")
    (model_dir / "flood_model.meta.json").write_text(json.dumps(meta, indent=1))
    (model_dir / "README.md").write_text(report(meta))

    t = meta["test_results"]
    print(f"Model {meta['model_version']}: {data['rows']} rows, settings {meta['settings']}")
    print(f"Test 2023-2024  PR-AUC  model {t['model']['pr_auc']}  persistence {t['baseline_persistence']['pr_auc']}  "
          f"climatology {t['baseline_climatology']['pr_auc']}  no-satellite {t['without_satellite_inputs']['test']['pr_auc']}")
    print(f"Thresholds watch {meta['alert_thresholds']['watch']} alert {meta['alert_thresholds']['alert']}")
    print(f"Wrote {model_dir}")
    return meta


if __name__ == "__main__":
    main()
