# 🌌 MOONSHOT — QGISIA+ : la cartographie augmentée parfaite

> Objectif final (north star) : **« Décris ton intention en une phrase → l'agent produit
> une étude cartographique professionnelle, ultra-précise, mise en page au petit oignon,
> avec analyse d'image de pointe — automatiquement, en autonomie. »**
> On vise le « mieux du mieux ». On y va par paliers, chaque brique vérifiée en QGIS réel.

## Palier 1 — Socle agentique (FAIT ✅)
Agent NVIDIA NIM · tool-calling QGIS · catalogue mondial (28+ sources, WFS, COG) ·
diagnostic satellite (NDVI/NDWI/NDMI/SAVI/NBR/BSI, **vrai Sentinel-2 via STAC**) ·
détection de changement · stats zonales · buffer · symbologies institutionnelles FR ·
reproduction de carte (légende→QML) · dossiers territoriaux 1-clic · export GPKG/GeoJSON.

## Palier 2 — Profondeur & élégance (EN COURS 🚧)
- **Analyse d'image ultra-poussée** : détection/segmentation d'objets (bâti, arbres, eau,
  routes) via SAM/DeepForest ; classification supervisée ; super-résolution ; OCR de cartes.
- **Données ultra-précises** : fusion multi-capteurs (Sentinel-1 radar + 2 optique + Landsat),
  MNT/LiDAR & 3D, géoréférencement automatique sub-métrique, séries temporelles.
- **Mise en page au petit oignon** : `QgsLayout` automatique pro (titre, légende, échelle,
  flèche nord, cartouche, graphiques, logo), atlas multi-pages, templates de marque,
  export PDF/PPTX haute résolution.
- **Rapports narrés** : synthèse automatique (chiffres + graphiques + recommandations).

## Palier 3 — Moonshot (objectif final 🌠)
- **Étude territoriale 100% autonome** : 20→100 étapes, l'agent planifie, exécute,
  s'auto-corrige via **boucle vision** (rendu canvas → VLM critique → ajuste) jusqu'à
  la perfection visuelle.
  - ✅ **Boucle fermée et vérifiée** : `renderMapView` (vue→PNG) → `/api/llm/critiqueView`
    envoie l'image au **VLM NVIDIA** (Llama-3.2-90b-vision / Nemotron Omni) qui critique le
    rendu, combiné au score heuristique `critique_layout` + correctifs. Testé sur un rendu
    QGIS réel (critique concrète : cadrage, lisibilité, légende).
  - ✅ **Auto-amélioration multi-tours** : `/api/llm/autoImproveLayout` part du meilleur
    gabarit, ajoute à chaque tour les éléments manquants (`augment_to_complete`) et
    re-rend via `exportLayoutSpec` jusqu'au score cible, puis critique VLM du rendu final.
    L'agent converge tout seul vers une planche complète.
- **« Décris, l'IA réalise »** : reproduction pixel-perfect d'une carte depuis n'importe
  quelle image/PDF (symbologie, légende, étiquetage, géoréférencement) sur la zone voulue.
- **Prédictif** : Earth-2 (météo) + détection de changement → projection d'évolution
  (déforestation, artificialisation, inondation).
- **Multimodal** : voix→carte, requêtes en photo, dashboards temps réel partageables.
- **3D & immersion** : fly-through, vue 2.5D du relief, nuages de points.

## Principe de construction
Modules **purs** (testables, parallélisables Kimi) → **slots bridge** (QGIS, vérifiés réel,
Claude) → **outils agent** (MCP + tool-calling) → **UI**. Tout commité, tout vert.
