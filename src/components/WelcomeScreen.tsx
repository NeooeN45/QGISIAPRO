import {
  Database,
  Image as ImageIcon,
  Leaf,
  Map,
  Plus,
  Sparkles,
  TreePine,
  Waves,
  Layers as LayersIcon,
  BarChart3,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Mic,
  Wrench,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useMemo } from "react";
import QuickPromptsPanel from "./QuickPromptsPanel";

// ── Types ────────────────────────────────────────────────────────────────────

interface WelcomeScreenProps {
  onSendMessage: (message: string) => void;
  layers?: Array<{ name: string; type?: string; geometryType?: string }>;
}

interface Suggestion {
  id: string;
  icon: React.ReactNode;
  text: string;
  accent: string;
  accentColor: string;
  isDynamic?: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const APP_VERSION = "v3.4.0";

const baseSuggestions: Suggestion[] = [
  {
    id: "forest",
    icon: <TreePine size={18} className="text-emerald-400" />,
    text: "Ajouter les forêts publiques ONF et les peuplements forestiers IGN pour analyser la zone d'étude",
    accent: "group-hover:border-emerald-500/30",
    accentColor: "emerald",
  },
  {
    id: "topo",
    icon: <Map size={18} className="text-cyan-400" />,
    text: "Charger le SCAN25 IGN et la carte géologique BRGM pour une analyse topographique complète",
    accent: "group-hover:border-cyan-500/30",
    accentColor: "cyan",
  },
  {
    id: "soil",
    icon: <Waves size={18} className="text-blue-400" />,
    text: "Ajouter la Réserve Utile Maximale des sols (RUM) pour évaluer la capacité de rétention en eau",
    accent: "group-hover:border-blue-500/30",
    accentColor: "blue",
  },
  {
    id: "ndvi",
    icon: <Leaf size={18} className="text-green-400" />,
    text: "Charger le NDVI Sentinel-2 et l'indice de végétation MODIS pour analyser la santé forestière",
    accent: "group-hover:border-green-500/30",
    accentColor: "green",
  },
  {
    id: "cadastre",
    icon: <Plus size={18} className="text-orange-400" />,
    text: "Ajouter le cadastre communal, appliquer un style cadastral et centrer la carte",
    accent: "group-hover:border-orange-500/30",
    accentColor: "orange",
  },
  {
    id: "inventory",
    icon: <ImageIcon size={18} className="text-purple-400" />,
    text: "Créer un dispositif d'inventaire forestier avec grille et centroïdes sur la zone d'étude",
    accent: "group-hover:border-purple-500/30",
    accentColor: "purple",
  },
  {
    id: "fusion",
    icon: <Sparkles size={18} className="text-pink-400" />,
    text: "Fusionner les rasters NDVI 2023 et 2024 en image bi-annuelle pour analyse temporelle",
    accent: "group-hover:border-pink-500/30",
    accentColor: "pink",
  },
  {
    id: "compare",
    icon: <Database size={18} className="text-yellow-400" />,
    text: "Comparer les champs de mes couches forestières et détecter les incohérences de structure",
    accent: "group-hover:border-yellow-500/30",
    accentColor: "yellow",
  },
  {
    id: "sentinel-change",
    icon: <Leaf size={18} className="text-green-400" />,
    text: "Charger l'image Sentinel-2 réelle de la zone et détecter le changement de végétation (avant/après)",
    accent: "group-hover:border-green-500/30",
    accentColor: "green",
  },
  {
    id: "dossier-1clic",
    icon: <LayersIcon size={18} className="text-emerald-400" />,
    text: "Monter un dossier territorial en 1 clic (urbanisme, risques, forêt, environnement) avec symbologies officielles",
    accent: "group-hover:border-emerald-500/30",
    accentColor: "emerald",
  },
  {
    id: "layout-atlas",
    icon: <ImageIcon size={18} className="text-cyan-400" />,
    text: "Générer une planche cartographique professionnelle et un atlas PDF multi-pages",
    accent: "group-hover:border-cyan-500/30",
    accentColor: "cyan",
  },
  {
    id: "vision-improve",
    icon: <Sparkles size={18} className="text-pink-400" />,
    text: "Améliorer automatiquement la carte : rendu critiqué par l'IA vision jusqu'à la perfection",
    accent: "group-hover:border-pink-500/30",
    accentColor: "pink",
  },
  {
    id: "predict-trend",
    icon: <TrendingUp size={18} className="text-violet-400" />,
    text: "Projeter la tendance NDVI des 5 dernières années et anticiper l'état de la végétation à t+3",
    accent: "group-hover:border-violet-500/30",
    accentColor: "violet",
  },
  {
    id: "voice-intent",
    icon: <Mic size={18} className="text-fuchsia-400" />,
    text: "Décris ce que tu veux faire en langage naturel — je le traduis en actions cartographiques QGIS",
    accent: "group-hover:border-fuchsia-500/30",
    accentColor: "fuchsia",
  },
  {
    id: "tools-panel",
    icon: <Wrench size={18} className="text-amber-400" />,
    text: "Ouvre le panneau Outils → Données pour charger Sentinel-2 réel et lancer un diagnostic satellite complet",
    accent: "group-hover:border-amber-500/30",
    accentColor: "amber",
  },
];

// ── Dynamic suggestions engine ───────────────────────────────────────────────

const getDynamicSuggestions = (
  layers: Array<{ name: string; type?: string; geometryType?: string }>,
): Suggestion[] => {
  if (!layers || layers.length === 0) {
    return baseSuggestions;
  }

  const layerNames = layers.map((l) => l.name.toLowerCase());
  const layerTypes = layers.map((l) => (l.type || "").toLowerCase());
  const hasForest = layerNames.some(
    (n) =>
      n.includes("forest") ||
      n.includes("forêt") ||
      n.includes("onf") ||
      n.includes("peuplement"),
  );
  const hasRaster = layerTypes.some((t) => t.includes("raster"));
  const hasVector = layerTypes.some((t) => t.includes("vector"));
  const hasTopo = layerNames.some(
    (n) => n.includes("scan") || n.includes("topo") || n.includes("brgm"),
  );
  const hasSoil = layerNames.some(
    (n) => n.includes("sol") || n.includes("rum") || n.includes("eau"),
  );
  const hasCadastre = layerNames.some(
    (n) => n.includes("cadastre") || n.includes("parcelle"),
  );

  const contextualSuggestions: Suggestion[] = [];

  if (hasForest) {
    contextualSuggestions.push({
      id: "forest-ndvi",
      icon: <Leaf size={18} className="text-green-400" />,
      text: "Calculer le NDVI sur les forêts chargées pour analyser la santé de la végétation",
      accent: "group-hover:border-green-500/30",
      accentColor: "green",
      isDynamic: true,
    });
    contextualSuggestions.push({
      id: "forest-inventory",
      icon: <BarChart3 size={18} className="text-emerald-400" />,
      text: "Créer un inventaire forestier sur la zone des forêts chargées",
      accent: "group-hover:border-emerald-500/30",
      accentColor: "emerald",
      isDynamic: true,
    });
  }

  if (hasRaster) {
    contextualSuggestions.push({
      id: "raster-calc",
      icon: <Sparkles size={18} className="text-pink-400" />,
      text: "Appliquer un calcul raster sur les couches chargées (NDVI, MNS, formule personnalisée)",
      accent: "group-hover:border-pink-500/30",
      accentColor: "pink",
      isDynamic: true,
    });
    contextualSuggestions.push({
      id: "raster-merge",
      icon: <Database size={18} className="text-purple-400" />,
      text: "Fusionner les bandes des rasters chargés en une image multi-spectrale",
      accent: "group-hover:border-purple-500/30",
      accentColor: "purple",
      isDynamic: true,
    });
  }

  if (hasVector) {
    contextualSuggestions.push({
      id: "vector-stats",
      icon: <BarChart3 size={18} className="text-blue-400" />,
      text: "Calculer les statistiques des couches vectorielles chargées",
      accent: "group-hover:border-blue-500/30",
      accentColor: "blue",
      isDynamic: true,
    });
    contextualSuggestions.push({
      id: "vector-buffer",
      icon: <Map size={18} className="text-cyan-400" />,
      text: "Créer des zones tampon autour des entités des couches chargées",
      accent: "group-hover:border-cyan-500/30",
      accentColor: "cyan",
      isDynamic: true,
    });
  }

  if (hasTopo) {
    contextualSuggestions.push({
      id: "topo-analysis",
      icon: <Map size={18} className="text-cyan-400" />,
      text: "Analyser le relief et la topographie des couches chargées",
      accent: "group-hover:border-cyan-500/30",
      accentColor: "cyan",
      isDynamic: true,
    });
  }

  if (hasSoil) {
    contextualSuggestions.push({
      id: "soil-analysis",
      icon: <Waves size={18} className="text-blue-400" />,
      text: "Analyser les caractéristiques des sols chargés",
      accent: "group-hover:border-blue-500/30",
      accentColor: "blue",
      isDynamic: true,
    });
  }

  if (hasCadastre) {
    contextualSuggestions.push({
      id: "cadastre-style",
      icon: <Plus size={18} className="text-orange-400" />,
      text: "Appliquer un style cadastral aux parcelles chargées",
      accent: "group-hover:border-orange-500/30",
      accentColor: "orange",
      isDynamic: true,
    });
  }

  contextualSuggestions.push({
    id: "add-layer",
    icon: <LayersIcon size={18} className="text-gray-400" />,
    text: "Ajouter une nouvelle couche de données",
    accent: "group-hover:border-gray-500/30",
    accentColor: "gray",
  });

  contextualSuggestions.push({
    id: "compare-layers",
    icon: <Database size={18} className="text-yellow-400" />,
    text: "Comparer les champs des couches chargées et détecter les incohérences",
    accent: "group-hover:border-yellow-500/30",
    accentColor: "yellow",
  });

  return contextualSuggestions.slice(0, 8);
};

// ── Utility: format sequence number ──────────────────────────────────────────

function formatSequenceNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

// ── Octagon logo component ───────────────────────────────────────────────────

function OctagonLogo() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="relative flex h-16 w-16 items-center justify-center"
    >
      <svg
        viewBox="0 0 64 64"
        className="absolute inset-0 h-full w-full"
        fill="none"
      >
        <polygon
          points="20,2 44,2 62,20 62,44 44,62 20,62 2,44 2,20"
          className="stroke-blue-500/40 dark:stroke-blue-400/30"
          strokeWidth="1.5"
          fill="none"
        />
        <polygon
          points="20,2 44,2 62,20 62,44 44,62 20,62 2,44 2,20"
          className="fill-blue-500/[0.06] dark:fill-blue-400/[0.08]"
        />
      </svg>
      <Zap size={22} className="relative z-10 text-blue-500 dark:text-blue-400" />
    </motion.div>
  );
}

