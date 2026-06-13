# 🎯 Vision Métiers — QGISIA+ Packs (2026 H2)

> Spécialisation verticale par domaine : données + algo + symbologies + templates  
> Dépend de : ask_user ✓ + LLM agents + MCP 70+ tools

---

## 📦 Pack 1 : Gestion Forestière 🌲 (PRIORITAIRE)

**Cas d'usage utilisateur** : Analyse massifs forestiers, plans de gestion, cartographie participative  
**Sources données** : BD Forêt (IGN), OSM, STAC Sentinel-2, DVF cadastre  
**Experts CNPF** : CNPF, Peuplements, PSG conforme standard

### 1.1 – PSG Blueprint (Plans Simples de Gestion CNPF)

**Fichier** : `QGISIA2/psg_blueprint.py`  
**Spécification** : Structure conforme CNPF 2024, parcellaire + peuplements + programme coupes/travaux

```python
psg = build_psg_blueprint(
    project_bbox: [x1, y1, x2, y2],
    depth: "simplifie|standard|complet",  # 2ans, 5ans, 10ans
    forest_type: "feuillus|resineux|mixte",
)
→ {
    "metadata": {name, bbox, forest_type, owner, date},
    "parcellaire": [{"id", "geometry", "surface_ha"}],
    "peuplements": [
        {"id", "parcelle_id", "essence_pct", "age_moyen", "hauteur_m", "densité"}
    ],
    "operations": [
        {"year", "type", "parcelles", "volume_m3", "rendement_€", "cout"}
    ],
    "restrictions": [{"type", "parcelles", "raison"}],
    "recommandations": [{"theme", "actions"}],
}
```

**Tests** : 10+ tests (zones Pays de la Loire, Limousin, Aquitaine)

### 1.2 – Burned Area Vectorization (dNBR → Contours)

**Fichier** : `QGISIA2/burned_area.py`  
**Spécification** : Conversion dNBR raster classé → polygones contours brûlés, calcul surfaces par sévérité

```python
polygons = vectorize_burned_area(
    dnbr_raster: str,  # Classé : 1=unburned, 2=low, 3=moderate, 4=high
    smoothing: "none|light|heavy",
    min_polygon_ha: 0.05,
)
→ [
    {"geometry": Polygon, "severity": "high|moderate|low", "surface_ha", "perimeter_m"}
]
```

**Tests** : 8+ tests (incendies réels Méditerranée 2023-2024)

### 1.3 – Forest Classification (Nomenclature BD Forêt + Custom)

**Fichier** : `QGISIA2/forest_classes.py`  
**Spécification** : Schémas classification massifs (IGN v2), symbologies QML associées

```python
classify_forest(
    ndvi_raster: str,
    ndmi_raster: str,
    legend: Optional[List[dict]],  # override defaut
)
→ {
    "raster_classes": Raster,  # 1-6 (vide→taillis, feuillus, résineux, mixte, jachère)
    "symbology_qml": str,  # QGIS style appliquable
    "confidence_raster": Raster,  # % confiance par pixel
}
```

**Tests** : 12+ tests (couches réelles IGN, OSM crosscheck)

### 1.4 – Path Classifier (Pistes/Dessertes DFCI)

**Fichier** : `QGISIA2/path_classifier.py`  
**Spécification** : Classification praticabilité dessertes/pistes (OSM + géométrie)

```python
classify_paths(
    ways_vector: str,  # OSM highway lines
    dem_raster: str,  # MNT pour pente
    proximity_to_water: bool = True,
)
→ [
    {
        "way_id", "name", "surface", "width",
        "praticabilite": "DFCI_large|DFCI_normal|restreinte|impraticable",
        "slope_pct", "maintenance_priority": 1-5,
    }
]
```

**Tests** : 8+ tests (chaînes massifs réels)

### 1.5 – Rapport Forestier Template

**Fichier** : `QGISIA2/templates/report_foresterie.html`  
**Contenu** : Export PDF/DOCX multi-pages avec cartes, tableaux, recommandations CNPF

```
- Page 1 : Couverture + métadonnées
- Page 2-3 : Cartes parcellaire + peuplements
- Page 4 : Tableau opérations 5-10ans
- Page 5 : Analyse dNBR (si incendie)
- Page 6+ : Recommandations expert
```

---

## 📦 Pack 2 : Gestion Incendie 🔥 (MOYEN-TERME)

**Cas d'usage** : Cartographie zones brûlées, analyse sévérité, planification restauration  
**Sources** : Sentinel-2 dNBR, Landsat SWIR, données pompiers, cadastre

