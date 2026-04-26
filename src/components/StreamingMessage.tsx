/**
 * Composant pour afficher un message en streaming temps réel
 * Affiche le texte au fur et à mesure qu'il arrive du LLM
 * S'intègre parfaitement avec le design du Chat
 */

import { useEffect, useRef } from "react";
import { useStreamingStore } from "../stores/useStreamingStore";
import { useThinkingStore } from "../stores/useThinkingStore";
import { cn } from "@/src/lib/utils";
import { Loader2, Sparkles } from "lucide-react";
import ReasoningPhasesView from "./ReasoningPhasesView";

interface StreamingMessageProps {
  className?: string;
}

export default function StreamingMessage({ className }: StreamingMessageProps) {
  const { isStreaming, streamedText, tokensPerSecond } = useStreamingStore();
  const { progress: thinkingProgress } = useThinkingStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le bas quand le texte augmente
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // Scroll global du chat aussi
    if (contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [streamedText]);

  // Afficher dès qu'on est en streaming (même sans texte encore) ou qu'il y a du texte
  const shouldRender = isStreaming || streamedText.length > 0;
  
  // Si on ne devrait pas rendre, retourner une div vide pour permettre les animations
  if (!shouldRender) {
    return <div />;
  }

  // Calculer la progression combinée (thinking + streaming)
  const combinedProgress = isStreaming 
    ? Math.min(95 + (streamedText.length / 100), 99) // Progression basée sur taille texte
    : thinkingProgress;

  return (
    <div
      ref={contentRef}
      className={cn(
        "w-full max-w-3xl mx-auto",
        className
      )}
    >
      <div className="flex gap-4 md:gap-6">
        {/* Avatar QGISAI+ - simplifié */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-gray-200 dark:border-[#333537] bg-gray-100 dark:bg-[#1e1f20] shadow-lg">
          <Sparkles size={20} className="text-emerald-400" />
        </div>

        {/* Contenu du message */}
        <div className="flex-1 min-w-0">
          <div className="rounded-[28px] border border-gray-200 dark:border-[#333537]/40 bg-white dark:bg-[#1e1f20]/60 p-5 shadow-sm dark:backdrop-blur-sm">
            {/* Header avec statut - disparaît quand streaming terminé */}
            {isStreaming && (
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="text-emerald-400 animate-spin" />
                  <span className="text-xs font-medium text-emerald-500">
                    Génération en cours...
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  {tokensPerSecond > 0 && (
                    <span className="text-xs text-gray-400 font-mono">
                      {tokensPerSecond} tok/s
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {streamedText.length} caractères
                  </span>
                </div>
              </div>
            )}

            {/* Barre de progression - disparaît quand streaming terminé */}
            {isStreaming && (
              <div className="mb-3">
                <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                    style={{ width: `${combinedProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Texte streaming : phases [PLAN]/[EXECUTE]/[VERIFY]/[REPORT]
                en bulles distinctes si presentes, sinon texte brut */}
            <div
              ref={scrollRef}
              className="prose prose-invert prose-sm max-w-none overflow-y-auto max-h-[60vh] scrollbar-thin"
            >
              <ReasoningPhasesView
                text={streamedText}
                isStreaming={isStreaming}
              />
            </div>

            {/* Footer simple - disparaît quand streaming terminé */}
            {isStreaming && (
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-white/5">
                <Loader2 size={14} className="text-emerald-400 animate-spin" />
                <span className="text-xs text-gray-400">
                  En cours...
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
