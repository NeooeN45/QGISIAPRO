# -*- coding: utf-8 -*-
"""Tests de la resolution d'assets STAC (pur, sans reseau)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import stac_assets as sa  # noqa: E402

ITEM = {"assets": {
    "red": {"href": "http://r.tif"},
    "nir": {"href": "http://n.tif"},
    "swir16": {"href": "http://s.tif"},
}}


def test_resolve_mapped_band():
    assert sa.resolve_asset_href(ITEM, "RED") == "http://r.tif"
    assert sa.resolve_asset_href(ITEM, "NIR") == "http://n.tif"
    assert sa.resolve_asset_href(ITEM, "SWIR") == "http://s.tif"


def test_resolve_missing_band():
    assert sa.resolve_asset_href(ITEM, "BLUE") is None
    assert sa.resolve_asset_href({}, "RED") is None
    assert sa.resolve_asset_href(ITEM, "") is None


def test_resolve_direct_key():
    assert sa.resolve_asset_href(ITEM, "red") == "http://r.tif"


def test_band_assets():
    out = sa.band_assets(ITEM, ["NIR", "RED", "BLUE"])
    assert out == {"NIR": "http://n.tif", "RED": "http://r.tif"}


def test_normalize_datetime_interval():
    assert sa.normalize_datetime("2024-01-01/2024-12-31") == \
        "2024-01-01T00:00:00Z/2024-12-31T23:59:59Z"


def test_normalize_datetime_single_and_passthrough():
    assert sa.normalize_datetime("2024-06-15") == "2024-06-15T00:00:00Z"
    assert sa.normalize_datetime("2024-06-15T10:00:00Z") == "2024-06-15T10:00:00Z"
    assert sa.normalize_datetime("") is None
    assert sa.normalize_datetime(None) is None


def test_normalize_datetime_open_ended():
    assert sa.normalize_datetime("2024-01-01/..") == "2024-01-01T00:00:00Z/.."
