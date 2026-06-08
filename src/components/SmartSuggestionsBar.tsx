/**
 * Barre de suggestions contextuelles intelligentes
 * S'affiche au-dessus du champ de saisie avec des suggestions basées sur le contexte
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers,
  Zap,
  Trees,
  MapPin,
  Download,
  Grid3X3,
  ArrowRight,
  FileText,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  X,
  TrendingUp,
  Loader2,
  Brain,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useSmartSuggestionsStore, SmartSuggestion, SuggestionType } from "../stores/useSmartSuggestionsStore";

interface SmartSuggestionsBarProps {
  input: string;
  onSuggestionClick: (suggestion: string) => void;
  layers: string[];
  selectedLayers: string[];
  lastIntent?: string;
  className?: string;
}

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Layers,
  Zap,
  Trees,
  MapPin,
  Download,
  Grid3X3,
  ArrowRight,
  FileText,
  Sparkles,
  TrendingUp,
};

const typeColors: Record<SuggestionType, string> = {
  layer:        "from-blue-500 to-cyan-500",
  action:       "from-emerald-500 to-teal-500",
  parameter:    "from-amber-500 to-orange-500",
  "follow-up":  "from-violet-500 to-purple-500",
  template:     "from-gray-500 to-slate-500",
};

const typeBgColors: Record<SuggestionType, string> = {
  layer:        "bg-blue-500/10 border-blue-500/20",
  action:       "bg-emerald-500/10 border-emerald-500/20",
  parameter:    "bg-amber-500/10 border-amber-500/20",
  "follow-up":  "bg-violet-500/10 border-violet-500/20",
  template:     "bg-slate-500/10 border-slate-500/20",
};

/** Durée du shimmer sur chaque nouvelle suggestion (ms) */
const SHIMMER_DURATION_MS = 1000;

/** Chip individuelle avec shimmer + translateY hover */
interface SuggestionChipProps {
  suggestion: SmartSuggestion;
  isSelected: boolean;
  isNew: boolean;
  onSelect: () => void;
  onHover: () => void;
}

function SuggestionChip({ suggestion, isSelected, isNew, onSelect, onHover }: SuggestionChipProps) {
  const Icon = iconMap[suggestion.icon ?? "Zap"] ?? Zap;

  return (
    <motion.button
      onClick={onSelect}
      onMouseEnter={onHover}
      /* Entrée staggerée depuis le bas */
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6, scale: 0.95 }}
      /* Hover : on lève la chip de 2px */
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      className={cn(
        "relative flex flex-shrink-0 items-center gap-2 overflow-hidden rounded-xl border px-3 py-2 text-sm",
        "transition-colors",
        isSelected
          ? cn("border", typeBgColors[suggestion.type], "text-white")
          : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:text-white",
      )}
    >
      {/* Shimmer overlay sur nouvelle suggestion */}
      {isNew && (
        <motion.span
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent"
          animate={{ x: ["−100%", "200%"] }}
          transition={{ duration: SHIMMER_DURATION_MS / 1000, ease: "easeInOut" }}
        />
      )}

      {/* Icône avec gradient */}
      <span
        className={cn(
          "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br",
          typeColors[suggestion.type],
        )}
      >
        <Icon size={11} className="text-white" />
      </span>

      <span className="max-w-[200px] truncate font-medium">
        {suggestion.text}
      </span>

      {suggestion.confidence > 0.8 && (
        <span className="text-[10px] text-emerald-400/70 font-medium">
          {(suggestion.confidence * 100).toFixed(0)}%
        </span>
      )}
    </motion.button>
  );
}

