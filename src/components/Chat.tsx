import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";

import {
  ChatConversation,
  ChatMessage,
  ConversationMode,
  LayerContextScope,
} from "../lib/chat-history";
import { lazy, Suspense } from "react";
const AiSettingsModal = lazy(() => import("./SettingsModal"));
const PluginSetupModalComponent = lazy(() => import("./PluginSetupModal"));
const LayerDiagnosticsModalComponent = lazy(() => import("./LayerDiagnosticsModal"));
const WorkspaceSidebar = lazy(() => import("./WorkspaceSidebar"));
const GeoParticlesBackground = lazy(() => import("./GeoParticlesBackground"));
import ChatHeader from "./ChatHeader";
import ChatInputArea from "./ChatInput";
import WelcomeScreen from "./WelcomeScreen";
import MessageBubble from "./MessageBubble";
import ThinkingIndicator from "./ThinkingIndicator";
import StreamingMessage from "./StreamingMessage";
import {
  addRasterFile,
  addRemoteService,
  applyParcelStylePreset,
  createInventoryGrid,
  calculateMnh,
  calculateRasterFormula,
  getLayerDiagnostics,
  isQgisAvailable,
  LayerDiagnostics,
  LayerSummary,
  mergeRasterBands,
  pickQgisFile,
  setLayerLabels,
} from "../lib/qgis";
import {
  loadOfficialSource,
  searchCadastreParcels,
  searchCopernicusProducts,
  searchGeoApiCommunes,
  searchNasaCatalog,
  searchOverpassFeatures,
} from "../lib/official-sources";
import {
  AppSettings,
  normalizeSettings,
  validateSettings as validateAppSettings,
  hasConfiguredGeminiApiKey,
  hasConfiguredOpenRouterApiKey,
} from "../lib/settings";
import { appendDebugEvent } from "../lib/debug-log";
import { useUIStore } from "../stores/useUIStore";
import { useSmartSuggestionsStore } from "../stores/useSmartSuggestionsStore";
import { useStreamingStore } from "../stores/useStreamingStore";

interface ChatProps {
  activeConversation: ChatConversation | null;
  activeConversationId: string | null;
  conversationMode: ConversationMode;
  conversations: ChatConversation[];
  isLoading: boolean;
  isRefreshingLayers: boolean;
  layerContextById: Record<string, LayerContextScope>;
  layers: LayerSummary[];
  messages: ChatMessage[];
  onCreateConversation: () => void | Promise<void>;
  onDeleteConversation: (conversationId: string) => void | Promise<void>;
  onRefreshLayers: () => void | Promise<void>;
  onSelectConversation: (conversationId: string) => void;
  onSendMessage: (message: string) => Promise<void>;
  onSetLayerContextScope: (
    layerId: string,
    scope: LayerContextScope,
  ) => void | Promise<void>;
  onSetLayerOpacity: (layerId: string, opacity: number) => void | Promise<void>;
  onSetLayerVisibility: (layerId: string, visible: boolean) => void | Promise<void>;
  onStopGeneration?: () => void;
  onToggleLayerSelection: (layerId: string) => void;
  onUpdateConversationMode: (mode: ConversationMode) => void;
  onUpdateSettings: (settings: AppSettings) => void;
  onZoomToLayer: (layerId: string) => void | Promise<void>;
  selectedLayerIds: string[];
  settings: AppSettings;
}

const pluginPackageLayout = `qgis_plugin/
  __init__.py
  geoai_assistant.py
  metadata.txt
  icon.png
  web/
    index.html
    assets/...`;

