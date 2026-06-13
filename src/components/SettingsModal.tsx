import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FlaskConical,
  Info,
  KeyRound,
  Loader2,
  Package,
  RefreshCw,
  Save,
  Server,
  Settings as SettingsIcon,
  Sparkles,
  Trash2,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import OllamaSetupWizard from "./OllamaSetupWizard";
import { GatewaySettingsPanel } from "./GatewaySettingsPanel";
import { refreshCredentialsStatus, saveCredential } from "../lib/litellm-client";
import { toast } from "sonner";

import { cn } from "@/src/lib/utils";
import { getOllamaModels, pullOllamaModel, deleteOllamaModel, type PullProgress } from "../lib/ollama-auto-detect";

import {
  applyOpenRouterStackPreset,
  AppSettings,
  DEFAULT_OPENROUTER_STACK_PRESET_ID,
  DEFAULT_LOCAL_ENDPOINT,
  DEFAULT_LOCAL_MODEL,
  GEMINI_MODEL_PRESETS,
  getActiveModel,
  getConfiguredGeminiApiKey,
  getConfiguredNvidiaApiKey,
  getConfiguredOpenRouterApiKey,
  getOpenRouterStackPresetId,
  hasConfiguredGeminiApiKey,
  hasConfiguredNvidiaApiKey,
  hasConfiguredOpenRouterApiKey,
  LOCAL_MODEL_PRESETS,
  NVIDIA_MODEL_PRESETS,
  NVIDIA_AUTO_MODEL,
  normalizeSettings,
  OPENROUTER_ROLE_PRESETS,
  OPENROUTER_STACK_PRESETS,
  validateSettings,
  validateGeminiKeyFormat,
  validateNvidiaKeyFormat,
  validateOpenRouterKeyFormat,
  type ApiKeyStatus,
} from "../lib/settings";
import { fetchOpenRouterKeyInfo, OpenRouterKeyInfo } from "../lib/openrouter";
import {
  appendDebugEvent,
  clearDebugEvents,
  DebugEvent,
  formatDebugEventsForClipboard,
  getDebugUpdateEventName,
  loadDebugEvents,
} from "../lib/debug-log";
import {
  ModelProbeResult,
  probeActiveProvider,
  probeOpenRouterModel,
  probeQgisBridge,
} from "../lib/model-diagnostics";

import { safeLog } from "../lib/security";
import { getSystemSpecs } from "../lib/qgis";

interface SettingsModalProps {
  localSettings: AppSettings;
  onClose: () => void;
  onPasteApiKey: (target: "google" | "openrouter" | "nvidia") => void | Promise<void>;
  onReset: () => void;
  onSave: () => void;
  setLocalSettings: Dispatch<SetStateAction<AppSettings>>;
}

const GOOGLE_AI_STUDIO_URL = "https://aistudio.google.com/app/apikey";
const OPENROUTER_KEYS_URL = "https://openrouter.ai/keys";

function maskSecret(value: string): string {
  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return "•".repeat(value.length);
  }

  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function SecretInput({
  value,
  placeholder,
  visible,
  onChange,
  onPaste,
  onToggle,
  onBlur,
}: {
  value: string;
  placeholder: string;
  visible: boolean;
  onChange: (value: string) => void;
  onPaste: () => void;
  onToggle: () => void;
  onBlur?: () => void;
}) {
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-12 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-blue-500/35"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <button
        type="button"
        onClick={onPaste}
        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75 transition-all hover:bg-white/10 hover:text-white"
      >
        Coller
      </button>
    </div>
  );
}

function Toggle({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-start justify-between gap-4 rounded-2xl border p-4 text-left transition-all",
        checked
          ? "border-emerald-500/35 bg-emerald-500/10 text-white"
          : "border-white/10 bg-white/5 text-white/65 hover:bg-white/8",
      )}
    >
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-white/45">{description}</p>
      </div>
      <div
        className={cn(
          "mt-0.5 flex h-6 w-11 items-center rounded-full px-1 transition-all",
          checked ? "bg-emerald-500" : "bg-white/10",
        )}
      >
        <div
          className={cn(
            "h-4 w-4 rounded-full bg-white transition-all",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </div>
    </button>
  );
}

