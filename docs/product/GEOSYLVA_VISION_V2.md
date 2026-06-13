# 🌍 GeoSylva AI V2 — Vision Produit & Roadmap Stratégique

> **Mission** : devenir la plateforme géospatiale IA de référence en France et en Europe — plus puissante que Pixstart, plus ouverte que ArcGIS, plus accessible que Google Earth Engine.

---

## 1. Positionnement produit

### Qui utilise GeoSylva ?

| Persona | Besoin principal | Gain clé |
|---|---|---|
| **Forestier / ONF / coopérative** | Suivre l'état sanitaire de parcelles, détecter scolytes/coupes illégales | Alertes satellites automatiques + rapports clé en main |
| **Collectivité / mairie** | Cadastre, PLU, urbanisme, eau, biodiversité | Agent IA qui répond en langage naturel + cartes prêtes à publier |
| **Bureau d'études environnement** | Diagnostics, études d'impact, dossiers loi sur l'eau | Industrialisation des livrables, conformité réglementaire |
| **Agriculteur / viticulteur** | Stress hydrique, NDVI, rendements | Dashboards parcellaires + conseils personnalisés |
| **Assureur / risque** | Sinistres, inondations, incendies, subsidence | Détection multi-temporelle + estimation dommages |
| **Administration / gendarmerie** | Construction illégale, dépôts sauvages | Comparaison temporelle automatique |
| **Data scientist / SIG pro** | Automatiser ses workflows QGIS | Copilote PyQGIS sans hallucinations (RAG) |

### Proposition de valeur en une phrase

> **GeoSylva AI est le premier copilote géospatial conversationnel qui unifie imagerie satellite, données officielles françaises, et 100+ modèles d'IA — utilisable comme plugin QGIS, app standalone, ou serveur MCP universel.**

---

## 2. Matrice de fonctionnalités vs Pixstart

| Domaine | Pixstart | GeoSylva V2 (cible) |
|---|---|---|
| **Qualité de l'eau (WaterWatch)** | ✅ Analyse multi-spectrale | ✅ + Agent conversationnel + open data SIE/Naïades |
| **Santé des forêts (WoodWatch)** | ✅ Suivi scolytes/coupes | ✅ + LiDAR HD IGN + cadastre forestier + CVF/DSF |
| **Zones à enjeux (BuildSpot)** | ✅ Cadastre, construction illégale | ✅ + IA vision Claude/Kimi + historique 2005-2025 |
| **Biodiversité (EcoScan)** | ✅ Indices de biodiversité | ✅ + GBIF + OpenObs + INPN + TaxRef |
| **Environnements complexes (EmergencyWatch)** | ✅ Urgences, pollutions | ✅ + Copernicus Emergency + Sentinel Asynchronous Service |
| **Agent conversationnel** | ❌ | ✅ **Différenciateur clé** |
| **Plugin QGIS natif** | ❌ | ✅ **Différenciateur clé** |
| **Mode 100% offline** | ❌ | ✅ (Ollama + cache tuiles) **Différenciateur** |
| **Serveur MCP universel** | ❌ | ✅ **Standard ouvert unique au marché** |
| **Prix d'entrée** | Devis SaaS | Plugin gratuit + pro à partir de 19€/mois |
| **Extensibilité** | Fermée | 100% open source core + marketplace de tools |

**Conclusion** : GeoSylva couvre les **5 verticales Pixstart** + ajoute **4 différenciateurs structurels** qui changent le marché.

---

## 3. Les 8 modules fonctionnels de GeoSylva V2

