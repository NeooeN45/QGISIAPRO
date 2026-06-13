# 📜 Charte Produit GeoSylva AI V2

> **Document officiel des décisions stratégiques — source unique de vérité produit.**
> Toute décision de dev doit être cohérente avec ce qui est écrit ici.
> Mise à jour uniquement après discussion explicite.

**Version** : 1.0
**Date** : 2026-04-24
**Status** : ✅ Validé

---

## 1. Identité

**Nom** : GeoSylva AI
**Positionnement** : Le premier agent géospatial autonome pour QGIS.
**Mission** : L'utilisateur décrit en langage naturel, l'IA planifie et exécute toute la chaîne cartographique — de la donnée au rapport PDF final.

---

## 2. Décisions stratégiques figées

### D1. Comportement de l'agent — **HYBRIDE INTELLIGENT**

- **Défaut** : mode Plan + Confirm (1 clic)
  - L'IA affiche le plan numéroté des étapes
  - L'utilisateur valide d'un clic → exécution complète avec progress bar
- **Toggle Auto** : bouton persistant en haut du chat pour les power users
  - Actions enchaînées sans confirmation
- **Règle absolue** : actions destructives (suppression couches, écriture disque hors projet, modification données source) demandent **toujours** confirmation, même en mode Auto.

### D2. Cible #1 — **Pros SIG indépendants & consultants**

- **Profil** : freelances QGIS, bureaux d'études 1-10 personnes, formateurs SIG, power users
- **Raison** : viralité, feedback technique rapide, exigence qualité qui tire le produit vers le haut
- **Canal d'acquisition** : QGIS Plugin Registry + Twitter/LinkedIn SIG + forums geotribu.fr, georezo.net
- **Métriques de succès** : 500 installs en 3 mois, 50 utilisateurs actifs/semaine, 10 payants

### D3. 4 killer features MVP (toutes obligatoires)

1. **Agent autonome zero-hallucination PyQGIS**
   - RAG sur doc PyQGIS officielle
   - Base vectorielle de scripts vérifiés
   - Validation syntaxique avant exécution
   - Aucune fonction inventée — échec préférable à fake

2. **Export automatique PDF/Word magnifique**
   - Templates pro (titre, légende, échelle, flèche nord, logo, attribution)
   - Mise en page QGIS Layout + python-docx + reportlab
   - Atlas QGIS pour séries de cartes
   - Branding user (logo, couleurs, pied de page)

3. **30+ connecteurs APIs FR natifs**
   - Cadastre, PLU, IGN, LiDAR HD, Hub'Eau, GBIF, DVF, etc.
   - Chacun appelable en langage naturel
   - Cache intelligent (éviter re-téléchargements)
   - Documentation inline de chaque connecteur pour l'IA

4. **MCP Server QGIS** (différenciateur marché)
   - Expose QGIS comme outil standard MCP
   - Compatible Claude Desktop, Cursor, Continue, Cline
   - Tools : list_layers, run_pyqgis, load_wms, reproject, export_pdf, etc.
   - Publication sur mcp.so pour visibilité

### D4. Forme produit — **Plugin QGIS uniquement**

- Pas de standalone pour le MVP (reporté post-MVP si demande marché)
- Pas de mobile (reporté v2)
- Interface : React déjà magnifique, ouvre dans navigateur via localhost
- Backend : 100% intégré au plugin QGIS Python
- Distribution : QGIS Plugin Registry + ZIP direct GitHub

### D5. Modèle économique — **BYOK (Bring Your Own Key)**

- **L'utilisateur fournit toujours ses propres clés API** (OpenRouter, Gemini, Anthropic, etc.)
- **Avantages** :
  - Zéro facturation intermédiaire → zéro risque juridique
  - GeoSylva = plateforme neutre, pas revendeur IA
  - Pas de coût cloud côté éditeur
  - L'utilisateur garde le contrôle total de ses coûts
- **Plan gratuit** : Ollama local + Gemini 2.5 Flash gratuit (quota Google)
- **Plan payant** (futur) : marketplace de connecteurs premium, modules métier spécialisés, support, formations

