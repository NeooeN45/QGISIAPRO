# ═══════════════════════════════════════════════════════════════════════════════
# IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI)
# Superviseur : Claude Code 4.8 — Camil
# Date : 2026-06-08 | Branche : chore/hygiene-puis-nvidia
# ═══════════════════════════════════════════════════════════════════════════════
# -*- coding: utf-8 -*-
"""Tests de devin_utils — décorateur @devin_authored + SecurityAuditLog."""
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import devin_utils as du  # noqa: E402


# ── Tests @devin_authored ─────────────────────────────────────────────────────

def test_devin_authored_preserves_return_value():
    @du.devin_authored
    def add(a: int, b: int) -> int:
        return a + b

    assert add(2, 3) == 5


def test_devin_authored_sets_attributes():
    @du.devin_authored
    def noop() -> None:
        pass

    assert getattr(noop, "__devin_authored__", False) is True
    assert "devin" in getattr(noop, "__devin_agent__", "")
    assert "camil" in getattr(noop, "__devin_supervisor__", "").lower()


def test_devin_authored_preserves_name_and_docstring():
    @du.devin_authored
    def documented_func():
        """Ma docstring."""

    assert documented_func.__name__ == "documented_func"
    assert documented_func.__doc__ == "Ma docstring."


def test_devin_authored_on_class_method():
    class MyClass:
        @du.devin_authored
        def greet(self) -> str:
            return "hello"

    obj = MyClass()
    assert obj.greet() == "hello"
    assert getattr(obj.greet, "__devin_authored__", False) is True


# ── Tests SecurityAuditLog ────────────────────────────────────────────────────

def _make_log() -> du.SecurityAuditLog:
    """Crée un log isolé dans un fichier temporaire."""
    tmp = tempfile.mktemp(suffix=".log")
    return du.SecurityAuditLog(Path(tmp))


def test_record_writes_json_line():
    log = _make_log()
    log.record("tool_called", tool="computeNDVI")
    entries = log.last_entries(1)
    assert len(entries) == 1
    assert entries[0]["event"] == "tool_called"
    assert entries[0]["tool"] == "computeNDVI"


def test_record_includes_devin_metadata():
    log = _make_log()
    log.record("test_event")
    entry = log.last_entries(1)[0]
    assert "agent" in entry
    assert "devin" in entry["agent"].lower()
    assert "supervisor" in entry
    assert "camil" in entry["supervisor"].lower()


def test_record_redacts_api_key_in_kwarg():
    log = _make_log()
    log.record("setup", api_key="nvapi-SuperSecret1234")
    entry = log.last_entries(1)[0]
    assert entry["api_key"] == "[REDACTED]"


def test_record_redacts_api_key_in_value_string():
    log = _make_log()
    log.record("debug", info="using key nvapi-AbCdEfGhIjKlMnOp")
    entry = log.last_entries(1)[0]
    assert "nvapi-" not in entry["info"]
    assert "[REDACTED]" in entry["info"]


def test_record_does_not_redact_normal_strings():
    log = _make_log()
    log.record("layer_loaded", layer_name="Parcelles_31")
    entry = log.last_entries(1)[0]
    assert entry["layer_name"] == "Parcelles_31"


def test_last_entries_returns_n_last():
    log = _make_log()
    for i in range(10):
        log.record("evt", i=i)
    entries = log.last_entries(3)
    assert len(entries) == 3
    assert entries[-1]["i"] == 9


def test_last_entries_empty_when_no_log():
    log = du.SecurityAuditLog(Path(tempfile.mktemp(suffix=".log")))
    assert log.last_entries() == []


def test_sensitive_keys_set_is_comprehensive():
    """Vérifie que les clés critiques sont toutes couvertes."""
    critical = {"api_key", "password", "token", "secret", "authorization"}
    assert critical.issubset(du._SENSITIVE_KEYS)


def test_sanitize_nested_dict():
    data = {"user": "admin", "creds": {"password": "secret123", "token": "sk-abc"}}
    result = du._sanitize_record(data)
    assert result["user"] == "admin"
    assert result["creds"]["password"] == "[REDACTED]"
    assert result["creds"]["token"] == "[REDACTED]"