export default function SmartSuggestionsBar({
  input,
  onSuggestionClick,
  layers,
  selectedLayers,
  lastIntent,
  className,
}: SmartSuggestionsBarProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [newSuggestionIds, setNewSuggestionIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const prevSuggestionIdsRef = useRef<Set<string>>(new Set());

  const {
    suggestions,
    isVisible,
    isProcessing,
    processingText,
    generateSuggestions,
    acceptSuggestion,
    dismissSuggestion,
    updateContext,
  } = useSmartSuggestionsStore();

  /* ─── Détection des nouvelles suggestions pour shimmer ─── */
  useEffect(() => {
    const incoming = new Set(suggestions.map((s) => s.id));
    const brandNew = new Set<string>();
    incoming.forEach((id) => {
      if (!prevSuggestionIdsRef.current.has(id)) brandNew.add(id);
    });
    if (brandNew.size > 0) {
      setNewSuggestionIds(brandNew);
      const timer = window.setTimeout(
        () => setNewSuggestionIds(new Set()),
        SHIMMER_DURATION_MS + 100,
      );
      return () => window.clearTimeout(timer);
    }
    prevSuggestionIdsRef.current = incoming;
  }, [suggestions]);

  /* ─── Mettre à jour le contexte et générer les suggestions ─── */
  const prevInputRef = useRef(input);
  useEffect(() => {
    if (prevInputRef.current === input && !isProcessing) return;
    prevInputRef.current = input;

    updateContext({ layers, selectedLayers, lastIntent });
    generateSuggestions(input, {
      layers,
      selectedLayers,
      lastIntent,
      lastActions: [],
      conversationCount: 0,
      userPreferences: {},
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, layers, selectedLayers, lastIntent, isProcessing]);

  /* ─── Gestion du clavier ─── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible || suggestions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % suggestions.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
          break;
        case "Tab":
          if (!e.shiftKey) {
            e.preventDefault();
            const s = suggestions[selectedIndex];
            if (s) handleSuggestionClick(s);
          }
          break;
        case "Enter":
          if (isVisible) {
            e.preventDefault();
            const s = suggestions[selectedIndex];
            if (s) handleSuggestionClick(s);
          }
          break;
        case "Escape":
          dismissSuggestion(suggestions[selectedIndex]?.id ?? "");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, suggestions, selectedIndex]);

  const handleSuggestionClick = useCallback(
    (suggestion: SmartSuggestion) => {
      acceptSuggestion(suggestion.id);
      onSuggestionClick(suggestion.text);
    },
    [acceptSuggestion, onSuggestionClick],
  );

  /* ─── Scroll horizontal < > ─── */
  const scrollChips = (direction: "left" | "right") => {
    const el = chipsRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "right" ? 180 : -180, behavior: "smooth" });
  };

  /* ─── Grouper par catégorie (mode expanded uniquement) ─── */
  const groupedSuggestions = suggestions.reduce<Record<string, SmartSuggestion[]>>(
    (acc, suggestion) => {
      const category = suggestion.category ?? "Autres";
      if (!acc[category]) acc[category] = [];
      acc[category].push(suggestion);
      return acc;
    },
    {},
  );
  const categories = Object.keys(groupedSuggestions);

  /* ─── État processing ─── */
  if (isProcessing) {
    return (
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={cn("absolute bottom-full left-0 right-0 mb-2 z-50", className)}
      >
        <div className="mx-4 mb-2">
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-900/90 to-teal-900/90 backdrop-blur-xl rounded-xl border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
            <div className="relative">
              <Loader2 size={18} className="text-emerald-400 animate-spin" />
              <div className="absolute inset-0 blur-sm">
                <Loader2 size={18} className="text-emerald-400 animate-spin" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white/90">
                {processingText ?? "Analyse de votre demande..."}
              </p>
              <p className="text-xs text-white/50">QGISAI+ prépare votre réponse</p>
            </div>
            <Brain size={18} className="text-emerald-400/60" />
          </div>
        </div>
      </motion.div>
    );
  }

  if (!isVisible || suggestions.length === 0) return null;

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn("absolute bottom-full left-0 right-0 mb-2 z-50", className)}
    >
      <div className="mx-4 mb-2">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-t-xl border border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-emerald-400" />
            <span className="text-xs font-medium text-white/70">Suggestions intelligentes</span>
            <span className="text-xs text-white/40">({suggestions.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title={isExpanded ? "Réduire" : "Étendre"}
            >
              <ChevronRight
                size={14}
                className={cn("text-white/50 transition-transform", isExpanded && "rotate-90")}
              />
            </button>
            <button
              onClick={() => useSmartSuggestionsStore.getState().setVisibility(false)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title="Fermer"
            >
              <X size={14} className="text-white/50" />
            </button>
          </div>
        </div>

        {/* ── Corps ── */}
        <AnimatePresence mode="wait">
          {isExpanded ? (
            /* Mode étendu : grouped list */
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-gray-900/95 backdrop-blur-xl border-x border-b border-white/10 rounded-b-xl overflow-hidden max-h-80 overflow-y-auto"
            >
              {categories.map((category) => (
                <div key={category} className="border-b border-white/5 last:border-0">
                  <div className="px-3 py-1.5 bg-white/5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      {category}
                    </span>
                  </div>
                  <div className="p-1">
                    {groupedSuggestions[category].map((suggestion, idx) => {
                      const globalIndex = suggestions.indexOf(suggestion);
                      const isSelected = globalIndex === selectedIndex;
                      const Icon = iconMap[suggestion.icon ?? "Zap"] ?? Zap;

                      return (
                        <motion.button
                          key={suggestion.id}
                          onClick={() => handleSuggestionClick(suggestion)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          whileHover={{ y: -2 }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all group",
                            isSelected
                              ? cn("bg-gradient-to-r", typeBgColors[suggestion.type], "border")
                              : "hover:bg-white/5",
                          )}
                        >
                          <div
                            className={cn(
                              "flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center",
                              typeColors[suggestion.type],
                            )}
                          >
                            <Icon size={14} className="text-white" />
                          </div>
                          <div className="flex-1 text-left">
                            <p
                              className={cn(
                                "text-sm font-medium truncate",
                                isSelected ? "text-white" : "text-white/80 group-hover:text-white",
                              )}
                            >
                              {suggestion.text}
                            </p>
                            {suggestion.context && (
                              <p className="text-[10px] text-white/40 truncate">{suggestion.context}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {suggestion.confidence > 0.8 && (
                              <span className="text-[10px] text-emerald-400/70 font-medium">
                                {(suggestion.confidence * 100).toFixed(0)}%
                              </span>
                            )}
                            {isSelected && (
                              <span className="text-[10px] text-white/30 px-1.5 py-0.5 bg-white/10 rounded">
                                Tab
                              </span>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="px-3 py-2 bg-white/5 border-t border-white/10 flex items-center justify-between">
                <span className="text-[10px] text-white/30">↑↓ pour naviguer • Tab pour sélectionner</span>
                <span className="text-[10px] text-white/30">Apprenez à QGISAI+ avec vos choix</span>
              </div>
            </motion.div>
          ) : (
            /* Mode compact : chips horizontales scrollables */
            <motion.div
              key="chips"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative bg-gray-900/95 backdrop-blur-xl border-x border-b border-white/10 rounded-b-xl"
            >
              {/* Bouton scroll gauche */}
              <button
                onClick={() => scrollChips("left")}
                className="absolute left-0 top-0 z-10 flex h-full items-center justify-center px-1.5 text-white/40 hover:text-white/80 transition-colors bg-gradient-to-r from-gray-900/95 to-transparent rounded-bl-xl"
                aria-label="Suggestions précédentes"
              >
                <ChevronLeft size={14} />
              </button>

              {/* Chips scrollables */}
              <div
                ref={chipsRef}
                className="flex items-center gap-2 overflow-x-auto px-8 py-2.5 scrollbar-none"
                style={{ scrollbarWidth: "none" }}
              >
                <AnimatePresence initial={false}>
                  {suggestions.map((suggestion, idx) => (
                    <motion.div
                      key={suggestion.id}
                      transition={{ delay: idx * 0.05 }}
                      className="flex-shrink-0"
                    >
                      <SuggestionChip
                        suggestion={suggestion}
                        isSelected={idx === selectedIndex}
                        isNew={newSuggestionIds.has(suggestion.id)}
                        onSelect={() => handleSuggestionClick(suggestion)}
                        onHover={() => setSelectedIndex(idx)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Bouton scroll droite */}
              <button
                onClick={() => scrollChips("right")}
                className="absolute right-0 top-0 z-10 flex h-full items-center justify-center px-1.5 text-white/40 hover:text-white/80 transition-colors bg-gradient-to-l from-gray-900/95 to-transparent rounded-br-xl"
                aria-label="Suggestions suivantes"
              >
                <ChevronRight size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
