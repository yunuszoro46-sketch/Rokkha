from datetime import date

from app.modules.assets.service import exposure_report
from app.modules.prediction.service import (
    PREDICTION_ATTRIBUTION,
    PREDICTION_LIMITATIONS,
    WHAT_IS_PREDICTED,
    stored_predictions,
)


# Most serious first.
LEVELS = ["alert", "watch"]

ALERT_LIMITATIONS = [
    "Alerts are made from the model's district-level probability. They do not say that a "
    "particular asset will flood.",
    "Assets are listed because they are registered in the alerted district. Their flags "
    "show past observed flooding and modelled hazard at the asset's own location.",
    "Only assets registered in this system are listed.",
]


def _message(level: str, prediction: dict, asset_count: int) -> str:

    title = "Flood alert" if level == "alert" else "Flood watch"
    assets = "1 registered asset" if asset_count == 1 else f"{asset_count} registered assets"

    return (
        f"{title} for {prediction['name']} district on {prediction['target_date']}: "
        f"the model estimates a {prediction['probability']:.0%} probability of "
        f"satellite-observable flooding. {assets} in this district."
    )


async def alerts_for(target: date, min_level: str) -> dict | None:

    stored = await stored_predictions(target)

    if stored is None:
        return None

    # "watch" shows watches and alerts; "alert" shows only alerts.
    wanted = LEVELS[: LEVELS.index(min_level) + 1]

    flagged = sorted(
        (p for p in stored["predictions"] if p["alert_level"] in wanted),
        key=lambda p: -p["probability"],
    )

    alerts = []

    for prediction in flagged:

        # The same exposure analysis as GET /assets/exposure, for this district.
        report = await exposure_report(district_pcode=prediction["pcode"])
        summary = report["summary"]

        alerts.append({
            "alert_id": f"{prediction['pcode']}|{prediction['target_date']}",
            "level": prediction["alert_level"],
            "district": {
                "pcode": prediction["pcode"],
                "name": prediction["name"],
                "division": prediction["division"],
            },
            "target_date": prediction["target_date"],
            "probability": prediction["probability"],
            "message": _message(prediction["alert_level"], prediction, summary["total"]["assets"]),
            "assets_at_risk": {
                "total": summary["total"],
                "with_observed_flooding": summary["with_observed_flooding"],
                "with_modelled_hazard_10yr": summary["with_modelled_hazard_10yr"],
                "assets": [
                    {
                        "asset_id": e["asset_id"],
                        "name": e["name"],
                        "asset_type": e["asset_type"],
                        "criticality": e["criticality"],
                        "occupancy": e["occupancy"],
                        "flags": e["flags"],
                    }
                    for e in report["assets"]
                ],
            },
            "issued_at": prediction["issued_at"],
            "model_version": prediction["model_version"],
        })

    return {
        "target_date": stored["target_date"],
        "model_version": stored["model_version"],
        "min_level": min_level,
        "count": len(alerts),
        "alerts": alerts,
        "districts_predicted": stored["count_predicted"],
        "alert_thresholds": stored["alert_thresholds"],
        "what_is_predicted": WHAT_IS_PREDICTED,
        "attribution": PREDICTION_ATTRIBUTION,
        "limitations": PREDICTION_LIMITATIONS + ALERT_LIMITATIONS,
    }
