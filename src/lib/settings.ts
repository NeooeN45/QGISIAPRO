export type AiProvider = "google" | "local" | "openrouter" | "nvidia";
export type OpenRouterAgentMode = "single" | "multi";
export type OpenRouterExecutionMode = "draft" | "tools";
export type OpenRouterDataCollectionPolicy = "allow" | "deny";
export type ThemeMode = "dark" | "light" | "auto";

export interface AppSettings {
  apiKey: string;
  model: string;
  provider: AiProvider;
  localEndpoint: string;
  localModel: string;
  googleApiKey: string;
  googleModel: string;
  openrouterApiKey: string;
  openrouterEndpoint: string;
  openrouterAppName: string;
  openrouterReferer: string;
  openrouterProviderOrder: string[];
  openrouterAllowFallbacks: boolean;
  openrouterRequireParameters: boolean;
  openrouterDataCollection: OpenRouterDataCollectionPolicy;
  openrouterOnlyZdr: boolean;
  openrouterUseResponseHealing: boolean;
  openrouterAgentMode: OpenRouterAgentMode;
  openrouterExecutionMode: OpenRouterExecutionMode;
  openrouterUseRetriever: boolean;
  openrouterShowTrace: boolean;
  openrouterPlannerModel: string;
  openrouterDeepPlannerModel: string;
  openrouterReviewerModel: string;
  openrouterRetrieverModel: string;
  openrouterExecutorModel: string;
  nvidiaApiKey: string;
  nvidiaEndpoint: string;
  nvidiaModel: string;
  autoExecutePythonScripts: boolean;
  autoRepairPythonScripts: boolean;
  autoRepairMaxAttempts: number;
  theme: ThemeMode;
  // Paramètres de génération
  temperature: number;
  maxTokens: number;
  topP: number;
  streamingEnabled: boolean;
  // Paramètres avancés modèle local
  repeatPenalty: number;
  contextWindow: number;
  numGpu: number;
  keepAlive: string;
  systemPromptOverride: string;
}

export interface ModelPreset {
  id: string;
  label: string;
  description: string;
  category?: string;
  vram?: string;
  ramMinGb?: number;
  vramMinGb?: number;
  tags?: string[];
}

export interface OpenRouterStackPreset {
  id: "free" | "value" | "quality";
  label: string;
  badge: string;
  description: string;
  priceHint: string;
  plannerModel: string;
  deepPlannerModel: string;
  reviewerModel: string;
  retrieverModel: string;
  executorModel: string;
}

export interface SettingsValidationOptions {
  hasGeminiEnvKey?: boolean;
  hasOpenRouterEnvKey?: boolean;
}

export const DEFAULT_GOOGLE_MODEL = "gemini-2.5-flash";
export const DEFAULT_LOCAL_MODEL = "qwen3:4b-instruct-2507-q4_K_M";
export const DEFAULT_LOCAL_ENDPOINT = "http://localhost:11434/api/generate";
export const DEFAULT_OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1";
export const DEFAULT_OPENROUTER_APP_NAME = "GeoAI QGIS";
export const DEFAULT_OPENROUTER_PLANNER_MODEL = "qwen/qwen3-next-80b-a3b-instruct";
export const DEFAULT_OPENROUTER_DEEP_PLANNER_MODEL = "openai/gpt-oss-120b";
export const DEFAULT_OPENROUTER_REVIEWER_MODEL = "openai/gpt-oss-120b";
export const DEFAULT_OPENROUTER_RETRIEVER_MODEL =
  "nvidia/llama-nemotron-embed-vl-1b-v2:free";
export const DEFAULT_OPENROUTER_EXECUTOR_MODEL = "qwen/qwen3-coder-next";
export const DEFAULT_OPENROUTER_FREE_COMPAT_PLANNER_MODEL =
  "arcee-ai/trinity-large-preview:free";
export const DEFAULT_OPENROUTER_FREE_COMPAT_EXECUTOR_MODEL =
  "arcee-ai/trinity-mini:free";

export const DEFAULT_NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1";
export const DEFAULT_NVIDIA_MODEL =
  "nvidia/nemotron-3-super-120b-a12b";

const LEGACY_DEFAULT_GOOGLE_MODEL = DEFAULT_GOOGLE_MODEL;

export const GEMINI_MODEL_PRESETS: ModelPreset[] = [
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description: "Rapide et polyvalent — recommandé pour QGISAI+.",
    tags: ["recommandé"],
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    description: "Le plus économique, idéal pour les usages fréquents.",
    tags: ["économique"],
  },
  {
    id: "gemini-2.5-flash-thinking",
    label: "Gemini 2.5 Flash Thinking",
    description: "Raisonnement chaîné (CoT) — meilleur pour plans complexes multi-étapes.",
    tags: ["CoT", "nouveau"],
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Raisonnement profond, code complexe, 2M contexte.",
    tags: ["puissant"],
  },
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    description: "Génération précédente — stable et rapide.",
  },
  {
    id: "gemini-2.0-flash-lite",
    label: "Gemini 2.0 Flash-Lite",
    description: "Très léger, usage basique et économique.",
  },
  {
    id: "gemini-1.5-pro",
    label: "Gemini 1.5 Pro",
    description: "Long contexte (2M tokens), compatible function calling.",
    tags: ["long ctx"],
  },
];

