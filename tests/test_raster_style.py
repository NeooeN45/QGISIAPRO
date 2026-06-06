# -*- coding: utf-8 -*-
"""Tests du module raster_style (QML pseudocolor raster, pur Python)."""
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import raster_style as rs  # noqa: E402


def test_list_ramps_contains_expected():
    ids = set(rs.list_ramps())
    assert {"ndvi", "ndwi", "thermal", "greyscale"}.issubset(ids)


def test_build_pseudocolor_qml_ndvi():
    qml = rs.build_pseudocolor_qml("ndvi", -1.0, 1.0, band=1)
    root = ET.fromstring(qml)
    renderer = root.find("pipe/rasterrenderer")
    assert renderer is not None
    assert renderer.get("type") == "singlebandpseudocolor"
    assert renderer.get("band") == "1"
    items = renderer.findall("rastershader/colorrampshader/item")
    assert len(items) >= 3
    assert float(items[0].get("value")) == -1.0
    assert float(items[-1].get("value")) == 1.0


def test_build_pseudocolor_qml_different_band():
    qml = rs.build_pseudocolor_qml("ndwi", 0.0, 1.0, band=2)
    root = ET.fromstring(qml)
    assert root.find("pipe/rasterrenderer").get("band") == "2"


def test_build_pseudocolor_qml_unknown_raises():
    import pytest
    with pytest.raises(ValueError):
        rs.build_pseudocolor_qml("inconnu", 0, 1)


def test_list_ramps_contains_new_ones():
    ids = set(rs.list_ramps())
    assert {"ndmi", "savi", "rdylgn", "spectral"}.issubset(ids)


def test_build_pseudocolor_qml_spectral():
    qml = rs.build_pseudocolor_qml("spectral", 0.0, 1.0, band=1)
    root = ET.fromstring(qml)
    renderer = root.find("pipe/rasterrenderer")
    assert renderer is not None
    assert renderer.get("type") == "singlebandpseudocolor"
    items = renderer.findall("rastershader/colorrampshader/item")
    assert len(items) >= 5


def test_all_ramps_generate_valid_xml():
    for rid in rs.list_ramps():
        qml = rs.build_pseudocolor_qml(rid, 0.0, 1.0, band=1)
        root = ET.fromstring(qml)
        renderer = root.find("pipe/rasterrenderer")
        assert renderer is not None
        assert renderer.get("type") == "singlebandpseudocolor"
        items = renderer.findall("rastershader/colorrampshader/item")
        assert len(items) >= 2
        for item in items:
            color = item.get("color")
            assert color.startswith("#") and len(color) == 7
