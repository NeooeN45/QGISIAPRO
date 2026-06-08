import { getGeminiChat } from "./gemini";
import { buildOpenRouterHeaders } from "./openrouter-headers";
import { getLayersCatalog, isQgisAvailable } from "./qgis";
import {
  AppSettings,
  DEFAULT_OPENROUTER_FREE_COMPAT_EXECUTOR_MODEL,
  DEFAULT_OPENROUTER_FREE_COMPAT_PLANNER_MODEL,
  getActiveModel,
  getConfiguredGeminiApiKey,
  getConfiguredNvidiaApiKey,
  getConfiguredOpenRouterApiKey,
} from "./settings";

export interface ModelProbeResult {
  checkedAt: string;
  details?: string;
  endpoint: string;
  latencyMs: number;
  model: string;
  ok: boolean;
  preview: string;
  provider: string;
}

function roundLatency(value: number): number {
  return Math.max(0, Math.round(value));
}

function getNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

function extractTextPreview(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  return "";
}

function isFreeOpenRouterModel(model: string): boolean {
  return model.trim().endsWith(":free");
}

function shouldRetryOpenRouterProbeWithFallback(
  response: Response,
  payload: {
    error?: {
      message?: string;
      metadata?: {
        raw?: string;
      };
    };
  },
  model: string,
): boolean {
  if (!isFreeOpenRouterModel(model) || ![404, 429].includes(response.status)) {
    return false;
  }

  const details = [
    payload.error?.message || "",
    payload.error?.metadata?.raw || "",
  ]
    .join(" ")
    .toLowerCase();

  return (
    details.length === 0 ||
    details.includes("temporarily rate-limited upstream") ||
    details.includes("no endpoints available matching your guardrail restrictions and data policy") ||
    details.includes("no endpoints found that support tool use") ||
    details.includes("no endpoints found that can handle the requested parameters")
  );
}

function getOpenRouterProbeFallbackModel(
  settings: AppSettings,
  model: string,
): string | null {
  if (!isFreeOpenRouterModel(model)) {
    return null;
  }

  const plannerModels = new Set([
    settings.openrouterPlannerModel,
    settings.openrouterDeepPlannerModel,
    settings.openrouterReviewerModel,
  ]);

  if (plannerModels.has(model)) {
    return DEFAULT_OPENROUTER_FREE_COMPAT_PLANNER_MODEL;
  }

  if (model === settings.openrouterExecutorModel) {
    return DEFAULT_OPENROUTER_FREE_COMPAT_EXECUTOR_MODEL;
  }

  if (model.includes("coder")) {
    return DEFAULT_OPENROUTER_FREE_COMPAT_EXECUTOR_MODEL;
  }

  return DEFAULT_OPENROUTER_FREE_COMPAT_PLANNER_MODEL;
}

function isOpenRouterFreeDailyQuotaError(message: string): boolean {
  return message.toLowerCase().includes("free-models-per-day");
}

function buildOpenRouterProbeFailureResult(input: {
  endpoint: string;
  latencyMs: number;
  model: string;
  requestedModel: string;
  message: string;
  resolvedModel?: string;
}): ModelProbeResult {
  const details: string[] = [];
  if (input.requestedModel !== input.model) {
    details.push(`fallback=${input.model}`);
  }
  if (input.resolvedModel && input.resolvedModel !== input.model) {
    details.push(`resolved=${input.resolvedModel}`);
  }

  if (isOpenRouterFreeDailyQuotaError(input.message)) {
    details.push(
      "Le quota journalier des modeles gratuits OpenRouter est epuise pour cette cle.",
    );
    details.push(
      "Action recommandee: passe en provider local ou ajoute des credits pour debloquer les requetes free.",
    );

    return {
      checkedAt: new Date().toISOString(),
      details: [input.message, ...details].join("\n"),
      endpoint: input.endpoint,
      latencyMs: input.latencyMs,
      model: input.model,
      ok: false,
      preview: "Quota journalier OpenRouter pour les modeles gratuits atteint.",
      provider: "openrouter",
    };
  }

  return {
    checkedAt: new Date().toISOString(),
    details: details.length > 0 ? [input.message, ...details].join("\n") : input.message,
    endpoint: input.endpoint,
    latencyMs: input.latencyMs,
    model: input.model,
    ok: false,
    preview: "Le test OpenRouter a echoue.",
    provider: "openrouter",
  };
}

