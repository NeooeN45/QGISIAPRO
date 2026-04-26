# -*- coding: utf-8 -*-
"""
Tests unitaires Earth-2 Studio tool — mocks earth2studio + torch + xarray
pour ne pas requérir installation lourde (~2 GB).
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "QGISIA2"))

from earth2_tool import (  # noqa: E402
    DEFAULT_MODEL,
    DEFAULT_VARIABLES,
    MAX_LEAD_HOURS,
    SUPPORTED_MODELS,
    SUPPORTED_VARIABLES,
    Earth2Forecaster,
    Earth2UnavailableError,
    ForecastResult,
    _parse_init_time,
    _validate_lead_hours,
    _validate_variables,
    forecast_weather,
    is_available,
)


# ─── is_available ─────────────────────────────────────────────────────────────


def test_should_report_available_when_all_imports_succeed():
    fake_modules = {
        "torch": MagicMock(),
        "xarray": MagicMock(),
        "earth2studio": MagicMock(),
    }
    with patch.dict(sys.modules, fake_modules):
        ok, reason = is_available()
        assert ok is True
        assert reason == ""


def test_should_report_unavailable_when_earth2studio_missing():
    # Simule l'absence de earth2studio en le retirant de sys.modules
    fake_modules = {"torch": MagicMock(), "xarray": MagicMock()}
    with patch.dict(sys.modules, fake_modules):
        # earth2studio n'est pas dans fake_modules → ImportError au runtime
        original = sys.modules.pop("earth2studio", None)
        try:
            ok, reason = is_available()
            assert ok is False
            assert "earth2studio" in reason.lower()
        finally:
            if original is not None:
                sys.modules["earth2studio"] = original


# ─── Validation ───────────────────────────────────────────────────────────────


def test_should_reject_unknown_model():
    with pytest.raises(ValueError, match="non supporté"):
        Earth2Forecaster(model="meteor")


def test_should_use_default_model():
    f = Earth2Forecaster()
    assert f.model == DEFAULT_MODEL
    assert DEFAULT_MODEL in SUPPORTED_MODELS


def test_validate_lead_hours_accepts_valid_range():
    assert _validate_lead_hours(1) == 1
    assert _validate_lead_hours(24) == 24
    assert _validate_lead_hours(MAX_LEAD_HOURS) == MAX_LEAD_HOURS


def test_validate_lead_hours_rejects_zero_and_negative():
    with pytest.raises(ValueError):
        _validate_lead_hours(0)
    with pytest.raises(ValueError):
        _validate_lead_hours(-1)


def test_validate_lead_hours_rejects_above_max():
    with pytest.raises(ValueError, match="dépasse le maximum"):
        _validate_lead_hours(MAX_LEAD_HOURS + 1)


def test_validate_variables_returns_default_when_empty():
    assert _validate_variables([]) == list(DEFAULT_VARIABLES)


def test_validate_variables_normalizes_and_dedupes():
    out = _validate_variables(["T2M", "msl", "T2M"])
    assert out == ["t2m", "msl"]


def test_validate_variables_rejects_unknown():
    with pytest.raises(ValueError, match="non supportée"):
        _validate_variables(["temperature_at_42m"])


def test_validate_variables_supports_all_known():
    out = _validate_variables(list(SUPPORTED_VARIABLES))
    assert set(out) == set(SUPPORTED_VARIABLES)


# ─── _parse_init_time ─────────────────────────────────────────────────────────


def test_parse_init_time_default_aligns_to_6h_pivot():
    dt = _parse_init_time(None)
    assert dt.tzinfo == timezone.utc
    assert dt.hour in (0, 6, 12, 18)
    assert dt.minute == 0
    assert dt.second == 0


def test_parse_init_time_iso_with_z():
    dt = _parse_init_time("2026-04-26T00:00:00Z")
    assert dt == datetime(2026, 4, 26, 0, 0, 0, tzinfo=timezone.utc)


def test_parse_init_time_iso_without_tz_assumes_utc():
    dt = _parse_init_time("2026-04-26T12:00:00")
    assert dt.tzinfo == timezone.utc
    assert dt.hour == 12


def test_parse_init_time_rejects_garbage():
    with pytest.raises(ValueError, match="ISO 8601"):
        _parse_init_time("not a date")


# ─── forecast_weather (API publique, mocked) ──────────────────────────────────


def test_forecast_weather_raises_when_unavailable():
    with patch("earth2_tool.is_available", return_value=(False, "torch absent")):
        with pytest.raises(Earth2UnavailableError, match="torch absent"):
            forecast_weather("/tmp/out", lead_hours=24)


def test_forecast_weather_validates_lead_hours_before_loading_model(tmp_path: Path):
    with patch("earth2_tool.is_available", return_value=(True, "")):
        with pytest.raises(ValueError, match="dépasse"):
            forecast_weather(str(tmp_path), lead_hours=999)


def test_forecast_weather_validates_variables(tmp_path: Path):
    with patch("earth2_tool.is_available", return_value=(True, "")):
        with pytest.raises(ValueError, match="non supportée"):
            forecast_weather(str(tmp_path), variables=["bogus_var"])


# ─── ForecastResult dataclass ─────────────────────────────────────────────────


def test_forecast_result_dataclass():
    r = ForecastResult(
        ok=True,
        geotiff_paths=["/tmp/a.tif"],
        variables=["t2m"],
        model="fcn",
        lead_hours=24,
        init_time="2026-04-26T00:00:00+00:00",
        duration_s=42.5,
        message="OK",
    )
    assert r.ok is True
    assert r.lead_hours == 24
    assert r.duration_s == pytest.approx(42.5)


# ─── _save_geotiff (mocked rioxarray) ────────────────────────────────────────


def test_save_geotiff_raises_when_rioxarray_missing(tmp_path: Path):
    f = Earth2Forecaster()
    fake_da = MagicMock()
    fake_da.dims = ("y", "x")
    # Force ImportError sur rioxarray via builtins.__import__
    import builtins
    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "rioxarray":
            raise ImportError("rioxarray not installed (mocked)")
        return real_import(name, *args, **kwargs)

    with patch("builtins.__import__", side_effect=fake_import):
        with pytest.raises(Earth2UnavailableError, match="rioxarray"):
            f._save_geotiff(fake_da, tmp_path / "out.tif")