### 2.1 – dNBR Analysis Pipeline

**Fichier** : `QGISIA2/dnbr_analysis.py`

```python
analyze_burn(
    pre_fire_date: str,  # "2024-06-30"
    post_fire_date: str,  # "2024-07-15"
    bbox: List[float],
)
→ {
    "dnbr_raster": str,
    "severity_classes": {unburned, low, moderate, high},
    "total_area_km2": float,
    "severity_breakdown": {class: area_pct},
    "confidence": float,
}
```

### 2.2 – Severity Classification

**Fichier** : `QGISIA2/severity_classes.py`

Seuils USGS + variations régionales (Méditerranée vs Aquitaine)

### 2.3 – Restoration Planning

**Fichier** : `QGISIA2/restoration_planner.py`

Recommandations restauration par zone + priorité urgence

---

## 📦 Pack 3 : Gestion Urbanisme 🏙️ (FUTUR)

**Cas d'usage** : Zonage réglémentaire, emprise cadastrale, PLU/PLUi  
**Sources** : Cadastre GEOFLA, orthophoto, OSM, données collectivités

### 3.1 – Parcel Analysis

**Fichier** : `QGISIA2/parcel_analysis.py`

### 3.2 – Zoning Classification

**Fichier** : `QGISIA2/zoning_rules.py`

### 3.3 – Urban Report Template

**Fichier** : `QGISIA2/templates/report_urbanisme.html`

---

## 🏗️ Architecture Communes

### Store Central (Zustand)

```typescript
// src/stores/useMetierStore.ts
{
  activePack: "foresterie" | "incendie" | "urbanisme" | null,
  packConfig: {...},
  lastAnalysis: {...},
  symbols: Map<string, SymbologyPreset>,
}
```

### Symbologies Vectorielles (QML)

```
QGISIA2/symbologies/
  ├── foresterie/
  │   ├── peuplements_essence.qml
  │   ├── severity_burn.qml
  │   └── dfci_paths.qml
  ├── incendie/
  │   ├── dnbr_severity.qml
  │   └── priority_zones.qml
  └── urbanisme/
      ├── zoning_plu.qml
      └── cadastre_proprietes.qml
```

### Prompts Ask_user par Métier

```
Foresterie:
  "PSG simplifié (2 ans, entretien) vs complet (10 ans, coupes)?"
  "Quelle essence dominante ? (Résineux, Feuillus, Mixte)"

Incendie:
  "Délai ante-feu (7, 15, 30 jours)?"
  "Priorité restauration ? (Urgent, Standard, Différé)"

Urbanisme:
  "Quelle zone PLU? (Urbain, À urbaniser, Rural, Agricole)"
  "Affichage cadast. propriétaire? (Anonyme, Noms, Détails)"
```

---

## 📅 Roadmap Implémentation

### Phase 1 : Foresterie (Semaines 1-3)

**PROMPT 11-14** : PSG blueprint, burned_area, forest_classes, path_classifier  
**Gate** : pytest OK, chaque module < 400 lignes, symbologies validées CNPF

### Phase 2 : Incendie (Semaines 4-5)

**PROMPT 15-17** : dNBR pipeline, severity, restoration planner

### Phase 3 : Urbanisme (Semaines 6+)

**PROMPT 18-20** : Parcel analysis, zoning, urban template

---

## 🎯 Critères de Succès Métier

| Pack | Critère | Métrique |
|------|---------|----------|
| **Foresterie** | PSG conforme | Validation CNPF ✓ |
| | Burned area | <5% erreur contours vs MODIS |
| | Classification | 90%+ accuracy vs IGN BD Forêt |
| **Incendie** | dNBR | Align Landsat USGS threshold |
| | Sévérité | Classe exacte ≥80% |
| **Urbanisme** | PLU | Couches cadastrale+ZIF overlaid |
| | Report | Export PDF multi-page OK |

---

## 🔗 Intégrations Clés

- **ask_user** → PSG depth/type, severity priority, zoning rules
- **MCP tools** → loadSatelliteBands, computeSpectralIndex, zonalStatistics
- **LLM agents** → REASONING (Nemotron Ultra) for recommendations
- **Vision loop** → VLM critique cartes finales (contraste, symbologies)

---

## 📚 Références Externes

- **CNPF** : http://www.cnpf.gouv.fr (PSG standard)
- **IGN BD Forêt** : https://www.ign.fr (classification)
- **USGS dNBR** : https://www.usgs.gov/faqs/what-normalized-burn-ratio (seuils)
- **PLU standards** : https://www.collectivites-locales.gouv.fr (urbanisme)

