# QGISIA+ — Ce que l'agent IA sait vraiment faire

Document a partager. Un condensé concret de toutes les capacites du plugin QGISIA+.

---

## Ce que c'est

QGISIA+ est un **plugin QGIS** (Windows/Linux/macOS) qui transforme QGIS en un agent IA
SIG. Tu ne saisisses plus des coordonnees ou des requetes SQL — tu **parles** a tes
donnees en langage naturel, et l'agent execute directement dans QGIS.

**Modele economique** : BYOK (Bring Your Own Key). Gratuit avec Ollama local, ou
tu apportes ta propre cle NVIDIA NIM (40 req/min gratuites) / OpenRouter / Gemini.

---

## 1. Chat intelligent avec tes donnees

Tu poses une question en francais (ou anglais), l'agent comprend le contexte du
projet QGIS courant et repond.

**Exemples concrets** :
- *"Quelle est la superficie totale des parcelles classees en zone U ?"*
- *"Montre-moi les 5 couches avec le plus d'entites"*
- *"Resume ce que contient ce projet en 3 phrases"*

**Cerveaux disponibles** :
- **NVIDIA Nemotron 3 Super** (120B) — equilibre vitesse/qualite
- **NVIDIA Nemotron 3 Ultra** (550B) — raisonnement spatial complexe
- **Qwen3 Coder** (480B) — generation de code PyQGIS
- **Nemotron Omni** — vision (analyse de cartes et images)
- **Ollama local** (Qwen3, Gemma3) — 100% offline, zero cloud

---

## 2. L'agent agit dans QGIS — Tool Calling

L'agent ne repond pas juste : il **execute** des actions dans QGIS via 40+ outils.

### Manipulation des couches
| Action | Exemple de prompt |
|--------|-----------------|
| Lister les couches | *"Liste les couches du projet"* |
| Zoomer | *"Zoom sur la couche 'Parcelles'"* |
| Filtrer | *"Filtre les batiments de plus de 500m²"* |
| Opacite | *"Rends la couche OSM a 50%"* |
| Reprojeter | *"Reprojette le MNT en EPSG:2154"* |
| Buffer | *"Cree un buffer de 200m autour des rivieres"* |

### Donnees francaises officielles (connecteurs API)
| Source | Ce que ca charge |
|--------|---------------|
| **Hub'Eau** | Stations qualite eau, hydrometrie, piezometrie |
| **DVF** | Transactions immobilieres par commune/annee |
| **GBIF** | Occurrences d'especes (biodiversite mondiale) |
| **IGN / Geoplateforme** | Fonds cartographiques officiels |
| **Cadastre** | Parcelles, batiments, sections |
| **Copernicus** | Donnees Europeennes environnementales |

### Raster et imagerie satellite
| Outil | Resultat |
|-------|---------|
| **NDVI / NDWI / NDBI / NBR / EVI** | Indice spectral calcule + style auto |
| **Detection de changement** | Difference entre 2 rasters (t2 - t1) avec style divergent |
| **Statistiques zonales** | NDVI moyen par parcelle, ajoute des champs a la couche |
| **Classification** | Classes de vegetation, severite incendie, pentes |
| **Segmentation SAM** | Decoupe automatique d'orthophoto (batiments, arbres, eau) |
| **Sentinel-2 STAC** | Charge les bandes RED/NIR sur une emprise, moins nuageuse |
| **COG distant** | Raster via URL (/vsicurl/...) sans telechargement |

### Analyse spatiale avancee
| Outil | Usage |
|-------|-------|
| **Terrain** | Pente, exposition, ombrage, rugosite depuis un MNT |
| **Clustering DBSCAN** | Groupe les points en clusters (hotspots) |
| **Carte de chaleur** | Densite de noyau d'une couche de points |
| **Carte d'aptitude** | Somme ponderee de criteres raster (site selection) |
| **Zonal stats** | Stats raster par entite vectorielle |

---

## 3. Cartographie automatique

### Planches et atlas
| Action | Livrable |
|--------|---------|
| **Planche A4/A3** | PNG/PDF avec titre, carte, legende, echelle, fleche Nord |
| **Atlas multi-pages** | 1 page par commune/parcelle (couverture vectorielle) |
| **Rapport PDF/DOCX** | Snapshot carte + tableau des couches + sections perso |
| **Symbologies presets** | ONF, IGN BD Foret, PLU, Cadastre, Natura 2000, PPRi |
| **Style QML personnalise** | Applique un style XML a une couche |

**Exemple** : *"Genere un atlas PDF des communes du 31 au format A4 paysage"* → PDF
multi-pages genere, 1 page par commune, avec carte zoomee + titre.

---

## 4. Generation de code PyQGIS securisee

L'agent peut generer du code Python pour QGIS, mais il passe par des **guardrails** :
- Actions SAFE (zoom, style, filtre) → executees directement
- Actions DESTRUCTIVES (suppression, DROP TABLE) → bloquees ou confirmées
- Mode **Plan+Confirm** par defaut (l'agent montre son plan avant d'agir)
- Mode **Auto** pour power users (enchainement sans confirmation)

