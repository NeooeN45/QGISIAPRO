# 🛣️ ROADMAP QGISIA+ / GeoSylva

Voir [MOONSHOT.md](MOONSHOT.md) pour la vision. Ici : le plan d'exécution séquencé.
Principe : modules **purs** (Kimi) → **slots bridge** (Claude, vérifiés QGIS réel) → **outils agent** (MCP) → **UI**.

## Fait ✅
Socle agentique (NVIDIA NIM, tool-calling) · catalogue mondial (31 sources + WFS + COG) ·
Sentinel-2 réel (STAC, multi-capteurs) · indices (NDVI/NDWI/NDMI/SAVI/NBR/BSI/MSAVI2) ·
détection de changement + classes de sévérité · stats zonales · buffer · classification thématique ·
symbologies institutionnelles · reproduction légende→QML · dossiers 1-clic · mise en page
template/atlas (PNG/PDF) · rapports markdown · **boucle vision fermée (VLM NVIDIA)** +
auto-amélioration multi-tours · export GPKG/GeoJSON/SHP.

## En cours / à venir (ordre recommandé)

### 1. Étude territoriale 100% autonome  — Claude, L, 0 dépendance
Agent qui planifie 20–100 étapes (data→analyse→symbo→mise en page→rapport) et s'auto-corrige
via la boucle vision. Capitalise tout l'existant. Endpoint `/api/llm/autoStudy`.

### 2. Prédictif  — Claude+Kimi, M
`predict_trend.py` (Kimi) + slot : projection dNDVI/Earth-2 → évolution (déforestation,
artificialisation). Carte de tendance stylée.

### 3. Reproduction pixel-perfect depuis image/PDF  — Claude+Kimi, L
VLM/OCR lit une carte (légende, symboles) → QML → applique sur la zone. **Mistral OCR / Pixtral**
ajouté comme alias `vision-ocr` (LiteLLM provider `mistral/`, clé free tier) en complément du VLM NVIDIA.

### 4. 3D / relief 2.5D  — Claude, M
`terrain_formulas.py` (Kimi) + slots hillshade/pente/exposition ; vue oblique du MNT.

### 5. Analyse image lourde  — Claude, M (sur acceptation des téléchargements)
SAM réel (bâti/eau, checkpoint vit_b 375 Mo / vit_h 2,5 Go) · DeepForest (arbres).

### 6. Voix → carte  — Claude+Kimi, M
`voice_intents.py` (Kimi) + transcription → intention → action.

### 7. Dashboard temps réel partageable  — Claude, L
(voir section dédiée ci-dessous)

## 🖥️ Mise à jour COMPLÈTE du dashboard (frontend React/Vite)
Le dashboard doit exposer **tout ce qu'on a ajouté**. À faire :
- **Panneau Données** : catalogue (31 sources + WFS) avec recherche/filtre catégorie, ajout 1-clic ;
  chargement Sentinel réel (bbox + période).
- **Panneau Diagnostic satellite** : NDVI/NDWI/NDMI/SAVI/NBR/BSI, détection de changement (2 dates),
  stats zonales, classification thématique + sévérité — avec aperçu des rampes.
- **Panneau Dossiers 1-clic** : urbanisme / risques / forêt / environnement.
- **Panneau Analyse** : buffer, reprojection, filtres.
- **Panneau Mise en page** : templates (A4/A3, portrait/paysage), atlas PDF, export PNG/PDF ;
  bouton **« Auto-améliorer »** (boucle vision : score + critique VLM affichés).
- **Panneau Livrables** : export GPKG/GeoJSON/SHP, rapports markdown (aperçu + download).
- **Barre d'état agent** : mode (Gateway / SIG intelligent / Action), modèle utilisé, budget tokens.
- **Indicateurs** : nb couches, dernière critique vision, score de complétude de la carte courante.
- **Refonte visuelle** cohérente + responsive ; i18n FR.

> Statut frontend actuel : `GatewaySettingsPanel` (3 toggles) + chat. La refonte ci-dessus est
> un gros chantier UI à découper (brainstorming → plan → exécution par sous-tâches).
