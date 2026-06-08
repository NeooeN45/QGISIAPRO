/**
 * DiagnosticPanel — Calcul d'indices spectraux, détection de changement,
 * stats zonales et classification thématique.
 *
 * Redesign UX 2026-06-08 : sélecteurs couches auto, zéro saisie technique,
 * panneau scroll unique, états complets.
 *
 * Amélioré 2026-06-09 — fiabilité + polish visuel :
 *  - Banner global si aucune couche (layers=[]) avec icône + guide
 *  - Valeurs fallback "—" sur tous les champs optionnels
 *  - Composant DiagAlert : icône + couleur selon sévérité (error/warning/info)
 *  - Mini barre SVG inline pour chaque indice spectral
 *  - Stagger d'entrée sur les sections (motion/react)
 *  - Indicateur de résultat avec animation au succès
 *
 * IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI)
 * Superviseur : Claude Code 4.8 — Camil
 */
import { useState, useCallback } from "react";
import {
  Activity,
  BarChart3,
  GitCompareArrows,
  Layers,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  ChevronDown,
  TriangleAlert,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type LoadStatus = "idle" | "loading" | "success" | "error";
type AlertSeverity = "error" | "warning" | "info";

const BRIDGE_URL = "http://localhost:8157";

interface LayerOption {
  id: string;
  name: string;
  type: string;
}

interface IndexMeta {
  id: string;
  label: string;
  description: string;
  useCase: string;
  rampFrom: string;
  rampTo: string;
}

const SPECTRAL_INDICES: IndexMeta[] = [
  { id: "ndvi",  label: "NDVI",  description: "Santé de la végétation",        useCase: "Forêts, prairies, agriculture",    rampFrom: "#d73027", rampTo: "#1a9850" },
  { id: "ndwi",  label: "NDWI",  description: "Présence d'eau",                useCase: "Lacs, rivières, humidité sol",      rampFrom: "#d73027", rampTo: "#4575b4" },
  { id: "ndbi",  label: "NDBI",  description: "Surfaces bâties",               useCase: "Urbanisation, imperméabilisation",  rampFrom: "#ffffbf", rampTo: "#fc8d59" },
  { id: "nbr",   label: "NBR",   description: "Zones brûlées",                 useCase: "Incendies, sévérité des feux",      rampFrom: "#fee08b", rampTo: "#d73027" },
  { id: "evi",   label: "EVI",   description: "Végétation (version améliorée)",useCase: "Zones denses, canopée épaisse",     rampFrom: "#d73027", rampTo: "#1a9850" },
  { id: "ndmi",  label: "NDMI",  description: "Humidité de la végétation",     useCase: "Stress hydrique, sécheresse",       rampFrom: "#fc8d59", rampTo: "#4575b4" },
  { id: "bsi",   label: "BSI",   description: "Sol nu",                        useCase: "Désertification, érosion",          rampFrom: "#ffffbf", rampTo: "#d73027" },
];

const CLASSIFY_SCHEMES = [
  { id: "ndvi_vegetation", label: "Végétation (NDVI)", description: "5 classes : absent → dense" },
  { id: "nbr_severity",    label: "Sévérité incendie", description: "4 classes : non brûlé → très sévère" },
  { id: "slope_classes",   label: "Classes de pente",  description: "6 classes : 0–5% → >45%" },
  { id: "change_severity", label: "Changement dNDVI",  description: "Gain / stable / perte de végétation" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiPost(endpoint: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${BRIDGE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(data.error ?? "Erreur inconnue");
}

// ── Sous-composants ───────────────────────────────────────────────────────────

/** Alerte contextuelle avec icône et couleur selon la sévérité */
function DiagAlert({ severity, children }: { severity: AlertSeverity; children: React.ReactNode }) {
  const styles: Record<AlertSeverity, { wrap: string; icon: React.ReactNode }> = {
    error: {
      wrap: "border-red-400/30 bg-red-500/[0.06] text-red-600 dark:text-red-400",
      icon: <AlertCircle size={12} className="text-red-500 shrink-0 mt-0.5" />,
    },
    warning: {
      wrap: "border-amber-500/30 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300",
      icon: <TriangleAlert size={12} className="text-amber-500 shrink-0 mt-0.5" />,
    },
    info: {
      wrap: "border-blue-500/25 bg-blue-500/[0.05] text-blue-700 dark:text-blue-300",
      icon: <Info size={12} className="text-blue-500 shrink-0 mt-0.5" />,
    },
  };
  const { wrap, icon } = styles[severity];
  return (
    <div className={cn("flex items-start gap-2 rounded-xl border px-3 py-2.5", wrap)}>
      {icon}
      <p className="text-[11px] leading-relaxed">{children}</p>
    </div>
  );
}

/** Mini barre SVG représentant le gradient de l'indice + valeur symbolique */
function IndexGradientBar({ rampFrom, rampTo }: { rampFrom: string; rampTo: string }) {
  const gradId = `grad-${rampFrom.replace("#", "")}-${rampTo.replace("#", "")}`;
  return (
    <svg width="100%" height="4" className="rounded-full overflow-hidden block">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={rampFrom} />
          <stop offset="100%" stopColor={rampTo} />
        </linearGradient>
      </defs>
      <rect width="100%" height="4" fill={`url(#${gradId})`} rx="2" />
    </svg>
  );
}

/** Select de couche avec état vide guidé */
function LayerSelect({
  label, layers, value, onChange, filterType, accentClass, placeholder,
}: {
  label: string;
  layers: LayerOption[];
  value: string;
  onChange: (v: string) => void;
  filterType?: "raster" | "vector";
  accentClass: string;
  placeholder?: string;
}) {
  const filtered = filterType
    ? layers.filter((l) => l.type.toLowerCase().includes(filterType))
    : layers;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-gray-500 dark:text-white/40 uppercase tracking-[0.15em]">
        {label}
      </label>
      {filtered.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-300 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.02] px-3 py-2 text-[11px] text-gray-400 dark:text-white/30">
          <Info size={12} className="shrink-0" />
          {filterType === "raster"
            ? "Chargez un raster dans QGIS d'abord"
            : "Chargez une couche vectorielle d'abord"}
        </div>
      ) : (
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "w-full appearance-none rounded-xl border bg-gray-100/80 dark:bg-white/[0.04] px-3 py-2 pr-8 text-[12px] text-gray-800 dark:text-white/75 focus:outline-none transition-colors",
              value
                ? `border-gray-200 dark:border-white/[0.08] focus:${accentClass}`
                : "border-dashed border-gray-300 dark:border-white/[0.1]",
            )}
          >
            <option value="">{placeholder ?? "Choisir une couche…"}</option>
            {filtered.map((l) => (
              <option key={l.id} value={l.id} className="bg-white dark:bg-gray-900">
                {l.name}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30" />
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  status, idle, color, onClick, disabled,
}: {
  status: LoadStatus;
  idle: string;
  color: "emerald" | "amber" | "cyan" | "violet";
  onClick: () => void;
  disabled?: boolean;
}) {
  const variants: Record<string, string> = {
    emerald: "border-emerald-500/35 from-emerald-600/15 to-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:from-emerald-600/22 hover:shadow-emerald-500/20",
    amber:   "border-amber-500/35 from-amber-600/15 to-amber-500/10 text-amber-600 dark:text-amber-300 hover:from-amber-600/22 hover:shadow-amber-500/20",
    cyan:    "border-cyan-500/35 from-cyan-600/15 to-cyan-500/10 text-cyan-600 dark:text-cyan-300 hover:from-cyan-600/22 hover:shadow-cyan-500/20",
    violet:  "border-violet-500/35 from-violet-600/15 to-violet-500/10 text-violet-600 dark:text-violet-300 hover:from-violet-600/22 hover:shadow-violet-500/20",
  };
  return (
    <motion.button
      onClick={onClick}
      disabled={status === "loading" || disabled}
      whileTap={!disabled && status !== "loading" ? { scale: 0.97 } : undefined}
      className={cn(
        "flex w-full items-center justify-center gap-1.5 rounded-xl border bg-gradient-to-r py-2 text-[12px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm",
        variants[color],
        status === "success" && "border-emerald-500/30 from-emerald-500/10 to-emerald-500/8 text-emerald-600 dark:text-emerald-400",
      )}
    >
      {status === "loading" && <Loader2 size={12} className="animate-spin" />}
      {status === "success" && <CheckCircle2 size={12} />}
      {status === "error"   && <AlertCircle  size={12} />}
      {status === "loading" ? "Calcul en cours…"
       : status === "success" ? "Terminé ✓"
       : status === "error" ? "Réessayer"
       : idle}
    </motion.button>
  );
}

/** Bandeau de résultat succès avec animation d'entrée */
function SuccessBanner({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-2.5 py-1.5"
    >
      <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
      <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
        Couche <span className="font-semibold">{label}</span> ajoutée dans QGIS
      </p>
    </motion.div>
  );
}

// Délais d'entrée stagger pour les sections
const SECTION_DELAYS = [0, 0.05, 0.10, 0.15];

// ── Composant principal ───────────────────────────────────────────────────────

export interface DiagnosticPanelProps {
  /** Couches QGIS actuellement chargées — pré-remplit les sélecteurs */
  layers?: LayerOption[];
  onResult?: (type: string, detail: string) => void;
}

export default function DiagnosticPanel({ layers = [], onResult }: DiagnosticPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState("ndvi");
  const [indexRasterId, setIndexRasterId] = useState("");
  const [indexStatus, setIndexStatus] = useState<LoadStatus>("idle");
  const [indexResultLabel, setIndexResultLabel] = useState("");

  const [raster1Id, setRaster1Id] = useState("");
  const [raster2Id, setRaster2Id] = useState("");
  const [changeStatus, setChangeStatus] = useState<LoadStatus>("idle");
  const [changeResultLabel, setChangeResultLabel] = useState("");

  const [statsRasterId, setStatsRasterId] = useState("");
  const [statsVectorId, setStatsVectorId] = useState("");
  const [statType, setStatType] = useState("mean");
  const [statsStatus, setStatsStatus] = useState<LoadStatus>("idle");
  const [statsResultLabel, setStatsResultLabel] = useState("");

  const [classRasterId, setClassRasterId] = useState("");
  const [classScheme, setClassScheme] = useState("ndvi_vegetation");
  const [classStatus, setClassStatus] = useState<LoadStatus>("idle");
  const [classResultLabel, setClassResultLabel] = useState("");

  const indexMeta = SPECTRAL_INDICES.find((i) => i.id === selectedIndex);
  const rasterLayers = layers.filter((l) => l.type.toLowerCase().includes("raster"));
  const vectorLayers = layers.filter((l) => l.type.toLowerCase().includes("vector"));

  const noLayers  = layers.length === 0;
  const noRasters = rasterLayers.length === 0;
  const noVectors = vectorLayers.length === 0;

  // ── Helpers nommage ─────────────────────────────────────────────────────────

  const layerNameById = useCallback((id: string): string =>
    layers.find((l) => l.id === id)?.name ?? id,
  [layers]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleComputeIndex = useCallback(async () => {
    if (!indexRasterId) { toast.warning("Sélectionne un raster"); return; }
    setIndexStatus("loading");
    setIndexResultLabel("");
    try {
      await apiPost("/api/qgis/computeSpectralIndex", {
        rasterId: indexRasterId,
        index: selectedIndex,
        outputPath: `/tmp/${selectedIndex}_result.tif`,
      });
      const label = `${selectedIndex.toUpperCase()} — ${layerNameById(indexRasterId)}`;
      setIndexResultLabel(label);
      setIndexStatus("success");
      onResult?.(selectedIndex, layerNameById(indexRasterId));
      toast.success(`Indice ${selectedIndex.toUpperCase()} calculé`);
    } catch (e) {
      setIndexStatus("error");
      toast.error(e instanceof Error ? e.message : "Erreur calcul");
    }
  }, [indexRasterId, selectedIndex, layerNameById, onResult]);

  const handleChange = useCallback(async () => {
    if (!raster1Id || !raster2Id) { toast.warning("Sélectionne les deux rasters"); return; }
    setChangeStatus("loading");
    setChangeResultLabel("");
    try {
      await apiPost("/api/qgis/computeRasterDifference", {
        raster1Id, raster2Id, outputPath: "/tmp/change_result.tif",
      });
      const label = `${layerNameById(raster1Id)} → ${layerNameById(raster2Id)}`;
      setChangeResultLabel(label);
      setChangeStatus("success");
      onResult?.("change", label);
      toast.success("Différence calculée");
    } catch (e) {
      setChangeStatus("error");
      toast.error(e instanceof Error ? e.message : "Erreur différence");
    }
  }, [raster1Id, raster2Id, layerNameById, onResult]);

  const handleZonalStats = useCallback(async () => {
    if (!statsRasterId || !statsVectorId) {
      toast.warning("Sélectionne le raster et la couche de zones");
      return;
    }
    setStatsStatus("loading");
    setStatsResultLabel("");
    try {
      await apiPost("/api/qgis/zonalStatistics", {
        rasterId: statsRasterId, vectorId: statsVectorId, stat: statType,
      });
      const label = `${statType} de ${layerNameById(statsRasterId)}`;
      setStatsResultLabel(label);
      setStatsStatus("success");
      onResult?.("zonal_stats", layerNameById(statsRasterId));
      toast.success("Statistiques zonales calculées");
    } catch (e) {
      setStatsStatus("error");
      toast.error(e instanceof Error ? e.message : "Erreur stats");
    }
  }, [statsRasterId, statsVectorId, statType, layerNameById, onResult]);

  const handleClassify = useCallback(async () => {
    if (!classRasterId) { toast.warning("Sélectionne un raster"); return; }
    setClassStatus("loading");
    setClassResultLabel("");
    try {
      await apiPost("/api/qgis/classifyRaster", {
        rasterId: classRasterId, scheme: classScheme,
        outputPath: `/tmp/${classScheme}_result.tif`,
      });
      const schemeMeta = CLASSIFY_SCHEMES.find((s) => s.id === classScheme);
      const label = schemeMeta?.label ?? classScheme;
      setClassResultLabel(label);
      setClassStatus("success");
      onResult?.("classify", classScheme);
      toast.success("Classification terminée");
    } catch (e) {
      setClassStatus("error");
      toast.error(e instanceof Error ? e.message : "Erreur classification");
    }
  }, [classRasterId, classScheme, onResult]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 p-3.5">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Activity size={15} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
          Analyse satellite
        </span>
        <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-violet-500/[0.12] text-violet-500 dark:text-violet-300 border border-violet-500/20">
          ⚡ Devin
        </span>
      </div>

      {/* ── Banner global : aucune couche chargée ──────────────────────────── */}
      {noLayers && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-3">
          <div className="flex items-start gap-2">
            <Layers size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                Aucune couche dans QGIS
              </p>
              <p className="text-[10px] text-amber-600/70 dark:text-amber-400/60 mt-0.5 leading-relaxed">
                Charge d'abord des couches dans QGIS (onglet Données) pour activer les outils d'analyse.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Avertissement si couches présentes mais aucun raster */}
      {!noLayers && noRasters && (
        <DiagAlert severity="warning">
          Charge d'abord un raster (GeoTIFF, Sentinel-2…) dans QGIS pour activer les outils.
        </DiagAlert>
      )}

      {/* ── 1. Indice spectral ──────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: SECTION_DELAYS[0], duration: 0.25 }}
        className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02] p-3.5 shadow-sm flex flex-col gap-3"
      >
        <div className="flex items-center gap-1.5">
          <BarChart3 size={13} className="text-emerald-500 dark:text-emerald-400" />
          <p className="text-[11px] font-bold text-gray-700 dark:text-white/70">Indice spectral</p>
          <span className="ml-auto text-[10px] text-gray-400 dark:text-white/25">Étape 1 sur 2</span>
        </div>

        {/* Sélection de l'indice avec mini barre SVG */}
        <div className="grid grid-cols-4 gap-1">
          {SPECTRAL_INDICES.map((idx) => (
            <button
              key={idx.id}
              onClick={() => { setSelectedIndex(idx.id); setIndexStatus("idle"); setIndexResultLabel(""); }}
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-xl border py-2 px-1 text-[10px] font-bold transition-all overflow-hidden",
                selectedIndex === idx.id
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.03] text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:text-gray-700 dark:hover:text-white/60",
              )}
            >
              <span className="font-mono">{idx.label}</span>
              {/* Mini barre gradient SVG en bas du bouton */}
              <div className="w-full px-0.5">
                <IndexGradientBar rampFrom={idx.rampFrom} rampTo={idx.rampTo} />
              </div>
            </button>
          ))}
        </div>

        {/* Description de l'indice sélectionné */}
        {indexMeta && (
          <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2 flex gap-2">
            <Info size={12} className="text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                {indexMeta.description}
              </p>
              <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/60 mt-0.5">
                Cas d'usage : {indexMeta.useCase}
              </p>
            </div>
          </div>
        )}

        <LayerSelect
          label="Sur quelle image ?"
          layers={layers}
          value={indexRasterId}
          onChange={(v) => { setIndexRasterId(v); setIndexStatus("idle"); setIndexResultLabel(""); }}
          filterType="raster"
          accentClass="border-emerald-500/40"
          placeholder="Choisir un raster…"
        />

        {/* Résultat précédent */}
        {indexStatus === "success" && indexResultLabel && (
          <SuccessBanner label={indexResultLabel} />
        )}
        {indexStatus === "error" && (
          <DiagAlert severity="error">
            Calcul d'indice échoué — vérifie que le raster est bien un multiband Sentinel-2.
          </DiagAlert>
        )}

        <ActionBtn
          status={indexStatus}
          idle={`Calculer ${selectedIndex.toUpperCase()}`}
          color="emerald"
          onClick={() => void handleComputeIndex()}
          disabled={!indexRasterId || noRasters}
        />
      </motion.section>

      {/* ── 2. Détection de changement ─────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: SECTION_DELAYS[1], duration: 0.25 }}
        className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02] p-3.5 shadow-sm flex flex-col gap-3"
      >
        <div className="flex items-center gap-1.5">
          <GitCompareArrows size={13} className="text-amber-500 dark:text-amber-400" />
          <p className="text-[11px] font-bold text-gray-700 dark:text-white/70">Détection de changement</p>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-white/30 leading-relaxed -mt-1">
          Soustrait deux rasters (T1 − T2) et visualise les zones de gain/perte.
        </p>

        <LayerSelect
          label="Image ancienne (T1)"
          layers={layers}
          value={raster1Id}
          onChange={(v) => { setRaster1Id(v); setChangeStatus("idle"); setChangeResultLabel(""); }}
          filterType="raster"
          accentClass="border-amber-500/40"
          placeholder="Image la plus ancienne"
        />
        <LayerSelect
          label="Image récente (T2)"
          layers={layers}
          value={raster2Id}
          onChange={(v) => { setRaster2Id(v); setChangeStatus("idle"); setChangeResultLabel(""); }}
          filterType="raster"
          accentClass="border-amber-500/40"
          placeholder="Image la plus récente"
        />

        {changeStatus === "success" && changeResultLabel && (
          <SuccessBanner label={changeResultLabel} />
        )}
        {changeStatus === "error" && (
          <DiagAlert severity="error">
            Calcul de différence échoué — les deux rasters doivent avoir la même emprise et résolution.
          </DiagAlert>
        )}

        <ActionBtn
          status={changeStatus}
          idle="Calculer les changements"
          color="amber"
          onClick={() => void handleChange()}
          disabled={!raster1Id || !raster2Id}
        />
      </motion.section>

      {/* ── 3. Stats zonales ──────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: SECTION_DELAYS[2], duration: 0.25 }}
        className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02] p-3.5 shadow-sm flex flex-col gap-3"
      >
        <div className="flex items-center gap-1.5">
          <Layers size={13} className="text-cyan-500 dark:text-cyan-400" />
          <p className="text-[11px] font-bold text-gray-700 dark:text-white/70">Statistiques par zone</p>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-white/30 leading-relaxed -mt-1">
          Calcule une valeur (moyenne, max…) d'un raster pour chaque polygone d'une couche.
        </p>

        <LayerSelect
          label="Raster à analyser"
          layers={layers}
          value={statsRasterId}
          onChange={(v) => { setStatsRasterId(v); setStatsStatus("idle"); setStatsResultLabel(""); }}
          filterType="raster"
          accentClass="border-cyan-500/40"
          placeholder="Ex : NDVI calculé"
        />

        {/* Avertissement si pas de vecteurs */}
        {!noRasters && noVectors && (
          <DiagAlert severity="info">
            Charge une couche de polygones dans QGIS pour définir les zones de calcul.
          </DiagAlert>
        )}

        <LayerSelect
          label="Zones (polygones)"
          layers={layers}
          value={statsVectorId}
          onChange={(v) => { setStatsVectorId(v); setStatsStatus("idle"); setStatsResultLabel(""); }}
          filterType="vector"
          accentClass="border-cyan-500/40"
          placeholder="Ex : Parcelles cadastrales"
        />

        {/* Sélecteur statistique — visuellement cliquable */}
        <div>
          <p className="text-[10px] font-semibold text-gray-500 dark:text-white/40 uppercase tracking-[0.15em] mb-1.5">
            Statistique
          </p>
          <div className="flex flex-wrap gap-1">
            {[
              { id: "mean",  label: "Moyenne" },
              { id: "max",   label: "Maximum" },
              { id: "min",   label: "Minimum" },
              { id: "sum",   label: "Somme" },
              { id: "count", label: "Pixels" },
              { id: "stdev", label: "Écart-type" },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setStatType(s.id)}
                className={cn(
                  "text-[11px] px-2.5 py-1 rounded-lg border transition-all",
                  statType === s.id
                    ? "border-cyan-500/40 bg-cyan-500/[0.12] text-cyan-600 dark:text-cyan-300 font-semibold"
                    : "border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.03] text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/[0.06]",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {statsStatus === "success" && statsResultLabel && (
          <SuccessBanner label={statsResultLabel} />
        )}
        {statsStatus === "error" && (
          <DiagAlert severity="error">
            Calcul des statistiques échoué — vérifie que les couches se superposent géographiquement.
          </DiagAlert>
        )}

        <ActionBtn
          status={statsStatus}
          idle={`Calculer la ${statType === "mean" ? "moyenne" : statType === "max" ? "valeur max" : statType === "min" ? "valeur min" : statType}`}
          color="cyan"
          onClick={() => void handleZonalStats()}
          disabled={!statsRasterId || !statsVectorId}
        />
      </motion.section>

      {/* ── 4. Classification thématique ──────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: SECTION_DELAYS[3], duration: 0.25 }}
        className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02] p-3.5 shadow-sm flex flex-col gap-3"
      >
        <div className="flex items-center gap-1.5">
          <BarChart3 size={13} className="text-violet-500 dark:text-violet-400" />
          <p className="text-[11px] font-bold text-gray-700 dark:text-white/70">Classification en classes</p>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-white/30 leading-relaxed -mt-1">
          Convertit les valeurs continues d'un raster en catégories visuelles.
        </p>

        {/* Sélecteur schéma — cartes visuelles */}
        <div className="grid grid-cols-2 gap-1.5">
          {CLASSIFY_SCHEMES.map((s) => (
            <button
              key={s.id}
              onClick={() => { setClassScheme(s.id); setClassStatus("idle"); setClassResultLabel(""); }}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-xl border px-2.5 py-2 text-left transition-all",
                classScheme === s.id
                  ? "border-violet-500/40 bg-violet-500/[0.08] text-violet-700 dark:text-violet-300"
                  : "border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.03] text-gray-600 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/[0.06]",
              )}
            >
              <span className="text-[11px] font-semibold">{s.label}</span>
              <span className="text-[9px] text-gray-400 dark:text-white/25">{s.description}</span>
            </button>
          ))}
        </div>

        <LayerSelect
          label="Raster à classifier"
          layers={layers}
          value={classRasterId}
          onChange={(v) => { setClassRasterId(v); setClassStatus("idle"); setClassResultLabel(""); }}
          filterType="raster"
          accentClass="border-violet-500/40"
          placeholder="Ex : NDVI, NBR, pente…"
        />

        {classStatus === "success" && classResultLabel && (
          <SuccessBanner label={classResultLabel} />
        )}
        {classStatus === "error" && (
          <DiagAlert severity="error">
            Classification échouée — vérifie que le raster est correctement géoréférencé.
          </DiagAlert>
        )}

        <ActionBtn
          status={classStatus}
          idle="Classifier"
          color="violet"
          onClick={() => void handleClassify()}
          disabled={!classRasterId}
        />
      </motion.section>
    </div>
  );
}
