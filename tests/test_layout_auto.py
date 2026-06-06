# -*- coding: utf-8 -*-
"""Tests de l'auto-selection de mise en page (pur, sans QGIS)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import layout_auto as la  # noqa: E402


def test_layout_meta_from_template():
    tmpl = {"elements": [{"type": "map"}, {"type": "title"}, {"type": "legend"}]}
    meta = la.layout_meta_from_template(tmpl)
    assert meta["title"] is True
    assert isinstance(meta["map"], dict) and meta["map"]["extent"]
    assert meta["legend"] is True
    assert meta["scalebar"] is False and meta["north"] is False


def test_layout_meta_no_map():
    assert la.layout_meta_from_template({"elements": [{"type": "title"}]})["map"] is None


def test_pick_best_template():
    best = la.pick_best_template()
    assert best["template"] is not None
    assert 0.0 <= best["score"] <= 1.0
