"""Tests pour predict_trend.py — pur Python, zéro dépendance QGIS."""

import pytest

from QGISIA2.predict_trend import classify_trend, linear_trend, project


class TestLinearTrend:
    def test_perfect_line_slope_one(self) -> None:
        points = [(0.0, 0.0), (1.0, 1.0), (2.0, 2.0)]
        result = linear_trend(points)
        assert result["slope"] == pytest.approx(1.0, abs=1e-6)
        assert result["intercept"] == pytest.approx(0.0, abs=1e-6)
        assert result["r2"] == pytest.approx(1.0, abs=1e-6)

    def test_insufficient_points(self) -> None:
        result = linear_trend([(0.0, 0.0)])
        assert result["slope"] == 0.0
        assert result["intercept"] == 0.0
        assert result["r2"] == 0.0

    def test_vertical_x_returns_zero_slope(self) -> None:
        result = linear_trend([(1.0, 2.0), (1.0, 3.0)])
        assert result["slope"] == 0.0


class TestProject:
    def test_project_increasing(self) -> None:
        points = [(0.0, 0.0), (1.0, 1.0), (2.0, 2.0)]
        future = project(points, 3)
        assert future == pytest.approx([3.0, 4.0, 5.0], abs=1e-6)

    def test_empty_points(self) -> None:
        assert project([], 2) == []

    def test_zero_horizon(self) -> None:
        assert project([(0.0, 0.0)], 0) == []


class TestClassifyTrend:
    def test_degradation(self) -> None:
        assert classify_trend(-0.5) == "degradation"

    def test_amelioration(self) -> None:
        assert classify_trend(0.5) == "amelioration"

    def test_stable(self) -> None:
        assert classify_trend(0.005) == "stable"
        assert classify_trend(-0.005) == "stable"
        assert classify_trend(0.0) == "stable"
