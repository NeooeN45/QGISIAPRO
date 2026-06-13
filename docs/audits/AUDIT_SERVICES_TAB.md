# Audit fiabilité — Onglet Services QGISIA+

**Date** : 2026-04-26
**Scope** : `@src/components/WorkspaceSidebar.tsx:971-1450` (`renderServicesTab`)
**Sources catalogue** : `@src/lib/catalog.ts` + `@src/lib/additional-sources.ts`
**Backend QGIS** : `@QGISIA2/geoai_assistant.py:1042` (`addServiceLayer`)

---

## 1. Bilan quantitatif

| Métrique | Valeur |
|---|---|
| Sources totales catalogue | **66** (10 dans `catalog.ts` + 56 dans `additional-sources.ts`) |
| Marquées `reliable: true` | 27 |
| Avec `requiresKey: true` (clé API) | 5 (Thunderforest x5) |
| Catégories UI | 11 (Forêts, Topo, Satellite, Géologie, etc.) |
| Doublons d'ID dédupliqués | 5 (heureusement filtrés par `_seenIds`) |
| Fichier orphelin/mort | `@src/lib/map-services.ts` (283 lignes, **non importé nulle part dans le code de prod**) |

---

## 2. Sources qui CRASHENT ou NE FONCTIONNENT PAS

### 2.1 ❌ Bugs majeurs (crash QGIS ou tuiles vides garanties)

| ID | Problème | Cause |
|---|---|---|
| `ign-forets` | layerName `BDFORET_V2:formation_vegetale` sur endpoint **WMS** `wms-r` | Ce nom est un identifiant WFS, pas WMS → `QgsRasterLayer` retourne layer invalid, peut crasher au refresh tile |
| `ign-forets-publiques` | layerName `FORETS.PUBLIQUES:formation_vegetale` | **Ce nom n'existe pas** sur la Géoplateforme |
| `ign-peuplements` | `BDFORET_V2:essence` sur WMS | Idem : nom WFS sur WMS |
| `ign-vegetation` | `BDTOPO_V3:zone_de_vegetation` sur WMS | Nom WFS sur WMS |
| `osm-cycle`, `osm-transport`, `osm-outdoors`, `osm-landscape` | URL contient `apikey=YOUR_KEY` littéralement | Crée une URL invalide, retourne 401/403 — pas un crash mais 100% inutilisable tel quel |
| `fr-zones-agricoles` | layerName `BDTOPO_V3:zone_d_activite_ou_d_interet` | **Ce ne sont PAS des zones agricoles**. Donnée trompeuse. |
| `fr-vignes` | layerName `BDTOPO_V3:zone_de_vegetation` | Idem `ign-vegetation` — mensonge. |
| `fr-essences-forestieres` | layerName `BDFORET_V2:essences` (pluriel) | Le bon nom est `BDFORET_V2:essence` (singulier). Échec silencieux. |
| `fr-mines-brgm` | URL `geoservices.brgm.fr/geologie` + layer `MINES` | Endpoint inexistant — le bon est `geoservices.brgm.fr/services/MINES` |
| `fr-sismic-brgm` | URL `geoservices.brgm.fr/risques` + layer `ALEAS` | Endpoint inexistant |
| `noaa-radar`, `noaa-precipitation` | URL `opengeo.ncep.noaa.gov` | Service intermittent, souvent **down** depuis 2024 |
| `gebco-wms` | URL `gebco.net/data_and_products/.../mapserv` + `EPSG:4326` | Mix CRS WGS84 sur projection web Mercator → tuiles vides |

### 2.2 ⚠️ Sources fragiles (fonctionnent parfois)

