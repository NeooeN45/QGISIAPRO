/**
 * Panneau Settings "Gateway IA" — gestion BYOK de 10 providers + install wizard.
 *
 * Respecte la charte D5 (BYOK) : toutes les cles restent chiffrees cote client,
 * envoyees au backend uniquement au moment de l'appel LLM.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertCircle, CheckCircle2, Cloud, Cpu, Download,
  ExternalLink, Eye, EyeOff, FileText, Key, Loader2, RefreshCw, Sparkles,
  Terminal, Wallet, Zap,
} from "lucide-react";
import { cn } from "../lib/utils";
import { maskApiKey } from "../lib/encryption";
import type { ApiKeys, BudgetSnapshot, ModelAlias, LayerImportLog } from "../lib/litellm-client";
import { useGatewayStore } from "../stores/useGatewayStore";
import { useLLMGateway } from "../hooks/useLLMGateway";

interface ProviderDef {
  key: keyof ApiKeys;
  label: string;
  icon: typeof Key;
  placeholder: string;
  helpUrl: string;
  helpText: string;
  free?: boolean;
  recommended?: boolean;
}

const PROVIDERS: ProviderDef[] = [
  {
    key: "openrouter", label: "OpenRouter", icon: Cloud,
    placeholder: "sk-or-v1-...",
    helpUrl: "https://openrouter.ai/keys",
    helpText: "500+ modeles unifies (Claude, GPT, Gemini, Llama, DeepSeek...)",
    recommended: true,
  },
  {
    key: "gemini", label: "Google Gemini", icon: Sparkles,
    placeholder: "AIza...",
    helpUrl: "https://aistudio.google.com/apikey",
    helpText: "Gemini 2.5 Flash & Pro - tier gratuit genereux",
    free: true, recommended: true,
  },
  {
    key: "groq", label: "Groq (LPU ultra-rapide)", icon: Zap,
    placeholder: "gsk_...",
    helpUrl: "https://console.groq.com/keys",
    helpText: "Inference LPU - le plus rapide du marche, gratuit",
    free: true, recommended: true,
  },
  {
    key: "nvidia_nim", label: "NVIDIA NIM (Developer Program)", icon: Cpu,
    placeholder: "nvapi-...",
    helpUrl: "https://build.nvidia.com/",
    helpText: "Nemotron 70B reasoning + Llama 3.1 NIM - API endpoints gratuits via NVIDIA Developer Program",
    free: true,
    recommended: true,
  },
  {
    key: "anthropic", label: "Anthropic Claude (direct)", icon: Sparkles,
    placeholder: "sk-ant-...",
    helpUrl: "https://console.anthropic.com/settings/keys",
    helpText: "Claude 3.5 Sonnet / Opus en direct",
  },
  {
    key: "openai", label: "OpenAI (direct)", icon: Sparkles,
    placeholder: "sk-...",
    helpUrl: "https://platform.openai.com/api-keys",
    helpText: "GPT-4o, o1, embeddings OpenAI",
  },
  {
    key: "mistral", label: "Mistral AI", icon: Sparkles,
    placeholder: "...",
    helpUrl: "https://console.mistral.ai/api-keys/",
    helpText: "Mistral Large, Pixtral - francais natif",
  },
  {
    key: "cerebras", label: "Cerebras", icon: Zap,
    placeholder: "csk-...",
    helpUrl: "https://cloud.cerebras.ai/",
    helpText: "Inference WSE - latence record",
  },
  {
    key: "huggingface", label: "HuggingFace", icon: Cloud,
    placeholder: "hf_...",
    helpUrl: "https://huggingface.co/settings/tokens",
    helpText: "Inference Endpoints HuggingFace",
  },
];

export function GatewaySettingsPanel() {
  const config = useGatewayStore((s) => s.config);
  const setApiKey = useGatewayStore((s) => s.setApiKey);
  const clearApiKey = useGatewayStore((s) => s.clearApiKey);
  const setDefaultAlias = useGatewayStore((s) => s.setDefaultAlias);
  const setUseGateway = useGatewayStore((s) => s.setUseGateway);
  const setAutoMode = useGatewayStore((s) => s.setAutoMode);
  const setFederationMode = useGatewayStore((s) => s.setFederationMode);
  const setAgentMode = useGatewayStore((s) => s.setAgentMode);

  const gw = useLLMGateway();
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [aliases, setAliases] = useState<ModelAlias[]>([]);
  const [budget, setBudget] = useState<BudgetSnapshot | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [diagnostic, setDiagnostic] = useState<{
    python_version: string; platform: string; plugin_dir: string;
    vendor_dir: string; vendor_exists: boolean; marker_exists: boolean;
    vendor_ready: boolean; sys_path: string[]; pip_path: string | null;
    debug_file?: string | null;
    layer_import_logs: LayerImportLog[];
    layer_import_error_count: number;
  } | null>(null);
  const [localLogs, setLocalLogs] = useState<{stage: string; message: string; level: string; time: number}[]>([]);
  const [installing, setInstalling] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Polling temps réel des logs pendant l'installation
  const startLogPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const s = await gw.getInstallStatus();
      if (!s) return;
      if (s.logs && s.logs.length > 0) setLocalLogs(s.logs);
      if (s.vendor_ready || s.done || s.error) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setInstalling(false);
        void gw.refreshHealth();
      }
    }, 1500);
  }, [gw]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const countConfigured = useMemo(() => {
    return PROVIDERS.filter((p) => Boolean(config.apiKeys[p.key])).length;
  }, [config.apiKeys]);

  useEffect(() => {
    if (!gw.ready) return;
    setLoadingModels(true);
    gw.listModels()
      .then(setAliases)
      .catch(() => setAliases([]))
      .finally(() => setLoadingModels(false));
    gw.getBudget().then(setBudget).catch(() => setBudget(null));
  }, [gw.ready]);

  const ollamaUrl = config.apiKeys.ollama_base_url ?? "";

  return (
    <div className="space-y-6">
      {/* === Status card === */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-950">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              "flex h-11 w-11 items-center justify-center rounded-lg",
              gw.status === "ready" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
              gw.status === "installing" && "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
              gw.status === "error" && "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
              (gw.status === "unknown" || !gw.status) && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
            )}>
              {gw.status === "ready" && <CheckCircle2 className="h-6 w-6" />}
              {gw.status === "installing" && <Loader2 className="h-6 w-6 animate-spin" />}
              {gw.status === "error" && <AlertCircle className="h-6 w-6" />}
              {(gw.status === "unknown" || !gw.status) && <Activity className="h-6 w-6" />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Gateway IA
                <span className="ml-2 rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                  BYOK
                </span>
              </h3>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                {gw.status === "ready" && `Pret. ${countConfigured}/${PROVIDERS.length} providers configures.`}
                {gw.status === "installing" && "Installation des dependances IA (~30-60s)..."}
                {gw.status === "error" && (gw.lastError || "Erreur d'installation")}
                {(gw.status === "unknown" || !gw.status) && "Cliquez sur Installer pour preparer l'IA."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {!gw.ready && !installing && (
              <button
                onClick={async () => {
                  setInstalling(true);
                  setLocalLogs([{ stage: "api", message: "Démarrage...", level: "info", time: Date.now() }]);
                  setShowLogs(true);
                  startLogPolling();
                  const result = await gw.installGatewaySync();
                  if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
                  setInstalling(false);
                  if (result?.logs?.length) setLocalLogs(result.logs);
                  if (result?.success) void gw.refreshHealth();
                  else setLocalLogs(prev => [...prev, { stage: "error", message: result?.error ?? "Échec inconnu", level: "error", time: Date.now() }]);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
                disabled={installing}
              >
                {installing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {installing ? "Installation..." : "Installer"}
              </button>
            )}
            <button
              onClick={async () => {
                const d = await gw.runDiagnostic();
                if (d) setDiagnostic(d);
                setShowDiagnostic(true);
              }}
              title="Diagnostic système"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Terminal className="h-4 w-4" />
            </button>
            <button
              onClick={() => void gw.refreshHealth()}
              title="Verifier l'etat"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Barre de progression + toggle logs */}
        {(installing || localLogs.length > 0) && (
          <div className="mt-4">
            {installing && (
              <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className="h-full animate-pulse bg-indigo-500 transition-all" style={{ width: localLogs.length > 3 ? "70%" : "30%" }} />
              </div>
            )}
            <button
              onClick={() => setShowLogs(v => !v)}
              className="mt-1 flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <Terminal className="h-3 w-3" />
              {showLogs ? "Masquer" : "Afficher"} les logs ({localLogs.length})
            </button>
          </div>
        )}
        
        {/* Logs d'installation - utilise localLogs si disponible, sinon gw.installLogs */}
        {showLogs && (localLogs.length > 0 || gw.installLogs.length > 0) && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Logs d'installation:</span>
              {localLogs.length > 0 && (
                <button 
                  onClick={() => setLocalLogs([])}
                  className="text-[10px] text-slate-400 hover:text-slate-600"
                >
                  Effacer
                </button>
              )}
            </div>
            <div className="max-h-40 overflow-y-auto font-mono text-[11px] leading-tight">
              {(localLogs.length > 0 ? localLogs : gw.installLogs).map((log, i) => (
                <div 
                  key={i} 
                  className={
                    log.level === "error" ? "text-rose-600" : 
                    log.level === "warning" ? "text-amber-600" : 
                    "text-slate-600 dark:text-slate-400"
                  }
                >
                  <span className="opacity-60">[{log.stage}]</span> {log.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* === Toggles === */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ToggleCard
          title="Utiliser le Gateway"
          description="Active le routage unifie via LiteLLM (remplace les clients existants)"
          checked={config.useGateway}
          onChange={setUseGateway}
          accent="indigo"
        />
        <ToggleCard
          title="Mode Auto"
          description="L'IA enchaine les actions sans confirmation (destructif toujours confirme)"
          checked={config.autoMode}
          onChange={setAutoMode}
          accent="amber"
        />
        <ToggleCard
          title="Mode SIG Intelligent (fédération)"
          description="Route chaque demande vers le meilleur agent NVIDIA (code, vision, raisonnement...). Nécessite le Gateway actif."
          checked={config.federationMode}
          onChange={setFederationMode}
          accent="indigo"
        />
        <ToggleCard
          title="Mode Action (outils QGIS)"
          description="L'agent appelle directement les outils QGIS (couches, filtres, zoom, style...). Actions destructives filtrées par la sécurité (Mode Auto pour les autoriser)."
          checked={config.agentMode}
          onChange={setAgentMode}
          accent="amber"
        />
      </div>

      {/* === Modele par defaut === */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
          Modele par defaut
        </label>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Alias de routage. L'IA s'adaptera automatiquement selon la tache (vision, code, intent...).
        </p>
        <select
          value={config.defaultAlias}
          onChange={(e) => setDefaultAlias(e.target.value)}
          disabled={loadingModels || aliases.length === 0}
          className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          {aliases.length === 0 && <option value={config.defaultAlias}>{config.defaultAlias}</option>}
          {aliases.map((a) => (
            <option key={a.alias} value={a.alias}>
              {a.alias} {a.description ? `— ${a.description}` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* === Providers BYOK === */}
      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Cles API (BYOK)
        </h4>
        <div className="space-y-2">
          {PROVIDERS.map((p) => {
            const value = config.apiKeys[p.key] ?? "";
            const Icon = p.icon;
            const isShown = shown[p.key as string];
            return (
              <div
                key={p.key}
                className={cn(
                  "rounded-lg border bg-white p-4 transition dark:bg-slate-900",
                  value
                    ? "border-emerald-200 dark:border-emerald-900"
                    : "border-slate-200 dark:border-slate-700",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {p.label}
                      </span>
                      {p.free && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                          GRATUIT
                        </span>
                      )}
                      {p.recommended && (
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                          RECOMMANDE
                        </span>
                      )}
                      {value && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {p.helpText}
                    </p>
                  </div>
                  <a
                    href={p.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Obtenir <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="mt-3 flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={isShown ? "text" : "password"}
                      value={value}
                      onChange={(e) => setApiKey(p.key, e.target.value)}
                      placeholder={p.placeholder}
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm font-mono shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShown((s) => ({ ...s, [p.key as string]: !isShown }))}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {isShown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {value && (
                    <button
                      onClick={() => clearApiKey(p.key)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                      Effacer
                    </button>
                  )}
                </div>
                {value && !isShown && (
                  <p className="mt-1 font-mono text-[11px] text-slate-400">{maskApiKey(value)}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* === Ollama === */}
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Ollama (local)</span>
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              OFFLINE
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            URL de l'instance Ollama locale (aucune cle requise)
          </p>
          <input
            type="text"
            value={ollamaUrl}
            onChange={(e) => setApiKey("ollama_base_url", e.target.value)}
            placeholder="http://localhost:11434"
            className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
      </div>

      {/* === Budget === */}
      {budget && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-slate-500" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Budget journalier ({budget.day})
            </h4>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              ${budget.total_usd.toFixed(4)}
            </span>
            {budget.limits?.daily_max_usd !== undefined && (
              <span className="text-sm text-slate-500">
                / ${budget.limits.daily_max_usd.toFixed(2)} max
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {budget.request_count} requetes aujourd'hui
          </p>
        </div>
      )}

      {/* === Diagnostic === */}
      {showDiagnostic && diagnostic && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-slate-500" />
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Diagnostic Système</h4>
            </div>
            <button
              onClick={() => setShowDiagnostic(false)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Masquer
            </button>
          </div>
          <div className="mt-3 space-y-2 font-mono text-[11px] leading-relaxed">
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <span className="text-slate-500">Platform:</span>
              <span className="text-slate-700 dark:text-slate-300">{diagnostic.platform}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <span className="text-slate-500">Python:</span>
              <span className="text-slate-700 dark:text-slate-300 truncate" title={diagnostic.python_version}>
                {diagnostic.python_version.split(' ')[0]}
              </span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <span className="text-slate-500">Plugin:</span>
              <span className="text-slate-700 dark:text-slate-300 truncate" title={diagnostic.plugin_dir}>
                {diagnostic.plugin_dir}
              </span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <span className="text-slate-500">Vendor:</span>
              <span className={diagnostic.vendor_exists ? "text-emerald-600" : "text-rose-600"}>
                {diagnostic.vendor_exists ? "Existe" : "Manquant"} | {diagnostic.vendor_ready ? "Prêt" : "Non prêt"}
              </span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <span className="text-slate-500">Marker:</span>
              <span className={diagnostic.marker_exists ? "text-emerald-600" : "text-rose-600"}>
                {diagnostic.marker_exists ? "Présent" : "Absent"}
              </span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <span className="text-slate-500">pip:</span>
              <span className="text-slate-700 dark:text-slate-300">{diagnostic.pip_path || "Non détecté"}</span>
            </div>
          </div>

          {/* Logs d'import de couche */}
          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-slate-500" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Erreurs d'import de couche
                  {diagnostic.layer_import_error_count > 0 && (
                    <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                      {diagnostic.layer_import_error_count}
                    </span>
                  )}
                </h4>
              </div>
              {diagnostic.layer_import_error_count > 0 && (
                <button
                  onClick={async () => {
                    // Appel pour effacer les logs
                    try {
                      await fetch("/api/qgis/clearLayerImportLogs", { method: "POST" });
                      setDiagnostic(prev => prev ? { ...prev, layer_import_logs: [], layer_import_error_count: 0 } : null);
                    } catch { /* ignore */ }
                  }}
                  className="text-xs text-slate-500 hover:text-rose-600"
                >
                  Effacer
                </button>
              )}
            </div>

            {diagnostic.layer_import_logs && diagnostic.layer_import_logs.length > 0 ? (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-rose-200 bg-rose-50 p-2 dark:border-rose-900 dark:bg-rose-950/30">
                {diagnostic.layer_import_logs.map((log, i) => (
                  <div key={i} className="mb-2 text-[11px] last:mb-0">
                    <div className="flex items-center gap-1 text-rose-700 dark:text-rose-400">
                      <span className="font-mono opacity-60">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span className="font-semibold">[{log.source}]</span>
                    </div>
                    <div className="text-slate-700 dark:text-slate-300">{log.layer_name}</div>
                    <div className="text-rose-600 dark:text-rose-400">{log.error}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Aucune erreur d'import enregistrée.</p>
            )}
          </div>

          {diagnostic.debug_file && (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <FileText className="h-3 w-3" />
              <span>Log fichier: {diagnostic.debug_file}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface ToggleCardProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  accent: "indigo" | "amber";
}

function ToggleCard({ title, description, checked, onChange, accent }: ToggleCardProps) {
  const accentClass =
    accent === "indigo"
      ? "peer-checked:bg-indigo-600"
      : "peer-checked:bg-amber-500";
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</div>
        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</div>
      </div>
      <div className="relative shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <div className={cn(
          "h-6 w-11 rounded-full bg-slate-300 transition-colors dark:bg-slate-700",
          accentClass,
        )} />
        <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </div>
    </label>
  );
}
