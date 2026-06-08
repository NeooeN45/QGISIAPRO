/**
 * Indicateur de réflexion animé – niveau GPT-4o/Claude
 * Orbite, blur-phrase, glow progress, réseau SVG, stop premium
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Brain,
  Cpu,
  Map,
  Code2,
  Layers,
  Terminal,
  Zap,
} from "lucide-react";
import {
  useThinkingStore,
  ThinkingPhase,
  getAnimatedPhrases,
} from "../stores/useThinkingStore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ThinkingIndicatorProps {
  isLoading: boolean;
  onStop?: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PHRASE_ROTATION_MS = 2500;

/** Chaque point de l'orbite : couleur hex + délai de phase (degrés → fraction) */
const ORBIT_DOTS = [
  { color: "#60a5fa", delayFraction: 0 },       // bleu
  { color: "#a78bfa", delayFraction: 1 / 3 },   // violet
  { color: "#34d399", delayFraction: 2 / 3 },   // vert
] as const;

const ORBIT_DURATION_S = 2.4;
const ORBIT_RADIUS_PX = 10;

/** Positions des nœuds du réseau SVG (viewBox 60×28) */
const NETWORK_NODES = [
  { cx: 8,  cy: 14 },
  { cx: 30, cy: 6  },
  { cx: 52, cy: 14 },
] as const;

const NETWORK_EDGES = [
  { x1: 8,  y1: 14, x2: 30, y2: 6  },
  { x1: 30, y1: 6,  x2: 52, y2: 14 },
  { x1: 8,  y1: 14, x2: 52, y2: 14 },
] as const;

const ACTIVE_NETWORK_PHASES: ThinkingPhase[] = [
  "EXECUTING_TOOLS",
  "GENERATING_CODE",
];

const phaseIcons: Record<ThinkingPhase, React.ReactNode> = {
  IDLE:               null,
  ANALYZING_INTENT:   <Brain   className="w-4 h-4 text-amber-400"  />,
  PLANNING:           <Map     className="w-4 h-4 text-purple-400" />,
  SELECTING_MODEL:    <Cpu     className="w-4 h-4 text-cyan-400"   />,
  RETRIEVING_CONTEXT: <Layers  className="w-4 h-4 text-emerald-400"/>,
  EXECUTING_TOOLS:    <Zap     className="w-4 h-4 text-yellow-400" />,
  GENERATING_CODE:    <Code2   className="w-4 h-4 text-blue-400"   />,
  WAITING_FOR_LLM:    <Sparkles className="w-4 h-4 text-violet-400"/>,
  PROCESSING_RESPONSE:<Terminal className="w-4 h-4 text-gray-400" />,
  STREAMING_RESPONSE: <Sparkles className="w-4 h-4 text-green-400"/>,
};

/** Couleurs Tailwind pour le gradient ET les valeurs CSS brutes (glow) */
const phaseColors: Record<ThinkingPhase, string> = {
  IDLE:               "",
  ANALYZING_INTENT:   "from-amber-500 to-orange-500",
  PLANNING:           "from-purple-500 to-pink-500",
  SELECTING_MODEL:    "from-cyan-500 to-blue-500",
  RETRIEVING_CONTEXT: "from-emerald-500 to-teal-500",
  EXECUTING_TOOLS:    "from-yellow-500 to-orange-500",
  GENERATING_CODE:    "from-blue-500 to-indigo-500",
  WAITING_FOR_LLM:    "from-violet-500 to-purple-500",
  PROCESSING_RESPONSE:"from-gray-500 to-slate-500",
  STREAMING_RESPONSE: "from-green-500 to-emerald-500",
};

/** Couleur de glow brute pour box-shadow (extraite du premier stop du gradient) */
const phaseGlowColor: Record<ThinkingPhase, string> = {
  IDLE:               "transparent",
  ANALYZING_INTENT:   "#f59e0b",
  PLANNING:           "#a855f7",
  SELECTING_MODEL:    "#06b6d4",
  RETRIEVING_CONTEXT: "#10b981",
  EXECUTING_TOOLS:    "#eab308",
  GENERATING_CODE:    "#3b82f6",
  WAITING_FOR_LLM:    "#8b5cf6",
  PROCESSING_RESPONSE:"#6b7280",
  STREAMING_RESPONSE: "#22c55e",
};

