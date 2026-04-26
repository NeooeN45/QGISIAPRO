# -*- coding: utf-8 -*-
"""
Tests unitaires QGISIA+ MCP Server (Sprint 6).

Pas de dependance au SDK 'mcp' : on teste les fonctions pures (catalogue,
dispatch, payload builders) avec un client HTTP mock.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "QGISIA2"))

from mcp_server import (  # noqa: E402
    DEFAULT_BRIDGE_URL,
    TOOL_CATALOG,
    McpToolSpec,
    call_bridge,
    dispatch_tool_call,
    get_tool,
    list_tool_specs,
)


# ─── Catalogue ────────────────────────────────────────────────────────────────


def test_tool_catalog_is_non_empty():
    assert len(TOOL_CATALOG) >= 6


def test_tool_catalog_names_are_unique():
    names = [t.name for t in TOOL_CATALOG]
    assert len(names) == len(set(names)), "Doublon dans le catalogue"


def test_tool_catalog_includes_sprint_features():
    names = {t.name for t in TOOL_CATALOG}
    assert "loadHubEauStations" in names
    assert "segmentRasterWithSAM" in names
    assert "forecastWeatherWithEarth2" in names
    assert "exportProjectReport" in names


def test_each_tool_has_valid_schema():
    for tool in TOOL_CATALOG:
        assert tool.name and isinstance(tool.name, str)
        assert tool.description and len(tool.description) > 10
        assert isinstance(tool.input_schema, dict)
        assert tool.input_schema.get("type") == "object"
        assert tool.endpoint.startswith("/api/qgis/")
        assert callable(tool.payload_builder)


def test_get_tool_returns_known_tool():
    tool = get_tool("loadHubEauStations")
    assert tool is not None
    assert tool.endpoint == "/api/qgis/loadHubEauStations"


def test_get_tool_returns_none_for_unknown():
    assert get_tool("inexistant_tool") is None


def test_list_tool_specs_is_json_serializable():
    specs = list_tool_specs()
    # Doit etre serialisable sans erreur (pas de Callable dans la sortie)
    json.dumps(specs)
    assert all("name" in s and "description" in s and "inputSchema" in s for s in specs)


# ─── Payload builders ─────────────────────────────────────────────────────────


def test_options_payload_serializes_args_as_json_options():
    tool = get_tool("loadHubEauStations")
    assert tool is not None
    payload = tool.payload_builder({"station_type": "quality", "department": "31"})
    assert "options" in payload
    parsed = json.loads(payload["options"])
    assert parsed["station_type"] == "quality"
    assert parsed["department"] == "31"


def test_runscript_payload_uses_direct_script_field():
    tool = get_tool("runScript")
    assert tool is not None
    payload = tool.payload_builder({"script": "print(1)"})
    assert payload == {"script": "print(1)"}


def test_getlayerslist_payload_is_empty():
    tool = get_tool("getLayersList")
    assert tool is not None
    payload = tool.payload_builder({})
    assert payload == {}


# ─── dispatch_tool_call ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_dispatch_tool_call_routes_to_correct_endpoint():
    mock_response = MagicMock()
    mock_response.text = "147 stations chargees"
    mock_response.raise_for_status = MagicMock()

    mock_client = MagicMock()
    mock_client.post = AsyncMock(return_value=mock_response)

    result = await dispatch_tool_call(
        "loadHubEauStations",
        {"station_type": "quality", "department": "31"},
        http_client=mock_client,
    )
    assert result == "147 stations chargees"

    mock_client.post.assert_awaited_once()
    call_args = mock_client.post.call_args
    assert call_args.args[0].endswith("/api/qgis/loadHubEauStations")
    assert "options" in call_args.kwargs["json"]


@pytest.mark.asyncio
async def test_dispatch_tool_call_raises_for_unknown_tool():
    with pytest.raises(ValueError, match="inconnu"):
        await dispatch_tool_call("ghost_tool", {})


@pytest.mark.asyncio
async def test_dispatch_tool_call_uses_custom_bridge_url():
    mock_response = MagicMock()
    mock_response.text = "OK"
    mock_response.raise_for_status = MagicMock()
    mock_client = MagicMock()
    mock_client.post = AsyncMock(return_value=mock_response)

    await dispatch_tool_call(
        "getLayersList", {},
        bridge_url="http://custom:9999",
        http_client=mock_client,
    )
    url = mock_client.post.call_args.args[0]
    assert url.startswith("http://custom:9999")


@pytest.mark.asyncio
async def test_call_bridge_strips_trailing_slash():
    mock_response = MagicMock()
    mock_response.text = "ok"
    mock_response.raise_for_status = MagicMock()
    mock_client = MagicMock()
    mock_client.post = AsyncMock(return_value=mock_response)

    await call_bridge(
        "/api/qgis/getLayersList", {},
        bridge_url="http://x/",
        http_client=mock_client,
    )
    url = mock_client.post.call_args.args[0]
    assert "//api" not in url
    assert url == "http://x/api/qgis/getLayersList"


@pytest.mark.asyncio
async def test_call_bridge_propagates_http_errors():
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock(side_effect=RuntimeError("502 Bad Gateway"))
    mock_client = MagicMock()
    mock_client.post = AsyncMock(return_value=mock_response)

    with pytest.raises(RuntimeError, match="502"):
        await call_bridge("/api/qgis/x", {}, http_client=mock_client)


# ─── Default bridge URL ───────────────────────────────────────────────────────


def test_default_bridge_url_format():
    assert DEFAULT_BRIDGE_URL.startswith("http")
    assert ":" in DEFAULT_BRIDGE_URL  # port present


# ─── McpToolSpec dataclass ────────────────────────────────────────────────────


def test_mcptoolspec_dataclass_construction():
    spec = McpToolSpec(
        name="x", description="y" * 20, input_schema={"type": "object"},
        endpoint="/api/qgis/x", payload_builder=lambda a: a,
    )
    assert spec.name == "x"
    assert spec.payload_builder({"k": "v"}) == {"k": "v"}
