# -*- coding: utf-8 -*-
"""
Pont Tool Calling QGIS <-> LLM.

Expose le catalogue d'outils QGIS (mcp_server.TOOL_CATALOG) au format OpenAI
'tools' pour que le LLM (via le gateway LiteLLM) puisse appeler des actions QGIS,
parse les tool_calls renvoyes par le modele, et execute l'appel en routant vers
le bridge HTTP QGIS (reutilise le dispatch MCP existant : une seule source de verite).
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, List, Optional

try:
    from mcp_server import (
        TOOL_CATALOG,
        McpToolSpec,
        dispatch_tool_call,
        DEFAULT_BRIDGE_URL,
    )
except ImportError:  # pragma: no cover - fallback import package
    from .mcp_server import (  # type: ignore
        TOOL_CATALOG,
        McpToolSpec,
        dispatch_tool_call,
        DEFAULT_BRIDGE_URL,
    )


def to_openai_tools(catalog: Optional[List[McpToolSpec]] = None) -> List[dict]:
    """Convertit le catalogue d'outils QGIS au format OpenAI 'tools' (function calling)."""
    specs = catalog if catalog is not None else TOOL_CATALOG
    return [
        {
            "type": "function",
            "function": {
                "name": spec.name,
                "description": spec.description,
                "parameters": spec.input_schema,
            },
        }
        for spec in specs
    ]


def tool_names(catalog: Optional[List[McpToolSpec]] = None) -> List[str]:
    """Liste des noms d'outils disponibles."""
    specs = catalog if catalog is not None else TOOL_CATALOG
    return [s.name for s in specs]


def parse_tool_calls(response: dict) -> List[dict]:
    """
    Extrait les tool_calls d'une reponse OpenAI ChatCompletion.
    Retourne une liste [{id, name, arguments(dict)}], vide si aucun appel.
    """
    try:
        message = response["choices"][0]["message"]
    except (KeyError, IndexError, TypeError):
        return []

    calls = message.get("tool_calls") or []
    parsed: List[dict] = []
    for call in calls:
        fn = call.get("function", {}) if isinstance(call, dict) else {}
        raw_args = fn.get("arguments", "{}")
        try:
            args = json.loads(raw_args) if isinstance(raw_args, str) else dict(raw_args or {})
        except (json.JSONDecodeError, TypeError):
            args = {}
        parsed.append({
            "id": call.get("id", "") if isinstance(call, dict) else "",
            "name": fn.get("name", ""),
            "arguments": args,
        })
    return parsed


def execute_tool_call(
    name: str,
    arguments: dict,
    *,
    bridge_url: str = DEFAULT_BRIDGE_URL,
    http_client: Any = None,
) -> str:
    """
    Execute (synchrone) un appel d'outil en routant vers le bridge QGIS via le
    dispatch MCP. `http_client` permet l'injection pour les tests.
    """
    return asyncio.run(
        dispatch_tool_call(
            name,
            arguments or {},
            bridge_url=bridge_url,
            http_client=http_client,
        )
    )
