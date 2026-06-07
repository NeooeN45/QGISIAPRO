"""Tests pour study_plan.py — pur Python, zéro dépendance QGIS."""

import pytest

from QGISIA2.study_plan import build_plan, list_themes


class TestListThemes:
    def test_at_least_three_themes(self) -> None:
        themes = list_themes()
        assert len(themes) >= 3

    def test_expected_themes_present(self) -> None:
        themes = list_themes()
        assert "vegetation" in themes
        assert "urbanisme" in themes
        assert "risques" in themes


class TestBuildPlan:
    def test_starts_with_loading_and_ends_with_report(self) -> None:
        plan = build_plan("vegetation", {})
        assert len(plan) > 0
        assert plan[0]["action"] in {"add_basemap", "load_satellite"}
        assert plan[-1]["action"] == "report"

    def test_injects_context_into_all_steps(self) -> None:
        context = {"commune": "Lyon", "bbox": [1.0, 2.0, 3.0, 4.0]}
        plan = build_plan("urbanisme", context)
        for step in plan:
            assert step["params"]["commune"] == "Lyon"
            assert step["params"]["bbox"] == [1.0, 2.0, 3.0, 4.0]

    def test_unknown_theme_returns_empty(self) -> None:
        assert build_plan("inconnu", {}) == []

    def test_preserves_existing_params(self) -> None:
        plan = build_plan("vegetation", {"index": "custom"})
        compute_step = next(s for s in plan if s["action"] == "compute_index")
        # Le contexte écrase les clés existantes si collision
        assert compute_step["params"]["index"] == "custom"
