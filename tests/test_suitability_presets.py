"""Tests pour suitability_presets.py — pur Python, zéro dépendance QGIS."""

import pytest

from QGISIA2.suitability_presets import get_preset, list_presets, total_weight


class TestListPresets:
    def test_at_least_three_presets(self) -> None:
        presets = list_presets()
        assert len(presets) >= 3


class TestGetPreset:
    def test_known_preset_returns_dict(self) -> None:
        preset = get_preset("panneaux_solaires")
        assert preset is not None
        assert "name" in preset
        assert "criteria" in preset

    def test_unknown_preset_returns_none(self) -> None:
        assert get_preset("inconnu") is None


class TestTotalWeight:
    def test_total_weight_positive_for_each_preset(self) -> None:
        for pid in list_presets():
            weight = total_weight(pid)
            assert weight > 0.0

    def test_total_weight_unknown_returns_zero(self) -> None:
        assert total_weight("inconnu") == 0.0

    def test_panneaux_solaires_weights_sum_to_one(self) -> None:
        assert total_weight("panneaux_solaires") == pytest.approx(1.0, abs=1e-6)
