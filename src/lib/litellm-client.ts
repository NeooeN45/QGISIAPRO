/**
 * Client unifie pour le gateway LLM embarque (Sprint 1).
 *
 * Remplace progressivement openrouter.ts / gemini.ts / huggingface-provider.ts.
 * Communique avec qgis_plugin/llm_gateway.py via les endpoints /api/llm/*.
 *
 * Contrat volontairement minimal :
 *  - chat({ model, messages, stream, ... })
 *  - streamChat(...) -> AsyncGenerator<ChatChunk>
 *  - listModels() / getBudget() / health() / installGateway()
 */

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

export interface ChatTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface ApiKeys {
  openrouter?: string;
  gemini?: string;
  huggingface?: string;
  anthropic?: string;
  openai?: string;
  nvidia_nim?: string;   // NVIDIA NIM (build.nvidia.com)
  groq?: string;         // Groq LPU (console.groq.com) — gratuit
  cerebras?: string;     // Cerebras WSE (cloud.cerebras.ai)
  mistral?: string;      // Mistral AI (console.mistral.ai)
  ollama_base_url?: string;
}

export interface ChatRequest {
  model: string; // alias (ex: "smart-default") ou nom direct "openrouter/..."
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: ChatTool[];
  api_keys?: ApiKeys;
  signal?: AbortSignal;
}

export interface ChatResponse {
  id?: string;
  choices: Array<{
    message: ChatMessage;
    finish_reason?: string;
    index: number;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  _gateway?: {
    model_used: string;
    attempt: number;
    latency_ms: number;
  };
}

export interface ChatChunk {
  id?: string;
  choices: Array<{
    delta: { content?: string; role?: ChatRole; tool_calls?: unknown };
    index: number;
    finish_reason?: string | null;
  }>;
}

export interface ModelAlias {
  alias: string;
  description?: string;
  primary: string;
  fallbacks?: string[];
  max_cost_usd?: number;
  temperature?: number;
}

export interface BudgetSnapshot {
  day: string;
  total_usd: number;
  by_model: Record<string, number>;
  request_count: number;
  limits?: { daily_max_usd?: number; per_request_max_usd?: number };
}

export interface HealthStatus {
  vendor_ready: boolean;
  config_loaded: boolean;
  aliases: string[];
}

export interface InstallLog {
  time: number;
  stage: string;
  message: string;
  level: "info" | "warning" | "error";
}

export interface InstallStatus {
  status: string;
  progress: number;
  error: string | null;
  done: boolean;
  logs: InstallLog[];
  in_progress: boolean;
  vendor_ready: boolean;
}

// ---------------------------------------------------------------------------
// Base URL detection
// ---------------------------------------------------------------------------

function getBaseUrl(): string {
  // Le plugin QGIS sert le frontend depuis son propre HTTP server.
  // En dev Vite, on peut pointer manuellement via VITE_LLM_GATEWAY_URL.
  const fromEnv = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_LLM_GATEWAY_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return "http://127.0.0.1:8765";
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json();
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error ?? `Gateway error ${response.status}`);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function health(): Promise<HealthStatus> {
  const data = await apiFetch<{ ok: boolean } & HealthStatus>("/api/llm/health");
  return { vendor_ready: data.vendor_ready, config_loaded: data.config_loaded, aliases: data.aliases };
}

export async function installGateway(): Promise<{ ok: boolean; status: string; already_installed?: boolean }> {
  return apiFetch<{ ok: boolean; status: string; already_installed?: boolean }>("/api/llm/install", { method: "POST" });
}

export async function getInstallStatus(): Promise<InstallStatus> {
  return apiFetch<InstallStatus>("/api/llm/install_status");
}

export interface LayerImportLog {
  timestamp: string;
  source: string;
  layer_name: string;
  error: string;
}

export interface DiagnosticInfo {
  python_version: string;
  platform: string;
  plugin_dir: string;
  vendor_dir: string;
  vendor_exists: boolean;
  marker_exists: boolean;
  vendor_ready: boolean;
  sys_path: string[];
  pip_path: string | null;
  debug_file?: string | null;
  layer_import_logs: LayerImportLog[];
  layer_import_error_count: number;
}

export async function runDiagnostic(): Promise<DiagnosticInfo> {
  return apiFetch<DiagnosticInfo>("/api/llm/diagnostic");
}

export async function installGatewaySync(): Promise<{ success: boolean; already_installed?: boolean; error?: string; logs?: InstallLog[] }> {
  return apiFetch<{ success: boolean; already_installed?: boolean; error?: string; logs?: InstallLog[] }>("/api/llm/install_sync", { method: "POST" });
}

export async function listModels(): Promise<ModelAlias[]> {
  const data = await apiFetch<{ ok: boolean; aliases: ModelAlias[] }>("/api/llm/models");
  return data.aliases;
}

export async function getBudget(): Promise<BudgetSnapshot> {
  return apiFetch<BudgetSnapshot>("/api/llm/budget");
}

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const { signal, stream: _ignored, ...body } = req;
  const data = await apiFetch<{ ok: boolean; response: ChatResponse }>(
    "/api/llm/chat",
    {
      method: "POST",
      body: JSON.stringify({ ...body, stream: false }),
      signal,
    },
  );
  return data.response;
}

