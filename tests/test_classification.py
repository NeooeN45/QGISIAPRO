# -*- coding: utf-8 -*-
"""Tests du module classification (QML discret raster, pur Python)."""
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import classification as cl  # noqa: E402


def test_list_schemes_has_at_least_three():
    ids = {s["id"] for s in cl.list_schemes()}
    assert {"ndvi_vegetation", "dnbr_severite", "pente_degres"}.issubset(ids)


def test_get_scheme_found_and_missing():
    assert cl.get_scheme("ndvi_vegetation") is not None
    assert cl.get_scheme("inconnu") is None


def test_build_discrete_pseudocolor_qml_ndvi():
    qml = cl.build_discrete_pseudocolor_qml("ndvi_vegetation", band=1)
    root = ET.fromstring(qml)
    renderer = root.find("pipe/rasterrenderer")
    assert renderer is not None
    assert renderer.get("type") == "singlebandpseudocolor"
    shader = renderer.find("rastershader/colorrampshader")
    assert shader.get("colorRampType") == "DISCRETE"
    items = shader.findall("item")
    assert len(items) >= 4


def test_build_discrete_pseudocolor_qml_unknown_raises():
    import pytest
    with pytest.raises(ValueError):
        cl.build_discrete_pseudocolor_qml("inconnu", band=1)


def test_all_schemes_generate_valid_xml():
    for scheme in cl.list_schemes():
        qml = cl.build_discrete_pseudocolor_qml(scheme["id"], band=1)
        root = ET.fromstring(qml)
        renderer = root.find("pipe/rasterrenderer")
        assert renderer is not None
        assert renderer.get("type") == "singlebandpseudocolor"
        items = renderer.findall("rastershader/colorrampshader/item")
        assert len(items) >= 2
        for item in items:
            color = item.get("color")
            assert color.startswith("#") and len(color) == 7
