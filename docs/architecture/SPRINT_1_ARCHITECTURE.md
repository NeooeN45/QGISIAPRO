# Sprint 1 — LiteLLM Gateway (architecture figée)

**Objectif** : unifier les 4 clients LLM (`openrouter.ts`, `gemini.ts`, `huggingface-provider.ts`, `ollama-auto-detect.ts`) en **un seul gateway embarqué dans le plugin**, sans dépendance Docker.

**Stratégie d'install validée** : vendor isolé (`qgis_plugin/vendor/`).

---

## Schéma

```
┌─────────────────────────────────────────────────────────────┐
│  QGIS (Python)                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ geoai_assistant.py — HTTP server (port local)        │   │
│  │                                                       │   │
│  │  GET  /api/qgis/*       (existant, inchangé)         │   │
│  │  POST /api/llm/chat     ← NOUVEAU (JSON/SSE stream)  │   │
│  │  GET  /api/llm/models   ← NOUVEAU                    │   │
│  │  GET  /api/llm/budget   ← NOUVEAU                    │   │
│  │  GET  /api/llm/health   ← NOUVEAU                    │   │
│  └─────────────┬────────────────────────────────────────┘   │
│                │                                             │
│                ▼                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ llm_gateway.py (wrapper litellm)                     │   │
│  │  - chat(messages, model_alias, stream, api_keys)     │   │
│  │  - list_models() / get_budget() / health()           │   │
│  │  - fallback chains / retry / cost tracking           │   │
│  └─────────────┬────────────────────────────────────────┘   │
│                │                                             │
│                ▼                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ qgis_plugin/vendor/litellm  (auto pip-installed)     │   │
│  │   → route vers: Ollama / OpenRouter / Gemini /       │   │
│  │                 NIM / Claude / HuggingFace / Azure…  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ llm_installer.py — 1er lancement                     │   │
│  │  if not Path(vendor/litellm).exists():               │   │
│  │      pip install --target vendor/ litellm pyyaml ... │   │
│  │  sys.path.insert(0, vendor/)                         │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
            ▲
            │ HTTP localhost
            │
┌───────────┴───────────────────────────────────────┐
│ React (src/)                                       │
│  src/lib/litellm-client.ts  ← UNIQUE client LLM   │
│    ├── chat({ model, messages, stream, signal })  │
│    ├── listModels()                                │
│    └── getBudget()                                 │
│                                                    │
│  llm.ts + multi-model-orchestrator.ts             │
│    → appellent uniquement litellm-client           │
└────────────────────────────────────────────────────┘
```

---

## Contrats d'API

### `POST /api/llm/chat`

**Request** :
```json
{
  "model": "smart-default",          // alias défini dans models.json
  "messages": [{"role":"user","content":"..."}],
  "stream": true,
  "temperature": 0.3,
  "max_tokens": 4096,
  "tools": [ /* OpenAI-style */ ],
  "api_keys": {                      // passées par call (chiffrées côté front)
    "openrouter": "sk-or-...",
    "gemini": "AIza...",
    "huggingface": "hf_..."
  },
  "metadata": { "conversation_id": "...", "user_id": "..." }
}
```

**Response (stream=false)** : format OpenAI ChatCompletion standard.

**Response (stream=true)** : SSE `text/event-stream` avec events OpenAI delta.

### `GET /api/llm/models`

Retourne la liste des alias configurés + modèles Ollama détectés localement.

### `GET /api/llm/budget`

Retourne cost tracking (total, par provider, par conversation).

---

## Routing déclaratif — `qgis_plugin/config/models.json`

```json
{
  "aliases": {
    "smart-default": {
      "primary": "openrouter/anthropic/claude-3.5-sonnet",
      "fallbacks": ["openrouter/openai/gpt-4o-mini", "ollama/qwen3:4b"],
      "max_cost_usd": 0.10
    },
    "fast-local": {
      "primary": "ollama/qwen3:4b",
      "fallbacks": []
    },
    "vision": {
      "primary": "gemini/gemini-2.5-flash",
      "fallbacks": ["openrouter/anthropic/claude-3.5-sonnet"]
    },
    "code": {
      "primary": "openrouter/qwen/qwen-2.5-coder-32b",
      "fallbacks": ["ollama/qwen2.5-coder:7b"]
    }
  },
  "budgets": {
    "daily_max_usd": 5.00,
    "per_request_max_usd": 0.50
  }
}
```

---

## Contrat de sécurité

- **Clés API** : jamais persistées côté Python. Envoyées à chaque requête depuis le front (déjà chiffrées par `src/lib/encryption.ts`).
- **Loopback only** : le serveur HTTP ne bind que `127.0.0.1`.
- **Auth token** : header `X-GeoSylva-Token` généré au démarrage, partagé front↔back via `window.GEOSYLVA_TOKEN`.

---

## Plan de migration (non-breaking)

1. **Phase A** — gateway déployé, clients legacy intacts (rollback 1-click)
2. **Phase B** — `litellm-client.ts` créé. `multi-model-orchestrator.ts` bascule dessus derrière un feature flag `settings.useLiteLLMGateway`
3. **Phase C** — `llm.ts` bascule. Anciens clients gardés en fallback si gateway KO
4. **Phase D** — feature flag supprimé, anciens clients marqués `@deprecated` (retrait en v2.3)

---

## Chemin vers le produit commercial

Ce module est **portable sans modification** vers :

- **Standalone Electron/Tauri** : `llm_gateway.py` wrappé par FastAPI, React réutilisé tel quel
- **SaaS multi-tenant** : ajouter middleware tenant-id, réutiliser le routing
- **Version pro payante** : budgets + observabilité Portkey + modèles premium activés via licence

---

## Critères d'acceptation Sprint 1

- [ ] Plugin fraîchement installé → 1er lancement installe litellm dans vendor/ (<60s)
- [ ] Chat fonctionne avec Ollama local sans aucune clé API
- [ ] Chat fonctionne avec OpenRouter en fournissant juste la clé via UI
- [ ] Fallback automatique : si OpenRouter down → Ollama
- [ ] Streaming SSE fonctionnel, abort signal respecté
- [ ] Aucun `fetch` direct vers openrouter.ai / generativelanguage.googleapis.com depuis React
- [ ] `npm run build` + install ZIP QGIS → cycle complet en <3 min