// ── Connection badge ─────────────────────────────────────────────────────────

function ConnectionBadge({ hasLayers }: { hasLayers: boolean }) {
  const label = hasLayers ? "QGIS connecté" : "IA connectée";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5, duration: 0.4 }}
      className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-1"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="text-[11px] font-medium tracking-wide text-emerald-400">
        {label}
      </span>
    </motion.div>
  );
}

// ── Layer chips ──────────────────────────────────────────────────────────────

function LayerChips({
  layers,
}: {
  layers: Array<{ name: string; type?: string; geometryType?: string }>;
}) {
  if (layers.length === 0) return null;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.06, delayChildren: 0.7 } },
      }}
      className="mt-4 flex flex-wrap gap-2"
    >
      {layers.slice(0, 6).map((layer) => (
        <motion.span
          key={layer.name}
          variants={{
            hidden: { opacity: 0, x: -12 },
            visible: { opacity: 1, x: 0 },
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/50 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-white/50 border-gray-200 bg-gray-100 text-gray-500"
        >
          <LayersIcon size={11} className="opacity-50" />
          {layer.name}
        </motion.span>
      ))}
      {layers.length > 6 && (
        <motion.span
          variants={{
            hidden: { opacity: 0, x: -12 },
            visible: { opacity: 1, x: 0 },
          }}
          className="inline-flex items-center rounded-md border border-white/[0.04] bg-white/[0.02] px-2.5 py-1 text-[11px] text-white/30"
        >
          +{layers.length - 6} autres
        </motion.span>
      )}
    </motion.div>
  );
}