---

## 3. Tiers commerciaux (projection)

| Tier | Prix | Inclus | Cible |
|---|---|---|---|
| **Community** | Gratuit | Plugin complet, tous les connecteurs open, agent, MCP, export | Pros SIG, étudiants, passionnés |
| **Pro** | 19€/mois | + Modules métier (SylvaWatch, UrbanGuard, AquaScope), templates export premium, support prioritaire | Consultants indépendants |
| **Team** | 89€/mois/user | + Mémoire partagée mem0, co-branding rapports, API priority | Bureaux d'études 2-10 |
| **Enterprise** | Devis | On-premise, SLA, formation, MCP privé, custom modules | Collectivités, grands comptes |

---

## 4. Stack technique validée

### Embarqué dans le plugin
- **LiteLLM** (vendor isolé) → 100+ providers ✅ Sprint 1 livré
- **Python 3.9+** (QGIS natif)
- **React 19 + Vite + Tailwind** (UI existante conservée)
- **HTTP server BaseHTTPServer** (existant, étendu)

### À intégrer (roadmap) — 12 technos critiques validées (voir TECH_LANDSCAPE_2026.md)

**Agents & orchestration**
- **LangGraph + Pydantic AI** → graphe stateful typé (planner→reviewer→executor) — Sprint 7
- **MCP Python SDK** → serveur MCP QGIS universel — Sprint 6
- **mem0** → mémoire long-terme par projet — Sprint 6

**RAG & IA géo**
- **ChromaDB + BGE-M3** embeddings → RAG PyQGIS zero-halluc — Sprint 3
- **opengeoai + SAM 2 + GroundingDINO** → segmentation/détection sat — Sprint 3
- **TorchChange + DeepForest** → détection changements forestiers — Sprint 8

**Providers LLM (via LiteLLM)**
- **NVIDIA NIM** (Nemotron enterprise) — ajouté ✅
- **Groq LPU** (intent-router ultra-rapide gratuit) — ajouté ✅
- **Cerebras WSE** (latence record) — ajouté ✅
- **Mistral AI direct** (français natif) — ajouté ✅
- **OpenRouter** (500+ modèles) — ajouté ✅

**Export & reporting**
- **QGIS Layout + WeasyPrint + python-docx + Pandoc** → exports pro multi-format — Sprint 5

**Observabilité & qualité**
- **Langfuse** (selfhost) → tracing agents open source — Sprint 7
- **Ragas** → évaluation scientifique RAG — Sprint 3
- **Promptfoo** → tests A/B prompts CI — Sprint 9

**Sécurité & gouvernance**
- **Presidio** (Microsoft) → anonymisation PII cadastre (RGPD) — Sprint 5 **OBLIGATOIRE**
- **NeMo Guardrails** → prévention prompt injection — Sprint 9

**Standards géospatiaux**
- **STAC + COG** → catalogue imagerie cloud-optimized — Sprint 4
- **OGC API Features/Tiles/EDR** → interop standards QGIS natifs

**Input multimodal**
- **faster-whisper** (local) → voice input gratuit — Sprint 10

### Tier Enterprise (post-MVP)
- **NVIDIA AI-Q Blueprint** complet (NIM + NeMo Retriever + Agent Toolkit)
- Deployment Docker Compose / Kubernetes on-premise
- Cible : collectivités, ministères, ONF/IGN, grands comptes
- Licence annuelle 5-50k€

### Volontairement **exclus** pour MVP
- ❌ FastAPI standalone (reporté)
- ❌ Tauri/Electron (reporté)
- ❌ Authentification / multi-user (BYOK rend inutile)
- ❌ Base de données serveur (tout en local dans le projet QGIS)
- ❌ Mobile / PWA (reporté v2)

---

## 5. Roadmap V2 ajustée — 10 sprints

La cible Pros SIG + 4 killer features + plugin-only change la roadmap.

