# Design — P3 : Catalogue mondial de données + chargement agentique

**Date** : 2026-06-06
**Statut** : Validé (design approuvé en brainstorming)
**Vision** : faire de QGISIA+ l'agent qui sait trouver et charger **toute la donnée
cartographique gratuite du monde** à la demande — socle des piliers P1 (diagnostic
satellite) et P2 (dossier territorial).

---

## Périmètre de CE design : P3-S1

L'agent peut **découvrir** et **charger en un appel** des sources mondiales gratuites
diffusées en **XYZ / WMTS / WMS** (fonds de carte + couches thématiques tuilées).
Le chargement satellite COG/STAC (Sentinel) et le vecteur mondial (Overture) sont
**hors scope** (P3-S2 / P3-S3).

**Pourquoi ce découpage** : le bridge sait déjà charger XYZ/WMTS/WMS via
`addServiceLayer` → `_create_service_layer`. P3-S1 capitalise dessus, est immédiatement
visible (la couche apparaît), 100% testable, et sert de socle.

---

## Architecture

```
QGISIA2/config/data_sources.json   registre curé (sources mondiales gratuites)
        │
QGISIA2/data_catalog.py            pur Python (load/get/list/build_service_config)
        │
   ┌────┴───────────────────────────────┐
native_tools: list_data_sources         geoai_assistant: addDataSource (slot bridge)
  (découverte, hors QGIS)                  lit catalogue -> build_service_config ->
                                           _create_service_layer (chemin existant)
                                           + route /api/qgis/addDataSource
mcp_server: tools list_data_sources + addDataSource
```

**Unités (frontières claires)** :
- `data_catalog.py` — *quoi* : charge/valide le registre, expose `list_sources(category)`,
  `get_source(id)`, `build_service_config(source)`. *Dépend de* : le JSON. *Testable* : oui, pur.
- `data_sources.json` — données curées (aucune logique).
- `addDataSource` (slot) — *quoi* : charge une source dans QGIS. *Dépend de* : `data_catalog`
  + `_create_service_layer` existant. *Testable* : QGIS réel.
- `list_data_sources` (outil natif) — *quoi* : expose le catalogue à l'agent. *Dépend de* :
  `data_catalog`. *Testable* : unit.

## Schéma d'une entrée du catalogue

```json
{
  "id": "esri-world-imagery",
  "name": "ESRI World Imagery (satellite)",
  "category": "satellite",
  "provider": "Esri",
  "service_type": "XYZ",
  "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  "params": {"zmax": 19},
  "license": "Esri (usage attribué)",
  "coverage": "monde",
  "attribution": "Esri, Maxar, Earthstar Geographics"
}
```
`service_type` ∈ {`XYZ`, `WMTS`, `WMS`}. `build_service_config(source)` produit le dict
attendu par `_create_service_layer` (clés : `service_type`, `url`, `name`, + `layers`/
`format`/`crs` pour WMS, `zmax`/`zmin` pour XYZ).

## Catalogue P3-S1 (≈18 sources)

| Catégorie | Sources |
|-----------|---------|
| **basemap** | OSM standard, CARTO Positron, CARTO Dark Matter, OpenTopoMap |
| **satellite** | ESRI World Imagery, Sentinel-2 cloudless (EOX, WMTS) |
| **relief** | ESRI World Hillshade, OpenTopoMap |
| **occupation_sol** | ESA WorldCover 10 m (WMS Terrascope) |
| **france** | IGN Plan v2, IGN Ortho (WMTS Géoplateforme), Cadastre (WMTS), RPG (WMS) |
| **labels/réf** | CARTO labels, OSM Humanitarian |

> Liste exacte + URLs figées dans le plan d'implémentation (chaque URL vérifiée).

## Outils exposés à l'agent

| Outil | Entrée | Sortie |
|-------|--------|--------|
| `list_data_sources` | `category?` (string) | `{count, sources:[{id,name,category,coverage,provider}]}` |
| `addDataSource` | `sourceId`, `name?` | message (couche ajoutée / cause d'échec) |

## Flux

NL utilisateur → (option) `list_data_sources("satellite")` → `addDataSource("esri-world-imagery")`
→ slot lit le catalogue → `build_service_config` → `_create_service_layer` → `_add_layer_to_project`
→ **couche visible**.

## Gestion d'erreurs

- `sourceId` inconnu → `"Source de données inconnue : <id>"` (Warning).
- Échec de chargement service → cause remontée (pattern `addServiceLayer` existant).
- JSON catalogue absent/corrompu → `list_sources` renvoie `[]` (pas d'exception).
- Catégorie inconnue dans `list_data_sources` → liste vide.

## Tests

- **Unit** (`tests/test_data_catalog.py`) : load, get_source, list_sources, filtre catégorie,
  `build_service_config` pour XYZ/WMTS/WMS, **validité du schéma de chaque entrée**
  (champs requis présents, `service_type` valide, `url` non vide).
- **Unit** (`tests/test_native_tools.py`) : `list_data_sources` présent + filtre.
- **QGIS réel** (`tests/qgis_real_smoke.py`) : `addDataSource("osm")` et
  `addDataSource("esri-world-imagery")` → couches présentes dans le projet.

## Hors scope (suites)

- **P3-S2** : satellite Sentinel/Landsat en COG via STAC (slot raster distant `/vsicurl/`).
- **P3-S3** : vecteur mondial (Overture via GeoParquet/DuckDB, WorldCover vecteur).

## Critères de succès

- L'agent liste les sources et **charge réellement** un fond + une thématique dans QGIS.
- ≥ 15 sources mondiales gratuites curées, schéma validé par test.
- Aucune régression (suite Python + front verte).