// ── Suggestion card ──────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  index,
  onSelect,
}: {
  suggestion: Suggestion;
  index: number;
  onSelect: (text: string) => void;
}) {
  return (
    <motion.button
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: "easeOut" }}
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => void onSelect(suggestion.text)}
      className={`group relative flex h-[9.5rem] flex-col justify-between overflow-hidden rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-black/[0.015] dark:bg-white/[0.04] p-5 text-left transition-all duration-200 ease-out hover:border-gray-300 dark:hover:border-white/[0.12] hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/20 hover:bg-black/[0.025] dark:hover:bg-white/[0.06] ${suggestion.accent}`}
      aria-label={suggestion.text}
    >
      {/* Shimmer overlay */}
      <div className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent transition-transform duration-700 group-hover:translate-x-full" />

      {/* Sequence number */}
      <span className="absolute right-3.5 top-3 font-mono text-[10px] font-medium leading-none text-gray-300/60 dark:text-white/[0.08] transition-colors group-hover:text-gray-400/80 dark:group-hover:text-white/[0.15]">
        {formatSequenceNumber(index)}
      </span>

      {/* Dynamic badge */}
      {suggestion.isDynamic && (
        <span className="absolute left-3.5 top-3 inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-400">
          <span className="text-[10px]">🎯</span> Recommandé
        </span>
      )}

      {/* Card text */}
      <span
        className={`relative z-10 pr-6 text-[13px] font-medium leading-[1.5] text-gray-600 dark:text-white/60 transition-colors group-hover:text-gray-900 dark:group-hover:text-white/85 ${suggestion.isDynamic ? "mt-5" : ""}`}
      >
        {suggestion.text}
      </span>

      {/* Icon badge */}
      <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200/80 dark:border-white/[0.06] bg-gray-100 dark:bg-white/[0.04] transition-all duration-200 group-hover:border-gray-300 dark:group-hover:border-white/[0.1] group-hover:bg-gray-200 dark:group-hover:bg-white/[0.07]">
        {suggestion.icon}
      </div>
    </motion.button>
  );
}

