# -*- coding: utf-8 -*-
"""Tests du module atlas_specs (atlas multi-pages, pur Python)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import atlas_specs as ats  # noqa: E402


def test_list_atlas_has_at_least_two():
    ids = {a["id"] for a in ats.list_atlas()}
    assert {"communes_atlas", "parcelles_atlas"}.issubset(ids)


def test_get_atlas_found_and_missing():
    assert ats.get_atlas("communes_atlas") is not None
    assert ats.get_atlas("inconnu") is None


def test_all_atlas_validate_without_errors():
    for atlas in ats.list_atlas():
        full = ats.get_atlas(atlas["id"])
        errors = ats.validate_atlas(full)
        assert errors == [], f"Erreurs pour {atlas['id']}: {errors}"
