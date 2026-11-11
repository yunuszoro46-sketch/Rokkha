"""
Tests for the counting rules of scripts/build_gfm_labels.py (Copernicus GFM
satellite flood observations per district).

The script is an offline tool that needs rasterio (requirements-dev.txt), so
these tests are skipped when rasterio is not installed.

Small hand-made rasters, values as in the GFM Product User Manual:
flood 0/1, exclusion 0/1, advisory 0-3, 255 = not covered by the pass.
"""

import importlib.util
from pathlib import Path

import numpy as np
import pytest

pytest.importorskip("rasterio")

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "build_gfm_labels.py"
spec = importlib.util.spec_from_file_location("build_gfm_labels", SCRIPT)
gfm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gfm)

N = gfm.NO_DATA

# Two districts: 1 (left half) and 2 (right half); 0 = outside (sea, India).
LABELS = np.array([
    [1, 1, 2, 2],
    [1, 1, 2, 2],
    [0, 0, 0, 0],
])


def counts(flood, exclusion, advisory):
    return [c.tolist() for c in gfm.pass_counts(
        LABELS, np.array(flood), np.array(exclusion), np.array(advisory), 2)]


def test_flood_pixels_are_counted_per_district():

    observed, flooded, flagged = counts(
        flood=[[1, 0, 0, 0],
               [1, 1, 0, 1],
               [1, 1, 1, 1]],      # outside every district: ignored
        exclusion=[[0] * 4] * 3,
        advisory=[[0] * 4] * 3,
    )

    assert observed == [4, 4]
    assert flooded == [3, 1]
    assert flagged == [0, 0]


def test_pixels_not_covered_by_the_pass_are_not_observed():

    observed, flooded, _ = counts(
        flood=[[N, N, 1, 0],
               [N, 1, 0, 0],
               [0, 0, 0, 0]],
        exclusion=[[N, N, 0, 0],
                   [N, 0, 0, 0],
                   [0, 0, 0, 0]],
        advisory=[[0] * 4] * 3,
    )

    # Not covered means "no data", never "dry".
    assert observed == [1, 4]
    assert flooded == [1, 1]


def test_excluded_pixels_are_not_observed():

    observed, flooded, _ = counts(
        flood=[[0, 0, 0, 0],
               [0, 0, 0, 0],
               [0, 0, 0, 0]],
        exclusion=[[1, 1, 0, 0],   # e.g. a city: radar cannot map floods there
                   [1, 0, 0, 0],
                   [0, 0, 0, 0]],
        advisory=[[0] * 4] * 3,
    )

    assert observed == [1, 4]
    assert flooded == [0, 0]


def test_advisory_flags_are_counted_but_do_not_remove_pixels():

    observed, flooded, flagged = counts(
        flood=[[1, 0, 0, 0],
               [0, 0, 0, 0],
               [0, 0, 0, 0]],
        exclusion=[[0] * 4] * 3,
        advisory=[[1, 2, 3, 0],
                  [0, 0, 0, N],
                  [3, 3, 3, 3]],
    )

    assert observed == [4, 4]
    assert flooded == [1, 0]
    assert flagged == [2, 1]


def test_land_counts():

    assert gfm.land_counts(LABELS, 2).tolist() == [4, 4]


def test_shares():

    assert gfm.shares(land=200, observed=100, flooded=25, flagged=10) == (0.5, 0.25, 0.1)


def test_shares_when_nothing_was_observed():

    # No observation: the flooded share is unknown (None), not 0.
    assert gfm.shares(land=200, observed=0, flooded=0, flagged=0) == (0.0, None, None)


def test_months_between_crosses_a_year():

    assert list(gfm.months_between((2022, 11), (2023, 2))) == [
        (2022, 11), (2022, 12), (2023, 1), (2023, 2)
    ]


def test_advisory_share_uses_only_pixels_with_known_flags():

    # 100 observed pixels, but the advisory file exists for only 40 of them
    # (missing archive file): 10 flagged of 40 known = 0.25, not 10 of 100.
    assert gfm.shares(land=200, observed=100, flooded=30, flagged=10, advisory_known=40) == (0.5, 0.3, 0.25)


def test_advisory_share_unknown_when_no_flags_exist():

    assert gfm.shares(land=200, observed=100, flooded=30, flagged=0, advisory_known=0) == (0.5, 0.3, None)


# ------------------------------------------------------------------
# A month fetched before it was over must be fetched again
# ------------------------------------------------------------------

def test_month_fetched_while_running_is_not_final():
    assert not gfm.month_is_final("2026-11", "2026-11-11T05:00:00+00:00")


def test_month_fetched_just_after_its_end_is_not_final():
    # Late passes can still arrive for a few days.
    assert not gfm.month_is_final("2026-10", "2026-11-02T00:00:00+00:00")


def test_month_fetched_well_after_its_end_is_final():
    assert gfm.month_is_final("2026-10", "2026-11-05T00:00:00+00:00")
    assert gfm.month_is_final("2022-07", "2026-11-09T12:00:00+00:00")
    assert gfm.month_is_final("2024-12", "2025-01-10T00:00:00+00:00")
