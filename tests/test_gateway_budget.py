# -*- coding: utf-8 -*-
"""Tests purs de la gestion de budget du gateway LLM (sans réseau ni QGIS)."""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "QGISIA2"))

import llm_gateway as g  # noqa: E402


def _reset_budget():
    with g._budget._lock:  # accès interne assumé dans les tests
        g._budget._total_usd = 0.0
        g._budget._by_model.clear()
        g._budget._request_count = 0


def test_no_budget_config_means_no_warning():
    _reset_budget()
    st = g.budget_status({})
    assert st["warning"] is False
    assert st["daily_max_usd"] is None


def test_warning_triggers_at_threshold():
    _reset_budget()
    cfg = {"budgets": {"daily_max_usd": 1.0, "warn_at_percent": 80}}
    assert g.budget_status(cfg)["warning"] is False
    g._budget.add("m", 0.85)
    st = g.budget_status(cfg)
    assert st["percent"] >= 80
    assert st["warning"] is True


def test_below_threshold_no_warning():
    _reset_budget()
    g._budget.add("m", 0.50)
    st = g.budget_status({"budgets": {"daily_max_usd": 1.0, "warn_at_percent": 80}})
    assert st["warning"] is False


def test_exceeded_budget_raises():
    _reset_budget()
    g._budget.add("m", 2.0)
    with pytest.raises(g.BudgetExceededError):
        g.budget_status({"budgets": {"daily_max_usd": 1.0}})


def test_retry_config_present_in_models_json():
    cfg = g.load_config()
    retry = cfg.get("retry", {})
    assert "request_timeout_seconds" in retry
    assert isinstance(retry.get("backoff_seconds"), list)
