# 🔭 Tech Landscape 2026 — GeoSylva AI

> Scan exhaustif des technos IA + géospatial pertinentes, avec verdict **ADOPT / TRIAL / WATCH / SKIP** selon notre charte produit.
>
> **Règles d'évaluation** :
> - ✅ **ADOPT** : on intègre dans la roadmap, maturité prouvée
> - 🟡 **TRIAL** : on prototype dans un sprint donné pour valider
> - 👀 **WATCH** : on suit, intégration possible post-MVP
> - ❌ **SKIP** : incompatible charte (plugin QGIS only / BYOK / léger) ou pas assez mature

---

## 1. Gateways & routeurs LLM

| Techno | Description | Verdict | Justif |
|---|---|---|---|
| **LiteLLM** | 100+ providers, open source, SDK + proxy | ✅ **ADOPT** | Déjà intégré Sprint 1. Embarqué vendor. |
| **Portkey** | Gateway SaaS + guardrails + observabilité | 👀 **WATCH** | Payant, utile pour tier Enterprise plus tard |
| **Bifrost** | Gateway Go ultra-rapide + semantic cache | 👀 **WATCH** | Go = binaire séparé. Pas plugin-friendly. Peut-être pour le cache sémantique server-side futur. |
| **OpenRouter** | Agrégateur 500+ modèles via API unifiée | ✅ **ADOPT** | Déjà dans LiteLLM. Key BYOK. |
| **Martian Router** | Routeur IA à base de bandit learning | 👀 **WATCH** | Concept sympa mais LiteLLM fallback suffit. |
| **Requesty.ai** | Proxy + cost tracking | ❌ **SKIP** | Redondant avec LiteLLM. |

---

## 2. Frameworks d'agents & orchestration

| Techno | Description | Verdict | Sprint |
|---|---|---|---|
| **LangGraph** (LangChain) | Graphe stateful, checkpoints, human-in-the-loop | ✅ **ADOPT** | Sprint 7 |
| **CrewAI** | Équipes d'agents avec rôles | 👀 **WATCH** | Peut compléter LangGraph pour multi-agents spécialisés |
| **AutoGen** (Microsoft) | Multi-agent conversationnel | 👀 **WATCH** | Moins mature que LangGraph en 2026 |
| **OpenAI Agents SDK** | Nouveau, Swarm-like | 🟡 **TRIAL** | À tester Sprint 7 — plus simple que LangGraph |
| **NVIDIA AI-Q Toolkit** | Patterns enterprise agents | 👀 **WATCH** | Inspiration architecture, pas d'intégration directe |
| **Pydantic AI** | Type-safe agents, validation Zod-like | 🟡 **TRIAL** | Excellent pour tool calling robuste — à tester Sprint 2 |
| **DSPy** | Prompts comme programmes compilables | 👀 **WATCH** | Très prometteur pour optimiser prompts automatiquement |
| **LlamaIndex** | RAG-first agents | ❌ **SKIP** | Redondant avec LangGraph + ChromaDB |
| **Haystack** (Deepset) | Pipeline RAG | ❌ **SKIP** | Moins populaire en 2026 |
| **Semantic Kernel** (Microsoft) | Orchestration .NET-first | ❌ **SKIP** | Pas d'écosystème Python fort |

**Reco stack agents** : **LangGraph + Pydantic AI** (types stricts tool calling) + évaluation AI-Q patterns.

---

## 3. Tool calling & function execution

| Techno | Description | Verdict |
|---|---|---|
| **MCP (Model Context Protocol)** | Standard Anthropic pour exposer des tools | ✅ **ADOPT** — Sprint 6 |
| **OpenAI Function Calling** | Format de fait de tool calling | ✅ **ADOPT** — déjà utilisé |
| **ACP (Agent Communication Protocol)** | IBM/LinuxFoundation standard inter-agents | 👀 **WATCH** — émergent |
| **A2A (Google Agent-to-Agent)** | Standard Google coopération agents | 👀 **WATCH** — émergent |
| **Composio** | Marketplace de 200+ tools prêts | 🟡 **TRIAL** — post Sprint 6 pour accélérer connecteurs |
| **Arcade.dev** | Auth OAuth pour tools agents | 👀 **WATCH** — utile si on fait SaaS multi-user plus tard |
| **Toolhouse** | Serverless tools hosting | ❌ **SKIP** — BYOK incompatible |