/**
 * Configuration du streaming robuste.
 */
const STREAM_CONFIG = {
  FETCH_TIMEOUT_MS: 60000,        // Timeout initial de connexion: 60s (models lents)
  CHUNK_TIMEOUT_MS: 120000,       // Timeout entre chunks: 120s (generation longue)
  MAX_RETRIES: 3,                 // Nombre de retries: 3 (plus tolérant)
  RETRY_DELAY_MS: 1500,         // Délai initial entre retries: 1.5s
  MAX_RETRY_DELAY_MS: 10000,    // Délai max entre retries: 10s
};

/**
 * Crée un AbortController avec timeout.
 */
function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  // Nettoyer le timeout si déjà résolu
  const cleanup = () => clearTimeout(timeout);
  controller.signal.addEventListener('abort', cleanup, { once: true });
  return controller;
}

/**
 * Attend avec backoff exponentiel.
 */
async function sleepWithBackoff(attempt: number): Promise<void> {
  const delay = Math.min(
    STREAM_CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt),
    STREAM_CONFIG.MAX_RETRY_DELAY_MS
  );
  await new Promise(r => setTimeout(r, delay));
}

/**
 * Streaming SSE robuste avec retry, timeout et gestion d'erreurs.
 * Yield de chunks au format OpenAI delta.
 */
