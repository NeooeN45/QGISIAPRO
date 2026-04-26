import {
  AppSettings,
  DEFAULT_OPENROUTER_FREE_COMPAT_EXECUTOR_MODEL,
  DEFAULT_OPENROUTER_FREE_COMPAT_PLANNER_MODEL,
  getConfiguredOpenRouterApiKey,
} from "./settings";
import { appendDebugEvent } from "./debug-log";
import {
  executeQgisToolCall,
  getOpenAiQgisToolDefinitions,
  OpenAiToolDefinition,
} from "./qgis-tools";
import {
  calculateMaxTokens,
} from "./openrouter-models";
import { buildOpenRouterUserContent, filterValidImages } from "./vision-multipart";

export interface AgentTraceEntry {
  agent: "retriever" | "planner" | "planner_deep" | "reviewer" | "executor";
  model: string;
  output: string;
}

export interface OpenRouterKeyInfo {
  label: string;
  limit: number | null;
  limitRemaining: number | null;
  usage: number;
  usageDaily: number;
  usageWeekly: number;
  usageMonthly: number;
  isFreeTier: boolean;
}

interface GenerateOpenRouterReplyInput {
  conversationMode: "chat" | "free";
  latestUserMessage: string;
  layerContext: string;
  prompt: string;
  transcript: string;
  settings: AppSettings;
  signal?: AbortSignal;
  /** Images attachees pour modeles vision (GPT-4o, Claude 3.5+) */
  attachedImages?: Array<{ name: string; dataUrl: string }>;
}

interface OpenRouterToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAiContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string; detail?: "auto" | "low" | "high" };
}

interface OpenRouterMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | OpenAiContentPart[];
  tool_call_id?: string;
  tool_calls?: OpenRouterToolCall[];
  name?: string;
}

interface OpenRouterChatChoice {
  message?: OpenRouterMessage;
}

interface OpenRouterChatResponse {
  choices?: OpenRouterChatChoice[];
  error?: {
    message?: string;
    metadata?: {
      raw?: string;
    };
  };
}

interface OpenRouterEmbeddingResponse {
  data?: Array<{
    embedding?: number[];
  }>;
  error?: {
    message?: string;
  };
}

interface OpenRouterKeyResponse {
  data?: {
    label?: string;
    limit?: number | null;
    limit_remaining?: number | null;
    usage?: number;
    usage_daily?: number;
    usage_weekly?: number;
    usage_monthly?: number;
    is_free_tier?: boolean;
  };
  error?: {
    message?: string;
  };
}

interface OpenRouterPlugin {
  id: string;
  [key: string]: unknown;
}

interface OpenRouterProviderPreferences {
  order?: string[];
  allow_fallbacks?: boolean;
  require_parameters?: boolean;
  data_collection?: "allow" | "deny";
}

interface OpenRouterJsonSchemaResponseFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: boolean;
    schema: Record<string, unknown>;
  };
}

interface GeoAiPlan {
  objective: string;
  current_state: string;
  concerned_layers: string[];
  execution_plan: string[];
  risks: string[];
  missing_information: string[];
  validation_request: string;
  recommended_next_action: string;
}

interface ChatCompletionOptions {
  apiKey: string;
  endpoint: string;
  model: string;
  messages: OpenRouterMessage[];
  signal?: AbortSignal;
  tools?: OpenAiToolDefinition[];
  maxToolRounds?: number;
  appName?: string;
  referer?: string;
  plugins?: OpenRouterPlugin[];
  provider?: OpenRouterProviderPreferences;
  responseFormat?: OpenRouterJsonSchemaResponseFormat;
  zdr?: boolean;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function getResolvedApiKey(settings: AppSettings): string {
  return settings.openrouterApiKey || getConfiguredOpenRouterApiKey() || "";
}

/**
 * Estime le nombre de tokens dans un texte (approximation: 1 token ≈ 4 caractères)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estime le nombre total de tokens dans les messages
 */
function contentToText(content: string | OpenAiContentPart[] | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join(" ");
}

function estimateMessageTokens(messages: OpenRouterMessage[]): number {
  return messages.reduce((total, msg) => {
    if (msg.content) {
      return total + estimateTokens(contentToText(msg.content));
    }
    return total;
  }, 0);
}

/**
 * Calcule le max_tokens approprié selon le rôle et le contexte
 */
function calculateRoleMaxTokens(
  role: "planner" | "planner_deep" | "reviewer" | "executor",
  messages: OpenRouterMessage[],
  isFreeTier: boolean,
): number {
  const estimatedInputTokens = estimateMessageTokens(messages);
  
  if (isFreeTier) {
    // Free tier: limiter agressivement pour éviter les erreurs de crédits
    const freeTierLimit = 25000;
    const maxCompletion = Math.min(freeTierLimit - estimatedInputTokens - 1000, 8000);
    
    // Selon le rôle, ajuster le max_tokens (plus agressif)
    switch (role) {
      case "planner":
      case "planner_deep":
        return Math.min(Math.max(maxCompletion, 300), 1000);
      case "reviewer":
        return Math.min(Math.max(maxCompletion, 300), 800);
      case "executor":
        return Math.min(Math.max(maxCompletion, 500), 2000);
      default:
        return Math.min(Math.max(maxCompletion, 300), 1000);
    }
  } else {
    // Compte payant: contexte conservateur pour les modèles modernes (128K tokens minimum)
    const contextLength = 128_000;
    const maxCompletion = Math.min(contextLength - estimatedInputTokens - 1000, 8192);
    
    switch (role) {
      case "planner":
      case "planner_deep":
        return Math.min(Math.max(maxCompletion, 500), 2048);
      case "reviewer":
        return Math.min(Math.max(maxCompletion, 500), 1536);
      case "executor":
        return Math.min(Math.max(maxCompletion, 1000), 4096);
      default:
        return Math.min(Math.max(maxCompletion, 500), 2048);
    }
  }
}

function buildHeaders(
  apiKey: string,
  settings: Pick<AppSettings, "openrouterAppName" | "openrouterReferer">,
): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const referer =
    settings.openrouterReferer ||
    (typeof window !== "undefined" ? window.location.origin : "");
  if (referer) {
    headers["HTTP-Referer"] = referer;
  }