**Reco** : MCP = standard ouvert (Sprint 6). OpenAI Function Calling reste le format tool calling interne.

---

## 4. Modèles génératifs pertinents 2026

### Raisonnement & code
| Modèle | Force | Accès | Usage GeoSylva |
|---|---|---|---|
| **Claude 4 Opus / Sonnet** | Code + raisonnement SOTA | OpenRouter, Anthropic | ✅ Agent principal |
| **GPT-5 / o3** | Raisonnement profond | OpenAI, OR | ✅ Tâches complexes |
| **Gemini 2.5 Pro** | Long contexte 2M, multimodal | Google | ✅ Vision + long context |
| **DeepSeek V3.5 / R1** | Open weights, coût 10x moins | OR, DeepSeek | ✅ Alt économique |
| **Qwen 3 (72B)** | Open, très fort code | OR, Alibaba | ✅ Code alt |
| **Llama 4 Scout/Maverick** | Open Meta, 10M context | NIM, Groq | ✅ Local + enterprise |
| **Mistral Large 3 / Pixtral** | Français natif, vision | Mistral, Azure | ✅ FR + vision |
| **NVIDIA Nemotron** | Optimisé NIM, fine-tunable | build.nvidia.com | ✅ Enterprise tier |

### Vision spécialisée
| Modèle | Usage | Verdict |
|---|---|---|
| **Kimi K2.5** (Moonshot) | Vision 1M tokens | 🟡 **TRIAL** — intéressant cartes |
| **Qwen2.5-VL** | Vision + OCR | ✅ **ADOPT** pour analyse captures carte |
| **GPT-4o Vision** | Vision généraliste | ✅ **ADOPT** via OR |
| **Gemini 2.5 Flash Vision** | Vision rapide gratuit | ✅ **ADOPT** — défaut vision |
| **Molmo** (Allen AI) | Pointage précis dans images | 🟡 **TRIAL** — détection objets sur carte |

### Modèles Earth/géo-foundation
| Modèle | Source | Verdict |
|---|---|---|
| **Clay Foundation Model** | Open, sat multi-sources | 🟡 **TRIAL** Sprint 4 |
| **Prithvi-EO 2.0** (IBM/NASA) | Open, Earth observation | 🟡 **TRIAL** Sprint 4 |
| **SatMAE / Scale-MAE** | Embeddings satellite | 👀 **WATCH** |
| **GeoFM (IBM)** | Enterprise geospatial | 👀 **WATCH** |
| **SpectralGPT** | Hyperspectral | 👀 **WATCH** — niche |

---

## 5. Vision segmentation / détection géo

| Techno | Description | Verdict |
|---|---|---|
| **SAM 2** (Meta) | Segment anything, video | ✅ **ADOPT** Sprint 3 |
| **GroundingDINO + SAM** | Détection open-vocab + segmentation | ✅ **ADOPT** Sprint 3 |
| **YOLO v11 / v12** | Détection temps réel | 🟡 **TRIAL** — détection objets terrain |
| **SAMGeo / GeoSAM** | SAM fine-tuned sat | ✅ **ADOPT** Sprint 3 |
| **opengeoai (GeoAI package)** | Wrapper Python torchgeo + HF | ✅ **ADOPT** Sprint 3 — plugin QGIS existe déjà |
| **TorchGeo** | Datasets + modèles PyTorch | ✅ **ADOPT** — base GeoAI |
| **TorchChange** | Détection changements multi-temp | ✅ **ADOPT** Sprint 8 (SylvaWatch) |
| **DeepForest** | Détection arbres canopée | 🟡 **TRIAL** Sprint 8 |
| **Detectree2** | Segmentation couronnes arbres | 🟡 **TRIAL** Sprint 8 |

**Reco cœur géo-IA** : `opengeoai` + `SAM 2` + `GroundingDINO` + `TorchChange` = boîte à outils complète.

---

## 6. RAG & vector stores

