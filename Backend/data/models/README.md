# Flood model: evaluation report

Model `xgb-2026-11-11-60d30b1a`, trained 2026-11-11. Written by `scripts/train_flood_model.py`; do not edit by hand.

**What it predicts:** probability that a Sentinel-1 pass on the target day observes flooding in the district (Copernicus GFM, unusual water on at least 10 % of the visible land). Issued at 00:00 UTC of the target day, with data through the day before.

| Years | Rows | Floods | Used for |
|---|---|---|---|
| 2016–2021 | 13839 | 411 | training |
| 2022 | 2543 | 112 | settings, calibration, alert thresholds |
| 2023–2024 | 4783 | 109 | **the test below (never used before)** |

## Test on 2023–2024

PR-AUC: how well floods are ranked above non-floods (1 = perfect; random ≈ the flood rate, 0.023). Brier: error of the probability (0 = perfect).

| | PR-AUC | ROC-AUC | Brier |
|---|---|---|---|
| **Model** | 0.460 | 0.936 | 0.016 |
| Baseline: same as the latest satellite pass | 0.420 | 0.823 | 0.019 |
| Baseline: usual rate for district and month | 0.170 | 0.844 | 0.022 |
| Model without satellite inputs | 0.249 | 0.927 | 0.025 |

Yes/no decisions (precision = of the days flagged, how many flooded; recall = of the floods, how many were flagged):

| Rule | Floods caught | Floods missed | False alarms | Precision | Recall | F1 |
|---|---|---|---|---|---|---|
| Model, **watch** (probability ≥ 0.1818) | 68 | 41 | 127 | 0.349 | 0.624 | 0.447 |
| Model, **alert** (probability ≥ 0.375) | 46 | 63 | 31 | 0.597 | 0.422 | 0.495 |
| Baseline: latest pass flooded | 51 | 58 | 58 | 0.468 | 0.468 | 0.468 |
| Baseline: usual rate | 26 | 83 | 98 | 0.210 | 0.239 | 0.223 |

Thresholds: alert = the cut-off with the best F1 (balance of caught floods and false alarms); watch = the highest cut-off that still catches at least 80% of observed floods, never above the alert cut-off. Chosen on validation year 2022 (calibrated probabilities).

## Onset days

test days where the latest satellite pass saw no flood (or there was none): persistence always says 'no flood' here, so it catches none of these floods.

| | Rows | Floods | PR-AUC | Caught at watch | Missed at watch | False alarms at watch |
|---|---|---|---|---|---|---|
| Model | 4674 | 58 | 0.148 | 18 | 40 | 72 |
| Baseline: usual rate | | | 0.062 | | | |

## Is the probability honest? (calibration, test years)

| Predicted probability | Days | Mean predicted | Flooded in reality |
|---|---|---|---|
| 0.00-0.02 | 3937 | 0.002 | 0.003 |
| 0.02-0.05 | 334 | 0.036 | 0.024 |
| 0.10-0.20 | 352 | 0.134 | 0.074 |
| 0.20-0.40 | 92 | 0.241 | 0.174 |
| 0.60-0.80 | 47 | 0.744 | 0.617 |
| 0.80-1.00 | 21 | 0.945 | 0.810 |

## Unseen places

One division held out of training, then tested on its 2023–2024 days (new place **and** new years). A score is given only with at least 5 floods.

| Division held out | Rows | Floods | PR-AUC | Brier |
|---|---|---|---|---|
| Barishal | 375 | 16 | 0.123 | 0.046 |
| Chattogram | 552 | 14 | 0.404 | 0.019 |
| Dhaka | 886 | 12 | 0.429 | 0.010 |
| Khulna | 738 | 2 | – | – |
| Mymensingh | 283 | 8 | 0.458 | 0.020 |
| Rajshahi | 786 | 6 | 0.103 | 0.008 |
| Rangpur | 749 | 1 | – | – |
| Sylhet | 414 | 50 | 0.718 | 0.059 |
| all divisions pooled | 4783 | 109 | 0.451 | 0.016 |

## Which inputs the model relies on (share of total gain)

| Input | Share |
|---|---|
| `max_flooded_share_14d` | 0.351 |
| `last_flooded_share` | 0.215 |
| `rain_14d` | 0.060 |
| `rain_3d` | 0.057 |
| `month` | 0.045 |
| `river_log_discharge` | 0.037 |
| `river_distance_km` | 0.035 |
| `rain_1d` | 0.033 |
| `rain_7d` | 0.028 |
| `days_since_last_observation` | 0.028 |
| `river_change_3d` | 0.027 |
| `river_vs_30d_mean` | 0.024 |
| `hazard_share_100yr` | 0.024 |
| `hazard_share_10yr` | 0.022 |
| `rain_30d` | 0.015 |

## Limitations

- District-level estimate from 56 districts; 8 districts cannot be predicted.
- Labels come from satellite radar every few days: short floods and city waterlogging are missed.
- River flow is the GloFAS model at the nearest of 9 river sites, sometimes far away.
- Trained on rain from ERA5 reanalysis; live use needs a more recent rain source, which can differ.
- Test results describe 2023-2024; performance in other years can differ.