export const LOCAL_MODEL_PRESETS: ModelPreset[] = [
  // ── Discussion libre (ultra-léger, conversation générale) ───────
  {
    id: "llama3.2:1b",
    label: "Llama 3.2 1B — Chat",
    description: "Ultra-compact Meta, idéal pour la discussion libre sur PC limité.",
    category: "lightweight",
    vram: "1 Go+",
    ramMinGb: 2,
    vramMinGb: 0,
    tags: ["ultra-léger", "libre"],
  },
  {
    id: "smollm2:1.7b",
    label: "SmolLM2 1.7B — Chat",
    description: "HuggingFace, très léger et rapide, parfait pour discuter librement.",
    category: "lightweight",
    vram: "1.5 Go+",
    ramMinGb: 3,
    vramMinGb: 0,
    tags: ["ultra-léger", "libre"],
  },
  {
    id: "gemma3:1b",
    label: "Gemma 3 1B — Chat",
    description: "Google Gemma 3 1B — minuscule et surprenant pour la conversation.",
    category: "lightweight",
    vram: "1 Go+",
    ramMinGb: 2,
    vramMinGb: 0,
    tags: ["ultra-léger", "libre", "nouveau"],
  },
  {
    id: "phi3.5:mini",
    label: "Phi 3.5 Mini — Chat",
    description: "Microsoft Phi 3.5 Mini — excellent suivi d'instructions, top pour dialogue.",
    category: "lightweight",
    vram: "2.5 Go+",
    ramMinGb: 4,
    vramMinGb: 0,
    tags: ["ultra-léger", "libre"],
  },
  {
    id: "aya:8b",
    label: "Aya 8B — Multilingue",
    description: "Cohere Aya — conçu pour la conversation multilingue dont le français.",
    category: "lightweight",
    vram: "5 Go+",
    ramMinGb: 7,
    vramMinGb: 5,
    tags: ["fr", "libre"],
  },
  {
    id: "mistral:7b-instruct-q4",
    label: "Mistral 7B Q4 — Chat",
    description: "Mistral 7B quantisé — très bon français, discussion fluide sur 6 Go.",
    category: "lightweight",
    vram: "4 Go+",
    ramMinGb: 6,
    vramMinGb: 4,
    tags: ["fr", "libre"],
  },
  // ── Ultra-léger (CPU only / ≤ 4 Go RAM) ────────────────────────
  {
    id: "gemma4:2b",
    label: "Gemma 4 2B",
    description: "Google Gemma 4 ultra-léger — multimodal, idéal pour PC ≤ 4 Go RAM.",
    category: "lightweight",
    vram: "2 Go+",
    ramMinGb: 3,
    vramMinGb: 2,
    tags: ["rapide", "nouveau"],
  },
  {
    id: "llama3.2:3b",
    label: "Llama 3.2 3B",
    description: "Meta, très léger, bon compromis vitesse/qualité pour PC modeste.",
    category: "lightweight",
    vram: "2 Go+",
    ramMinGb: 4,
    vramMinGb: 2,
    tags: ["rapide"],
  },
  {
    id: "phi3.5:3.8b",
    label: "Phi 3.5 Mini 3.8B",
    description: "Microsoft, excellent suivi d'instructions malgré sa petite taille.",
    category: "lightweight",
    vram: "3 Go+",
    ramMinGb: 5,
    vramMinGb: 3,
    tags: ["rapide"],
  },
  {
    id: DEFAULT_LOCAL_MODEL,
    label: "Qwen3 4B",
    description: "Léger et rapide, excellent suivi d'instructions en français.",
    category: "lightweight",
    vram: "3 Go+",
    ramMinGb: 4,
    vramMinGb: 3,
    tags: ["fr", "rapide"],
  },
  {
    id: "gemma4:4b",
    label: "Gemma 4 4B",
    description: "Google Gemma 4 multimodal, excellent suivi d'instructions complexes.",
    category: "lightweight",
    vram: "4 Go+",
    ramMinGb: 6,
    vramMinGb: 4,
    tags: ["rapide", "nouveau"],
  },
  {
    id: "gemma3:4b",
    label: "Gemma 3 4B",
    description: "Google Gemma 3 — polyvalent et stable pour les machines modestes.",
    category: "lightweight",
    vram: "4 Go+",
    ramMinGb: 6,
    vramMinGb: 4,
    tags: ["rapide"],
  },
  // ── Standard (6-12 Go RAM / 5-8 Go VRAM) ──────────────────────
  {
    id: "qwen3:8b",
    label: "Qwen3 8B",
    description: "Excellent raisonnement et français, meilleur modèle de la gamme 8B.",
    category: "standard",
    vram: "6 Go+",
    ramMinGb: 8,
    vramMinGb: 6,
    tags: ["fr"],
  },
  {
    id: "mistral:7b-instruct",
    label: "Mistral 7B Instruct",
    description: "Très bon en français, solide pour le dialogue GIS.",
    category: "standard",
    vram: "5 Go+",
    ramMinGb: 7,
    vramMinGb: 5,
    tags: ["fr"],
  },
  {
    id: "llama3.1:8b",
    label: "Llama 3.1 8B",
    description: "Meta, équilibré et fiable, excellente base généraliste.",
    category: "standard",
    vram: "6 Go+",
    ramMinGb: 8,
    vramMinGb: 6,
  },
  {
    id: "llama3.2:8b",
    label: "Llama 3.2 8B",
    description: "Meta dernière génération 8B — multimodal et polyvalent.",
    category: "standard",
    vram: "6 Go+",
    ramMinGb: 8,
    vramMinGb: 6,
    tags: ["nouveau"],
  },
  {
    id: "qwen2.5:7b",
    label: "Qwen2.5 7B",
    description: "Alibaba Qwen2.5 — excellent français et code sur 8 Go.",
    category: "standard",
    vram: "5 Go+",
    ramMinGb: 7,
    vramMinGb: 5,
    tags: ["fr"],
  },
  {
    id: "mistral-small:22b",
    label: "Mistral Small 22B",
    description: "Mistral Small 22B — qualité enterprise, bon compromis taille/perf.",
    category: "standard",
    vram: "14 Go+",
    ramMinGb: 16,
    vramMinGb: 14,
    tags: ["fr"],
  },
  {
    id: "mistral-nemo:12b",
    label: "Mistral Nemo 12B",
    description: "Mistral + NVIDIA, excellent en français et en code.",
    category: "standard",
    vram: "9 Go+",
    ramMinGb: 12,
    vramMinGb: 9,
    tags: ["fr"],
  },
  // ── Code & GIS (spécialisés) ──────────────────────────────────
  {
    id: "qwen2.5-coder:7b",
    label: "Qwen2.5 Coder 7B",
    description: "Spécialisé code et PyQGIS, excellent pour les scripts.",
    category: "code",
    vram: "5 Go+",
    ramMinGb: 7,
    vramMinGb: 5,
    tags: ["pyqgis"],
  },
  {
    id: "qwen2.5-coder:14b",
    label: "Qwen2.5 Coder 14B",
    description: "Version plus puissante du coder Qwen, meilleure pour les pipelines complexes.",
    category: "code",
    vram: "10 Go+",
    ramMinGb: 14,
    vramMinGb: 10,
    tags: ["pyqgis"],
  },
  {
    id: "codellama:7b",
    label: "Code Llama 7B",
    description: "Meta, spécialisé code Python, léger et efficace.",
    category: "code",
    vram: "5 Go+",
    ramMinGb: 7,
    vramMinGb: 5,
    tags: ["pyqgis"],
  },
  {
    id: "codellama:13b",
    label: "Code Llama 13B",
    description: "Meta, spécialisé code, bon pour Python et scripts QGIS.",
    category: "code",
    vram: "10 Go+",
    ramMinGb: 14,
    vramMinGb: 10,
    tags: ["pyqgis"],
  },
  {
    id: "deepseek-coder-v2:16b",
    label: "DeepSeek Coder V2 16B",
    description: "Le plus fort en code pur, demande 12+ Go VRAM.",
    category: "code",
    vram: "12 Go+",
    ramMinGb: 18,
    vramMinGb: 12,
    tags: ["pyqgis"],
  },
  {
    id: "devstral:24b",
    label: "Devstral 24B",
    description: "Mistral code, excellente architecture pour agents autonomes.",
    category: "code",
    vram: "16 Go+",
    ramMinGb: 24,
    vramMinGb: 16,
    tags: ["agent"],
  },
  // ── Raisonnement ──────────────────────────────────────────────
  {
    id: "deepseek-r1:7b",
    label: "DeepSeek R1 7B",
    description: "Raisonnement chaîné (CoT), idéal pour plans complexes.",
    category: "reasoning",
    vram: "5 Go+",
    ramMinGb: 8,
    vramMinGb: 5,
    tags: ["CoT"],
  },
  {
    id: "deepseek-r1:14b",
    label: "DeepSeek R1 14B",
    description: "Version plus puissante, meilleur raisonnement multi-étapes.",
    category: "reasoning",
    vram: "10 Go+",
    ramMinGb: 16,
    vramMinGb: 10,
    tags: ["CoT"],
  },
  {
    id: "deepseek-r1:32b",
    label: "DeepSeek R1 32B",
    description: "Raisonnement très avancé, comparable GPT-o1 sur benchmarks.",
    category: "reasoning",
    vram: "20 Go+",
    ramMinGb: 24,
    vramMinGb: 20,
    tags: ["CoT"],
  },
  {
    id: "qwq:32b",
    label: "QwQ 32B",
    description: "Raisonnement avancé type o1, nécessite beaucoup de VRAM.",
    category: "reasoning",
    vram: "20 Go+",
    ramMinGb: 32,
    vramMinGb: 20,
    tags: ["CoT"],
  },
  {
    id: "phi4-reasoning:14b",
    label: "Phi-4 Reasoning 14B",
    description: "Microsoft Phi-4 spécialisé raisonnement — efficace sur 12 Go.",
    category: "reasoning",
    vram: "10 Go+",
    ramMinGb: 14,
    vramMinGb: 10,
    tags: ["CoT", "nouveau"],
  },
  // ── Avancé (12+ Go VRAM) ─────────────────────────────────────
  {
    id: "phi4:14b",
    label: "Phi-4 14B",
    description: "Raisonnement avancé Microsoft, idéal si 12+ Go VRAM disponibles.",
    category: "advanced",
    vram: "10 Go+",
    ramMinGb: 14,
    vramMinGb: 10,
  },
  {
    id: "gemma2:9b",
    label: "Gemma 2 9B",
    description: "Google Gemma 2 — excellent compromis qualité/ressources, performant.",
    category: "standard",
    vram: "6 Go+",
    ramMinGb: 12,
    vramMinGb: 6,
    tags: ["nouveau", "recommande"],
  },
  {
    id: "gemma2:4b",
    label: "Gemma 2 4B",
    description: "Google Gemma 2 — standard équilibré, qualité et vitesse optimales.",
    category: "standard",
    vram: "4 Go+",
    ramMinGb: 8,
    vramMinGb: 4,
    tags: ["nouveau", "recommande"],
  },
  {
    id: "gemma2:27b",
    label: "Gemma 2 27B",
    description: "Google Gemma 2 — très bon suivi d'instructions complexes, raisonnement.",
    category: "advanced",
    vram: "16 Go+",
    ramMinGb: 32,
    vramMinGb: 16,
    tags: ["nouveau", "lourd"],
  },
  {
    id: "gemma3:12b",
    label: "Gemma 3 12B",
    description: "Google Gemma 3 — polyvalent, excellent suivi d'instructions.",
    category: "advanced",
    vram: "9 Go+",
    ramMinGb: 12,
    vramMinGb: 9,
  },
  {
    id: "qwen3:14b",
    label: "Qwen3 14B",
    description: "Excellente qualité générale pour machines bien équipées.",
    category: "advanced",
    vram: "10 Go+",
    ramMinGb: 14,
    vramMinGb: 10,
    tags: ["fr"],
  },
  {
    id: "qwen2.5:14b",
    label: "Qwen2.5 14B",
    description: "Alibaba, très bon français, code et raisonnement sur 14 Go.",
    category: "advanced",
    vram: "10 Go+",
    ramMinGb: 14,
    vramMinGb: 10,
    tags: ["fr"],
  },
  {
    id: "deepseek-v3:8b",
    label: "DeepSeek V3 8B",
    description: "DeepSeek V3 distillé — qualité avancée sur machines 8 Go.",
    category: "advanced",
    vram: "6 Go+",
    ramMinGb: 10,
    vramMinGb: 6,
    tags: ["nouveau"],
  },
  {
    id: "llama3.3:70b",
    label: "Llama 3.3 70B",
    description: "Le meilleur open-source de Meta, nécessite une machine très puissante.",
    category: "advanced",
    vram: "40 Go+",
    ramMinGb: 48,
    vramMinGb: 40,
  },
  {
    id: "qwen3:30b-a3b",
    label: "Qwen3 30B MoE",
    description: "Architecture MoE, qualité 30B avec seulement 3B de paramètres actifs.",
    category: "advanced",
    vram: "20 Go+",
    ramMinGb: 20,
    vramMinGb: 20,
    tags: ["fr", "nouveau"],
  },
  {
    id: "gemma2:2b",
    label: "Gemma 2 2B",
    description: "Google Gemma 2 ultra-légère — réponses instantanées, peu gourmand.",
    category: "lightweight",
    vram: "3 Go+",
    ramMinGb: 4,
    vramMinGb: 3,
    tags: ["nouveau", "rapide"],
  },
];