| Techno | Description | Verdict |
|---|---|---|
| **ChromaDB** | Embarqué Python, local | ✅ **ADOPT** Sprint 3 — plugin-friendly |
| **pgvector** | PostgreSQL extension (déjà installé PG16/17) | ✅ **ADOPT** Sprint 3 — option avancée |
| **LanceDB** | Columnar, fichier unique | 🟡 **TRIAL** — alternative Chroma |
| **Qdrant** | Gros scale, hybrid search | 👀 **WATCH** — Enterprise |
| **Weaviate** | SaaS + selfhost | ❌ **SKIP** — overkill |
| **Pinecone** | SaaS only | ❌ **SKIP** — BYOK + pas serveur |
| **NVIDIA NeMo Retriever** | RAG enterprise GPU | 👀 **WATCH** Enterprise tier |
| **ColBERT v2** | Retrieval par tokens | 👀 **WATCH** — qualité > BM25 |
| **BGE-M3** (embeddings) | Multilingue, SOTA open | ✅ **ADOPT** — modèle embedding local |
| **Voyage AI embeddings** | Qualité max | 👀 **WATCH** — payant |
| **Jina Embeddings v3** | Multilingue, long context | 🟡 **TRIAL** — alt BGE-M3 |

**Reco** : **ChromaDB** par défaut (zéro infra) + **BGE-M3** embeddings local via Ollama. Option pgvector pour users avancés.

---

## 7. Mémoire long-terme agents

| Techno | Description | Verdict |
|---|---|---|
| **mem0** | Mémoire auto-extraite + requêtable | ✅ **ADOPT** Sprint 6 |
| **Letta** (ex-MemGPT) | Agent avec hiérarchie mémoire | 👀 **WATCH** |
| **Zep** | Memory service open source | 👀 **WATCH** |
| **Cognee** | Knowledge graph memory | 🟡 **TRIAL** — agents complexes |

**Reco** : **mem0** simple et mature.

---

## 8. Voice & audio

| Techno | Description | Verdict |
|---|---|---|
| **Whisper Large v3** | STT local, 99 langues | ✅ **ADOPT** Sprint 10 — input vocal |
| **faster-whisper** | Whisper optimisé CTranslate2 | ✅ **ADOPT** — impl défaut |
| **Deepgram / AssemblyAI** | STT cloud qualité | ❌ **SKIP** — BYOK, cloud pas défaut |
| **Kokoro TTS** | TTS open source rapide | 🟡 **TRIAL** — synthèse vocale rapports |
| **XTTS v2** | TTS multilingue clonage | 👀 **WATCH** |
| **ElevenLabs** | TTS SaaS SOTA | 👀 **WATCH** — payant, pour démo |

**Reco** : input vocal via `faster-whisper` local (zéro coût). TTS rapports = Kokoro optionnel.

---

## 9. Observabilité & évaluation

| Techno | Description | Verdict |
|---|---|---|
| **LangSmith** | Tracing LangChain | 🟡 **TRIAL** Sprint 7 — tier gratuit 5k traces |
| **Langfuse** | Open source alternative LangSmith | ✅ **ADOPT** Sprint 7 — selfhost possible |
| **Phoenix / Arize** | OSS observability | 👀 **WATCH** |
| **Helicone** | Proxy observability | ❌ **SKIP** — incompatible BYOK |
| **OpenLLMetry** | OpenTelemetry pour LLM | 🟡 **TRIAL** — standard futur |
| **Promptfoo** | Tests A/B prompts | ✅ **ADOPT** Sprint 9 — CI tests agents |
| **DeepEval** | Framework test agents | 🟡 **TRIAL** Sprint 9 |
| **Ragas** | Évaluation RAG spécifique | ✅ **ADOPT** Sprint 3 — mesurer qualité RAG PyQGIS |

**Reco** : **Langfuse** (selfhost dans plugin) + **Ragas** (qualité RAG) + **Promptfoo** (tests CI).

---

## 10. Map rendering & visualisation

