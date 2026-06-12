"""Tests pour legend_extractor.py — pur Python, zero dependance QGIS."""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import legend_extractor as le  # noqa: E402


class TestExtractLegendJson:
    def test_clean_json_array(self) -> None:
        text = '[{"label":"Foret","color":"#228B22","geometry":"polygon"}]'
        result = le.extract_legend_json(text)
        assert result == [{"label": "Foret", "color": "#228B22", "geometry": "polygon"}]

    def test_fenced_json(self) -> None:
        text = (
            "Voici la legende :\n```json\n"
            '[{"label":"Eau","color":"#1E90FF","geometry":"polygon"}]\n'
            "```\nMerci."
        )
        result = le.extract_legend_json(text)
        assert result == [{"label": "Eau", "color": "#1E90FF", "geometry": "polygon"}]

    def test_polluted_text(self) -> None:
        text = (
            "Bien sur ! Voici la legende extraite :\n\n"
            '[{"label":"Route","color":"#808080","geometry":"line"}]\n'
            "J'espere que cela vous aide."
        )
        result = le.extract_legend_json(text)
        assert result == [{"label": "Route", "color": "#808080", "geometry": "line"}]

    def test_french_bullet_list(self) -> None:
        text = (
            "- Foret : vert foncé\n"
            "- Eau : bleu clair\n"
            "- Route : gris"
        )
        result = le.extract_legend_json(text)
        assert len(result) == 3
        assert result[0]["label"] == "Foret"
        assert result[0]["color"] == "#1B5E20"
        assert result[1]["label"] == "Eau"
        assert result[1]["color"] == "#81D4FA"
        assert result[2]["label"] == "Route"
        assert result[2]["color"] == "#808080"

    def test_trailing_commas(self) -> None:
        text = '[{"label":"A","color":"red",}, {"label":"B","color":"blue",}]'
        result = le.extract_legend_json(text)
        assert len(result) == 2

    def test_single_quotes(self) -> None:
        text = "[{'label':'A','color':'red'}]"
        result = le.extract_legend_json(text)
        assert result == [{"label": "A", "color": "red", "geometry": ""}]

    def test_synonym_keys_fr(self) -> None:
        text = '[{"nom":"Foret","couleur":"vert","geometrie":"polygon"}]'
        result = le.extract_legend_json(text)
        assert result[0]["label"] == "Foret"
        assert result[0]["color"] == "vert"
        assert result[0]["geometry"] == "polygon"

    def test_synonym_keys_en(self) -> None:
        text = '[{"name":"Water","hex":"#0000FF","geom":"line"}]'
        result = le.extract_legend_json(text)
        assert result[0]["label"] == "Water"
        assert result[0]["color"] == "#0000FF"
        assert result[0]["geometry"] == "line"

    def test_empty_text_returns_empty(self) -> None:
        assert le.extract_legend_json("") == []
        assert le.extract_legend_json("pas de json ici") == []

    def test_no_duplicate_geometries_in_bullets(self) -> None:
        text = "• Zone A : rouge"
        result = le.extract_legend_json(text)
        assert len(result) == 1
        assert result[0]["geometry"] == ""


class TestResolveColorWords:
    def test_dark_green_fr(self) -> None:
        assert le.resolve_color_words("vert foncé") == "#1B5E20"

    def test_light_blue_fr(self) -> None:
        assert le.resolve_color_words("bleu clair") == "#81D4FA"

    def test_pale_red_fr(self) -> None:
        assert le.resolve_color_words("rouge pâle") == "#FFCDD2"

    def test_dark_green_en(self) -> None:
        assert le.resolve_color_words("dark green") == "#1B5E20"

    def test_unknown_color(self) -> None:
        assert le.resolve_color_words("inconnu") is None
        assert le.resolve_color_words("") is None


class TestBuildVlmLegendPrompt:
    def test_contains_schema(self) -> None:
        prompt = le.build_vlm_legend_prompt("carte de vegetation")
        assert "label" in prompt
        assert "color" in prompt
        assert "geometry" in prompt
        assert "JSON" in prompt
        assert "carte de vegetation" in prompt

    def test_french_strict(self) -> None:
        prompt = le.build_vlm_legend_prompt("test")
        assert "UNIQUEMENT" in prompt
        assert "sans markdown" in prompt.lower()


class TestRepairLegend:
    def test_full_pipeline(self) -> None:
        raw = [
            {"label": "Foret", "color": "vert foncé", "geometry": "polygon"},
            {"label": "Eau", "color": "bleu clair", "geometry": ""},
            {"label": "Foret", "color": "#1B5E20", "geometry": "polygon"},
        ]
        result = le.repair_legend(raw)
        legend = result["legend"]
        warnings = result["warnings"]
        assert len(legend) == 2
        assert legend[0]["color"] == "#1b5e20"
        assert legend[1]["geometry"] == "polygon"  # inferé par défaut
        assert any("Couleur" in w for w in warnings)
        assert any("Geometry" in w for w in warnings)
        assert any("duplique" in w for w in warnings)

    def test_empty_legend(self) -> None:
        result = le.repair_legend([])
        assert result["legend"] == []
        assert any("Aucune" in w for w in result["warnings"])

    def test_geometry_inference(self) -> None:
        raw = [
            {"label": "Route principale", "color": "#808080", "geometry": ""},
            {"label": "Station meteo", "color": "#FF0000", "geometry": ""},
            {"label": "Zone humide", "color": "#0000FF", "geometry": ""},
        ]
        result = le.repair_legend(raw)
        legend = result["legend"]
        assert legend[0]["geometry"] == "line"
        assert legend[1]["geometry"] == "point"
        assert legend[2]["geometry"] == "polygon"

    def test_color_word_resolution(self) -> None:
        raw = [{"label": "Marais", "color": "vert pâle", "geometry": "polygon"}]
        result = le.repair_legend(raw)
        assert result["legend"][0]["color"] == "#c8e6c9"
        assert any("resolue" in w for w in result["warnings"])

    def test_invalid_color_filtered(self) -> None:
        raw = [
            {"label": "X", "color": "couleur_inconnue", "geometry": "polygon"},
            {"label": "Y", "color": "#FF0000", "geometry": "polygon"},
        ]
        result = le.repair_legend(raw)
        assert len(result["legend"]) == 1
        assert result["legend"][0]["label"] == "Y"
        assert any("non reconnue" in w for w in result["warnings"])

    def test_valid_hex_preserved(self) -> None:
        raw = [{"label": "Rouge", "color": "#FF0000", "geometry": "polygon"}]
        result = le.repair_legend(raw)
        assert result["legend"][0]["color"] == "#ff0000"
        assert "warnings" in result
