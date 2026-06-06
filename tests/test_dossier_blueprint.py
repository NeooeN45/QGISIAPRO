# -*- coding: utf-8 -*-
"""Tests du module dossier_blueprint (pur Python, sans QGIS)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import dossier_blueprint as dbp  # noqa: E402

VALID_ACTIONS = {"addDataSource", "applySymbologyPreset"}


def test_list_dossiers_has_at_least_three():
    dossiers = dbp.list_dossiers()
    assert len(dossiers) >= 3
    assert all(set(d.keys()) == {"id", "name", "description", "steps"} for d in dossiers)


def test_expand_dossier_urbanisme_non_empty():
    steps = dbp.expand_dossier("urbanisme")
    assert steps
    for step in steps:
        assert step["action"] in VALID_ACTIONS


def test_expand_dossier_unknown_returns_empty():
    assert dbp.expand_dossier("inconnu") == []


def test_get_dossier_found_and_missing():
    assert dbp.get_dossier("urbanisme") is not None
    assert dbp.get_dossier("inconnu") is None


def test_validate_all_dossiers_has_no_errors():
    errors = []
    for d in dbp.load_dossiers():
        errors.extend(dbp.validate_dossier(d))
    assert errors == [], f"Erreurs de validation: {errors}"
