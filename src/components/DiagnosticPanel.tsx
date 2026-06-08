/**
 * DiagnosticPanel — Panneau Diagnostic satellite.
 *
 * IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI)
 * Superviseur : Claude Code 4.8 — Camil
 * Date : 2026-06-08 | Branche : chore/hygiene-puis-nvidia
 * Review obligatoire avant merge dans main.
 *
 * Fonctionnalités :
 * - Calcul d'indices spectraux (NDVI/NDWI/NDBI/NBR/EVI/SAVI/MSAVI2/NDMI)
 * - Détection de changement (2 rasters → dNDVI/dNBR)
 * - Stats zonales (NDVI moyen par polygone)
 * - Classification thématique (végétation, sévérité incendie, pentes)
 * - Aperçu des rampes de couleur pour chaque indice
 */
import { useState, useCallback } from "react";
import {
  BarChart3,
  GitCompareArrows,
  Layers,
  Activity,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/src/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type LoadStatus = "idle" | "loading" | "success" | "error";

const BRIDGE_URL = "http://localhost:8157";

// ── Données constantes ────────────────────────────────────────────────────────

interface IndexMeta {
  id: string;
  label: string;
  description: string;
  rampFrom: string;
  rampTo: string;
}

const SPECTRAL_INDICES: IndexMeta[] = [
  { id: "ndvi",   label: "NDVI",   description: "Végétation (NIR-RED)",         rampFrom: "#d73027", rampTo: "#1a9850" },
  { id: "ndwi",   label: "NDWI",   description: "Eau (GREEN-NIR)",               rampFrom: "#d73027", rampTo: "#4575b4" },
  { id: "ndbi",   label: "NDBI",   description: "Bâti (SWIR-NIR)",               rampFrom: "#ffffbf", rampTo: "#fc8d59" },
  { id: "nbr",    label: "NBR",    description: "Brûlé (NIR-SWIR)",              rampFrom: "#fee08b", rampTo: "#d73027" },
  { id: "evi",    label: "EVI",    description: "Végétation amélioré",           rampFrom: "#d73027", rampTo: "#1a9850" },
  { id: "savi",   label: "SAVI",   description: "Végétation (sol ajusté)",       rampFrom: "#d73027", rampTo: "#1a9850" },
  { id: "msavi2", label: "MSAVI2", description: "Végétation (sol modifié)",      rampFrom: "#d73027", rampTo: "#1a9850" },
  { id: "ndmi",   label: "NDMI",   description: "Humidité (NIR-SWIR)",           rampFrom: "#fc8d59", rampTo: "#4575b4" },
  { id: "bsi",    label: "BSI",    description: "Sol nu (SWIR+RED/NIR+BLUE)",    rampFrom: "#ffffbf", rampTo: "#d73027" },
];

const CLASSIFY_SCHEMES = [
  { id: "ndvi_vegetation",   label: "Végétation (NDVI)" },
  { id: "nbr_severity",      label: "Sévérité incendie (NBR)" },
  { id: "slope_classes",     label: "Classes de pente" },
  { id: "change_severity",   label: "Changement (dNDVI)" },
];

// ── Helpers API ───────────────────────────────────────────────────────────────

async function computeIndex(rasterId: string, index: string, outputPath: string): Promise<void> {
  const res = await fetch(`${BRIDGE_URL}/api/qgis/computeSpectralIndex`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rasterId, index, outputPath }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? "Erreur calcul");
}

async function computeChange(raster1Id: string, raster2Id: string, outputPath: string): Promise<void> {
  const res = await fetch(`${BRIDGE_URL}/api/qgis/computeRasterDifference`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raster1Id, raster2Id, outputPath }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? "Erreur différence raster");
}

