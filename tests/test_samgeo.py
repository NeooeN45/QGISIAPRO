# -*- coding: utf-8 -*-
"""
Tests unitaires SAMGeo tool — mockent samgeo/torch pour ne pas requérir
l'installation lourde (torch, segment-anything, model weights).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "QGISIA2"))

from samgeo_tool import (  # noqa: E402
    DEFAULT_MODEL,
    SUPPORTED_MODELS,
    SAMGeoSegmenter,
    SAMGeoUnavailableError,
    SegmentationResult,
    _count_features,
    is_available,
    segment_raster_to_geojson,
)


# ─── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def fake_raster(tmp_path: Path) -> Path:
    """Crée un fichier raster vide (juste pour que .exists() soit True)."""
    raster = tmp_path / "input.tif"
    raster.write_bytes(b"GeoTIFF placeholder")
    return raster


@pytest.fixture
def fake_geojson_output(tmp_path: Path) -> Path:
    out = tmp_path / "output.geojson"
    return out


def _write_feature_collection(path: Path, n_features: int) -> None:
    fc = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
                },
                "properties": {"id": i},
            }
            for i in range(n_features)
        ],
    }
    path.write_text(json.dumps(fc), encoding="utf-8")


# ─── is_available ─────────────────────────────────────────────────────────────


def test_should_report_unavailable_when_torch_missing():
    with patch.dict(sys.modules, {"torch": None}):
        with patch("builtins.__import__", side_effect=ImportError("No module named 'torch'")):
            ok, reason = is_available()
            assert ok is False
            assert "torch" in reason.lower()


def test_should_report_available_when_imports_succeed():
    fake_torch = MagicMock()
    fake_samgeo = MagicMock()
    with patch.dict(sys.modules, {"torch": fake_torch, "samgeo": fake_samgeo}):
        ok, reason = is_available()
        assert ok is True
        assert reason == ""


# ─── SAMGeoSegmenter ──────────────────────────────────────────────────────────


def test_should_reject_unknown_model():
    with pytest.raises(ValueError, match="non supporté"):
        SAMGeoSegmenter(model="vit_xxl")


def test_should_use_default_model_when_unspecified():
    seg = SAMGeoSegmenter()
    assert seg.model == DEFAULT_MODEL
    assert DEFAULT_MODEL in SUPPORTED_MODELS


def test_should_compute_checkpoint_path_per_model(tmp_path: Path):
    seg = SAMGeoSegmenter(model="vit_b", cache_dir=tmp_path)
    assert seg.checkpoint_path.name == "sam_vit_b_01ec64.pth"
    assert seg.checkpoint_path.parent == tmp_path


# ─── segment_automatic (mocked) ──────────────────────────────────────────────


def test_should_raise_unavailable_when_samgeo_missing(fake_raster, fake_geojson_output):
    seg = SAMGeoSegmenter()
    with patch("samgeo_tool.is_available", return_value=(False, "samgeo non installé")):
        with pytest.raises(SAMGeoUnavailableError, match="samgeo non installé"):
            seg.segment_automatic(str(fake_raster), str(fake_geojson_output))


def test_should_raise_filenotfound_when_raster_missing(tmp_path: Path):
    seg = SAMGeoSegmenter()
    missing = tmp_path / "missing.tif"
    out = tmp_path / "out.geojson"
    with patch("samgeo_tool.is_available", return_value=(True, "")):
        with pytest.raises(FileNotFoundError):
            seg.segment_automatic(str(missing), str(out))


def test_should_call_samgeo_generate_and_raster_to_vector(fake_raster, fake_geojson_output):
    fake_sam = MagicMock()

    # Le module samgeo doit être importable et exposer SamGeo
    fake_module = MagicMock()
    fake_module.SamGeo = MagicMock(return_value=fake_sam)

    with patch("samgeo_tool.is_available", return_value=(True, "")):
        with patch.dict(sys.modules, {"samgeo": fake_module}):
            # raster_to_vector écrit le geojson final → on simule
            def fake_raster_to_vector(_mask, out_geojson, **kwargs):
                _write_feature_collection(Path(out_geojson), n_features=3)

            fake_sam.raster_to_vector.side_effect = fake_raster_to_vector

            seg = SAMGeoSegmenter(model="vit_b")
            result = seg.segment_automatic(
                str(fake_raster),
                str(fake_geojson_output),
                min_area_px=50,
            )

    assert result.ok is True
    assert result.feature_count == 3
    assert result.model == "vit_b"
    assert "3 polygones" in result.message
    fake_sam.generate.assert_called_once()
    fake_sam.raster_to_vector.assert_called_once()
    # samgeo v3 : min_area n'est plus transmis a raster_to_vector (rejete par le driver GeoJSON)
    _, kwargs = fake_sam.raster_to_vector.call_args
    assert "min_area" not in kwargs


# ─── segment_text_prompt (mocked) ────────────────────────────────────────────


def test_should_raise_unavailable_when_langsam_missing(fake_raster, fake_geojson_output):
    """
    Quand samgeo.text_sam ne contient pas LangSAM, segment_text_prompt doit
    lever SAMGeoUnavailableError. On simule en injectant un faux module
    samgeo.text_sam vide dans sys.modules.
    """
    seg = SAMGeoSegmenter()
    fake_text_sam = MagicMock(spec=[])  # spec=[] => pas d'attribut LangSAM
    fake_samgeo = MagicMock()
    with patch("samgeo_tool.is_available", return_value=(True, "")):
        with patch.dict(
            sys.modules,
            {"samgeo": fake_samgeo, "samgeo.text_sam": fake_text_sam},
        ):
            with pytest.raises(SAMGeoUnavailableError, match="LangSAM"):
                seg.segment_text_prompt(
                    str(fake_raster), "trees", str(fake_geojson_output),
                )


# ─── segment_raster_to_geojson (API publique) ────────────────────────────────


def test_should_reject_text_mode_without_prompt():
    with pytest.raises(ValueError, match="text_prompt"):
        segment_raster_to_geojson("a.tif", "b.geojson", mode="text_prompt")


def test_should_reject_unknown_mode():
    with pytest.raises(ValueError, match="Mode inconnu"):
        segment_raster_to_geojson("a.tif", "b.geojson", mode="bogus")


# ─── _count_features ──────────────────────────────────────────────────────────


def test_should_count_zero_when_file_missing(tmp_path: Path):
    assert _count_features(tmp_path / "nope.geojson") == 0


def test_should_count_features_in_valid_geojson(tmp_path: Path):
    p = tmp_path / "ok.geojson"
    _write_feature_collection(p, n_features=7)
    assert _count_features(p) == 7


def test_should_return_zero_on_invalid_json(tmp_path: Path):
    p = tmp_path / "bad.geojson"
    p.write_text("not json", encoding="utf-8")
    assert _count_features(p) == 0


# ─── SegmentationResult dataclass ────────────────────────────────────────────


def test_segmentation_result_immutable_fields():
    r = SegmentationResult(
        ok=True,
        geojson_path="/tmp/out.geojson",
        feature_count=42,
        message="ok",
        model="vit_h",
        duration_s=12.3,
    )
    assert r.ok is True
    assert r.feature_count == 42
    assert r.duration_s == pytest.approx(12.3)
