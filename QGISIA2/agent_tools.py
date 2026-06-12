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

try:
    from native_tools import (
        native_tool_names,
        execute_native_tool,
        to_openai_tools as _native_openai_tools,
    )
except ImportError:  # pragma: no cover
    from .native_tools import (  # type: ignore
        native_tool_names,
        execute_native_tool,
        to_openai_tools as _native_openai_tools,
    )


def to_openai_tools(catalog: Optional[List[McpToolSpec]] = None) -> List[dict]:
    """
    Convertit le catalogue d'outils au format OpenAI 'tools' (function calling).
    Par defaut : outils QGIS (bridge) + outils natifs (web/geo). Si `catalog` est
    fourni explicitement, on ne renvoie que celui-ci (sans les natifs).
    """
    specs = catalog if catalog is not None else TOOL_CATALOG
    tools = [
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
    if catalog is None:
        tools = tools + _native_openai_tools()
    return tools


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


# Outils executant du code/SQL arbitraire : a passer au crible des guardrails.
_CODE_EXEC_TOOLS = {"runScript", "runScriptDirect", "runScriptDetailed"}


def safety_check(name: str, arguments: dict, auto_mode: bool = False) -> tuple:
    """
    Garde-fou avant execution d'un outil. Retourne (allowed: bool, reason: str).
    Seuls les outils executant du code PyQGIS arbitraire sont audites via
    agent_guardrails (BLOCK toujours refuse ; CONFIRM refuse hors mode auto).
    """
    if name not in _CODE_EXEC_TOOLS:
        return True, ""
    code = (arguments or {}).get("script") or (arguments or {}).get("code") or ""
    try:
        try:
            from agent_guardrails import AgentGuardrails  # type: ignore
        except ImportError:
            from .agent_guardrails import AgentGuardrails  # type: ignore
    except Exception:  # noqa: BLE001 - garde-fou indispo : best effort, on n'execute pas a l'aveugle
        return False, "Module de securite indisponible : execution de code bloquee."
    result = AgentGuardrails(auto_mode=auto_mode).check_pyqgis_code(code)
    if getattr(result, "passed", False):
        return True, ""
    return False, getattr(result, "message", "") or "Action bloquee par la securite."


DEFAULT_AGENT_SYSTEM = (
    "Tu es un agent SIG expert integre dans QGIS. Pour accomplir la demande de "
    "l'utilisateur, raisonne brievement (1-3 etapes) puis APPELLE les outils QGIS "
    "disponibles (lister/filtrer/zoomer/styler les couches, executer un traitement, "
    "etc.). Ancre tes actions sur le contexte fourni (couches du projet, documents "
    "joints). N'invente pas d'identifiants de couche : utilise getLayersList si besoin. "
    "Quand la tache est accomplie, reponds en francais avec un resume clair et concis."
)


def run_tool_loop(
    messages: List[dict],
    api_keys: dict,
    *,
    model: str = "smart-default",
    max_iters: int = 30,
    auto_mode: bool = False,
    system: Optional[str] = None,
    bridge_url: str = DEFAULT_BRIDGE_URL,
    chat_fn: Any = None,
    http_client: Any = None,
    native_get_json: Any = None,
    on_event: Optional[Any] = None,  # Callable[[dict], None] — optionnel, retro-compatible
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
    # Amorce de planification/grounding si aucun message systeme n'est fourni.
    if not any(m.get("role") == "system" for m in msgs):
        msgs.insert(0, {"role": "system", "content": system or DEFAULT_AGENT_SYSTEM})
    trace: List[dict] = []

    def _emit(event: dict) -> None:
        """Emet un evenement SSE si le callback est fourni (sans exception)."""
        if on_event is not None:
            try:
                on_event(event)
            except Exception:  # noqa: BLE001
                pass

    for iteration in range(1, max_iters + 1):
        _emit({"type": "iteration", "i": iteration})
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
            _emit({"type": "tool_start", "tool": call["name"], "arguments": call["arguments"]})
            allowed, reason = safety_check(call["name"], call["arguments"], auto_mode)
            if not allowed:
                result = f"BLOQUE PAR SECURITE: {reason}"
                trace.append({
                    "tool": call["name"],
                    "arguments": call["arguments"],
                    "result": result,
                    "blocked": True,
                })
                _emit({"type": "tool_result", "tool": call["name"], "result": result[:300], "blocked": True})
            else:
                try:
                    if call["name"] in native_tool_names():
                        # Outil natif (web/geo) : execution en-process, hors bridge QGIS.
                        result = execute_native_tool(
                            call["name"], call["arguments"], get_json=native_get_json,
                        )
                    else:
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
                _emit({"type": "tool_result", "tool": call["name"], "result": result[:300], "blocked": False})
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