| # | Sprint | Durée | Livrable | Décision source |
|---|---|---|---|---|
| 1 | **LiteLLM Gateway** | ✅ fait | Backend + client TS | Infra |
| 1b | **Migration frontend + Settings Gateway** | 0.5 sem | `llm.ts` → litellm-client, UI gestion clés BYOK | D5 |
| 2 | **Agent Hybride (Plan+Confirm+Auto)** | 1 sem | UI plan d'exécution, toggle auto, confirm destructif | D1 |
| 3 | **RAG PyQGIS zero-halluc** | 2 sem | pgvector + doc PyQGIS + scripts vérifiés | D3.1 |
| 4 | **Library 30+ tools + connecteurs FR** | 2 sem | Cadastre, PLU, LiDAR, Hub'Eau, GBIF, DVF... | D3.3 |
| 5 | **Export PDF/Word pro** | 1 sem | Templates, mise en page auto, Atlas QGIS | D3.2 |
| 6 | **MCP Server QGIS** | 1 sem | Serveur MCP + publication mcp.so | D3.4 |
| 7 | **LangGraph orchestration** | 1.5 sem | Graphe stateful, rollback, supervision | D1 avancé |
| 8 | **Module SylvaWatch** (1er module pro) | 2 sem | LiDAR HD, scolytes, rapports forestiers | Pro tier |
| 9 | **Hardening + QGIS Registry publish** | 1 sem | Tests, doc, i18n, submission Registry | D4 |
| 10 | **Beta privée + itérations** | 2 sem | 10 pros SIG pilotes, feedback loop | Lancement |

**Total** : ~14 semaines = **3,5 mois pour MVP publié** sur le QGIS Plugin Registry.

### Jalons business
- **Semaine 6** : premier export PDF magnifique démontrable (demo video)
- **Semaine 9** : MCP server publié → buzz dev community
- **Semaine 12** : publication QGIS Plugin Registry → acquisition organique
- **Semaine 14** : premiers clients Pro (19€/mois)

---

## 6. Anti-décisions (ce qu'on ne fait PAS)

| ❌ On ne fait pas | Pourquoi |
|---|---|
| Revendre de l'IA cloud | BYOK protège juridiquement et financièrement |
| Une app mobile | Cible pros SIG = desktop |
| Standalone avant plugin | Pros SIG vivent dans QGIS |
| Multi-user / collab temps réel | Complexité >> valeur à ce stade |
| Modèle unique (ex: OpenAI only) | LiteLLM = neutralité = résilience |
| UI from scratch | L'UI existante est déjà belle, on la conserve |
| Copier Pixstart feature-by-feature | Viser différenciation structurelle (MCP, agent, BYOK) |

---

## 7. Critères go/no-go MVP

Le MVP est prêt pour publication quand :

- [ ] Agent Plan+Confirm fonctionne sur 10 workflows types sans erreur
- [ ] Mode Auto fonctionne sans crash QGIS sur 5 workflows
- [ ] RAG PyQGIS : 95%+ des scripts générés s'exécutent du 1er coup
- [ ] Export PDF produit une mise en page pro (jugée par 3 pros SIG)
- [ ] 15+ connecteurs FR intégrés et documentés
- [ ] MCP server fonctionne avec Claude Desktop (démo video)
- [ ] Installation ZIP → premier chat IA en <5 min chrono
- [ ] 0 clé API hardcodée, toute config BYOK via UI
- [ ] Documentation utilisateur complète (README + site)
- [ ] Tests : 70% coverage sur core agent + gateway

---

## 8. Décisions encore à prendre (future)

À définir avant le Sprint 8 (module SylvaWatch commercial) :
- [ ] Prix exact des tiers Pro / Team
- [ ] Stripe / Paddle / Lemon Squeezy pour paiement
- [ ] Licence technique des modules Pro (clé activation ? telemetry ?)
- [ ] Dépôt de marque "GeoSylva"
- [ ] Hébergement site web marketing (prévoir geosylva.ai ou .fr)

---

**Cette charte gouverne tous les choix techniques et produits à partir de maintenant.**
**En cas de conflit entre une idée nouvelle et cette charte, la charte gagne — sauf décision explicite de la remettre à jour.**
