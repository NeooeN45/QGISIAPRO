"""Tests pour terrain_formulas.py — pur Python, zéro dépendance QGIS."""

import pytest

from QGISIA2.terrain_formulas import (
    aspect_expression,
    hillshade_expression,
    list_terrain,
    ruggedness_expression,
    slope_expression,
)


class TestSlopeExpression:
    def test_contains_dem_ref(self) -> None:
        expr = slope_expression("dem@1", 1.0)
        assert "dem@1" in expr

    def test_contains_cellsize(self) -> None:
        expr = slope_expression("dem@1", 2.0)
        assert "2.0" in expr


class TestAspectExpression:
    def test_contains_dem_ref(self) -> None:
        expr = aspect_expression("dem@1", 1.0)
        assert "dem@1" in expr


class TestHillshadeExpression:
    def test_contains_dem_ref(self) -> None:
        expr = hillshade_expression("dem@1", 315.0, 45.0, 1.0)
        assert "dem@1" in expr

    def test_contains_azimuth_and_altitude(self) -> None:
        expr = hillshade_expression("dem@1", 315.0, 45.0, 1.0)
        assert "315.0" in expr
        assert "45.0" in expr

    def test_contains_cellsize(self) -> None:
        expr = hillshade_expression("dem@1", 315.0, 45.0, 2.5)
        assert "2.5" in expr

    def test_default_azimuth_altitude(self) -> None:
        expr = hillshade_expression("dem@1")
        assert "315.0" in expr
        assert "45.0" in expr


class TestRuggednessExpression:
    def test_contains_dem_ref(self) -> None:
        expr = ruggedness_expression("dem@1")
        assert "dem@1" in expr


class TestListTerrain:
    def test_has_at_least_four_entries(self) -> None:
        terrain = list_terrain()
        assert len(terrain) >= 4

    def test_expected_entries(self) -> None:
        terrain = list_terrain()
        assert "slope" in terrain
        assert "aspect" in terrain
        assert "hillshade" in terrain
        assert "ruggedness" in terrain