async function runOpenRouterProbeRequest(
  settings: AppSettings,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<{
  response: Response;
  payload: {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string; metadata?: { raw?: string } };
    model?: string;
  };
}> {
  const response = await fetch(
    `${settings.openrouterEndpoint.replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: buildOpenRouterHeaders(apiKey, settings),
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: "Reponds exactement: OK",
          },
        ],
        stream: false,
      }),
      signal,
    },
  );

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string; metadata?: { raw?: string } };
    model?: string;
  };

  return { response, payload };
}

export async function probeQgisBridge(): Promise<ModelProbeResult> {
  const startedAt = getNow();

  if (!isQgisAvailable()) {
    return {
      checkedAt: new Date().toISOString(),
      endpoint: typeof window !== "undefined" ? window.location.origin : "QGIS",
      latencyMs: roundLatency(getNow() - startedAt),
      model: "bridge",
      ok: false,
      preview: "Le pont QGIS n'est pas disponible dans cette session.",
      provider: "qgis",
    };
  }

  const layers = await getLayersCatalog();

  return {
    checkedAt: new Date().toISOString(),
    details:
      layers.length > 0
        ? layers.map((layer) => `${layer.name} (${layer.type || "inconnu"})`).join(", ")
        : "Aucune couche chargee.",
    endpoint: typeof window !== "undefined" ? window.location.origin : "QGIS",
    latencyMs: roundLatency(getNow() - startedAt),
    model: "bridge",
    ok: true,
    preview:
      layers.length > 0
        ? `${layers.length} couche(s) detectee(s).`
        : "Bridge OK, mais aucune couche chargee.",
    provider: "qgis",
  };
}

export async function probeLocalModel(
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<ModelProbeResult> {
  const startedAt = getNow();
  const response = await fetch(settings.localEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.localModel,
      prompt: "Reponds exactement: OK",
      stream: false,
      system: "Tu es un assistant de diagnostic. Reponds uniquement OK.",
    }),
    signal,
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      extractTextPreview(payload.error) || "Erreur lors du test du modele local.",
    );
  }

  return {
    checkedAt: new Date().toISOString(),
    endpoint: settings.localEndpoint,
    latencyMs: roundLatency(getNow() - startedAt),
    model: settings.localModel,
    ok: true,
    preview:
      extractTextPreview(payload.response) ||
      extractTextPreview(payload.content) ||
      "Modele local joignable.",
    provider: "local",
  };
}

export async function probeGeminiModel(
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<ModelProbeResult> {
  const apiKey = settings.googleApiKey || getConfiguredGeminiApiKey();
  if (!apiKey) {
    throw new Error("Aucune cle API Gemini n'est configuree.");
  }

  const startedAt = getNow();
  const chat = getGeminiChat({
    ...settings,
    googleApiKey: apiKey,
  });
  const response = await chat.sendMessage({
    message: "Reponds exactement: OK",
    config: {
      abortSignal: signal,
    },
  });

  return {
    checkedAt: new Date().toISOString(),
    endpoint: "https://generativelanguage.googleapis.com",
    latencyMs: roundLatency(getNow() - startedAt),
    model: settings.googleModel,
    ok: true,
    preview: response.text?.trim() || "Gemini joignable.",
    provider: "google",
  };
}

export async function probeOpenRouterModel(
  settings: AppSettings,
  model: string,
  signal?: AbortSignal,
): Promise<ModelProbeResult> {
  const apiKey = settings.openrouterApiKey || getConfiguredOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("Aucune cle API OpenRouter n'est configuree.");
  }

  const startedAt = getNow();
  const requestedModel = model;
  let testedModel = model;
  let { response, payload } = await runOpenRouterProbeRequest(
    settings,
    apiKey,
    testedModel,
    signal,
  );

  if (shouldRetryOpenRouterProbeWithFallback(response, payload, testedModel)) {
    const fallbackModel = getOpenRouterProbeFallbackModel(settings, testedModel);
    if (fallbackModel && fallbackModel !== testedModel) {
      testedModel = fallbackModel;
      ({ response, payload } = await runOpenRouterProbeRequest(
        settings,
        apiKey,
        testedModel,
        signal,
      ));
    }
  }

  if (!response.ok) {
    return buildOpenRouterProbeFailureResult({
      endpoint: settings.openrouterEndpoint,
      latencyMs: roundLatency(getNow() - startedAt),
      model: testedModel,
      requestedModel,
      message:
        payload.error?.metadata?.raw ||
        payload.error?.message ||
        "Erreur pendant le test OpenRouter.",
      resolvedModel: payload.model,
    });
  }

  const details: string[] = [];
  if (requestedModel !== testedModel) {
    details.push(`fallback=${testedModel}`);
  }
  if (payload.model && payload.model !== testedModel) {
    details.push(`resolved=${payload.model}`);
  }

  return {
    checkedAt: new Date().toISOString(),
    details: details.length > 0 ? details.join(" | ") : undefined,
    endpoint: settings.openrouterEndpoint,
    latencyMs: roundLatency(getNow() - startedAt),
    model: testedModel,
    ok: true,
    preview:
      payload.choices?.[0]?.message?.content?.trim() || "Modele OpenRouter joignable.",
    provider: "openrouter",
  };
}

export async function probeNvidiaModel(
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<ModelProbeResult> {
  const startedAt = getNow();
  const apiKey = settings.nvidiaApiKey.trim() || getConfiguredNvidiaApiKey();
  const model = getActiveModel(settings);
  const endpoint = settings.nvidiaEndpoint;

  if (!apiKey) {
    return {
      checkedAt: new Date().toISOString(),
      endpoint,
      latencyMs: roundLatency(getNow() - startedAt),
      model,
      ok: false,
      preview: "Aucune cle API NVIDIA NIM configuree.",
      provider: "nvidia",
    };
  }

  try {
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Ping" }],
        max_tokens: 5,
      }),
      signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        checkedAt: new Date().toISOString(),
        endpoint,
        latencyMs: roundLatency(getNow() - startedAt),
        model,
        ok: false,
        preview:
          payload.error?.message ||
          `Erreur NVIDIA NIM (${response.status}).`,
        provider: "nvidia",
      };
    }

    return {
      checkedAt: new Date().toISOString(),
      endpoint,
      latencyMs: roundLatency(getNow() - startedAt),
      model,
      ok: true,
      preview:
        payload.choices?.[0]?.message?.content?.trim() || "NVIDIA NIM joignable.",
      provider: "nvidia",
    };
  } catch (error) {
    return {
      checkedAt: new Date().toISOString(),
      endpoint,
      latencyMs: roundLatency(getNow() - startedAt),
      model,
      ok: false,
      preview: error instanceof Error ? error.message : "Erreur inconnue NVIDIA NIM.",
      provider: "nvidia",
    };
  }
}

export async function probeActiveProvider(
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<ModelProbeResult> {
  if (settings.provider === "local") {
    return probeLocalModel(settings, signal);
  }

  if (settings.provider === "google") {
    return probeGeminiModel(settings, signal);
  }

  if (settings.provider === "nvidia") {
    return probeNvidiaModel(settings, signal);
  }

  return probeOpenRouterModel(settings, getActiveModel(settings), signal);
}
