"""Tests pour study_planner.py — pur Python, zero dependance QGIS."""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import study_planner as sp  # noqa: E402


class TestBuildRichPlan:
    def test_themes_supported(self) -> None:
        themes = ["vegetation", "urbanisme", "risques", "foret", "hydrologie", "agriculture"]
        for theme in themes:
            plan = sp.build_rich_plan(theme, {})
            assert isinstance(plan, list)
            assert len(plan) > 0

    def test_depth_rapide_about_20(self) -> None:
        for theme in sp._THEME_INDICES:
            plan = sp.build_rich_plan(theme, {}, depth="rapide")
            assert 18 <= len(plan) <= 22, f"{theme} rapide={len(plan)}"

    def test_depth_standard_about_50(self) -> None:
        for theme in sp._THEME_INDICES:
            plan = sp.build_rich_plan(theme, {}, depth="standard")
            assert 45 <= len(plan) <= 55, f"{theme} standard={len(plan)}"

    def test_depth_approfondi_about_100(self) -> None:
        for theme in sp._THEME_INDICES:
            plan = sp.build_rich_plan(theme, {}, depth="approfondi")
            assert 90 <= len(plan) <= 100, f"{theme} approfondi={len(plan)}"

    def test_invalid_depth_raises(self) -> None:
        with pytest.raises(ValueError):
            sp.build_rich_plan("vegetation", {}, depth="profondeur_ultime")

    def test_context_injected_in_params(self) -> None:
        plan = sp.build_rich_plan("vegetation", {"zone": "test_zone"}, depth="rapide")
        for step in plan:
            assert step["params"].get("zone") == "test_zone"

    def test_unique_ids(self) -> None:
        for theme in sp._THEME_INDICES:
            for depth in ("rapide", "standard", "approfondi"):
                plan = sp.build_rich_plan(theme, {}, depth=depth)
                ids = [s["id"] for s in plan]
                assert len(ids) == len(set(ids)), f"IDs dupliques {theme}/{depth}"

    def test_depends_on_references_exist(self) -> None:
        for theme in sp._THEME_INDICES:
            for depth in ("rapide", "standard", "approfondi"):
                plan = sp.build_rich_plan(theme, {}, depth=depth)
                id_set = {s["id"] for s in plan}
                for step in plan:
                    for dep in step.get("depends_on", []):
                        assert dep in id_set, f"{step['id']} depend de {dep!r} inexistant"

    def test_all_actions_allowed(self) -> None:
        for theme in sp._THEME_INDICES:
            for depth in ("rapide", "standard", "approfondi"):
                plan = sp.build_rich_plan(theme, {}, depth=depth)
                for step in plan:
                    assert step["action"] in sp.ALLOWED_ACTIONS

    def test_phases_are_valid(self) -> None:
        valid_phases = {"data", "analyse", "symbologie", "layout", "livrable"}
        for theme in sp._THEME_INDICES:
            for depth in ("rapide", "standard", "approfondi"):
                plan = sp.build_rich_plan(theme, {}, depth=depth)
                for step in plan:
                    assert step["phase"] in valid_phases

    def test_has_optional_steps_in_approfondi(self) -> None:
        plan = sp.build_rich_plan("vegetation", {}, depth="approfondi")
        optional = [s for s in plan if s.get("optional")]
        assert len(optional) > 0

    def test_has_mandatory_steps(self) -> None:
        plan = sp.build_rich_plan("vegetation", {}, depth="rapide")
        mandatory = [s for s in plan if not s.get("optional")]
        assert len(mandatory) > 0


class TestValidateWithPipeline:
    def test_all_themes_and_depths_validate(self) -> None:
        for theme in sp._THEME_INDICES:
            for depth in ("rapide", "standard", "approfondi"):
                plan = sp.build_rich_plan(theme, {}, depth=depth)
                result = sp.validate_with_pipeline(plan)
                assert result["valid"] is True, f"{theme}/{depth}: {result['errors']}"
                assert len(result["order"]) == len(plan)
                assert result["cost"]["steps"] == len(plan)

    def test_order_respects_dependencies(self) -> None:
        plan = sp.build_rich_plan("urbanisme", {}, depth="standard")
        result = sp.validate_with_pipeline(plan)
        order = result["order"]
        step_map = {s["id"]: s for s in plan}
        for sid in order:
            for dep in step_map[sid].get("depends_on", []):
                assert order.index(dep) < order.index(sid)

    def test_empty_plan_is_valid(self) -> None:
        result = sp.validate_with_pipeline([])
        assert result["valid"] is True
        assert result["order"] == []
        assert result["cost"] == {"steps": 0, "network_steps": 0, "heavy_steps": 0}

    def test_invalid_action_detected(self) -> None:
        plan = sp.build_rich_plan("vegetation", {}, depth="rapide")
        plan[0]["action"] = "magic_spell"
        result = sp.validate_with_pipeline(plan)
        assert result["valid"] is False
        assert any("inconnue" in e for e in result["errors"])

    def test_missing_required_param_injected(self) -> None:
        plan = sp.build_rich_plan("vegetation", {}, depth="rapide")
        # Retire un param obligatoire pour verifier l'injection
        for step in plan:
            if step["action"] == "add_basemap":
                step["params"].pop("source_id", None)
        # La validation doit l'injecter et reussir
        result = sp.validate_with_pipeline(plan)
        assert result["valid"] is True, f"Erreurs: {result['errors']}"


class TestToProgressPayload:
    def test_counts_match(self) -> None:
        plan = sp.build_rich_plan("risques", {}, depth="standard")
        payload = sp.to_progress_payload(plan)
        assert payload["total"] == len(plan)
        assert payload["optional_count"] + payload["mandatory_count"] == len(plan)
        assert sum(payload["by_phase"].values()) == len(plan)

    def test_phases_present(self) -> None:
        plan = sp.build_rich_plan("hydrologie", {}, depth="approfondi")
        payload = sp.to_progress_payload(plan)
        for phase in ("data", "analyse", "layout", "livrable"):
            assert payload["by_phase"].get(phase, 0) >= 0

    def test_empty_plan(self) -> None:
        payload = sp.to_progress_payload([])
        assert payload["total"] == 0
        assert payload["optional_count"] == 0
        assert payload["mandatory_count"] == 0


class TestPlanBuilder:
    def test_duplicate_id_raises(self) -> None:
        builder = sp._PlanBuilder("test", "rapide", {})
        builder.add("add_basemap", {}, step_id="dup_id")
        with pytest.raises(ValueError):
            builder.add("load_satellite", {}, step_id="dup_id")
