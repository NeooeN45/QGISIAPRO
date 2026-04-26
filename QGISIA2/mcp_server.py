# -*- coding: utf-8 -*-
"""
QGISIA+ MCP Server.

Expose les outils QGIS du plugin via le protocole Model Context Protocol
(https://modelcontextprotocol.io) pour permettre a des clients externes
(Claude Desktop, Cursor, Cline, Continue) d'appeler les outils SIG.

Architecture :
    Client MCP (Claude Desktop)  <-- stdio JSON-RPC -->  Ce serveur
                                                                |
                                                     HTTP POST  v
                                                  /api/qgis/* du plugin QGIS
                                                  (dev_server.py port 8157)

Dependances :
    pip install mcp httpx

Usage CLI (stdio) :
    python -m QGISIA2.mcp_server

Configuration Claude Desktop (`claude_desktop_config.json`) :
    {
      "mcpServers": {
        "qgisia-plus": {
          "command": "python",
          "args": ["-m", "QGISIA2.mcp_server"],
          "env": { "QGISIA_BRIDGE_URL": "http://localhost:8157" }
        }
      }
    }
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Optional

# Default bridge URL (overridable via env var)
DEFAULT_BRIDGE_URL = os.environ.get("QGISIA_BRIDGE_URL", "http://localhost:8157")


# ─── Catalogue des outils exposes en MCP ──────────────────────────────────────


@dataclass
class McpToolSpec:
    """
    Descripteur d'outil MCP. Le mapping `endpoint` indique l'endpoint HTTP
    correspondant cote bridge QGIS, et `payload_builder` transforme les
    arguments MCP vers le payload attendu par le bridge.
    """
    name: str
    description: str
    input_schema: dict[str, Any]
    endpoint: str
    payload_builder: Callable[[dict[str, Any]], dict[str, Any]]


def _options_payload(args: dict[str, Any]) -> dict[str, Any]:
    """La majorite des slots @BridgeSlot acceptent un seul JSON 'options'."""
    return {"options": json.dumps(args)}


TOOL_CATALOG: list[McpToolSpec] = [
    McpToolSpec(
        name="loadHubEauStations",
        description=(
            "Charger des stations Hub'Eau (qualite eau, hydrometrie, piezometrie) "
            "comme couche QGIS. Departement FR ou code commune."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "station_type": {"type": "string", "enum": ["quality", "hydro", "piezo"]},
                "department": {"type": "string", "description": "Code dept FR (ex: '31')"},
                "commune": {"type": "string"},
                "limit": {"type": "integer", "default": 100},
                "layerName": {"type": "string"},
            },
            "required": ["station_type"],
        },
        endpoint="/api/qgis/loadHubEauStations",
        payload_builder=_options_payload,
    ),
    McpToolSpec(
        name="loadGbifOccurrences",
        description=(
            "Charger des occurrences d'especes GBIF (biodiversite mondiale) "
            "comme couche QGIS de points."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "scientificName": {"type": "string"},
                "country": {"type": "string", "default": "FR"},
                "limit": {"type": "integer", "default": 100},
                "layerName": {"type": "string"},
            },
            "required": ["scientificName"],
        },
        endpoint="/api/qgis/loadGbifOccurrences",
        payload_builder=_options_payload,
    ),
    McpToolSpec(
        name="loadDvfTransactions",
        description=(
            "Charger des transactions immobilieres DVF (Demandes de Valeurs "
            "Foncieres) comme couche QGIS."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "commune": {"type": "string"},
                "department": {"type": "string"},
                "year": {"type": "integer"},
                "mutationType": {"type": "string"},
                "layerName": {"type": "string"},
            },
        },
        endpoint="/api/qgis/loadDvfTransactions",
        payload_builder=_options_payload,
    ),
    McpToolSpec(
        name="segmentRasterWithSAM",
        description=(
            "Segmenter un raster (orthophoto, image satellite) avec Segment "
            "Anything (SAM). Mode 'automatic' ou 'text_prompt' (ex: 'trees', "
            "'buildings', 'water'). Necessite samgeo + torch cote backend."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "rasterPath": {"type": "string"},
                "outputGeojson": {"type": "string"},
                "mode": {"type": "string", "enum": ["automatic", "text_prompt"]},
                "textPrompt": {"type": "string"},
                "model": {"type": "string", "enum": ["vit_h", "vit_l", "vit_b"]},
            },
            "required": ["rasterPath", "outputGeojson"],
        },
        endpoint="/api/qgis/segmentRasterWithSAM",
        payload_builder=_options_payload,
    ),
    McpToolSpec(
        name="forecastWeatherWithEarth2",
        description=(
            "Prevision meteo globale via NVIDIA Earth-2 Studio (FourCastNet, "
            "Pangu, AIFS, GraphCast). Sortie GeoTIFF par variable."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "outputDir": {"type": "string"},
                "model": {"type": "string", "enum": ["fcn", "pangu", "aifs", "graphcast"]},
                "initTime": {"type": "string"},
                "leadHours": {"type": "integer"},
                "variables": {"type": "array", "items": {"type": "string"}},
                "layerPrefix": {"type": "string"},
            },
            "required": ["outputDir"],
        },
        endpoint="/api/qgis/forecastWeatherWithEarth2",
        payload_builder=_options_payload,
    ),
    McpToolSpec(
        name="exportProjectReport",
        description=(
            "Exporter un rapport SIG du projet QGIS courant en PDF ou DOCX, "
            "incluant snapshot carte, tableau couches et sections personnalisees."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "outputPath": {"type": "string"},
                "format": {"type": "string", "enum": ["pdf", "docx"]},
                "author": {"type": "string"},
                "subtitle": {"type": "string"},
                "includeLayers": {"type": "boolean"},
                "includeMap": {"type": "boolean"},
            },
            "required": ["title", "outputPath"],
        },
        endpoint="/api/qgis/exportProjectReport",
        payload_builder=_options_payload,
    ),
    McpToolSpec(
        name="getLayersList",
        description="Lister les couches du projet QGIS courant.",
        input_schema={"type": "object", "properties": {}},
        endpoint="/api/qgis/getLayersList",
        payload_builder=lambda _args: {},
    ),
    McpToolSpec(
        name="runScript",
        description=(
            "Executer un script PyQGIS arbitraire dans le contexte du projet. "
            "DANGER : aucune validation. Reserve aux power users."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "script": {"type": "string", "description": "Code PyQGIS a executer"},
            },
            "required": ["script"],
        },
        endpoint="/api/qgis/runScript",
        payload_builder=lambda args: {"script": args.get("script", "")},
    ),
]


def get_tool(name: str) -> Optional[McpToolSpec]:
    return next((t for t in TOOL_CATALOG if t.name == name), None)


# ─── Pont HTTP vers le bridge QGIS ────────────────────────────────────────────


class BridgeUnavailableError(RuntimeError):
    """Levee si le bridge QGIS HTTP est inaccessible."""


async def call_bridge(
    endpoint: str,
    payload: dict[str, Any],
    *,
    bridge_url: str = DEFAULT_BRIDGE_URL,
    timeout: float = 60.0,
    http_client: Any = None,
) -> str:
    """
    Appelle le bridge HTTP QGIS et retourne le texte de reponse.

    `http_client` permet l'injection de dependance pour les tests (un mock
    avec methode async post()).
    """
    url = f"{bridge_url.rstrip('/')}{endpoint}"
    if http_client is not None:
        client = http_client
        owns_client = False
    else:
        try:
            import httpx  # type: ignore
        except ImportError as e:
            raise BridgeUnavailableError(
                f"httpx requis pour le serveur MCP : {e}. "
                "Installe via 'pip install httpx mcp'.",
            ) from e
        client = httpx.AsyncClient(timeout=timeout)
        owns_client = True

    try:
        resp = await client.post(url, json=payload)
        if hasattr(resp, "raise_for_status"):
            resp.raise_for_status()
        return resp.text if hasattr(resp, "text") else str(resp)
    finally:
        if owns_client:
            close = getattr(client, "aclose", None)
            if close is not None:
                await close()


# ─── Dispatch MCP ─────────────────────────────────────────────────────────────


async def dispatch_tool_call(
    name: str,
    arguments: dict[str, Any],
    *,
    bridge_url: str = DEFAULT_BRIDGE_URL,
    http_client: Any = None,
) -> str:
    """
    Resout un appel d'outil MCP : valide le nom, construit le payload,
    appelle le bridge HTTP, retourne le texte resultat.

    Pure fonction testable sans le SDK MCP.
    """
    spec = get_tool(name)
    if spec is None:
        raise ValueError(f"Outil MCP inconnu : {name}")

    payload = spec.payload_builder(arguments or {})
    return await call_bridge(
        spec.endpoint,
        payload,
        bridge_url=bridge_url,
        http_client=http_client,
    )


def list_tool_specs() -> list[dict[str, Any]]:
    """Format JSON serialisable du catalogue (pour debug et tests)."""
    return [
        {
            "name": t.name,
            "description": t.description,
            "inputSchema": t.input_schema,
            "endpoint": t.endpoint,
        }
        for t in TOOL_CATALOG
    ]


# ─── Lancement du serveur MCP stdio ───────────────────────────────────────────


def run_stdio_server() -> None:
    """
    Boucle principale : initialise le serveur MCP officiel et le lance
    en stdio. Bloquant. Importe le SDK 'mcp' uniquement ici pour ne pas
    casser l'import du module quand le SDK n'est pas installe (tests).
    """
    try:
        import asyncio
        from mcp.server import Server  # type: ignore
        from mcp.server.stdio import stdio_server  # type: ignore
        from mcp.types import TextContent, Tool  # type: ignore
    except ImportError as e:
        raise BridgeUnavailableError(
            f"SDK 'mcp' non installe : {e}. Installe via 'pip install mcp'.",
        ) from e

    server: Any = Server("qgisia-plus")

    @server.list_tools()
    async def _list_tools() -> list[Tool]:
        return [
            Tool(
                name=spec.name,
                description=spec.description,
                inputSchema=spec.input_schema,
            )
            for spec in TOOL_CATALOG
        ]

    @server.call_tool()
    async def _call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
        try:
            text = await dispatch_tool_call(name, arguments or {})
            return [TextContent(type="text", text=text)]
        except Exception as e:  # noqa: BLE001
            return [TextContent(type="text", text=f"Erreur : {e}")]

    async def _main() -> None:
        async with stdio_server() as (read_stream, write_stream):
            await server.run(read_stream, write_stream, server.create_initialization_options())

    asyncio.run(_main())


if __name__ == "__main__":  # pragma: no cover
    run_stdio_server()
