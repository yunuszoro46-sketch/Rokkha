"""Rebuild the saved sample in src/data from a running Rokkha backend.

The portal shows this sample only when it cannot reach the backend, and it
labels it "saved sample, not live". Every number in it must come from the
backend, so never edit the JSON files by hand: run this script instead.

Usage (backend running, from the Frontend folder):
    python scripts/build_snapshot.py
    python scripts/build_snapshot.py --api https://your-backend/api/v1

Uses only the Python standard library. It only reads from the backend.
"""
import argparse
import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "src" / "data"

# The three days the portal offers as scenario buttons.
SAMPLE_DATES = ["2022-06-18", "2024-08-22", "2023-04-10"]
# Satellite passes kept in the sample (the whole record would triple the page size).
SATELLITE_START, SATELLITE_END = "2022-04-01", "2024-11-30"
# The window the rain and river charts show.
HYDRO_START, HYDRO_END = "2022-06-10", "2022-06-25"
RIVER_SITES = ["surma-sunamganj"]


def get(api, path):
    with urllib.request.urlopen(api + path, timeout=120) as response:
        return json.load(response)


def write(name, content):
    path = DATA / name
    path.write_text(json.dumps(content, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {name}: {path.stat().st_size / 1024:.0f} KB")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://127.0.0.1:8000/api/v1")
    api = parser.parse_args().api.rstrip("/")
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    model = get(api, "/predictions/model")
    if model.get("status") != "ready":
        raise SystemExit("The backend has no trained model loaded; nothing was written.")

    # 1. Predictions and alerts for the scenario days, exactly as the backend returns them.
    old = json.loads((DATA / "benchmark_predictions.json").read_text(encoding="utf-8"))
    predictions, alerts, model_version = {}, {}, None
    for day in SAMPLE_DATES:
        try:
            answer = get(api, f"/predictions?target_date={day}")
        except urllib.error.HTTPError as error:
            raise SystemExit(f"No stored predictions for {day} (HTTP {error.code}). "
                             f"Create them first: POST /predictions {{\"target_date\": \"{day}\"}}")
        predictions[day] = answer["predictions"]
        model_version = answer["model_version"]
        alerts[day] = get(api, f"/alerts?target_date={day}&min_level=watch")["alerts"]
        print(f"{day}: {len(predictions[day])} districts, {len(alerts[day])} alerts")
    write("benchmark_predictions.json", {
        "generated_at": generated_at,
        "source": "Rokkha backend: GET /predictions and GET /alerts",
        "model_version": model_version,
        "centroids": old["centroids"],          # map label positions, not backend data
        "predictions": predictions,
        "alerts": alerts,
    })

    # 2. Flood history, district ranking and model facts.
    ranking = get(api, "/geospatial/flood/districts")["districts"]
    history = json.loads((DATA / "district_flood_history.json").read_text(encoding="utf-8"))
    by_pcode = {row["pcode"]: row for row in ranking}
    for district in history["districts"]:
        live = by_pcode[district["pcode"]]
        for key in ("events_observed", "events_flooded", "max_flooded_share", "rank"):
            if district.get(key) != live.get(key):
                raise SystemExit(f"district_flood_history.json disagrees with the backend for "
                                 f"{district['name']} ({key}). Copy Backend/data/flood/district_flood_history.json.")
        # Modelled hazard shares come from the backend's district rows (static values).
        for key in ("hazard_share_10yr", "hazard_share_100yr"):
            district[key] = live.get(key)
    (DATA / "district_flood_history.json").write_text(
        json.dumps(history, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("district_flood_history.json: agrees with the backend; hazard shares added")
    meta = json.loads((DATA / "flood_model_meta.json").read_text(encoding="utf-8"))
    if meta.get("model_version") != model_version:
        raise SystemExit("flood_model_meta.json is from another model. "
                         "Copy Backend/data/models/flood_model.meta.json.")
    print("flood_model_meta.json: same model as the backend")

    # 3. Satellite passes per district.
    satellite = {}
    for row in ranking:
        answer = get(api, f"/geospatial/flood/districts/{row['pcode']}/satellite-observations"
                          f"?start_date={SATELLITE_START}&end_date={SATELLITE_END}")
        satellite[row["pcode"]] = [
            {key: o[key] for key in ("date", "observed_share", "flooded_share", "advisory_share", "flooded")}
            for o in answer["observations"]
        ]
    write("satellite_observations.json", dict(sorted(satellite.items())))

    # 4. Rain per district and river flow for the chart window.
    def series(path, field):
        return [{"date": v["date"][:10], field: v[field], "missing": v["missing"]}
                for v in get(api, path)["values"]]
    window = f"&start_date={HYDRO_START}&end_date={HYDRO_END}"
    write("hydro_sample.json", {
        "generated_at": generated_at,
        "source": "Rokkha backend: GET /ingestion/rain and GET /ingestion/river",
        "start_date": HYDRO_START,
        "end_date": HYDRO_END,
        "rain": {row["pcode"]: series(f"/ingestion/rain?site_id=district-{row['pcode']}{window}", "precipitation_mm")
                 for row in sorted(ranking, key=lambda r: r["pcode"])},
        "river": {site: series(f"/ingestion/river?site_id={site}{window}", "discharge_m3s") for site in RIVER_SITES},
    })
    print("done:", generated_at)


if __name__ == "__main__":
    main()
