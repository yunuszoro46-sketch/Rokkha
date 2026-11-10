from datetime import date, datetime, timedelta, timezone

import numpy
import xgboost

from app.modules.prediction.features import (
    FEATURE_NAMES,
    HISTORY_DAYS,
    as_row,
    build_features,
    has_required_inputs,
)
from app.modules.prediction.repository import (
    daily_values,
    find_predictions,
    get_labelled_passes,
    get_static,
    load_model,
    save_predictions,
)


WHAT_IS_PREDICTED = (
    "The probability that a Sentinel-1 satellite pass on the target day would observe "
    "flooding in the district (unusual water on at least 10 % of the land it can see; "
    "Copernicus GFM). Issued at 00:00 UTC of the target day with data through the day before."
)

PREDICTION_ATTRIBUTION = [
    "Flood labels: Contains modified Copernicus Emergency Management Service information "
    "(Global Flood Monitoring, GFM).",
    "Rain: ERA5 reanalysis (ECMWF, Copernicus C3S) via Open-Meteo.com, CC BY 4.0.",
    "River flow: GloFAS (Copernicus EMS) via Open-Meteo.com, CC BY 4.0.",
    "Modelled river-flood hazard: JRC GloFAS flood hazard maps v2.1.2, © European Union.",
]

PREDICTION_LIMITATIONS = [
    "A model estimate, not an official flood warning. Official flood forecasts and warnings "
    "for Bangladesh come from the Flood Forecasting and Warning Centre (FFWC, BWDB).",
    "The probability is the model's estimate of how often flooding is observed in similar "
    "situations; it is not a measure of how confident the model is.",
    "It describes a whole district, not a village, road or building.",
    "The model learned from satellite radar, which largely misses water between buildings: "
    "city waterlogging is not predicted.",
    "Eight districts cannot be predicted (hill districts, Sundarbans districts, Gazipur): "
    "satellites cannot observe floods there, so the model could not learn or be checked.",
    "Rain alone does not make a flood; the model also uses river flow, modelled hazard and "
    "recent satellite observations, and can still be wrong.",
]

UNSUPPORTED_REASON = (
    "Satellites cannot observe floods in this district (hills, forest or built-up land), "
    "so the model could not be trained or checked for it."
)

NOT_TRAINED_MESSAGE = (
    "No flood model has been trained yet. Predictions and alerts become available "
    "when a trained model is added to data/models/."
)


class ModelNotReady(Exception):
    pass


class InputsMissing(Exception):
    pass


def _ready_model() -> dict:

    model = load_model()

    if model is None:
        raise ModelNotReady(NOT_TRAINED_MESSAGE)

    unknown = [name for name in model["meta"]["feature_names"] if name not in FEATURE_NAMES]

    if unknown:
        raise ModelNotReady(
            f"The model file needs inputs this backend cannot build: {unknown}. "
            "Train the model again with the current code."
        )

    return model


def model_info() -> dict:

    try:
        model = _ready_model()

    except ModelNotReady as error:
        return {"status": "not_trained", "message": str(error), "model": None}

    return {
        "status": "ready",
        "message": "A trained model is loaded.",
        "model": model["meta"],
    }


def _calibrate(raw: numpy.ndarray, calibration: dict | None) -> numpy.ndarray:

    # Calibration turns the model's raw score into a probability that matches
    # how often floods really happened in the validation year. It is stored as
    # the points of a rising curve; numpy.interp reads values off that curve.
    if not calibration:
        return raw

    return numpy.interp(raw, calibration["x"], calibration["y"])


def _alert_level(probability: float, thresholds: dict) -> str:

    if probability >= thresholds["alert"]:
        return "alert"

    if probability >= thresholds["watch"]:
        return "watch"

    return "none"