/**
 * Modèles HuggingFace API disponibles (comme Gemma 4)
 * Ces modèles nécessitent une clé API HuggingFace
 */
export const NVIDIA_MODEL_PRESETS: ModelPreset[] = [
  {
    id: "nvidia/nemotron-3-super-120b-a12b",
    label: "Nemotron 3 Super 120B",
    description: "Cerveau generaliste NVIDIA — qualite + rapidite (510ms valide).",
    category: "advanced",
    tags: ["recommande", "nvidia"],
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b",
    label: "Nemotron 3 Ultra 550B",
    description: "Raisonnement spatial lourd — qualite maximale (~100s).",
    category: "advanced",
    tags: ["CoT", "nvidia"],
  },
  {
    id: "nvidia/nemotron-3-nano-30b-a3b",
    label: "Nemotron 3 Nano 30B",
    description: "Bon compromis qualite/cout, free tier.",
    category: "standard",
    tags: ["nvidia", "gratuit"],
  },
  {
    id: "nvidia/nemotron-mini-4b-instruct",
    label: "Nemotron Mini 4B",
    description: "Routage d'intention ultra-rapide (181ms valide).",
    category: "lightweight",
    tags: ["rapide", "nvidia", "gratuit"],
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    label: "Nemotron 3 Omni 30B",
    description: "Vision SIG generale — omni-modal (399ms valide).",
    category: "standard",
    tags: ["vision", "nvidia", "gratuit"],
  },
  {
    id: "qwen/qwen3-coder-480b-a35b-instruct",
    label: "Qwen3 Coder 480B (NVIDIA)",
    description: "Generation de code PyQGIS — agentique (9.5s valide).",
    category: "code",
    tags: ["pyqgis", "nvidia"],
  },
  {
    id: "meta/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B (NVIDIA)",
    description: "Meta via NIM — generaliste fiable.",
    category: "standard",
    tags: ["nvidia", "gratuit"],
  },
  {
    id: "meta/llama-3.2-90b-vision-instruct",
    label: "Llama 3.2 90B Vision (NVIDIA)",
    description: "Vision haute qualite via NIM.",
    category: "advanced",
    tags: ["vision", "nvidia", "gratuit"],
  },
  {
    id: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
    label: "Nemotron Nano VL 8B",
    description: "Documents, legendes, PDF — rapide (253ms valide).",
    category: "lightweight",
    tags: ["vision", "nvidia", "gratuit"],
  },
  {
    id: "mistralai/mistral-large-3-675b-instruct-2512",
    label: "Mistral Large 3 675B (NVIDIA)",
    description: "Extraction JSON structuree — fiable.",
    category: "advanced",
    tags: ["nvidia"],
  },
];

