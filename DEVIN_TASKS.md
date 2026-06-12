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

### Pack Gestion Forestière (voir docs/VISION_METIERS.md — qualité > rapidité)

9. Outil `ask_user` (QCM agent) : spec pure du protocole pause/reprise de run_tool_loop + composant frontend de choix multiple. **La capacité transverse la plus importante.**
10. `psg_blueprint.py` : structure d'un PSG conforme CNPF (parcellaire, peuplements, programme coupes/travaux) + gabarit de rapport dédié.
11. `burned_area.py` : vectorisation du contour de zone brûlée depuis un raster dNBR classé (raster→polygones, lissage, surface par classe de sévérité).
12. `forest_classes.py` : nomenclature IGN BD Forêt v2 + schémas de classification de massifs (résineux/feuillus/mixte) + symbologie associée.
13. `path_classifier.py` : classification de pistes/dessertes forestières (praticabilité DFCI) depuis attributs OSM + géométrie.
14. Connecteur foncier : DVF/cadastre/data.gouv (+ spec Pappers) pour propriétaires et parcelles.
