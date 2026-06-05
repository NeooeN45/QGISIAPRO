/**
 * Store Zustand pour la configuration du Gateway LLM (BYOK).
 *
 * Toutes les cles API sont chiffrees avant persistance via encryption.ts.
 * Jamais envoyees au serveur sans action utilisateur explicite (via litellm-client).
 */
import { create } from "zustand";
import { decryptApiKey, encryptApiKey } from "../lib/encryption";
import type { ApiKeys } from "../lib/litellm-client";

const STORAGE_KEY = "qgisia-gateway-v1";

export type GatewayStatus = "unknown" | "installing" | "ready" | "error";

export interface GatewayConfig {
  apiKeys: ApiKeys;
  defaultAlias: string; // ex: "smart-default"
  useGateway: boolean;  // feature flag de migration
  autoMode: boolean;    // toggle Auto (Plan+Confirm sinon)
  federationMode: boolean; // SIG Intelligent : routage multi-agents (/api/llm/smart)
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
  status: "unknown",
};

const ENCRYPTED_KEY_FIELDS: (keyof ApiKeys)[] = [
  "openrouter", "gemini", "huggingface", "anthropic",
  "openai", "nvidia_nim", "groq", "cerebras", "mistral",
];

function encryptKeys(keys: ApiKeys): ApiKeys {
  const out: ApiKeys = { ollama_base_url: keys.ollama_base_url };
  for (const field of ENCRYPTED_KEY_FIELDS) {
    const v = keys[field];
    if (v) (out as Record<string, string>)[field] = encryptApiKey(v);
  }
  return out;
}

function decryptKeys(keys: ApiKeys): ApiKeys {
  const out: ApiKeys = { ollama_base_url: keys.ollama_base_url };
  for (const field of ENCRYPTED_KEY_FIELDS) {
    const v = keys[field];
    if (v) (out as Record<string, string>)[field] = decryptApiKey(v);
  }
  return out;
}

function loadConfig(): GatewayConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as GatewayConfig;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      apiKeys: decryptKeys(parsed.apiKeys ?? {}),
      status: "unknown",
      lastError: undefined,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function persistConfig(config: GatewayConfig): void {
  try {
    const serialized: GatewayConfig = {
      ...config,
      apiKeys: encryptKeys(config.apiKeys),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // silent fail
  }
}

interface GatewayStore {
  config: GatewayConfig;
  setApiKey: (provider: keyof ApiKeys, value: string) => void;
  clearApiKey: (provider: keyof ApiKeys) => void;
  setDefaultAlias: (alias: string) => void;
  setUseGateway: (on: boolean) => void;
  setAutoMode: (on: boolean) => void;
  setFederationMode: (on: boolean) => void;
  setStatus: (status: GatewayStatus, error?: string) => void;
  hasAnyKey: () => boolean;
  getApiKeys: () => ApiKeys;
  reset: () => void;
}

export const useGatewayStore = create<GatewayStore>((set, get) => ({
  config: loadConfig(),

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