const progressLabels = (p: number): string => {
  if (p < 15)  return "Analyse en cours…";
  if (p < 35)  return "Planification…";
  if (p < 60)  return "Préparation…";
  if (p < 85)  return "Génération…";
  if (p < 100) return "Finalisation…";
  return "Terminé !";
};

// ─── Sous-composants ──────────────────────────────────────────────────────────

/** Orbite positionnée en overlay absolu sur le conteneur parent (avatar 40x40) */
function OrbitRing() {
  return (
    <>
      {ORBIT_DOTS.map(({ color, delayFraction }, i) => (
        <motion.div
          key={i}
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{
            duration: ORBIT_DURATION_S,
            repeat: Infinity,
            ease: "linear",
            delay: -(ORBIT_DURATION_S * delayFraction),
          }}
          style={{ transformOrigin: "50% 50%" }}
          aria-hidden
        >
          <div
            className="absolute rounded-full"
            style={{
              width: 5,
              height: 5,
              background: color,
              boxShadow: `0 0 7px 2px ${color}99`,
              left: "50%",
              top: "50%",
              /* Rayon = moitié du conteneur (20px) + 8px débordement */
              transform: `translate(-50%, calc(-50% - ${ORBIT_RADIUS_PX + 8}px))`,
            }}
          />
        </motion.div>
      ))}
    </>
  );
}

