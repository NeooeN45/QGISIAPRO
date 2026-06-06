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


def run_tool_loop(
    messages: List[dict],
    api_keys: dict,
    *,
    model: str = "smart-default",
    max_iters: int = 5,
    bridge_url: str = DEFAULT_BRIDGE_URL,
    chat_fn: Any = None,
    http_client: Any = None,
) -> dict:
    """
    Boucle agentique de tool calling :
      LLM -> tool_calls -> execution bridge QGIS -> resultats -> LLM -> ... -> reponse.

    Retourne {content, trace[], iterations}. `chat_fn` et `http_client` sont
    injectables pour les tests (par defaut : gateway LiteLLM + httpx).
    """
    if chat_fn is None:  # pragma: no cover - chemin reel (gateway)
        try:
            from llm_gateway import chat as chat_fn  # type: ignore
        except ImportError:
            from .llm_gateway import chat as chat_fn  # type: ignore

    tools = to_openai_tools()
    msgs: List[dict] = list(messages)
    trace: List[dict] = []

    for iteration in range(1, max_iters + 1):
        response = chat_fn(
            model=model,
            messages=msgs,
            api_keys=api_keys,
            tools=tools,
            stream=False,
        )
        message = response["choices"][0]["message"]
        calls = parse_tool_calls(response)

        if not calls:
            return {
                "content": message.get("content") or "",
                "trace": trace,
                "iterations": iteration,
            }

        # Rejoue le message assistant (avec ses tool_calls) puis les resultats d'outils.
        msgs.append({
            "role": "assistant",
            "content": message.get("content"),
            "tool_calls": message.get("tool_calls"),
        })
        for call in calls:
            try:
                result = execute_tool_call(
                    call["name"], call["arguments"],
                    bridge_url=bridge_url, http_client=http_client,
                )
            except Exception as exc:  # noqa: BLE001
                result = f"Erreur outil {call['name']}: {exc}"
            trace.append({
                "tool": call["name"],
                "arguments": call["arguments"],
                "result": result[:500],
            })
            msgs.append({
                "role": "tool",
                "tool_call_id": call["id"],
                "name": call["name"],
                "content": result,
            })

    return {
        "content": "Limite d'iterations d'outils atteinte sans reponse finale.",
        "trace": trace,
        "iterations": max_iters,
    }