export const HUGGINGFACE_MODEL_PRESETS = [
  {
    id: "google/gemma-4-4b-it",
    label: "Gemma 4 4B (HF)",
    description: "Gemma 4 via HuggingFace API — Multimodal, testez la variante 4B !",
    category: "huggingface",
    vram: "API Cloud",
    ramMinGb: 0,
    vramMinGb: 0,
    tags: ["gemma4", "multimodal", "api"],
  },
  {
    id: "google/gemma-4-9b-it",
    label: "Gemma 4 9B (HF)",
    description: "Gemma 4 via HuggingFace API — Version standard 9B.",
    category: "huggingface",
    vram: "API Cloud",
    ramMinGb: 0,
    vramMinGb: 0,
    tags: ["gemma4", "multimodal", "api"],
  },
  {
    id: "google/gemma-4-12b-it",
    label: "Gemma 4 12B (HF)",
    description: "Gemma 4 via HuggingFace API — Version avancée 12B.",
    category: "huggingface",
    vram: "API Cloud",
    ramMinGb: 0,
    vramMinGb: 0,
    tags: ["gemma4", "multimodal", "api"],
  },
  {
    id: "google/gemma-4-27b-it",
    label: "Gemma 4 27B (HF)",
    description: "Gemma 4 via HuggingFace API — Version maximale 27B.",
    category: "huggingface",
    vram: "API Cloud",
    ramMinGb: 0,
    vramMinGb: 0,
    tags: ["gemma4", "multimodal", "api"],
  },
];

export const OPENROUTER_ROLE_PRESETS = {
  planner: [
    {
      id: "qwen/qwen3-next-80b-a3b-instruct",
      label: "Qwen3 Next 80B",
      description: "Excellent ratio prix / qualité pour le planning général.",
    },
    {
      id: "qwen/qwen3-next-80b-a3b-instruct:free",
      label: "Qwen3 Next 80B Free",
      description: "Version gratuite très solide pour planner sans coût.",
    },
    {
      id: "stepfun/step-3.5-flash:free",
      label: "Step 3.5 Flash",
      description: "Planificateur rapide avec long contexte.",
    },
    {
      id: "z-ai/glm-4.5-air:free",
      label: "GLM 4.5 Air Free",
      description: "Planner gratuit orienté agents avec mode raisonnement.",
    },
    {
      id: "arcee-ai/trinity-large-preview:free",
      label: "Trinity Large Preview Free",
      description: "Long contexte gratuit, bon pour prompts complexes.",
    },
    {
      id: "arcee-ai/trinity-mini:free",
      label: "Trinity Mini Free",
      description: "Planner gratuit plus stable quand les autres variantes free saturent.",
    },
    {
      id: "minimax/minimax-m2.5:free",
      label: "MiniMax M2.5",
      description: "Planificateur plus lourd pour workflows complexes.",
    },
  ],
  reviewer: [
    {
      id: "openai/gpt-oss-120b",
      label: "gpt-oss-120b",
      description: "Reviewer très fort et encore peu coûteux.",
    },
    {
      id: "openai/gpt-oss-120b:free",
      label: "gpt-oss-120b Free",
      description: "Très bon reviewer gratuit pour validation d'actions.",
    },
    {
      id: "openai/gpt-oss-20b",
      label: "gpt-oss-20b",
      description: "Reviewer économique et rapide.",
    },
    {
      id: "openai/gpt-oss-20b:free",
      label: "gpt-oss-20b Free",
      description: "Fallback reviewer gratuit à faible coût de latence.",
    },
    {
      id: "nvidia/nemotron-3-nano-30b-a3b:free",
      label: "Nemotron 3 Nano 30B",
      description: "Revieweur pour verifier risques et qualite.",
    },
    {
      id: "nvidia/nemotron-3-super-120b-a12b:free",
      label: "Nemotron 3 Super",
      description: "Contre-lecture plus large mais plus lente.",
    },
    {
      id: "arcee-ai/trinity-large-preview:free",
      label: "Trinity Large Preview Free",
      description: "Reviewer gratuit actuellement le plus compatible pour les plans JSON.",
    },
    {
      id: "arcee-ai/trinity-mini:free",
      label: "Trinity Mini Free",
      description: "Reviewer gratuit plus leger quand tu veux rester sur un stack stable.",
    },
  ],
  retriever: [
    {
      id: "nvidia/llama-nemotron-embed-vl-1b-v2:free",
      label: "Llama Nemotron Embed VL 1B V2",
      description: "Embeddings OpenRouter pour reranker le contexte.",
    },
  ],
  executor: [
    {
      id: "qwen/qwen3-coder-next",
      label: "Qwen3 Coder Next",
      description: "Meilleur choix valeur pour un agent codeur en production.",
    },
    {
      id: "qwen/qwen3-coder",
      label: "Qwen3 Coder 480B",
      description: "Qualité maximale pour code, outils et longues sessions.",
    },
    {
      id: "qwen/qwen3-coder:free",
      label: "Qwen3 Coder Free",
      description: "Version gratuite la plus intéressante pour l'exécution code.",
    },
    {
      id: "qwen/qwen3-next-80b-a3b-instruct",
      label: "Qwen3 Next 80B",
      description: "Bon exécuteur généraliste quand tu veux moins de spécialisation code.",
    },
    {
      id: "stepfun/step-3.5-flash:free",
      label: "Step 3.5 Flash",
      description: "Execution rapide avec outils QGIS quand disponible.",
    },
    {
      id: "nvidia/nemotron-3-super-120b-a12b:free",
      label: "Nemotron 3 Super",
      description: "Execution plus riche, utile pour analyses longues.",
    },
    {
      id: "minimax/minimax-m2.5:free",
      label: "MiniMax M2.5",
      description: "Execution generaliste en contexte logiciel.",
    },
    {
      id: "arcee-ai/trinity-mini:free",
      label: "Trinity Mini Free",
      description: "Executeur gratuit teste avec tool-calling et sortie finale exploitable.",
    },
  ],
} satisfies Record<string, ModelPreset[]>;

