# -*- coding: utf-8 -*-
"""Tests des outils natifs web/geo (HTTP mocke, aucun appel reseau)."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2" / "vendor"))
sys.path.insert(0, str(ROOT / "QGISIA2"))

import native_tools as nt  # noqa: E402


def test_geocode_parses_nominatim():
    def fake_get(url, params, timeout=20):
        assert "nominatim" in url
        assert params["q"] == "Toulouse"
        return [
            {"display_name": "Toulouse, France", "lat": "43.6045", "lon": "1.4442", "type": "city"},
            {"display_name": "Autre", "lat": "1.0", "lon": "2.0", "type": "x"},
        ]

    out = nt._geocode({"query": "Toulouse", "limit": 5}, fake_get)
    assert out["count"] == 2
    assert out["results"][0]["name"] == "Toulouse, France"
    assert out["results"][0]["lat"] == 43.6045
    assert out["results"][0]["lon"] == 1.4442


def test_weather_returns_current():
    def fake_get(url, params, timeout=20):
        assert "open-meteo" in url
        return {"current": {"temperature_2m": 18.3, "wind_speed_10m": 5.0},
                "current_units": {"temperature_2m": "°C"}}

    out = nt._weather({"lat": 43.6, "lon": 1.44}, fake_get)
    assert out["current"]["temperature_2m"] == 18.3
    assert out["units"]["temperature_2m"] == "°C"


def test_elevation_returns_first_value():
    def fake_get(url, params, timeout=20):
        return {"elevation": [152.0]}

    out = nt._elevation({"lat": 43.6, "lon": 1.44}, fake_get)
    assert out["elevation_m"] == 152.0


def test_execute_native_tool_returns_json_text():
    def fake_get(url, params, timeout=20):
        return [{"display_name": "Paris", "lat": "48.85", "lon": "2.35"}]

    text = nt.execute_native_tool("geocode", {"query": "Paris"}, get_json=fake_get)
    data = json.loads(text)
    assert data["results"][0]["name"] == "Paris"


def test_search_satellite_parses_stac():
    def fake_get(url, params, timeout=20):
        assert "earth-search" in url
        assert params["collections"] == "sentinel-2-l2a"
        assert params["bbox"] == "1.3,43.5,1.5,43.7"
        return {"features": [
            {"id": "S2_X", "properties": {"datetime": "2025-06-15T10:00:00Z", "eo:cloud_cover": 4.2},
             "assets": {"thumbnail": {"href": "http://img/thumb.jpg"}}},
        ]}

    out = nt._search_satellite(
        {"collection": "sentinel-2-l2a", "bbox": "1.3,43.5,1.5,43.7"}, fake_get)
    assert out["count"] == 1
    assert out["items"][0]["id"] == "S2_X"
    assert out["items"][0]["cloud_cover"] == 4.2
    assert out["items"][0]["thumbnail"] == "http://img/thumb.jpg"


def test_search_satellite_accepts_bbox_list():
    captured = {}

    def fake_get(url, params, timeout=20):
        captured["bbox"] = params.get("bbox")
        return {"features": []}

    nt._search_satellite({"bbox": [1.3, 43.5, 1.5, 43.7]}, fake_get)
    assert captured["bbox"] == "1.3,43.5,1.5,43.7"


def test_wikipedia_parses_summary():
    def fake_get(url, params, timeout=20):
        assert "wikipedia" in url
        return {"title": "Toulouse", "extract": "Toulouse est une commune...",
                "content_urls": {"desktop": {"page": "https://fr.wikipedia.org/wiki/Toulouse"}}}

    out = nt._wikipedia({"query": "Toulouse"}, fake_get)
    assert out["title"] == "Toulouse"
    assert "commune" in out["extract"]
    assert out["url"].endswith("/Toulouse")


def test_to_openai_tools_and_names():
    tools = nt.to_openai_tools()
    names = nt.native_tool_names()
    assert set(names) == {
        "geocode", "weather", "elevation", "search_satellite_imagery", "wikipedia"}
    for t in tools:
        assert t["type"] == "function"
        assert t["function"]["parameters"]["type"] == "object"


def test_execute_native_unknown_raises():
    import pytest
    with pytest.raises(ValueError):
        nt.execute_native_tool("doesNotExist", {})
