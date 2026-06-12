# -*- coding: utf-8 -*-
"""
Tests de streaming SSE pour run_tool_loop (spec QGISIA streaming-v2).

Verifie que on_event emet bien iteration/tool_start/tool_result dans le bon
ordre, et que le comportement sans on_event est inchange (retro-compatibilite).
"""
from __future__ import annotations

import sys
import os

# Assure que le package QGISIA2 est importable sans QGIS.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
from typing import Any, List
from unittest.mock import patch

import pytest


# ---------------------------------------------------------------------------
# Helpers / Fixtures
# ---------------------------------------------------------------------------

def _make_response(content: str = "Voici ma reponse.", tool_calls: list | None = None):
    """Fabrique une reponse OpenAI minimaliste."""
    message: dict = {"role": "assistant", "content": content}
    if tool_calls is not None:
        message["tool_calls"] = tool_calls
    return {"choices": [{"message": message}]}


def _tool_call_response(tool_name: str, args: dict, call_id: str = "call_1"):
    """Reponse simulant un tool_call."""
    return {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": call_id,
                            "type": "function",
                            "function": {
                                "name": tool_name,
                                "arguments": json.dumps(args),
                            },
                        }
                    ],
                }
            }
        ]
    }


def _make_chat_fn(responses: list):
    """Renvoie un chat_fn sequentiel qui consomme responses l'un apres l'autre."""
    responses = list(responses)

    def chat_fn(**_kwargs):
        return responses.pop(0)

    return chat_fn


# ---------------------------------------------------------------------------
# Tests retro-compatibilite (sans on_event)
# ---------------------------------------------------------------------------

class TestRunToolLoopBackwardCompat:
    """Sans on_event, le comportement doit etre strictement identique a l'ancienne API."""

    def test_simple_response_no_tools(self):
        """Reponse directe sans outil."""
        from QGISIA2.agent_tools import run_tool_loop

        chat_fn = _make_chat_fn([_make_response("Bonjour le monde.")])
        result = run_tool_loop(
            [{"role": "user", "content": "Dis bonjour"}],
            {},
            chat_fn=chat_fn,
            http_client=object(),
        )
        assert result["content"] == "Bonjour le monde."
        assert result["iterations"] == 1
        assert result["trace"] == []

    def test_one_tool_call_then_response(self):
        """Une iteration avec un outil, puis reponse finale."""
        from QGISIA2.agent_tools import run_tool_loop

        responses = [
            _tool_call_response("getLayersList", {}),
            _make_response("Voici les couches."),
        ]
        chat_fn = _make_chat_fn(responses)

        with patch("QGISIA2.agent_tools.execute_tool_call", return_value="[layer1, layer2]"), \
             patch("QGISIA2.agent_tools.native_tool_names", return_value=[]):
            result = run_tool_loop(
                [{"role": "user", "content": "Liste les couches"}],
                {},
                chat_fn=chat_fn,
                http_client=object(),
            )

        assert result["content"] == "Voici les couches."
        assert len(result["trace"]) == 1
        assert result["trace"][0]["tool"] == "getLayersList"

    def test_no_on_event_does_not_raise(self):
        """Sans on_event, aucune exception ne doit etre levee."""
        from QGISIA2.agent_tools import run_tool_loop

        chat_fn = _make_chat_fn([_make_response("OK")])
        # on_event absent — doit fonctionner sans erreur
        result = run_tool_loop(
            [{"role": "user", "content": "test"}],
            {},
            chat_fn=chat_fn,
            http_client=object(),
        )
        assert result["content"] == "OK"


# ---------------------------------------------------------------------------
# Tests emission d'evenements avec on_event
# ---------------------------------------------------------------------------

