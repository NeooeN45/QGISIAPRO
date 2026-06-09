import { create } from "zustand";

import {
  AppSettings,
  loadStoredSettings,
  normalizeSettings,
} from "../lib/settings";
import { decryptApiKeyAsync, encryptApiKeyAsync } from "../lib/encryption";

interface SettingsState {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const STORAGE_KEY = "geoai-settings";

/**
 * Chiffre les clés API avant persistance (AES-GCM).
 */
async function encryptSettingsForStorage(settings: AppSettings): Promise<AppSettings> {
  return {
    ...settings,
    apiKey: await encryptApiKeyAsync(settings.apiKey),
    googleApiKey: await encryptApiKeyAsync(settings.googleApiKey),
    openrouterApiKey: await encryptApiKeyAsync(settings.openrouterApiKey),
  };
}

/**
 * Déchiffre les clés API après chargement (gère v2 AES-GCM + v1 XOR legacy).
 */
async function decryptSettingsFromStorage(settings: AppSettings): Promise<AppSettings> {
  return {
    ...settings,
    apiKey: await decryptApiKeyAsync(settings.apiKey),
    googleApiKey: await decryptApiKeyAsync(settings.googleApiKey),
    openrouterApiKey: await decryptApiKeyAsync(settings.openrouterApiKey),
  };
}

/** Persiste les réglages en chiffrant les clés. Fire-and-forget. */
function persistSettings(settings: AppSettings): void {
  void (async () => {
    try {
      const encrypted = await encryptSettingsForStorage(settings);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted));
    } catch {
      // silent fail
    }
  })();
}

export const useSettingsStore = create<SettingsState>((set) => ({
  // Init synchrone : clés encore chiffrées, déchiffrées par l'hydratation async.
  settings: normalizeSettings(loadStoredSettings()),

  setSettings: (settings) => {
    const normalized = normalizeSettings(settings);
    persistSettings(normalized);
    set({ settings: normalized });
  },

  updateSettings: (partial) =>
    set((state) => {
      const merged = normalizeSettings({ ...state.settings, ...partial });
      persistSettings(merged);
      return { settings: merged };
    }),

  resetSettings: () => {
    void (async () => {
      const fresh = normalizeSettings(await decryptSettingsFromStorage(loadStoredSettings()));
      persistSettings(fresh);
      set({ settings: fresh });
    })();
  },
}));

/** Hydratation asynchrone : déchiffre les clés API au démarrage. */
void (async () => {
  try {
    const decrypted = await decryptSettingsFromStorage(loadStoredSettings());
    useSettingsStore.setState({ settings: normalizeSettings(decrypted) });
  } catch {
    // silent fail : on garde les réglages bruts
  }
})();
