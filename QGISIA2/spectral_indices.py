# -*- coding: utf-8 -*-
"""
Indices spectraux pour Sentinel-2 / Landsat — expressions compatibles QgsRasterCalculator.

Module pur Python (testable sans QGIS). Remplace les noms de bandes abstraits
(RED, NIR, GREEN, SWIR, BLUE) par les references de canaux raster fournies.
"""
from __future__ import annotations

from typing import List

INDICES = {
    "ndvi": {
        "name": "NDVI",
        "description": "Normalized Difference Vegetation Index",
        "formula": "(NIR - RED) / (NIR + RED)",
        "bands": ["NIR", "RED"],
    },
    "ndwi": {
        "name": "NDWI",
        "description": "Normalized Difference Water Index (McFeeters)",
        "formula": "(GREEN - NIR) / (GREEN + NIR)",
        "bands": ["GREEN", "NIR"],
    },
    "ndbi": {
        "name": "NDBI",
        "description": "Normalized Difference Built-up Index",
        "formula": "(SWIR - NIR) / (SWIR + NIR)",
        "bands": ["SWIR", "NIR"],
    },
    "nbr": {
        "name": "NBR",
        "description": "Normalized Burn Ratio",
        "formula": "(NIR - SWIR) / (NIR + SWIR)",
        "bands": ["NIR", "SWIR"],
    },
    "evi": {
        "name": "EVI",
        "description": "Enhanced Vegetation Index",
        "formula": "2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))",
        "bands": ["NIR", "RED", "BLUE"],
    },
    "savi": {
        "name": "SAVI",
        "description": "Soil Adjusted Vegetation Index",
        "formula": "((NIR - RED) / (NIR + RED + 0.5)) * 1.5",
        "bands": ["NIR", "RED"],
    },
    "msavi2": {
        "name": "MSAVI2",
        "description": "Modified Soil Adjusted Vegetation Index 2",
        "formula": "(2 * NIR + 1 - sqrt((2 * NIR + 1)^2 - 8 * (NIR - RED))) / 2",
        "bands": ["NIR", "RED"],
    },
    "ndmi": {
        "name": "NDMI",
        "description": "Normalized Difference Moisture Index",
        "formula": "(NIR - SWIR) / (NIR + SWIR)",
        "bands": ["NIR", "SWIR"],
    },
    "bsi": {
        "name": "BSI",
        "description": "Bare Soil Index",
        "formula": "((SWIR + RED) - (NIR + BLUE)) / ((SWIR + RED) + (NIR + BLUE))",
        "bands": ["SWIR", "RED", "NIR", "BLUE"],
    },
}


def list_indices() -> List[dict]:
    """Renvoie la liste des indices avec leurs metadonnees."""
    return [
        {
            "id": k,
            "name": v["name"],
            "description": v["description"],
            "bands": v["bands"],
        }
        for k, v in INDICES.items()
    ]


def build_expression(index_id: str, band_map: dict) -> str:
    """
    Construit l'expression QgsRasterCalculator pour un indice spectral.

    Args:
        index_id: identifiant de l'indice (ex: 'ndvi').
        band_map: mapping {band_name: raster_ref}, ex {"NIR": "b8@1", "RED": "b4@1"}.

    Raises:
        ValueError: si l'indice est inconnu ou si une bande requise est manquante.
    """
    meta = INDICES.get(index_id)
    if meta is None:
        raise ValueError(f"Indice spectral inconnu: {index_id}")

    expr = meta["formula"]
    for band in meta["bands"]:
        ref = band_map.get(band)
        if ref is None:
            raise ValueError(f"Bande manquante pour {index_id}: {band}")
        expr = expr.replace(band, ref)
    return expr


def sentinel2_band_map() -> dict:
    """Mapping bandes Sentinel-2 (niveau 1C/2A) vers references raster standard."""
    return {
        "BLUE": "B2@1",
        "GREEN": "B3@1",
        "RED": "B4@1",
        "NIR": "B8@1",
        "SWIR": "B11@1",
    }
