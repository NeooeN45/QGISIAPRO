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
EARTH_SEARCH_STAC = "https://earth-search.aws.element84.com/v1/search"
WIKIPEDIA_SUMMARY = "https://fr.wikipedia.org/api/rest_v1/page/summary/"

_USER_AGENT = "QGISIA-Plus/3.4 (assistant SIG ; contact qgisai.plus@gmail.com)"


def _default_get_json(url: str, params: dict, timeout: float = 20.0) -> Any:
    """GET JSON via la stdlib (pas de dependance externe). Respecte un User-Agent."""
    query = urllib.parse.urlencode(params or {})
    full = f"{url}?{query}" if query else url
    req = urllib.request.Request(full, headers={"User-Agent": _USER_AGENT})
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


def _search_satellite(args: dict, get_json: Callable) -> dict:
    collection = args.get("collection", "sentinel-2-l2a")
    limit = int(args.get("limit", 5))
    params = {"collections": collection, "limit": limit}
    bbox = args.get("bbox")
    if isinstance(bbox, (list, tuple)):
        bbox = ",".join(str(x) for x in bbox)
    if bbox:
        params["bbox"] = bbox
    if args.get("datetime"):
        params["datetime"] = args["datetime"]
    data = get_json(EARTH_SEARCH_STAC, params)
    feats = (data or {}).get("features", []) or []
    items = []
    for f in feats[:limit]:
        props = f.get("properties", {}) or {}
        assets = f.get("assets", {}) or {}
        items.append({
            "id": f.get("id"),
            "datetime": props.get("datetime"),
            "cloud_cover": props.get("eo:cloud_cover"),
            "thumbnail": (assets.get("thumbnail", {}) or {}).get("href"),
        })
    return {"collection": collection, "count": len(items), "items": items}


def _list_symbology_presets(args: dict, get_json: Callable) -> dict:
    try:
        from symbology_presets import list_presets  # type: ignore
    except ImportError:
        from .symbology_presets import list_presets  # type: ignore
    return {"presets": list_presets()}


def _list_data_sources(args: dict, get_json: Callable) -> dict:
    try:
        from data_catalog import list_sources  # type: ignore
    except ImportError:
        from .data_catalog import list_sources  # type: ignore
    sources = list_sources(args.get("category"))
    return {"count": len(sources), "sources": sources}


def _generate_layer_style(args: dict, get_json: Callable) -> dict:
    """Genere un style QGIS (.qml) a partir d'une legende [{label,color,geometry}]."""
    try:
        from map_repro import legend_to_qml  # type: ignore
    except ImportError:
        from .map_repro import legend_to_qml  # type: ignore
    legend = args.get("legend") or []
    field = args.get("field", "classe")
    geometry = args.get("geometry")
    qml = legend_to_qml(legend, field=field, geometry=geometry)
    return {"qml": qml, "categories": len(legend), "field": field}


def _wikipedia(args: dict, get_json: Callable) -> dict:
    title = args.get("query") or args.get("title") or ""
    data = get_json(WIKIPEDIA_SUMMARY + urllib.parse.quote(title), {})
    urls = (data or {}).get("content_urls", {}) or {}
    return {
        "title": data.get("title"),
        "extract": data.get("extract"),
        "url": (urls.get("desktop", {}) or {}).get("page"),
    }


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
    NativeTool(
        name="search_satellite_imagery",
        description=(
            "Rechercher des images satellite ouvertes via le catalogue STAC Earth "
            "Search (sans cle). Collections: 'sentinel-2-l2a' (optique), "
            "'sentinel-1-grd' (radar), 'landsat-c2-l2'. Filtrer par emprise (bbox) "
            "et periode (datetime). Renvoie id, date, couverture nuageuse, apercu."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "collection": {
                    "type": "string",
                    "enum": ["sentinel-2-l2a", "sentinel-1-grd", "landsat-c2-l2"],
                    "default": "sentinel-2-l2a",
                },
                "bbox": {
                    "type": "string",
                    "description": "Emprise 'minlon,minlat,maxlon,maxlat' (WGS84)",
                },
                "datetime": {
                    "type": "string",
                    "description": "Periode ISO, ex: '2025-06-01/2025-06-30'",
                },
                "limit": {"type": "integer", "default": 5},
            },
            "required": ["bbox"],
        },
        executor=_search_satellite,
    ),
    NativeTool(
        name="list_data_sources",
        description=(
            "Lister les sources cartographiques mondiales gratuites chargeables "
            "(fonds OSM/CARTO/ESRI, satellite, occupation du sol ESA WorldCover, "
            "IGN/Cadastre France...). Filtrer par 'category'. Enchainer avec "
            "addDataSource pour charger une source dans QGIS."
        ),
        input_schema={
            "type": "object",
            "properties": {"category": {"type": "string", "description": "ex: basemap, satellite, france, occupation_sol, relief"}},
        },
        executor=_list_data_sources,
    ),
    NativeTool(
        name="list_symbology_presets",
        description=(
            "Lister les symbologies institutionnelles francaises disponibles (ONF, "
            "IGN BD Foret, PLU, Cadastre, Corine Land Cover, PPRi, Natura 2000). "
            "Renvoie id, institution, champ attendu et nb de categories. A enchainer "
            "avec applySymbologyPreset pour appliquer."
        ),
        input_schema={"type": "object", "properties": {}},
        executor=_list_symbology_presets,
    ),
    NativeTool(
        name="generate_layer_style",
        description=(
            "Generer un style QGIS (.qml categorise) a partir d'une legende. "
            "A enchainer avec applyQmlStyle pour reproduire la symbologie d'une carte. "
            "Chaque entree de legende: {label, color (hex), geometry (polygon|line|point)}."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "legend": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "label": {"type": "string"},
                            "color": {"type": "string"},
                            "geometry": {"type": "string"},
                        },
                        "required": ["label", "color"],
                    },
                },
                "field": {"type": "string", "default": "classe"},
                "geometry": {"type": "string"},
            },
            "required": ["legend"],
        },
        executor=_generate_layer_style,
    ),
    NativeTool(
        name="wikipedia",
        description="Rechercher un resume factuel sur Wikipedia (FR) pour ancrer une reponse.",
        input_schema={
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Sujet ou titre d'article"}},
            "required": ["query"],
        },
        executor=_wikipedia,
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
