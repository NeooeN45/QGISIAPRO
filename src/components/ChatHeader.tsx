import {
  Code2,
  Download,
  FileJson,
  Info,
  Layers,
  Leaf,
  MoreVertical,
  Plus,
  Settings as SettingsIcon,
  TreePine,
  X,
} from "lucide-react";

import { cn } from "@/src/lib/utils";
import { ChatConversation, ConversationMode, LayerContextScope } from "../lib/chat-history";
import { downloadMarkdown } from "../lib/export-markdown";
import { exportConversationToJson, exportConversationToMarkdown, downloadFile } from "../lib/conversation-export";
import { isQgisAvailable, LayerSummary, openQgisLayersPanel } from "../lib/qgis";
import { useUIStore } from "../stores/useUIStore";
import { appendDebugEvent } from "../lib/debug-log";
import { toast } from "sonner";
import ThemeToggle from "./ThemeToggle";
import { useState, useEffect, useRef } from "react";

function formatLayerBadge(layer: LayerSummary): string {
  return [layer.type, layer.geometryType].filter(Boolean).join(" · ") || "Couche";
}

interface ChatHeaderProps {
  activeConversation: ChatConversation | null;
  conversationMode: ConversationMode;
  conversationTitle: string;
  layerContextById: Record<string, LayerContextScope>;
  onCreateConversation: () => void | Promise<void>;
  onToggleLayerSelection: (layerId: string) => void;
  onUpdateConversationMode: (mode: ConversationMode) => void;
  selectedLayers: LayerSummary[];
}

