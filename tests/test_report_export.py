# -*- coding: utf-8 -*-
"""
Tests unitaires report_export — PDF/DOCX avec dependances optionnelles.
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "QGISIA2"))

from report_export import (  # noqa: E402
    ExportResult,
    LayerInfo,
    ReportConfig,
    ReportExportError,
    ReportSection,
    _validate_config,
    _validate_output_path,
    export_docx,
    export_pdf,
    export_report,
    is_docx_available,
    is_pdf_available,
)


# ─── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def basic_config() -> ReportConfig:
    return ReportConfig(
        title="Inventaire forestier 2026",
        subtitle="Parcelle test",
        author="Camille",
        layers=[
            LayerInfo(name="Parcelles", type="vector", crs="EPSG:2154",
                      feature_count=42, geometry_type="Polygon"),
            LayerInfo(name="MNT", type="raster", crs="EPSG:2154"),
        ],
        sections=[
            ReportSection(
                title="Synthese",
                body="Analyse de la parcelle.",
                bullets=["42 parcelles", "Surface totale 12.3 ha"],
            ),
            ReportSection(
                title="Statistiques",
                table_headers=["Essence", "Nombre", "Surface (ha)"],
                table_rows=[["Chene", "120", "5.2"], ["Hetre", "80", "3.1"]],
            ),
        ],
    )


# ─── Détection environnement ──────────────────────────────────────────────────


def test_is_pdf_available_when_reportlab_installed():
    ok, reason = is_pdf_available()
    # reportlab peut etre dispo ou non selon l'env de test
    assert isinstance(ok, bool)
    if not ok:
        assert "reportlab" in reason.lower()


def test_is_docx_available_when_python_docx_installed():
    ok, reason = is_docx_available()
    assert isinstance(ok, bool)
    if not ok:
        assert "python-docx" in reason.lower() or "docx" in reason.lower()


# ─── Validation ───────────────────────────────────────────────────────────────


def test_validate_config_rejects_empty_title():
    with pytest.raises(ValueError, match="titre"):
        _validate_config(ReportConfig(title=""))


def test_validate_config_accepts_minimal_config():
    _validate_config(ReportConfig(title="OK"))  # no raise


def test_validate_config_rejects_missing_map_image(tmp_path: Path):
    bogus = str(tmp_path / "ghost.png")
    with pytest.raises(ValueError, match="introuvable"):
        _validate_config(ReportConfig(title="x", map_image=bogus))


def test_validate_output_path_requires_extension(tmp_path: Path):
    with pytest.raises(ValueError, match="Extension attendue"):
        _validate_output_path(str(tmp_path / "rapport.txt"), ".pdf")


def test_validate_output_path_creates_parent_dir(tmp_path: Path):
    target = tmp_path / "sub" / "deep" / "rapport.pdf"
    p = _validate_output_path(str(target), ".pdf")
    assert p.parent.exists()


def test_validate_output_path_rejects_empty():
    with pytest.raises(ValueError, match="obligatoire"):
        _validate_output_path("", ".pdf")


# ─── ReportConfig dataclass ───────────────────────────────────────────────────


def test_layer_info_defaults():
    L = LayerInfo(name="x", type="vector")
    assert L.crs == ""
    assert L.feature_count is None


def test_report_section_defaults():
    s = ReportSection(title="x")
    assert s.bullets == []
    assert s.table_rows == []
    assert s.image_path is None


def test_export_result_dataclass():
    r = ExportResult(ok=True, output_path="/tmp/x.pdf", format="pdf",
                     pages_or_sections=3, duration_s=1.5, message="OK")
    assert r.ok and r.format == "pdf"


# ─── Erreurs sans dependances ─────────────────────────────────────────────────


def test_export_pdf_raises_when_reportlab_missing(basic_config, tmp_path):
    with patch("report_export.is_pdf_available", return_value=(False, "reportlab absent")):
        with pytest.raises(ReportExportError, match="reportlab"):
            export_pdf(basic_config, str(tmp_path / "rapport.pdf"))


def test_export_docx_raises_when_python_docx_missing(basic_config, tmp_path):
    with patch("report_export.is_docx_available", return_value=(False, "python-docx absent")):
        with pytest.raises(ReportExportError, match="python-docx"):
            export_docx(basic_config, str(tmp_path / "rapport.docx"))


def test_export_report_rejects_unsupported_format(basic_config, tmp_path):
    with pytest.raises(ValueError, match="non supporte"):
        export_report(basic_config, str(tmp_path / "x.pdf"), format="xlsx")


# ─── Tests d'integration (skip si deps absentes) ──────────────────────────────


@pytest.mark.skipif(
    not is_pdf_available()[0],
    reason="reportlab non installe",
)
def test_export_pdf_creates_file(basic_config: ReportConfig, tmp_path: Path):
    out = tmp_path / "rapport.pdf"
    result = export_pdf(basic_config, str(out))
    assert result.ok is True
    assert out.exists()
    assert out.stat().st_size > 1000  # au moins 1 KB


@pytest.mark.skipif(
    not is_docx_available()[0],
    reason="python-docx non installe",
)
def test_export_docx_creates_file(basic_config: ReportConfig, tmp_path: Path):
    out = tmp_path / "rapport.docx"
    result = export_docx(basic_config, str(out))
    assert result.ok is True
    assert out.exists()
    assert out.stat().st_size > 1000


@pytest.mark.skipif(
    not is_pdf_available()[0],
    reason="reportlab non installe",
)
def test_export_report_dispatches_to_pdf(basic_config: ReportConfig, tmp_path: Path):
    out = tmp_path / "rapport.pdf"
    result = export_report(basic_config, str(out), format="pdf")
    assert result.format == "pdf"
    assert out.exists()
