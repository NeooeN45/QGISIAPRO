/**
 * Barre d'etat agent : mode, alias, budget, requetes, statut gateway.
 * Fine, fixee en bas du chat. Poll getBudget toutes les 60s.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useGatewayStore } from "../stores/useGatewayStore";
import { useLLMGateway } from "../hooks/useLLMGateway";
import type { BudgetSnapshot } from "../lib/litellm-client";

export interface AgentStatusBarProps {
  budgetFetcher?: () => Promise<BudgetWithWarn>;
}

type BudgetWithWarn = BudgetSnapshot & {
  limits?: BudgetSnapshot["limits"] & { warn_at_percent?: number };
};

const POLL_INTERVAL_MS = 60_000;
const DEFAULT_WARN_AT_PERCENT = 80;

function AgentStatusBar({ budgetFetcher }: AgentStatusBarProps) {
  const { status, ready, lastError, getBudget } = useLLMGateway();
  const config = useGatewayStore((s) => s.config);

  const [budget, setBudget] = useState<BudgetWithWarn | null>(null);

  const fetcher = useMemo(() => budgetFetcher ?? getBudget, [budgetFetcher, getBudget]);

  const fetchBudget = useCallback(async () => {
    if (!ready) return;
    try {
      const b = await fetcher();
      setBudget(b);
    } catch {
      // silent fail — la barre reste sur les dernieres donnees connues
    }
  }, [ready, fetcher]);

  useEffect(() => {
    fetchBudget();
    if (!ready) return;
    const id = setInterval(fetchBudget, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchBudget, ready]);

  // Mode actif
  const modeLabel = config.agentMode
    ? "Mode Action"
    : config.federationMode
      ? "SIG Intelligent"
      : config.useGateway
        ? "Gateway"
        : "Gateway";

  const modeColor = config.agentMode
    ? "bg-red-500"
    : config.federationMode
      ? "bg-blue-500"
      : "bg-emerald-500";

  // Budget
  const dailyMax = budget?.limits?.daily_max_usd ?? 0;
  const warnPercent = budget?.limits?.warn_at_percent ?? DEFAULT_WARN_AT_PERCENT;
  const totalUsd = budget?.total_usd ?? 0;
  const requestCount = budget?.request_count ?? 0;

  const percentUsed = dailyMax > 0 ? (totalUsd / dailyMax) * 100 : 0;

  const budgetBarColor =
    percentUsed >= 100
      ? "bg-red-500"
      : percentUsed >= warnPercent
        ? "bg-orange-500"
        : "bg-emerald-500";

  // Statut
  const statusColor =
    status === "ready"
      ? "bg-emerald-500"
      : status === "installing"
        ? "bg-orange-500 animate-pulse"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-4 border-t border-white/10 bg-[#131314] px-4 py-2 text-xs text-white/70">
      {/* Mode actif */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`h-2 w-2 rounded-full ${modeColor}`} />
        <span className="font-medium">{modeLabel}</span>
      </div>

      {/* Alias modèle */}
      <div className="truncate max-w-[120px] shrink-0" title={config.defaultAlias}>
        {config.defaultAlias}
      </div>

      {/* Barre de budget */}
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <span className="shrink-0">Budget</span>
        <div className="h-2 flex-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${budgetBarColor}`}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
            data-testid="budget-bar"
          />
        </div>
        <span className="shrink-0 tabular-nums">
          ${totalUsd.toFixed(2)} / ${dailyMax.toFixed(2)}
        </span>
      </div>

      {/* Requêtes */}
      <div className="shrink-0 tabular-nums">{requestCount} req</div>

      {/* Statut gateway */}
      <div
        className="flex items-center gap-2 shrink-0"
        title={lastError || "Gateway OK"}
        data-testid="status-dot"
      >
        <span className={`h-2 w-2 rounded-full ${statusColor}`} />
        <span className="capitalize">{status}</span>
      </div>
    </div>
  );
}

export default memo(AgentStatusBar);