export default function ChatHeader({
  activeConversation,
  conversationMode,
  conversationTitle,
  layerContextById,
  onCreateConversation,
  onToggleLayerSelection,
  onUpdateConversationMode,
  selectedLayers,
}: ChatHeaderProps) {
  const isQgisConnected = useUIStore((s) => s.isQgisConnected);
  const setShowSettings = useUIStore((s) => s.setShowSettings);
  const setShowPluginSetup = useUIStore((s) => s.setShowPluginSetup);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  const handleQgisAction = (action: "layers" | "settings") => {
    if (!isQgisAvailable()) {
      appendDebugEvent({
        level: "error",
        source: "qgis",
        title: "QGIS indisponible",
        message: "Le bridge QGIS n'est pas connecte.",
      });
      toast.error("QGIS n'est pas connecté.");
      return;
    }
    if (action === "layers") {
      openQgisLayersPanel();
    }
  };

  const handleExportMarkdown = () => {
    if (activeConversation) {
      const markdown = exportConversationToMarkdown(activeConversation);
      downloadFile(markdown, `${activeConversation.title || "conversation"}.md`, "text/markdown");
      toast.success("Conversation exportée en Markdown");
    }
  };

  const handleExportJson = () => {
    if (activeConversation) {
      const json = exportConversationToJson(activeConversation);
      downloadFile(json, `${activeConversation.title || "conversation"}.json`, "application/json");
      toast.success("Conversation exportée en JSON");
    }
  };

  return (
    <>
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#131314] px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="flex items-center gap-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-bold tracking-tight text-gray-900 dark:text-white">
                {conversationTitle || "Nouvelle discussion"}
              </h1>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isQgisConnected ? "bg-emerald-400 shadow-[0_0_4px_theme(colors.emerald.400)]" : "bg-amber-400",
                  )}
                />
                {isQgisConnected ? "QGIS" : "Attente"}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200/80">
                <TreePine size={10} />
                53 sources officielles
              </span>
              <div className="inline-flex rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] p-0.5">
                <button
                  onClick={() => onUpdateConversationMode("chat")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-all",
                    conversationMode === "chat"
                      ? "bg-blue-500 text-white shadow-sm shadow-blue-500/30"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
                  )}
                  title="Mode Action : exécute directement les tâches SIG dans QGIS"
                >
                  Action
                </button>
                <button
                  onClick={() => onUpdateConversationMode("free")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-all",
                    conversationMode === "free"
                      ? "bg-violet-500 text-white shadow-sm shadow-violet-500/30"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
                  )}
                  title="Mode Libre : discussion générale sans QGIS ni SIG"
                >
                  Libre
                </button>
              </div>
              <button
                className="rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all"
                title={
                  conversationMode === "chat"
                    ? "Mode Action : exécute les tâches SIG directement dans QGIS avec auto-exécution PyQGIS"
                    : "Mode Libre : discussion générale sur n'importe quel sujet, sans outils QGIS"
                }
              >
                <Info size={12} />
              </button>
            </div>
            {selectedLayers.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200/80">
                {selectedLayers.length} couche(s)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 rounded-2xl border border-transparent p-2.5 text-gray-500 dark:text-[#c4c7c5] transition-all hover:border-gray-300 dark:hover:border-[#444746] hover:bg-gray-100 dark:hover:bg-[#333537] hover:text-blue-400"
            title="Paramètres IA"
            aria-label="Ouvrir les paramètres IA"
          >
            <SettingsIcon size={18} />
            <span className="hidden text-xs font-bold uppercase tracking-wider lg:inline">
              Paramètres
            </span>
          </button>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 rounded-2xl border border-transparent p-2.5 text-[var(--text-secondary)] transition-all hover:border-[var(--card-border)] hover:bg-[var(--card-bg)] hover:text-blue-400"
              title="Actions supplémentaires"
              aria-label="Actions supplémentaires"
              aria-expanded={showDropdown}
              aria-haspopup="true"
            >
              <MoreVertical size={18} />
            </button>
            {showDropdown && (
              <div
                className="absolute right-0 top-full z-50 mt-2 w-48 rounded-2xl border border-[var(--card-border)] bg-[var(--background)] p-2 shadow-2xl"
                role="menu"
                aria-label="Menu des actions"
              >
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setShowPluginSetup(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--card-bg)] hover:text-[var(--foreground)] transition-all"
                  role="menuitem"
                  aria-label="Installation du plugin QGIS"
                >
                  <Code2 size={16} />
                  Installation Plugin
                </button>
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    handleQgisAction("layers");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--card-bg)] hover:text-[var(--foreground)] transition-all"
                  role="menuitem"
                  aria-label="Ouvrir le panneau des couches QGIS"
                >
                  <Layers size={16} />
                  Panneaux Couches QGIS
                </button>
                {activeConversation && activeConversation.messages.length > 1 && (
                  <>
                    <div className="my-1 border-t border-white/10" role="separator" aria-orientation="horizontal" />
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        handleExportMarkdown();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--card-bg)] hover:text-purple-500 dark:hover:text-purple-400 transition-all"
                      role="menuitem"
                      aria-label="Exporter la conversation en Markdown"
                    >
                      <Download size={16} />
                      Exporter Markdown
                    </button>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        handleExportJson();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--card-bg)] hover:text-orange-500 dark:hover:text-orange-400 transition-all"
                      role="menuitem"
                      aria-label="Exporter la conversation en JSON"
                    >
                      <FileJson size={16} />
                      Exporter JSON
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => void onCreateConversation()}
            className="rounded-2xl border border-transparent p-2.5 text-[var(--text-secondary)] transition-all hover:border-[var(--card-border)] hover:bg-[var(--card-bg)] hover:text-emerald-500 dark:hover:text-emerald-400"
            title="Nouvelle discussion"
            aria-label="Créer une nouvelle discussion"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {selectedLayers.length > 0 && (
        <div className="border-b border-[var(--card-border)] px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Contexte actif
            </span>
            {selectedLayers.map((layer) => (
              <button
                key={layer.id}
                onClick={() => onToggleLayerSelection(layer.id)}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-800 dark:text-emerald-100 transition-all hover:bg-emerald-500/16"
                title="Retirer cette couche du contexte"
              >
                <span>{layer.name}</span>
                <span className="text-emerald-200/70">
                  {layerContextById[layer.id] === "selection"
                    ? "sélection"
                    : formatLayerBadge(layer)}
                </span>
                <X size={12} />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
