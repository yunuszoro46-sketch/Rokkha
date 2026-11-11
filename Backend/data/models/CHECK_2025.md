# Flood model: check on 2025

Model `xgb-2026-11-11-60d30b1a`, checked 2026-11-11. Written by `scripts/check_flood_model.py`; do not edit by hand.

**These years were not used to train, tune, calibrate or choose thresholds.** The model and its thresholds are the delivered ones, unchanged. 2485 district-days, 83 observed floods (flood rate 0.033).

| | PR-AUC | ROC-AUC | Brier |
|---|---|---|---|
| **Model** | 0.569 | 0.941 | 0.020 |
| Baseline: same as the latest satellite pass | 0.499 | 0.898 | 0.027 |
| Baseline: usual rate for district and month | 0.213 | 0.784 | 0.030 |

| Rule | Floods caught | Floods missed | False alarms | Precision | Recall | F1 |
|---|---|---|---|---|---|---|
| Model, **watch** (probability ≥ 0.1818) | 54 | 29 | 68 | 0.443 | 0.651 | 0.527 |
| Model, **alert** (probability ≥ 0.375) | 38 | 45 | 13 | 0.745 | 0.458 | 0.567 |
| Baseline: latest pass flooded | 45 | 38 | 38 | 0.542 | 0.542 | 0.542 |
| Baseline: usual rate | 16 | 67 | 41 | 0.281 | 0.193 | 0.229 |

## Onset days

Days where the latest satellite pass saw no flood (or there was none): 2402 days, 38 floods. PR-AUC 0.174. At the watch level: 10 caught, 28 missed, 34 false alarms.

## Is the probability honest?

| Predicted probability | Days | Mean predicted | Flooded in reality |
|---|---|---|---|
| 0.00-0.02 | 2017 | 0.002 | 0.003 |
| 0.02-0.05 | 170 | 0.036 | 0.047 |
| 0.05-0.10 | 1 | 0.064 | 0.000 |
| 0.10-0.20 | 190 | 0.132 | 0.079 |
| 0.20-0.40 | 61 | 0.247 | 0.295 |
| 0.40-0.60 | 6 | 0.469 | 0.833 |
| 0.60-0.80 | 24 | 0.731 | 0.625 |
| 0.80-1.00 | 16 | 0.965 | 0.938 |

## Read with care

- One period only; another year can score differently.
- Satellite passes from April 2025 on come from newer GFM versions (v4.x) than the training years (v3.1.0).
- Rain is ERA5 here, as in training. Live predictions use GFS for the last 5 days.