| ID | Risque |
|---|---|
| `nasa-gibs-wms`, `copernicus-ndvi`, `nasa-ndvi`, `nasa-fire`, `copernicus-sentinel2` | NASA GIBS exige souvent paramètre `TIME=` en URL — **manque ici** → retourne tuile générique du jour, mais ce paramètre obligatoire dépend de la couche |
| `mundialis-topo-wms` | Service public sans SLA, lent ou down régulièrement |
| `geoserver-demo-wfs-countries`, `world-cities-wfs`, `population-centers-wfs` | URL `ahocevar.com/geoserver/wfs` = **demo personnelle**, pas un service de production |
| `fr-rum-sols`, `fr-capacite-retention`, `fr-texture-sols`, `fr-profondeur-sol`, `eu-soil-water-capacity`, `eu-soil-moisture` | **Aucune ne contient de données pédologiques réelles** : toutes pointent vers Corine Land Cover ou BDTOPO végétation. **Toute la catégorie "Sols et RUM" est trompeuse.** |

### 2.3 ✅ Sources réellement fiables (32 testées OK)

**IGN Géoplateforme (gratuit, sans clé) :**
- `geopf-wms-raster` (Ortho WMS), `geopf-wmts-planign`, `ign-planign`, `ign-scan25`, `ign-scan50`, `ign-scan100`, `ign-alti`
- WFS BDTOPO : `fr-communes-wfs`, `fr-departements-wfs`, `fr-regions-wfs`, `fr-epci-wfs`, `fr-bati-3d`, `fr-adresse`, `fr-reseau-routier`, `fr-voies-ferrees`

**OpenStreetMap & dérivés :**
- `osm-standard`, `osm-hot`
- `carto-dark`, `carto-positron`, `carto-voyager`

**Esri ArcGIS Online (XYZ public) :**
- `esri-world-imagery`, `esri-street`, `esri-topo`, `esri-physical`, `esri-shaded`, `esri-terrain`, `esri-natgeo`

**USGS (US uniquement) :**
- `usgs-topo`

