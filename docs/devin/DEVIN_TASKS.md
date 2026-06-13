# 📋 DEVIN_TASKS — File de prompts pour Kimi 2.6 (agent Devin)

> Géré par Claude Code (architecte/superviseur). Coller UN prompt à la fois dans Devin.
> À la fin de chaque tâche, Kimi doit livrer sur une branche `kimi/<slug>` et lancer
> `python -m pytest tests/ -q`. Claude applique ensuite le gate qualité avant merge.

## Règles permanentes à inclure implicitement (Kimi les voit dans chaque prompt)

- Modules **purs** : aucun import `qgis`/`PyQt` dans les nouveaux modules — testables en CI.
- Imports doubles : `try: from .x import y / except ImportError: from x import y`.
- Jamais de `sys.exit()` dans du code importable, jamais de fonctions `test_*` hors `tests/`.
- Ne JAMAIS toucher `.env.local`, ne jamais écrire de clé API en dur.
- Ne pas réécrire un module testé existant : étendre, ne pas remplacer.

---

## PROMPT 1 — `study_plan` v2 : planificateur dynamique 20–100 étapes (roadmap #1)

```
CONTEXTE PROJET (ne pas re-explorer, tout est ici) :
Plugin QGIS "QGISIA2" (GeoSylva AI). L'endpoint /api/llm/autoStudy (geoai_assistant.py)
déroule un plan généré par QGISIA2/study_plan.py : aujourd'hui 3 thèmes statiques
(vegetation/urbanisme/risques) de 7 étapes {action, params}. Les actions exécutables
côté bridge sont : add_basemap, load_satellite, compute_index, detect_change, classify,
zonal_stats, layout, report (voir le dispatch dans /api/llm/autoStudy). Le bridge expose
aussi (via TOOL_CATALOG de QGISIA2/mcp_server.py) : bufferLayer, computeTerrain,
suitabilityAnalysis, hotspotAnalysis, clusterPoints, exportAtlas, applySymbologyPreset,
saveVectorLayer, renderMapView. QGISIA2/pipeline_engine.py sait valider un DAG
{steps:[{id,op,inputs,outputs}]} (validate_pipeline, topological_order, estimate_cost).

TÂCHE (module pur Python, zéro import qgis/PyQt) :
Créer QGISIA2/study_planner.py : un générateur de plans d'étude territoriale RICHES
(20 à 100 étapes) qui remplacera les plans statiques de study_plan.py (sans le supprimer).

API attendue :
- build_rich_plan(theme: str, context: dict, *, depth: str = "standard") -> list[dict]
  depth in {"rapide","standard","approfondi"} → ~20 / ~50 / ~100 étapes.
  Chaque étape : {"id": str, "action": str, "params": dict, "depends_on": [ids],
  "phase": "data|analyse|symbologie|layout|livrable", "optional": bool}.
- Thèmes : vegetation, urbanisme, risques, foret, hydrologie, agriculture.
  Chaque thème compose des sous-séquences réutilisables (acquisition multi-dates,
  série d'indices, terrain, zonal, classification, layouts multiples, atlas, rapport).
- validate_with_pipeline(plan) -> dict : convertit le plan au format pipeline_engine
  et renvoie {valid, errors, order, cost} (réutiliser pipeline_engine, ne pas dupliquer).
- to_progress_payload(plan) -> dict pour l'UI (compte par phase, étapes optionnelles).

TESTS : tests/test_study_planner.py (pytest, >= 15 tests) : tailles par depth, unicité
des ids, depends_on cohérents (pas de référence avant définition), tous les thèmes,
validation pipeline OK, actions toutes dans la liste autorisée ci-dessus.

LIVRAISON : branche kimi/study-planner-v2, pytest vert, aucun fichier existant modifié
sauf (optionnel) un commentaire de renvoi dans study_plan.py.
```

---

## PROMPT 2 — `map_repro` v2 : extraction de légende robuste (roadmap #3, pixel-perfect)