function RoleModelSection({
  description,
  onChange,
  presets,
  title,
  value,
}: {
  description: string;
  onChange: (value: string) => void;
  presets: Array<{ id: string; label: string; description: string }>;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Sparkles size={15} className="text-blue-300" />
        {title}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-white/45">{description}</p>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-4 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-blue-500/35"
      />
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
            className={cn(
              "rounded-2xl border p-3 text-left transition-all",
              value === preset.id
                ? "border-blue-500/35 bg-blue-500/12 text-white"
                : "border-white/10 bg-black/15 text-white/60 hover:bg-white/8",
            )}
          >
            <p className="text-sm font-semibold">{preset.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              {preset.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsModal({
  localSettings,
  onClose,
  onPasteApiKey,
  onReset,
  onSave,
  setLocalSettings,
}: SettingsModalProps) {
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [showNvidiaKey, setShowNvidiaKey] = useState(false);
  const [nvidiaKeyOnServer, setNvidiaKeyOnServer] = useState(false);
  const [activeTab, setActiveTab] = useState<"provider" | "gateway" | "config" | "execution" | "diagnostics">("provider");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const defaults = new Set<string>(["provider"]);
    const p = localSettings.provider;
    if (p === "google") defaults.add("google-config");
    if (p === "local") defaults.add("local-config");
    if (p === "openrouter") defaults.add("openrouter-config");
    if (p === "nvidia") defaults.add("nvidia-config");
    defaults.add("openrouter-stack");
    defaults.add("generation-params");
    defaults.add("config-summary");
    defaults.add("openrouter-key-status");
    defaults.add("diagnostics-tests");
    defaults.add("debug-logs");
    defaults.add("pyqgis-auto");
    return defaults;
  });
  // Présence de la clé NVIDIA côté plugin (QgsSettings) — persiste hors navigateur.
  useEffect(() => {
    let active = true;
    void refreshCredentialsStatus().then((configured) => {
      if (active) setNvidiaKeyOnServer(Boolean(configured.nvidia_nim));
    });
    return () => {
      active = false;
    };
  }, []);

  // openRouterModels remplacé par OPENROUTER_ROLE_PRESETS statiques (plus fiable)
  const [openRouterKeyInfo, setOpenRouterKeyInfo] = useState<OpenRouterKeyInfo | null>(null);
  const [isLoadingOpenRouterKeyInfo, setIsLoadingOpenRouterKeyInfo] = useState(false);
  const [openRouterKeyInfoError, setOpenRouterKeyInfoError] = useState<string | null>(null);
  const [openRouterKeyInfoUpdatedAt, setOpenRouterKeyInfoUpdatedAt] = useState<string | null>(
    null,
  );
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>(() => loadDebugEvents());
  const [probeResults, setProbeResults] = useState<Record<string, ModelProbeResult>>({});
  const [activeProbeId, setActiveProbeId] = useState<string | null>(null);
  const [showOllamaWizard, setShowOllamaWizard] = useState(false);
  const [logLevelFilter, setLogLevelFilter] = useState<"all" | "error" | "warning" | "info">("all");
  const [logSearch, setLogSearch] = useState("");

  // ── Specs système : fallback navigateur + vraies valeurs Python si QGIS connecté ──

  // Fallback navigateur (limité par confidentialité)
  let browserRamRaw = (navigator as unknown as Record<string, unknown>).deviceMemory as number | undefined;
  const browserCores = navigator.hardwareConcurrency || 4;
  
  // Si le navigateur plafonne à 8 mais qu'on a beaucoup de cœurs ou un gros GPU, on sait qu'on a plus de RAM
  if (browserRamRaw === 8) {
    if (browserCores >= 16) browserRamRaw = 32;
    else if (browserCores >= 8) browserRamRaw = 16;
  }

  // Lecture GPU via WebGL (heuristique)
  const webglGpu = (() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2", { powerPreference: "high-performance" }) || 
                 canvas.getContext("webgl", { powerPreference: "high-performance" });
      if (!gl) return { label: "", vram: 0 };
      const ext = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
      const raw = ext ? (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL) as string : "";
      const label = raw.replace(/\s*\(.*\)$/, "").trim();
      const vramMatch = /(\d+)\s*(?:GB|Go)/i.exec(raw);
      let vram = vramMatch ? parseInt(vramMatch[1], 10) : 0;
      if (!vram) {
        const r = raw.toUpperCase();
        // NVIDIA High-End
        if (r.includes("RTX 4090") || r.includes("RTX 3090") || r.includes("RX 7900 XTX")) vram = 24;
        else if (r.includes("RX 7900 XT")) vram = 20;
        else if (r.includes("RTX 4080") || r.includes("RTX 3080") || r.includes("RX 6800 XT") || r.includes("RX 7800")) vram = 16;
        else if (r.includes("RTX 4070") || r.includes("RTX 3060") || r.includes("RX 6700 XT")) vram = 12; // 3060 est souvent 12Go
        else if (r.includes("RTX 3080")) vram = 10;
        else if (r.includes("RTX 4060") || r.includes("RTX 3070") || r.includes("RX 6600") || r.includes("RX 7600")) vram = 8;
        else if (r.includes("RTX 3050 TI") || r.includes("RTX 3050 LAPTOP") || r.includes("RTX 3050 MOBILE")) vram = 4;
        else if (r.includes("RTX 3050") || r.includes("RTX 2060") || r.includes("GTX 1660") || r.includes("GTX 1060")) vram = 6;
        else if (r.includes("GTX 1650") || r.includes("GTX 1050 TI")) vram = 4;
        // AMD
        else if (r.includes("RADEON 7") || r.includes("VEGA 20")) vram = 16;
        // Apple M-series (Unified memory, we estimate based on typical base models)
        else if (r.includes("APPLE M3 MAX") || r.includes("APPLE M2 MAX")) vram = 36; // 36-128GB unified
        else if (r.includes("APPLE M3 PRO") || r.includes("APPLE M2 PRO")) vram = 18; // 18-36GB unified
        else if (r.includes("APPLE M3") || r.includes("APPLE M2") || r.includes("APPLE M1")) vram = 8; // 8-24GB unified
        // iGPU Intel/AMD
        else if (r.includes("INTEL") || r.includes("UHD") || r.includes("IRIS") || r.includes("RADEON GRAPHICS")) vram = 0;
      }
      return { label, vram };
    } catch { return { label: "", vram: 0 }; }
  })();

  // State des specs (combiné Python + navigateur)
  const [pcSpecs, setPcSpecs] = useState<{
    ramGb: number;
    ramAvailableGb: number;
    ramCapped: boolean;
    cores: number;
    coresFull: string;
    vramGb: number;
    gpuLabel: string;
    gpuCuda: boolean;
    source: "python" | "browser";
  }>(() => ({
    ramGb: browserRamRaw ?? 8,
    ramAvailableGb: 0,
    ramCapped: (browserRamRaw ?? 0) >= 8,
    cores: browserCores,
    coresFull: `${browserCores}`,
    vramGb: webglGpu.vram,
    gpuLabel: webglGpu.label,
    gpuCuda: false,
    source: "browser",
  }));

  // Charger les vraies specs Python + scan Ollama au montage du modal
  const refreshSpecs = useCallback(async () => {
    const specs = await getSystemSpecs();
    if (specs) {
      setPcSpecs({
        ramGb: specs.ram_total_gb,
        ramAvailableGb: specs.ram_available_gb,
        ramCapped: false,
        cores: specs.cpu_logical,
        coresFull: specs.cpu_physical > 0
          ? `${specs.cpu_logical} logiques / ${specs.cpu_physical} physiques`
          : `${specs.cpu_logical}`,
        vramGb: specs.gpu_vram_gb,
        gpuLabel: specs.gpu_name || webglGpu.label,
        gpuCuda: specs.gpu_has_cuda,
        source: "python",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refreshSpecs();
  }, [refreshSpecs]);

  // Auto-scan Ollama au montage
  useEffect(() => {
    void loadInstalledModels();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { ramGb: pcRamGb, ramAvailableGb: pcRamAvailableGb, ramCapped: pcRamCapped,
          cores: pcCores, coresFull: pcCoresFull, vramGb: pcVramGb,
          gpuLabel: pcGpuLabel, gpuCuda: pcGpuCuda, source: pcSpecsSource } = pcSpecs;

  // Classification globale du PC
  const pcTier: "high" | "mid" | "low" | "minimal" = (() => {
    if (pcRamGb >= 32 && (pcVramGb >= 12 || pcCores >= 16)) return "high";
    if (pcRamGb >= 16 && (pcVramGb >= 6 || pcCores >= 8)) return "mid";
    if (pcRamGb >= 8) return "low";
    return "minimal";
  })();

  const getModelCompat = (preset: { ramMinGb?: number; vramMinGb?: number }) => {
    const ramOk = !preset.ramMinGb || pcRamGb >= preset.ramMinGb;
    const ramWarn = !preset.ramMinGb || pcRamGb >= preset.ramMinGb * 0.7;
    const vramOk = !preset.vramMinGb || preset.vramMinGb === 0 || pcVramGb === 0 || pcVramGb >= preset.vramMinGb;
    const vramWarn = !preset.vramMinGb || preset.vramMinGb === 0 || pcVramGb === 0 || pcVramGb >= preset.vramMinGb * 0.7;
    if (ramOk && vramOk) return "ok";
    if (ramWarn && vramWarn) return "warn";
    return "bad";
  };

  // ── Gestion des modèles Ollama ───────────────────────────────────
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [isLoadingOllamaModels, setIsLoadingOllamaModels] = useState(false);
  const [installingModel, setInstallingModel] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<PullProgress | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  const [customModelInput, setCustomModelInput] = useState("");
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [modelFilters, setModelFilters] = useState<string[]>([]);
  const toggleModelFilter = (id: string) => {
    setModelFilters((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };
  const abortInstallRef = useRef<AbortController | null>(null);

  const loadInstalledModels = useCallback(async () => {
    setIsLoadingOllamaModels(true);
    try {
      const models = await getOllamaModels();
      setInstalledModels(models.map((m) => m.name));
    } catch {
      // Ollama not running — ignore
    } finally {
      setIsLoadingOllamaModels(false);
    }
  }, []);

  const handleInstallModel = useCallback(async (modelId: string) => {
    if (installingModel) return;
    setInstallingModel(modelId);
    setInstallProgress(null);
    setInstallError(null);
    const ctrl = new AbortController();
    abortInstallRef.current = ctrl;
    try {
      const result = await pullOllamaModel(
        modelId,
        (progress) => setInstallProgress(progress),
        ctrl.signal,
      );
      
      if (result.success) {
        setInstalledModels((prev) => Array.from(new Set([...prev, modelId])));
        setLocalSettings((current) => ({ ...current, localModel: modelId }));
        toast.success(`✅ Modèle ${modelId} installé et sélectionné`);
      } else {
        setInstallError(result.error || "Erreur inconnue lors de l'installation");
        toast.error(`❌ Erreur: ${result.error}`);
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        const msg = err instanceof Error ? err.message : String(err);
        setInstallError(msg);
        toast.error(`❌ Erreur: ${msg}`);
      }
    } finally {
      setInstallingModel(null);
      setInstallProgress(null);
      abortInstallRef.current = null;
    }
  }, [installingModel]);

  const handleDeleteModel = useCallback(async (modelName: string) => {
    if (deletingModel) return;
    setDeletingModel(modelName);
    try {
      const res = await deleteOllamaModel(modelName);
      if (res.success) {
        setInstalledModels((prev) => prev.filter((m) => m !== modelName));
        toast.success(`Modèle ${modelName} désinstallé`);
      } else {
        toast.error(`Erreur : ${res.error ?? "inconnu"}`);
      }
    } finally {
      setDeletingModel(null);
    }
  }, [deletingModel]);

  const isInstalled = useCallback((modelId: string) => {
    if (installedModels.includes(modelId)) return true;
    const [name, tag] = modelId.split(":");
    return installedModels.some((m) => {
      const [mName, mTag] = m.split(":");
      if (mName !== name) return false;
      if (!tag) return true; // preset sans tag = n'importe quelle version
      return mTag === tag || mTag?.startsWith(tag + "-"); // ex: "4b" match "4b-instruct-q4_K_M"
    });
  }, [installedModels]);

  const handleOllamaWizardComplete = (model: string) => {
    safeLog("[SettingsModal] Ollama wizard completed with model:", model);
    setLocalSettings((current) => ({
      ...current,
      localModel: model,
    }));
    setShowOllamaWizard(false);
    toast.success(`Modèle ${model} configuré avec succès`);
  };

  const normalizedLocalSettings = useMemo(
    () => normalizeSettings(localSettings),
    [localSettings],
  );
  const envGeminiApiKey = getConfiguredGeminiApiKey();
  const envOpenRouterApiKey = getConfiguredOpenRouterApiKey();
  const envNvidiaApiKey = getConfiguredNvidiaApiKey();
  const hasEnvGeminiApiKey = hasConfiguredGeminiApiKey();
  const hasEnvOpenRouterApiKey = hasConfiguredOpenRouterApiKey();
  const hasEnvNvidiaApiKey = hasConfiguredNvidiaApiKey();

  const settingsIssues = validateSettings(normalizedLocalSettings, {
    hasGeminiEnvKey: hasEnvGeminiApiKey,
    hasOpenRouterEnvKey: hasEnvOpenRouterApiKey,
  });
  const canSaveSettings = true; // Toujours permettre la sauvegarde, les issues sont des warnings
  const activeOpenRouterPresetId = getOpenRouterStackPresetId(normalizedLocalSettings);

  const googleKeySource = normalizedLocalSettings.googleApiKey
    ? "local"
    : hasEnvGeminiApiKey
      ? "env"
      : "missing";
  const openRouterKeySource = normalizedLocalSettings.openrouterApiKey
    ? "local"
    : hasEnvOpenRouterApiKey
      ? "env"
      : "missing";
  const nvidiaKeySource = normalizedLocalSettings.nvidiaApiKey
    ? "local"
    : hasEnvNvidiaApiKey
      ? "env"
      : "missing";

  const canLoadOpenRouterKeyInfo =
    normalizedLocalSettings.provider === "openrouter" &&
    (normalizedLocalSettings.openrouterApiKey.trim().length > 0 ||
      hasEnvOpenRouterApiKey);

  const refreshOpenRouterKeyInfo = useCallback(
    async (options?: { signal?: AbortSignal; silent?: boolean }) => {
      if (!canLoadOpenRouterKeyInfo) {
        setOpenRouterKeyInfo(null);
        setOpenRouterKeyInfoError(null);
        setOpenRouterKeyInfoUpdatedAt(null);
        setIsLoadingOpenRouterKeyInfo(false);
        return;
      }

      setIsLoadingOpenRouterKeyInfo(true);
      setOpenRouterKeyInfoError(null);

      try {
        const info = await fetchOpenRouterKeyInfo(
          normalizedLocalSettings,
          options?.signal,
        );
        setOpenRouterKeyInfo(info);
        setOpenRouterKeyInfoUpdatedAt(new Date().toISOString());
      } catch (error) {
        if (options?.signal?.aborted) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Impossible de lire l'état de la clé.";
        setOpenRouterKeyInfo(null);
        setOpenRouterKeyInfoError(message);
        if (!options?.silent) {
          appendDebugEvent({
            level: "error",
            source: "settings",
            title: "Lecture etat OpenRouter echouee",
            message,
          });
        }
      } finally {
        if (!options?.signal?.aborted) {
          setIsLoadingOpenRouterKeyInfo(false);
        }
      }
    },
    [canLoadOpenRouterKeyInfo, normalizedLocalSettings],
  );

  // Render functions for modular organization
  const renderProviderSection = () => (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/35">
        <Cpu size={12} />
        Fournisseur principal
      </label>
      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {renderProviderButton("local", "Local", "Ollama", "Exécution locale sans cloud.", "emerald")}
        {renderProviderButton("google", "Google", "Gemini", "IA générative Google.", "blue")}
        {renderProviderButton("openrouter", "OpenRouter", "Multi", "Stack multi-agent avancée.", "purple")}
        {renderProviderButton("nvidia", "NVIDIA NIM", "NIM", "Free tier 40 req/min — Nemotron, Llama, Qwen via NVIDIA.", "cyan")}
      </div>
    </div>
  );

  const handleProviderChange = (id: string) => {
    setLocalSettings((current) => ({ ...current, provider: id as any }));
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.delete("google-config");
      next.delete("local-config");
      next.delete("openrouter-config");
      next.delete("nvidia-config");
      if (id === "google") next.add("google-config");
      if (id === "local") next.add("local-config");
      if (id === "openrouter") next.add("openrouter-config");
      if (id === "nvidia") next.add("nvidia-config");
      return next;
    });
  };

  const renderProviderButton = (id: string, label: string, badge: string, description: string, color: string) => (
    <button
      type="button"
      onClick={() => handleProviderChange(id)}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300",
        normalizedLocalSettings.provider === id
          ? `border-${color}-500/50 bg-gradient-to-br from-${color}-500/20 to-${color}-600/10 text-white shadow-lg shadow-${color}-500/20`
          : "border-white/10 bg-black/15 text-white/60 hover:bg-white/8 hover:border-white/20",
      )}
    >
      {normalizedLocalSettings.provider === id && (
        <div className={`absolute inset-0 bg-gradient-to-r from-${color}-500/10 via-transparent to-transparent animate-pulse`} />
      )}
      <div className="relative flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className={cn(
          "text-[10px] uppercase tracking-[0.18em]",
          normalizedLocalSettings.provider === id ? `text-${color}-300` : `${color}-200/50`,
        )}>
          {badge}
        </span>
      </div>
      <p className="relative mt-2 text-xs leading-relaxed text-white/45">
        {description}
      </p>
      {normalizedLocalSettings.provider === id && (
        <div className="relative mt-3 flex items-center gap-1.5">
          <div className={`h-1.5 w-1.5 rounded-full bg-${color}-400 animate-pulse`} />
          <span className={`text-[10px] font-medium text-${color}-300`}>Actif</span>
        </div>
      )}
    </button>
  );

  const renderSettingsSection = (title: string, icon: React.ReactNode, children: React.ReactNode, className?: string) => (
    <div className={cn("rounded-3xl border border-white/10 bg-white/5 p-5", className)}>
      <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/35">
        {icon}
        {title}
      </label>
      <div className="mt-4 space-y-4">
        {children}
      </div>
    </div>
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const renderAccordionSection = (
    sectionId: string,
    title: string,
    icon: React.ReactNode,
    children: React.ReactNode,
    color: string = "white"
  ) => {
    const isExpanded = expandedSections.has(sectionId);
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(sectionId)}
          className="flex w-full items-center justify-between p-5 text-left transition-all hover:bg-white/5"
        >
          <div className="flex items-center gap-3">
            <div className={`rounded-xl bg-${color}-500/20 p-2 text-${color}-300`}>
              {icon}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="mt-0.5 text-xs text-white/50">
                {isExpanded ? "Cliquez pour masquer" : "Cliquez pour développer"}
              </p>
            </div>
          </div>
          <div className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
            <ChevronDown size={20} className="text-white/40" />
          </div>
        </button>
        {isExpanded && (
          <div className="border-t border-white/10 p-5 space-y-4">
            {children}
          </div>
        )}
      </div>
    );
  };

  const renderModelSelector = (
    currentValue: string,
    onChange: (value: string) => void,
    label: string,
    description: string,
    color: string,
    roleKey?: keyof typeof OPENROUTER_ROLE_PRESETS,
  ) => {
    const presets = roleKey ? OPENROUTER_ROLE_PRESETS[roleKey] : [];
    const isFree = (id: string) => id.endsWith(":free");
    const isCustom = presets.length > 0 && !presets.some((p) => p.id === currentValue);

    return (
      <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full bg-${color}-400`} />
          <p className="text-xs font-semibold text-white/90 uppercase tracking-wider">{label}</p>
        </div>
        <p className="text-xs text-white/45">{description}</p>

        {presets.length > 0 && (
          <div className="grid gap-1.5 md:grid-cols-2">
            {presets.map((preset) => {
              const selected = currentValue === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onChange(preset.id)}
                  className={cn(
                    "rounded-xl border p-2.5 text-left transition-all",
                    selected
                      ? `border-${color}-500/40 bg-${color}-500/12 text-white`
                      : "border-white/8 bg-black/15 text-white/55 hover:border-white/15 hover:bg-white/5",
                  )}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold leading-tight">{preset.label}</p>
                    {isFree(preset.id) && (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">GRATUIT</span>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-white/35">{preset.description}</p>
                </button>
              );
            })}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-[10px] font-medium text-white/40 uppercase tracking-wider">
            {isCustom ? "⚡ Modèle personnalisé actif" : "Ou saisir un identifiant OpenRouter"}
          </label>
          <input
            type="text"
            value={currentValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ex: anthropic/claude-3.5-sonnet"
            className={cn(
              "w-full rounded-xl border bg-black/20 px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-white/25",
              isCustom
                ? `border-${color}-500/40 focus:border-${color}-500/60`
                : "border-white/10 focus:border-white/25"
            )}
          />
        </div>
      </div>
    );
  };

  const geminiKeyStatus: ApiKeyStatus = normalizedLocalSettings.googleApiKey
    ? validateGeminiKeyFormat(normalizedLocalSettings.googleApiKey)
    : googleKeySource === "env" ? "valid" : "empty";

  const openrouterKeyStatus: ApiKeyStatus = normalizedLocalSettings.openrouterApiKey
    ? validateOpenRouterKeyFormat(normalizedLocalSettings.openrouterApiKey)
    : openRouterKeySource === "env" ? "valid" : "empty";

  const nvidiaKeyStatus: ApiKeyStatus = normalizedLocalSettings.nvidiaApiKey
    ? validateNvidiaKeyFormat(normalizedLocalSettings.nvidiaApiKey)
    : nvidiaKeySource === "env" ? "valid" : "empty";

  const renderKeyStatusBadge = (status: ApiKeyStatus) => {
    if (status === "valid") return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
        <CheckCircle2 size={10} /> Format OK
      </span>
    );
    if (status === "invalid_format") return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
        ⚠ Format incorrect
      </span>
    );
    return null;
  };

  const renderGoogleApiKeySection = () => (
    <div className="rounded-3xl border border-blue-500/20 bg-blue-500/6 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <KeyRound size={16} className="text-blue-300" />
            Clé Gemini
            {renderKeyStatusBadge(geminiKeyStatus)}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-white/50">
            Source:{" "}
            <strong className="text-white">
              {googleKeySource === "local" ? "clé locale" : googleKeySource === "env" ? "variable d'environnement" : "non configurée"}
            </strong>
            {" — "}
            <span className="text-white/40">Stockée chiffrée en localStorage</span>
          </p>
        </div>
        <a
          href={GOOGLE_AI_STUDIO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-100 transition-all hover:bg-blue-500/16"
        >
          AI Studio
          <ExternalLink size={13} />
        </a>
      </div>
      <div className="mt-4">
        <SecretInput
          value={normalizedLocalSettings.googleApiKey}
          placeholder={
            googleKeySource === "env"
              ? maskSecret(envGeminiApiKey)
              : "AIza... (clé Google AI Studio)"
          }
          visible={showGoogleKey}
          onChange={(value) =>
            setLocalSettings((current) => ({
              ...current,
              googleApiKey: value,
            }))
          }
          onPaste={() => void onPasteApiKey("google")}
          onToggle={() => setShowGoogleKey((current) => !current)}
        />
      </div>
      <div className="mt-4">
        <label className="mb-2 block text-xs font-medium text-white/70">
          Modèle Gemini
        </label>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {GEMINI_MODEL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                setLocalSettings((current) => ({
                  ...current,
                  googleModel: preset.id,
                  model:
                    normalizeSettings({
                      ...current,
                      googleModel: preset.id,
                    }).provider === "google"
                      ? preset.id
                      : current.model,
                }))
              }
              className={cn(
                "rounded-2xl border p-4 text-left transition-all",
                normalizedLocalSettings.googleModel === preset.id
                  ? "border-blue-500/35 bg-blue-500/12 text-white"
                  : "border-white/10 bg-black/15 text-white/60 hover:bg-white/8",
              )}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold">{preset.label}</p>
                {preset.tags?.map(tag => (
                  <span key={tag} className="rounded-full border border-blue-500/25 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-blue-300 uppercase tracking-wide">{tag}</span>
                ))}
              </div>
              <p className="mt-1 text-xs text-white/45">{preset.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderNvidiaApiKeySection = () => (
    <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/6 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <KeyRound size={16} className="text-cyan-300" />
            Clé NVIDIA NIM
            {renderKeyStatusBadge(nvidiaKeyStatus)}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-white/50">
            Source:{" "}
            <strong className="text-white">
              {nvidiaKeySource === "local" ? "clé locale" : nvidiaKeySource === "env" ? "variable d'environnement" : "non configurée"}
            </strong>
            {" — "}
            <span className="text-white/40">Free tier 40 req/min via build.nvidia.com</span>
          </p>
        </div>
        <a
          href="https://build.nvidia.com/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition-all hover:bg-cyan-500/16"
        >
          Developer
          <ExternalLink size={13} />
        </a>
      </div>
      <div className="mt-4">
        <SecretInput
          value={normalizedLocalSettings.nvidiaApiKey}
          placeholder={
            nvidiaKeySource === "env"
              ? maskSecret(envNvidiaApiKey)
              : nvidiaKeyOnServer
                ? "•••• clé enregistrée côté plugin (laisser vide pour la garder)"
                : "nvapi-... (clé NVIDIA NIM)"
          }
          visible={showNvidiaKey}
          onChange={(value) =>
            setLocalSettings((current) => ({
              ...current,
              nvidiaApiKey: value,
            }))
          }
          onBlur={() => {
            const value = normalizedLocalSettings.nvidiaApiKey.trim();
            if (value) {
              void saveCredential("nvidia_nim", value).then(() => setNvidiaKeyOnServer(true));
            }
          }}
          onPaste={() => void onPasteApiKey("nvidia" as any)}
          onToggle={() => setShowNvidiaKey((current) => !current)}
        />
        {nvidiaKeyOnServer && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-400/80">
            <CheckCircle2 size={12} />
            Clé enregistrée côté plugin — conservée entre les sessions, même si ce champ est vide.
          </p>
        )}
      </div>
      <div className="mt-4">
        <label className="mb-2 block text-xs font-medium text-white/70">
          Modèle NVIDIA NIM
        </label>

        {/* Carte Auto : l'app choisit le modèle par tâche (intent-router). */}
        <button
          type="button"
          onClick={() =>
            setLocalSettings((current) => ({
              ...current,
              nvidiaModel: NVIDIA_AUTO_MODEL,
            }))
          }
          className={cn(
            "w-full rounded-2xl border p-4 text-left transition-all",
            (normalizedLocalSettings.nvidiaModel === NVIDIA_AUTO_MODEL ||
              !normalizedLocalSettings.nvidiaModel)
              ? "border-emerald-500/40 bg-emerald-500/12 text-white"
              : "border-white/10 bg-black/15 text-white/60 hover:bg-white/8",
          )}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">🧭 Auto — l'app choisit</p>
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300 uppercase tracking-wide">
              recommandé
            </span>
          </div>
          <p className="mt-1 text-xs text-white/45">
            L'intent-router sélectionne le meilleur modèle pour chaque tâche
            (raisonnement, vision, code PyQGIS, généraliste). Aucun choix nécessaire.
          </p>
        </button>

        <details className="mt-3 group">
          <summary className="cursor-pointer list-none text-xs font-medium text-white/45 hover:text-white/70 transition-colors">
            <span className="inline-flex items-center gap-1.5">
              <ChevronRight size={13} className="transition-transform group-open:rotate-90" />
              Avancé — forcer un modèle précis (override optionnel)
            </span>
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
          {NVIDIA_MODEL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                setLocalSettings((current) => ({
                  ...current,
                  nvidiaModel: preset.id,
                  model:
                    normalizeSettings({
                      ...current,
                      nvidiaModel: preset.id,
                    }).provider === "nvidia"
                      ? preset.id
                      : current.model,
                }))
              }
              className={cn(
                "rounded-2xl border p-4 text-left transition-all",
                normalizedLocalSettings.nvidiaModel === preset.id
                  ? "border-cyan-500/35 bg-cyan-500/12 text-white"
                  : "border-white/10 bg-black/15 text-white/60 hover:bg-white/8",
              )}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold">{preset.label}</p>
                {preset.tags?.map(tag => (
                  <span key={tag} className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-300 uppercase tracking-wide">{tag}</span>
                ))}
              </div>
              <p className="mt-1 text-xs text-white/45">{preset.description}</p>
            </button>
          ))}
          </div>
        </details>
      </div>
    </div>
  );

  const renderSidebarNavigation = () => (
    <nav className="flex w-52 flex-col gap-1 border-r border-white/[0.06] bg-[#131314] p-3">
      {[
        { id: "provider" as const, label: "Provider", icon: Cpu, description: "Choisir le fournisseur IA" },
        { id: "gateway" as const, label: "Gateway IA", icon: Zap, description: "BYOK multi-providers unifié" },
        { id: "config" as const, label: "Configuration", icon: SettingsIcon, description: "Stack et modèles" },
        { id: "execution" as const, label: "Exécution", icon: Workflow, description: "Options d'exécution" },
        { id: "diagnostics" as const, label: "Diagnostics", icon: FlaskConical, description: "Logs et tests" },
      ].map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setActiveTab(tab.id)}
          className={cn(
            "flex items-start gap-3 rounded-xl p-3 text-left transition-all",
            activeTab === tab.id
              ? "bg-blue-500/15 text-white border border-blue-500/25"
              : "text-white/50 hover:bg-white/5 hover:text-white/70 border border-transparent",
          )}
          title={tab.description}
        >
          <tab.icon size={18} className={cn("mt-0.5", activeTab === tab.id ? "text-blue-300" : "")} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider">{tab.label}</p>
            <p className="mt-0.5 text-[10px] opacity-60 line-clamp-2">{tab.description}</p>
          </div>
          {activeTab === tab.id && (
            <div className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_8px_theme(colors.blue.400)]" />
          )}
        </button>
      ))}
    </nav>
  );

  const runProbe = useCallback(
    async (probeId: string, label: string, runner: () => Promise<ModelProbeResult>) => {
      setActiveProbeId(probeId);

      try {
        const result = await runner();
        setProbeResults((current) => ({
          ...current,
          [probeId]: result,
        }));

        appendDebugEvent({
          level: result.ok ? "success" : "warning",
          source: "diagnostic",
          title: label,
          message: `${result.provider} / ${result.model} en ${result.latencyMs} ms`,
          details: [result.preview, result.details].filter(Boolean).join("\n"),
        });

        if (result.ok) {
          toast.success(`${label} OK en ${result.latencyMs} ms`);
        } else {
          toast.error(result.preview);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Diagnostic indisponible.";
        const failureResult: ModelProbeResult = {
          checkedAt: new Date().toISOString(),
          endpoint:
            normalizedLocalSettings.provider === "openrouter"
              ? normalizedLocalSettings.openrouterEndpoint
              : normalizedLocalSettings.provider === "google"
                ? "https://generativelanguage.googleapis.com"
                : normalizedLocalSettings.localEndpoint,
          latencyMs: 0,
          model:
            normalizedLocalSettings.provider === "openrouter"
              ? normalizedLocalSettings.openrouterExecutorModel
              : normalizedLocalSettings.provider === "google"
                ? normalizedLocalSettings.googleModel
                : normalizedLocalSettings.localModel,
          ok: false,
          preview: message,
          provider: normalizedLocalSettings.provider,
        };

        setProbeResults((current) => ({
          ...current,
          [probeId]: failureResult,
        }));
        appendDebugEvent({
          level: "error",
          source: "diagnostic",
          title: label,
          message,
        });
        toast.error(message);
      } finally {
        setActiveProbeId(null);
      }
    },
    [normalizedLocalSettings],
  );

  useEffect(() => {
    const abortController = new AbortController();
    void refreshOpenRouterKeyInfo({
      signal: abortController.signal,
      silent: true,
    });

    const interval = window.setInterval(() => {
      void refreshOpenRouterKeyInfo({ silent: true });
    }, 60_000);

    return () => {
      abortController.abort();
      window.clearInterval(interval);
    };
  }, [refreshOpenRouterKeyInfo]);

  useEffect(() => {
    const syncDebugEvents = () => {
      setDebugEvents(loadDebugEvents());
    };

    syncDebugEvents();
    window.addEventListener(getDebugUpdateEventName(), syncDebugEvents);

    return () => {
      window.removeEventListener(getDebugUpdateEventName(), syncDebugEvents);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 20 }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-6xl overflow-hidden rounded-[32px] border border-gray-300/60 dark:border-white/10 bg-[#17181a] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-blue-500/20 via-purple-500/10 to-emerald-500/10 blur-md" />
              <div className="relative rounded-2xl bg-blue-500/20 p-2.5 text-blue-300">
                <SettingsIcon size={20} />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Paramètres IA</h3>
              <p className="text-xs text-white/45">
                Provider principal, stack multi-agent OpenRouter et exécution locale.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/45 transition-all hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex">
          {renderSidebarNavigation()}
          <div className="flex-1 max-h-[78vh] overflow-y-auto p-6 chat-scrollbar">
          {activeTab === "provider" && (
            <div className="space-y-4">
              {/* Section Provider - Toujours visible */}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/35">
                  <Cpu size={12} />
                  Fournisseur principal
                </label>
                <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  {renderProviderButton("local", "Local", "Ollama", "Exécution locale sans cloud.", "emerald")}
                  {renderProviderButton("google", "Google", "Gemini", "IA générative Google.", "blue")}
                  {renderProviderButton("openrouter", "OpenRouter", "Multi", "Stack multi-agent avancée.", "purple")}
                  {renderProviderButton("nvidia", "NVIDIA NIM", "NIM", "Free tier 40 req/min — Nemotron, Llama, Qwen via NVIDIA.", "cyan")}
                </div>
              </div>

              {/* Sections accordéons pour la configuration détaillée */}
              {normalizedLocalSettings.provider === "google" && renderAccordionSection(
                "google-config",
                "Configuration Google Gemini",
                <KeyRound size={20} />,
                renderGoogleApiKeySection(),
                "blue"
              )}

              {normalizedLocalSettings.provider === "nvidia" && renderAccordionSection(
                "nvidia-config",
                "Configuration NVIDIA NIM",
                <KeyRound size={20} />,
                renderNvidiaApiKeySection(),
                "cyan"
              )}

              {normalizedLocalSettings.provider === "local" && renderAccordionSection(
                "local-config",
                "Configuration Local (Ollama)",
                <Server size={20} />,
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-white/70">
                      Endpoint Ollama
                    </label>
                    <input
                      type="text"
                      value={normalizedLocalSettings.localEndpoint}
                      onChange={(e) => setLocalSettings((current) => ({ ...current, localEndpoint: e.target.value }))}
                      placeholder="http://localhost:11434/api/generate"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-emerald-500/40"
                    />
                  </div>
                  {/* ── Sélection du modèle ── */}
                  <div className="space-y-3">
                    {/* Header modèles */}
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider text-white/70">
                        Modèle local
                      </label>
                      <button
                        type="button"
                        onClick={() => void loadInstalledModels()}
                        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/50 transition-all hover:bg-white/10 hover:text-white"
                      >
                        <RefreshCw size={11} className={cn(isLoadingOllamaModels && "animate-spin")} />
                        {isLoadingOllamaModels ? "Scan..." : `Détecter (${installedModels.length} installé${installedModels.length > 1 ? "s" : ""})`}
                      </button>
                    </div>

                    {/* Panneau specs PC */}
                    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 flex-1">Specs détectées</p>
                        <button
                          type="button"
                          onClick={() => void refreshSpecs()}
                          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/40 hover:bg-white/10 hover:text-white/70 transition-all"
                          title="Re-détecter les specs"
                        >
                          <RefreshCw size={9} />
                          Actualiser
                        </button>
                        <span className={cn(
                          "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                          pcSpecsSource === "python" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                        )}>
                          {pcSpecsSource === "python" ? "✓ QGIS" : "⚠ Navigateur"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-white/40">RAM totale</span>
                          <span className="ml-auto text-[11px] font-bold text-white">
                            {pcRamCapped ? `≥${pcRamGb}` : `${pcRamGb}`} Go
                          </span>
                          {pcRamCapped && <span className="text-[9px] text-amber-400/70" title="Plafonné par le navigateur">⚠</span>}
                        </div>
                        {pcRamAvailableGb > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-white/40">RAM libre</span>
                            <span className="ml-auto text-[11px] font-bold text-emerald-300">{pcRamAvailableGb} Go</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-white/40">CPU</span>
                          <span className="ml-auto text-[11px] font-bold text-white">{pcCoresFull} cœurs</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-white/40">VRAM GPU</span>
                          <span className="ml-auto text-[11px] font-bold text-white">
                            {pcVramGb > 0 ? `${pcVramGb} Go${pcGpuCuda ? " CUDA" : ""}` : "Intégré / N/D"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-white/40">Niveau</span>
                          <span className={cn(
                            "ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                            pcTier === "high" ? "bg-emerald-500/20 text-emerald-300" :
                            pcTier === "mid" ? "bg-blue-500/20 text-blue-300" :
                            pcTier === "low" ? "bg-amber-500/20 text-amber-300" :
                            "bg-red-500/20 text-red-300"
                          )}>
                            {pcTier === "high" ? "🚀 Gaming+" : pcTier === "mid" ? "⚙ Mid-range" : pcTier === "low" ? "💻 Standard" : "⚠ Limité"}
                          </span>
                        </div>
                      </div>
                      {pcGpuLabel && (
                        <div className="text-[10px] text-white/30 truncate border-t border-white/5 pt-1.5">
                          GPU : {pcGpuLabel}{pcVramGb === 0 ? " (intégré)" : ""}
                        </div>
                      )}
                      {pcSpecsSource === "browser" && (
                        <p className="text-[9px] text-amber-400/60 border-t border-white/5 pt-1 mt-1">
                          ⚠ Valeurs estimées par le navigateur. Lance QGIS pour détecter les specs exactes.
                        </p>
                      )}
                    </div>

                    {/* Filtres modèles — multi-sélection */}
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-white/25">Filtres (cumulables)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { id: "compatible", label: "✅ Compatibles", color: "emerald" },
                          { id: "installed", label: "📦 Installés", color: "sky" },
                          { id: "libre", label: "💬 Discussion libre", color: "violet" },
                          { id: "lightweight", label: "⚡ Léger", color: "yellow" },
                          { id: "standard", label: "⚖ Standard", color: "blue" },
                          { id: "code", label: "💻 Code/GIS", color: "violet" },
                          { id: "reasoning", label: "🧠 Raisonnement", color: "pink" },
                          { id: "advanced", label: "🚀 Avancé", color: "orange" },
                          { id: "fr", label: "🇫🇷 Français", color: "blue" },
                          { id: "pyqgis", label: "🗺 PyQGIS", color: "green" },
                          { id: "ultra-léger", label: "🪶 Ultra-léger", color: "teal" },
                          { id: "nouveau", label: "✨ Nouveau", color: "purple" },
                          { id: "CoT", label: "🔗 CoT", color: "rose" },
                        ].map((f) => {
                          const active = modelFilters.includes(f.id);
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => toggleModelFilter(f.id)}
                              className={cn(
                                "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-all",
                                active
                                  ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-200"
                                  : "border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70",
                              )}
                            >
                              {f.label}
                            </button>
                          );
                        })}
                        {modelFilters.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setModelFilters([])}
                            className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-500/20"
                          >
                            ✕ Réinitialiser
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Grille des modèles */}
                    <div className="grid gap-2 md:grid-cols-2">
                      {LOCAL_MODEL_PRESETS
                        .filter((p) => {
                          if (modelFilters.length === 0) return true;
                          return modelFilters.every((f) => {
                            if (f === "compatible") return getModelCompat(p) !== "bad";
                            if (f === "installed") return isInstalled(p.id);
                            if (f === "lightweight" || f === "standard" || f === "code" || f === "reasoning" || f === "advanced") return p.category === f;
                            return p.tags?.includes(f) ?? false;
                          });
                        })
                        .map((preset) => {
                          const selected = normalizedLocalSettings.localModel === preset.id;
                          const installed = isInstalled(preset.id);
                          const installing = installingModel === preset.id;
                          const compat = getModelCompat(preset);
                          return (
                            <div
                              key={preset.id}
                              className={cn(
                                "group relative rounded-2xl border p-3 transition-all",
                                selected
                                  ? "border-emerald-500/40 bg-emerald-500/12 shadow-md shadow-emerald-500/10"
                                  : compat === "bad"
                                    ? "border-red-500/20 bg-red-500/5 hover:border-red-500/30"
                                    : compat === "warn"
                                      ? "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/30"
                                      : "border-white/10 bg-black/15 hover:border-white/20 hover:bg-white/5",
                              )}
                            >
                              {/* Header de la carte */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                    {installed && (
                                      <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                                        <CheckCircle2 size={8} /> Installé
                                      </span>
                                    )}
                                    {compat === "bad" && (
                                      <span className="inline-flex items-center gap-0.5 rounded-full border border-red-500/35 bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-300">
                                        ⚠ RAM insuffisante ({preset.ramMinGb}Go min)
                                      </span>
                                    )}
                                    {compat === "warn" && !selected && (
                                      <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/35 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                                        ~ Lent ({preset.ramMinGb}Go recommandé)
                                      </span>
                                    )}
                                    {preset.vram && (
                                      <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] text-white/40">
                                        {preset.vram}
                                      </span>
                                    )}
                                    {preset.tags?.map((tag) => (
                                      <span key={tag} className={cn(
                                        "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold",
                                        tag === "nouveau"
                                          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                                          : "border-blue-500/20 bg-blue-500/10 text-blue-300/70",
                                      )}>
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                  <p className={cn("text-[13px] font-semibold leading-tight", selected ? "text-white" : "text-white/80")}>
                                    {preset.label}
                                  </p>
                                  <p className="mt-0.5 text-[11px] leading-relaxed text-white/35">{preset.description}</p>
                                </div>
                              </div>
                              {/* Avertissement compatibilité si sélectionné */}
                              {selected && compat !== "ok" && (
                                <div className={cn(
                                  "mt-2 rounded-xl border px-2.5 py-1.5 text-[10px] leading-relaxed space-y-0.5",
                                  compat === "bad"
                                    ? "border-red-500/30 bg-red-500/10 text-red-300"
                                    : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                )}>
                                  {compat === "bad" ? (
                                    <>
                                      <p>⚠ Ressources insuffisantes pour ce modèle :</p>
                                      {preset.ramMinGb && pcRamGb < preset.ramMinGb && (
                                        <p>· RAM : {pcRamGb} Go détectés / {preset.ramMinGb} Go requis</p>
                                      )}
                                      {preset.vramMinGb && preset.vramMinGb > 0 && pcVramGb > 0 && pcVramGb < preset.vramMinGb && (
                                        <p>· VRAM : {pcVramGb} Go détectés / {preset.vramMinGb} Go requis</p>
                                      )}
                                      <p>Le modèle risque de crasher ou de ne pas démarrer.</p>
                                    </>
                                  ) : (
                                    <>
                                      <p>~ Ressources un peu justes — les réponses seront lentes :</p>
                                      {preset.ramMinGb && pcRamGb < preset.ramMinGb && (
                                        <p>· RAM : {pcRamGb} Go / {preset.ramMinGb} Go recommandés</p>
                                      )}
                                      {preset.vramMinGb && preset.vramMinGb > 0 && pcVramGb > 0 && pcVramGb < preset.vramMinGb && (
                                        <p>· VRAM : {pcVramGb} Go / {preset.vramMinGb} Go recommandés</p>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Progression d'installation */}
                              {installing && (
                                <div className="mt-2 space-y-1.5">
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all duration-300",
                                        installProgress?.percent != null ? "bg-emerald-400" : "animate-pulse bg-emerald-400/50"
                                      )}
                                      style={{ width: `${installProgress?.percent ?? 5}%` }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <p className="text-[10px] text-white/40 truncate max-w-[60%]">
                                      {installProgress?.status === "pulling manifest" ? "Récupération des métadonnées…" :
                                       installProgress?.status === "verifying sha256 digest" ? "Vérification…" :
                                       installProgress?.status === "writing manifest" ? "Écriture…" :
                                       installProgress?.status === "removing any unused layers" ? "Nettoyage…" :
                                       installProgress?.status === "success" ? "✓ Terminé" :
                                       installProgress?.status?.startsWith("pulling") ? "Téléchargement…" :
                                       installProgress?.status ?? "Préparation…"}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      {installProgress?.percent != null && (
                                        <span className="text-[10px] font-semibold text-emerald-300">{installProgress.percent}%</span>
                                      )}
                                      {installProgress?.speedBps != null && (
                                        <span className="text-[9px] text-white/30">
                                          {installProgress.speedBps > 1e6
                                            ? `${(installProgress.speedBps / 1e6).toFixed(1)} MB/s`
                                            : `${(installProgress.speedBps / 1e3).toFixed(0)} KB/s`}
                                        </span>
                                      )}
                                      {installProgress?.etaSeconds != null && installProgress.etaSeconds > 0 && (
                                        <span className="text-[9px] text-white/30">
                                          {installProgress.etaSeconds > 60
                                            ? `${Math.floor(installProgress.etaSeconds / 60)}min ${installProgress.etaSeconds % 60}s`
                                            : `${installProgress.etaSeconds}s`}
                                        </span>
                                      )}
                                      {installProgress?.total != null && installProgress.completed != null && (
                                        <span className="text-[9px] text-white/25">
                                          {(installProgress.completed / 1e9).toFixed(1)}/{(installProgress.total / 1e9).toFixed(1)} Go
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Boutons action */}
                              <div className="mt-2.5 flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setLocalSettings((current) => ({ ...current, localModel: preset.id }))}
                                  className={cn(
                                    "flex-1 rounded-xl border px-2 py-1.5 text-[11px] font-semibold transition-all",
                                    selected
                                      ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
                                      : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white",
                                  )}
                                >
                                  {selected ? "✓ Sélectionné" : "Utiliser"}
                                </button>
                                {!installed && !installing && (
                                  <button
                                    type="button"
                                    onClick={() => void handleInstallModel(preset.id)}
                                    disabled={!!installingModel}
                                    className="flex items-center gap-1 rounded-xl border border-blue-500/30 bg-blue-500/15 px-2 py-1.5 text-[11px] font-semibold text-blue-300 transition-all hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                                    title={`Télécharger ${preset.id}`}
                                  >
                                    <Download size={11} />
                                    Installer
                                  </button>
                                )}
                                {installed && !installing && (
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteModel(preset.id)}
                                    disabled={!!deletingModel || !!installingModel}
                                    className="flex items-center gap-1 rounded-xl border border-red-500/20 bg-red-500/10 px-2 py-1.5 text-[11px] font-semibold text-red-400/80 transition-all hover:bg-red-500/20 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                                    title={`Désinstaller ${preset.id}`}
                                  >
                                    {deletingModel === preset.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                    {deletingModel === preset.id ? "…" : "Désinstaller"}
                                  </button>
                                )}
                                {installing && (
                                  <button
                                    type="button"
                                    onClick={() => abortInstallRef.current?.abort()}
                                    className="flex items-center gap-1 rounded-xl border border-red-500/30 bg-red-500/15 px-2 py-1.5 text-[11px] font-semibold text-red-300 transition-all hover:bg-red-500/25"
                                  >
                                    <X size={11} />
                                    Annuler
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Erreur d'installation */}
                    {installError && (
                      <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-[11px] text-red-300 flex items-start gap-2">
                        <AlertCircle size={13} className="mt-0.5 shrink-0" />
                        <span><strong>Erreur :</strong> {installError}</span>
                      </div>
                    )}

                    {/* Modèles installés hors presets */}
                    {installedModels.filter((m) => !LOCAL_MODEL_PRESETS.some((p) => isInstalled(p.id) && (p.id === m || m.startsWith(p.id.split(":")[0])))).length > 0 && (
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Autres modèles installés</p>
                        <div className="space-y-1.5">
                          {installedModels
                            .filter((m) => !LOCAL_MODEL_PRESETS.some((p) => p.id === m || m.startsWith(p.id.split(":")[0])))
                            .map((m) => (
                              <div key={m} className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[12px] font-semibold text-white/80 truncate">{m}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setLocalSettings((c) => ({ ...c, localModel: m }))}
                                  className={cn(
                                    "rounded-lg border px-2 py-0.5 text-[10px] font-semibold transition-all",
                                    normalizedLocalSettings.localModel === m
                                      ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
                                      : "border-white/10 bg-white/5 text-white/40 hover:text-white hover:bg-white/10",
                                  )}
                                >
                                  {normalizedLocalSettings.localModel === m ? "✓ Actif" : "Utiliser"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteModel(m)}
                                  disabled={!!deletingModel || !!installingModel}
                                  className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-400/80 transition-all hover:bg-red-500/20 hover:text-red-300 disabled:opacity-40"
                                >
                                  {deletingModel === m ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                                  {deletingModel === m ? "…" : "Désinstaller"}
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Modèle personnalisé */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-white/60">
                        <Package size={12} />
                        Modèle personnalisé (ollama pull)
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customModelInput}
                          onChange={(e) => setCustomModelInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && customModelInput.trim()) {
                              void handleInstallModel(customModelInput.trim());
                            }
                          }}
                          placeholder="ex: llama3.2:1b, mistral:latest..."
                          className="flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-white outline-none placeholder:text-white/25 focus:border-emerald-500/40"
                        />
                        <button
                          type="button"
                          disabled={!customModelInput.trim() || !!installingModel}
                          onClick={() => {
                            const m = customModelInput.trim();
                            if (m) void handleInstallModel(m);
                          }}
                          className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-[12px] font-semibold text-emerald-200 transition-all hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Download size={13} />
                          Pull
                        </button>
                      </div>
                      {installingModel && installingModel === customModelInput.trim() && installProgress && (
                        <div className="mt-2 space-y-1">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${installProgress.percent ?? 0}%` }} />
                          </div>
                          <p className="text-[10px] text-white/40">{installProgress.status}</p>
                        </div>
                      )}
                    </div>

                    {/* Bouton wizard auto-détection */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowOllamaWizard(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/12 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/16 transition-all"
                    >
                      <Cpu size={16} />
                      Détecter et configurer automatiquement
                    </button>
                  </div>
                </div>,
                "emerald"
              )}

              {normalizedLocalSettings.provider === "openrouter" && renderAccordionSection(
                "openrouter-config",
                "Configuration OpenRouter",
                <Sparkles size={20} />,
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <KeyRound size={16} className="text-purple-300" />
                        Clé API
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-white/50">
                        Source actuelle:{" "}
                        <strong className="text-white">
                          {openRouterKeySource === "local"
                            ? "clé locale"
                            : openRouterKeySource === "env"
                              ? "variable d'environnement"
                              : "non configurée"}
                        </strong>
                      </p>
                    </div>
                    <a
                      href={OPENROUTER_KEYS_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-100 transition-all hover:bg-purple-500/16"
                    >
                      OpenRouter Keys
                      <ExternalLink size={13} />
                    </a>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center gap-2">
                      {renderKeyStatusBadge(openrouterKeyStatus)}
                    </div>
                    <SecretInput
                      value={normalizedLocalSettings.openrouterApiKey}
                      placeholder={
                        openRouterKeySource === "env"
                          ? maskSecret(envOpenRouterApiKey)
                          : "sk-or-v1-... (clé OpenRouter)"
                      }
                      visible={showOpenRouterKey}
                      onChange={(value) =>
                        setLocalSettings((current) => ({
                          ...current,
                          openrouterApiKey: value,
                        }))
                      }
                      onPaste={() => void onPasteApiKey("openrouter")}
                      onToggle={() => setShowOpenRouterKey((current) => !current)}
                    />
                    <p className="mt-1.5 text-[10px] text-white/35">Stockée chiffrée en localStorage. Format attendu : sk-or-v1-[64 hex]</p>
                  </div>
                  {/* État du crédit inline */}
                  <div className="rounded-2xl border border-purple-500/15 bg-purple-500/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Activity size={13} className="text-purple-300" />
                        <span className="text-xs font-semibold text-purple-200">Crédit & Quota</span>
                        {openRouterKeyInfoUpdatedAt && (
                          <span className="text-[10px] text-white/30">
                            · mis à jour {new Date(openRouterKeyInfoUpdatedAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void refreshOpenRouterKeyInfo()}
                        disabled={isLoadingOpenRouterKeyInfo || !canLoadOpenRouterKeyInfo}
                        className="flex items-center gap-1 rounded-lg border border-purple-500/25 bg-purple-500/10 px-2 py-1 text-[10px] font-semibold text-purple-200 transition-all hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isLoadingOpenRouterKeyInfo
                          ? <Loader2 size={10} className="animate-spin" />
                          : <RefreshCw size={10} />
                        }
                        Vérifier
                      </button>
                    </div>
                    {openRouterKeyInfoError ? (
                      <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-2.5 py-1.5">
                        <AlertCircle size={11} className="text-red-400 shrink-0" />
                        <span className="text-[11px] text-red-300">{openRouterKeyInfoError}</span>
                      </div>
                    ) : openRouterKeyInfo ? (
                      <div className="mt-2 flex items-center gap-4">
                        <div className="text-xs">
                          <span className="text-white/40">Limite </span>
                          <strong className="text-white">${openRouterKeyInfo.limit?.toFixed(2) ?? "∞"}</strong>
                        </div>
                        <div className="text-xs">
                          <span className="text-white/40">Utilisé </span>
                          <strong className="text-white">${openRouterKeyInfo.usage?.toFixed(4) ?? "0"}</strong>
                        </div>
                        {openRouterKeyInfo.limit && openRouterKeyInfo.usage !== undefined && (
                          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                (openRouterKeyInfo.usage / openRouterKeyInfo.limit) > 0.8
                                  ? "bg-red-400"
                                  : (openRouterKeyInfo.usage / openRouterKeyInfo.limit) > 0.5
                                    ? "bg-amber-400"
                                    : "bg-emerald-400"
                              )}
                              style={{ width: `${Math.min(100, (openRouterKeyInfo.usage / openRouterKeyInfo.limit) * 100).toFixed(1)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] text-white/35">
                        {canLoadOpenRouterKeyInfo ? "Cliquez sur Vérifier pour lire votre solde." : "Entrez votre clé API pour vérifier le crédit."}
                      </p>
                    )}
                  </div>

                  <details className="group">
                    <summary className="cursor-pointer text-[11px] font-medium text-white/35 hover:text-white/60 transition-colors list-none flex items-center gap-1.5">
                      <ChevronDown size={12} className="transition-transform group-open:rotate-180" />
                      Paramètres avancés (endpoint, referer…)
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white/55">Endpoint API</label>
                        <input
                          type="text"
                          value={normalizedLocalSettings.openrouterEndpoint}
                          onChange={(e) => setLocalSettings((current) => ({ ...current, openrouterEndpoint: e.target.value }))}
                          placeholder="https://openrouter.ai/api/v1"
                          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-white/25 focus:border-purple-500/40"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white/55">Nom de l'application</label>
                        <input
                          type="text"
                          value={normalizedLocalSettings.openrouterAppName}
                          onChange={(e) => setLocalSettings((current) => ({ ...current, openrouterAppName: e.target.value }))}
                          placeholder="GeoSylva AI"
                          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-white/25 focus:border-purple-500/40"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white/55">Referer HTTP</label>
                        <input
                          type="text"
                          value={normalizedLocalSettings.openrouterReferer}
                          onChange={(e) => setLocalSettings((current) => ({ ...current, openrouterReferer: e.target.value }))}
                          placeholder="https://votre-app.example"
                          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-white/25 focus:border-purple-500/40"
                        />
                      </div>
                    </div>
                  </details>
                </div>,
                "purple"
              )}
            </div>
          )}
          {activeTab === "gateway" && (
            <div className="space-y-4">
              <GatewaySettingsPanel />
            </div>
          )}
          {activeTab === "config" && (
            <div className="space-y-4">
              {normalizedLocalSettings.provider === "openrouter" && renderAccordionSection(
                "openrouter-stack",
                "Stack OpenRouter Multi-Agent",
                <Workflow size={20} />,
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    {OPENROUTER_STACK_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          setLocalSettings((current) => {
                            const newSettings = {
                              ...current,
                              openrouterPlannerModel: preset.plannerModel,
                              openrouterDeepPlannerModel: preset.deepPlannerModel,
                              openrouterReviewerModel: preset.reviewerModel,
                              openrouterRetrieverModel: preset.retrieverModel,
                              openrouterExecutorModel: preset.executorModel,
                            };
                            return newSettings;
                          })
                        }
                        className={cn(
                          "rounded-2xl border p-4 text-left transition-all",
                          OPENROUTER_STACK_PRESETS.find(
                            (p) =>
                              p.plannerModel ===
                                normalizedLocalSettings.openrouterPlannerModel,
                          )?.id === preset.id
                            ? "border-fuchsia-500/35 bg-fuchsia-500/12 text-white"
                            : "border-white/10 bg-black/15 text-white/60 hover:bg-white/8",
                        )}
                      >
                        <p className="text-sm font-semibold">{preset.label}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-fuchsia-200/70">
                          {preset.badge}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-white/45">
                          {preset.description}
                        </p>
                        <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-fuchsia-200/70">
                          {preset.priceHint}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">Mode multi-agent</p>
                          <p className="mt-1 text-xs text-white/55">Planner rapide, planner profond, reviewer et executor travaillent en chaîne.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setLocalSettings((current) => ({
                              ...current,
                              openrouterAgentMode: current.openrouterAgentMode === "multi" ? "single" : "multi",
                            }))
                          }
                          className={cn(
                            "mt-1 h-6 w-11 flex-shrink-0 rounded-full p-1 transition-colors",
                            normalizedLocalSettings.openrouterAgentMode === "multi"
                              ? "bg-emerald-500"
                              : "bg-white/10",
                          )}
                        >
                          <div
                            className={cn(
                              "h-4 w-4 rounded-full bg-white transition-transform shadow-sm",
                              normalizedLocalSettings.openrouterAgentMode === "multi"
                                ? "translate-x-5"
                                : "translate-x-0",
                            )}
                          />
                        </button>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">Autoriser les outils QGIS</p>
                          <p className="mt-1 text-xs text-white/55">L'agent executeur peut appeler les outils de couche, filtres, stats et scripts PyQGIS.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setLocalSettings((current) => ({
                              ...current,
                              openrouterExecutionMode: current.openrouterExecutionMode === "tools" ? "draft" : "tools",
                            }))
                          }
                          className={cn(
                            "mt-1 h-6 w-11 flex-shrink-0 rounded-full p-1 transition-colors",
                            normalizedLocalSettings.openrouterExecutionMode === "tools"
                              ? "bg-emerald-500"
                              : "bg-white/10",
                          )}
                        >
                          <div
                            className={cn(
                              "h-4 w-4 rounded-full bg-white transition-transform shadow-sm",
                              normalizedLocalSettings.openrouterExecutionMode === "tools"
                                ? "translate-x-5"
                                : "translate-x-0",
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {renderModelSelector(
                      normalizedLocalSettings.openrouterPlannerModel,
                      (value) => setLocalSettings((current) => ({ ...current, openrouterPlannerModel: value })),
                      "Planner",
                      "Analyse la demande et produit un plan d'exécution structuré. Choisir un modèle rapide et bon en raisonnement.",
                      "fuchsia",
                      "planner"
                    )}

                    {normalizedLocalSettings.openrouterAgentMode === "multi" && renderModelSelector(
                      normalizedLocalSettings.openrouterDeepPlannerModel,
                      (value) => setLocalSettings((current) => ({ ...current, openrouterDeepPlannerModel: value })),
                      "Planner profond",
                      "Raffine le plan : vérifie les CRS, préconditions, risques et sorties. Peut être le même que le Planner.",
                      "blue",
                      "planner"
                    )}

                    {normalizedLocalSettings.openrouterAgentMode === "multi" && renderModelSelector(
                      normalizedLocalSettings.openrouterReviewerModel,
                      (value) => setLocalSettings((current) => ({ ...current, openrouterReviewerModel: value })),
                      "Reviewer",
                      "Valide la cohérence du plan avant exécution. Doit être fiable pour ne pas bloquer le flux.",
                      "emerald",
                      "reviewer"
                    )}

                    {normalizedLocalSettings.openrouterUseRetriever && renderModelSelector(
                      normalizedLocalSettings.openrouterRetrieverModel,
                      (value) => setLocalSettings((current) => ({ ...current, openrouterRetrieverModel: value })),
                      "Retriever (embeddings)",
                      "Génère les embeddings pour la recherche sémantique dans le contexte QGIS.",
                      "cyan",
                      "retriever"
                    )}

                    {renderModelSelector(
                      normalizedLocalSettings.openrouterExecutorModel,
                      (value) => setLocalSettings((current) => ({ ...current, openrouterExecutorModel: value })),
                      "Executor",
                      "Exécute le plan validé : appelle les outils QGIS, génère les scripts PyQGIS. Doit supporter le tool-calling.",
                      "orange",
                      "executor"
                    )}
                  </div>
                </div>,
                "fuchsia"
              )}

              {normalizedLocalSettings.provider !== "openrouter" && (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
                  <Info size={32} className="mx-auto text-white/30 mb-3" />
                  <p className="text-sm text-white/50">Sélectionnez OpenRouter comme provider pour accéder à la configuration multi-agent.</p>
                </div>
              )}
            </div>
          )}
          {activeTab === "execution" && (
            <div className="space-y-4">
              {renderAccordionSection(
                "generation-params",
                "Paramètres de Génération",
                <Activity size={20} />,
                <div className="space-y-5">
                  <p className="text-xs leading-relaxed text-white/55">
                    Ces paramètres s'appliquent à tous les providers (Gemini, Ollama, OpenRouter) pour contrôler la créativité et la longueur des réponses.
                  </p>

                  {/* Température */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-xs font-medium text-white/70">Température</label>
                      <span className="rounded-lg border border-white/10 bg-black/20 px-2 py-0.5 text-xs font-mono text-white">
                        {normalizedLocalSettings.temperature.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range" min="0" max="2" step="0.05"
                      value={normalizedLocalSettings.temperature}
                      onChange={(e) => setLocalSettings((c) => ({ ...c, temperature: parseFloat(e.target.value) }))}
                      className="w-full accent-indigo-400"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-white/35">
                      <span>0 — Déterministe</span>
                      <span>0.7 — Équilibré</span>
                      <span>2 — Créatif</span>
                    </div>
                  </div>

                  {/* Top-P */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-xs font-medium text-white/70">Top-P (nucleus sampling)</label>
                      <span className="rounded-lg border border-white/10 bg-black/20 px-2 py-0.5 text-xs font-mono text-white">
                        {normalizedLocalSettings.topP.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range" min="0.01" max="1" step="0.01"
                      value={normalizedLocalSettings.topP}
                      onChange={(e) => setLocalSettings((c) => ({ ...c, topP: parseFloat(e.target.value) }))}
                      className="w-full accent-indigo-400"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-white/35">
                      <span>0.01 — Focused</span>
                      <span>0.95</span>
                      <span>1.0 — Tout le vocab</span>
                    </div>
                  </div>

                  {/* Max Tokens */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-xs font-medium text-white/70">Max tokens de réponse</label>
                      <span className="rounded-lg border border-white/10 bg-black/20 px-2 py-0.5 text-xs font-mono text-white">
                        {normalizedLocalSettings.maxTokens.toLocaleString()}
                      </span>
                    </div>
                    <input
                      type="range" min="256" max="32768" step="256"
                      value={normalizedLocalSettings.maxTokens}
                      onChange={(e) => setLocalSettings((c) => ({ ...c, maxTokens: parseInt(e.target.value) }))}
                      className="w-full accent-indigo-400"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-white/35">
                      <span>256</span>
                      <span>8 192 (défaut)</span>
                      <span>32 768</span>
                    </div>
                  </div>

                  {/* Streaming */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">Streaming des réponses</p>
                        <p className="mt-1 text-xs text-white/55">Affiche le texte au fur et à mesure de la génération. Désactiver pour des réponses plus stables.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLocalSettings((c) => ({ ...c, streamingEnabled: !c.streamingEnabled }))}
                        className={cn(
                          "mt-1 h-6 w-11 flex-shrink-0 rounded-full p-1 transition-colors",
                          normalizedLocalSettings.streamingEnabled ? "bg-indigo-500" : "bg-white/10",
                        )}
                      >
                        <div className={cn(
                          "h-4 w-4 rounded-full bg-white transition-transform shadow-sm",
                          normalizedLocalSettings.streamingEnabled ? "translate-x-5" : "translate-x-0",
                        )} />
                      </button>
                    </div>
                  </div>
                </div>,
                "indigo"
              )}

              {renderAccordionSection(
                "pyqgis-auto",
                "Scripts PyQGIS Automatiques",
                <Workflow size={20} />,
                <div className="space-y-4">
                  <p className="text-xs leading-relaxed text-white/55">
                    Contrôle l'exécution automatique et la réparation des scripts PyQGIS générés par l'IA.
                  </p>
                  
                  <Toggle
                    checked={normalizedLocalSettings.autoExecutePythonScripts}
                    label="Exécution automatique des scripts PyQGIS"
                    description="Exécute immédiatement les scripts générés sans demander de confirmation. ⚠ Peut modifier votre projet QGIS sans avertissement. Recommandé uniquement en environnement de test."
                    onChange={(v) => setLocalSettings((c) => ({ ...c, autoExecutePythonScripts: v }))}
                  />

                  {normalizedLocalSettings.autoExecutePythonScripts && (
                    <Toggle
                      checked={normalizedLocalSettings.autoRepairPythonScripts}
                      label="Auto-réparation des erreurs"
                      description="Si un script échoue, l'IA tente automatiquement de le corriger et de le ré-exécuter. Limite les boucles infinies via un compteur de tentatives."
                      onChange={(v) => setLocalSettings((c) => ({ ...c, autoRepairPythonScripts: v }))}
                    />
                  )}

                  {normalizedLocalSettings.autoExecutePythonScripts && normalizedLocalSettings.autoRepairPythonScripts && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-xs font-medium text-white/70">Tentatives de réparation max</label>
                        <span className="rounded-lg border border-white/10 bg-black/20 px-2 py-0.5 text-xs font-mono text-white">
                          {normalizedLocalSettings.autoRepairMaxAttempts}
                        </span>
                      </div>
                      <input
                        type="range" min="1" max="5" step="1"
                        value={normalizedLocalSettings.autoRepairMaxAttempts}
                        onChange={(e) => setLocalSettings((c) => ({ ...c, autoRepairMaxAttempts: parseInt(e.target.value, 10) }))}
                        className="w-full accent-indigo-400"
                      />
                      <div className="mt-1 flex justify-between text-[10px] text-white/35">
                        <span>1 — Rapide</span>
                        <span>3 — Équilibré</span>
                        <span>5 — Persistant</span>
                      </div>
                    </div>
                  )}
                </div>,
                "indigo"
              )}
            </div>
          )}
          {activeTab === "diagnostics" && (
            <div className="space-y-4">
              {renderAccordionSection(
                "config-summary",
                "Résumé de Configuration",
                <Info size={20} />,
                <div className="space-y-3 text-sm text-white/60">
                  <div className="flex items-center justify-between gap-3">
                    <span>Provider</span>
                    <strong className="text-white">
                      {normalizedLocalSettings.provider === "local"
                        ? "Local"
                        : normalizedLocalSettings.provider === "google"
                          ? "Google Gemini"
                          : "OpenRouter"}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Modèle actif</span>
                    <strong className="text-white">
                      {getActiveModel(normalizedLocalSettings)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Mode agent</span>
                    <strong className="text-white">
                      {normalizedLocalSettings.provider === "openrouter"
                        ? normalizedLocalSettings.openrouterAgentMode === "multi"
                          ? "Multi-agent"
                          : "Single agent"
                        : "Natif"}
                    </strong>
                  </div>
                  {normalizedLocalSettings.provider === "openrouter" && (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span>Profil coût</span>
                        <strong className="text-white">
                          {OPENROUTER_STACK_PRESETS.find(
                            (p) =>
                              p.plannerModel ===
                              normalizedLocalSettings.openrouterPlannerModel,
                          )?.label || "Personnalisé"}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Exécution</span>
                        <strong className="text-white">
                          {normalizedLocalSettings.openrouterExecutionMode === "tools"
                            ? "Outils QGIS autorisés"
                            : "Draft only"}
                        </strong>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-white/65">
                        <div className="font-semibold text-white/85">Chaîne actuelle</div>
                        <div className="mt-2 space-y-1">
                          <div>planner: {normalizedLocalSettings.openrouterPlannerModel}</div>
                          {normalizedLocalSettings.openrouterAgentMode === "multi" && (
                            <div>
                              planner deep: {normalizedLocalSettings.openrouterDeepPlannerModel}
                            </div>
                          )}
                          {normalizedLocalSettings.openrouterAgentMode === "multi" && (
                            <div>reviewer: {normalizedLocalSettings.openrouterReviewerModel}</div>
                          )}
                          {normalizedLocalSettings.openrouterUseRetriever && (
                            <div>retriever: {normalizedLocalSettings.openrouterRetrieverModel}</div>
                          )}
                          <div>executor: {normalizedLocalSettings.openrouterExecutorModel}</div>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span>Exécution PyQGIS</span>
                    <strong className="text-white">
                      {normalizedLocalSettings.autoExecutePythonScripts
                        ? "Automatique"
                        : "Manuelle"}
                    </strong>
                  </div>
                  <div className="mt-1 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-white/65">
                    <div className="font-semibold text-white/85 mb-2">Paramètres de génération</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <div className="flex items-center justify-between"><span>Température</span><strong className="text-white font-mono">{normalizedLocalSettings.temperature.toFixed(2)}</strong></div>
                      <div className="flex items-center justify-between"><span>Top-P</span><strong className="text-white font-mono">{normalizedLocalSettings.topP.toFixed(2)}</strong></div>
                      <div className="flex items-center justify-between"><span>Max tokens</span><strong className="text-white font-mono">{normalizedLocalSettings.maxTokens.toLocaleString()}</strong></div>
                      <div className="flex items-center justify-between"><span>Streaming</span><strong className="text-white">{normalizedLocalSettings.streamingEnabled ? "On" : "Off"}</strong></div>
                    </div>
                  </div>
                </div>,
                "blue"
              )}

              {normalizedLocalSettings.provider === "openrouter" && renderAccordionSection(
                "openrouter-key-status",
                "État de la clé OpenRouter",
                <Activity size={20} />,
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-semibold text-white">
                      <Activity size={16} />
                      État de la clé
                    </div>
                    <button
                      type="button"
                      onClick={() => void refreshOpenRouterKeyInfo()}
                      disabled={isLoadingOpenRouterKeyInfo}
                      className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-100 transition-all hover:bg-fuchsia-500/16 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoadingOpenRouterKeyInfo ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      Rafraîchir
                    </button>
                  </div>
                  {openRouterKeyInfoUpdatedAt && (
                    <p className="text-[11px] text-fuchsia-200/70">
                      Mis à jour: {new Date(openRouterKeyInfoUpdatedAt).toLocaleTimeString()}
                    </p>
                  )}
                  {openRouterKeyInfoError ? (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-100">
                      <p className="font-semibold">Erreur de lecture</p>
                      <p className="mt-1 text-red-100/80">{openRouterKeyInfoError}</p>
                    </div>
                  ) : openRouterKeyInfo ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-fuchsia-200/80">Limite</span>
                        <strong className="text-white">
                          ${openRouterKeyInfo.limit?.toFixed(2) || "N/A"}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-fuchsia-200/80">Utilisé</span>
                        <strong className="text-white">
                          ${openRouterKeyInfo.usage?.toFixed(2) || "N/A"}
                        </strong>
                      </div>
                      {openRouterKeyInfo.usage !== undefined && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-fuchsia-200/80">Utilisé</span>
                          <strong className="text-white">
                            ${openRouterKeyInfo.usage?.toFixed(2) || "N/A"}
                          </strong>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-fuchsia-200/70">
                      Cliquez sur Rafraîchir pour lire l'état de la clé.
                    </p>
                  )}
                </div>,
                "fuchsia"
              )}

              {renderAccordionSection(
                "diagnostics-tests",
                "Diagnostics et Tests",
                <FlaskConical size={20} />,
                <div className="space-y-3">
                  <p className="text-xs leading-relaxed text-cyan-100/75">
                    Teste la connexion du provider actif, les modèles OpenRouter choisis et le bridge QGIS pour mesurer latence et erreurs réelles.
                  </p>
                  {normalizedLocalSettings.provider === "openrouter" && (
                    <p className="text-[11px] leading-relaxed text-cyan-100/60">
                      Si tu vois <code>free-models-per-day</code>, le blocage vient du quota journalier OpenRouter sur les modèles gratuits, pas de QGIS.
                    </p>
                  )}
                  <div className="grid gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        void runProbe("provider-active", "Test provider actif", () =>
                          probeActiveProvider(normalizedLocalSettings),
                        )
                      }
                      disabled={activeProbeId !== null}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-all hover:bg-cyan-500/16 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Activity size={14} />
                      Tester le provider actif
                    </button>
                    {normalizedLocalSettings.provider === "openrouter" && (
                      <div className="grid gap-3 md:grid-cols-2">
                        <button
                          type="button"
                          onClick={() =>
                            void runProbe("openrouter-planner", "Test planner OpenRouter", () =>
                              probeOpenRouterModel(normalizedLocalSettings, normalizedLocalSettings.openrouterPlannerModel),
                            )
                          }
                          disabled={activeProbeId !== null}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-all hover:bg-fuchsia-500/16 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Activity size={14} />
                          Planner
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void runProbe("openrouter-executor", "Test executor OpenRouter", () =>
                              probeOpenRouterModel(normalizedLocalSettings, normalizedLocalSettings.openrouterExecutorModel),
                            )
                          }
                          disabled={activeProbeId !== null}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-all hover:bg-fuchsia-500/16 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Activity size={14} />
                          Executor
                        </button>
                      </div>
                    )}
                    {Object.keys(probeResults).length > 0 && (
                      <div className="space-y-2">
                        {Object.entries(probeResults).map(([probeId, result]) => (
                          <div
                            key={probeId}
                            className={cn(
                              "rounded-2xl border p-3 text-xs",
                              result.ok
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                                : "border-red-500/30 bg-red-500/10 text-red-100",
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">{result.provider}</span>
                              <span className="text-[10px] uppercase tracking-[0.18em]">
                                {result.latencyMs}ms
                              </span>
                            </div>
                            <p className="mt-1 text-white/80">{result.preview}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>,
                "cyan"
              )}

              {settingsIssues.length > 0 && (
                <div className="rounded-3xl border border-red-500/20 bg-red-500/8 p-5 text-sm text-red-100">
                  <p className="font-semibold">Configuration incomplète</p>
                  <ul className="mt-3 space-y-2 text-xs text-red-100/80">
                    {settingsIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {settingsIssues.length === 0 && (
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/8 p-5 text-sm text-emerald-50/90">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 size={16} />
                    Configuration exploitable
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-emerald-100/80">
                    Le provider et les rôles sélectionnés ont les champs minimums pour être utilisés.
                  </p>
                </div>
              )}

              {renderAccordionSection(
                "debug-logs",
                "Logs de Debug",
                <Activity size={20} />,
                <div className="space-y-3">
                  <p className="text-xs leading-relaxed text-cyan-100/75">
                    Affiche les événements de debug récents pour aider à identifier les problèmes.
                  </p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 font-semibold text-white">
                        <Activity size={16} />
                        {debugEvents.length} événements
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const formatted = formatDebugEventsForClipboard(debugEvents);
                            void navigator.clipboard.writeText(formatted);
                            toast.success("Logs copiés");
                          }}
                          className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-100 transition-all hover:bg-cyan-500/16"
                        >
                          <Copy size={12} className="inline mr-1" />Copier
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const blob = new Blob([formatDebugEventsForClipboard(debugEvents)], { type: "text/plain" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a"); a.href = url; a.download = `qgisai-logs-${Date.now()}.txt`; a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1.5 text-xs font-semibold text-blue-100 transition-all hover:bg-blue-500/16"
                        >
                          <Download size={12} className="inline mr-1" />Export
                        </button>
                        <button
                          type="button"
                          onClick={() => { clearDebugEvents(); setDebugEvents([]); toast.success("Logs effacés"); }}
                          className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-100 transition-all hover:bg-red-500/16"
                        >
                          <Trash2 size={12} className="inline mr-1" />Effacer
                        </button>
                      </div>
                    </div>
                    {/* Filtre niveau + recherche */}
                    <div className="flex gap-2">
                      <div className="flex gap-1">
                        {(["all", "error", "warning", "info"] as const).map(lvl => (
                          <button key={lvl} type="button"
                            onClick={() => setLogLevelFilter(lvl)}
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide border transition-all",
                              logLevelFilter === lvl
                                ? lvl === "error" ? "border-red-500/40 bg-red-500/15 text-red-200"
                                  : lvl === "warning" ? "border-yellow-500/40 bg-yellow-500/15 text-yellow-200"
                                  : lvl === "info" ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-200"
                                  : "border-white/20 bg-white/10 text-white"
                                : "border-white/10 bg-transparent text-white/40 hover:text-white/60"
                            )}
                          >{lvl}</button>
                        ))}
                      </div>
                      <input
                        value={logSearch}
                        onChange={e => setLogSearch(e.target.value)}
                        placeholder="Rechercher..."
                        className="flex-1 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white placeholder:text-white/25 outline-none focus:border-cyan-500/30"
                      />
                    </div>
                  </div>

                  {debugEvents.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
                      <Activity size={32} className="mx-auto text-white/20 mb-3" />
                      <p className="text-xs text-white/50">Aucun événement de debug disponible.</p>
                    </div>
                  ) : (
                    <div className="max-h-96 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3">
                      {(() => {
                        const filtered = debugEvents
                          .filter(e => logLevelFilter === "all" || e.level === logLevelFilter)
                          .filter(e => !logSearch || e.message.toLowerCase().includes(logSearch.toLowerCase()) || (e.details ?? "").toLowerCase().includes(logSearch.toLowerCase()))
                          .slice(-100)
                          .reverse();
                        if (filtered.length === 0) return (
                          <div className="py-6 text-center text-xs text-white/40">Aucun événement correspondant</div>
                        );
                        return filtered.map((event, index) => (
                          <div
                            key={`${event.createdAt}-${index}`}
                            className={`rounded-xl border p-3 text-xs ${
                              event.level === "error"
                                ? "border-red-500/30 bg-red-500/10 text-red-100"
                                : event.level === "warning"
                                  ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-100"
                                  : "border-white/10 bg-white/5 text-white/80"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={cn(
                                "font-semibold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded",
                                event.level === "error" ? "bg-red-500/20 text-red-300" :
                                event.level === "warning" ? "bg-yellow-500/20 text-yellow-300" :
                                "bg-white/10 text-white/50"
                              )}>
                                {event.level}
                              </span>
                              <span className="text-[10px] opacity-50">
                                {new Date(event.createdAt).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="font-medium">{event.message}</p>
                            {event.details && (
                              <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-black/30 p-2 text-[10px] font-mono opacity-80">
                                {event.details}
                              </pre>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>,
                "cyan"
              )}
            </div>
          )}
        </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] bg-[#131314] px-6 py-4">
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
          >
            Réinitialiser
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSaveSettings}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-all",
                canSaveSettings
                  ? "border-emerald-500/30 bg-emerald-500 text-white shadow-lg shadow-emerald-950/25 hover:bg-emerald-400 hover:border-emerald-500/50"
                  : "cursor-not-allowed border-white/10 bg-white/10 text-white/35",
              )}
            >
              <Save size={16} />
              Enregistrer
            </button>
          </div>
        </div>
      </motion.div>

      {showOllamaWizard && (
        <OllamaSetupWizard
          onComplete={handleOllamaWizardComplete}
          onClose={() => setShowOllamaWizard(false)}
        />
      )}
    </motion.div>
  );
}
