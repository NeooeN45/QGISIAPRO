# -*- coding: utf-8 -*-
"""Tests du résolveur de chemins raster distants (pur, sans QGIS)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import raster_remote as rr  # noqa: E402


def test_https_cog_to_vsicurl():
    assert rr.to_gdal_remote_path("https://x.com/a.tif") == "/vsicurl/https://x.com/a.tif"


def test_http_to_vsicurl():
    assert rr.to_gdal_remote_path("http://x.com/a.tif") == "/vsicurl/http://x.com/a.tif"


def test_s3_to_vsis3():
    assert rr.to_gdal_remote_path("s3://bucket/key/a.tif") == "/vsis3/bucket/key/a.tif"


def test_local_path_unchanged():
    assert rr.to_gdal_remote_path("C:/data/a.tif") == "C:/data/a.tif"


def test_already_vsi_unchanged():
    assert rr.to_gdal_remote_path("/vsicurl/https://x.com/a.tif") == "/vsicurl/https://x.com/a.tif"


def test_empty():
    assert rr.to_gdal_remote_path("") == ""
    assert rr.to_gdal_remote_path(None) == ""