```
CONTEXTE PROJET :
QGISIA2/map_repro.py contient legend_to_qml(legend, field, geometry) qui convertit une
légende [{label, color, geometry}] en style QGIS .qml catégorisé (vérifié en QGIS réel).
QGISIA2/legend_normalizer.py normalise les couleurs (noms, rgb(), #abc → #rrggbb).
Le VLM (alias "vision-premium") renvoie du texte qui CONTIENT du JSON de légende mais
souvent pollué : markdown ```json, texte avant/après, virgules traînantes, clés
synonymes (couleur/color, libelle/label, nom/name), couleurs décrites en mots FR
("vert foncé"), pourcentages d'opacité.

TÂCHE (module pur, zéro import qgis/PyQt) :
Créer QGISIA2/legend_extractor.py qui blinde le pipeline image→QML :
- extract_legend_json(vlm_text: str) -> list[dict] : extrait le premier tableau JSON
  plausible (fences markdown, JSON brut, ou liste à puces "– Forêt : vert foncé"),
  tolère virgules traînantes et simples quotes, mappe les clés synonymes FR/EN.
- resolve_color_words(text: str) -> str|None : ~40 couleurs FR/EN usuelles en carto
  ("vert foncé"→#1B5E20, "bleu clair"→#81D4FA, etc.) avec nuances foncé/clair/pâle.
- build_vlm_legend_prompt(map_intent: str) -> str : prompt FR strict pour le VLM
  (sortie JSON only, schéma {label, color, geometry}).
- repair_legend(legend) -> dict {legend, warnings} : pipeline complet → normalise via
  legend_normalizer, déduplique les labels, infère geometry manquante ("zone"→polygon,
  "route/cours d'eau"→line, "point/station"→point), warnings explicites.

TESTS : tests/test_legend_extractor.py (>= 18 tests) couvrant : JSON propre, JSON dans
fence markdown, texte pollué, liste à puces FR, couleurs en mots, clés synonymes,
virgules traînantes, légende vide → [], geometry inférée, warnings.

LIVRAISON : branche kimi/legend-extractor, pytest vert, map_repro.py NON modifié.
```

---

## PROMPT 3 — Frontend : barre d'état agent + budget (refonte dashboard, brique 1)

```
CONTEXTE PROJET :
Frontend React 19 + Vite + TS strict + Tailwind dans src/. Le hook
src/hooks/useLLMGateway.ts expose { status, ready, getBudget, defaultAlias, autoMode } ;
getBudget() renvoie {day, total_usd, by_model, request_count, limits:{daily_max_usd,
warn_at_percent}} (endpoint /api/llm/budget). Le store src/stores/useGatewayStore.ts
contient la config (mode Gateway / SIG intelligent / Action). Les composants existants
sont dans src/components/ (style: fonctions typées, pas de classe, Tailwind, i18n FR).
Tests avec vitest + @testing-library/react dans src/test/.

TÂCHE :
Créer src/components/AgentStatusBar.tsx : barre fine fixée en bas du chat affichant
1) le mode actif (Gateway / SIG Intelligent / Mode Action) avec pastille couleur,
2) l'alias modèle par défaut, 3) le budget du jour : barre de progression
total_usd/daily_max_usd, orange ≥ warn_at_percent, rouge ≥ 100 %, 4) le nombre de
requêtes du jour, 5) un point de statut gateway (ready=vert, installing=orange
animé, error=rouge + tooltip lastError).
- Poll getBudget() toutes les 60 s (cleanup à l'unmount), pas de poll si !ready.
- Composant memoïsé, props optionnelles pour injection en test (budgetFetcher).
- Intégrer dans src/App.tsx sous la zone de chat (modification minimale).

TESTS : src/test/AgentStatusBar.test.tsx (>= 8 tests vitest) : rendu des 3 modes,
seuils de couleur du budget, statut error avec tooltip, pas de fetch si !ready,
cleanup de l'interval. `npm run test` vert.

LIVRAISON : branche kimi/agent-status-bar, npm run test + npm run build verts.
```

---

## Backlog des prompts suivants (Claude les rédigera au fil de l'eau)

4. `report_templates` v2 : gabarits de rapport par thème enrichis (chiffres + tableaux + recommandations).
5. Panneau Diagnostic satellite (frontend) : indices + détection de changement + aperçu rampes.
6. `geo_refs.py` : détection bbox/commune depuis texte libre (géocodage → emprise Lambert 93).
7. Panneau Mise en page + bouton « Auto-améliorer » branché sur /api/llm/autoImproveLayout.
8. `voice_intents` v2 : couverture de toutes les actions du TOOL_CATALOG.

### Pack Gestion Forestière (voir ../product/VISION_METIERS.md — qualité > rapidité)

9. Outil `ask_user` (QCM agent) : spec pure du protocole pause/reprise de run_tool_loop + composant frontend de choix multiple. **La capacité transverse la plus importante.**

---

## PROMPT 9 — `ask_user` : outil QCM d'agent (PRIORITAIRE PACKS MÉTIER)

```
CONTEXTE PROJET (vérifié, stable, complet) :
Plugin QGIS GeoSylva AI. Boucle tool-calling dans QGISIA2/agent_tools.py:run_tool_loop 
(max 100 itérations, guardrails BLOCK/CONFIRM/SAFE). Actuellement, l'agent exécute les 
outils automatiquement. BESOIN : pauser la boucle quand l'agent est incertain (→ Q/R).

Exemple : Agent analyse une zone → doute sur le PSG (format simple vs complet ?) → 
appelle ask_user(question, options) → boucle se pause → frontend affiche QCM → 
user choisit → réponse réinjectée → agent reprend.

TÂCHE (2 modules, purs Python + React TS) :
1. BACKEND : QGISIA2/tools/ask_user.py (~80 L)
   - NativeToolFunction ask_user(question: str, options: List[str], context: dict = None) -> dict
     Retour : {selected_option: str, selected_index: int, timestamp: ISO8601}
   - Insérer dans NATIVE_TOOLS et TOOL_CATALOG (mcp_server.py)
   - Intégration dans run_tool_loop : si agent appelle ask_user, bloquer les tool_calls 
     suivantes jusqu'à la réponse, injecter réponse dans message agent
   - JAMAIS de timeout côté backend (la pause peut durer longtemps)

2. FRONTEND : src/components/QuestionModal.tsx (~120 L)
   - Modal React avec : titre, question, boutons pour chaque option
   - Affichage quand task.awaiting_user_input === true
   - POST /api/llm/agent/respond avec {question_id, selected_index}
   - Animation d'apparition (Framer Motion)
   - Tailwind, dark mode, couleur accent QGISIA

3. INTÉGRATION dans Chat.tsx
   - Si réponse contient ask_user call pending → afficher <QuestionModal>
   - Bloquer user input jusqu'à réponse
   - Sur réponse → POST /api/llm/agent/respond → continuer boucle agent

TESTS : 
- Backend (pytest, tests/test_ask_user.py, >= 5 tests) : format réponse OK, timeout pas appliqué, 
  catalogue contient ask_user
- Frontend (vitest, src/test/QuestionModal.test.tsx, >= 6 tests) : rendu modal, click option, 
  POST au backend, blocage input, dark mode

LIVRAISON : branche kimi/ask-user (ou kimi/ask-user-qcm)
Gate : pytest vert, vitest vert, npm build vert, npm lint vert

MOTIVATION : Tous les packs métier (foresterie, incendie, urbanisme) dépendent de cette capacité.
L'agent DOIT pouvoir demander, pas deviner. Exemple foresterie : "PSG simplifié (2 ans, 
entretien) vs complet (10 ans, + coupe)?" — user choisit → agent construit le plan qui va.
```

---

## PROMPT 10 — Plugin UX/UI : améliorations interface + MCP integration (NOUVELLES IMPLÉMENTATIONS)

```
CONTEXTE PROJET (complété) :
- Plugin QGIS geoai_assistant.py expose ThreadedAssetServer sur port dynamique
- Frontend React + Vite exposé depuis /api/* (bridge HTTP)
- Endpoint /api/qgis/serverInfo nouvellement créé (port, URL, timestamp, statut)
- Composant React ServerStatusIndicator créé (affiche port + état connexion)
- Timeout configurable : QGIS_BRIDGE_TIMEOUT env var (défaut 120s)
- Auto-show dock au startup : QGIS_PLUGIN_SHOW_DOCK_ON_STARTUP env var (défaut on)

TÂCHE (frontend React TS + minor Python tweaks) :
Implémenter les améliorations UX/UI identifiées dans le rapport d'analyse (QGISIA/doc/ui_analysis.md).

## PART 1 : Reconnexion automatique (HTTP wrapper)

Créer src/lib/api-client.ts : wrapper fetch() avec retry exponential
- Fonction fetchWithRetry(url, options) : retry 3 fois avec backoff (100ms, 500ms, 2s)
- Toast notifications "Reconnecting..." → "Connected" ou "Failed"
- Timeout par requête : 60s (configurable)
- Usage : remplacer fetch() directs par fetchWithRetry() dans useLLMGateway, Chat, etc.

## PART 2 : RAG failure notification

Modifier src/hooks/useLLMGateway.ts :
- Ajouter endpoint GET /api/rag/status → {available: bool, error: string}
- Hook poll au mount : check RAG status une fois au démarrage
- Si RAG unavailable → toast warning "RAG indexing failed: {error}. Search disabled."
- Store la disponibilité dans RAG state (useDocumentStore)

## PART 3 : Rate-limit feedback (HTTP 429)

Dans api-client.ts (fetchWithRetry) :
- Si HTTP 429 : afficher toast "Rate limit reached. Retry in {seconds}s"
- Extraire Retry-After header
- Bloquer les requêtes suivantes pendant la durée du retry
- Afficher "Rate: 45/1200 req/min" dans toast

## PART 4 : Health dashboard (optional panel dans dock)

Créer src/components/HealthDashboard.tsx (optionnel, activé par ?debug=1 url param)
- Panneaux : Bridge Status, RAG Status, MCP Connected, LLM Gateway Ready
- Chaque panneau : statut (vert/orange/rouge), détails, bouton Retry/Reset
- Polling : 10s
- Intégrer dans Chat footer (repliable/expandable)

## PART 5 : Timeout configurable UI (settings)

Ajouter dans src/components/SettingsPanel.tsx :
- Dropdown "Request Timeout" : 30s, 60s, 120s, 180s, custom
- Sauvegarde localStorage : qgisia_request_timeout
- Lire dans useServerHealth et fetchWithRetry
- Tooltip : "Augmenter si vos analyses raster dépassent 60s"

## TESTS :
- Unit tests fetchWithRetry : HTTP 429, timeout, 3 retries OK
- Integration test : Chat avec RAG unavailable → warning toast OK
- E2E test (vitest) : sendMessage → 429 → retry → success OK

LIVRAISON : branche kimi/plugin-ux-improvements-v1
Gate : npm run test + npm run build vert, pas de ts errors
```

---
---

## PROMPT 11 — Pack Foresterie (Part 1) : PSG Blueprint (CNPF)

```
CONTEXTE PROJET (stable) :
Plugin QGIS "GeoSylva AI" avec ask_user + agent federation. Vision métiers en ../product/VISION_METIERS.md
(voir section Pack 1 : Gestion Forestière pour spécification complète).

TÂCHE (module pur Python) :
Créer QGISIA2/psg_blueprint.py : générateur PSG (Plans Simples de Gestion) conforme CNPF 2024.

API attendue :
- build_psg_blueprint(project_bbox: [x1,y1,x2,y2], depth: str, forest_type: str) -> dict
  depth in {"simplifie", "standard", "complet"} → 2ans/5ans/10ans
  forest_type in {"feuillus", "resineux", "mixte"}
  Retour : {metadata, parcellaire, peuplements, operations, restrictions, recommandations}
- validate_psg(psg: dict) -> {valid: bool, errors: List[str], warnings: List[str]}
  Vérifier : opérations cohérentes (années), surfaces paddent bbox, densités raisonnables

SYMBOLOGIES QML :
- QGISIA2/symbologies/foresterie/peuplements_essence.qml (Feuillus=vert, Résineux=bleu, Mixte=cyan)

TESTS : tests/test_psg_blueprint.py (>= 10 tests)
- Zones Pays de la Loire, Limousin, Aquitaine (tailles réelles)
- Depths : simplifié (3-5 opérations) vs complet (15+ opérations)
- Recommandations générées (essences, risques, opportunités)

LIVRAISON : branche kimi/psg-blueprint
Gate : pytest OK, <400 lignes, aucun import qgis/PyQt
```

---

## PROMPT 12 — Pack Foresterie (Part 2) : Burned Area Vectorization

```
CONTEXTE :
dNBR raster classé (1=unburned, 2=low, 3=moderate, 4=high) → polygones contours brûlés.
Utilise scipy (convex_hull, smoothing), rasterio, fiona pour géométries.

TÂCHE (module pur Python) :
Créer QGISIA2/burned_area.py : vectorisation robuste raster classé → shapes avec sévérité.

API attendue :
- vectorize_burned_area(dnbr_raster: str, smoothing: str, min_polygon_ha: float) -> list[dict]
  Retour : [{geometry: Polygon, severity: "high|moderate|low", surface_ha, perimeter_m}]
- smooth_polygon(poly: Polygon, kernel_size: int) -> Polygon (Douglas-Peucker)
- calculate_metrics(polygons: List[Polygon], crs: str) -> list[dict]

TESTS : tests/test_burned_area.py (>= 8 tests)
- Incendies réels Méditerranée 2023-2024 (MODIS crosscheck <5% erreur)
- Smoothing : none/light/heavy
- Min surface filter (1ha vs 50cm²)

LIVRAISON : branche kimi/burned-area
Gate : pytest OK, <350 lignes
```

---

## PROMPT 13 — Pack Foresterie (Part 3) : Forest Classification

```
CONTEXTE :
Classifier massifs forestiers : NDVI + NDMI → 6 classes (IGN BD Forêt v2).
Classes : vide (0), taillis (1), feuillus (2), résineux (3), mixte (4), jachère (5).

TÂCHE (module pur Python) :
Créer QGISIA2/forest_classes.py : classification multi-indices + QML symbologie.

API attendue :
- classify_forest(ndvi_raster: str, ndmi_raster: str, legend: Optional[dict]) -> dict
  Retour : {raster_classes: str, symbology_qml: str, confidence_raster: str}
- apply_symbology_qml(layer_id: str, qml_path: str) → via bridge call (async)
- validate_classification(raster: str) -> {accuracy, confusion_matrix, warnings}

SYMBOLOGIES QML :
- QGISIA2/symbologies/foresterie/forest_classes.qml (couleurs IGN standard)

TESTS : tests/test_forest_classes.py (>= 12 tests)
- Couches IGN BD Forêt réelles (crosscheck 90%+ accuracy)
- OSM highways pour validation pistes
- Confidence raster vérification (%) 

LIVRAISON : branche kimi/forest-classes
Gate : pytest OK, <380 lignes, symbologies validées
```

---

## PROMPT 14 — Pack Foresterie (Part 4) : Path Classifier

```
CONTEXTE :
Classifier pistes/dessertes forestières : OSM + MNT → praticabilité DFCI.
DFCI_large, DFCI_normal, restreinte, impraticable (basé pente + surface + largeur).

TÂCHE (module pur Python) :
Créer QGISIA2/path_classifier.py : classification voies + priorité maintenance.

API attendue :
- classify_paths(ways_vector: str, dem_raster: str, proximity_to_water: bool) -> list[dict]
  Retour : [{way_id, name, surface, width, praticabilite, slope_pct, maintenance_priority}]
- calculate_slope_from_dem(way_geom: LineString, dem_raster) -> float (% moyenne)
- infer_width_from_osm(tags: dict) -> float (m, défaut 3.5)

TESTS : tests/test_path_classifier.py (>= 8 tests)
- Chaînes massifs réels (Vosges, Massif Central, Alpes)
- Pentes : 0% (plat) → 80% (très raide) → impraticable
- Maintenance priority : calcul sur pente + état infrastructure

LIVRAISON : branche kimi/path-classifier
Gate : pytest OK, <320 lignes, no qgis/PyQt imports
```

---

## Backlog Métiers (Futur)

14. Connecteur foncier : DVF/cadastre/data.gouv (+ spec Pappers) pour propriétaires et parcelles.
15-17. Pack Incendie : dNBR pipeline, severity classes, restoration planner (Q3 2026)
18-20. Pack Urbanisme : parcel analysis, zoning rules, urban report (Q4 2026)
