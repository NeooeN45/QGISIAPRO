# -*- coding: utf-8 -*-
"""
Outils NATIFS de l'agent (web/geo-grounding) — executes en-process, sans QGIS
et sans cle API. Permettent au LLM de completer ses requetes avec des donnees
live : geocodage (Nominatim/OSM), meteo et elevation (Open-Meteo).

Toutes les sources sont gratuites et ouvertes. Le getter HTTP est injectable
pour les tests (`get_json`).
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable, List, Optional

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OPENMETEO_FORECAST = "https://api.open-meteo.com/v1/forecast"
OPENMETEO_ELEVATION = "https://api.open-meteo.com/v1/elevation"

_USER_AGENT = "QGISIA-Plus/3.4 (assistant SIG ; contact qgisai.plus@gmail.com)"


def _default_get_json(url: str, params: dict, timeout: float = 20.0) -> Any:
    """GET JSON via la stdlib (pas de dependance externe). Respecte un User-Agent."""
    query = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{url}?{query}", headers={"User-Agent": _USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 (URLs fixes/https)
        return json.loads(resp.read().decode("utf-8"))


@dataclass
class NativeTool:
    name: str
    description: str
    input_schema: dict
    executor: Callable[[dict, Callable], Any]


def _geocode(args: dict, get_json: Callable) -> dict:
    query = args.get("query") or args.get("address") or ""
    limit = int(args.get("limit", 5))
    params = {"q": query, "format": "json", "limit": limit}
    country = args.get("country")
    if country:
        params["countrycodes"] = country
    data = get_json(NOMINATIM_URL, params)
    results = [
        {
            "name": d.get("display_name"),
            "lat": float(d["lat"]),
            "lon": float(d["lon"]),
            "type": d.get("type"),
        }
        for d in (data or [])[:limit]
        if "lat" in d and "lon" in d
    ]
    return {"query": query, "count": len(results), "results": results}


def _weather(args: dict, get_json: Callable) -> dict:
    lat = float(args["lat"])
    lon = float(args["lon"])
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,precipitation,wind_speed_10m,weather_code",
    }
    data = get_json(OPENMETEO_FORECAST, params)
    return {"lat": lat, "lon": lon, "current": data.get("current", {}),
            "units": data.get("current_units", {})}


def _elevation(args: dict, get_json: Callable) -> dict:
    lat = float(args["lat"])
    lon = float(args["lon"])
    data = get_json(OPENMETEO_ELEVATION, {"latitude": lat, "longitude": lon})
    elevations = data.get("elevation") or []
    return {"lat": lat, "lon": lon,
            "elevation_m": elevations[0] if elevations else None}


NATIVE_TOOLS: List[NativeTool] = [
    NativeTool(
        name="geocode",
        description=(
            "Geocoder une adresse ou un lieu en coordonnees (lat/lon) via "
            "OpenStreetMap/Nominatim. Utile pour localiser avant une analyse SIG."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Adresse ou lieu, ex: 'Toulouse, France'"},
                "country": {"type": "string", "description": "Code pays ISO2 optionnel, ex: 'fr'"},
                "limit": {"type": "integer", "default": 5},
            },
            "required": ["query"],
        },
        executor=_geocode,
    ),
    NativeTool(
        name="weather",
        description="Meteo actuelle (temperature, precipitations, vent) a une position lat/lon via Open-Meteo.",
        input_schema={
            "type": "object",
            "properties": {
                "lat": {"type": "number"},
                "lon": {"type": "number"},
            },
            "required": ["lat", "lon"],
        },
        executor=_weather,
    ),
    NativeTool(
        name="elevation",
        description="Altitude (m) du terrain a une position lat/lon via Open-Meteo (Copernicus DEM).",
        input_schema={
            "type": "object",
            "properties": {
                "lat": {"type": "number"},
                "lon": {"type": "number"},
            },
            "required": ["lat", "lon"],
        },
        executor=_elevation,
    ),
]


def get_native_tool(name: str) -> Optional[NativeTool]:
    return next((t for t in NATIVE_TOOLS if t.name == name), None)


def native_tool_names() -> List[str]:
    return [t.name for t in NATIVE_TOOLS]


def to_openai_tools() -> List[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.input_schema,
            },
        }
        for t in NATIVE_TOOLS
    ]


def execute_native_tool(name: str, arguments: dict, get_json: Callable = None) -> str:
    """Execute un outil natif et retourne un texte JSON. `get_json` injectable (tests)."""
    tool = get_native_tool(name)
    if tool is None:
        raise ValueError(f"Outil natif inconnu : {name}")
    result = tool.executor(arguments or {}, get_json or _default_get_json)
    return json.dumps(result, ensure_ascii=False)
