# Backend agentique QGISIA+ — Référence

Documentation du cerveau IA agentique branché sur NVIDIA NIM (juin 2026).
Tout est vérifié : 154 tests Python, 66 tests front, e2e live contre NVIDIA (7/7),
et bridge PyQGIS testé en QGIS 3.44.8 réel (10/10 opérations).

---

## 1. Vue d'ensemble

```
UI React (Chat)
  └─► litellm-client.ts ──HTTP──► /api/llm/chat    (chat simple)
                                  /api/llm/smart    (fédération multi-agents)
                                  /api/llm/agent     (boucle tool-calling)
                                       │
                              llm_gateway.py (LiteLLM)  ── NVIDIA NIM (cœur) + fallbacks
                                       │
                    ┌──────────────────┼─────────────────────┐
              fédération          tool-calling            native tools
           (agent_federation)   (agent_tools)          (native_tools)
                                       │                     │
                              bridge QGIS HTTP        web/geo APIs (sans clé)
                              (/api/qgis/*)           Nominatim, Open-Meteo,
                              PyQGIS réel             STAC Earth Search, Wikipedia
```

## 2. Les 3 modes (UI : Paramètres > Gateway IA)

| Toggle | Effet | Endpoint |
|--------|-------|----------|
| **Utiliser le Gateway** | Tout le chat passe par le gateway (NVIDIA cœur) | `/api/llm/chat` |
| **SIG Intelligent** | Routage multi-agents (code/vision/raisonnement) | `/api/llm/smart` |
| **Mode Action** | L'agent appelle des outils QGIS jusqu'à accomplir la tâche | `/api/llm/agent` |

`Mode Auto` autorise les actions non-critiques (CONFIRM) ; les actions critiques
(DROP TABLE, rm…) restent toujours bloquées par les guardrails.

## 3. Catalogue de modèles (`QGISIA2/config/models.json`)

Curé sur validation live (21/22 OK le 2026-06-05). Qualité-first, NVIDIA-first.
Alias clés :

| Alias | Modèle primaire | Usage |
|-------|-----------------|-------|
| `smart-default` | `nemotron-3-super-120b-a12b` | Cerveau général (510 ms) |
| `reasoning` | `nemotron-3-ultra-550b-a55b` | Raisonnement lourd (qualité max) |
| `code-pyqgis` | `qwen3-coder-480b-a35b` | Code PyQGIS |
| `vision` / `vision-premium` | `nemotron-3-nano-omni` / `qwen3.5-397b` | Vision carto |
| `intent-router` | `nemotron-mini-4b` | Routage rapide (181 ms) |

Re-valider à tout moment : `python scripts/validate_nvidia_models.py`
(lit la clé depuis `.env.local`, écrit `config/models.validated.json`).

> **Tool calling** : LiteLLM rejette `tools` sur le provider `nvidia_nim`. Le gateway
> route donc automatiquement les modèles NVIDIA via le provider `openai/`
> (OpenAI-compatible) dès que des `tools` sont fournis. (cf. `llm_gateway.py`)

## 4. Outils disponibles pour l'agent

### Outils QGIS (bridge, `mcp_server.py` → `/api/qgis/*`)
`getLayersList`, `setLayerVisibility`, `setLayerOpacity`, `zoomToLayer`,
`filterLayer`, `reprojectLayer`, `applyQmlStyle`, `applySymbologyPreset`,
`addDataSource`, `addRemoteRaster` (COG `/vsicurl/`), `segmentRasterWithSAM`,
`forecastWeatherWithEarth2`, `exportProjectReport`, `runScript` (gardé), …

### Outils natifs web/geo/data (`native_tools.py`, en-process, sans clé)
| Outil | Source |
|-------|--------|
| `geocode` | OpenStreetMap / Nominatim |
| `weather` / `elevation` | Open-Meteo (Copernicus DEM) |
| `search_satellite_imagery` | STAC Earth Search (Sentinel-2/1, Landsat) |
| `wikipedia` | Wikipedia FR |
| `generate_layer_style` | Légende → QML (reproduction de carte) |
| `list_symbology_presets` | Symbologies institutionnelles FR (ONF/IGN/PLU/Cadastre/CLC/PPRi) |
| `list_data_sources` | **Catalogue mondial** (`data_catalog.py` / `config/data_sources.json`) |

### Catalogue mondial de données (`data_catalog.py`, P3-S1)
≈16 sources gratuites (XYZ/WMTS/WMS) : fonds OSM/CARTO/ESRI, satellite (ESRI imagery,
Sentinel-2 cloudless EOX), relief, occupation du sol (ESA WorldCover), France
(IGN Plan/Ortho/SCAN25, Cadastre). L'agent les découvre via `list_data_sources` et les
charge via `addDataSource` (slot bridge → `_create_service_layer`). Vérifié en QGIS réel.

Le même catalogue alimente **le tool-calling LLM** ET **le serveur MCP** (Claude
Desktop, Cursor…) — source unique de vérité.

## 5. Sécurité (`agent_guardrails.py`)

`run_tool_loop` filtre chaque appel d'outil exécutant du code arbitraire
(`runScript*`) via `safety_check()` :
- **BLOCK** (DROP TABLE, rm -rf…) → toujours refusé, bridge jamais appelé.
- **CONFIRM** (deleteFeatures…) → refusé hors Mode Auto.
- **SAFE/WARN** → exécuté.

## 6. Reproduction de carte (`map_repro.py`)

Pipeline : image de carte → VLM renvoie une légende JSON → `parse_legend()` →
`legend_to_qml()` (renderer catégorisé) → `applyQmlStyle` (bridge) → style appliqué.
Vérifié en QGIS réel (renderer = `categorizedSymbol`).

## 7. Configuration de la clé NVIDIA

- **App (plugin)** : Paramètres > Gateway IA > champ « NVIDIA NIM ».
- **Scripts/dev** : `.env.local` à la racine (gitignoré) :
  ```
  NVIDIA_API_KEY=nvapi-...
  ```

## 8. Tests

| Commande | Couvre |
|----------|--------|
| `python -m pytest tests/` | 154 tests unitaires (gateway, fédération, tools, native, vision) |
| `npm run test` | 66 tests front |
| `python tests/manual/test_live_e2e.py` | e2e live contre NVIDIA (chat, routage, tool-calling, geo) |
| `tests/_run_qgis.bat tests/qgis_real_smoke.py` | bridge PyQGIS réel dans QGIS (10/10) |
| `tests/_run_qgis.bat tests/qgis_grandeur_nature_smoke.py` | **grandeur nature 4/4** : requêtes utilisateur NL → agent → QGIS réel |

## 9. Fichiers clés

```
QGISIA2/
  llm_gateway.py       gateway LiteLLM (NVIDIA-first, fallback, tool routing)
  agent_federation.py  fédération multi-agents (agents -> alias models.json)
  agent_tools.py       pont tool-calling + boucle agentique + safety
  native_tools.py      outils web/geo (geocode, météo, STAC, wikipedia)
  map_repro.py         reproduction de carte (légende -> QML)
  mcp_server.py        catalogue d'outils (bridge + MCP stdio)
  geoai_assistant.py   serveur HTTP + bridge QGIS (slots PyQGIS)
  config/models.json   catalogue de modèles curé
scripts/
  validate_nvidia_models.py   validation live du catalogue
```