export const OPENROUTER_STACK_PRESETS: OpenRouterStackPreset[] = [
  {
    id: "free",
    label: "Gratuit",
    badge: "0 $",
    description: "Pile gratuite testee en conditions reelles, plus robuste que les variantes free les plus saturees.",
    priceHint: "gratuit",
    plannerModel: DEFAULT_OPENROUTER_FREE_COMPAT_PLANNER_MODEL,
    deepPlannerModel: DEFAULT_OPENROUTER_FREE_COMPAT_PLANNER_MODEL,
    reviewerModel: DEFAULT_OPENROUTER_FREE_COMPAT_PLANNER_MODEL,
    retrieverModel: "nvidia/llama-nemotron-embed-vl-1b-v2:free",
    executorModel: DEFAULT_OPENROUTER_FREE_COMPAT_EXECUTOR_MODEL,
  },
  {
    id: "value",
    label: "Valeur",
    badge: "€",
    description: "Le meilleur compromis coût / qualité pour un GeoAI agentique quotidien.",
    priceHint: "faible coût",
    plannerModel: "qwen/qwen3-next-80b-a3b-instruct",
    deepPlannerModel: "openai/gpt-oss-120b",
    reviewerModel: "openai/gpt-oss-120b",
    retrieverModel: "nvidia/llama-nemotron-embed-vl-1b-v2:free",
    executorModel: "qwen/qwen3-coder-next",
  },
  {
    id: "quality",
    label: "Qualité",
    badge: "€€",
    description: "Plus cher, mais meilleur sur exécution code et robustesse des sorties.",
    priceHint: "coût modéré",
    plannerModel: "qwen/qwen3-next-80b-a3b-instruct",
    deepPlannerModel: "openai/gpt-oss-120b",
    reviewerModel: "openai/gpt-oss-120b",
    retrieverModel: "nvidia/llama-nemotron-embed-vl-1b-v2:free",
    executorModel: "qwen/qwen3-coder",
  },
];

export const DEFAULT_OPENROUTER_STACK_PRESET_ID: OpenRouterStackPreset["id"] = "value";

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  model: DEFAULT_LOCAL_MODEL,
  provider: "local",
  localEndpoint: DEFAULT_LOCAL_ENDPOINT,
  localModel: DEFAULT_LOCAL_MODEL,
  googleApiKey: "",
  googleModel: DEFAULT_GOOGLE_MODEL,
  openrouterApiKey: "",
  openrouterEndpoint: DEFAULT_OPENROUTER_ENDPOINT,
  openrouterAppName: DEFAULT_OPENROUTER_APP_NAME,
  openrouterReferer: "",
  openrouterProviderOrder: [],
  openrouterAllowFallbacks: true,
  openrouterRequireParameters: false,
  openrouterDataCollection: "allow",
  openrouterOnlyZdr: false,
  openrouterUseResponseHealing: true,
  openrouterAgentMode: "multi",
  openrouterExecutionMode: "tools",
  openrouterUseRetriever: true,
  openrouterShowTrace: false,
  openrouterPlannerModel: DEFAULT_OPENROUTER_PLANNER_MODEL,
  openrouterDeepPlannerModel: DEFAULT_OPENROUTER_DEEP_PLANNER_MODEL,
  openrouterReviewerModel: DEFAULT_OPENROUTER_REVIEWER_MODEL,
  openrouterRetrieverModel: DEFAULT_OPENROUTER_RETRIEVER_MODEL,
  openrouterExecutorModel: DEFAULT_OPENROUTER_EXECUTOR_MODEL,
  autoExecutePythonScripts: true,
  autoRepairPythonScripts: true,
  autoRepairMaxAttempts: 2,
  theme: "dark",
  temperature: 0.7,
  maxTokens: 8192,
  topP: 0.95,
  streamingEnabled: true,
  repeatPenalty: 1.1,
  contextWindow: 0, // 0 signifie "Auto" selon la RAM du PC
  numGpu: -1, // -1 signifie "Auto" pour Ollama
  keepAlive: "1h",
  systemPromptOverride: "",
  nvidiaApiKey: "",
  nvidiaEndpoint: DEFAULT_NVIDIA_ENDPOINT,
  nvidiaModel: DEFAULT_NVIDIA_MODEL,
};

function toProvider(value: string | null): AiProvider | undefined {
  if (value === "google" || value === "local" || value === "openrouter" || value === "nvidia") {
    return value;
  }

  return undefined;
}