export async function* streamChat(req: ChatRequest): AsyncGenerator<ChatChunk, void, void> {
  const { signal: userSignal, ...body } = req;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= STREAM_CONFIG.MAX_RETRIES; attempt++) {
    try {
      // Timeout controller pour la connexion initiale
      const timeoutController = createTimeoutController(STREAM_CONFIG.FETCH_TIMEOUT_MS);
      
      // Combiner les signaux si l'utilisateur en a fourni un
      const combinedSignal = userSignal 
        ? AbortSignal.any([userSignal, timeoutController.signal])
        : timeoutController.signal;

      const response = await fetch(`${getBaseUrl()}/api/llm/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify({ ...body, stream: true }),
        signal: combinedSignal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lastChunkTime = Date.now();
      let heartbeatMissed = false;

      try {
        while (true) {
          // Vérifier le timeout entre chunks
          if (Date.now() - lastChunkTime > STREAM_CONFIG.CHUNK_TIMEOUT_MS) {
            throw new Error("Chunk timeout - no data received for 60s");
          }

          // Vérifier si l'utilisateur a demandé l'annulation
          if (userSignal?.aborted) {
            throw new Error("Request aborted by user");
          }

          const { done, value } = await reader.read();
          
          if (done) {
            // Traiter le buffer restant
            if (buffer.trim()) {
              const lines = buffer.split("\n");
              for (const line of lines) {
                const chunk = parseSSELine(line);
                if (chunk) yield chunk;
              }
            }
            return; // Stream terminé normalement
          }

          lastChunkTime = Date.now();
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const chunk = parseSSELine(line);
            if (chunk) {
              heartbeatMissed = false;
              yield chunk;
            } else if (line.trim() === "" && !heartbeatMissed) {
              // Heartbeat SSE (ligne vide)
              heartbeatMissed = true;
            }
          }
        }
      } catch (readError) {
        // Erreur de lecture - tenter un retry si ce n'est pas un abort utilisateur
        if (userSignal?.aborted) throw readError;
        
        lastError = readError instanceof Error ? readError : new Error(String(readError));
        
        // Si c'est la dernière tentative, propager l'erreur
        if (attempt >= STREAM_CONFIG.MAX_RETRIES) {
          throw lastError;
        }
        
        // Sinon, attendre et retry
        await sleepWithBackoff(attempt);
        continue; // Retry
      } finally {
        reader.releaseLock();
      }
      
      // Si on arrive ici, le stream s'est terminé normalement
      return;
      
    } catch (fetchError) {
      // Erreur de fetch (réseau, timeout, etc.)
      if (userSignal?.aborted) throw fetchError;
      
      lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
      
      // Si c'est la dernière tentative, propager l'erreur
      if (attempt >= STREAM_CONFIG.MAX_RETRIES) {
        throw lastError;
      }
      
      // Sinon, attendre et retry
      await sleepWithBackoff(attempt);
    }
  }
  
  // Si on arrive ici, tous les retries ont échoué
  throw lastError || new Error("Streaming failed after all retries");
}

/**
 * Parse une ligne SSE et retourne le chunk ou null.
 */
function parseSSELine(line: string): ChatChunk | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  
  const payload = trimmed.slice(5).trim();
  if (payload === "[DONE]") return null;
  if (!payload) return null;
  
  try {
    const chunk = JSON.parse(payload) as ChatChunk & { error?: string };
    
    // Vérifier si le backend a retourné une erreur dans le chunk
    if (chunk.error) {
      throw new Error(`Backend error: ${chunk.error}`);
    }
    
    return chunk;
  } catch (err) {
    // Ignorer les lignes qui ne sont pas du JSON valide (logs, heartbeats, etc.)
    if (err instanceof Error && err.message.startsWith("Backend error:")) {
      throw err;
    }
    return null;
  }
}

/**
 * Résultat du streaming avec métadonnées.
 */
export interface StreamResult {
  text: string;
  done: boolean;
  error?: string;
  retryCount: number;
  durationMs: number;
}

/**
 * Helper robuste : concatène un stream en string complète.
 * Gère les erreurs avec callback onError pour affichage UI.
 */
export async function streamToText(
  req: ChatRequest,
  onDelta?: (delta: string, full: string) => void,
  onError?: (error: string, partialText: string) => void,
): Promise<string> {
  let full = "";
  let retryCount = 0;
  const startTime = Date.now();

  try {
    for await (const chunk of streamChat(req)) {
      const delta = chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        full += delta;
        onDelta?.(delta, full);
      }
    }
    return full;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    
    // Notifier l'erreur via callback
    onError?.(error, full);
    
    // Log pour debug
    console.error("[streamToText] Streaming error:", error);
    
    // Relancer pour que l'appelant puisse gérer
    throw err;
  }
}

/**
 * Streaming avec résilience maximale : retry automatique, 
 * détection de déconnexion, et récupération du texte partiel.
 */
export async function streamToTextResilient(
  req: ChatRequest,
  onDelta?: (delta: string, full: string) => void,
  onRetry?: (attempt: number, error: string) => void,
): Promise<StreamResult> {
  let full = "";
  let retryCount = 0;
  const startTime = Date.now();
  
  const makeRequest = async (attempt: number): Promise<string> => {
    try {
      // Créer un nouveau request avec le contexte accumulé
      const messages = [...req.messages];
      
      // Si on a déjà du texte, ajouter un message système pour continuer
      if (full && attempt > 0) {
        messages.push({
          role: "assistant",
          content: full,
        });
      }
      
      const result = await streamToText(
        { ...req, messages },
        (delta, current) => {
          full = current;
          onDelta?.(delta, current);
        },
        undefined // Pas d'onError ici, on gère nous-mêmes
      );
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      
      if (attempt < STREAM_CONFIG.MAX_RETRIES) {
        retryCount++;
        onRetry?.(attempt + 1, error);
        await sleepWithBackoff(attempt);
        return makeRequest(attempt + 1);
      }
      
      throw err;
    }
  };

  try {
    const finalText = await makeRequest(0);
    return {
      text: finalText,
      done: true,
      retryCount,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      text: full, // Retourner ce qu'on a pu récupérer
      done: false,
      error,
      retryCount,
      durationMs: Date.now() - startTime,
    };
  }
}
