/**
 * DossierPanel — Dossiers territoriaux 1-clic.
 *
 * Amélioré 2026-06-09 — fiabilité + polish visuel :
 *  - État dégradé bridge (WifiOff + bouton "Réessayer") si fetchDossiers throw
 *  - Progress bar animée avec shimmer pendant l'exécution
 *  - Étapes workflow : dots visuels (pending/in-progress/done/error)
 *  - Stagger d'entrée des couches du résultat (motion/react)
 *  - whileTap sur le bouton d'action
 *
 * IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI)
 * Superviseur : Claude Code 4.8 — Camil | 2026-06-08
 */
import { useState, useCallback, useEffect } from "react";
import {
  FolderOpen,
  Building2,
  Trees,
  Droplets,
  MapPinned,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  WifiOff,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DossierMeta {
  id: string;
  name: string;
  description?: string;
  steps: number;
}

interface RunDossierResult {
  ok: boolean;
  steps_done?: number;
  total?: number;
  layers?: string[];
  error?: string;
}

type DossierStatus = "idle" | "loading" | "success" | "error";

const BRIDGE_URL = "http://localhost:8157";

// ── Helpers visuels ───────────────────────────────────────────────────────────

function dossierIcon(id: string): React.ReactNode {
  if (id.includes("urban"))  return <Building2  size={14} className="text-blue-500 dark:text-blue-400" />;
  if (id.includes("foret"))  return <Trees       size={14} className="text-emerald-500 dark:text-emerald-400" />;
  if (id.includes("risque")) return <Droplets    size={14} className="text-amber-500 dark:text-amber-400" />;
  if (id.includes("envir"))  return <MapPinned   size={14} className="text-cyan-500 dark:text-cyan-400" />;
  return <FolderOpen size={14} className="text-gray-400 dark:text-white/40" />;
}

function dossierAccent(id: string): { card: string; action: string; header: string; progress: string } {
  if (id.includes("urban"))  return {
    card:     "border-blue-500/25 dark:border-blue-500/20 bg-blue-50/40 dark:bg-blue-500/[0.04]",
    action:   "border-blue-500/35 bg-gradient-to-r from-blue-600/15 to-blue-500/10 text-blue-600 dark:text-blue-300 hover:from-blue-600/22 hover:to-blue-500/15",
    header:   "text-blue-600 dark:text-blue-400",
    progress: "bg-blue-500",
  };
  if (id.includes("foret"))  return {
    card:     "border-emerald-500/25 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/[0.04]",
    action:   "border-emerald-500/35 bg-gradient-to-r from-emerald-600/15 to-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:from-emerald-600/22 hover:to-emerald-500/15",
    header:   "text-emerald-600 dark:text-emerald-400",
    progress: "bg-emerald-500",
  };
  if (id.includes("risque")) return {
    card:     "border-amber-500/25 dark:border-amber-500/20 bg-amber-50/40 dark:bg-amber-500/[0.04]",
    action:   "border-amber-500/35 bg-gradient-to-r from-amber-600/15 to-amber-500/10 text-amber-600 dark:text-amber-300 hover:from-amber-600/22 hover:to-amber-500/15",
    header:   "text-amber-600 dark:text-amber-400",
    progress: "bg-amber-500",
  };
  if (id.includes("envir"))  return {
    card:     "border-cyan-500/25 dark:border-cyan-500/20 bg-cyan-50/40 dark:bg-cyan-500/[0.04]",
    action:   "border-cyan-500/35 bg-gradient-to-r from-cyan-600/15 to-cyan-500/10 text-cyan-600 dark:text-cyan-300 hover:from-cyan-600/22 hover:to-cyan-500/15",
    header:   "text-cyan-600 dark:text-cyan-400",
    progress: "bg-cyan-500",
  };
  return {
    card:     "border-gray-200 dark:border-white/[0.08] bg-gray-50/40 dark:bg-white/[0.02]",
    action:   "border-gray-300 dark:border-white/20 bg-gray-100/80 dark:bg-white/[0.06] text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/[0.08]",
    header:   "text-gray-500 dark:text-white/50",
    progress: "bg-gray-400",
  };
}

// ── Sous-composants ───────────────────────────────────────────────────────────

/**
 * Progress bar animée avec shimmer.
 * Pendant le loading → indéterminée pulsante.
 * Après succès → remplie selon stepsDone/total.
 */
function DossierProgressBar({
  status,
  stepsDone,
  total,
  progressClass,
}: {
  status: DossierStatus;
  stepsDone: number;
  total: number;
  progressClass: string;
}) {
  const pct = total > 0 ? Math.round((stepsDone / total) * 100) : 0;

  return (
    <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-white/[0.06] overflow-hidden">
      {status === "loading" ? (
        /* Barre indéterminée avec shimmer */
        <motion.div
          className={cn("h-full rounded-full opacity-70 relative", progressClass)}
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
          style={{ width: "50%" }}
        />
      ) : status === "success" ? (
        <motion.div
          className={cn("h-full rounded-full", progressClass)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      ) : status === "error" ? (
        <div className="h-full w-full rounded-full bg-red-400/60" />
      ) : null}
    </div>
  );
}

/**
 * Dots visuels représentant les étapes du workflow.
 * - pending (idle) : gris clair
 * - in-progress (loading) : bleu pulsant
 * - done (success) : vert
 * - error : rouge
 */
function StepDots({
  total,
  stepsDone,
  status,
}: {
  total: number;
  stepsDone: number;
  status: DossierStatus;
}) {
  // On limite à 8 dots max pour éviter l'overflow
  const dots = Math.min(total, 8);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: dots }).map((_, i) => {
        const isDone    = status === "success" && i < stepsDone;
        const isError   = status === "error"   && i < stepsDone;
        const isActive  = status === "loading" && i === stepsDone;
        const isPending = !isDone && !isError && !isActive;

        return (
          <motion.span
            key={i}
            animate={isActive ? { scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] } : {}}
            transition={isActive ? { repeat: Infinity, duration: 0.9 } : {}}
            className={cn(
              "rounded-full",
              isDone   ? "w-1.5 h-1.5 bg-emerald-500"                  : "",
              isError  ? "w-1.5 h-1.5 bg-red-400"                       : "",
              isActive ? "w-2 h-2 bg-blue-500"                          : "",
              isPending ? "w-1.5 h-1.5 bg-gray-300 dark:bg-white/[0.1]" : "",
            )}
          />
        );
      })}
      {total > 8 && (
        <span className="text-[9px] text-gray-400 dark:text-white/30 ml-0.5">+{total - 8}</span>
      )}
    </div>
  );
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchDossiers(): Promise<DossierMeta[]> {
  const res = await fetch(`${BRIDGE_URL}/api/qgis/listDossiers`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { dossiers?: DossierMeta[] };
  return data.dossiers ?? [];
}

async function runDossier(dossierId: string): Promise<RunDossierResult> {
  const res = await fetch(`${BRIDGE_URL}/api/qgis/runDossier`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dossierId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<RunDossierResult>;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export interface DossierPanelProps {
  onDossierRun?: (dossierId: string, result: RunDossierResult) => void;
}

export default function DossierPanel({ onDossierRun }: DossierPanelProps) {
  const [dossiers, setDossiers] = useState<DossierMeta[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [bridgeError, setBridgeError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [runState, setRunState] = useState<Record<string, DossierStatus>>({});
  const [runResults, setRunResults] = useState<Record<string, RunDossierResult>>({});

  const loadDossiers = useCallback(async () => {
    setIsFetching(true);
    setBridgeError(false);
    try {
      const data = await fetchDossiers();
      setDossiers(data);
    } catch (e) {
      setBridgeError(true);
      toast.error(`Dossiers : ${e instanceof Error ? e.message : "Bridge QGIS inaccessible"}`);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => { void loadDossiers(); }, [loadDossiers]);

  const handleRun = useCallback(async (dossier: DossierMeta) => {
    setRunState((s) => ({ ...s, [dossier.id]: "loading" }));
    try {
      const result = await runDossier(dossier.id);
      const nextStatus: DossierStatus = result.ok ? "success" : "error";
      setRunState((s) => ({ ...s, [dossier.id]: nextStatus }));
      setRunResults((s) => ({ ...s, [dossier.id]: result }));

      if (result.ok) {
        const stepsDone = result.steps_done ?? "?";
        const total     = result.total ?? "?";
        toast.success(`Dossier "${dossier.name}" déroulé (${stepsDone}/${total} étapes)`);
        onDossierRun?.(dossier.id, result);
      } else {
        toast.error(result.error ?? "Erreur lors de l'exécution du dossier");
      }
    } catch (e) {
      setRunState((s) => ({ ...s, [dossier.id]: "error" }));
      // Stocker un résultat d'erreur pour l'affichage inline
      setRunResults((s) => ({
        ...s,
        [dossier.id]: {
          ok: false,
          error: e instanceof Error ? e.message : "Erreur inconnue",
        },
      }));
      toast.error(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }, [onDossierRun]);

  return (
    <div className="flex flex-col gap-3.5 p-3.5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FolderOpen size={15} className="text-amber-500 dark:text-amber-400 shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">
          Dossiers 1-clic
        </span>
        <span
          title="Implémenté par Devin CLI — superviseur Claude Code 4.8"
          className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-violet-500/[0.12] text-violet-500 dark:text-violet-300 border border-violet-500/20"
        >
          ⚡ Devin
        </span>
      </div>

      <p className="text-[10px] text-gray-400 dark:text-white/30 leading-relaxed">
        Chaque dossier charge automatiquement un pack de couches + symbologies institutionnelles.
      </p>

      {/* Skeleton */}
      {isFetching && (
        <div className="flex flex-col gap-1.5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-14 rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.02] animate-pulse"
            />
          ))}
        </div>
      )}

      {/* ── État d'erreur bridge ──────────────────────────────────────────── */}
      {!isFetching && bridgeError && (
        <div className="flex flex-col gap-2 rounded-xl border border-red-400/30 bg-red-500/[0.06] px-3 py-3">
          <div className="flex items-start gap-2">
            <WifiOff size={13} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                Bridge QGIS inaccessible
              </p>
              <p className="text-[10px] text-red-500/70 dark:text-red-400/60 mt-0.5 leading-relaxed">
                Lance QGIS avec le plugin QGISia pour charger la liste des dossiers disponibles.
              </p>
            </div>
          </div>
          <button
            onClick={() => void loadDossiers()}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg border border-red-400/35 bg-red-500/[0.08] text-[11px] font-semibold text-red-600 dark:text-red-300 hover:bg-red-500/[0.12] transition-colors"
          >
            <RefreshCw size={11} />
            Réessayer
          </button>
        </div>
      )}

      {/* ── Liste vide (bridge ok mais pas de dossiers) ───────────────────── */}
      {!isFetching && !bridgeError && dossiers.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Layers size={22} className="text-gray-300 dark:text-white/15" />
          <p className="text-[11px] text-gray-400 dark:text-white/25">
            Aucun dossier disponible (connexion QGIS requise)
          </p>
        </div>
      )}

      {/* ── Liste des dossiers ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        {dossiers.map((d, cardIdx) => {
          const status    = runState[d.id] ?? "idle";
          const result    = runResults[d.id];
          const isExpanded = expanded === d.id;
          const accent    = dossierAccent(d.id);
          const stepsDone = result?.steps_done ?? 0;
          const totalSteps = result?.total ?? d.steps;

          return (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: cardIdx * 0.04, duration: 0.2 }}
              className={cn("rounded-2xl border transition-colors overflow-hidden shadow-sm", accent.card)}
            >
              {/* Card header */}
              <button
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
                onClick={() => setExpanded(isExpanded ? null : d.id)}
              >
                {dossierIcon(d.id)}
                <div className="flex-1 min-w-0">
                  <p className={cn("text-[12px] font-semibold truncate", accent.header)}>
                    {d.name}
                  </p>
                  {d.description && (
                    <p className="text-[10px] text-gray-400 dark:text-white/35 truncate mt-0.5">
                      {d.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {status === "success" && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                      <CheckCircle2 size={12} className="text-emerald-500 dark:text-emerald-400" />
                    </motion.span>
                  )}
                  {status === "error" && (
                    <AlertCircle size={12} className="text-red-400" />
                  )}
                  {/* Dots étapes */}
                  <StepDots
                    total={d.steps}
                    stepsDone={stepsDone}
                    status={status}
                  />
                  {isExpanded
                    ? <ChevronDown  size={12} className="text-gray-400 dark:text-white/30" />
                    : <ChevronRight size={12} className="text-gray-400 dark:text-white/30" />
                  }
                </div>
              </button>

              {/* Progress bar (visible en dehors de l'accordéon si loading) */}
              {status === "loading" && (
                <div className="px-3 pb-1">
                  <DossierProgressBar
                    status={status}
                    stepsDone={stepsDone}
                    total={totalSteps}
                    progressClass={accent.progress}
                  />
                </div>
              )}

              {/* Accordion */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key="accordion"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-gray-200 dark:border-white/[0.05] px-3 pb-3 pt-2.5 flex flex-col gap-2">

                      {/* Résultat succès avec progress bar et liste couches */}
                      {status === "success" && result && (
                        <div className="flex flex-col gap-2">
                          {/* Progress bar terminée */}
                          <DossierProgressBar
                            status={status}
                            stepsDone={result.steps_done ?? d.steps}
                            total={result.total ?? d.steps}
                            progressClass={accent.progress}
                          />
                          {/* Résumé */}
                          <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-2.5 py-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={11} />
                            {result.steps_done ?? "?"}/{result.total ?? d.steps} étapes complétées
                            {(result.layers?.length ?? 0) > 0 && (
                              <span className="text-emerald-500/70 dark:text-emerald-300/60">
                                · {result.layers!.length} couche{result.layers!.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          {/* Liste couches avec stagger */}
                          {result.layers && result.layers.length > 0 && (
                            <div className="flex flex-col gap-0.5 pl-1">
                              {result.layers.map((layerName, i) => (
                                <motion.div
                                  key={layerName}
                                  initial={{ opacity: 0, x: -6 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.04, duration: 0.18 }}
                                  className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-white/40"
                                >
                                  <Layers size={9} className="text-gray-400 dark:text-white/25 shrink-0" />
                                  <span className="truncate">{layerName}</span>
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Résultat erreur */}
                      {status === "error" && result && (
                        <div className="flex items-start gap-1.5 rounded-xl border border-red-400/25 bg-red-500/[0.05] px-2.5 py-1.5">
                          <AlertCircle size={11} className="text-red-400 shrink-0 mt-0.5" />
                          <p className="text-[10px] text-red-500 dark:text-red-400 leading-relaxed">
                            {result.error ?? "Une erreur est survenue lors de l'exécution"}
                          </p>
                        </div>
                      )}

                      {/* Progress bar loading dans l'accordéon */}
                      {status === "loading" && (
                        <DossierProgressBar
                          status={status}
                          stepsDone={stepsDone}
                          total={totalSteps}
                          progressClass={accent.progress}
                        />
                      )}

                      {/* Bouton d'action */}
                      <motion.button
                        onClick={() => void handleRun(d)}
                        disabled={status === "loading"}
                        whileTap={status !== "loading" ? { scale: 0.97 } : undefined}
                        className={cn(
                          "flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl border text-[11px] font-semibold transition-all disabled:opacity-50",
                          accent.action,
                        )}
                      >
                        {status === "loading" ? (
                          <><Loader2 size={11} className="animate-spin" />Déroulement…</>
                        ) : status === "success" ? (
                          <><RefreshCw size={11} />Recharger le dossier</>
                        ) : (
                          <>Dérouler « {d.name} »</>
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Rafraîchir */}
      {!isFetching && !bridgeError && (
        <button
          onClick={() => void loadDossiers()}
          className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.02] text-[10px] text-gray-500 dark:text-white/35 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors mt-auto"
        >
          <RefreshCw size={10} />
          Rafraîchir la liste
        </button>
      )}
    </div>
  );
}
