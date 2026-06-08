/**
 * DataPanel — Catalogue de données + Sentinel-2 STAC.
 *
 * Redesign UX 2026-06-08 :
 *  - Sélecteur de bandes visuel (coches avec nom complet)
 *  - Bbox : bouton "Emprise du projet" + fallback input manuel si bridge down
 *  - États complets (loading skeleton, erreur inline, succès)
 *
 * Amélioré 2026-06-09 — fiabilité + polish visuel :
 *  - État d'erreur bridge avec bouton "Réessayer" (catalogue)
 *  - Fallback input manuel bbox si emprise indisponible
 *  - Checkmark animé scale 0→1 sur bandes sélectionnées (motion/react)
 *  - Badge compteur de bandes animé
 *  - Presets période : indicateur radio visuel glissant (layoutId)
 *  - Succès card source : vire au vert 2s puis revient
 *  - Skeleton loading varié (largeurs différentes)
 *
 * IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI)
 * Superviseur : Claude Code 4.8 — Camil
 */
import { useState, useCallback, useEffect, useRef } from "react";
import {
  Globe,
  Satellite,
  Search,
  X,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  RefreshCw,
  Info,
  Calendar,
  WifiOff,
  PenLine,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DataSource {
  id: string;
  name: string;
  category: string;
  coverage?: string;
  provider?: string;
}

type LoadStatus = "idle" | "loading" | "success" | "error";

const BRIDGE_URL = "http://localhost:8157";

/** Durée en ms pendant laquelle la card reste verte après chargement */
const SUCCESS_FLASH_DURATION_MS = 2000;

// ── Constantes visuelles ──────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  basemap:        "border-cyan-500/30    bg-cyan-500/[0.08]    text-cyan-600    dark:text-cyan-300",
  satellite:      "border-violet-500/30  bg-violet-500/[0.08]  text-violet-600  dark:text-violet-300",
  france:         "border-blue-500/30    bg-blue-500/[0.08]    text-blue-600    dark:text-blue-300",
  relief:         "border-amber-500/30   bg-amber-500/[0.08]   text-amber-600   dark:text-amber-300",
  occupation_sol: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-300",
  labels:         "border-gray-400/30    bg-gray-400/[0.06]    text-gray-500    dark:text-gray-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  basemap: "Fond", satellite: "Satellite", france: "France",
  relief: "Relief", occupation_sol: "Occupation", labels: "Labels",
};

/** Bandes Sentinel-2 — nom humain + couleur visuelle */
const SENTINEL_BANDS = [
  { id: "B02", label: "Bleu",  description: "Bleu visible",                 color: "#4fc3f7" },
  { id: "B03", label: "Vert",  description: "Vert visible",                 color: "#81c784" },
  { id: "B04", label: "Rouge", description: "Rouge visible",                color: "#e57373" },
  { id: "B08", label: "NIR",   description: "Proche infrarouge",            color: "#9575cd" },
  { id: "B11", label: "SWIR1", description: "Infrarouge ondes courtes 1",   color: "#ff8a65" },
  { id: "B12", label: "SWIR2", description: "Infrarouge ondes courtes 2",   color: "#ffb74d" },
];

/** Périodes prédéfinies */
const PERIOD_PRESETS = [
  { label: "Été 2024",     value: "2024-06-01/2024-08-31" },
  { label: "Printemps 24", value: "2024-03-01/2024-05-31" },
  { label: "Automne 24",   value: "2024-09-01/2024-11-30" },
  { label: "Hiver 23/24",  value: "2023-12-01/2024-02-28" },
  { label: "Personnalisé", value: "custom" },
];

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchSources(category?: string): Promise<DataSource[]> {
  const url = new URL(`${BRIDGE_URL}/api/qgis/listDataSources`);
  if (category) url.searchParams.set("category", category);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { sources?: DataSource[] };
  return data.sources ?? [];
}