  if (settings.openrouterAppName) {
    headers["X-OpenRouter-Title"] = settings.openrouterAppName;
    headers["X-Title"] = settings.openrouterAppName;
  }

  return headers;
}

function requireResponseOk(
  response: Response,
  payload?: { error?: { message?: string; metadata?: { raw?: string } } },
): void {
  if (response.ok) {
    return;
  }

  const detail = payload?.error?.message || payload?.error?.metadata?.raw || "";

  if (response.status === 401) {
    throw new Error(
      "Clé API OpenRouter invalide ou expirée (401). Vérifiez votre clé dans les paramètres."
    );
  }
  if (response.status === 402) {
    throw new Error(
      "Crédit OpenRouter insuffisant (402). Rechargez votre solde sur openrouter.ai/credits."
    );
  }
  if (response.status === 429) {
    throw new Error(
      `Limite de requêtes OpenRouter atteinte (429). Attendez quelques secondes avant de réessayer.${detail ? " — " + detail : ""}`
    );
  }
  if (response.status === 408 || response.status === 504) {
    throw new Error(
      `Délai d’attente dépassé chez OpenRouter (${response.status}). Le modèle est peut-être surchargé.`
    );
  }
  if (response.status >= 500) {
    throw new Error(
      `Erreur serveur OpenRouter (${response.status}). Réessayez dans quelques instants.${detail ? " — " + detail : ""}`
    );
  }

  throw new Error(
    detail || `OpenRouter a renvoye une erreur HTTP ${response.status}.`,
  );
}

async function withApiTimeout<T>(fn: () => Promise<T>, timeoutMs = 120_000, label = "API"): Promise<T> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fn();
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new Error(`Délai dépassé (${timeoutMs / 1000}s) pour ${label}. Le modèle est peut-être surchargé.`);
    }
    throw err;
  } finally {
    clearTimeout(tid);
  }
}

function summarizeForTrace(value: string): string {
  const flattened = value.replace(/\s+/g, " ").trim();
  if (flattened.length <= 280) {
    return flattened;
  }

  return `${flattened.slice(0, 277).trimEnd()}...`;
}

function normalizeToolArguments(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "{}";
  }

  try {
    return JSON.stringify(JSON.parse(trimmed));
  } catch {
    return trimmed;
  }
}

function buildToolCallFingerprint(toolCalls: OpenRouterToolCall[]): string {
  return JSON.stringify(
    toolCalls.map((toolCall) => ({
      name: toolCall.function.name,
      arguments: normalizeToolArguments(toolCall.function.arguments || ""),
    })),
  );
}

function summarizeToolMessages(messages: OpenRouterMessage[], limit = 4): string {
  const toolMessages = messages
    .filter((message) => message.role === "tool" && typeof message.content === "string")
    .slice(-limit);

  if (toolMessages.length === 0) {
    return "Aucun resultat d'outil disponible.";
  }

  return toolMessages
    .map((message, index) => {
      const content = summarizeForTrace(contentToText(message.content));
      return `- Resultat outil ${index + 1}: ${content}`;
    })
    .join("\n");
}

