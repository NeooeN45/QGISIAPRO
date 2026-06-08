import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  Database,
  FileCode,
  Layers,
  Loader2,
  Paperclip,
  Send,
  Settings,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";

import { cn } from "@/src/lib/utils";
import { ConversationMode } from "../lib/chat-history";
import { isQgisAvailable, LayerSummary, openQgisLayersPanel, openQgisSettings } from "../lib/qgis";
import { useSmartSuggestionsStore } from "../stores/useSmartSuggestionsStore";
import { useConversationMemoryStore } from "../stores/useConversationMemoryStore";
import { UserIntent } from "../lib/prompt-intelligence";
import SmartSuggestionsBar from "./SmartSuggestionsBar";
import SemanticAutocomplete from "./SemanticAutocomplete";
import ScriptTemplateModal from "./ScriptTemplateModal";
import { getActiveModel } from "../lib/settings";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useUIStore } from "../stores/useUIStore";
import { useDocumentStore } from "../stores/useDocumentStore";
import { appendDebugEvent } from "../lib/debug-log";
import { toast } from "sonner";
import { extractFileForLLM, formatFileSize, getFileIcon } from "../lib/document-utils";

interface QuickTest {
  label: string;
  prompt: string;
}

const quickTests: QuickTest[] = [
  {
    label: "Test plan projet",
    prompt:
      "Prépare un plan de vérification du projet QGIS actuel, indique les couches présentes, les risques et la prochaine action recommandée.",
  },
  {
    label: "Test couches",
    prompt:
      "Utilise les outils QGIS et dis-moi exactement combien de couches sont chargées et leur nom.",
  },
  {
    label: "Test diagnostic",
    prompt:
      "Utilise les outils QGIS pour résumer la première couche du projet : type, CRS, visibilité, opacité et alertes utiles.",
  },
  {
    label: "Test action sûre",
    prompt:
      "Propose une action non destructive et vérifiable sur le projet QGIS courant, puis attends ma validation.",
  },
  {
    label: "Test NDVI",
    prompt:
      "Si des rasters NDVI sont chargés, fusionne ceux de 2023 et 2024 en image bi-annuelle et centre la carte dessus.",
  },
  {
    label: "Test inventaire",
    prompt:
      "Si une emprise polygonale est présente, crée un dispositif d'inventaire 250 x 250 avec la grille et les centroïdes.",
  },
];

// Constantes pour le compteur de caractères
const MAX_CHARS = 4000;
const CHAR_WARNING_THRESHOLD = 0.8; // 80%
const CHAR_DANGER_THRESHOLD = 0.95; // 95%

interface ChatInputProps {
  conversationMode: ConversationMode;
  isLoading: boolean;
  onSendMessage: (message: string) => Promise<void>;
  onStopGeneration?: () => void;
  selectedLayers: LayerSummary[];
  layerContextById: Record<string, string>;
  onToggleLayerSelection: (layerId: string) => void;
  availableLayers?: string[];
  lastIntent?: UserIntent;
}

