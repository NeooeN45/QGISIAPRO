# -*- coding: utf-8 -*-
"""Tests du module report_templates (gabarits de rapport markdown, pur Python)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import report_templates as rt  # noqa: E402


def test_list_templates_has_at_least_three():
    ids = {t["id"] for t in rt.list_templates()}
    assert {"diagnostic_vegetation", "diagnostic_risques", "diagnostic_urbanisme"}.issubset(ids)


def test_get_template_found_and_missing():
    assert rt.get_template("diagnostic_vegetation") is not None
    assert rt.get_template("inconnu") is None


def test_required_keys_non_empty():
    keys = rt.required_keys("diagnostic_vegetation")
    assert keys


def test_render_report_with_full_context_no_braces():
    ctx = {
        "commune": "Toulouse",
        "date": "2026-06-06",
        "ndvi_moyen": "0.42",
        "agent": "QGISIA",
    }
    out = rt.render_report("diagnostic_vegetation", ctx)
    assert "{" not in out, f"Placeholder non remplace dans:\n{out}"
    assert "Toulouse" in out
    assert "0.42" in out


def test_render_report_missing_key_shows_placeholder():
    out = rt.render_report("diagnostic_vegetation", {})
    assert "[?]" in out
