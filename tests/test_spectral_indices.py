# -*- coding: utf-8 -*-
"""Tests du module spectral_indices (pur Python, sans QGIS)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import spectral_indices as si  # noqa: E402


def test_list_indices_contains_expected():
    ids = {i["id"] for i in si.list_indices()}
    assert {"ndvi", "ndwi", "ndbi", "nbr", "evi"}.issubset(ids)


def test_build_expression_ndvi():
    expr = si.build_expression("ndvi", {"NIR": "b8@1", "RED": "b4@1"})
    assert expr == "(b8@1 - b4@1) / (b8@1 + b4@1)"


def test_build_expression_unknown_raises():
    import pytest
    with pytest.raises(ValueError):
        si.build_expression("unknown", {"NIR": "b8@1"})


def test_build_expression_missing_band_raises():
    import pytest
    with pytest.raises(ValueError):
        si.build_expression("ndvi", {"RED": "b4@1"})


def test_list_indices_contains_new_ones():
    ids = {i["id"] for i in si.list_indices()}
    assert {"savi", "msavi2", "ndmi", "bsi"}.issubset(ids)


def test_build_expression_ndmi():
    expr = si.build_expression("ndmi", {"NIR": "b8@1", "SWIR": "b11@1"})
    assert expr == "(b8@1 - b11@1) / (b8@1 + b11@1)"


def test_sentinel2_band_map_has_five_keys():
    bm = si.sentinel2_band_map()
    assert set(bm.keys()) == {"BLUE", "GREEN", "RED", "NIR", "SWIR"}