### 🌊 Module 1 — **AquaScope** (= WaterWatch+)
- Détection turbidité, chlorophylle-a, matières en suspension via Sentinel-2
- Indices NDWI, MNDWI, WSI, eutrophisation
- Branchement SIE / Naïades / ADES / Hub'Eau (qualité, piézométrie)
- Rapport automatique DCE (Directive Cadre sur l'Eau)
- Alertes : dépassements seuils, blooms algaux

### 🌲 Module 2 — **SylvaWatch** (= WoodWatch+, cœur historique)
- MNH auto depuis MNS-MNT IGN LiDAR HD
- Détection scolytes (indice CRSWIR + anomalies NBR)
- Comparaison multi-dates : coupes rases, dépérissement
- Couplage cadastre forestier + peuplements DSF
- Rapport forestier conforme aux normes ONF/CNPF
- **Feature unique** : estimation volume bois sur pied (m³/ha) via LiDAR + modèle allométrique

### 🏗️ Module 3 — **UrbanGuard** (= BuildSpot+)
- Détection construction illégale par comparaison temporelle
- Cadastre (cadastre.data.gouv.fr + API Carto)
- PLU/PLUi (Géoportail de l'urbanisme)
- DPE / DVF (Demandes de Valeurs Foncières)
- Permis de construire (API Sitadel)
- **Feature unique** : agent juridique — "cette construction respecte-t-elle le PLU ?"

### 🦋 Module 4 — **BioTrack** (= EcoScan+)
- Indices biodiversité (Shannon, IBP, IBI)
- GBIF / OpenObs / INPN / TaxRef / ONB / Clé de détermination
- Zones protégées (Natura 2000, ZNIEFF, PNR, RNN)
- Trames verte/bleue, corridors écologiques
- **Feature unique** : agent inventaire floristique/faunistique assisté

### 🚨 Module 5 — **RiskSentinel** (= EmergencyWatch+)
- Inondations (Vigicrues + Copernicus EMS)
- Incendies (EFFIS, VIIRS Active Fires, FIRMS)
- Sécheresse (Propluvia, indice SPI)
- Subsidence (InSAR via Sentinel-1)
- Séismes (BCSF-RéNaSS)
- Pollution air (Atmo, Copernicus CAMS)
- **Feature unique** : simulation propagation (feu, crue) avec IA

### 🌾 Module 6 — **AgriLens** (bonus)
- NDVI / NDRE / LAI / fAPAR via Sentinel-2 10m
- Stress hydrique + recommandations irrigation
- RPG (Registre Parcellaire Graphique) agricole
- Prédiction rendement IA
- Parcellaires viticoles (cartes BRGM)

### 🏛️ Module 7 — **CivicData** (bonus — collectivités)
- Agrégateur données locales : INSEE, SIRENE, data.gouv
- Dashboard territorial (démographie, économie, environnement)
- Open Data auto-import (CKAN / DCAT / data.gouv)
- Génération de bilans RSE/DPEF territoriaux

### 🤖 Module 8 — **CopilotQGIS** (transversal — cœur IA)
Le cerveau qui orchestre les 7 autres modules :
- Agent conversationnel multilingue (FR/EN/DE/ES)
- Génération PyQGIS sans hallucination (RAG doc officielle)
- Planification multi-étapes (LangGraph)
- Mémoire long-terme par projet (mem0)
- Vision (analyse captures carte + photos terrain)
- Voice input (Whisper local)
- **Feature unique** : export vidéo narrée automatique pour présentations

---

## 4. Inventaire exhaustif des sources de données

### 🗺️ Cartographie & fonds
| Source | Type | API | Statut GeoSylva |
|---|---|---|---|
| IGN Géoplateforme | WMS/WMTS/WFS | ✅ Ouvert | ✅ intégré |
| cartes.gouv.fr | Fonds Scan25, Plan IGN, Photos | ✅ | ✅ |
| OpenStreetMap | Vecteur mondial | Overpass API | ✅ |
| Google Maps/Satellite | Tuiles | Paid | 🟡 optionnel |
| Bing Maps | Tuiles | Clé | 🟡 optionnel |
| Mapbox | Styles custom | Clé | 🟡 optionnel |
| ESRI World Imagery | Imagery | Ouvert (attribution) | ⏳ à ajouter |
| Maxar / Airbus Pléiades | THR commerciale | Paid | 🟡 pro |

### 🛰️ Imagerie satellite
| Source | Résolution | Revisite | API | Statut |
|---|---|---|---|---|
| **Sentinel-2** (optique) | 10m | 5j | Copernicus Data Space | ⏳ prioritaire |
| **Sentinel-1** (SAR) | 10m | 6j | Copernicus Data Space | ⏳ |
| **Sentinel-3** (océan/atmo) | 300m | 1j | Copernicus | ⏳ |
| **Sentinel-5P** (atmosphère) | 7km | 1j | Copernicus | ⏳ |
| **Landsat 8/9** | 30m | 16j | USGS / NASA Earthdata | ⏳ |
| **MODIS** (Aqua/Terra) | 250m | 1j | NASA | ⏳ |
| **VIIRS** (feux actifs) | 375m | 12h | NASA FIRMS | ⏳ |
| **Pléiades / SPOT** | 50cm-1.5m | On-demand | DINAMIS (gratuit recherche) | 🟡 |
| **Google Earth Engine** | Pétaoctets | Toutes | Python API | ⏳ **KEY** |
| **Planet Labs** | 3m quotidien | 1j | Paid | 🟡 pro |
| **SkyWatch EarthCache** | Multi | On-demand | Aggregateur | 🟡 |

### 🏛️ Données officielles françaises
| Source | Contenu | Statut |
|---|---|---|
| **cadastre.data.gouv.fr** | Parcelles, bâti, feuilles cadastrales | ⏳ |
| **API Carto** | Cadastre, PLU, DFCI, GPU | ✅ partiel |
| **geo.api.gouv.fr** | Communes, départements, EPCI | ✅ |
| **Géoportail de l'Urbanisme** | PLU/PLUi, SCoT, Servitudes | ⏳ |
| **BD TOPO / BD ORTHO / BD ALTI** | IGN vecteur/raster | ⏳ |
| **BD Forêt v2 (IGN)** | Peuplements forestiers | ⏳ |
| **LiDAR HD IGN** | MNT/MNS 50cm national | ⏳ **KEY forêt** |
| **RPG** | Parcellaire agricole | ⏳ |
| **data.gouv.fr** (CKAN) | 40k datasets | ⏳ |
| **INSEE** | Carroyage, IRIS, RP | ⏳ |
| **BRGM InfoTerre** | Géologie, BSS, ICPE | ⏳ |
| **Sandre / Hub'Eau / Naïades / ADES** | Eau qualité/quantité | ⏳ |
| **INPN / GBIF / OpenObs** | Biodiversité | ⏳ |
| **MNHN TaxRef** | Référentiel taxonomique | ⏳ |
| **Atmo France** | Qualité air régionale | ⏳ |
| **Vigicrues** | Hydrologie temps réel | ⏳ |
| **Météo-France** | Prévisions, climatologie | ⏳ |
| **DVF (ETALAB)** | Transactions foncières | ⏳ |
| **Sitadel (MTE)** | Permis construire/aménager | ⏳ |
| **Base Adresse Nationale** | Adresses officielles | ⏳ |
| **REE / RPLS** | Répertoire logements sociaux | ⏳ |
| **DPE (ADEME)** | Diagnostic énergétique | ⏳ |

### 🌍 International & Open
| Source | Usage | Statut |
|---|---|---|
| **Copernicus CLMS** | Land cover européen | ⏳ |
| **Copernicus EMS** | Emergency mapping | ⏳ |
| **Copernicus CAMS** | Atmosphère | ⏳ |
| **Copernicus C3S** | Climat | ⏳ |
| **EFFIS** | Incendies Europe | ⏳ |
| **EUMETSAT** | Météo sat | ⏳ |
| **ECMWF / ERA5** | Réanalyses climat | ⏳ |
| **GBIF** | Biodiv mondiale | ⏳ |
| **OpenStreetMap Overpass** | Vecteur mondial | ✅ |
| **OpenWeatherMap** | Météo live | ⏳ |

---

## 5. Stack technologique IA — 2026 state-of-the-art

### Couche 1 — Gateway & orchestration
| Tech | Rôle | Statut |
|---|---|---|
| **LiteLLM** (embarqué vendor) | 100+ providers unifiés | ✅ **Sprint 1 fait** |
| **LangGraph** | Graphe d'agents stateful | Sprint 5 |
| **CrewAI** (optionnel) | Équipes d'agents spécialisés | Sprint 5 |
| **MCP Server QGIS** | Exposer QGIS aux LLMs externes | Sprint 2 |
| **Temporal.io** (ou Prefect) | Workflows longs (batch satellite) | Sprint 8 |

### Couche 2 — Modèles (routés par LiteLLM)
| Modèle | Usage | Provider | Coût |
|---|---|---|---|
| **Claude 3.5 Sonnet / Opus 4** | Raisonnement complexe, code | Anthropic / OpenRouter | $$$ |
| **GPT-4o / o1** | Raisonnement, vision | OpenAI | $$$ |
| **Gemini 2.5 Pro/Flash** | Multimodal, rapide, gratuit | Google | $ / gratuit |
| **Kimi K2.5** | **Vision SOTA, 1M tokens** | Moonshot / OR | $ |
| **Qwen 2.5 / Qwen3** | Code, multilingue | Alibaba / Ollama | Gratuit local |
| **Llama 3.3 / 4** | Raisonnement open | Meta / NIM | Gratuit local |
| **DeepSeek V3 / R1** | Raisonnement, code | DeepSeek / OR | $ |
| **Mistral Large / Pixtral** | Français natif, vision | Mistral / Azure | $$ |
| **NVIDIA NIM** | Inference optimisée GPU | NVIDIA | Gratuit dev |
| **Gemma 3** | Local multimodal | Ollama | Gratuit local |

### Couche 3 — IA géospatiale spécialisée
| Tech | Usage | Statut |
|---|---|---|
| **GeoAI (opengeoai)** | Segmentation, détection sat | Sprint 3 |
| **SAM 2 (Meta)** | Segment anything satellite | Sprint 3 |
| **Grounding DINO + SAM** | Détection open-vocab | Sprint 3 |
| **torchgeo** | Datasets + modèles PyTorch | Sprint 3 |
| **torchange** | Détection changements | Sprint 3 |
| **GeoSAM** | SAM spécialisé géo | Sprint 3 |
| **Prithvi (IBM/NASA)** | Foundation model earth | Sprint 4 |
| **SatMAE / Scale-MAE** | Embeddings satellite | Sprint 4 |
| **Clay Foundation Model** | Open earth foundation | Sprint 4 |

### Couche 4 — Mémoire, RAG, cache
| Tech | Usage | Statut |
|---|---|---|
| **pgvector** (PG déjà installé) | Vecteurs tabulaires | Sprint 4 |
| **ChromaDB** | Embeddings locaux rapides | Sprint 4 |
| **mem0** | Mémoire long-terme agents | Sprint 6 |
| **Bifrost** (optionnel) | Semantic cache Go | Sprint 7 |
| **LangSmith** | Tracing + A/B prompts | Sprint 6 |
| **Portkey** (optionnel) | Observabilité production | Sprint 9 |

### Couche 5 — Frontend & UX
| Tech | Usage | Statut |
|---|---|---|
| **React 19 + Vite** | Base actuelle | ✅ |
| **shadcn/ui + Tailwind** | UI premium (à ajouter) | ⏳ |
| **Framer Motion** (déjà là) | Animations | ✅ |
| **Tanstack Query** | Cache API | ⏳ |
| **Tanstack Table** | Tables complexes | ⏳ |
| **Leaflet / MapLibre GL** | Cartes web | ✅/⏳ |
| **Deck.gl** | Visu 3D, big data | Sprint 7 |
| **Cesium JS** | Globe 3D, LiDAR | Sprint 8 |
| **Three.js + react-three-fiber** | MNT 3D, peuplements | Sprint 8 |

### Couche 6 — Backend étendu (pour standalone)
| Tech | Usage | Statut |
|---|---|---|
| **FastAPI** | API backend standalone | Sprint 10 |
| **Pydantic v2** | Schemas | Sprint 10 |
| **PostgreSQL 16 + PostGIS 3.4** | Base géospatiale | ⏳ |
| **pgvector** | IA | Sprint 4 |
| **Redis** | Cache + queues | Sprint 10 |
| **MinIO / S3** | Stockage rasters | Sprint 10 |
| **Celery / Dramatiq** | Jobs async | Sprint 10 |
| **Tauri** (pas Electron) | Desktop standalone | Sprint 12 |

### Couche 7 — Déploiement & DevOps
- Docker Compose (dev), Kubernetes (prod)
- Nginx + Cloudflare
- Supabase (option serverless)
- CI/CD : GitHub Actions + tests Playwright
- Monitoring : Grafana + Loki + Prometheus
- Error tracking : Sentry

---

## 6. Architecture cible V2

```
┌──────────────────────────────────────────────────────────────────┐
│                        UTILISATEURS                              │
│   QGIS Plugin  •  Web App Standalone  •  Claude/Cursor (MCP)     │
└────────────────┬─────────────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────────────┐
│                      GEOSYLVA FRONTEND                           │
│     React 19 + shadcn/ui + MapLibre/Deck.gl/Cesium              │
│     ├── Chat conversationnel (streaming)                         │
│     ├── 8 modules métier (AquaScope, SylvaWatch, etc.)          │
│     ├── Éditeur workflows visuel (LangGraph UI)                  │
│     └── Dashboards & rapports auto                               │
└────────────────┬─────────────────────────────────────────────────┘
                 │ HTTP / WebSocket / SSE
┌────────────────▼─────────────────────────────────────────────────┐
│                  GEOSYLVA CORE (Python)                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ LiteLLM Gateway  │  │ LangGraph Agents │  │ MCP Server    │ │
│  │ (100+ modèles)   │  │ (orchestration)  │  │ (standard)    │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ RAG PyQGIS       │  │ mem0 Memory      │  │ Vector Store  │ │
│  │ (anti-halluc.)   │  │ (long-terme)     │  │ (pgvector)    │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            GeoAI Engine (Python)                          │  │
│  │  GeoAI • SAM2 • torchgeo • Prithvi • Clay • GDAL         │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────┬─────────────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────────────┐
│               CONNECTEURS DE DONNÉES (30+)                       │
│  Cadastre • IGN • LiDAR HD • Copernicus • NASA • GBIF • INPN    │
│  Hub'Eau • Atmo • RPG • DVF • OSM • EFFIS • ERA5 • ...          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7. Roadmap 12 sprints — 6 mois

| # | Sprint | Durée | Livrable | Valeur business |
|---|---|---|---|---|
| 1 | **LiteLLM Gateway** | 1 sem | ✅ fait | Fondation 100+ modèles |
| 2 | **MCP Server QGIS** | 1 sem | Standard universel | Différenciation marché |
| 3 | **GeoAI + SAM2** | 2 sem | Segmentation IA satellite | Parité Pixstart sur imagerie |
| 4 | **RAG pgvector + Clay** | 2 sem | Zéro halluc PyQGIS + embeddings sat | Fiabilité pro |
| 5 | **LangGraph agents** | 2 sem | Orchestration stateful | Workflows complexes |
| 6 | **mem0 + LangSmith** | 1 sem | Mémoire + observabilité | Fidélisation user |
| 7 | **Module SylvaWatch complet** | 2 sem | LiDAR HD + scolytes + volumes | 1er module commercial |
| 8 | **Module UrbanGuard** | 2 sem | Cadastre + PLU + détection illégale | 2ème module |
| 9 | **Module AquaScope** | 2 sem | Qualité eau + Hub'Eau | 3ème module |
| 10 | **Backend FastAPI standalone** | 2 sem | App web indépendante | Standalone SaaS |
| 11 | **Tauri desktop app** | 2 sem | App Windows/Mac/Linux signée | Distribution grand public |
| 12 | **Modules Risk + Bio + Agri + Civic** | 3 sem | 4 derniers modules | Parité totale Pixstart+ |

**Total ~24 semaines** — MVP commercialisable fin sprint 7 (3 mois).

---

## 8. Modèle économique

### Freemium open source
- **Plugin QGIS gratuit** : core + IA locale Ollama + modules communautaires
- Modèle : Community Edition MIT, Pro Edition propriétaire

### Tiers payants (SaaS)
| Offre | Prix | Cible | Inclus |
|---|---|---|---|
| **Starter** | 19€/mois | Indépendants, étudiants | Modules locaux, 100 req cloud/mois |
| **Pro** | 89€/mois | Bureaux d'études | Tous modules, 5k req/mois, support |
| **Team** | 299€/mois | 5 users, PME | + mem0 partagée, rapports co-brandés |
| **Enterprise** | Sur devis | Collectivités, grands comptes | On-premise, SLA, formation, MCP privé |

### Marketplace (v2 roadmap +6 mois)
- Tools MCP tiers payants (ex : "détection panneaux solaires", "classification parcelles viticoles")
- Revenue share 70/30

### Partenariats
- Revendeurs QGIS locaux (intégrateurs)
- CNPF / ONF / chambres d'agriculture (licence groupe)
- Éditeurs assurance / immobilier (API privée)

---

## 9. Différenciateurs impossibles à copier rapidement

1. **Seul produit qui fait MCP + QGIS + standalone** — 6 mois d'avance minimum
2. **Mode 100% offline** avec Ollama — personne d'autre ne le propose en géospatial IA
3. **Open source core** — communauté > effet réseau
4. **RAG PyQGIS** — l'IA ne peut pas inventer de fonctions (problème #1 des concurrents)
5. **Couverture FR exhaustive** — 30+ APIs officielles intégrées natively
6. **Multi-providers LLM** — pas de dépendance à un vendor IA, résistant aux hausses de prix

---

## 10. Risques & mitigations

| Risque | Probabilité | Mitigation |
|---|---|---|
| Coûts API LLM explosent | Moyen | Ollama local + cache sémantique + budgets LiteLLM |
| Pixstart lance un concurrent QGIS | Faible | 18 mois d'avance, MCP verrouille l'écosystème |
| Changement API IGN / Copernicus | Faible | Abstraction dans connecteurs, fallbacks |
| Performance sur gros rasters | Moyen | Tiling + COG + traitement async backend |
| Sécurité clés API utilisateur | Élevé | Chiffrement local + gateway encapsule |
| Conformité RGPD données perso | Élevé | Audit + mode on-premise pour admin |

---

## 11. Prochaines décisions à prendre ENSEMBLE

1. **Nom commercial final** — "GeoSylva AI" reste ? ou plus large ("GeoPilote", "TerraCopilot", "GéoGPT") ?
2. **Marque ombrelle vs modules** — 1 marque unique ou marques filles (comme Pixstart) ?
3. **Open source vs propriétaire** — quelle frontière ? (reco : core MIT, modules premium fermés)
4. **Budget cloud IA** — combien tu peux mettre par mois pour les tests / clients zéro ? (impacte choix modèles)
5. **Cible #1** — on attaque quel persona en premier pour valider le marché ? (reco : forestier privé, marché le plus chaud en France)

---

## 12. Checkpoint — prochain sprint

Sprint 1 (LiteLLM) est **livré**. Il reste à **tester** puis migrer le frontend.

**Mon ordre d'exécution recommandé** pour maximiser l'effet visible :

```
Sprint 1 (fait) → Test & migration UI
     ↓
Sprint 2 (MCP) → 1 semaine, énorme PR / buzz
     ↓
Sprint 4 (RAG) → 2 sem, élimine hallucinations — fiabilité
     ↓
Sprint 3 (GeoAI + SAM2) → 2 sem, parité Pixstart
     ↓
Sprint 7 (SylvaWatch commercial) → MVP monétisable
     ↓
Lancement beta privée (10 forestiers pilotes)
     ↓
Itérations + Sprints 8-12
     ↓
Lancement public + levée seed possible
```

**3 mois pour un MVP vendable. 6 mois pour dépasser Pixstart.**