async function loadSource(sourceId: string): Promise<void> {
  const res = await fetch(`${BRIDGE_URL}/api/qgis/addDataSource`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(data.error ?? "Erreur inconnue");
}

async function fetchProjectExtent(): Promise<string | null> {
  const res = await fetch(`${BRIDGE_URL}/api/qgis/projectExtent`);
  if (!res.ok) return null;
  const data = await res.json() as { bbox?: string };
  return data.bbox ?? null;
}

async function loadSentinelBands(bbox: string, bands: string, period: string): Promise<void> {
  const res = await fetch(`${BRIDGE_URL}/api/qgis/loadSatelliteBands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bbox, bands, datetime: period }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(data.error ?? "Erreur inconnue");
}

// ── Sous-composants ───────────────────────────────────────────────────────────

/** Skeleton d'une card source avec largeur variable */
function SourceSkeleton({ widthClass }: { widthClass: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.02] animate-pulse px-2.5 py-2 h-[52px]">
      <div className="flex-1 flex flex-col gap-1.5">
        <div className={cn("h-2.5 rounded bg-gray-200 dark:bg-white/[0.06]", widthClass)} />
        <div className="h-2 rounded bg-gray-200 dark:bg-white/[0.04] w-16" />
      </div>
      <div className="w-12 h-6 rounded-lg bg-gray-200 dark:bg-white/[0.04]" />
    </div>
  );
}

/** Badge compteur de bandes avec animation au changement */
function BandCountBadge({ count }: { count: number }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={count}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.6, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="inline-flex items-center gap-0.5 rounded-full border border-violet-500/40 bg-violet-500/[0.12] px-2 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-300"
      >
        {count} bande{count > 1 ? "s" : ""}
      </motion.span>
    </AnimatePresence>
  );
}

// ── Composant ─────────────────────────────────────────────────────────────────

export interface DataPanelProps {
  initialSources?: DataSource[];
  onSourceLoaded?: (sourceId: string) => void;
}

export default function DataPanel({ initialSources, onSourceLoaded }: DataPanelProps) {
  const [sources, setSources] = useState<DataSource[]>(initialSources ?? []);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const [successFlashIds, setSuccessFlashIds] = useState<Set<string>>(new Set());
  const successTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Sentinel-2
  const [selectedBands, setSelectedBands] = useState<string[]>(["B04", "B08"]);
  const [periodPreset, setPeriodPreset] = useState("2024-06-01/2024-08-31");
  const [customPeriod, setCustomPeriod] = useState("");
  const [isCustomPeriod, setIsCustomPeriod] = useState(false);
  const [sentinelBbox, setSentinelBbox] = useState("");
  const [bboxLoading, setBboxLoading] = useState(false);
  const [bboxFallback, setBboxFallback] = useState(false);
  const [sentinelStatus, setSentinelStatus] = useState<LoadStatus>("idle");

  // Nettoyage des timers au démontage
  useEffect(() => {
    const timers = successTimers.current;
    return () => { timers.forEach((t) => clearTimeout(t)); };
  }, []);

  const categories = Array.from(new Set(sources.map((s) => s.category))).sort();

  const fetchCatalog = useCallback(async (cat?: string) => {
    setIsFetching(true);
    setCatalogError(false);
    try {
      const data = await fetchSources(cat);
      setSources(data);
    } catch (e) {
      setCatalogError(true);
      toast.error(`Catalogue : ${e instanceof Error ? e.message : "Bridge QGIS inaccessible"}`);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => { void fetchCatalog(); }, [fetchCatalog]);

  const handleUseProjectExtent = useCallback(async () => {
    setBboxLoading(true);
    setBboxFallback(false);
    try {
      const bbox = await fetchProjectExtent();
      if (bbox) {
        setSentinelBbox(bbox);
        toast.success("Emprise du projet récupérée");
      } else {
        // Bridge accessible mais pas de projet ouvert → fallback manuel
        setBboxFallback(true);
        toast.warning("Emprise indisponible — entrez les coordonnées manuellement");
      }
    } catch {
      // Bridge inaccessible → fallback manuel
      setBboxFallback(true);
      toast.warning("Bridge QGIS inaccessible — entrez l'emprise manuellement");
    } finally {
      setBboxLoading(false);
    }
  }, []);

  const toggleBand = useCallback((bandId: string) => {
    setSelectedBands((prev) => {
      if (prev.includes(bandId)) {
        if (prev.length === 1) return prev; // garder au moins 1
        return prev.filter((b) => b !== bandId);
      }
      return [...prev, bandId];
    });
    setSentinelStatus("idle");
  }, []);

  const handlePeriodPreset = useCallback((value: string) => {
    if (value === "custom") {
      setIsCustomPeriod(true);
    } else {
      setIsCustomPeriod(false);
      setPeriodPreset(value);
    }
    setSentinelStatus("idle");
  }, []);

  const triggerSuccessFlash = useCallback((srcId: string) => {
    setSuccessFlashIds((prev) => new Set([...prev, srcId]));
    // Annuler le timer précédent s'il existe
    const existing = successTimers.current.get(srcId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setSuccessFlashIds((prev) => {
        const next = new Set(prev);
        next.delete(srcId);
        return next;
      });
      successTimers.current.delete(srcId);
    }, SUCCESS_FLASH_DURATION_MS);
    successTimers.current.set(srcId, timer);
  }, []);

  const handleLoad = useCallback(async (src: DataSource) => {
    setLoadingId(src.id);
    try {
      await loadSource(src.id);
      setLoadedIds((prev) => new Set([...prev, src.id]));
      triggerSuccessFlash(src.id);
      toast.success(`"${src.name}" chargée dans QGIS`);
      onSourceLoaded?.(src.id);
    } catch (e) {
      toast.error(`Chargement échoué : ${e instanceof Error ? e.message : "Erreur"}`);
    } finally {
      setLoadingId(null);
    }
  }, [onSourceLoaded, triggerSuccessFlash]);

  const handleSentinel = useCallback(async () => {
    if (!sentinelBbox.trim()) {
      toast.warning("Définis d'abord l'emprise (bouton ci-dessus ou saisie manuelle)");
      return;
    }
    if (selectedBands.length === 0) {
      toast.warning("Sélectionne au moins une bande");
      return;
    }
    const period = isCustomPeriod ? customPeriod : periodPreset;
    if (!period.trim()) {
      toast.warning("Sélectionne une période");
      return;
    }
    setSentinelStatus("loading");
    try {
      await loadSentinelBands(sentinelBbox, selectedBands.join(","), period);
      setSentinelStatus("success");
      toast.success(`${selectedBands.length} bande(s) Sentinel-2 chargées`);
    } catch (e) {
      setSentinelStatus("error");
      toast.error(`Sentinel : ${e instanceof Error ? e.message : "Erreur"}`);
    }
  }, [sentinelBbox, selectedBands, isCustomPeriod, customPeriod, periodPreset]);

  const filtered = sources.filter((s) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.provider?.toLowerCase().includes(q) ?? false);
  });

  const activePeriodValue = isCustomPeriod ? "custom" : periodPreset;

  return (
    <div className="flex flex-col gap-3.5 p-3.5">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Globe size={15} className="text-cyan-500 dark:text-cyan-400 shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-400">
          Catalogue de données
        </span>
        <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-violet-500/[0.12] text-violet-500 dark:text-violet-300 border border-violet-500/20">
          ⚡ Devin
        </span>
      </div>

      {/* Recherche + filtres */}
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/35 pointer-events-none" />
        <input
          className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-100/80 dark:bg-white/[0.03] pl-7 pr-7 py-1.5 text-[12px] text-gray-800 dark:text-white/75 placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-cyan-500/50 dark:focus:border-cyan-500/40 transition-colors"
          placeholder="Rechercher un fond de carte, satellite…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/35 hover:text-gray-600 dark:hover:text-white/60"
            onClick={() => setQuery("")}
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Filtres catégorie */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => { setActiveCategory(null); void fetchCatalog(); }}
          className={cn(
            "text-[10px] px-2 py-0.5 rounded-lg border transition-colors",
            activeCategory === null
              ? "border-cyan-500/40 bg-cyan-500/[0.12] text-cyan-600 dark:text-cyan-300"
              : "border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.03] text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/[0.06]",
          )}
        >
          Tout
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              const next = cat === activeCategory ? null : cat;
              setActiveCategory(next);
              void fetchCatalog(next ?? undefined);
            }}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-lg border transition-colors",
              activeCategory === cat
                ? (CATEGORY_COLORS[cat] ?? "border-white/20 bg-white/10 text-white")
                : "border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.03] text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/[0.06]",
            )}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
        <button
          onClick={() => void fetchCatalog(activeCategory ?? undefined)}
          disabled={isFetching}
          className="ml-auto text-[10px] px-2 py-0.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.03] text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50"
        >
          {isFetching ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
        </button>
      </div>

      {/* Skeleton de chargement — largeurs variées */}
      {isFetching && (
        <div className="flex flex-col gap-1">
          <SourceSkeleton widthClass="w-[85%]" />
          <SourceSkeleton widthClass="w-[65%]" />
          <SourceSkeleton widthClass="w-[75%]" />
          <SourceSkeleton widthClass="w-[55%]" />
        </div>
      )}

      {/* Erreur bridge catalogue */}
      {!isFetching && catalogError && (
        <div className="flex flex-col gap-2 rounded-xl border border-red-400/30 bg-red-500/[0.06] px-3 py-3">
          <div className="flex items-start gap-2">
            <WifiOff size={13} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                Bridge QGIS inaccessible
              </p>
              <p className="text-[10px] text-red-500/70 dark:text-red-400/60 mt-0.5 leading-relaxed">
                Lance QGIS avec le plugin QGISia puis réessaie.
              </p>
            </div>
          </div>
          <button
            onClick={() => void fetchCatalog(activeCategory ?? undefined)}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg border border-red-400/35 bg-red-500/[0.08] text-[11px] font-semibold text-red-600 dark:text-red-300 hover:bg-red-500/[0.12] transition-colors"
          >
            <RefreshCw size={11} />
            Réessayer
          </button>
        </div>
      )}

      {/* Liste vide (sans erreur) */}
      {!isFetching && !catalogError && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Globe size={24} className="text-gray-300 dark:text-white/15" />
          <p className="text-[11px] text-gray-400 dark:text-white/25">
            {sources.length === 0
              ? "Lance QGIS et le plugin pour voir le catalogue"
              : "Aucune source trouvée"}
          </p>
        </div>
      )}

      {/* Liste des sources */}
      {!isFetching && !catalogError && filtered.length > 0 && (
        <div className="flex flex-col gap-1">
          {filtered.map((src) => {
            const isFlashing = successFlashIds.has(src.id);
            return (
              <motion.div
                key={src.id}
                animate={isFlashing
                  ? { backgroundColor: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.35)" }
                  : { backgroundColor: "transparent", borderColor: "transparent" }
                }
                transition={{ duration: 0.3 }}
                className="group flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02] px-2.5 py-2 hover:border-gray-300 dark:hover:border-white/[0.1] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-gray-800 dark:text-white/80 truncate">{src.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded-md border", CATEGORY_COLORS[src.category] ?? "border-white/10 bg-white/5 text-white/40")}>
                      {CATEGORY_LABELS[src.category] ?? src.category}
                    </span>
                    {src.coverage && (
                      <span className="text-[9px] text-gray-400 dark:text-white/25 flex items-center gap-0.5">
                        <MapPin size={8} />{src.coverage}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => void handleLoad(src)}
                  disabled={loadingId === src.id || loadedIds.has(src.id)}
                  title={loadedIds.has(src.id) ? "Déjà chargée" : "Charger dans QGIS"}
                  className={cn(
                    "flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg border transition-all font-medium",
                    loadedIds.has(src.id)
                      ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-400"
                      : "border-transparent bg-transparent text-transparent group-hover:border-gray-200 dark:group-hover:border-white/[0.08] group-hover:bg-gray-100/80 dark:group-hover:bg-white/[0.04] group-hover:text-gray-500 dark:group-hover:text-white/50 hover:!border-cyan-500/40 hover:!text-cyan-600 dark:hover:!text-cyan-300",
                  )}
                >
                  {loadingId === src.id ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : loadedIds.has(src.id) ? (
                    <CheckCircle2 size={10} />
                  ) : (
                    <Plus size={10} />
                  )}
                  {loadedIds.has(src.id) ? "Chargée" : "Ajouter"}
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Sentinel-2 ─────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02] p-3.5 shadow-sm flex flex-col gap-3 mt-1">
        <div className="flex items-center gap-2">
          <Satellite size={13} className="text-violet-500 dark:text-violet-400 shrink-0" />
          <p className="text-[11px] font-bold text-gray-700 dark:text-white/70">Images Sentinel-2</p>
          <span className="ml-auto text-[9px] text-gray-400 dark:text-white/25">Gratuit · 10m</span>
        </div>

        {/* Zone — Emprise auto + fallback manuel */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold text-gray-500 dark:text-white/40 uppercase tracking-[0.15em]">Zone</p>
          <button
            onClick={() => void handleUseProjectExtent()}
            disabled={bboxLoading}
            className={cn(
              "flex items-center justify-center gap-1.5 w-full rounded-xl border py-2 text-[12px] font-semibold transition-all",
              sentinelBbox && !bboxFallback
                ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-400"
                : "border-violet-500/35 bg-gradient-to-r from-violet-600/15 to-violet-500/10 text-violet-600 dark:text-violet-300 hover:from-violet-600/22",
            )}
          >
            {bboxLoading
              ? <><Loader2 size={11} className="animate-spin" />Récupération…</>
              : sentinelBbox && !bboxFallback
              ? <><CheckCircle2 size={11} />Emprise définie ✓</>
              : <><MapPin size={11} />Utiliser l'emprise du projet QGIS</>
            }
          </button>

          {/* Fallback : emprise indisponible → input manuel */}
          <AnimatePresence>
            {bboxFallback && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col gap-1.5 overflow-hidden"
              >
                <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-2.5 py-1.5">
                  <WifiOff size={11} className="text-amber-500 shrink-0" />
                  <p className="text-[10px] text-amber-600 dark:text-amber-300 leading-relaxed">
                    Emprise indisponible — entrez les coordonnées manuellement
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <PenLine size={11} className="text-gray-400 dark:text-white/30 shrink-0" />
                  <input
                    className="flex-1 rounded-xl border border-amber-500/25 bg-gray-100/80 dark:bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-white/75 placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-amber-500/50 transition-colors"
                    placeholder="minLon,minLat,maxLon,maxLat (ex: 2.2,48.7,2.5,49.0)"
                    value={sentinelBbox}
                    onChange={(e) => { setSentinelBbox(e.target.value); setSentinelStatus("idle"); }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {sentinelBbox && !bboxFallback && (
            <button
              onClick={() => { setSentinelBbox(""); setSentinelStatus("idle"); setBboxFallback(false); }}
              className="self-end text-[10px] text-gray-400 dark:text-white/25 hover:text-gray-600 dark:hover:text-white/50 transition-colors"
            >
              Effacer l'emprise
            </button>
          )}
        </div>

        {/* Période — radio visuel avec indicateur glissant */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold text-gray-500 dark:text-white/40 uppercase tracking-[0.15em] flex items-center gap-1">
            <Calendar size={10} />Période
          </p>
          <div className="grid grid-cols-2 gap-1">
            {PERIOD_PRESETS.map((p) => {
              const isActive = activePeriodValue === p.value;
              return (
                <button
                  key={p.value}
                  onClick={() => handlePeriodPreset(p.value)}
                  className={cn(
                    "relative text-[11px] px-2 py-1.5 rounded-lg border text-left transition-colors overflow-hidden",
                    isActive
                      ? "border-violet-500/40 bg-violet-500/[0.1] text-violet-700 dark:text-violet-300 font-semibold"
                      : "border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.03] text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/[0.06]",
                  )}
                >
                  {/* Indicateur radio */}
                  <span className={cn(
                    "inline-block w-2 h-2 rounded-full mr-1.5 border align-middle transition-all",
                    isActive
                      ? "border-violet-500 bg-violet-500"
                      : "border-gray-300 dark:border-white/20 bg-transparent",
                  )} />
                  {p.label}
                  {/* Barre active en bas */}
                  {isActive && (
                    <motion.span
                      layoutId="period-active-bar"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500/60 rounded-full"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          {isCustomPeriod && (
            <input
              className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-100/80 dark:bg-white/[0.03] px-3 py-1.5 text-[11px] text-gray-800 dark:text-white/75 placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 transition-colors"
              placeholder="2024-01-01/2024-12-31"
              value={customPeriod}
              onChange={(e) => { setCustomPeriod(e.target.value); setSentinelStatus("idle"); }}
            />
          )}
        </div>

        {/* Bandes — checkmark animé + badge compteur */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold text-gray-500 dark:text-white/40 uppercase tracking-[0.15em]">
              Bandes à télécharger
            </p>
            <BandCountBadge count={selectedBands.length} />
          </div>
          <div className="grid grid-cols-3 gap-1">
            {SENTINEL_BANDS.map((band) => {
              const isSelected = selectedBands.includes(band.id);
              return (
                <button
                  key={band.id}
                  onClick={() => toggleBand(band.id)}
                  className={cn(
                    "flex flex-col items-start rounded-xl border px-2 py-1.5 transition-all text-left overflow-hidden relative",
                    isSelected
                      ? "border-violet-500/40 bg-violet-500/[0.08] text-violet-700 dark:text-violet-300"
                      : "border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.03] text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/[0.06]",
                  )}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <div
                      className="w-2 h-2 rounded-full shrink-0 opacity-80"
                      style={{ backgroundColor: band.color }}
                    />
                    <span className="text-[11px] font-bold font-mono">{band.id}</span>
                    {/* Checkmark animé scale 0→1 */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.span
                          key="check"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          className="ml-auto"
                        >
                          <CheckCircle2 size={9} className="text-violet-500 dark:text-violet-400" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <span className="text-[9px] text-gray-400 dark:text-white/25 mt-0.5">{band.label}</span>
                  {/* Barre couleur en bas quand sélectionnée */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        key="bar"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        exit={{ scaleX: 0 }}
                        style={{ backgroundColor: band.color, transformOrigin: "left" }}
                        className="absolute bottom-0 left-0 right-0 h-0.5 opacity-60"
                      />
                    )}
                  </AnimatePresence>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-violet-500/15 bg-violet-500/[0.04] px-2.5 py-2">
            <Info size={11} className="text-violet-400 shrink-0" />
            <p className="text-[10px] text-violet-600/70 dark:text-violet-400/60">
              {selectedBands.length === 0
                ? "Sélectionne au moins une bande"
                : `${selectedBands.join(", ")} · Recommandé : B04 + B08 pour NDVI`}
            </p>
          </div>
        </div>

        {/* Bouton charger */}
        <button
          onClick={() => void handleSentinel()}
          disabled={sentinelStatus === "loading" || !sentinelBbox || selectedBands.length === 0}
          className={cn(
            "flex items-center justify-center gap-1.5 w-full py-2 rounded-xl border text-[12px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed",
            sentinelStatus === "success"
              ? "border-emerald-500/35 bg-gradient-to-r from-emerald-600/15 to-emerald-500/10 text-emerald-600 dark:text-emerald-300"
              : "border-violet-500/35 bg-gradient-to-r from-violet-600/15 to-violet-500/10 text-violet-600 dark:text-violet-300 hover:from-violet-600/22",
          )}
        >
          {sentinelStatus === "loading" ? (
            <><Loader2 size={11} className="animate-spin" />Téléchargement…</>
          ) : sentinelStatus === "success" ? (
            <><CheckCircle2 size={11} />Images chargées dans QGIS</>
          ) : sentinelStatus === "error" ? (
            <><AlertCircle size={11} />Réessayer</>
          ) : (
            <><Satellite size={11} />Charger {selectedBands.length > 0 ? `(${selectedBands.length} bande${selectedBands.length > 1 ? "s" : ""})` : "les bandes"}</>
          )}
        </button>
      </section>
    </div>
  );
}