function selectModelForProvider(
  provider: AiProvider,
  settings: Pick<
    AppSettings,
    "googleModel" | "localModel" | "openrouterExecutorModel" | "nvidiaModel"
  >,
): string {
  if (provider === "google") {
    return settings.googleModel;
  }

  if (provider === "openrouter") {
    return settings.openrouterExecutorModel;
  }

  if (provider === "nvidia") {
    return settings.nvidiaModel;
  }

  return settings.localModel;
}

function selectApiKeyForProvider(
  provider: AiProvider,
  settings: Pick<AppSettings, "googleApiKey" | "openrouterApiKey" | "nvidiaApiKey">,
): string {
  if (provider === "google") {
    return settings.googleApiKey;
  }

  if (provider === "openrouter") {
    return settings.openrouterApiKey;
  }

  if (provider === "nvidia") {
    return settings.nvidiaApiKey;
  }

  return "";
}

function normalizeProviderOrder(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry, index, list) => entry.length > 0 && list.indexOf(entry) === index);
}

function loadSettingsFromUrl(): Partial<AppSettings> {
  if (typeof window === "undefined") {
    return {};
  }

  const params = new URLSearchParams(window.location.search);
  const provider = toProvider(params.get("provider"));
  const model = params.get("model")?.trim() || undefined;
  const endpoint = params.get("endpoint")?.trim() || undefined;
  const baseUrl = params.get("baseUrl")?.trim() || undefined;

  const overrides: Partial<AppSettings> = {};
  if (provider) {
    overrides.provider = provider;
  }

  if (provider === "google" && model) {
    overrides.googleModel = model;
  }

  if (provider === "local" && model) {
    overrides.localModel = model;
  }

  if (provider === "openrouter" && model) {
    overrides.openrouterExecutorModel = model;
  }

  if (provider === "local" && endpoint) {
    overrides.localEndpoint = endpoint;
  }

  if (provider === "openrouter" && (endpoint || baseUrl)) {
    overrides.openrouterEndpoint = endpoint || baseUrl;
  }

  if (provider === "nvidia" && model) {
    overrides.nvidiaModel = model;
  }

  return overrides;
}

// ─── Validation de format des clés ───────────────────────────────────────────
export type ApiKeyStatus = "valid" | "invalid_format" | "empty";

export function validateGeminiKeyFormat(key: string): ApiKeyStatus {
  if (!key.trim()) return "empty";
  // Les clés Gemini font en général 39 caractères, commencent par "AIza"
  return /^AIza[0-9A-Za-z_-]{35}$/.test(key.trim()) ? "valid" : "invalid_format";
}

export function validateOpenRouterKeyFormat(key: string): ApiKeyStatus {
  if (!key.trim()) return "empty";
  // Les clés OpenRouter commencent par "sk-or-v1-" ou "sk-or-"
  return /^sk-or(-v1)?-[0-9a-fA-F]{64}$/.test(key.trim()) ? "valid" : "invalid_format";
}

export function validateNvidiaKeyFormat(key: string): ApiKeyStatus {
  if (!key.trim()) return "empty";
  // Les clés NVIDIA NIM commencent par "nvapi-"
  return /^nvapi-[a-zA-Z0-9_-]{30,}$/.test(key.trim()) ? "valid" : "invalid_format";
}

export function getConfiguredGeminiApiKey(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return (env.VITE_GEMINI_API_KEY || "").trim();
}

export function hasConfiguredGeminiApiKey(): boolean {
  return getConfiguredGeminiApiKey().length > 0;
}

export function getConfiguredOpenRouterApiKey(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return (env.VITE_OPENROUTER_API_KEY || "").trim();
}

export function hasConfiguredOpenRouterApiKey(): boolean {
  return getConfiguredOpenRouterApiKey().length > 0;
}

export function getConfiguredNvidiaApiKey(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return (env.VITE_NVIDIA_API_KEY || "").trim();
}

export function hasConfiguredNvidiaApiKey(): boolean {
  return getConfiguredNvidiaApiKey().length > 0;
}

export function getActiveModel(settings: AppSettings): string {
  return selectModelForProvider(settings.provider, settings);
}

export function getOpenRouterStackPresetId(
  settings: Pick<
    AppSettings,
    | "openrouterPlannerModel"
    | "openrouterDeepPlannerModel"
    | "openrouterReviewerModel"
    | "openrouterRetrieverModel"
    | "openrouterExecutorModel"
  >,
): OpenRouterStackPreset["id"] | null {
  const matchedPreset = OPENROUTER_STACK_PRESETS.find(
    (preset) =>
      preset.plannerModel === settings.openrouterPlannerModel &&
      preset.deepPlannerModel === settings.openrouterDeepPlannerModel &&
      preset.reviewerModel === settings.openrouterReviewerModel &&
      preset.retrieverModel === settings.openrouterRetrieverModel &&
      preset.executorModel === settings.openrouterExecutorModel,
  );

  return matchedPreset?.id || null;
}

export function applyOpenRouterStackPreset(
  current: AppSettings,
  presetId: OpenRouterStackPreset["id"],
): AppSettings {
  const preset = OPENROUTER_STACK_PRESETS.find((entry) => entry.id === presetId);
  if (!preset) {
    return current;
  }

  return normalizeSettings({
    ...current,
    openrouterPlannerModel: preset.plannerModel,
    openrouterDeepPlannerModel: preset.deepPlannerModel,
    openrouterReviewerModel: preset.reviewerModel,
    openrouterRetrieverModel: preset.retrieverModel,
    openrouterExecutorModel: preset.executorModel,
  });
}

