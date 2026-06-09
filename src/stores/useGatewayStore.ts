/**
 * Store Zustand pour la configuration du Gateway LLM (BYOK).
 *
 * Toutes les cles API sont chiffrees avant persistance via encryption.ts.
 * Jamais envoyees au serveur sans action utilisateur explicite (via litellm-client).
 */
import { create } from "zustand";
import { decryptApiKeyAsync, encryptApiKeyAsync } from "../lib/encryption";
import type { ApiKeys } from "../lib/litellm-client";

const STORAGE_KEY = "qgisia-gateway-v1";

export type GatewayStatus = "unknown" | "installing" | "ready" | "error";

export interface GatewayConfig {
  apiKeys: ApiKeys;
  defaultAlias: string; // ex: "smart-default"
  useGateway: boolean;  // feature flag de migration
  autoMode: boolean;    // toggle Auto (Plan+Confirm sinon)
  federationMode: boolean; // SIG Intelligent : routage multi-agents (/api/llm/smart)
  agentMode: boolean;   // Mode Action : boucle de tool-calling QGIS (/api/llm/agent)
  status: GatewayStatus;
  lastError?: string;
}

const DEFAULT_CONFIG: GatewayConfig = {
  apiKeys: {
    ollama_base_url: "http://localhost:11434",
  },
  defaultAlias: "smart-default",
  useGateway: false, // OFF par defaut — on bascule progressivement
  autoMode: false,   // Plan+Confirm par defaut (charte D1)
  federationMode: false, // OFF par defaut — mode mono-cerveau sinon
  agentMode: false,      // OFF par defaut — chat simple sinon
  status: "unknown",
};

const ENCRYPTED_KEY_FIELDS: (keyof ApiKeys)[] = [
  "openrouter", "gemini", "huggingface", "anthropic",
  "openai", "nvidia_nim", "groq", "cerebras", "mistral",
];

async function encryptKeys(keys: ApiKeys): Promise<ApiKeys> {
  const out: ApiKeys = { ollama_base_url: keys.ollama_base_url };
  for (const field of ENCRYPTED_KEY_FIELDS) {
    const v = keys[field];
    if (v) (out as Record<string, string>)[field] = await encryptApiKeyAsync(v);
  }
  return out;
}

async function decryptKeys(keys: ApiKeys): Promise<ApiKeys> {
  const out: ApiKeys = { ollama_base_url: keys.ollama_base_url };
  for (const field of ENCRYPTED_KEY_FIELDS) {
    const v = keys[field];
    if (v) (out as Record<string, string>)[field] = await decryptApiKeyAsync(v);
  }
  return out;
}

/** Lit la config brute (clés encore chiffrées) de façon synchrone pour l'init. */
function loadRawConfig(): GatewayConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as GatewayConfig;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      // apiKeys restent chiffrées ici ; déchiffrées par l'hydratation async.
      apiKeys: { ollama_base_url: parsed.apiKeys?.ollama_base_url ?? DEFAULT_CONFIG.apiKeys.ollama_base_url },
      status: "unknown",
      lastError: undefined,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/** Persiste la config en chiffrant les clés (AES-GCM). Fire-and-forget. */
function persistConfig(config: GatewayConfig): void {
  void (async () => {
    try {
      const serialized: GatewayConfig = {
        ...config,
        apiKeys: await encryptKeys(config.apiKeys),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch {
      // silent fail
    }
  })();
}

interface GatewayStore {
  config: GatewayConfig;
  setApiKey: (provider: keyof ApiKeys, value: string) => void;
  clearApiKey: (provider: keyof ApiKeys) => void;
  setDefaultAlias: (alias: string) => void;
  setUseGateway: (on: boolean) => void;
  setAutoMode: (on: boolean) => void;
  setFederationMode: (on: boolean) => void;
  setAgentMode: (on: boolean) => void;
  setStatus: (status: GatewayStatus, error?: string) => void;
  hasAnyKey: () => boolean;
  getApiKeys: () => ApiKeys;
  reset: () => void;
}

export const useGatewayStore = create<GatewayStore>((set, get) => ({
  config: loadRawConfig(),

  setApiKey: (provider, value) =>
    set((state) => {
      const apiKeys = { ...state.config.apiKeys, [provider]: value };
      const config = { ...state.config, apiKeys };
      persistConfig(config);
      return { config };
    }),

  clearApiKey: (provider) =>
    set((state) => {
      const apiKeys = { ...state.config.apiKeys };
      delete apiKeys[provider];
      const config = { ...state.config, apiKeys };
      persistConfig(config);
      return { config };
    }),

  setDefaultAlias: (alias) =>
    set((state) => {
      const config = { ...state.config, defaultAlias: alias };
      persistConfig(config);
      return { config };
    }),

  setUseGateway: (on) =>
    set((state) => {
      const config = { ...state.config, useGateway: on };
      persistConfig(config);
      return { config };
    }),

  setAutoMode: (on) =>
    set((state) => {
      const config = { ...state.config, autoMode: on };
      persistConfig(config);
      return { config };
    }),

  setFederationMode: (on) =>
    set((state) => {
      const config = { ...state.config, federationMode: on };
      persistConfig(config);
      return { config };
    }),

  setAgentMode: (on) =>
    set((state) => {
      const config = { ...state.config, agentMode: on };
      persistConfig(config);
      return { config };
    }),

  setStatus: (status, error) =>
    set((state) => ({
      config: { ...state.config, status, lastError: error },
    })),

  hasAnyKey: () => {
    const keys = get().config.apiKeys;
    return ENCRYPTED_KEY_FIELDS.some((f) => Boolean(keys[f]));
  },

  getApiKeys: () => get().config.apiKeys,

  reset: () => {
    persistConfig(DEFAULT_CONFIG);
    set({ config: DEFAULT_CONFIG });
  },
}));

/**
 * Hydratation asynchrone : déchiffre les clés API (AES-GCM, ou XOR legacy en
 * migration) puis les injecte dans le store. Au prochain `persistConfig`, les
 * clés legacy seront automatiquement réécrites au format v2.
 */
void (async () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as GatewayConfig;
    const apiKeys = await decryptKeys(parsed.apiKeys ?? {});
    useGatewayStore.setState((state) => ({
      config: { ...state.config, apiKeys },
    }));
  } catch {
    // silent fail : on garde la config par défaut
  }
})();