async function finalizeAfterToolLoop(
  options: ChatCompletionOptions,
  activeModel: string,
  messages: OpenRouterMessage[],
  reason: string,
  toolCallsExecuted: number,
): Promise<{ text: string; toolCallsExecuted: number; model: string }> {
  appendDebugEvent({
    level: "warning",
    source: "openrouter",
    title: "Boucle d'outils interrompue",
    message: reason,
    details: summarizeToolMessages(messages, 6),
  });

  const finalMessages: OpenRouterMessage[] = [
    ...messages,
    {
      role: "user",
      content: [
        "Les appels d'outils ont deja fourni les informations utiles.",
        reason,
        "N'appelle plus aucun outil. Redige maintenant la reponse finale en francais, en t'appuyant uniquement sur les resultats d'outils deja presents.",
      ].join("\n\n"),
    },
  ];

  try {
    const response = await fetch(`${normalizeBaseUrl(options.endpoint)}/chat/completions`, {
      method: "POST",
      headers: buildHeaders(options.apiKey, {
        openrouterAppName: options.appName || "",
        openrouterReferer: options.referer || "",
      }),
      body: JSON.stringify({
        model: activeModel,
        messages: finalMessages,
        stream: false,
        plugins: options.plugins,
        provider: options.provider,
        zdr: options.zdr,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        top_p: options.topP,
      }),
      signal: options.signal,
    });

    const payload = (await response.json()) as OpenRouterChatResponse;
    requireResponseOk(response, payload);

    const finalText = extractText(payload.choices?.[0]?.message);
    if (finalText) {
      return {
        text: finalText,
        toolCallsExecuted,
        model: activeModel,
      };
    }
  } catch (error) {
    appendDebugEvent({
      level: "warning",
      source: "openrouter",
      title: "Finalisation sans outils indisponible",
      message:
        error instanceof Error
          ? error.message
          : "Erreur inconnue pendant la finalisation sans outils.",
      details: reason,
    });
  }

  return {
    text: [
      "J'ai interrompu une boucle d'outils pour eviter un blocage.",
      reason,
      "Derniers resultats disponibles :",
      summarizeToolMessages(messages, 6),
    ].join("\n\n"),
    toolCallsExecuted,
    model: activeModel,
  };
}

function isFreeModel(model: string): boolean {
  return model.trim().endsWith(":free");
}

function getFallbackModelForFreeTier(options: ChatCompletionOptions): string | null {
  if (options.tools && options.tools.length > 0) {
    return DEFAULT_OPENROUTER_FREE_COMPAT_EXECUTOR_MODEL;
  }

  if (options.responseFormat) {
    return DEFAULT_OPENROUTER_FREE_COMPAT_PLANNER_MODEL;
  }

  return DEFAULT_OPENROUTER_FREE_COMPAT_EXECUTOR_MODEL;
}

function shouldRetryWithFreeTierFallback(
  response: Response,
  payload: OpenRouterChatResponse,
  model: string,
): boolean {
  if (!isFreeModel(model) || ![404, 429].includes(response.status)) {
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

function extractText(message: OpenRouterMessage | undefined): string {
  if (!message || typeof message.content !== "string") {
    return "";
  }

  return message.content.trim();
}

function buildProviderPreferences(
  settings: AppSettings,
  options?: { requireParameters?: boolean },
): OpenRouterProviderPreferences | undefined {
  const provider: OpenRouterProviderPreferences = {};
  if (settings.openrouterProviderOrder.length > 0) {
    provider.order = settings.openrouterProviderOrder;
  }

  provider.allow_fallbacks = settings.openrouterAllowFallbacks;
  provider.require_parameters =
    settings.openrouterRequireParameters || Boolean(options?.requireParameters);
  provider.data_collection = settings.openrouterDataCollection;

  return Object.keys(provider).length > 0 ? provider : undefined;
}

function buildPlugins(settings: AppSettings, usesStructuredOutput: boolean): OpenRouterPlugin[] | undefined {
  const plugins: OpenRouterPlugin[] = [];

  if (usesStructuredOutput && settings.openrouterUseResponseHealing) {
    plugins.push({ id: "response-healing" });
  }

  return plugins.length > 0 ? plugins : undefined;
}

const PLAN_RESPONSE_FORMAT: OpenRouterJsonSchemaResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "geoai_plan",
    strict: true,
    schema: {
      type: "object",
      properties: {
        objective: {
          type: "string",
          description: "Objectif principal de la demande SIG.",
        },
        current_state: {
          type: "string",
          description:
            "Etat courant verifie du projet, des couches et des contraintes connues.",
        },
        concerned_layers: {
          type: "array",
          description: "Couches principalement concernées par l'analyse ou l'action.",
          items: {
            type: "string",
          },
        },
        execution_plan: {
          type: "array",
          description: "Étapes concrètes à exécuter ou à valider, dans l'ordre.",
          items: {
            type: "string",
          },
        },
        risks: {
          type: "array",
          description: "Risques, préconditions ou points de vigilance.",
          items: {
            type: "string",
          },
        },
        missing_information: {
          type: "array",
          description:
            "Informations manquantes ou à confirmer avant d'exécuter une action sûre.",
          items: {
            type: "string",
          },
        },
        validation_request: {
          type: "string",
          description: "Demande de validation ou prochaine action attendue.",
        },
        recommended_next_action: {
          type: "string",
          description:
            "Prochaine action la plus utile et la plus sûre à effectuer maintenant.",
        },
      },
      required: [
        "objective",
        "concerned_layers",
        "execution_plan",
        "risks",
        "validation_request",
      ],
      additionalProperties: false,
    },
  },
};