export function normalizeSettings(input: AppSettings): AppSettings {
  const provider = input.provider;
  const googleApiKey = (
    input.googleApiKey ||
    (provider === "google" ? input.apiKey : "") ||
    ""
  ).trim();
  const googleModel = (input.googleModel || DEFAULT_GOOGLE_MODEL).trim();
  const localModel =
    (input.localModel || (provider === "local" ? input.model : "") || DEFAULT_LOCAL_MODEL)
      .trim();
  const localEndpoint = (input.localEndpoint || DEFAULT_LOCAL_ENDPOINT).trim();
  const openrouterApiKey = (
    input.openrouterApiKey ||
    (provider === "openrouter" ? input.apiKey : "") ||
    ""
  ).trim();
  const openrouterEndpoint =
    (input.openrouterEndpoint || DEFAULT_OPENROUTER_ENDPOINT).trim();
  const openrouterPlannerModel =
    (input.openrouterPlannerModel || DEFAULT_OPENROUTER_PLANNER_MODEL).trim();
  const openrouterDeepPlannerModel =
    (input.openrouterDeepPlannerModel || DEFAULT_OPENROUTER_DEEP_PLANNER_MODEL).trim();
  const openrouterReviewerModel =
    (input.openrouterReviewerModel || DEFAULT_OPENROUTER_REVIEWER_MODEL).trim();
  const openrouterRetrieverModel =
    (input.openrouterRetrieverModel || DEFAULT_OPENROUTER_RETRIEVER_MODEL).trim();
  const openrouterExecutorModel =
    (
      input.openrouterExecutorModel ||
      (provider === "openrouter" ? input.model : "") ||
      DEFAULT_OPENROUTER_EXECUTOR_MODEL
    ).trim();
  const nvidiaApiKey = (
    input.nvidiaApiKey ||
    (provider === "nvidia" ? input.apiKey : "") ||
    ""
  ).trim();
  const nvidiaModel = (input.nvidiaModel || (provider === "nvidia" ? input.model : "") || DEFAULT_NVIDIA_MODEL).trim();
  const nvidiaEndpoint = (input.nvidiaEndpoint || DEFAULT_NVIDIA_ENDPOINT).trim();

  const normalized: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...input,
    provider,
    apiKey: selectApiKeyForProvider(provider, {
      googleApiKey,
      openrouterApiKey,
      nvidiaApiKey,
    }),
    model: selectModelForProvider(provider, {
      googleModel,
      localModel,
      openrouterExecutorModel,
      nvidiaModel,
    }),
    nvidiaApiKey,
    nvidiaEndpoint,
    nvidiaModel,
    localEndpoint,
    localModel,
    googleApiKey,
    googleModel,
    openrouterApiKey,
    openrouterEndpoint,
    openrouterAppName: (input.openrouterAppName || DEFAULT_OPENROUTER_APP_NAME).trim(),
    openrouterReferer: (input.openrouterReferer || "").trim(),
    openrouterProviderOrder: normalizeProviderOrder(input.openrouterProviderOrder),
    openrouterAllowFallbacks:
      input.openrouterAllowFallbacks !== undefined
        ? Boolean(input.openrouterAllowFallbacks)
        : true,
    openrouterRequireParameters: Boolean(input.openrouterRequireParameters),
    openrouterDataCollection:
      input.openrouterDataCollection === "deny" ? "deny" : "allow",
    openrouterOnlyZdr: Boolean(input.openrouterOnlyZdr),
    openrouterUseResponseHealing:
      input.openrouterUseResponseHealing !== undefined
        ? Boolean(input.openrouterUseResponseHealing)
        : true,
    openrouterAgentMode:
      input.openrouterAgentMode === "single" ? "single" : "multi",
    openrouterExecutionMode:
      input.openrouterExecutionMode === "draft" ? "draft" : "tools",
    openrouterUseRetriever: Boolean(input.openrouterUseRetriever),
    openrouterShowTrace: Boolean(input.openrouterShowTrace),
    openrouterPlannerModel,
    openrouterDeepPlannerModel,
    openrouterReviewerModel,
    openrouterRetrieverModel,
    openrouterExecutorModel,
    autoExecutePythonScripts:
      input.autoExecutePythonScripts !== undefined
        ? Boolean(input.autoExecutePythonScripts)
        : DEFAULT_SETTINGS.autoExecutePythonScripts,
    autoRepairPythonScripts:
      input.autoRepairPythonScripts !== undefined
        ? Boolean(input.autoRepairPythonScripts)
        : DEFAULT_SETTINGS.autoRepairPythonScripts,
    autoRepairMaxAttempts: Math.max(
      0,
      Math.min(
        typeof input.autoRepairMaxAttempts === "number"
          ? Math.round(input.autoRepairMaxAttempts)
          : DEFAULT_SETTINGS.autoRepairMaxAttempts,
        4,
      ),
    ),
    theme:
      input.theme === "dark" || input.theme === "light" || input.theme === "auto"
        ? input.theme
        : DEFAULT_SETTINGS.theme,
    temperature: typeof input.temperature === "number"
      ? Math.max(0, Math.min(2, input.temperature))
      : DEFAULT_SETTINGS.temperature,
    maxTokens: typeof input.maxTokens === "number"
      ? Math.max(256, Math.min(65536, Math.round(input.maxTokens)))
      : DEFAULT_SETTINGS.maxTokens,
    topP: typeof input.topP === "number"
      ? Math.max(0.01, Math.min(1, input.topP))
      : DEFAULT_SETTINGS.topP,
    streamingEnabled: input.streamingEnabled !== undefined
      ? Boolean(input.streamingEnabled)
      : DEFAULT_SETTINGS.streamingEnabled,
    repeatPenalty: typeof input.repeatPenalty === "number"
      ? Math.max(0.5, Math.min(2, input.repeatPenalty))
      : DEFAULT_SETTINGS.repeatPenalty,
    contextWindow: typeof input.contextWindow === "number"
      ? (input.contextWindow === 0 ? 0 : Math.max(512, Math.min(131072, Math.round(input.contextWindow))))
      : DEFAULT_SETTINGS.contextWindow,
    numGpu: typeof input.numGpu === "number"
      ? Math.max(-1, Math.round(input.numGpu))
      : DEFAULT_SETTINGS.numGpu,
    keepAlive: typeof input.keepAlive === "string" && input.keepAlive.trim()
      ? input.keepAlive.trim()
      : DEFAULT_SETTINGS.keepAlive,
    systemPromptOverride: typeof input.systemPromptOverride === "string"
      ? input.systemPromptOverride
      : DEFAULT_SETTINGS.systemPromptOverride,
  };

  return normalized;
}

function shouldMigrateLegacyDefaults(parsed: Partial<AppSettings>): boolean {
  const provider = toProvider((parsed.provider as string) || null) || "google";
  const legacyApiKey =
    typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "";
  const googleApiKey =
    typeof parsed.googleApiKey === "string" ? parsed.googleApiKey.trim() : "";
  const legacyModel =
    typeof parsed.model === "string" ? parsed.model.trim() : LEGACY_DEFAULT_GOOGLE_MODEL;
  const googleModel =
    typeof parsed.googleModel === "string"
      ? parsed.googleModel.trim()
      : legacyModel;
  const localEndpoint =
    typeof parsed.localEndpoint === "string"
      ? parsed.localEndpoint.trim()
      : DEFAULT_LOCAL_ENDPOINT;

  return (
    provider === "google" &&
    legacyApiKey.length === 0 &&
    googleApiKey.length === 0 &&
    googleModel === LEGACY_DEFAULT_GOOGLE_MODEL &&
    localEndpoint === DEFAULT_LOCAL_ENDPOINT
  );
}