export default function ChatInput({
  conversationMode,
  isLoading,
  onSendMessage,
  onStopGeneration,
  selectedLayers,
  layerContextById,
  onToggleLayerSelection,
  availableLayers = [],
  lastIntent,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [showTests, setShowTests] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const settings = useSettingsStore((s) => s.settings);
  const isQgisConnected = useUIStore((s) => s.isQgisConnected);
  const documents = useDocumentStore((s) => s.documents);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mettre à jour le contexte de conversation
  const updateContext = useConversationMemoryStore((s) => s.updateContext);
  const { suggestions } = useSmartSuggestionsStore();

  // Calcul du pourcentage et état du compteur
  const charCount = input.length;
  const charPercentage = charCount / MAX_CHARS;
  const showCharCounter = charCount > MAX_CHARS * 0.5;
  const isWarning = charPercentage >= CHAR_WARNING_THRESHOLD && charPercentage < CHAR_DANGER_THRESHOLD;
  const isDanger = charPercentage >= CHAR_DANGER_THRESHOLD;

  useEffect(() => {
    updateContext({
      activeLayers: availableLayers,
      lastIntent,
    });
  }, [availableLayers, lastIntent, updateContext]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
  }, [input]);

  useEffect(() => {
    const handler = () => textareaRef.current?.focus();
    document.addEventListener("focusChatInput", handler);
    return () => document.removeEventListener("focusChatInput", handler);
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || isLoading) return;

    let messageToSend = input;

    // Add document context if documents are present
    if (documents.length > 0) {
      const docContext = documents
        .map((doc) => `--- Document: ${doc.name} ---\n${doc.content}\n--- Fin du document ---`)
        .join("\n\n");
      messageToSend = `${input}\n\n[Documents joints]\n${docContext}`;
    }

    void onSendMessage(messageToSend);
    setInput("");

    // Démarrer la transition processing au lieu de cacher brutalement
    const detectedIntent = suggestions[0]?.text || "Analyse de votre demande...";
    useSmartSuggestionsStore.getState().startProcessing(detectedIntent);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    textareaRef.current?.focus();
  };

  const handleTemplateExecute = (code: string, templateName: string) => {
    const message = `Exécuter le template "${templateName}":\n\n\`\`\`python\n${code}\n\`\`\``;
    void onSendMessage(message);
  };

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
    } else {
      openQgisSettings();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const addDocument = useDocumentStore.getState().addDocument;

    for (const file of files) {
      try {
        const extracted = await extractFileForLLM(file);
        addDocument({
          name: file.name,
          type: file.type,
          size: file.size,
          content: extracted.content,
          dataUrl: extracted.dataUrl,
          kind: extracted.kind,
        });
        const label = extracted.kind === "image" ? "Image" : "Fichier";
        toast.success(`${label} "${file.name}" ajoute au contexte`);
      } catch (error) {
        console.error("Error extracting text from file:", error);
        toast.error(`Erreur lors de l'extraction de ${file.name}`);
      }
    }

    // Reset input
    e.target.value = "";
  };

  // Placeholder dynamique basé sur l'état QGIS
  const getPlaceholder = (): string => {
    if (isQgisConnected) {
      return "Demande une analyse, génère un script, explore tes données...";
    }
    return "Pose ta question géospatiale...";
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-gray-50 dark:from-[#131314] via-gray-50/95 dark:via-[#131314]/95 to-transparent px-4 pb-8 pt-20 md:px-6">
      {/* Styles CSS pour les animations */}
      <style>{`
        @keyframes fade-placeholder {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        .animate-fade-placeholder::placeholder {
          animation: fade-placeholder 3s ease-in-out infinite;
        }
        .cursor-glow {
          caret-color: rgb(59, 130, 246);
          text-shadow: 0 0 4px rgba(59, 130, 246, 0.3);
        }
      `}</style>

      <div className="pointer-events-auto mx-auto max-w-4xl">
        <AnimatePresence mode="popLayout">
          {selectedLayers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mb-3 flex flex-wrap items-center gap-2"
            >
              {selectedLayers.map((layer) => (
                <motion.button
                  key={layer.id}
                  layout
                  onClick={() => onToggleLayerSelection(layer.id)}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-100 transition-all hover:bg-emerald-500/20"
                  title="Retirer cette couche du contexte"
                >
                  <span>{layer.name}</span>
                  <span className="text-emerald-200/70">
                    {layerContextById[layer.id] === "selection"
                      ? "sélection"
                      : layer.crs || "sans CRS"}
                  </span>
                  <X size={12} />
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {isQgisConnected && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setShowTests((v) => !v)}
              className="flex items-center gap-1 text-[10px] text-white/20 hover:text-white/40 transition-colors"
            >
              <ChevronDown size={10} className={`transition-transform duration-150 ${showTests ? "rotate-180" : ""}`} />
              Tests rapides
            </button>
            <AnimatePresence>
              {showTests && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-1.5 flex flex-wrap items-center gap-2 overflow-hidden"
                >
                  {quickTests.map((test) => (
                    <motion.button
                      key={test.label}
                      type="button"
                      onClick={() => { void onSendMessage(test.prompt); setShowTests(false); }}
                      disabled={isLoading}
                      whileHover={{ y: -1, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="rounded-full border border-cyan-500/20 bg-cyan-500/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-100 transition-all hover:bg-cyan-500/14 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {test.label}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Smart Suggestions Bar */}
        <SmartSuggestionsBar
          input={input}
          onSuggestionClick={handleSuggestionClick}
          layers={availableLayers}
          selectedLayers={selectedLayers.map(l => l.name)}
          lastIntent={lastIntent}
        />

        {/* Semantic Autocomplete */}
        <SemanticAutocomplete
          input={input}
          onAccept={(completion) => setInput(prev => prev + completion)}
          layerNames={availableLayers}
        />

        <form onSubmit={handleSubmit} className="group relative">
          {/* Glow effect layers */}
          <div
            className={cn(
              "absolute -inset-4 rounded-[44px] bg-gradient-to-r from-blue-500 via-emerald-500 to-violet-500 blur-3xl transition-all duration-700",
              isFocused ? "opacity-[0.55] -inset-6" : "opacity-[0.18]"
            )}
          />
          <div
            className={cn(
              "absolute -inset-2 rounded-[40px] bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 blur-xl transition-all duration-500",
              isFocused ? "opacity-[0.25]" : "opacity-[0.08]"
            )}
          />

          {/* Main input container */}
          <div
            className={cn(
              "relative rounded-2xl border bg-gray-100/95 dark:bg-[#1a1a1b]/95 px-5 py-2.5 shadow-xl dark:shadow-2xl dark:shadow-black/60 transition-all duration-200",
              "focus-within:bg-white dark:focus-within:bg-[#1e2022]",
              isFocused
                ? "border-blue-500/50 shadow-[0_0_0_1px_rgba(59,130,246,0.5),0_0_20px_rgba(59,130,246,0.1)]"
                : "border-gray-200 dark:border-[#333537]"
            )}
          >
            <div className="flex items-end gap-3">
              <div className="hidden items-center gap-1.5 md:flex">
                <motion.button
                  type="button"
                  onClick={() => handleQgisAction("layers")}
                  whileHover={{ scale: 1.05, y: -1 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-full p-3 text-gray-500 dark:text-[#c4c7c5] transition-all hover:bg-blue-400/10 hover:text-blue-500 dark:hover:text-blue-400"
                  title="Couches QGIS"
                >
                  <Layers size={20} />
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => setShowTemplates(true)}
                  whileHover={{ scale: 1.05, y: -1 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-full p-3 text-gray-500 dark:text-[#c4c7c5] transition-all hover:bg-emerald-400/10 hover:text-emerald-500 dark:hover:text-emerald-400"
                  title="Templates de scripts"
                >
                  <FileCode size={20} />
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => handleQgisAction("settings")}
                  whileHover={{ scale: 1.05, y: -1 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-full p-3 text-gray-500 dark:text-[#c4c7c5] transition-all hover:bg-purple-400/10 hover:text-purple-500 dark:hover:text-purple-400"
                  title="Paramètres extension"
                >
                  <Settings size={20} />
                </motion.button>
              </div>

              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSubmit(event);
                    }
                  }}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder={getPlaceholder()}
                  rows={1}
                  aria-label="Message à envoyer"
                  className={cn(
                    "chat-scrollbar max-h-56 w-full resize-none border-none bg-transparent px-2 py-3 text-base font-medium text-gray-900 dark:text-white outline-none placeholder:text-gray-500 dark:placeholder:text-[#8e918f]",
                    "animate-fade-placeholder cursor-glow"
                  )}
                  style={{
                    minHeight: "48px",
                  }}
                />

                {/* Compteur de caractères */}
                <motion.span
                  initial={false}
                  animate={{
                    opacity: showCharCounter ? 1 : 0,
                    y: showCharCounter ? 0 : 5,
                  }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "absolute bottom-1 right-2 text-[10px] font-medium transition-colors duration-200",
                    isDanger
                      ? "text-red-500"
                      : isWarning
                        ? "text-orange-400"
                        : "text-gray-400 dark:text-gray-500"
                  )}
                >
                  {charCount}
                </motion.span>
              </div>

              <div className="flex items-center gap-1.5">
                <motion.button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  whileHover={{ rotate: 15, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-full p-3 text-gray-500 dark:text-[#c4c7c5] transition-all hover:bg-blue-400/10 hover:text-blue-500 dark:hover:text-blue-400"
                  title="Joindre un fichier"
                  aria-label="Joindre un fichier"
                >
                  <Paperclip size={20} />
                </motion.button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.md,.csv,.json,.xml,.js,.py,.ts,.tsx,.jsx,.sql,.sh,.pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp,.gif,image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {isLoading && onStopGeneration ? (
                  <motion.button
                    type="button"
                    onClick={onStopGeneration}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    className="rounded-full border border-red-500/30 bg-red-500/10 p-3 text-red-400 transition-all hover:bg-red-500/20"
                    title="Arrêter la génération"
                    aria-label="Arrêter la génération"
                  >
                    <div className="h-3 w-3 rounded-sm bg-red-500" />
                  </motion.button>
                ) : (
                  <motion.button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    whileHover={input.trim() && !isLoading ? { scale: 1.05 } : {}}
                    whileTap={input.trim() && !isLoading ? { scale: 0.9 } : { scale: 0.95 }}
                    className={cn(
                      "rounded-full p-3 transition-all duration-300",
                      input.trim() && !isLoading
                        ? "bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)]"
                        : "opacity-40 bg-gray-200 dark:bg-[#131314] text-[#444746] cursor-not-allowed"
                    )}
                    aria-label={isLoading ? "Envoi en cours" : "Envoyer le message"}
                  >
                    {isLoading ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Send size={20} />
                    )}
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </form>

        <AnimatePresence mode="popLayout">
          {documents.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mt-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                  Documents joints ({documents.length})
                </span>
                <motion.button
                  type="button"
                  onClick={() => useDocumentStore.getState().clearDocuments()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                >
                  Tout effacer
                </motion.button>
              </div>
              <div className="space-y-1.5">
                <AnimatePresence mode="popLayout">
                  {documents.map((doc) => (
                    <motion.div
                      key={doc.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10, scale: 0.9 }}
                      transition={{ duration: 0.15 }}
                      className="group flex items-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 transition-all hover:border-blue-400/30"
                    >
                      <span className="text-lg">{getFileIcon(doc.name)}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-[var(--text-secondary)]">
                        {doc.name}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {formatFileSize(doc.size)}
                      </span>
                      <motion.button
                        type="button"
                        onClick={() => useDocumentStore.getState().removeDocument(doc.id)}
                        whileHover={{ scale: 1.1, rotate: 90 }}
                        whileTap={{ scale: 0.9 }}
                        className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-1 text-[var(--text-muted)] opacity-0 transition-all hover:border-red-400/30 hover:text-red-500 group-hover:opacity-100"
                        aria-label={`Retirer ${doc.name}`}
                      >
                        <X size={10} />
                      </motion.button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            <Sparkles size={12} className="text-blue-400" />
            {getActiveModel(settings)}
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            <Database size={12} className="text-emerald-400" />
            PyQGIS natif
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            <Workflow size={12} className="text-fuchsia-400" />
            {settings.provider === "openrouter"
              ? settings.openrouterAgentMode === "multi"
                ? "OpenRouter multi-agent"
                : "OpenRouter single"
              : settings.provider === "google"
                ? "Gemini"
                : settings.provider === "nvidia"
                  ? "NVIDIA NIM"
                  : "Local"}
          </div>
          <AnimatePresence>
            {selectedLayers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]"
              >
                <Layers size={12} className="text-cyan-400" />
                {selectedLayers.length} couche(s) ciblée(s)
              </motion.div>
            )}
          </AnimatePresence>
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
            conversationMode === "free"
              ? "border-violet-500/20 bg-violet-500/8 text-violet-400"
              : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-muted)]"
          }`}>
            <Sparkles size={12} className={conversationMode === "free" ? "text-violet-400" : "text-emerald-400"} />
            {conversationMode === "free" ? "Mode libre" : "Mode action"}
          </div>
        </div>
      </div>

      {/* Script Template Modal - pointer-events-auto crucial pour permettre l'interaction */}
      <div className="pointer-events-auto">
        <ScriptTemplateModal
          isOpen={showTemplates}
          onClose={() => setShowTemplates(false)}
          onExecute={handleTemplateExecute}
          availableLayers={availableLayers}
        />
      </div>
    </div>
  );
}
