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

export async function installGateway(): Promise<void> {
  await apiFetch<{ ok: boolean; status: string }>("/api/llm/install", { method: "POST" });
}

export async function getInstallStatus(): Promise<InstallStatus> {
  return apiFetch<InstallStatus>("/api/llm/install_status");
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
 * Streaming SSE. Yield de chunks au format OpenAI delta.
 * Respecte AbortSignal.
 */
export async function* streamChat(req: ChatRequest): AsyncGenerator<ChatChunk, void, void> {
  const { signal, ...body } = req;
  const response = await fetch(`${getBaseUrl()}/api/llm/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Stream error ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const chunk = JSON.parse(payload) as ChatChunk & { error?: string };
          if (chunk.error) throw new Error(chunk.error);
          yield chunk;
        } catch (err) {
          if (err instanceof Error && err.message) throw err;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Helper : concatene un stream en string complete.
 */
export async function streamToText(
  req: ChatRequest,
  onDelta?: (delta: string, full: string) => void,
): Promise<string> {
  let full = "";
  for await (const chunk of streamChat(req)) {
    const delta = chunk.choices?.[0]?.delta?.content ?? "";
    if (delta) {
      full += delta;
      onDelta?.(delta, full);
    }
  }
  return full;
}
