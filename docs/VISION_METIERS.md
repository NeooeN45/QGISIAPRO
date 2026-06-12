# 🌲 VISION MÉTIERS — Packs de spécialisation QGISIA+

> Complément de [MOONSHOT.md](MOONSHOT.md). Le moonshot dit *comment* (agent autonome,
> boucle vision) ; ce document dit *pour qui et pour quoi* : des livrables métier de
> qualité professionnelle. **Règle d'or : la qualité prime toujours sur la rapidité.**

## Flux utilisateur cible

```
Prompt + documents (PDF, plans, PSG existants…) + position/zone
        │
        ▼
Crew NVIDIA NIM (planificateur → agents spécialisés → boucle vision)
        │  s'appuie sur : couches déjà présentes dans le projet QGIS (si pertinent),
        │  catalogue mondial, scrapeurs, MCP, données foncières (Pappers/équiv.)
        ▼
   Doute ? ──► Question QCM à l'utilisateur (choix multiples, comme Claude Code)
        │
        ▼
Livrable professionnel : carte + planches + rapport + exports
```

## Pack 1 — Gestion Forestière (priorité, expertise du porteur)

| Livrable | Briques existantes | À construire |
|---|---|---|
| **Plan d'aménagement / PSG** | createInventoryGrid, calculateMnh, zonalStatistics, exportAtlas, report_templates, symbologies ONF/IGN BD Forêt | Gabarit PSG conforme CNPF (parcellaire, peuplements, programme de coupes/travaux), ingestion de documents (doc-intel) |
| **Contours de zones brûlées** | computeRasterDifference + classifyChange `dnbr_feu` (dNBR USGS), Sentinel-2 STAC | Vectorisation auto du contour (raster→polygone), datation avant/après automatique |
| **Classification de massifs** | classifyRaster, clusterPoints, samgeo_tool | Classification supervisée peuplements (résineux/feuillus/mixte), nomenclature IGN BD Forêt v2 |
| **Reconnaissance d'objets et chemins** | SAM (segmentation), DeepForest (arbres), OSM | Extraction de pistes/dessertes + classification (praticabilité DFCI), détection coupes rases |

## Packs suivants

- **Incendie** : aléa feu (pente × exposition × combustible), zones DFCI, dNBR sévérité, OLD (obligations légales de débroussaillement).
- **Urbanisme** : artificialisation (détection de changement), PLU, ZAN, DVF.
- **Agricole** : RPG, indices de stress hydrique (NDMI/NDWI), parcellaire.
- Chaque pack = `sources + symbologies + study_plans + gabarits rapport/layout` —
  extensions des modules existants (`dossier_blueprint`, `study_planner`,
  `symbology_library`, `report_templates`), pas de nouvelle architecture.

## Capacités transverses à développer

1. **Questions QCM de l'agent** (la plus importante) : nouvel outil `ask_user`
   dans le TOOL_CATALOG → la boucle `run_tool_loop` se met en pause → le frontend
   affiche un choix multiple → la réponse repart dans la boucle. Qualité > vitesse :
   l'agent DOIT demander plutôt que deviner.
2. **Ingestion de documents** : PDF/plans → alias `doc-intel` (Nemotron VL) + RAG
   existant (`/api/rag/*`) pour ancrer le crew sur les documents de l'utilisateur.
3. **Données foncières** : connecteur Pappers / data.gouv (DVF, cadastre,
   propriétaires) + scrapeurs résilients pour les sources sans API.
4. **MCP sortant** : le plugin consomme des serveurs MCP externes (en plus d'en
   être un) pour brancher n'importe quelle source future.
