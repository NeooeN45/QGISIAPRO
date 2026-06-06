# -*- coding: utf-8 -*-
"""Tests du module layout_specs (templates de mise en page, pur Python)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import layout_specs as ls  # noqa: E402


def test_list_templates_has_at_least_three():
    ids = {t["id"] for t in ls.list_templates()}
    assert {"a4_portrait_simple", "a4_paysage_pro", "a3_paysage_atlas"}.issubset(ids)


def test_page_dimensions_mm_a4_landscape():
    assert ls.page_dimensions_mm("A4", "landscape") == (297, 210)


def test_page_dimensions_mm_a4_portrait():
    assert ls.page_dimensions_mm("A4", "portrait") == (210, 297)


def test_page_dimensions_mm_a3_landscape():
    assert ls.page_dimensions_mm("A3", "landscape") == (420, 297)


def test_all_templates_validate_without_errors():
    for tmpl in ls.list_templates():
        errors = ls.validate_template(ls.get_template(tmpl["id"]))
        assert errors == [], f"Erreurs pour {tmpl['id']}: {errors}"


def test_each_template_has_map_element():
    for tmpl in ls.list_templates():
        full = ls.get_template(tmpl["id"])
        assert any(e.get("type") == "map" for e in full["elements"]), f"Pas d'element map dans {tmpl['id']}"


def test_get_template_unknown_returns_none():
    assert ls.get_template("inconnu") is None