function parseStructuredPlan(content: string): GeoAiPlan {
  const parsed = JSON.parse(content) as Partial<GeoAiPlan>;
  const normalizeStringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [];

  const objective = typeof parsed.objective === "string" ? parsed.objective.trim() : "";
  const currentState =
    typeof parsed.current_state === "string" ? parsed.current_state.trim() : "";
  const validationRequest =
    typeof parsed.validation_request === "string"
      ? parsed.validation_request.trim()
      : "";
  const recommendedNextAction =
    typeof parsed.recommended_next_action === "string"
      ? parsed.recommended_next_action.trim()
      : "";

  if (!objective || !validationRequest) {
    const errorDetails = {
      objective: !!objective,
      validationRequest: !!validationRequest,
      rawText: content.substring(0, 500),
      parsedKeys: Object.keys(parsed),
    };
    appendDebugEvent({
      level: "error",
      source: "openrouter",
      title: "Plan structure invalide",
      message: `OpenRouter a renvoyé une structure de plan invalide. Champs manquants: ${!objective ? 'objective' : ''} ${!validationRequest ? 'validation_request' : ''}`,
      details: JSON.stringify(errorDetails, null, 2),
    });
    throw new Error("Plan structure invalide renvoye par OpenRouter.");
  }

  return {
    objective,
    current_state: currentState,
    concerned_layers: normalizeStringArray(parsed.concerned_layers),
    execution_plan: normalizeStringArray(parsed.execution_plan),
    risks: normalizeStringArray(parsed.risks),
    missing_information: normalizeStringArray(parsed.missing_information),
    validation_request: validationRequest,
    recommended_next_action: recommendedNextAction,
  };
}

