# -*- coding: utf-8 -*-
"""Tests du registre de la federation : alias valides + routage (gateway mocke)."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2" / "vendor"))
sys.path.insert(0, str(ROOT / "QGISIA2"))

import agent_federation as fed  # noqa: E402

ALIASES = json.loads(
    (ROOT / "QGISIA2" / "config" / "models.json").read_text(encoding="utf-8")
)["aliases"]


def test_every_agent_points_to_a_known_alias():
    for agent_type, cfg in fed.AGENT_REGISTRY.items():
        assert cfg.model in ALIASES, f"{agent_type.value} -> alias inconnu: {cfg.model}"


def test_no_hardcoded_nvidia_model_in_registry():
    # Plus aucun modele code en dur (prefixe nvidia_nim/) : on passe par les alias.
    for cfg in fed.AGENT_REGISTRY.values():
        assert not cfg.model.startswith("nvidia_nim/"), cfg.model
        assert cfg.fallback_models == [], "les fallbacks sont geres par le gateway"


def test_route_intent_maps_code(monkeypatch):
    monkeypatch.setattr(
        "llm_gateway.chat",
        lambda **kw: {"choices": [{"message": {"content": "CODE"}}]},
    )
    f = fed.AgentFederation(api_keys={})
    assert f.route_intent("Cree un buffer de 500m") == fed.AgentType.CODE_GENERATOR


def test_route_intent_maps_vision(monkeypatch):
    monkeypatch.setattr(
        "llm_gateway.chat",
        lambda **kw: {"choices": [{"message": {"content": "VISION"}}]},
    )
    f = fed.AgentFederation(api_keys={})
    assert f.route_intent("Analyse cette carte IGN") == fed.AgentType.VISION_ANALYZER


def test_route_intent_unknown_defaults_to_qgis_expert(monkeypatch):
    monkeypatch.setattr(
        "llm_gateway.chat",
        lambda **kw: {"choices": [{"message": {"content": "???"}}]},
    )
    f = fed.AgentFederation(api_keys={})
    assert f.route_intent("blabla") == fed.AgentType.QGIS_EXPERT


def test_route_intent_on_error_defaults_to_qgis_expert(monkeypatch):
    def boom(**kw):
        raise RuntimeError("gateway down")
    monkeypatch.setattr("llm_gateway.chat", boom)
    f = fed.AgentFederation(api_keys={})
    assert f.route_intent("blabla") == fed.AgentType.QGIS_EXPERT


def test_demo_federation_reports_nine_agents():
    d = fed.demo_federation()
    assert d["agents_count"] == 9


def test_process_end_to_end_with_mocked_gateway(monkeypatch):
    """Flux complet routage -> agent -> (safety) sans reseau."""
    seen = []

    def fake_chat(model, messages, api_keys, **kw):
        seen.append(model)
        if model == "intent-router":
            content = "CODE"
        elif model == "safety":
            content = "SAFE"
        else:
            content = "processing.run('native:buffer', {...})"
        return {"choices": [{"message": {"content": content}}]}

    monkeypatch.setattr("llm_gateway.chat", fake_chat)
    f = fed.AgentFederation(api_keys={})
    res = f.process("Cree un buffer de 500m autour des ecoles")

    assert res["routing"] == "code"
    assert res["agent_results"][0].success
    assert "buffer" in res["agent_results"][0].content
    assert "intent-router" in seen  # le routeur a bien ete sollicite
    assert "code-pyqgis" in seen    # l'agent code a bien ete execute via son alias
