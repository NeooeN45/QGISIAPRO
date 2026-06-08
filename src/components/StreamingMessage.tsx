/**
 * Composant pour afficher un message en streaming temps réel
 * Curseur clignotant · Avatar glow pulsant · Micro-fade nouveaux chunks
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useStreamingStore } from "../stores/useStreamingStore";
import { useThinkingStore } from "../stores/useThinkingStore";
import { cn } from "@/src/lib/utils";
import { Sparkles } from "lucide-react";
import ReasoningPhasesView from "./ReasoningPhasesView";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StreamingMessageProps {
  className?: string;
}

/** Un chunk à afficher avec son propre fade-in */
interface TextChunk {
  id: number;
  text: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const CHUNK_FADE_DURATION_S = 0.15;

// ─── Sous-composants ──────────────────────────────────────────────────────────

/** Curseur | clignotant injecté à la fin du texte via CSS keyframe inline */
function BlinkingCursor() {
  return (
    <>
      {/* Keyframe déclarée une seule fois dans le head via une balise <style> */}
      <style>{`
        @keyframes qgis-cursor-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        .qgis-cursor {
          display: inline-block;
          width: 2px;
          height: 1.1em;
          background: linear-gradient(180deg, #34d399, #059669);
          margin-left: 2px;
          vertical-align: text-bottom;
          border-radius: 2px;
          animation: qgis-cursor-blink 0.9s step-start infinite;
        }
      `}</style>
      <span className="qgis-cursor text-emerald-400" aria-hidden />
    </>
  );
}

/** Avatar avec glow pulsant conditionnel */
function StreamingAvatar({ isPulsing }: { isPulsing: boolean }) {
  return (
    <div className="relative shrink-0">
      {/* Halo externe pulsant */}
      <AnimatePresence>
        {isPulsing && (
          <motion.div
            key="glow"
            className="absolute inset-0 rounded-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            style={{
              boxShadow: "0 0 18px 6px rgba(52,211,153,0.45)",
              borderRadius: "1rem",
            }}
          />
        )}
      </AnimatePresence>

      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-2xl border bg-gray-100 dark:bg-[#1e1f20] shadow-lg transition-colors duration-500",
          isPulsing
            ? "border-emerald-400/60 dark:border-emerald-500/40"
            : "border-gray-200 dark:border-[#333537]",
        )}
      >
        <motion.div
          animate={isPulsing ? { scale: [1, 1.1, 1] } : { scale: 1 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sparkles size={20} className="text-emerald-400" />
        </motion.div>
      </div>
    </div>
  );
}

/** Indicateur tokens/s + compteur de caractères */
function StreamingStats({
  tokensPerSecond,
  charCount,
}: {
  tokensPerSecond: number;
  charCount: number;
}) {
  return (
    <div className="flex items-center gap-3">
      {tokensPerSecond > 0 && (
        <motion.span
          key={tokensPerSecond}
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 1 }}
          className="text-xs text-gray-400 font-mono"
        >
          {tokensPerSecond} tok/s
        </motion.span>
      )}
      <span className="text-xs text-gray-400 font-mono">{charCount} car.</span>
    </div>
  );
}

// ─── Hook : découpe le texte en chunks animables ──────────────────────────────

function useTextChunks(streamedText: string, isStreaming: boolean) {
  const [chunks, setChunks] = useState<TextChunk[]>([]);
  const prevTextRef  = useRef<string>("");
  const chunkCounter = useRef<number>(0);

  const resetChunks = useCallback(() => {
    setChunks([]);
    prevTextRef.current  = "";
    chunkCounter.current = 0;
  }, []);

  useEffect(() => {
    if (!isStreaming && streamedText.length === 0) {
      resetChunks();
      return;
    }

    const prev    = prevTextRef.current;
    const current = streamedText;

    if (current.length > prev.length) {
      const delta = current.slice(prev.length);
      prevTextRef.current = current;
      chunkCounter.current += 1;

      setChunks((existing) => [
        ...existing,
        { id: chunkCounter.current, text: delta },
      ]);
    }
  }, [streamedText, isStreaming, resetChunks]);

  return chunks;
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function StreamingMessage({ className }: StreamingMessageProps) {
  const { isStreaming, streamedText, tokensPerSecond } = useStreamingStore();
  const { progress: thinkingProgress } = useThinkingStore();
  const scrollRef   = useRef<HTMLDivElement>(null);
  const contentRef  = useRef<HTMLDivElement>(null);
  const _chunks     = useTextChunks(streamedText, isStreaming); // suivi pour la réactivité

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    contentRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [streamedText]);

  const shouldRender = isStreaming || streamedText.length > 0;
  if (!shouldRender) return <div />;

  const combinedProgress = isStreaming
    ? Math.min(95 + streamedText.length / 100, 99)
    : thinkingProgress;

  return (
    <div
      ref={contentRef}
      className={cn("w-full max-w-3xl mx-auto", className)}
    >
      <div className="flex gap-4 md:gap-6">

        {/* ── Avatar pulsant ──────────────────────────────────────────────── */}
        <StreamingAvatar isPulsing={isStreaming} />

        {/* ── Bulle de contenu ────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="rounded-[28px] border border-gray-200 dark:border-[#333537]/40 bg-white dark:bg-[#1e1f20]/60 p-5 shadow-sm dark:backdrop-blur-sm">

            {/* Header */}
            <AnimatePresence>
              {isStreaming && (
                <motion.div
                  key="header"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{   opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-white/5 overflow-hidden"
                >
                  <div className="flex items-center gap-2">
                    {/* Dot pulsant */}
                    <motion.div
                      className="w-2 h-2 rounded-full bg-emerald-400"
                      animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                    <span className="text-xs font-medium text-emerald-500">
                      Génération en cours…
                    </span>
                  </div>

                  <StreamingStats
                    tokensPerSecond={tokensPerSecond}
                    charCount={streamedText.length}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Barre de progression */}
            <AnimatePresence>
              {isStreaming && (
                <motion.div
                  key="progress"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{   opacity: 0 }}
                  className="mb-3 overflow-hidden"
                >
                  <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 relative"
                      animate={{ width: `${combinedProgress}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      style={{
                        boxShadow: "0 0 8px 2px rgba(16,185,129,0.5)",
                      }}
                    >
                      {/* Shimmer */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                      />
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Zone texte ─────────────────────────────────────────────── */}
            <div
              ref={scrollRef}
              className="prose prose-invert prose-sm max-w-none overflow-y-auto max-h-[60vh] scrollbar-thin"
            >
              {/*
               * ReasoningPhasesView gère la mise en forme (phases, blocs code…).
               * Le micro-fade est obtenu via une clé CSS opacity appliquée sur
               * le texte entier lors de chaque nouveau chunk : on monte une
               * animation flash sur le conteneur père uniquement quand un delta
               * arrive, sans perturber la structure de ReasoningPhasesView.
               */}
              <motion.div
                key={_chunks.length}            // change à chaque nouveau chunk
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
              >
                <ReasoningPhasesView
                  text={streamedText}
                  isStreaming={isStreaming}
                />
              </motion.div>

              {/* Curseur clignotant inline après le texte */}
              {isStreaming && <BlinkingCursor />}
            </div>

            {/* Footer */}
            <AnimatePresence>
              {isStreaming && (
                <motion.div
                  key="footer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{   opacity: 0 }}
                  className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-white/5"
                >
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                  <span className="text-xs text-gray-400">En cours…</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
