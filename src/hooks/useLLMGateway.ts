/**
 * Hook unifie pour parler au Gateway LLM.
 * Auto-injecte les cles BYOK depuis useGatewayStore.
 * Gere l'etat install / ready et expose chat / stream / models / budget.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  chat as gwChat,
  streamChat as gwStreamChat,
  streamToText as gwStreamToText,
  streamToTextResilient as gwStreamToTextResilient,
  listModels as gwListModels,
  getBudget as gwGetBudget,
  health as gwHealth,
  installGateway as gwInstall,
  getInstallStatus as gwGetInstallStatus,
  runDiagnostic as gwRunDiagnostic,
  installGatewaySync as gwInstallGatewaySync,
  smartProcess as gwSmartProcess,
  runAgent as gwRunAgent,
  refreshCredentialsStatus as gwRefreshCredentials,
  type ChatRequest,
  type ChatResponse,
  type ChatChunk,
  type ModelAlias,
  type BudgetSnapshot,
  type InstallStatus,
  type InstallLog,
  type DiagnosticInfo,
  type StreamResult,
  type SmartRequest,
  type SmartResult,
  type AgentRequest,
  type AgentLoopResult,
} from "../lib/litellm-client";
import { useGatewayStore } from "../stores/useGatewayStore";

export interface UseLLMGatewayResult {
  status: "unknown" | "installing" | "ready" | "error";
  ready: boolean;
  lastError?: string;
  defaultAlias: string;
  autoMode: boolean;
  installProgress: number;
  installLogs: InstallLog[];
  chat: (req: Omit<ChatRequest, "api_keys">) => Promise<ChatResponse>;
  streamChat: (req: Omit<ChatRequest, "api_keys">) => AsyncGenerator<ChatChunk, void, void>;
  streamToText: (
    req: Omit<ChatRequest, "api_keys">,
    onDelta?: (delta: string, full: string) => void,
  ) => Promise<string>;
  streamToTextResilient: (
    req: Omit<ChatRequest, "api_keys">,
    onDelta?: (delta: string, full: string) => void,
    onRetry?: (attempt: number, error: string) => void,
  ) => Promise<StreamResult>;
  smart: (req: Omit<SmartRequest, "api_keys">) => Promise<SmartResult>;
  runAgent: (req: Omit<AgentRequest, "api_keys">) => Promise<AgentLoopResult>;
  listModels: () => Promise<ModelAlias[]>;
  getBudget: () => Promise<BudgetSnapshot>;
  installGateway: () => Promise<void>;
  installGatewaySync: () => Promise<{ success: boolean; already_installed?: boolean; error?: string; logs?: InstallLog[] }>;
  refreshHealth: () => Promise<void>;
  getInstallStatus: () => Promise<InstallStatus | null>;
  runDiagnostic: () => Promise<DiagnosticInfo | null>;
}

export function useLLMGateway(): UseLLMGatewayResult {
  const config = useGatewayStore((s) => s.config);
  const getApiKeys = useGatewayStore((s) => s.getApiKeys);
  const setStatus = useGatewayStore((s) => s.setStatus);
  const checkedOnce = useRef(false);
  
  // États pour le suivi d'installation détaillé
  const [installProgress, setInstallProgress] = useState(0);
  const [installLogs, setInstallLogs] = useState<InstallLog[]>([]);
  const installPollRef = useRef<NodeJS.Timeout | null>(null);

  const refreshHealth = useCallback(async () => {
    try {
      const h = await gwHealth();
      setStatus(h.vendor_ready ? "ready" : "unknown");
    } catch (err) {
      setStatus("error", err instanceof Error ? err.message : String(err));
    }
  }, [setStatus]);
  
  const getInstallStatus = useCallback(async () => {
    try {
      const status = await gwGetInstallStatus();
      setInstallProgress(status.progress);
      setInstallLogs(status.logs);
      return status;
    } catch (err) {
      return null;
    }
  }, []);

  // Ping initial (une seule fois) + statut des clés persistées côté plugin
  useEffect(() => {
    if (checkedOnce.current) return;
    checkedOnce.current = true;
    void refreshHealth();
    void gwRefreshCredentials();
  }, [refreshHealth]);

  const chat = useCallback<UseLLMGatewayResult["chat"]>(
    (req) => gwChat({ ...req, api_keys: getApiKeys() }),
    [getApiKeys],
  );

  const streamChat = useCallback<UseLLMGatewayResult["streamChat"]>(
    (req) => gwStreamChat({ ...req, api_keys: getApiKeys() }),
    [getApiKeys],
  );

  const streamToText = useCallback<UseLLMGatewayResult["streamToText"]>(
    (req, onDelta) => gwStreamToText({ ...req, api_keys: getApiKeys() }, onDelta),
    [getApiKeys],
  );

  const streamToTextResilient = useCallback<UseLLMGatewayResult["streamToTextResilient"]>(
    (req, onDelta, onRetry) => gwStreamToTextResilient({ ...req, api_keys: getApiKeys() }, onDelta, onRetry),
    [getApiKeys],
  );

  const smart = useCallback<UseLLMGatewayResult["smart"]>(
    (req) => gwSmartProcess({ ...req, api_keys: getApiKeys() }),
    [getApiKeys],
  );

  const runAgent = useCallback<UseLLMGatewayResult["runAgent"]>(
    (req) => gwRunAgent({ ...req, api_keys: getApiKeys() }),
    [getApiKeys],
  );

  const listModels = useCallback(() => gwListModels(), []);
  const getBudget = useCallback(() => gwGetBudget(), []);

  const installGateway = useCallback(async () => {
    setStatus("installing");
    setInstallProgress(0);
    setInstallLogs([]);
    
    // Cleanup previous poll
    if (installPollRef.current) {
      clearInterval(installPollRef.current);
    }
    
    try {
      const result = await gwInstall();
      
      // Si deja installe, mettre immediatement a ready
      if (result.already_installed || result.status === "ready") {
        setStatus("ready");
        return;
      }
      
      // Poll détaillé toutes les 2s pendant 3 min max
      const deadline = Date.now() + 180_000;
      
      installPollRef.current = setInterval(async () => {
        const status = await getInstallStatus();
        if (status) {
          if (status.vendor_ready || status.done) {
            setStatus("ready");
            if (installPollRef.current) {
              clearInterval(installPollRef.current);
              installPollRef.current = null;
            }
          } else if (status.error) {
            setStatus("error", status.error);
            if (installPollRef.current) {
              clearInterval(installPollRef.current);
              installPollRef.current = null;
            }
          }
        }
        
        if (Date.now() > deadline) {
          setStatus("error", "Install timeout (3 min)");
          if (installPollRef.current) {
            clearInterval(installPollRef.current);
            installPollRef.current = null;
          }
        }
      }, 2000);
      
    } catch (err) {
      setStatus("error", err instanceof Error ? err.message : String(err));
    }
  }, [setStatus, getInstallStatus]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (installPollRef.current) {
        clearInterval(installPollRef.current);
      }
    };
  }, []);

  const installGatewaySync = useCallback(async () => {
    setStatus("installing");
    setInstallProgress(0);
    try {
      const result = await gwInstallGatewaySync();
      if (result.success) {
        setStatus("ready");
        setInstallProgress(100);
        if (result.logs) {
          setInstallLogs(result.logs);
        }
      } else {
        setStatus("error", result.error || "Installation échouée");
      }
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      setStatus("error", error);
      return { success: false, error };
    }
  }, [setStatus]);

  const runDiagnostic = useCallback(async () => {
    try {
      return await gwRunDiagnostic();
    } catch (err) {
      return null;
    }
  }, []);

  return {
    status: config.status,
    ready: config.status === "ready",
    lastError: config.lastError,
    defaultAlias: config.defaultAlias,
    autoMode: config.autoMode,
    installProgress,
    installLogs,
    chat,
    streamChat,
    streamToText,
    streamToTextResilient,
    smart,
    runAgent,
    listModels,
    getBudget,
    installGateway,
    installGatewaySync,
    refreshHealth,
    getInstallStatus,
    runDiagnostic,
  };
}