**Exemple** :
> *"Ecris un script qui selectionne les parcelles de plus de 1000m2 et les
> exporte en GeoJSON"*

→ Code genere, valide par guardrails, execute dans QGIS.

---

## 5. Vision — Analyse d'images de cartes

L'agent peut **voir** une carte (screenshot du canvas QGIS) et la critiquer :
- Legibilite, symbologie, echelle, legende
- Suggestions d'amelioration
- Auto-correction (applique les conseils du VLM)

**Boucle vision** :
1. Rendu du canvas → PNG
2. Envoi au VLM (NVIDIA Nemotron Omni)
3. Critique + suggestions
4. Application auto des corrections (style, zoom, etc.)

---

## 6. Prevision meteorologique (NVIDIA Earth-2)

Via NVIDIA Earth-2 Studio :
- Modeles FourCastNet, Pangu, AIFS, GraphCast
- Variables : temperature, precipitation, vent, pression
- Sortie GeoTIFF chargeable dans QGIS

**Exemple** : *"Prevision meteo a J+3 sur la France, temperature et precipitation"*

---

## 7. Dossiers territoriaux en 1 clic

Des **packs prets a l'emploi** qui chargent un ensemble de couches + symbologies :

| Dossier | Couches chargees |
|---------|-----------------|
| **Urbanisme** | PLU, Zonage, Cadastre, Batiments |
| **Risques** | PPRi, Zones inondables, Pentes |
| **Foret** | BD Foret IGN, Peuplements ONF, Occupation sol |
| **Environnement** | Natura 2000, ZNIEFF, Eaux souterraines |

**Exemple** : *"Deroule le dossier risques pour le 31"* → 4 couches chargees + styles
appliques en 5 secondes.

---

## 8. MCP Server — Interface pour Claude Desktop / Cursor

QGISIA+ expose ses 40+ outils via le protocole MCP (Model Context Protocol).
Tu peux piloter QGIS depuis **Claude Desktop**, **Cursor**, ou **Cline** :

```json
// Configuration Claude Desktop
{
  "mcpServers": {
    "qgisia-plus": {
      "command": "python",
      "args": ["-m", "QGISIA2.mcp_server"],
      "env": { "QGISIA_BRIDGE_URL": "http://localhost:8157" }
    }
  }
}
```

**Exemple d'usage** :
> *"Claude, liste les couches du projet QGIS courant"*
> → Claude appelle l'outil `getLayersList` → retourne la liste

---

## 9. Multi-agents et federation

L'agent principal **route** ta demande vers des agents specialises :

| Agent | Role | Modele |
|-------|------|--------|
| **Router** | Comprend l'intention et choisit l'expert | Nemotron Mini 4B (rapide) |
| **Code** | Genere du PyQGIS | Qwen3 Coder 480B |
| **Vision** | Analyse de cartes/images | Nemotron Omni |
| **Raisonnement** | Problemes spatiaux complexes | Nemotron Ultra 550B |
| **Safety** | Verifie que l'action est sure | Guardrails integres |

Le resultat est **synthetise** par un agent resumeur avant d'etre affiche.

---

## 10. LangGraph — Raisonnement structure

(Sprint 7, deja integre)

Le raisonnement suit un graphe explicite :
```
PLAN → EXECUTE → VERIFY → REPORT
              ↑_____KO_____|
              (max 3 replanifications)
```

Si une etape echoue, l'agent re-planifie automatiquement. Chaque transition est
tracable et visible dans l'UI.

---

## Securite

- **Cles API chiffrees** en local, jamais envoyees au serveur sans action utilisateur
- **Jamais de cles hardcodees** dans le code
- **Guardrails** : blocage des actions destructives (DROP, rm, del)
- **Confirmation obligatoire** pour les actions a risque (sauf Mode Auto)
- **Logs sans donnees sensibles**

---

## Compatibilite

| Element | Version |
|---------|---------|
| QGIS | 3.16+ et 4.x (PyQt5/PyQt6) |
| Python | 3.9+ |
| OS | Windows, Linux, macOS |
| GPU | Optionnel (CPU OK, GPU accelere) |

---

## Comment demarrer

1. **Installer** le plugin ZIP dans QGIS
2. **Lancer** "QGISIA+ AI" → navigateur s'ouvre
3. **Coller** sa cle NVIDIA NIM (gratuit, 40 req/min sur build.nvidia.com)
4. **Activer** le Gateway + Mode Action
5. **Parler** a ses donnees

**Sans cle** : activer Ollama local (100% offline, zero cloud, zero cout).

---

## En resume

QGISIA+ ce n'est pas juste un chatbot. C'est un **agent autonome** qui :
- Comprend le langage naturel
- Connait 40+ outils QGIS
- Interroge les APIs francaises en direct
- Analyse des images satellites
- Genere du code securise
- Cartographie automatiquement
- S'integre a Claude Desktop / Cursor
- Fonctionne offline (Ollama) ou cloud (NVIDIA NIM)

**Objectif** : reduire le temps d'analyse SIG de 2 heures a 2 minutes.
