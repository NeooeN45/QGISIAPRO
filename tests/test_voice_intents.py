"""Tests pour voice_intents.py — pur Python, zéro dépendance QGIS."""

import pytest

from QGISIA2.voice_intents import list_actions, parse_intent


class TestParseIntent:
    def test_buffer_with_distance(self) -> None:
        result = parse_intent("fais un buffer de 500m")
        assert result["action"] == "buffer"
        assert result["params"]["distance"] == 500

    def test_buffer_without_distance(self) -> None:
        result = parse_intent("crée un buffer")
        assert result["action"] == "buffer"
        assert "distance" not in result["params"]

    def test_compute_ndvi(self) -> None:
        result = parse_intent("calcule le ndvi")
        assert result["action"] == "compute_ndvi"

    def test_add_basemap(self) -> None:
        result = parse_intent("ajoute un fond de carte")
        assert result["action"] == "add_basemap"

    def test_load_satellite(self) -> None:
        result = parse_intent("charge une image satellite")
        assert result["action"] == "load_satellite"

    def test_export_layout(self) -> None:
        result = parse_intent("exporte la mise en page en pdf")
        assert result["action"] == "export_layout"

    def test_empty_text(self) -> None:
        result = parse_intent("")
        assert result["action"] == "unknown"

    def test_unknown_text(self) -> None:
        result = parse_intent("bonjour comment ça va")
        assert result["action"] == "unknown"


class TestListActions:
    def test_contains_all_actions(self) -> None:
        actions = list_actions()
        expected = {"add_basemap", "compute_ndvi", "buffer", "load_satellite", "export_layout", "unknown"}
        assert set(actions) == expected
