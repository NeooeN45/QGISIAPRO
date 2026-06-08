/**
 * DossierPanel — Panneau Dossiers territoriaux 1-clic.
 *
 * IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI)
 * Superviseur : Claude Code 4.8 — Camil
 * Date : 2026-06-08 | Branche : chore/hygiene-puis-nvidia
 * Review obligatoire avant merge dans main.
 *
 * Expose :
 * - Liste des dossiers disponibles (urbanisme, risques, forêt, environnement...)
 * - Déroulement en 1 clic avec progress des étapes
 * - Résumé des couches chargées
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
} from "lucide-react";
import { cn } from "@/src/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DossierMeta {
  id: string;
  name: string;
  description?: string;
  steps: number;
}

type DossierStatus = "idle" | "loading" | "success" | "error";

const BRIDGE_URL = "http://localhost:8157";

// ── Icônes par dossier ────────────────────────────────────────────────────────

function dossierIcon(id: string) {
  if (id.includes("urban"))  return <Building2  size={16} className="text-blue-400" />;
  if (id.includes("foret"))  return <Trees       size={16} className="text-emerald-400" />;
  if (id.includes("risque")) return <Droplets    size={16} className="text-amber-400" />;
  if (id.includes("envir"))  return <MapPinned   size={16} className="text-cyan-400" />;
  return <FolderOpen size={16} className="text-white/50" />;
}

function dossierColor(id: string): string {
  if (id.includes("urban"))  return "border-blue-500/30  bg-blue-500/8  hover:border-blue-500/50";
  if (id.includes("foret"))  return "border-emerald-500/30 bg-emerald-500/8 hover:border-emerald-500/50";
  if (id.includes("risque")) return "border-amber-500/30  bg-amber-500/8  hover:border-amber-500/50";
  if (id.includes("envir"))  return "border-cyan-500/30   bg-cyan-500/8   hover:border-cyan-500/50";
  return "border-white/15 bg-white/4 hover:border-white/25";
}

function actionButtonColor(id: string): string {
  if (id.includes("urban"))  return "bg-blue-600/20  border-blue-500/30  text-blue-300  hover:bg-blue-600/30";
  if (id.includes("foret"))  return "bg-emerald-600/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30";
  if (id.includes("risque")) return "bg-amber-600/20 border-amber-500/30 text-amber-300 hover:bg-amber-600/30";
  if (id.includes("envir"))  return "bg-cyan-600/20  border-cyan-500/30  text-cyan-300  hover:bg-cyan-600/30";
  return "bg-white/10 border-white/20 text-white/70 hover:bg-white/15";
}

// ── Helpers API ───────────────────────────────────────────────────────────────

async function fetchDossiers(): Promise<DossierMeta[]> {
  const res = await fetch(`${BRIDGE_URL}/api/qgis/listDossiers`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.dossiers ?? []) as DossierMeta[];
}

interface RunDossierResult {
  ok: boolean;
  steps_done?: number;
  total?: number;
  layers?: string[];
  error?: string;
}

async function runDossier(dossierId: string): Promise<RunDossierResult> {
  const res = await fetch(`${BRIDGE_URL}/api/qgis/runDossier`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dossierId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Composant ─────────────────────────────────────────────────────────────────

export interface DossierPanelProps {
  /** Appelé quand un dossier est déroulé avec succès. */
  onDossierRun?: (dossierId: string, result: RunDossierResult) => void;
}

