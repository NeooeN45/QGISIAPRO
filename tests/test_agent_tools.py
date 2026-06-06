# -*- coding: utf-8 -*-
"""Tests du pont Tool Calling QGIS <-> LLM (agent_tools)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2" / "vendor"))
sys.path.insert(0, str(ROOT / "QGISIA2"))

import agent_tools as at  # noqa: E402


def test_to_openai_tools_shape():
    tools = at.to_openai_tools()
    assert len(tools) >= 8
    for t in tools:
        assert t["type"] == "function"
        fn = t["function"]
        assert isinstance(fn["name"], str) and fn["name"]
        assert isinstance(fn["description"], str)
        assert fn["parameters"]["type"] == "object"


def test_tool_names_include_core_map_ops():
    names = at.tool_names()
    for expected in ("getLayersList", "setLayerVisibility", "zoomToLayer",
                     "filterLayer", "reprojectLayer", "setLayerOpacity"):
        assert expected in names


def test_parse_tool_calls_extracts_name_and_args():
    response = {
        "choices": [{
            "message": {
                "tool_calls": [{
                    "id": "call_1",
                    "function": {
                        "name": "zoomToLayer",
                        "arguments": '{"layerId": "layer_42"}',
                    },
                }]
            }
        }]
    }
    calls = at.parse_tool_calls(response)
    assert len(calls) == 1
    assert calls[0]["name"] == "zoomToLayer"
    assert calls[0]["arguments"] == {"layerId": "layer_42"}
    assert calls[0]["id"] == "call_1"


def test_parse_tool_calls_empty_when_none():
    assert at.parse_tool_calls({"choices": [{"message": {"content": "hello"}}]}) == []
    assert at.parse_tool_calls({}) == []


def test_parse_tool_calls_tolerates_bad_json():
    response = {"choices": [{"message": {"tool_calls": [
        {"id": "x", "function": {"name": "filterLayer", "arguments": "{not json"}}
    ]}}]}
    calls = at.parse_tool_calls(response)
    assert calls[0]["name"] == "filterLayer"
    assert calls[0]["arguments"] == {}


class _FakeResp:
    def __init__(self, text):
        self.text = text

    def raise_for_status(self):
        return None


class _FakeClient:
    def __init__(self, text="OK"):
        self.text = text
        self.calls = []

    async def post(self, url, json):  # noqa: A002 - signature imposee par httpx
        self.calls.append((url, json))
        return _FakeResp(self.text)


def test_execute_tool_call_routes_to_bridge():
    fake = _FakeClient("zoom effectue")
    out = at.execute_tool_call(
        "zoomToLayer",
        {"layerId": "layer_1"},
        bridge_url="http://localhost:8157",
        http_client=fake,
    )
    assert out == "zoom effectue"
    url, payload = fake.calls[0]
    assert url == "http://localhost:8157/api/qgis/zoomToLayer"
    assert payload == {"layerId": "layer_1"}


def test_execute_tool_call_unknown_tool_raises():
    import pytest
    with pytest.raises(ValueError):
        at.execute_tool_call("doesNotExist", {}, http_client=_FakeClient())


def test_run_tool_loop_executes_tool_then_answers():
    state = {"i": 0}

    def fake_chat(model, messages, api_keys, tools=None, stream=False, **kw):
        state["i"] += 1
        if state["i"] == 1:
            # 1er tour : le LLM demande l'outil zoomToLayer
            return {"choices": [{"message": {
                "content": None,
                "tool_calls": [{
                    "id": "c1",
                    "function": {"name": "zoomToLayer", "arguments": '{"layerId": "L1"}'},
                }],
            }}]}
        # 2e tour : le LLM repond apres avoir vu le resultat de l'outil
        return {"choices": [{"message": {"content": "J'ai zoome sur la couche L1."}}]}

    fake_http = _FakeClient("zoom ok")
    res = at.run_tool_loop(
        [{"role": "user", "content": "zoom sur L1"}],
        api_keys={},
        chat_fn=fake_chat,
        http_client=fake_http,
        bridge_url="http://localhost:8157",
    )
    assert "zoome" in res["content"]
    assert res["iterations"] == 2
    assert res["trace"][0]["tool"] == "zoomToLayer"
    assert res["trace"][0]["arguments"] == {"layerId": "L1"}
    assert res["trace"][0]["result"] == "zoom ok"


def test_run_tool_loop_no_tools_returns_directly():
    def fake_chat(model, messages, api_keys, tools=None, stream=False, **kw):
        return {"choices": [{"message": {"content": "Reponse directe sans outil."}}]}

    res = at.run_tool_loop(
        [{"role": "user", "content": "bonjour"}],
        api_keys={},
        chat_fn=fake_chat,
    )
    assert res["content"] == "Reponse directe sans outil."
    assert res["iterations"] == 1
    assert res["trace"] == []


def test_run_tool_loop_respects_max_iters():
    def always_calls(model, messages, api_keys, tools=None, stream=False, **kw):
        return {"choices": [{"message": {
            "content": None,
            "tool_calls": [{
                "id": "c", "function": {"name": "getLayersList", "arguments": "{}"},
            }],
        }}]}

    res = at.run_tool_loop(
        [{"role": "user", "content": "boucle"}],
        api_keys={},
        chat_fn=always_calls,
        http_client=_FakeClient("[]"),
        max_iters=3,
    )
    assert res["iterations"] == 3
    assert "Limite" in res["content"]