/** Mini-réseau SVG avec nœuds pulsants et flux de données sur les lignes */
function ActiveNetworkIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-2 pl-2"
    >
      <svg
        viewBox="0 0 60 28"
        width={60}
        height={28}
        aria-hidden
        className="overflow-visible"
      >
        {/* Lignes de flux */}
        {NETWORK_EDGES.map(({ x1, y1, x2, y2 }, i) => {
          const len = Math.hypot(x2 - x1, y2 - y1);
          return (
            <motion.line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#60a5fa"
              strokeWidth={1}
              strokeOpacity={0.4}
              strokeLinecap="round"
              strokeDasharray={`${len}`}
              animate={{ strokeDashoffset: [len, 0, -len] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: "linear",
                delay: i * 0.4,
              }}
            />
          );
        })}

        {/* Nœuds pulsants */}
        {NETWORK_NODES.map(({ cx, cy }, i) => (
          <motion.circle
            key={i}
            cx={cx}
            cy={cy}
            r={3}
            fill="#60a5fa"
            animate={{ scale: [1, 1.35, 1], opacity: [0.7, 1, 0.7] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.25,
            }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          />
        ))}
      </svg>

      <span className="text-xs font-mono text-blue-400/70 tracking-wide select-none">
        réseau actif
      </span>
    </motion.div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ThinkingIndicator({
  isLoading,
  onStop,
}: ThinkingIndicatorProps) {
  const { phase, message, subMessage, modelName, estimatedTime, progress } =
    useThinkingStore();
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [phrases, setPhrases] = useState<string[]>([]);

  useEffect(() => {
    if (phase !== "IDLE") {
      setPhrases(getAnimatedPhrases(phase));
      setCurrentPhraseIndex(0);
    }
  }, [phase]);

  useEffect(() => {
    if (!isLoading || phrases.length === 0) return;
    const id = setInterval(
      () => setCurrentPhraseIndex((p) => (p + 1) % phrases.length),
      PHRASE_ROTATION_MS,
    );
    return () => clearInterval(id);
  }, [isLoading, phrases]);

  if (!isLoading || phase === "IDLE") return null;

  const currentIcon   = phaseIcons[phase];
  const gradientClass = phaseColors[phase];
  const glowColor     = phaseGlowColor[phase];
  const showNetwork   = ACTIVE_NETWORK_PHASES.includes(phase);

  return (
    <div className="flex gap-4 md:gap-6">
      {/* ── Avatar ────────────────────────────────────────────────────────── */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-gray-200 dark:border-[#333537] bg-gray-100 dark:bg-[#1e1f20] shadow-lg relative overflow-visible">
        {/* Fond dégradé pulsant */}
        <motion.div
          className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradientClass} opacity-20`}
          animate={{ opacity: [0.1, 0.35, 0.1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        {/* Orbite autour de l'avatar */}
        <OrbitRing />
        {/* Icône oscillante */}
        <motion.div
          className="relative z-10"
          animate={{ scale: [1, 1.12, 1], rotate: [0, 6, -6, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {currentIcon ?? <Sparkles size={20} className="text-blue-400" />}
        </motion.div>
      </div>

      {/* ── Contenu ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 min-w-0 flex-1">

        {/* Bulle principale */}
        <div className="flex items-center gap-3 rounded-[28px] border border-gray-200 dark:border-[#333537]/40 bg-white dark:bg-[#1e1f20]/60 p-5 shadow-sm dark:backdrop-blur-sm">

          {/* Phrase animée avec blur */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.p
                key={`${phase}-${currentPhraseIndex}`}
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0,  filter: "blur(0px)" }}
                exit={{    opacity: 0, y: -8, filter: "blur(4px)" }}
                transition={{ duration: 0.35 }}
                className="text-sm font-mono text-gray-600 dark:text-gray-300 truncate"
              >
                {phrases[currentPhraseIndex] ?? message}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Détails */}
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex flex-col gap-2 pl-2"
        >
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent border border-gray-200 dark:border-gray-700`}
            >
              {currentIcon && <span className="opacity-60">{currentIcon}</span>}
              {subMessage}
            </span>

            {modelName && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800">
                <Cpu className="w-3 h-3" />
                {modelName}
              </span>
            )}

            {estimatedTime && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-gray-500 dark:text-gray-400">
                ~{estimatedTime}
              </span>
            )}
          </div>

          {/* ── Barre de progression ──────────────────────────────────────── */}
          {progress > 0 && (
            <div className="w-full max-w-md">
              <div className="relative">

                {/* Track */}
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible shadow-inner relative">

                  {/* Micro-ticks 25 / 50 / 75 % */}
                  {[25, 50, 75].map((tick) => (
                    <div
                      key={tick}
                      className="absolute top-0 bottom-0 w-px bg-white/20 dark:bg-white/10 z-10"
                      style={{ left: `${tick}%` }}
                    />
                  ))}

                  {/* Barre remplie */}
                  <div className="absolute inset-0 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full bg-gradient-to-r ${gradientClass} relative`}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      style={{
                        boxShadow: `0 0 12px 2px ${glowColor}66`,
                      }}
                    >
                      {/* Shimmer */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      />
                      {/* Pointe brillante */}
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg shadow-white/50" />
                    </motion.div>
                  </div>
                </div>

                {/* Glow derrière la track */}
                <motion.div
                  className={`absolute -inset-1 bg-gradient-to-r ${gradientClass} rounded-full opacity-20 blur-sm -z-10`}
                  animate={{ opacity: [0.1, 0.3, 0.1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>

              {/* Label + pourcentage */}
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {progressLabels(progress)}
                </p>
                <p
                  className={`text-xs font-bold bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent`}
                >
                  {Math.round(progress)}%
                </p>
              </div>
            </div>
          )}

          {/* ── Réseau actif ──────────────────────────────────────────────── */}
          <AnimatePresence>
            {showNetwork && <ActiveNetworkIndicator />}
          </AnimatePresence>
        </motion.div>

        {/* ── Bouton Stop premium ───────────────────────────────────────── */}
        <AnimatePresence>
          {onStop && (
            <motion.button
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{    opacity: 0, scale: 0.92 }}
              whileHover={{
                boxShadow: "0 0 14px 3px rgba(239,68,68,0.35)",
                borderColor: "rgba(239,68,68,0.6)",
              }}
              whileTap={{ scale: 0.95 }}
              onClick={onStop}
              className="flex w-fit items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-600 dark:text-red-300 transition-colors hover:bg-red-500/20 cursor-pointer select-none"
            >
              {/* Carré stop */}
              <motion.div
                className="h-2 w-2 rounded-sm bg-red-500"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              Arrêter la génération
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