| Techno | Description | Verdict |
|---|---|---|
| **Leaflet** | Léger, stable | ✅ **ADOPT** — déjà utilisé |
| **MapLibre GL JS** | Vector tiles GPU, fork Mapbox | ✅ **ADOPT** — upgrade futur |
| **OpenLayers** | Puissant, géospatial pur | 👀 **WATCH** |
| **Deck.gl** | Visu 3D massive, WebGL2 | 🟡 **TRIAL** Sprint 8 — LiDAR point clouds |
| **Cesium JS** | Globe 3D, terrain | 🟡 **TRIAL** Sprint 8 — 3D forêts |
| **Three.js + r3f** | 3D générique | 👀 **WATCH** |
| **Kepler.gl** | Visu data Uber | 👀 **WATCH** |
| **Observable Plot** | Charts d3 simplifié | ✅ **ADOPT** — dashboards |
| **ECharts / Plotly** | Charts riches | ✅ **ADOPT** — rapports |

**Reco** : **Leaflet + MapLibre GL** pour cartes 2D, **Deck.gl + Cesium** pour 3D Sprint 8.

---

## 11. Export documents & reporting

| Techno | Description | Verdict |
|---|---|---|
| **QGIS Layout (native)** | Mise en page carto native QGIS | ✅ **ADOPT** Sprint 5 — priorité |
| **reportlab** | PDF Python pur | ✅ **ADOPT** — rapports programmatiques |
| **python-docx** | Word natif | ✅ **ADOPT** — rapports Word |
| **WeasyPrint** | HTML/CSS → PDF | ✅ **ADOPT** — templates HTML |
| **Playwright + Chromium** | Screenshots + PDF headless | ✅ **ADOPT** — cartes haute-res |
| **Typst** | LaTeX moderne | 🟡 **TRIAL** — rapports scientifiques |
| **Quarto** | Notebooks → docs pros | 🟡 **TRIAL** |
| **Pandoc** | Conversion universelle | ✅ **ADOPT** — export multi-format |

**Reco Sprint 5** : QGIS Layout (cartes) + WeasyPrint (HTML→PDF rapports) + python-docx (Word) + Pandoc (conversions).

---

## 12. APIs & connecteurs géospatiaux FR

Liste complète dans `GEOSYLVA_VISION_V2.md` section 4. Priorité Sprint 4 :

**Top 15 prioritaires** :
1. cadastre.data.gouv.fr + API Carto (Cadastre, PLU)
2. Géoplateforme IGN (WMS/WMTS/WFS)
3. LiDAR HD IGN (MNS/MNT national) ← killer
4. BD TOPO / BD ORTHO (IGN)
5. BD Forêt v2 (IGN)
6. Géoportail de l'Urbanisme
7. geo.api.gouv.fr (limites admin)
8. data.gouv.fr (CKAN 40k datasets)
9. Hub'Eau / Naïades (qualité eau)
10. Copernicus Data Space (Sentinel-1/2/3/5P)
11. Overpass (OSM)
12. GBIF / INPN / OpenObs (biodiversité)
13. DVF ETALAB (transactions immo)
14. Vigicrues (inondations temps réel)
15. Météo-France / Copernicus ERA5

---

## 13. Nouvelles intégrations IA-first intéressantes

| Techno | Description | Verdict |
|---|---|---|
| **Firecrawl** | Web scraping IA-ready | 🟡 **TRIAL** — ingérer doc technique auto |
| **Exa.ai / Perplexity API** | Search IA | 👀 **WATCH** — recherche web augmentée |
| **E2B Code Interpreter** | Sandbox exécution code IA | 👀 **WATCH** — exec PyQGIS isolée futur |
| **Modal** / **Baseten** | GPU serverless | 👀 **WATCH** — inférence modèles custom |
| **Replicate** | Modèles HF hosted | 👀 **WATCH** — fallback NIM |
| **Groq** | Inférence ultra-rapide LPU | ✅ **ADOPT** — ajouter alias `groq/llama-4-scout` |
| **Cerebras** | Inférence rapide | 👀 **WATCH** |
| **Together AI** | Inférence open models | 👀 **WATCH** |
| **Fireworks AI** | Inférence + fine-tuning | 👀 **WATCH** |

**Action immédiate** : ajouter **Groq** à `models.json` (gratuit quota, ultra-rapide, idéal intent-router).

