# -*- coding: utf-8 -*-
"""
Tests unitaires Sprint 7 — Agent Graph (LangGraph orchestration).

Tests de la logique pure (sans dependance LangGraph) via le mode
fallback `run_sequential`.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "QGISIA2"))

from agent_graph import (  # noqa: E402
    DEFAULT_REGISTRY,
    MAX_REPLAN_ATTEMPTS,
    AgentState,
    NodeRegistry,
    increment_replan,
    init_state,
    is_langgraph_available,
    route_after_verify,
    run_agent,
    run_sequential,
)


# ─── init_state ───────────────────────────────────────────────────────────────


def test_init_state_defaults():
    state = init_state("test request")
    assert state["user_request"] == "test request"
    assert state["plan"] == []
    assert state["execution_log"] == []
    assert state["verify_passed"] is False
    assert state["replan_count"] == 0
    assert state["report"] == ""
    assert state["error"] is None


def test_init_state_with_layer_context():
    state = init_state("req", layer_context="Couches: A, B")
    assert state["layer_context"] == "Couches: A, B"


# ─── route_after_verify ───────────────────────────────────────────────────────


def test_route_after_verify_passes_to_report():
    state: AgentState = {**init_state("x"), "verify_passed": True}
    assert route_after_verify(state) == "report"


def test_route_after_verify_loops_to_plan_when_fails_below_max():
    state: AgentState = {**init_state("x"), "verify_passed": False, "replan_count": 0}
    assert route_after_verify(state) == "plan"


def test_route_after_verify_terminates_at_max_attempts():
    state: AgentState = {
        **init_state("x"),
        "verify_passed": False,
        "replan_count": MAX_REPLAN_ATTEMPTS - 1,
    }
    assert route_after_verify(state) == "report"


def test_increment_replan_bumps_counter():
    state: AgentState = {**init_state("x"), "replan_count": 1}
    bumped = increment_replan(state)
    assert bumped["replan_count"] == 2
    # Original non mute (immutable update)
    assert state["replan_count"] == 1


# ─── run_sequential (default registry) ────────────────────────────────────────


def test_run_sequential_succeeds_with_default_nodes():
    final = run_sequential("Lister les couches QGIS")
    assert final["verify_passed"] is True
    assert "PLAN" in final["report"]
    assert "EXECUTE" in final["report"]
    assert "VERIFY" in final["report"]
    assert "REPORT" in final["report"]


def test_run_sequential_fills_plan_and_log():
    final = run_sequential("Demande X")
    assert len(final["plan"]) > 0
    assert len(final["execution_log"]) > 0
    assert all("OK" in step for step in final["execution_log"])


# ─── run_sequential avec injection custom (failure path) ─────────────────────


def _make_failing_execute(*_args: object, **_kwargs: object):
    """Factory pour un execute_fn qui echoue."""
    def execute_fn(state: AgentState) -> AgentState:
        return {**state, "execution_log": ["ECHEC: tool indisponible"]}
    return execute_fn


def test_run_sequential_retries_on_verify_failure():
    failing_execute = _make_failing_execute()
    registry = NodeRegistry(
        plan_fn=DEFAULT_REGISTRY.plan_fn,
        execute_fn=failing_execute,
        verify_fn=DEFAULT_REGISTRY.verify_fn,
        report_fn=DEFAULT_REGISTRY.report_fn,
    )
    final = run_sequential("test", registry=registry)
    assert final["verify_passed"] is False
    assert final["replan_count"] == MAX_REPLAN_ATTEMPTS - 1  # retried n-1 times


def test_run_sequential_eventually_reports_even_on_total_failure():
    failing_execute = _make_failing_execute()
    registry = NodeRegistry(
        plan_fn=DEFAULT_REGISTRY.plan_fn,
        execute_fn=failing_execute,
        verify_fn=DEFAULT_REGISTRY.verify_fn,
        report_fn=DEFAULT_REGISTRY.report_fn,
    )
    final = run_sequential("test", registry=registry)
    # Report toujours genere meme apres n echecs
    assert final["report"] != ""


def test_run_sequential_respects_custom_max_attempts():
    failing_execute = _make_failing_execute()
    registry = NodeRegistry(
        plan_fn=DEFAULT_REGISTRY.plan_fn,
        execute_fn=failing_execute,
        verify_fn=DEFAULT_REGISTRY.verify_fn,
        report_fn=DEFAULT_REGISTRY.report_fn,
    )
    final = run_sequential("test", registry=registry, max_attempts=2)
    assert final["replan_count"] == 1


# ─── Custom plan/verify nodes (succession reussie au 2eme essai) ─────────────


def test_run_sequential_recovers_after_first_failure():
    call_count = {"n": 0}

    def execute_fn(state: AgentState) -> AgentState:
        call_count["n"] += 1
        if call_count["n"] == 1:
            return {**state, "execution_log": ["ECHEC: premiere tentative"]}
        return {**state, "execution_log": ["OK: deuxieme tentative reussie"]}

    registry = NodeRegistry(
        plan_fn=DEFAULT_REGISTRY.plan_fn,
        execute_fn=execute_fn,
        verify_fn=DEFAULT_REGISTRY.verify_fn,
        report_fn=DEFAULT_REGISTRY.report_fn,
    )
    final = run_sequential("test", registry=registry)
    assert final["verify_passed"] is True
    assert final["replan_count"] == 1  # 1 retry
    assert call_count["n"] == 2


# ─── run_agent (entry point public) ───────────────────────────────────────────


def test_run_agent_falls_back_to_sequential_when_no_langgraph():
    # Si langgraph n'est pas installe, run_agent doit retomber sur sequential
    final = run_agent("test request", prefer_langgraph=False)
    assert final["report"] != ""
    assert final["verify_passed"] is True


def test_run_agent_passes_layer_context():
    final = run_agent("test", layer_context="couches: foo", prefer_langgraph=False)
    assert final["layer_context"] == "couches: foo"


# ─── is_langgraph_available ───────────────────────────────────────────────────


def test_is_langgraph_available_returns_tuple():
    ok, reason = is_langgraph_available()
    assert isinstance(ok, bool)
    if not ok:
        assert "langgraph" in reason.lower()


# ─── NodeRegistry dataclass ───────────────────────────────────────────────────


def test_node_registry_construction():
    registry = NodeRegistry(
        plan_fn=lambda s: s,
        execute_fn=lambda s: s,
        verify_fn=lambda s: {**s, "verify_passed": True},
        report_fn=lambda s: {**s, "report": "ok"},
    )
    state = init_state("x")
    assert registry.verify_fn(state)["verify_passed"] is True
