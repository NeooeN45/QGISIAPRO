/**
 * HuggingFace Inference API Provider
 * Permet d'utiliser des modèles HF (comme Gemma 4) via l'API
 */

import { encryptApiKeyAsync, decryptApiKeyAsync } from "./encryption";

export interface HuggingFaceOptions {
  temperature?: number;
  maxNewTokens?: number;
  topP?: number;
  repetitionPenalty?: number;
  returnFullText?: boolean;
}

export interface HuggingFaceResponse {
  generated_text: string;
}

export interface HuggingFaceError {
  error: string;
}

const HF_API_BASE = "https://api-inference.huggingface.co/models";

/**
 * Vérifie si la clé API HuggingFace est configurée
 */
export function isHuggingFaceConfigured(): boolean {
  const apiKey = localStorage.getItem("hf_api_key_encrypted");
  return !!apiKey;
}

/**
 * Récupère la clé API déchiffrée
 */
export async function getHuggingFaceApiKey(): Promise<string | null> {
  const encrypted = localStorage.getItem("hf_api_key_encrypted");
  if (!encrypted) return null;
  
  try {
    return await decryptApiKeyAsync(encrypted);
  } catch {
    return null;
  }
}

/**
 * Sauvegarde la clé API chiffrée (AES-GCM).
 */
export async function setHuggingFaceApiKey(apiKey: string): Promise<void> {
  const encrypted = await encryptApiKeyAsync(apiKey);
  localStorage.setItem("hf_api_key_encrypted", encrypted);
}

/**
 * Génère une réponse via HuggingFace Inference API
 */
export async function generateWithHuggingFace(
  modelId: string,
  prompt: string,
  options: HuggingFaceOptions = {}
): Promise<{ text: string; error?: string }> {
  const apiKey = await getHuggingFaceApiKey();
  if (!apiKey) {
    return { text: "", error: "Clé API HuggingFace non configurée" };
  }

  const defaultOptions: HuggingFaceOptions = {
    temperature: 0.7,
    maxNewTokens: 2048,
    topP: 0.95,
    repetitionPenalty: 1.1,
    returnFullText: false,
  };

  const mergedOptions = { ...defaultOptions, ...options };

  const payload = {
    inputs: prompt,
    parameters: {
      temperature: mergedOptions.temperature,
      max_new_tokens: mergedOptions.maxNewTokens,
      top_p: mergedOptions.topP,
      repetition_penalty: mergedOptions.repetitionPenalty,
      return_full_text: mergedOptions.returnFullText,
    },
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout

    const response = await fetch(`${HF_API_BASE}/${modelId}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401) {
        return { text: "", error: "Clé API invalide ou expirée" };
      }
      if (response.status === 503) {
        return { text: "", error: "Modèle en cours de chargement sur HuggingFace, réessayez dans 30s" };
      }
      const errorText = await response.text();
      return { text: "", error: `Erreur HuggingFace (${response.status}): ${errorText}` };
    }

    const result = (await response.json()) as HuggingFaceResponse[];
    
    if (Array.isArray(result) && result.length > 0) {
      return { text: result[0].generated_text };
    }
    
    return { text: "", error: "Réponse invalide de HuggingFace" };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return { text: "", error: "Timeout - Le modèle met trop de temps à répondre" };
      }
      return { text: "", error: `Erreur: ${error.message}` };
    }
    return { text: "", error: "Erreur inconnue" };
  }
}

/**
 * Liste des modèles Gemma 4 disponibles sur HuggingFace
 */
export const HUGGINGFACE_GEMMA4_MODELS = [
  {
    id: "google/gemma-4-4b-it",
    label: "Gemma 4 4B Instruct",
    description: "Version légère (4B params) - Idéal pour tests",
    sizeGB: 8,
    ramMinGb: 8,
    tags: ["gemma4", "léger", "multimodal"],
  },
  {
    id: "google/gemma-4-9b-it",
    label: "Gemma 4 9B Instruct",
    description: "Version standard (9B params) - Bon compromis",
    sizeGB: 18,
    ramMinGb: 16,
    tags: ["gemma4", "standard", "multimodal"],
  },
  {
    id: "google/gemma-4-12b-it",
    label: "Gemma 4 12B Instruct",
    description: "Version avancée (12B params) - Haute qualité",
    sizeGB: 24,
    ramMinGb: 24,
    tags: ["gemma4", "avancé", "multimodal"],
  },
  {
    id: "google/gemma-4-27b-it",
    label: "Gemma 4 27B Instruct",
    description: "Version maximale (27B params) - Qualité maximale",
    sizeGB: 54,
    ramMinGb: 48,
    tags: ["gemma4", "max", "multimodal"],
  },
];

/**
 * Autres modèles recommandés sur HuggingFace
 */
export const HUGGINGFACE_RECOMMENDED_MODELS = [
  {
    id: "Qwen/Qwen2.5-Coder-7B-Instruct",
    label: "Qwen2.5 Coder 7B",
    description: "Excellent pour le code Python et PyQGIS",
    sizeGB: 4.5,
    ramMinGb: 8,
    tags: ["code", "python", "recommandé"],
  },
  {
    id: "meta-llama/Llama-3.1-8B-Instruct",
    label: "Llama 3.1 8B Instruct",
    description: "Très bon pour les explications et QGIS",
    sizeGB: 4.9,
    ramMinGb: 8,
    tags: ["général", "français", "recommandé"],
  },
  {
    id: "microsoft/Phi-4",
    label: "Phi-4",
    description: "Raisonnement avancé, excellente qualité",
    sizeGB: 8,
    ramMinGb: 12,
    tags: ["raisonnement", "avancé"],
  },
];

// Helper functions utilisent directement encryptApiKey et decryptApiKey de ./encryption