async function runZonalStats(rasterId: string, vectorId: string, stat: string): Promise<void> {
  const res = await fetch(`${BRIDGE_URL}/api/qgis/zonalStatistics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rasterId, vectorId, stat }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? "Erreur stats zonales");
}

async function classifyRaster(rasterId: string, scheme: string, outputPath: string): Promise<void> {
  const res = await fetch(`${BRIDGE_URL}/api/qgis/classifyRaster`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rasterId, scheme, outputPath }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? "Erreur classification");
}

// ── Composant ─────────────────────────────────────────────────────────────────

export interface DiagnosticPanelProps {
  onResult?: (type: string, detail: string) => void;
}

export default function DiagnosticPanel({ onResult }: DiagnosticPanelProps) {
  // Indice spectral
  const [selectedIndex, setSelectedIndex] = useState("ndvi");
  const [indexRasterId, setIndexRasterId] = useState("");
  const [indexStatus, setIndexStatus] = useState<LoadStatus>("idle");
  const [indexError, setIndexError] = useState<string | null>(null);

  // Détection de changement
  const [raster1Id, setRaster1Id] = useState("");
  const [raster2Id, setRaster2Id] = useState("");
  const [changeStatus, setChangeStatus] = useState<LoadStatus>("idle");
  const [changeError, setChangeError] = useState<string | null>(null);

  // Stats zonales
  const [statsRasterId, setStatsRasterId] = useState("");
  const [statsVectorId, setStatsVectorId] = useState("");
  const [statType, setStatType] = useState("mean");
  const [statsStatus, setStatsStatus] = useState<LoadStatus>("idle");
  const [statsError, setStatsError] = useState<string | null>(null);

  // Classification
  const [classRasterId, setClassRasterId] = useState("");
  const [classScheme, setClassScheme] = useState("ndvi_vegetation");
  const [classStatus, setClassStatus] = useState<LoadStatus>("idle");
  const [classError, setClassError] = useState<string | null>(null);

  const handleComputeIndex = useCallback(async () => {
    if (!indexRasterId.trim()) { setIndexError("ID raster requis"); return; }
    setIndexStatus("loading"); setIndexError(null);
    try {
      await computeIndex(indexRasterId, selectedIndex, `/tmp/${selectedIndex}_result.tif`);
      setIndexStatus("success");
      onResult?.(selectedIndex, indexRasterId);
    } catch (e) {
      setIndexStatus("error");
      setIndexError(e instanceof Error ? e.message : "Erreur");
    }
  }, [indexRasterId, selectedIndex, onResult]);

  const handleChange = useCallback(async () => {
    if (!raster1Id.trim() || !raster2Id.trim()) { setChangeError("Deux rasters requis"); return; }
    setChangeStatus("loading"); setChangeError(null);
    try {
      await computeChange(raster1Id, raster2Id, "/tmp/change_result.tif");
      setChangeStatus("success");
      onResult?.("change", `${raster1Id} → ${raster2Id}`);
    } catch (e) {
      setChangeStatus("error");
      setChangeError(e instanceof Error ? e.message : "Erreur");
    }
  }, [raster1Id, raster2Id, onResult]);

  const handleZonalStats = useCallback(async () => {
    if (!statsRasterId.trim() || !statsVectorId.trim()) { setStatsError("Raster + vecteur requis"); return; }
    setStatsStatus("loading"); setStatsError(null);
    try {
      await runZonalStats(statsRasterId, statsVectorId, statType);
      setStatsStatus("success");
      onResult?.("zonal_stats", statsRasterId);
    } catch (e) {
      setStatsStatus("error");
      setStatsError(e instanceof Error ? e.message : "Erreur");
    }
  }, [statsRasterId, statsVectorId, statType, onResult]);

  const handleClassify = useCallback(async () => {
    if (!classRasterId.trim()) { setClassError("ID raster requis"); return; }
    setClassStatus("loading"); setClassError(null);
    try {
      await classifyRaster(classRasterId, classScheme, `/tmp/${classScheme}_result.tif`);
      setClassStatus("success");
      onResult?.("classify", classScheme);
    } catch (e) {
      setClassStatus("error");
      setClassError(e instanceof Error ? e.message : "Erreur");
    }
  }, [classRasterId, classScheme, onResult]);

  const indexMeta = SPECTRAL_INDICES.find((i) => i.id === selectedIndex);

  return (
    <div className="flex flex-col gap-5 p-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Activity size={18} className="text-emerald-400" />
        <span className="font-semibold text-sm text-white/90">Diagnostic satellite</span>
        {/* Pastille Devin */}
        <span
          title="Implémenté par Devin CLI — superviseur Claude Code 4.8"
          className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-600/30 text-violet-300 border border-violet-500/30"
        >
          ⚡ Devin
        </span>
      </div>

      {/* ── Indice spectral ──────────────────────────────────────────────────── */}
      <Section icon={<BarChart3 size={14} className="text-emerald-400" />} title="Indice spectral">
        {/* Sélecteur d'indice avec aperçu rampe */}
        <div className="grid grid-cols-3 gap-1.5">
          {SPECTRAL_INDICES.map((idx) => (
            <button
              key={idx.id}
              onClick={() => setSelectedIndex(idx.id)}
              title={idx.description}
              className={cn(
                "relative flex flex-col items-start px-2 py-1.5 rounded-lg border text-xs transition-colors overflow-hidden",
                selectedIndex === idx.id
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                  : "border-white/10 bg-white/4 text-white/60 hover:border-white/20",
              )}
            >
              <span className="font-mono font-semibold">{idx.label}</span>
              {/* Barre de rampe */}
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 opacity-60"
                style={{ background: `linear-gradient(to right, ${idx.rampFrom}, ${idx.rampTo})` }}
              />
            </button>
          ))}
        </div>

        {indexMeta && (
          <p className="text-[10px] text-white/40 mt-1">{indexMeta.description}</p>
        )}

        <input
          className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 mt-1"
          placeholder="ID du raster (ex: Sentinel_B04_B08)"
          value={indexRasterId}
          onChange={(e) => setIndexRasterId(e.target.value)}
        />
        {indexError && <ErrorLine msg={indexError} />}
        <ActionButton
          status={indexStatus}
          idle={`Calculer ${selectedIndex.toUpperCase()}`}
          loading="Calcul en cours…"
          success="Indice calculé"
          color="emerald"
          onClick={handleComputeIndex}
        />
      </Section>

      {/* ── Détection de changement ───────────────────────────────────────────── */}
      <Section icon={<GitCompareArrows size={14} className="text-amber-400" />} title="Détection de changement">
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
            placeholder="Raster t1 (avant)"
            value={raster1Id}
            onChange={(e) => setRaster1Id(e.target.value)}
          />
          <input
            className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
            placeholder="Raster t2 (après)"
            value={raster2Id}
            onChange={(e) => setRaster2Id(e.target.value)}
          />
        </div>
        {changeError && <ErrorLine msg={changeError} />}
        <ActionButton
          status={changeStatus}
          idle="Calculer t2 − t1"
          loading="Différence en cours…"
          success="Changement calculé"
          color="amber"
          onClick={handleChange}
        />
      </Section>

      {/* ── Stats zonales ─────────────────────────────────────────────────────── */}
      <Section icon={<Layers size={14} className="text-cyan-400" />} title="Stats zonales">
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
            placeholder="Raster (ex: NDVI)"
            value={statsRasterId}
            onChange={(e) => setStatsRasterId(e.target.value)}
          />
          <input
            className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
            placeholder="Vecteur (parcelles...)"
            value={statsVectorId}
            onChange={(e) => setStatsVectorId(e.target.value)}
          />
        </div>
        <select
          className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 focus:outline-none focus:border-cyan-500/50"
          value={statType}
          onChange={(e) => setStatType(e.target.value)}
        >
          {["mean","min","max","count","sum","stdev"].map((s) => (
            <option key={s} value={s} className="bg-gray-900">{s}</option>
          ))}
        </select>
        {statsError && <ErrorLine msg={statsError} />}
        <ActionButton
          status={statsStatus}
          idle={`Calculer ${statType} par zone`}
          loading="Stats en cours…"
          success="Stats calculées"
          color="cyan"
          onClick={handleZonalStats}
        />
      </Section>

      {/* ── Classification ────────────────────────────────────────────────────── */}
      <Section icon={<BarChart3 size={14} className="text-violet-400" />} title="Classification thématique">
        <input
          className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
          placeholder="ID du raster à classifier"
          value={classRasterId}
          onChange={(e) => setClassRasterId(e.target.value)}
        />
        <select
          className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 focus:outline-none focus:border-violet-500/50"
          value={classScheme}
          onChange={(e) => setClassScheme(e.target.value)}
        >
          {CLASSIFY_SCHEMES.map((s) => (
            <option key={s.id} value={s.id} className="bg-gray-900">{s.label}</option>
          ))}
        </select>
        {classError && <ErrorLine msg={classError} />}
        <ActionButton
          status={classStatus}
          idle="Classifier"
          loading="Classification…"
          success="Classifié"
          color="violet"
          onClick={handleClassify}
        />
      </Section>
    </div>
  );
}

// ── Sous-composants ────────────────────────────────────────────────────────────

function Section({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/3 border border-white/8">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs font-semibold text-white/70">{title}</span>
      </div>
      {children}
    </div>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
      <AlertCircle size={11} />
      {msg}
    </div>
  );
}

const COLOR_MAP = {
  emerald: "bg-emerald-600/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30",
  amber:   "bg-amber-600/20  border-amber-500/30  text-amber-300  hover:bg-amber-600/30",
  cyan:    "bg-cyan-600/20   border-cyan-500/30   text-cyan-300   hover:bg-cyan-600/30",
  violet:  "bg-violet-600/20 border-violet-500/30 text-violet-300 hover:bg-violet-600/30",
} as const;

function ActionButton({
  status, idle, loading, success, color, onClick,
}: {
  status: LoadStatus;
  idle: string;
  loading: string;
  success: string;
  color: keyof typeof COLOR_MAP;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={status === "loading"}
      className={cn(
        "flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg border text-xs transition-colors disabled:opacity-50",
        COLOR_MAP[color],
      )}
    >
      {status === "loading" ? (
        <><Loader2 size={11} className="animate-spin" />{loading}</>
      ) : status === "success" ? (
        <><CheckCircle2 size={11} />{success}</>
      ) : (
        idle
      )}
    </button>
  );
}
