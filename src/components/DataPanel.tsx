/**
 * DataPanel — Panneau Données (catalogue mondial + Sentinel-2 STAC).
 *
 * IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI)
 * Superviseur : Claude Code 4.8 — Camil
 * Date : 2026-06-08 | Branche : chore/hygiene-puis-nvidia
 * Review obligatoire avant merge dans main.
 *
 * Expose :
 * - Catalogue de sources cartographiques (XYZ/WMTS/WMS) avec recherche + filtre catégorie
 * - Chargement d'une source en 1 clic via addDataSource
 * - Chargement Sentinel-2 réel (bbox + période) via loadSatelliteBands
 */
import { useState, useCallback } from "react";
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
  Cloud,
} from "lucide-react";
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

const CATEGORY_COLORS: Record<string, string> = {
  basemap: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
  satellite: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  france: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  relief: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  occupation_sol: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  labels: "bg-gray-500/10 text-gray-300 border-gray-500/20",
};

const CATEGORY_LABELS: Record<string, string> = {
  basemap: "Fond",
  satellite: "Satellite",
  france: "France",
  relief: "Relief",
  occupation_sol: "Occupation",
  labels: "Labels",
};

// ── Helpers API ───────────────────────────────────────────────────────────────

async function fetchSources(category?: string): Promise<DataSource[]> {
  const url = new URL(`${BRIDGE_URL}/api/qgis/listDataSources`);
  if (category) url.searchParams.set("category", category);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.sources ?? []) as DataSource[];
}

async function loadSource(sourceId: string): Promise<void> {
  const res = await fetch(`${BRIDGE_URL}/api/qgis/addDataSource`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? "Erreur inconnue");
}