// ── Gradient divider ─────────────────────────────────────────────────────────

function GradientDivider() {
  return (
    <div className="my-8 flex items-center justify-center">
      <div className="h-px w-full max-w-2xl bg-gradient-to-r from-transparent via-gray-300/40 dark:via-white/[0.08] to-transparent" />
    </div>
  );
}

// ── Bounce arrow hint ────────────────────────────────────────────────────────

function BottomHint() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.2, duration: 0.6 }}
      className="mt-8 flex flex-col items-center gap-1.5"
    >
      <motion.span
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        className="text-gray-400/40 dark:text-white/[0.12]"
      >
        <ChevronUp size={16} />
      </motion.span>
      <span className="text-[11px] font-medium tracking-wide text-gray-400/50 dark:text-white/[0.15]">
        Tapez votre demande ou choisissez une suggestion
      </span>
    </motion.div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function WelcomeScreen({
  onSendMessage,
  layers = [],
}: WelcomeScreenProps) {
  const suggestions = useMemo(() => getDynamicSuggestions(layers), [layers]);
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);
  const hasLayers = layers.length > 0;

  return (
    <div className="relative flex min-h-full flex-col items-start overflow-hidden px-1 py-10">
      {/* ── Ambient background glows ── */}
      <div className="pointer-events-none absolute left-1/4 top-1/4 -z-10 h-80 w-80 rounded-full bg-blue-600/[0.06] blur-[140px]" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 -z-10 h-80 w-80 rounded-full bg-violet-600/[0.05] blur-[140px]" />
      <div className="pointer-events-none absolute right-1/3 top-1/2 -z-10 h-60 w-60 rounded-full bg-emerald-600/[0.04] blur-[120px]" />

      {/* ── Hero section ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col items-start"
      >
        {/* Logo + title row */}
        <div className="flex items-center gap-4">
          <OctagonLogo />
          <div>
            <h1
              className="bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400 bg-[length:200%_auto] bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl"
              style={{
                animation: "gradient-shift 6s ease-in-out infinite",
              }}
            >
              QGIS AI+
            </h1>
            <p className="mt-0.5 text-[13px] font-medium tracking-[0.15em] text-gray-500 dark:text-white/30">
              Votre co-pilote géospatial intelligent
            </p>
          </div>
        </div>

        {/* Connection badge */}
        <div className="mt-5">
          <ConnectionBadge hasLayers={hasLayers} />
        </div>

        {/* Layer chips */}
        <LayerChips layers={layers} />
      </motion.div>

      {/* ── Divider ── */}
      <GradientDivider />

      {/* ── Suggestions grid ── */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: {
            transition: {
              staggerChildren: 0.04,
              delayChildren: 0.3,
            },
          },
        }}
        className="w-full grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {suggestions.map((suggestion, index) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            index={index}
            onSelect={onSendMessage}
          />
        ))}
      </motion.div>

      {/* ── Quick prompts toggle ── */}
      <div className="mt-6 flex w-full justify-center">
        <button
          type="button"
          onClick={() => setShowQuickPrompts((v) => !v)}
          className="flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-[11px] font-medium text-gray-400/60 dark:text-white/20 transition-all hover:border-gray-200/60 dark:hover:border-white/[0.06] hover:text-gray-500 dark:hover:text-white/40 hover:bg-gray-50 dark:hover:bg-white/[0.02]"
        >
          <ChevronDown
            size={12}
            className={`transition-transform duration-200 ${showQuickPrompts ? "rotate-180" : ""}`}
          />
          Suggestions rapides
        </button>
      </div>

      <AnimatePresence>
        {showQuickPrompts && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 w-full overflow-hidden"
          >
            <QuickPromptsPanel
              onSelectPrompt={(p) => {
                onSendMessage(p);
                setShowQuickPrompts(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom hint ── */}
      <div className="flex w-full justify-center">
        <BottomHint />
      </div>

      {/* ── Version watermark ── */}
      <span className="absolute bottom-3 right-3 font-mono text-[10px] text-gray-300/30 dark:text-white/[0.07] select-none">
        {APP_VERSION}
      </span>

      {/* ── Animated gradient keyframe (injected once) ── */}
      <style>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% center; }
          50% { background-position: 200% center; }
        }
      `}</style>
    </div>
  );
}