class TestRunToolLoopEvents:
    """Verifie le contenu et l'ordre des evenements emis via on_event."""

    def test_iteration_event_emitted(self):
        """Un evenement 'iteration' doit etre emis a chaque tour."""
        from QGISIA2.agent_tools import run_tool_loop

        events: List[dict] = []
        chat_fn = _make_chat_fn([_make_response("Done.")])

        run_tool_loop(
            [{"role": "user", "content": "test"}],
            {},
            chat_fn=chat_fn,
            http_client=object(),
            on_event=events.append,
        )

        iteration_evs = [e for e in events if e["type"] == "iteration"]
        assert len(iteration_evs) == 1
        assert iteration_evs[0]["i"] == 1

    def test_tool_start_and_result_events(self):
        """tool_start precede tool_result, avec le bon nom d'outil."""
        from QGISIA2.agent_tools import run_tool_loop

        events: List[dict] = []
        responses = [
            _tool_call_response("bufferLayer", {"layer": "routes", "distance": 100}),
            _make_response("Tampon cree."),
        ]
        chat_fn = _make_chat_fn(responses)

        with patch("QGISIA2.agent_tools.execute_tool_call", return_value="OK"), \
             patch("QGISIA2.agent_tools.native_tool_names", return_value=[]):
            run_tool_loop(
                [{"role": "user", "content": "buffer routes 100m"}],
                {},
                chat_fn=chat_fn,
                http_client=object(),
                on_event=events.append,
            )

        types = [e["type"] for e in events]
        assert "tool_start" in types
        assert "tool_result" in types

        start_idx = types.index("tool_start")
        result_idx = types.index("tool_result")
        assert start_idx < result_idx, "tool_start doit preceder tool_result"

        start_ev = events[start_idx]
        assert start_ev["tool"] == "bufferLayer"
        assert "arguments" in start_ev

        result_ev = events[result_idx]
        assert result_ev["tool"] == "bufferLayer"
        assert result_ev["blocked"] is False
        assert isinstance(result_ev["result"], str)

    def test_event_order_iteration_before_tool(self):
        """L'evenement iteration doit preceder les evenements d'outil."""
        from QGISIA2.agent_tools import run_tool_loop

        events: List[dict] = []
        responses = [
            _tool_call_response("getLayersList", {}),
            _make_response("OK"),
        ]
        chat_fn = _make_chat_fn(responses)

        with patch("QGISIA2.agent_tools.execute_tool_call", return_value="[]"), \
             patch("QGISIA2.agent_tools.native_tool_names", return_value=[]):
            run_tool_loop(
                [{"role": "user", "content": "test"}],
                {},
                chat_fn=chat_fn,
                http_client=object(),
                on_event=events.append,
            )

        types = [e["type"] for e in events]
        first_iter = types.index("iteration")
        first_tool = types.index("tool_start")
        assert first_iter < first_tool

    def test_blocked_tool_emits_blocked_true(self):
        """Un outil bloque doit emettre blocked=True dans tool_result."""
        from QGISIA2.agent_tools import run_tool_loop

        events: List[dict] = []
        # Sécurité : cette chaîne est uniquement la valeur d'un argument JSON dans un
        # tool_call fictif. execute_tool_call est mocké → aucun shell n'est jamais exécuté.
        responses = [
            _tool_call_response("runScript", {"script": "import os; os.system('rm -rf /')"}),
            _make_response("Action annulee."),
        ]
        chat_fn = _make_chat_fn(responses)

        # On force le safety_check a refuser
        with patch("QGISIA2.agent_tools.safety_check", return_value=(False, "Code dangereux")), \
             patch("QGISIA2.agent_tools.native_tool_names", return_value=[]):
            run_tool_loop(
                [{"role": "user", "content": "supprime tout"}],
                {},
                chat_fn=chat_fn,
                http_client=object(),
                on_event=events.append,
            )

        blocked_evs = [e for e in events if e.get("type") == "tool_result" and e.get("blocked")]
        assert len(blocked_evs) == 1
        assert blocked_evs[0]["tool"] == "runScript"

    def test_multiple_iterations_emit_multiple_iteration_events(self):
        """Deux iterations → deux evenements 'iteration'."""
        from QGISIA2.agent_tools import run_tool_loop

        events: List[dict] = []
        responses = [
            _tool_call_response("getLayersList", {}, call_id="c1"),
            _tool_call_response("zoomToLayer", {"layer": "roads"}, call_id="c2"),
            _make_response("Done."),
        ]
        chat_fn = _make_chat_fn(responses)

        with patch("QGISIA2.agent_tools.execute_tool_call", return_value="OK"), \
             patch("QGISIA2.agent_tools.native_tool_names", return_value=[]):
            result = run_tool_loop(
                [{"role": "user", "content": "zoom roads"}],
                {},
                chat_fn=chat_fn,
                http_client=object(),
                on_event=events.append,
            )

        iter_evs = [e for e in events if e["type"] == "iteration"]
        assert len(iter_evs) == 3
        assert [e["i"] for e in iter_evs] == [1, 2, 3]

    def test_on_event_exception_does_not_abort_loop(self):
        """Si on_event leve une exception, la boucle continue sans crash."""
        from QGISIA2.agent_tools import run_tool_loop

        def bad_callback(ev: dict) -> None:
            raise RuntimeError("callback crash")

        chat_fn = _make_chat_fn([_make_response("Reponse malgre callback cassee.")])
        result = run_tool_loop(
            [{"role": "user", "content": "test"}],
            {},
            chat_fn=chat_fn,
            http_client=object(),
            on_event=bad_callback,
        )
        assert result["content"] == "Reponse malgre callback cassee."

    def test_result_truncated_to_300_chars(self):
        """Le champ 'result' dans tool_result est tronque a 300 chars."""
        from QGISIA2.agent_tools import run_tool_loop

        long_result = "x" * 500
        events: List[dict] = []
        responses = [
            _tool_call_response("getLayersList", {}),
            _make_response("OK"),
        ]
        chat_fn = _make_chat_fn(responses)

        with patch("QGISIA2.agent_tools.execute_tool_call", return_value=long_result), \
             patch("QGISIA2.agent_tools.native_tool_names", return_value=[]):
            run_tool_loop(
                [{"role": "user", "content": "test"}],
                {},
                chat_fn=chat_fn,
                http_client=object(),
                on_event=events.append,
            )

        result_evs = [e for e in events if e["type"] == "tool_result"]
        assert len(result_evs) == 1
        assert len(result_evs[0]["result"]) <= 300