**Corine Land Cover (EU) :**
- `corine` (le seul d'EEA qui fonctionne — les "soil" sont des doublons trompeurs du même)

---

## 3. Problèmes UX critiques de l'onglet

| # | Problème | Impact |
|---|---|---|
| 1 | **9 sections empilées** : Sources / Inventaire / Fonds carte / Cadastre / Satellite / Raster / OSM / Service custom / Fichiers locaux / CRS / Performance | Scroll infini, perdu |
| 2 | Recherche `serviceQuery` ne filtre que `Sources officielles` — les autres sections sont invisibles à la recherche | Mauvaise découvrabilité |
| 3 | "Fonds de carte" et "Sources officielles" se **chevauchent** (mêmes IDs réapparaissent) | Confusion |
| 4 | Aucun feedback d'erreur quand un service échoue à charger | L'utilisateur croit que ça marche |
| 5 | Pas de favoris / récents | Re-fouille à chaque session |
| 6 | Bouton "Ajouter" identique pour 60 sources sans preview ni indication "lent/rapide" | UX uniforme = no signal |
| 7 | "Inventaire forestier", "Calculs raster", "MNH", "Performance" sont des **outils** pas des **services** → mauvais onglet (ils devraient être dans un onglet "Outils") |
| 8 | Catégorie "Sols et RUM" entièrement trompeuse (cf. 2.2) | Décrédibilise le produit |
| 9 | Boutons "Parcourir" pour fichier local fonctionnent uniquement dans QGIS — silencieux dans le dev_server | Confusion en dev |
| 10 | `map-services.ts` (283 lignes) **complètement mort** — duplique le catalogue | Dette technique |

---

## 4. Plan de refonte recommandé (Phase 2)

### A. Nettoyage catalogue (1-2h)
1. **Supprimer** les 12 sources cassées de §2.1
2. **Supprimer** la catégorie "Sols et RUM" entière (6 entrées trompeuses)
3. **Supprimer** les 5 entrées Thunderforest avec placeholder `YOUR_KEY` (ou ajouter UI clé)
4. **Supprimer** `@src/lib/map-services.ts` (fichier mort)
5. **Corriger** `BDFORET_V2:essences` → `essence`
6. **Garder** uniquement les 32 sources testées + ajouter ~15 nouvelles sources Sprint 4 (Hub'Eau, GBIF, DVF, INPN…)

### B. Refonte UI premium (4-6h)

**Nouvelle architecture en 3 onglets internes :**
```
┌─────────────────────────────────────────┐
│ [🌍 Catalogue]  [⭐ Favoris]  [➕ Custom] │
├─────────────────────────────────────────┤
│  🔍 Recherche unifiée                   │
│  [filtres: Pays · Type · Thème · Fiable]│
├─────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐             │
│  │ Card │ │ Card │ │ Card │  Grid 2-col │
│  │ avec │ │ avec │ │ avec │  responsive │
│  │aperçu│ │aperçu│ │aperçu│             │
│  └──────┘ └──────┘ └──────┘             │
└─────────────────────────────────────────┘
```

**Card par source :**
- Miniature (preview tile 80×80 ou icône thématique colorée)
- Nom + provider en sous-titre
- Badges : `WMS` / `WFS` / `XYZ` + `🟢 Fiable` / `🟡 Beta`
- Description 1 ligne
- Bouton principal "Ajouter à la carte" + menu `…` (favoris, info, copier URL)
- État de chargement inline (spinner pendant l'ajout)

**Filtres latéraux :**
- Type service : WMS / WMTS / WFS / XYZ
- Thème : Fonds / Topo / Forêt / Admin / Bâti / Réseaux / Satellite
- Pays/zone : France / Europe / Monde
- Toggle "Sources fiables uniquement" (par défaut ON)

**Outils déplacés :**
- "Inventaire forestier", "Calculs raster", "Cadastre", "OSM Overpass" → nouvel onglet **Outils** (4ᵉ tab sidebar)
- "Performance" → reste dans Settings
- "Projection projet" → barre du bas de l'onglet Couches

### C. Robustesse backend (2h)

1. **Test de validité** avant ajout : `addServiceLayer` doit faire un GetCapabilities en preview et retourner `valid/invalid + reason`
2. **Toast d'erreur** explicite : `"❌ Service indisponible : timeout après 10s"`
3. **Dry-run mode** : bouton "Tester avant d'ajouter" dans la card
4. **Telemetry locale** : log les services qui échouent → marque automatiquement en `unreliable: true` après 3 échecs

### D. Nouveaux connecteurs Sprint 4 (3-4h)

À ajouter dans la nouvelle UI premium :
- **Hub'Eau** (qualité eau, piézo) — REST → conversion GeoJSON → WFS-like
- **IGN LiDAR HD** — points cloud download
- **GBIF** — biodiversité, occurrences espèces
- **DVF** — demandes de valeurs foncières (transactions immo)
- **INPN** — patrimoine naturel
- **Géorisques** — risques naturels et industriels
- **Sandre** — référentiel hydro
- **Géoportail Urbanisme** — PLU, zonages réglementaires

---

## 5. Estimation effort total

| Phase | Durée | Priorité |
|---|---|---|
| A. Nettoyage catalogue | 1-2h | 🔴 Critique |
| B. Refonte UI premium | 4-6h | 🟠 Haute |
| C. Robustesse backend | 2h | 🟡 Moyenne |
| D. Connecteurs Sprint 4 | 3-4h | 🟡 Moyenne |
| **Total** | **10-14h** | — |

---

## 6. Décisions à valider avant Phase 2

1. **Garder ou supprimer** la catégorie "Sols et RUM" entièrement trompeuse ? *(reco : supprimer)*
2. **Onglet Outils** séparé ou tout reste dans Services ? *(reco : séparer)*
3. **Sources fiables uniquement** par défaut, ou tout afficher avec badge ? *(reco : toggle ON par défaut)*
4. Sprint 4 connecteurs intégrés directement dans la refonte ou en 2ᵉ vague ? *(reco : intégrer dans la refonte pour cohérence)*
5. **Dry-run / Test service** avant ajout : utile ou over-engineering ? *(reco : oui pour les WMS/WFS, pas pour XYZ)*