export function loadStoredSettings(storageKey = "geoai-settings"): AppSettings {
  const urlOverrides = loadSettingsFromUrl();

  try {
    const rawValue = localStorage.getItem(storageKey);
    if (!rawValue) {
      return normalizeSettings({
        ...DEFAULT_SETTINGS,
        ...urlOverrides,
      });
    }

    const parsed = JSON.parse(rawValue) as Partial<AppSettings>;
    const safeParsed = shouldMigrateLegacyDefaults(parsed) ? {} : parsed;
    const provider =
      urlOverrides.provider ||
      toProvider((safeParsed.provider as string) || null) ||
      DEFAULT_SETTINGS.provider;

    const mergedBeforeNormalize: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...safeParsed,
      ...urlOverrides,
      provider,
      googleApiKey:
        (urlOverrides.provider === "google"
          ? DEFAULT_SETTINGS.googleApiKey
          : undefined) ||
        safeParsed.googleApiKey ||
        (provider === "google" ? safeParsed.apiKey || "" : ""),
      googleModel:
        urlOverrides.googleModel ||
        safeParsed.googleModel ||
        (provider === "google" ? safeParsed.model || DEFAULT_GOOGLE_MODEL : DEFAULT_GOOGLE_MODEL),
      localModel:
        urlOverrides.localModel ||
        safeParsed.localModel ||
        (provider === "local" ? safeParsed.model || DEFAULT_LOCAL_MODEL : DEFAULT_LOCAL_MODEL),
      openrouterApiKey:
        safeParsed.openrouterApiKey ||
        (provider === "openrouter" ? safeParsed.apiKey || "" : ""),
      openrouterExecutorModel:
        urlOverrides.openrouterExecutorModel ||
        safeParsed.openrouterExecutorModel ||
        (provider === "openrouter"
          ? safeParsed.model || DEFAULT_OPENROUTER_EXECUTOR_MODEL
          : DEFAULT_OPENROUTER_EXECUTOR_MODEL),
      nvidiaApiKey:
        safeParsed.nvidiaApiKey ||
        (provider === "nvidia" ? safeParsed.apiKey || "" : ""),
      nvidiaModel:
        urlOverrides.nvidiaModel ||
        safeParsed.nvidiaModel ||
        (provider === "nvidia" ? safeParsed.model || DEFAULT_NVIDIA_MODEL : DEFAULT_NVIDIA_MODEL),
      nvidiaEndpoint:
        urlOverrides.nvidiaEndpoint ||
        safeParsed.nvidiaEndpoint ||
        DEFAULT_NVIDIA_ENDPOINT,
      localEndpoint:
        urlOverrides.localEndpoint ||
        safeParsed.localEndpoint ||
        DEFAULT_LOCAL_ENDPOINT,
      openrouterEndpoint:
        urlOverrides.openrouterEndpoint ||
        safeParsed.openrouterEndpoint ||
        DEFAULT_OPENROUTER_ENDPOINT,
      apiKey: typeof safeParsed.apiKey === "string" ? safeParsed.apiKey : "",
      model: typeof safeParsed.model === "string" ? safeParsed.model : DEFAULT_SETTINGS.model,
    };

    return normalizeSettings(mergedBeforeNormalize);
  } catch {
    return normalizeSettings({
      ...DEFAULT_SETTINGS,
      ...urlOverrides,
    });
  }
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateSettings(
  settings: AppSettings,
  options: SettingsValidationOptions = {},
): string[] {
  const issues: string[] = [];
  const normalized = normalizeSettings(settings);

  if (normalized.provider === "google") {
    if (!normalized.googleModel.trim()) {
      issues.push("Le modele Gemini est requis.");
    }

    if (!normalized.googleApiKey.trim() && !options.hasGeminiEnvKey) {
      issues.push("Ajoute une cle API Gemini ou configure VITE_GEMINI_API_KEY.");
    }
  }

  if (normalized.provider === "local") {
    if (!normalized.localModel.trim()) {
      issues.push("Le modele local est requis.");
    }

    if (!isValidHttpUrl(normalized.localEndpoint)) {
      issues.push("L'endpoint local doit etre une URL HTTP valide.");
    }
  }

  if (normalized.provider === "nvidia") {
    if (!normalized.nvidiaApiKey.trim() && !hasConfiguredNvidiaApiKey()) {
      issues.push("Ajoute une cle API NVIDIA ou configure VITE_NVIDIA_API_KEY.");
    }
    if (!normalized.nvidiaModel.trim()) {
      issues.push("Le modele NVIDIA est requis.");
    }
    if (!isValidHttpUrl(normalized.nvidiaEndpoint)) {
      issues.push("L'endpoint NVIDIA doit etre une URL HTTP valide.");
    }
  }

  if (normalized.provider === "openrouter") {
    if (!normalized.openrouterApiKey.trim() && !options.hasOpenRouterEnvKey) {
      issues.push(
        "Ajoute une cle API OpenRouter ou configure VITE_OPENROUTER_API_KEY.",
      );
    }

    if (!isValidHttpUrl(normalized.openrouterEndpoint)) {
      issues.push("L'endpoint OpenRouter doit etre une URL HTTP valide.");
    }

    if (!normalized.openrouterExecutorModel.trim()) {
      issues.push("Le modele executeur OpenRouter est requis.");
    }

    if (!normalized.openrouterPlannerModel.trim()) {
      issues.push("Le modele planner OpenRouter est requis.");
    }

    if (
      normalized.openrouterAgentMode === "multi" &&
      !normalized.openrouterReviewerModel.trim()
    ) {
      issues.push("Le modele reviewer OpenRouter est requis en mode multi-agent.");
    }

    if (
      normalized.openrouterAgentMode === "multi" &&
      normalized.openrouterUseRetriever &&
      !normalized.openrouterRetrieverModel.trim()
    ) {
      issues.push("Le modele retriever OpenRouter est requis quand le reranking est actif.");
    }
  }

  return issues;
}