export default function DossierPanel({ onDossierRun }: DossierPanelProps) {
  const [dossiers, setDossiers] = useState<DossierMeta[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [runState, setRunState] = useState<Record<string, DossierStatus>>({});
  const [runResults, setRunResults] = useState<Record<string, RunDossierResult>>({});
  const [runErrors, setRunErrors] = useState<Record<string, string>>({});

  const loadDossiers = useCallback(async () => {
    setIsFetching(true);
    setFetchError(null);
    try {
      const data = await fetchDossiers();
      setDossiers(data);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => { loadDossiers(); }, [loadDossiers]);

  const handleRun = useCallback(async (dossier: DossierMeta) => {
    setRunState((s) => ({ ...s, [dossier.id]: "loading" }));
    setRunErrors((s) => { const n = { ...s }; delete n[dossier.id]; return n; });
    try {
      const result = await runDossier(dossier.id);
      setRunState((s) => ({ ...s, [dossier.id]: result.ok ? "success" : "error" }));
      setRunResults((s) => ({ ...s, [dossier.id]: result }));
      if (!result.ok) {
        setRunErrors((s) => ({ ...s, [dossier.id]: result.error ?? "Erreur inconnue" }));
      } else {
        onDossierRun?.(dossier.id, result);
      }
    } catch (e) {
      setRunState((s) => ({ ...s, [dossier.id]: "error" }));
      setRunErrors((s) => ({ ...s, [dossier.id]: e instanceof Error ? e.message : "Erreur" }));
    }
  }, [onDossierRun]);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FolderOpen size={18} className="text-amber-400" />
        <span className="font-semibold text-sm text-white/90">Dossiers 1-clic</span>
        {/* Pastille Devin */}
        <span
          title="Implémenté par Devin CLI — superviseur Claude Code 4.8"
          className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-600/30 text-violet-300 border border-violet-500/30"
        >
          ⚡ Devin
        </span>
      </div>

      <p className="text-[11px] text-white/40">
        Chaque dossier charge automatiquement un pack de couches + symbologies institutionnelles.
      </p>

      {/* Erreur fetch */}
      {fetchError && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
          <AlertCircle size={13} />
          {fetchError}
          <button onClick={loadDossiers} className="ml-auto underline text-red-300 hover:text-red-200">
            Réessayer
          </button>
        </div>
      )}

      {/* Skeleton loading */}
      {isFetching && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-16 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {/* Liste dossiers */}
      {!isFetching && dossiers.length === 0 && !fetchError && (
        <div className="text-xs text-white/30 text-center py-8">
          Aucun dossier disponible (connexion QGIS requise)
        </div>
      )}

      <div className="flex flex-col gap-2">
        {dossiers.map((d) => {
          const status = runState[d.id] ?? "idle";
          const result = runResults[d.id];
          const isExpanded = expanded === d.id;

          return (
            <div
              key={d.id}
              className={cn(
                "rounded-xl border transition-colors overflow-hidden",
                dossierColor(d.id),
              )}
            >
              {/* Card header */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                {dossierIcon(d.id)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/85 truncate">{d.name}</p>
                  {d.description && (
                    <p className="text-[10px] text-white/40 truncate mt-0.5">{d.description}</p>
                  )}
                </div>
                <span className="text-[10px] text-white/30 shrink-0">{d.steps} étapes</span>

                {/* Bouton expand/collapse */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : d.id)}
                  className="text-white/40 hover:text-white/70 ml-1"
                >
                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
              </div>

              {/* Accordion */}
              {isExpanded && (
                <div className="px-3 pb-3 flex flex-col gap-2 border-t border-white/8 pt-2">
                  {/* Résultat précédent */}
                  {status === "success" && result && (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1.5">
                      <CheckCircle2 size={11} />
                      {result.steps_done ?? "?"}/{result.total ?? d.steps} étapes
                      {result.layers && result.layers.length > 0 && (
                        <span className="ml-1 text-white/50">
                          · {result.layers.length} couche{result.layers.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Erreur */}
                  {runErrors[d.id] && (
                    <div className="flex items-center gap-1.5 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
                      <AlertCircle size={11} />
                      {runErrors[d.id]}
                    </div>
                  )}

                  {/* Bouton lancer */}
                  <button
                    onClick={() => handleRun(d)}
                    disabled={status === "loading"}
                    className={cn(
                      "flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg border text-xs transition-colors disabled:opacity-50",
                      actionButtonColor(d.id),
                    )}
                  >
                    {status === "loading" ? (
                      <><Loader2 size={11} className="animate-spin" />Déroulement…</>
                    ) : status === "success" ? (
                      <><CheckCircle2 size={11} />Rechager le dossier</>
                    ) : (
                      <>Dérouler "{d.name}"</>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rafraîchir */}
      <button
        onClick={loadDossiers}
        disabled={isFetching}
        className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg border border-white/10 text-xs text-white/40 hover:text-white/60 hover:border-white/20 transition-colors mt-auto"
      >
        {isFetching ? <Loader2 size={11} className="animate-spin" /> : "↻"}
        Rafraîchir
      </button>
    </div>
  );
}