export default function Chat(props: ChatProps) {
  const {
    activeConversation,
    activeConversationId,
    conversationMode,
    conversations,
    isLoading,
    isRefreshingLayers,
    layerContextById,
    layers,
    messages,
    onCreateConversation,
    onDeleteConversation,
    onRefreshLayers,
    onSelectConversation,
    onSendMessage,
    onSetLayerContextScope,
    onSetLayerOpacity,
    onSetLayerVisibility,
    onStopGeneration,
    onToggleLayerSelection,
    onUpdateConversationMode,
    onUpdateSettings,
    onZoomToLayer,
    selectedLayerIds,
    settings,
  } = props;

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [activeDiagnosticsLayerId, setActiveDiagnosticsLayerId] = useState<string | null>(null);
  const [diagnosticsByLayerId, setDiagnosticsByLayerId] = useState<
    Record<string, LayerDiagnostics>
  >({});
  const [isDiagnosticsLoading, setIsDiagnosticsLoading] = useState(false);

  const showSettings = useUIStore((s) => s.showSettings);
  const setShowSettings = useUIStore((s) => s.setShowSettings);
  const showPluginSetup = useUIStore((s) => s.showPluginSetup);
  const setShowPluginSetup = useUIStore((s) => s.setShowPluginSetup);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  
  // Subscription réactive au streaming pour transition fluide
  const isStreaming = useStreamingStore((s) => s.isStreaming);

  const scrollRef = useRef<HTMLDivElement>(null);

  const hasEnvGeminiApiKey = hasConfiguredGeminiApiKey();
  const hasEnvOpenRouterApiKey = hasConfiguredOpenRouterApiKey();

  const selectedLayers = useMemo(
    () =>
      selectedLayerIds
        .map((layerId) => layers.find((layer) => layer.id === layerId))
        .filter((layer): layer is LayerSummary => Boolean(layer)),
    [layers, selectedLayerIds],
  );
  const diagnosticsLayerName =
    layers.find((layer) => layer.id === activeDiagnosticsLayerId)?.name || "Couche";
  const activeDiagnostics =
    activeDiagnosticsLayerId ? diagnosticsByLayerId[activeDiagnosticsLayerId] || null : null;

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  useEffect(() => {
    const validLayerIds = new Set(layers.map((layer) => layer.id));
    setDiagnosticsByLayerId((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([layerId]) => validLayerIds.has(layerId)),
      ),
    );

    if (activeDiagnosticsLayerId && !validLayerIds.has(activeDiagnosticsLayerId)) {
      setActiveDiagnosticsLayerId(null);
    }
  }, [activeDiagnosticsLayerId, layers]);

  // Terminer le processing des suggestions quand la réponse arrive
  const prevIsLoadingRef = useRef(isLoading);
  useEffect(() => {
    // Détecter la transition de loading=true à loading=false (réponse reçue)
    if (prevIsLoadingRef.current && !isLoading) {
      // Petit délai pour laisser l'animation de transition se faire
      const timeoutId = setTimeout(() => {
        useSmartSuggestionsStore.getState().completeProcessing();
      }, 500);
      prevIsLoadingRef.current = isLoading;
      return () => clearTimeout(timeoutId);
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading]);

  const handleScroll = () => {
    if (!scrollRef.current) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 220);
  };

  const handleSaveSettings = () => {
    const nextSettings = normalizeSettings(localSettings);
    const issues = validateAppSettings(nextSettings, {
      hasGeminiEnvKey: hasEnvGeminiApiKey,
      hasOpenRouterEnvKey: hasEnvOpenRouterApiKey,
    });

    if (issues.length > 0) {
      appendDebugEvent({
        level: "warning",
        source: "settings",
        title: "Parametres sauvegardés avec avertissements",
        message: issues[0],
        details: issues.join("\n"),
      });
      toast.warning(`⚠ ${issues[0]}`);
    }

    onUpdateSettings(nextSettings);
    setShowSettings(false);
    toast.success("Paramètres sauvegardés");
  };

  const handleResetSettings = () => {
    setLocalSettings(settings);
  };

  const handlePasteApiKey = async (target: "google" | "openrouter" | "nvidia") => {
    try {
      const pasted = await navigator.clipboard.readText();
      setLocalSettings((current) => ({
        ...current,
        ...(target === "google"
          ? { googleApiKey: pasted.trim() }
          : target === "nvidia"
            ? { nvidiaApiKey: pasted.trim() }
            : { openrouterApiKey: pasted.trim() }),
      }));
      toast.success("Clé collée");
    } catch {
      appendDebugEvent({
        level: "error",
        source: "settings",
        title: "Collage de cle impossible",
        message: "Impossible de lire le presse-papiers.",
      });
      toast.error("Impossible de lire le presse-papiers.");
    }
  };

  const handleInspectLayer = async (layerId: string) => {
    setActiveDiagnosticsLayerId(layerId);
    if (diagnosticsByLayerId[layerId]) {
      return;
    }

    setIsDiagnosticsLoading(true);
    try {
      const diagnostics = await getLayerDiagnostics(layerId);
      if (diagnostics) {
        setDiagnosticsByLayerId((current) => ({
          ...current,
          [layerId]: diagnostics,
        }));
      } else {
        appendDebugEvent({
          level: "warning",
          source: "qgis",
          title: "Diagnostic de couche indisponible",
          message: `Aucun diagnostic retourne pour ${layerId}.`,
        });
        toast.error("Diagnostic indisponible pour cette couche.");
      }
    } finally {
      setIsDiagnosticsLoading(false);
    }
  };

  const handleLoadOfficialSource = async (sourceId: string) => {
    const result = await loadOfficialSource(sourceId);
    if (!result.ok) {
      toast.error(result.status);
      return;
    }
    toast.success(result.status);
    void onRefreshLayers();
  };

  const handleAddRemoteService = async (config: Parameters<typeof addRemoteService>[0]) => {
    const status = await addRemoteService(config);
    if (!status) {
      toast.error("Impossible de charger ce flux dans QGIS.");
      return;
    }
    toast.success(status);
    void onRefreshLayers();
  };

  const handleApplyParcelStylePreset = async (layerId: string, presetId = "cadastre") => {
    const status = await applyParcelStylePreset(layerId, presetId);
    if (!status) {
      toast.error("Impossible d'appliquer le style.");
      return;
    }
    toast.success(status);
    void onRefreshLayers();
  };

  const handleSetLayerLabels = async (
    layerId: string,
    fieldName = "",
    enabled = true,
  ) => {
    const status = await setLayerLabels(layerId, fieldName, enabled);
    if (!status) {
      toast.error("Impossible d'activer les etiquettes.");
      return;
    }
    toast.success(status);
    void onRefreshLayers();
  };

  const handleAddRasterFile = async (filePath: string, layerName?: string) => {
    const status = await addRasterFile(filePath, layerName ?? "");
    if (!status) {
      toast.error("Impossible de charger ce raster.");
      return;
    }
    toast.success(status);
    void onRefreshLayers();
  };

  const handleCalculateRasterFormula = async (
    layerIds: string[],
    formula: string,
    outputName: string,
    outputPath?: string,
  ) => {
    const result = await calculateRasterFormula(
      layerIds,
      formula,
      outputName,
      outputPath ?? "",
    );
    if (!result) {
      toast.error("Le calcul raster a échoué.");
      return;
    }
    toast.success(`Raster calculé : ${result.outputLayerName}`);
    void onRefreshLayers();
  };

  const handleMergeRasterBands = async (
    layerIds: string[],
    outputName: string,
    outputPath?: string,
  ) => {
    const result = await mergeRasterBands(layerIds, outputName, outputPath ?? "");
    if (!result) {
      toast.error("La fusion bi-annuelle a échoué.");
      return;
    }
    toast.success(`Composite créé : ${result.outputLayerName}`);
    void onRefreshLayers();
  };

  const handleCalculateMnh = async (
    mnsLayerId: string,
    mntLayerId: string,
    outputName: string,
    outputPath?: string,
    clampNegative = true,
  ) => {
    const result = await calculateMnh(
      mnsLayerId,
      mntLayerId,
      outputName,
      outputPath ?? "",
      clampNegative,
    );
    if (!result) {
      toast.error("Le calcul du MNH a échoué.");
      return;
    }
    toast.success(`MNH créé : ${result.outputLayerName}`);
    void onRefreshLayers();
  };

  const handleCreateInventoryGrid = async (
    layerId: string,
    cellWidth: number,
    cellHeight: number,
    gridName: string,
    centroidsName: string,
    clipToSource = true,
  ) => {
    const result = await createInventoryGrid(
      layerId,
      cellWidth,
      cellHeight,
      gridName,
      centroidsName,
      clipToSource,
    );
    if (!result) {
      toast.error("La grille d'inventaire a échoué.");
      return;
    }
    toast.success(`Grille créée : ${result.gridLayerName}`);
    void onRefreshLayers();
  };

  const handlePickRasterFile = async () => {
    const selected = await pickQgisFile("Raster (*.tif *.tiff *.img *.vrt)", "Choisir un raster");
    if (!selected) {
      return null;
    }
    return selected;
  };

  const handleSearchCadastreParcels = async (
    options: Parameters<typeof searchCadastreParcels>[0],
  ) => {
    const result = await searchCadastreParcels(options);
    toast.success(result.status || result.summary);
    void onRefreshLayers();
  };

  const handleSearchGeoApiCommunes = async (
    options: Parameters<typeof searchGeoApiCommunes>[0],
  ) => {
    const result = await searchGeoApiCommunes(options);
    toast.success(result.status || result.summary);
    void onRefreshLayers();
  };

  const handleSearchCopernicusProducts = async (
    options: Parameters<typeof searchCopernicusProducts>[0],
  ) => {
    const result = await searchCopernicusProducts(options);
    toast.success(result.summary);
    return result;
  };

  const handleSearchNasaCatalog = async (
    options: Parameters<typeof searchNasaCatalog>[0],
  ) => {
    const result = await searchNasaCatalog(options);
    toast.success(result.summary);
    return result;
  };

  const handleSearchOverpassFeatures = async (
    options: Parameters<typeof searchOverpassFeatures>[0],
  ) => {
    const result = await searchOverpassFeatures(options);
    toast.success(result.status || result.summary);
    void onRefreshLayers();
  };


  return (
    <div className="flex h-full w-full overflow-clip bg-transparent text-white">
      <Suspense fallback={null}>
        <GeoParticlesBackground isDark={true} />
      </Suspense>
      <Suspense fallback={
        <div className="flex h-[84px] w-[396px] items-center justify-center border-r border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
          <div className="text-gray-700 dark:text-white/70">Chargement...</div>
        </div>
      }>
        <WorkspaceSidebar
          activeConversationId={activeConversationId}
          conversations={conversations}
          isOpen={sidebarOpen}
          isRefreshingLayers={isRefreshingLayers}
          layerContextById={layerContextById}
          layers={layers}
          selectedLayerIds={selectedLayerIds}
          onApplyParcelStylePreset={(layerId, presetId) =>
            void handleApplyParcelStylePreset(layerId, presetId)
          }
          onLoadOfficialSource={(sourceId) => void handleLoadOfficialSource(sourceId)}
          onAddRemoteService={(config) => void handleAddRemoteService(config)}
          onAddRasterFile={(filePath, layerName) => void handleAddRasterFile(filePath, layerName)}
          onMergeRasterBands={(layerIds, outputName, outputPath) =>
            void handleMergeRasterBands(layerIds, outputName, outputPath)
          }
          onCalculateMnh={(mnsLayerId, mntLayerId, outputName, outputPath, clampNegative) =>
            void handleCalculateMnh(
              mnsLayerId,
              mntLayerId,
              outputName,
              outputPath,
              clampNegative,
            )
          }
          onCalculateRasterFormula={(layerIds, formula, outputName, outputPath) =>
            void handleCalculateRasterFormula(layerIds, formula, outputName, outputPath)
          }
          onCreateInventoryGrid={(
            layerId,
            cellWidth,
            cellHeight,
            gridName,
            centroidsName,
            clipToSource,
          ) =>
            void handleCreateInventoryGrid(
              layerId,
              cellWidth,
              cellHeight,
              gridName,
              centroidsName,
              clipToSource,
            )
          }
          onCreateConversation={onCreateConversation}
          onDeleteConversation={(conversationId) => void onDeleteConversation(conversationId)}
          onInspectLayer={(layerId) => void handleInspectLayer(layerId)}
          onSearchCadastreParcels={(options) => void handleSearchCadastreParcels(options)}
          onSearchCopernicusProducts={(options) => handleSearchCopernicusProducts(options)}
          onSearchGeoApiCommunes={(options) => void handleSearchGeoApiCommunes(options)}
          onSearchNasaCatalog={(options) => void handleSearchNasaCatalog(options)}
          onSearchOverpassFeatures={(options) => void handleSearchOverpassFeatures(options)}
          onPickRasterFile={() => handlePickRasterFile()}
          onRefreshLayers={() => void onRefreshLayers()}
          onSelectConversation={onSelectConversation}
          onSetLayerLabels={(layerId, fieldName, enabled) =>
            void handleSetLayerLabels(layerId, fieldName, enabled)
          }
          onSetLayerContextScope={onSetLayerContextScope}
          onSetLayerOpacity={onSetLayerOpacity}
          onSetLayerVisibility={onSetLayerVisibility}
          onToggleLayerSelection={onToggleLayerSelection}
          onToggleOpen={toggleSidebar}
          onZoomToLayer={onZoomToLayer}
          onSendMessage={(msg) => void onSendMessage(msg)}
        />
      </Suspense>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Bouton toggle sidebar — pill sobre sur le bord gauche de la zone chat */}
        <motion.button
          onClick={toggleSidebar}
          className="absolute left-0 top-1/2 z-40 -translate-y-1/2 -translate-x-1/2 flex h-12 w-[18px] items-center justify-center rounded-full border border-white/[0.10] bg-[#17181b]/90 shadow-2xl backdrop-blur-md hover:border-white/20 hover:bg-[#1e2023]/90 transition-colors duration-200"
          whileTap={{ scale: 0.93 }}
          aria-label={sidebarOpen ? "Fermer le panneau" : "Ouvrir le panneau"}
        >
          <motion.svg
            width="7"
            height="12"
            viewBox="0 0 7 12"
            fill="none"
            animate={{ rotate: sidebarOpen ? 0 : 180 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
          >
            <path
              d="M5 1L2 6L5 11"
              stroke="rgba(255,255,255,0.40)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        </motion.button>
        {/* Ambient glow effects around the chat zone */}
        <div className="pointer-events-none absolute -left-20 top-1/4 h-96 w-96 rounded-full bg-blue-500/[0.04] blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-1/2 h-80 w-80 rounded-full bg-emerald-500/[0.04] blur-3xl" />
        <div className="pointer-events-none absolute bottom-40 left-1/2 -translate-x-1/2 h-60 w-[600px] rounded-full bg-violet-500/[0.03] blur-3xl" />
        <ChatHeader
          activeConversation={activeConversation}
          conversationMode={conversationMode}
          conversationTitle={activeConversation?.title || ""}
          layerContextById={layerContextById}
          onCreateConversation={onCreateConversation}
          onToggleLayerSelection={onToggleLayerSelection}
          onUpdateConversationMode={onUpdateConversationMode}
          selectedLayers={selectedLayers}
        />

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="relative flex-1 overflow-y-auto px-4 pb-60 pt-4 md:px-6 chat-scrollbar"
        >
          {/* Fade gradient top */}
          <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-8 bg-gradient-to-b from-[var(--background)] to-transparent" />
          {/* Fade gradient bottom */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-8 bg-gradient-to-t from-[var(--background)] to-transparent" />

          <div className="mx-auto w-full max-w-4xl">
            {messages.length <= 1 && !isLoading ? (
              <WelcomeScreen onSendMessage={(msg) => void onSendMessage(msg)} layers={layers} />
            ) : (
              <div className="space-y-10 py-4">
                <AnimatePresence initial={false}>
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                </AnimatePresence>

                {/* Transition instantanée: Thinking → Streaming */}
                <div className="relative">
                  {/* ThinkingIndicator : visible seulement pendant le chargement initial */}
                  <div
                    style={{ 
                      opacity: isLoading && !isStreaming ? 1 : 0,
                      pointerEvents: isLoading && !isStreaming ? "auto" : "none",
                      position: isLoading && !isStreaming ? "relative" : "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      transition: "none",
                    }}
                  >
                    <ThinkingIndicator isLoading={isLoading} onStop={onStopGeneration} />
                  </div>

                  {/* StreamingMessage : visible seulement pendant le streaming */}
                  <div
                    style={{ 
                      opacity: isStreaming ? 1 : 0,
                      pointerEvents: isStreaming ? "auto" : "none",
                      position: isStreaming ? "relative" : "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      transition: "none",
                    }}
                  >
                    <StreamingMessage />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showScrollButton && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              onClick={() =>
                scrollRef.current?.scrollTo({
                  top: scrollRef.current.scrollHeight,
                  behavior: "smooth",
                })
              }
              className="absolute bottom-40 right-8 z-30 rounded-full border border-gray-300 bg-blue-600 p-3 text-white shadow-2xl transition-colors hover:bg-blue-500 dark:border-gray-700"
            >
              <motion.div
                animate={{ y: [0, 4, 0] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <ChevronDown size={20} />
              </motion.div>
            </motion.button>
          )}
        </AnimatePresence>

        <ChatInputArea
          conversationMode={conversationMode}
          isLoading={isLoading}
          onSendMessage={onSendMessage}
          onStopGeneration={onStopGeneration}
          selectedLayers={selectedLayers}
          layerContextById={layerContextById}
          onToggleLayerSelection={onToggleLayerSelection}
          availableLayers={layers.map(l => l.name)}
          lastIntent={undefined}
        />
      </div>

      <AnimatePresence>
        {showSettings && (
          <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="text-white/70">Chargement...</div>
          </div>}>
            <AiSettingsModal
              localSettings={localSettings}
              onClose={() => setShowSettings(false)}
              onPasteApiKey={(target) => void handlePasteApiKey(target)}
              onReset={handleResetSettings}
              onSave={handleSaveSettings}
              setLocalSettings={setLocalSettings}
            />
          </Suspense>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPluginSetup && (
          <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="text-white/70">Chargement...</div>
          </div>}>
            <PluginSetupModalComponent
              onClose={() => setShowPluginSetup(false)}
              pluginPackageLayout={pluginPackageLayout}
            />
          </Suspense>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeDiagnosticsLayerId && (
          <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="text-white/70">Chargement...</div>
          </div>}>
            <LayerDiagnosticsModalComponent
              diagnostics={activeDiagnostics}
              isLoading={isDiagnosticsLoading}
              layerName={diagnosticsLayerName}
              onClose={() => setActiveDiagnosticsLayerId(null)}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}