---

## 14. Dev tools & productivité interne

| Techno | Usage GeoSylva | Verdict |
|---|---|---|
| **Windsurf** (Cascade) | Dev IA (nous !) | ✅ Déjà utilisé |
| **Claude Code** | CLI agentique | ✅ Complément Windsurf |
| **Cursor / Continue** | Alternatives | 👀 |
| **Aider** | CLI open source | 👀 |
| **Playwright** | Tests E2E | ✅ **ADOPT** Sprint 9 |
| **Vitest** | Tests TS | ✅ — déjà là |
| **pytest** | Tests Python | ✅ **ADOPT** Sprint 9 |
| **ruff** + **mypy** | Lint/type Python | ✅ **ADOPT** — CI Sprint 9 |
| **GitHub Actions** | CI/CD | ✅ **ADOPT** Sprint 9 |
| **semantic-release** | Release auto | 🟡 **TRIAL** |

---

## 15. Sécurité & gouvernance

| Techno | Description | Verdict |
|---|---|---|
| **NeMo Guardrails** | Garde-fous LLM NVIDIA | 🟡 **TRIAL** — prévention prompt injection |
| **Invariant Labs** | Security agents | 👀 **WATCH** |
| **Garak** | Red-team LLM | 🟡 **TRIAL** Sprint 9 |
| **Presidio** (Microsoft) | PII redaction | ✅ **ADOPT** — redact données perso avant envoi cloud |

**Reco critique** : **Presidio** pour anonymiser cadastre (noms propriétaires) avant envoi LLM cloud. Critical pour RGPD.

---

## 16. Standards émergents à surveiller

| Standard | Porteur | Pertinence |
|---|---|---|
| **MCP** (Model Context Protocol) | Anthropic + OSS | ✅ **ADOPT** Sprint 6 — on devient un serveur MCP |
| **ACP** (Agent Communication Protocol) | IBM, Linux Foundation | 👀 — pour intégration future |
| **A2A** (Agent-to-Agent) | Google | 👀 — concurrent ACP |
| **OpenTelemetry GenAI** | CNCF | 🟡 — observabilité standard |
| **OGC API Features/Tiles/EDR** | OGC | ✅ **ADOPT** — standards géo déjà supportés QGIS |
| **STAC** (SpatioTemporal Asset Catalog) | OGC | ✅ **ADOPT** Sprint 4 — catalogue imagerie |
| **COG** (Cloud Optimized GeoTIFF) | OSS | ✅ **ADOPT** — rasters streamables |

**Reco** : GeoSylva **implémente MCP + STAC** comme marques de fabrique "ouvert et standard".

---

## 17. Synthèse — les 12 adoptions critiques MVP

Les éléments non-négociables à intégrer durant les 10 sprints :

1. ✅ **LiteLLM** (fait)
2. ✅ **NVIDIA NIM** alias (fait)
3. 🔜 **Groq** alias (à ajouter, 1 ligne)
4. 🔜 **MCP Server QGIS** — Sprint 6
5. 🔜 **LangGraph + Pydantic AI** — Sprint 7
6. 🔜 **ChromaDB + BGE-M3** embeddings — Sprint 3
7. 🔜 **opengeoai + SAM2 + GroundingDINO** — Sprint 3 avancé
8. 🔜 **mem0** — Sprint 6
9. 🔜 **Langfuse** (selfhost) + **Ragas** — Sprint 7
10. 🔜 **QGIS Layout + WeasyPrint + python-docx** — Sprint 5
11. 🔜 **Presidio** anonymisation PII — Sprint 5
12. 🔜 **STAC + COG** support — Sprint 4

---

## 18. Ajouts immédiats réalisables en 5 min

Je peux ajouter tout de suite dans `models.json` :

- **Groq** (ultra-rapide, gratuit quota) → alias `fast-cloud`
- **Cerebras** → alias `ultra-fast`
- **Together AI** / **Fireworks** → fallbacks additionnels
- **Anthropic direct** (pas via OpenRouter) → alias premium

Et je peux créer `docs/TECH_STACK.md` résumé court pour ton pitch investisseur.