async def create_predictions(target: date) -> dict:

    model = _ready_model()
    meta = model["meta"]
    names = meta["feature_names"]
    static = get_static()
    passes = get_labelled_passes()

    start = target - timedelta(days=HISTORY_DAYS)
    end = target - timedelta(days=1)

    rain_sites = [row["rain_site_id"] for row in static.values()]

    # ERA5 is the rain the model learned from, but it arrives about 5 days
    # late. Days it has not delivered yet are filled from the GFS recent-days
    # source (ingestion kind "rain_recent"); ERA5 always wins when both exist.
    rain = await daily_values("rain_daily", "precipitation_mm", rain_sites, start, end)
    recent = await daily_values("rain_recent_daily", "precipitation_mm", rain_sites, start, end)
    recent_days = {}

    for site_id in rain_sites:
        filled = {
            day: value for day, value in recent[site_id].items()
            if rain[site_id].get(day) is None and value is not None
        }
        rain[site_id].update(filled)
        recent_days[site_id] = len(filled)
    river = await daily_values(
        "river_discharge_daily", "discharge_m3s",
        sorted({row["river_site_id"] for row in static.values()}), start, end,
    )

    issued_at = datetime.now(timezone.utc).replace(microsecond=0)
    documents, rows = [], []

    for pcode, info in sorted(static.items()):

        document = {
            "_id": f"{pcode}|{target.isoformat()}",
            "pcode": pcode,
            "name": info["name"],
            "division": info["division"],
            "target_date": target.isoformat(),
            "status": "predicted",
            "probability": None,
            "alert_level": None,
            "reason": None,
            "features": None,
            "recent_rain_days": None,
            "data_through": end.isoformat(),
            "model_version": meta["model_version"],
            "issued_at": issued_at,
        }

        if not info["labelled"]:
            document.update(status="unsupported", reason=UNSUPPORTED_REASON)

        else:
            features = build_features(
                target, rain[info["rain_site_id"]], river[info["river_site_id"]],
                passes.get(pcode, []), info,
            )

            if has_required_inputs(features):
                document["features"] = {name: features[name] for name in names}
                document["recent_rain_days"] = recent_days[info["rain_site_id"]]
                rows.append((document, as_row(features, names)))
            else:
                document.update(
                    status="inputs_missing",
                    reason=f"Rain for the 30 days before {target.isoformat()} is not stored for this district.",
                )

        documents.append(document)

    if not rows:
        raise InputsMissing(
            f"No district has rain stored for {start.isoformat()} to {end.isoformat()}. "
            "Run a rain_history ingestion for those days first (POST /api/v1/ingestion/runs)."
        )

    matrix = xgboost.DMatrix(
        numpy.array([row for _, row in rows], dtype=float), feature_names=names
    )
    probabilities = _calibrate(model["booster"].predict(matrix), meta.get("calibration"))

    for (document, _), probability in zip(rows, probabilities):
        document["probability"] = round(float(probability), 4)
        document["alert_level"] = _alert_level(document["probability"], meta["alert_thresholds"])

    await save_predictions(documents)

    return _response(target.isoformat(), [{k: v for k, v in d.items() if k != "_id"} for d in documents], meta)


async def stored_predictions(target: date) -> dict | None:

    predictions = await find_predictions(target.isoformat())

    if not predictions:
        return None

    model = load_model()
    meta = model["meta"] if model else {}

    return _response(target.isoformat(), predictions, meta)


def _response(target_date: str, predictions: list[dict], meta: dict) -> dict:

    return {
        "target_date": target_date,
        "model_version": predictions[0]["model_version"],
        "issued_at": predictions[0]["issued_at"],
        "count": len(predictions),
        "count_predicted": sum(p["status"] == "predicted" for p in predictions),
        "predictions": predictions,
        "what_is_predicted": WHAT_IS_PREDICTED,
        "alert_thresholds": meta.get("alert_thresholds"),
        "attribution": PREDICTION_ATTRIBUTION,
        "limitations": PREDICTION_LIMITATIONS,
    }
