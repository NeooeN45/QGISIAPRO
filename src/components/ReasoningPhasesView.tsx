/**
 * Affichage en temps reel des phases de raisonnement structure
 * [PLAN] / [EXECUTE] / [VERIFY] / [REPORT] produites par le LLM.
 *
 * Chaque phase apparait dans une bulle distincte avec couleur et icone
 * dediees, repliable. La phase REPORT (reponse finale) est mise en avant.
 *
 * Si le texte ne contient aucun marqueur, le composant retombe sur un
 * affichage texte brut pour la retrocompatibilite.
 */

import { useState } from "react";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ListChecks,
  PlayCircle,
  Search,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import {
  parseReasoning,
  type ReasoningPhase,
} from "../lib/reasoning-parser";

interface ReasoningPhasesViewProps {
  text: string;
  isStreaming?: boolean;
  className?: string;
}

const PHASE_META: Record<
  ReasoningPhase,
  {
    label: string;
    icon: typeof Brain;
    accent: string;
    bg: string;
    border: string;
    defaultOpen: boolean;
  }
> = {
  plan: {
    label: "Plan",
    icon: ListChecks,
    accent: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-500/8",
    border: "border-emerald-500/25",
    defaultOpen: true,
  },
  execute: {
    label: "Exécution",
    icon: PlayCircle,
    accent: "text-blue-500 dark:text-blue-400",
    bg: "bg-blue-500/8",
    border: "border-blue-500/25",
    defaultOpen: true,
  },
  verify: {
    label: "Vérification",
    icon: Search,
    accent: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-500/8",
    border: "border-amber-500/25",
    defaultOpen: false,
  },
  report: {
    label: "Réponse",
    icon: CheckCircle2,
    accent: "text-violet-500 dark:text-violet-400",
    bg: "bg-violet-500/8",
    border: "border-violet-500/25",
    defaultOpen: true,
  },
};

interface PhaseCardProps {
  phase: ReasoningPhase;
  content: string;
  isLast: boolean;
  isStreaming: boolean;
}

function PhaseCard({ phase, content, isLast, isStreaming }: PhaseCardProps) {
  const meta = PHASE_META[phase];
  const [open, setOpen] = useState(meta.defaultOpen);
  const Icon = meta.icon;
  const isActiveStreaming = isStreaming && isLast;

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 transition-all",
        meta.bg,
        meta.border,
        isActiveStreaming && "ring-1 ring-current animate-pulse-soft",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        {open ? (
          <ChevronDown size={14} className={meta.accent} />
        ) : (
          <ChevronRight size={14} className={meta.accent} />
        )}
        <Icon size={14} className={meta.accent} />
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.18em]",
            meta.accent,
          )}
        >
          {meta.label}
        </span>
        {!open && (
          <span className="ml-auto text-[10px] text-gray-400 dark:text-white/40">
            {content.length} car.
          </span>
        )}
        {isActiveStreaming && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-current">
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
            en cours
          </span>
        )}
      </button>
      {open && (
        <div className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700 dark:text-gray-200 font-light">
          {content}
          {isActiveStreaming && (
            <span className="inline-block w-2 h-4 bg-current ml-0.5 align-middle animate-pulse" />
          )}
        </div>
      )}
    </div>
  );
}

export default function ReasoningPhasesView({
  text,
  isStreaming = false,
  className,
}: ReasoningPhasesViewProps) {
  const parsed = parseReasoning(text);

  // Pas de marqueurs : fallback affichage brut (retrocompatibilite)
  if (!parsed.hasStructuredReasoning) {
    return (
      <div
        className={cn(
          "whitespace-pre-wrap text-[14px] leading-relaxed text-gray-700 dark:text-gray-200 font-light",
          className,
        )}
      >
        {text}
        {isStreaming && (
          <span className="inline-block w-2 h-5 bg-emerald-400 ml-0.5 align-middle animate-pulse" />
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gray-400 dark:text-white/40">
        <Brain size={11} />
        Raisonnement structure
      </div>
      {parsed.phases.map((phase, idx) => (
        <PhaseCard
          key={`${phase.phase}-${idx}`}
          phase={phase.phase}
          content={phase.content}
          isLast={idx === parsed.phases.length - 1}
          isStreaming={isStreaming}
        />
      ))}
    </div>
  );
}