async function loadSentinelBands(
  bbox: string,
  bands: string,
  period: string,
): Promise<void> {
  const res = await fetch(`${BRIDGE_URL}/api/qgis/loadSatelliteBands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bbox, bands, datetime: period }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? "Erreur inconnue");
}

// ── Composant ─────────────────────────────────────────────────────────────────

export interface DataPanelProps {
  /** Sources déjà chargées (pré-populées depuis le parent optionnellement). */
  initialSources?: DataSource[];
  /** Appelé quand une source est chargée dans QGIS. */
  onSourceLoaded?: (sourceId: string) => void;
}

export default function DataPanel({ initialSources, onSourceLoaded }: DataPanelProps) {
  const [sources, setSources] = useState<DataSource[]>(initialSources ?? []);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [fetchStatus, setFetchStatus] = useState<LoadStatus>("idle");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sentinel panel
  const [sentinelBbox, setSentinelBbox] = useState("");
  const [sentinelPeriod, setSentinelPeriod] = useState("2024-06-01/2024-06-30");
  const [sentinelBands, setSentinelBands] = useState("B04,B08");
  const [sentinelStatus, setSentinelStatus] = useState<LoadStatus>("idle");
  const [sentinelError, setSentinelError] = useState<string | null>(null);

  const categories = Array.from(new Set(sources.map((s) => s.category))).sort();

  const fetchCatalog = useCallback(async (cat?: string) => {
    setFetchStatus("loading");
    setErrorMsg(null);
    try {
      const data = await fetchSources(cat ?? undefined);
      setSources(data);
      setFetchStatus("success");
    } catch (e) {
      setFetchStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Erreur réseau");
    }
  }, []);

  const handleCategoryChange = useCallback((cat: string | null) => {
    setActiveCategory(cat);
    fetchCatalog(cat ?? undefined);
  }, [fetchCatalog]);

  const handleLoad = useCallback(async (src: DataSource) => {
    setLoadingId(src.id);
    setErrorMsg(null);
    try {
      await loadSource(src.id);
      setLoadedIds((prev) => new Set([...prev, src.id]));
      onSourceLoaded?.(src.id);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Erreur chargement");
    } finally {
      setLoadingId(null);
    }
  }, [onSourceLoaded]);

  const handleSentinel = useCallback(async () => {
    if (!sentinelBbox.trim()) {
      setSentinelError("Emprise requise (ex: 1.2,43.5,1.8,44.0)");
      return;
    }
    setSentinelStatus("loading");
    setSentinelError(null);
    try {
      await loadSentinelBands(sentinelBbox, sentinelBands, sentinelPeriod);
      setSentinelStatus("success");
    } catch (e) {
      setSentinelStatus("error");
      setSentinelError(e instanceof Error ? e.message : "Erreur Sentinel");
    }
  }, [sentinelBbox, sentinelBands, sentinelPeriod]);

  const filtered = sources.filter((s) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.provider?.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Globe size={18} className="text-cyan-400" />
        <span className="font-semibold text-sm text-white/90">Catalogue de données</span>
        {/* Pastille Devin */}
        <span
          title="Implémenté par Devin CLI — superviseur Claude Code 4.8"
          className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-600/30 text-violet-300 border border-violet-500/30"
        >
          ⚡ Devin
        </span>
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
          placeholder="Rechercher une source..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
            onClick={() => setQuery("")}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Filtres catégorie */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => handleCategoryChange(null)}
          className={cn(
            "text-xs px-2 py-1 rounded border transition-colors",
            activeCategory === null
              ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
              : "bg-white/5 text-white/50 border-white/10 hover:border-white/20",
          )}
        >
          Tout
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat === activeCategory ? null : cat)}
            className={cn(
              "text-xs px-2 py-1 rounded border transition-colors",
              activeCategory === cat
                ? CATEGORY_COLORS[cat] ?? "bg-white/15 text-white border-white/30"
                : "bg-white/5 text-white/50 border-white/10 hover:border-white/20",
            )}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
        <button
          onClick={() => fetchCatalog(activeCategory ?? undefined)}
          className="text-xs px-2 py-1 rounded border bg-white/5 text-white/50 border-white/10 hover:border-white/20 ml-auto"
        >
          {fetchStatus === "loading" ? <Loader2 size={11} className="animate-spin" /> : "↻"}
        </button>
      </div>

      {/* Erreur */}
      {errorMsg && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
          <AlertCircle size={13} />
          {errorMsg}
        </div>
      )}

      {/* Liste de sources */}
      {filtered.length === 0 && fetchStatus !== "loading" && (
        <div className="text-xs text-white/30 text-center py-6">
          {sources.length === 0
            ? "Cliquez sur ↻ pour charger le catalogue"
            : "Aucune source ne correspond à la recherche"}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {filtered.map((src) => (
          <div
            key={src.id}
            className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-white/4 border border-white/8 hover:border-white/16 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white/80 truncate">{src.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded border",
                    CATEGORY_COLORS[src.category] ?? "bg-white/8 text-white/50 border-white/10",
                  )}
                >
                  {CATEGORY_LABELS[src.category] ?? src.category}
                </span>
                {src.coverage && (
                  <span className="text-[10px] text-white/30 flex items-center gap-0.5">
                    <MapPin size={9} />
                    {src.coverage}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => handleLoad(src)}
              disabled={loadingId === src.id || loadedIds.has(src.id)}
              title={loadedIds.has(src.id) ? "Déjà chargée" : "Charger dans QGIS"}
              className={cn(
                "flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors border",
                loadedIds.has(src.id)
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-cyan-500/10 text-cyan-300 border-cyan-500/20 hover:bg-cyan-500/20 opacity-0 group-hover:opacity-100",
              )}
            >
              {loadingId === src.id ? (
                <Loader2 size={11} className="animate-spin" />
              ) : loadedIds.has(src.id) ? (
                <CheckCircle2 size={11} />
              ) : (
                <Plus size={11} />
              )}
              {loadedIds.has(src.id) ? "Chargée" : "Charger"}
            </button>
          </div>
        ))}
      </div>

      {/* Section Sentinel-2 */}
      <div className="mt-2 border-t border-white/8 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Satellite size={15} className="text-violet-400" />
          <span className="text-xs font-semibold text-white/80">Sentinel-2 réel (STAC)</span>
          <Cloud size={12} className="text-white/30 ml-auto" />
        </div>
        <div className="flex flex-col gap-2">
          <input
            className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
            placeholder="Emprise : minlon,minlat,maxlon,maxlat (ex: 1.2,43.5,1.8,44.0)"
            value={sentinelBbox}
            onChange={(e) => setSentinelBbox(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
              placeholder="Période : 2024-06-01/2024-06-30"
              value={sentinelPeriod}
              onChange={(e) => setSentinelPeriod(e.target.value)}
            />
            <input
              className="w-28 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
              placeholder="Bandes"
              value={sentinelBands}
              onChange={(e) => setSentinelBands(e.target.value)}
              title="Bandes séparées par virgule : B04,B08 (RED,NIR)"
            />
          </div>
          {sentinelError && (
            <p className="text-[10px] text-red-400">{sentinelError}</p>
          )}
          <button
            onClick={handleSentinel}
            disabled={sentinelStatus === "loading"}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-xs text-violet-300 hover:bg-violet-600/30 transition-colors disabled:opacity-50"
          >
            {sentinelStatus === "loading" ? (
              <><Loader2 size={12} className="animate-spin" />Chargement…</>
            ) : sentinelStatus === "success" ? (
              <><CheckCircle2 size={12} />Bandes chargées</>
            ) : (
              <><Satellite size={12} />Charger les bandes Sentinel</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
