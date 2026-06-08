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
import { motion, AnimatePresence } from "motion/react";
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
    scanColor: string;
    defaultOpen: boolean;
  }
> = {
  plan: {
    label: "Plan",
    icon: ListChecks,
    accent: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-500/8",
    border: "border-emerald-500/25",
    scanColor: "#10b981",
    defaultOpen: true,
  },
  execute: {
    label: "Exécution",
    icon: PlayCircle,
    accent: "text-blue-500 dark:text-blue-400",
    bg: "bg-blue-500/8",
    border: "border-blue-500/25",
    scanColor: "#3b82f6",
    defaultOpen: true,
  },
  verify: {
    label: "Vérification",
    icon: Search,
    accent: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-500/8",
    border: "border-amber-500/25",
    scanColor: "#f59e0b",
    defaultOpen: false,
  },
  report: {
    label: "Réponse",
    icon: CheckCircle2,
    accent: "text-violet-500 dark:text-violet-400",
    bg: "bg-violet-500/8",
    border: "border-violet-500/25",
    scanColor: "#8b5cf6",
    defaultOpen: true,
  },
};

interface PhaseCardProps {
  phase: ReasoningPhase;
  content: string;
  isLast: boolean;
  isStreaming: boolean;
  /** Index dans la liste pour le stagger */
  index: number;
  /** Phase terminée (non-streaming ou pas la dernière) */
  isComplete: boolean;
}

function PhaseCard({ phase, content, isLast, isStreaming, index, isComplete }: PhaseCardProps) {
  const meta = PHASE_META[phase];
  const [open, setOpen] = useState(meta.defaultOpen);
  const Icon = meta.icon;
  const isActiveStreaming = isStreaming && isLast;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.1,
        duration: 0.35,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className={cn(
        "relative overflow-hidden rounded-2xl border px-4 py-3 transition-all",
        meta.bg,
        meta.border,
      )}
    >
      {/* Scanning border effect sur la phase active */}
      {isActiveStreaming && (
        <motion.div
          className="pointer-events-none absolute left-0 top-0 w-0.5 rounded-l-2xl"
          style={{ backgroundColor: meta.scanColor }}
          animate={{ top: ["0%", "100%", "0%"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          layoutId={`scanner-${phase}`}
        >
          {/* Hauteur du scanner = 30% du parent */}
          <div className="h-[30px] w-0.5 rounded-full" style={{ boxShadow: `0 0 8px ${meta.scanColor}` }} />
        </motion.div>
      )}

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

        {/* Checkmark spring pour phase complète */}
        <AnimatePresence>
          {isComplete && (
            <motion.span
              key="checkmark"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              className="ml-1 text-emerald-400"
            >
              <CheckCircle2 size={12} />
            </motion.span>
          )}
        </AnimatePresence>

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
    </motion.div>
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gray-400 dark:text-white/40"
      >
        <Brain size={11} />
        Raisonnement structure
      </motion.div>
      {parsed.phases.map((phase, idx) => (
        <PhaseCard
          key={`${phase.phase}-${idx}`}
          phase={phase.phase}
          content={phase.content}
          isLast={idx === parsed.phases.length - 1}
          isStreaming={isStreaming}
          index={idx}
          isComplete={!isStreaming || idx < parsed.phases.length - 1}
        />
      ))}
    </div>
  );
}