function formatPlanAsMarkdown(plan: GeoAiPlan): string {
  const concernedLayers =
    plan.concerned_layers.length > 0
      ? plan.concerned_layers.map((entry) => `- ${entry}`).join("\n")
      : "- A préciser";
  const executionPlan =
    plan.execution_plan.length > 0
      ? plan.execution_plan.map((entry, index) => `${index + 1}. ${entry}`).join("\n")
      : "1. Aucune étape exploitable n'a été générée.";
  const risks =
    plan.risks.length > 0
      ? plan.risks.map((entry) => `- ${entry}`).join("\n")
      : "- Aucun risque explicite remonté.";
  const missingInformation =
    plan.missing_information.length > 0
      ? plan.missing_information.map((entry) => `- ${entry}`).join("\n")
      : "- Rien d'explicite.";

  return [
    "## Objectif",
    plan.objective,
    plan.current_state ? "## Etat courant\n\n" + plan.current_state : null,
    "## Couches concernées",
    concernedLayers,
    "## Plan d'exécution",
    executionPlan,
    "## Risques",
    risks,
    "## Informations manquantes",
    missingInformation,
    plan.recommended_next_action
      ? "## Prochaine action recommandee\n\n" + plan.recommended_next_action
      : null,
    "## Validation demandée",
    plan.validation_request,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function serializePlan(plan: GeoAiPlan): string {
  return JSON.stringify(plan, null, 2);
}

async function fetchEmbeddings(
  endpoint: string,
  apiKey: string,
  settings: AppSettings,
  model: string,
  input: string[],
  signal?: AbortSignal,
): Promise<number[][]> {
  const response = await fetch(`${normalizeBaseUrl(endpoint)}/embeddings`, {
    method: "POST",
    headers: buildHeaders(apiKey, settings),
    body: JSON.stringify({
      model,
      input,
    }),
    signal,
  });

  const payload = (await response.json()) as OpenRouterEmbeddingResponse;
  requireResponseOk(response, payload);

  if (!Array.isArray(payload.data)) {
    throw new Error("Reponse embeddings invalide depuis OpenRouter.");
  }

  return payload.data.map((item) => item.embedding || []);
}

export async function fetchOpenRouterKeyInfo(
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<OpenRouterKeyInfo> {
  const apiKey = getResolvedApiKey(settings);
  if (!apiKey) {
    throw new Error("Aucune cle API OpenRouter n'est configuree.");
  }

  const ctrl = new AbortController();
  const combinedSignal = signal ?? ctrl.signal;
  const tid = setTimeout(() => ctrl.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(`${normalizeBaseUrl(settings.openrouterEndpoint)}/key`, {
      method: "GET",
      headers: buildHeaders(apiKey, settings),
      signal: combinedSignal,
    });
  } catch (err) {
    clearTimeout(tid);
    if ((err as Error)?.name === "AbortError") {
      throw new Error("Vérification de la clé OpenRouter expirée (timeout 10s). Vérifiez votre connexion.");
    }
    throw err;
  }
  clearTimeout(tid);

  const payload = (await response.json()) as OpenRouterKeyResponse;
  requireResponseOk(response, payload);

  if (!payload.data) {
    throw new Error("Reponse de cle OpenRouter invalide.");
  }

  return {
    label: payload.data.label || "OpenRouter",
    limit:
      typeof payload.data.limit === "number" || payload.data.limit === null
        ? payload.data.limit
        : null,
    limitRemaining:
      typeof payload.data.limit_remaining === "number" ||
      payload.data.limit_remaining === null
        ? payload.data.limit_remaining
        : null,
    usage: typeof payload.data.usage === "number" ? payload.data.usage : 0,
    usageDaily:
      typeof payload.data.usage_daily === "number" ? payload.data.usage_daily : 0,
    usageWeekly:
      typeof payload.data.usage_weekly === "number" ? payload.data.usage_weekly : 0,
    usageMonthly:
      typeof payload.data.usage_monthly === "number" ? payload.data.usage_monthly : 0,
    isFreeTier: Boolean(payload.data.is_free_tier),
  };
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return Number.NEGATIVE_INFINITY;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return Number.NEGATIVE_INFINITY;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function splitTranscriptIntoChunks(transcript: string): string[] {
  return transcript
    .split(/\n\n(?=Utilisateur:|Assistant:)/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

function splitLayerContextIntoChunks(layerContext: string): string[] {
  return layerContext
    .split(/\n\n(?=- )/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

async function retrieveRelevantContext(
  input: GenerateOpenRouterReplyInput,
  trace: AgentTraceEntry[],
): Promise<string> {
  if (!input.settings.openrouterUseRetriever) {
    return input.layerContext || input.transcript;
  }

  const apiKey = getResolvedApiKey(input.settings);
  if (!apiKey) {
    return input.layerContext || input.transcript;
  }

  const chunks = [
    ...splitLayerContextIntoChunks(input.layerContext),
    ...splitTranscriptIntoChunks(input.transcript).slice(-6),
  ];

  if (chunks.length <= 1) {
    return input.layerContext || input.transcript;
  }

  try {
    const embeddings = await fetchEmbeddings(
      input.settings.openrouterEndpoint,
      apiKey,
      input.settings,
      input.settings.openrouterRetrieverModel,
      [input.latestUserMessage, ...chunks],
      input.signal,
    );
    const [queryEmbedding, ...chunkEmbeddings] = embeddings;
    const ranked = chunkEmbeddings
      .map((embedding, index) => ({
        chunk: chunks[index],
        score: cosineSimilarity(queryEmbedding, embedding),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 5)
      .map((entry) => entry.chunk);

    const result = ranked.join("\n\n");
    trace.push({
      agent: "retriever",
      model: input.settings.openrouterRetrieverModel,
      output:
        result.length > 0
          ? summarizeForTrace(result)
          : "Aucun bloc de contexte prioritaire n'a ete retenu.",
    });

    return result || input.layerContext || input.transcript;
  } catch (error) {
    trace.push({
      agent: "retriever",
      model: input.settings.openrouterRetrieverModel,
      output:
        error instanceof Error
          ? `Reranking indisponible: ${error.message}`
          : "Reranking indisponible.",
    });

    return input.layerContext || input.transcript;
  }
}

async function runChatCompletion(
  options: ChatCompletionOptions,
): Promise<{ text: string; toolCallsExecuted: number; model: string }> {
  const messages = [...options.messages];
  const apiKey = options.apiKey;
  const tools = options.tools;
  const maxToolRounds = options.maxToolRounds ?? 4;
  let activeModel = options.model;
  let hasRetriedWithFallback = false;
  const seenToolFingerprints = new Map<string, number>();

  for (let round = 0; round <= maxToolRounds; round += 1) {
    const response = await fetch(`${normalizeBaseUrl(options.endpoint)}/chat/completions`, {
      method: "POST",
      headers: buildHeaders(apiKey, {
        openrouterAppName: options.appName || "",
        openrouterReferer: options.referer || "",
      }),
      body: JSON.stringify({
        model: activeModel,
        messages,
        stream: false,
        tools,
        tool_choice: tools && tools.length > 0 ? "auto" : undefined,
        plugins: options.plugins,
        provider: options.provider,
        response_format: options.responseFormat,
        zdr: options.zdr,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        top_p: options.topP,
      }),
      signal: options.signal,
    });

    const payload = (await response.json()) as OpenRouterChatResponse;
    if (!response.ok) {
      const fallbackModel =
        !hasRetriedWithFallback &&
        shouldRetryWithFreeTierFallback(response, payload, activeModel)
          ? getFallbackModelForFreeTier(options)
          : null;

      if (fallbackModel && fallbackModel !== activeModel) {
        activeModel = fallbackModel;
        hasRetriedWithFallback = true;
        continue;
      }

      requireResponseOk(response, payload);
    }

    const message = payload.choices?.[0]?.message;
    const toolCalls = message?.tool_calls || [];

    if (toolCalls.length === 0) {
      return {
        text: extractText(message) || "Reponse vide d'OpenRouter.",
        toolCallsExecuted: round,
        model: activeModel,
      };
    }

    const toolFingerprint = buildToolCallFingerprint(toolCalls);
    const fingerprintCount = (seenToolFingerprints.get(toolFingerprint) || 0) + 1;
    seenToolFingerprints.set(toolFingerprint, fingerprintCount);

    if (fingerprintCount >= 2) {
      const repeatedTools = toolCalls.map((toolCall) => toolCall.function.name).join(", ");
      return finalizeAfterToolLoop(
        options,
        activeModel,
        messages,
        `Le modele a redemande la meme sequence d'outils (${repeatedTools}) apres avoir deja recu les resultats.`,
        round,
      );
    }

    messages.push({
      role: "assistant",
      content: message?.content || "",
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      let toolResult: Record<string, unknown>;

      try {
        const parsedArgs =
          typeof toolCall.function.arguments === "string" &&
          toolCall.function.arguments.trim().length > 0
            ? (JSON.parse(toolCall.function.arguments) as Record<string, unknown>)
            : {};
        toolResult = await executeQgisToolCall(toolCall.function.name, parsedArgs);
      } catch (error) {
        toolResult = {
          ok: false,
          error:
            error instanceof Error ? error.message : "Erreur inconnue cote outil.",
        };
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }

    if (round === maxToolRounds) {
      return finalizeAfterToolLoop(
        options,
        activeModel,
        messages,
        `Le nombre maximal de tours d'outils (${maxToolRounds + 1}) a ete atteint.`,
        round + 1,
      );
    }
  }

  return finalizeAfterToolLoop(
    options,
    activeModel,
    messages,
    "Nombre maximal d'iterations d'outils OpenRouter atteint.",
    maxToolRounds + 1,
  );
}

function shouldUseDeepPlanner(input: GenerateOpenRouterReplyInput): boolean {
  if (input.conversationMode === "free") return false;
  return (
    input.latestUserMessage.length > 320 ||
    splitLayerContextIntoChunks(input.layerContext).length > 2
  );
}

function appendTrace(text: string, trace: AgentTraceEntry[], enabled: boolean): string {
  if (!enabled || trace.length === 0) {
    return text;
  }

  const sections = trace.map((entry) =>
    [
      `### ${entry.agent} - ${entry.model}`,
      entry.output || "Aucune sortie exploitable.",
    ].join("\n\n"),
  );

  return [text, "## Trace multi-agent", ...sections].join("\n\n");
}

function isEmptyAssistantReply(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized.length === 0 || normalized === "reponse vide d'openrouter.";
}

export async function generateOpenRouterReply(
  input: GenerateOpenRouterReplyInput,
): Promise<{ text: string; trace: AgentTraceEntry[] }> {
  const apiKey = getResolvedApiKey(input.settings);
  if (!apiKey) {
    throw new Error("Aucune cle API OpenRouter n'est configuree.");
  }

  const trace: AgentTraceEntry[] = [];
  
  // Récupérer les infos de la clé pour déterminer si c'est le free tier
  let keyInfo: OpenRouterKeyInfo | null = null;
  try {
    keyInfo = await fetchOpenRouterKeyInfo(input.settings, input.signal);
  } catch {
    // En cas d'erreur, on suppose que c'est le free tier par défaut
  }
  
  const isFreeTier = keyInfo?.isFreeTier ?? true;

  const relevantContext = await retrieveRelevantContext(input, trace);

  const plannerMessages: OpenRouterMessage[] = [
    {
      role: "system",
      content: [
        "Tu es l'agent planner de QGISIA+, expert SIG intégré dans QGIS. Réponds toujours en français.",
        "Ton rôle : analyser la demande, identifier les couches et données concernées, et produire un plan d'exécution robuste.",
        "",
        "EXPERTISE DOMAINE :",
        "- Géomatique française : Lambert 93 (EPSG:2154), normes IGN, données Géoportail",
        "- Foresterie : peuplements, placettes, PSG, ONF, essences, volume bois",
        "- Cadastre : parcelles, sections, commune, propriétaires via cadastre.gouv.fr",
        "- Analyse spatiale : intersection, tampon, statistiques zonales, krigeage",
        "",
        "RÈGLES ABSOLUES :",
        "- N'invente JAMAIS de couches, champs, CRS, fichiers ou statistiques absents du contexte.",
        "- Données françaises : préconise EPSG:2154 en sortie systématiquement.",
        "- N'affirme jamais un propriétaire de parcelle sans source publique (cadastre.gouv.fr).",
        "- Identifie les risques et les informations manquantes avant d'agir.",
        "",
        "WORKFLOWS STANDARDS :",
        "- Commune : searchGeoApiCommunes → zoomToLayer",
        "- Cadastre : searchGeoApiCommunes → searchCadastreParcels → applyParcelStylePreset → zoomToLayer",
        "- Raster NDVI : mergeRasterBands → calcul d'indices → export GeoTIFF",
        "- Inventaire : createInventoryGrid → placement placettes → export",
        "Respecte strictement le schéma JSON. ",
        input.conversationMode === "free"
          ? "Mode LIBRE : discussion générale, pas d'outils SIG."
          : "Mode ACTION : 3-5 étapes concrètes et ordonnées pour l'executor.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Demande utilisateur :\n${input.latestUserMessage}`,
        relevantContext
          ? `Contexte SIG prioritaire :\n${relevantContext.substring(0, 3000)}`
          : "Aucun contexte de couches disponible.",
        `Contexte complet du projet :\n${input.prompt.substring(0, 4000)}`,
      ].join("\n\n"),
    },
  ];

  const planner = await runChatCompletion({
    apiKey,
    endpoint: input.settings.openrouterEndpoint,
    model: input.settings.openrouterPlannerModel,
    messages: plannerMessages,
    signal: input.signal,
    appName: input.settings.openrouterAppName,
    referer: input.settings.openrouterReferer,
    responseFormat: PLAN_RESPONSE_FORMAT,
    plugins: buildPlugins(input.settings, true),
    provider: buildProviderPreferences(input.settings, { requireParameters: true }),
    zdr: input.settings.openrouterOnlyZdr,
    maxTokens: calculateRoleMaxTokens("planner", plannerMessages, isFreeTier),
    temperature: input.settings.temperature,
    topP: input.settings.topP,
  });
  let workingPlan = parseStructuredPlan(planner.text);
  trace.push({
    agent: "planner",
    model: planner.model,
    output: summarizeForTrace(formatPlanAsMarkdown(workingPlan)),
  });

  if (
    input.settings.openrouterAgentMode === "multi" &&
    shouldUseDeepPlanner(input)
  ) {
    const deepPlannerMessages: OpenRouterMessage[] = [
      {
        role: "system",
        content: [
          "Tu es l'agent planner profond de QGISIA+. Ton rôle : raffiner et solidifier le plan initial.",
          "",
          "OBJECTIFS DU RAFFINAGE :",
          "- Vérifier que chaque étape est réalisable avec les couches disponibles",
          "- Préciser les CRS d'entrée et de sortie pour chaque opération",
          "- Identifier les champs attributaires nécessaires et leurs valeurs attendues",
          "- Renforcer la gestion d'erreurs : que faire si une couche est absente ?",
          "- Éliminer les étapes redondantes ou non nécessaires",
          "- Ajouter les préconditions manquantes (ex: reprojection avant analyse)",
          "- Évaluer les risques de performance (couches volumineuses, calculs lourds)",
          "",
          "Respecte strictement le schéma JSON. N'invente pas de données ou couches absentes.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `Plan initial à raffiner :\n${serializePlan(workingPlan).substring(0, 2500)}`,
          relevantContext
            ? `Contexte SIG disponible :\n${relevantContext.substring(0, 2000)}`
            : "Pas de contexte de couches.",
          `Demande originale :\n${input.latestUserMessage}`,
        ].join("\n\n"),
      },
    ];
    
    const deepPlanner = await runChatCompletion({
      apiKey,
      endpoint: input.settings.openrouterEndpoint,
      model: input.settings.openrouterDeepPlannerModel,
      messages: deepPlannerMessages,
      signal: input.signal,
      appName: input.settings.openrouterAppName,
      referer: input.settings.openrouterReferer,
      responseFormat: PLAN_RESPONSE_FORMAT,
      plugins: buildPlugins(input.settings, true),
      provider: buildProviderPreferences(input.settings, { requireParameters: true }),
      zdr: input.settings.openrouterOnlyZdr,
      maxTokens: calculateRoleMaxTokens("planner_deep", deepPlannerMessages, isFreeTier),
      temperature: input.settings.temperature,
      topP: input.settings.topP,
    });

    workingPlan = parseStructuredPlan(deepPlanner.text);
    trace.push({
      agent: "planner_deep",
      model: deepPlanner.model,
      output: summarizeForTrace(formatPlanAsMarkdown(workingPlan)),
    });
  }

  let reviewedPlan = workingPlan;
  if (input.settings.openrouterAgentMode === "multi") {
    const reviewerMessages: OpenRouterMessage[] = [
        {
          role: "system",
          content: [
            "Tu es l'agent reviewer de QGISIA+. Valide la stratégie avant exécution réelle.",
            "",
            "VÉRIFICATIONS CRITIQUES :",
            "- Les couches citées existent-elles dans le contexte fourni ?",
            "- Les CRS sont-ils compatibles avec les opérations prévues ?",
            "- Les étapes sont-elles dans le bon ordre logique ?",
            "- Y a-t-il des risques de perte de données ou d'erreurs QGIS ?",
            "- La validation_request est-elle précise et utile pour l'utilisateur ?",
            "",
            "Renvoie uniquement la stratégie corrigée. Respecte le schéma JSON. N'invente pas de données.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `Stratégie à valider :\n${serializePlan(workingPlan).substring(0, 2500)}`,
            relevantContext
              ? `Contexte SIG disponible :\n${relevantContext.substring(0, 1500)}`
              : "Pas de contexte de couches.",
            `Demande originale :\n${input.latestUserMessage}`,
          ].join("\n\n"),
        },
      ];
    const reviewer = await runChatCompletion({
      apiKey,
      endpoint: input.settings.openrouterEndpoint,
      model: input.settings.openrouterReviewerModel,
      messages: reviewerMessages,
      signal: input.signal,
      appName: input.settings.openrouterAppName,
      referer: input.settings.openrouterReferer,
      responseFormat: PLAN_RESPONSE_FORMAT,
      plugins: buildPlugins(input.settings, true),
      provider: buildProviderPreferences(input.settings, { requireParameters: true }),
      zdr: input.settings.openrouterOnlyZdr,
      maxTokens: calculateRoleMaxTokens("reviewer", reviewerMessages, isFreeTier),
      temperature: input.settings.temperature,
      topP: input.settings.topP,
    });

    reviewedPlan = parseStructuredPlan(reviewer.text);
    trace.push({
      agent: "reviewer",
      model: reviewer.model,
      output: summarizeForTrace(formatPlanAsMarkdown(reviewedPlan)),
    });
  }

  const executorMessages: OpenRouterMessage[] = [
      {
        role: "system",
        content: [
          "Tu es l'agent exécuteur de QGISIA+, expert PyQGIS et SIG intégré dans QGIS. Réponds en français.",
          "",
          "RÔLE : Exécuter la stratégie validée en appelant les outils QGIS dans le bon ordre.",
          "",
          "EXPERTISE :",
          "- PyQGIS : QgsProject, QgsVectorLayer, QgsRasterLayer, processing, iface",
          "- Données françaises : EPSG:2154 (Lambert 93), IGN, Géoportail, cadastre.gouv.fr",
          "- Foresterie : peuplements, placettes inventaire, PSG, essences, tarifs de cubage",
          "- Geoprocessing : buffer, clip, intersect, union, dissolve, zonal stats",
          "",
          "RÈGLES D'EXÉCUTION :",
          "1. Utilise TOUJOURS les outils bridge en priorité (getLayersList, getLayerFields, etc.)",
          "2. Vérifie l'état réel du projet avant toute action (appelle getLayersCatalog si nécessaire)",
          "3. Si action impossible via outils : génère UN SEUL bloc ```python``` PyQGIS complet avec gestion d'erreurs",
          "4. N'invente JAMAIS l'état des couches, des champs ou des statistiques",
          "5. N'affirme jamais un propriétaire de parcelle sans source publique officielle",
          "6. Données françaises : vérifie et préconise EPSG:2154 en sortie",
          "7. Termine toujours par un résumé clair de ce qui a été fait",
          "",
          "WORKFLOWS STANDARDS :",
          "- Commune : searchGeoApiCommunes → zoomToLayer",
          "- Cadastre : searchGeoApiCommunes → searchCadastreParcels → applyParcelStylePreset → zoomToLayer",
          "- Raster NDVI : mergeRasterBands → calcul → export GeoTIFF",
          "- Inventaire forestier : createInventoryGrid → placement placettes → statistiques",
        ].join("\n"),
      },
      {
        role: "user",
        content: buildOpenRouterUserContent(
          [
            `Stratégie validée :\n${formatPlanAsMarkdown(reviewedPlan).substring(0, 3000)}`,
            relevantContext
              ? `Contexte SIG du projet :\n${relevantContext.substring(0, 2000)}`
              : "Pas de contexte de couches disponible.",
            `Demande de l'utilisateur :\n${input.latestUserMessage}`,
            "Exécute la stratégie étape par étape. Vérifie l'état réel via les outils avant chaque action importante.",
          ].join("\n\n"),
          filterValidImages(input.attachedImages || []),
        ),
      },
    ];
  let executor = await runChatCompletion({
    apiKey,
    endpoint: input.settings.openrouterEndpoint,
    model: input.settings.openrouterExecutorModel,
    messages: executorMessages,
    signal: input.signal,
    appName: input.settings.openrouterAppName,
    referer: input.settings.openrouterReferer,
    tools:
      input.settings.openrouterExecutionMode === "tools"
        ? getOpenAiQgisToolDefinitions()
        : undefined,
    maxToolRounds: 6,
    plugins: buildPlugins(input.settings, false),
    provider: buildProviderPreferences(input.settings, {
      requireParameters:
        input.settings.openrouterExecutionMode === "tools",
    }),
    zdr: input.settings.openrouterOnlyZdr,
    maxTokens: calculateRoleMaxTokens("executor", executorMessages, isFreeTier),
    temperature: input.settings.temperature,
    topP: input.settings.topP,
  });

  if (
    input.settings.openrouterExecutionMode === "tools" &&
    isEmptyAssistantReply(executor.text)
  ) {
    const fallbackMessages: OpenRouterMessage[] = [
        {
          role: "system",
          content: [
            "Tu es l'agent exécuteur de QGISAI+. Réponds en français.",
            "Utilise les outils QGIS pour vérifier l'état réel du projet avant de répondre.",
            "N'invente pas de données, champs ou couches. N'appelle pas d'outils inutiles.",
            "Si une action nécessite PyQGIS, fournis un bloc ```python``` complet et auto-suffisant.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `Objectif :\n${reviewedPlan.objective}`,
            reviewedPlan.concerned_layers.length > 0
              ? `Couches concernées :\n${reviewedPlan.concerned_layers.join(", ")}`
              : null,
            reviewedPlan.execution_plan.length > 0
              ? `Étapes à exécuter :\n${reviewedPlan.execution_plan.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
              : null,
            `Demande de l'utilisateur :\n${input.latestUserMessage}`,
            "Commence par vérifier l'état réel du projet via les outils si nécessaire.",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ];
    executor = await runChatCompletion({
      apiKey,
      endpoint: input.settings.openrouterEndpoint,
      model: executor.model,
      messages: fallbackMessages,
      signal: input.signal,
      appName: input.settings.openrouterAppName,
      referer: input.settings.openrouterReferer,
      tools: getOpenAiQgisToolDefinitions(),
      maxToolRounds: 8,
      plugins: buildPlugins(input.settings, false),
      provider: buildProviderPreferences(input.settings, {
        requireParameters: true,
      }),
      zdr: input.settings.openrouterOnlyZdr,
      maxTokens: calculateRoleMaxTokens("executor", fallbackMessages, isFreeTier),
      temperature: input.settings.temperature,
      topP: input.settings.topP,
    });
  }

  trace.push({
    agent: "executor",
    model: executor.model,
    output: summarizeForTrace(executor.text),
  });

  return {
    text: appendTrace(executor.text, trace, input.settings.openrouterShowTrace),
    trace,
  };
}
