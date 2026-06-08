import { type ReactNode, useEffect, useMemo, useState, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";

// Panneaux Devin — chargés en lazy pour ne pas alourdir le bundle initial
// IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI) — Superviseur : Claude Code 4.8 — 2026-06-08
const DataPanel = lazy(() => import("./DataPanel"));
const DiagnosticPanel = lazy(() => import("./DiagnosticPanel"));
const DossierPanel = lazy(() => import("./DossierPanel"));
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Crosshair,
  Eye,
  EyeOff,
  FlaskConical,
  Globe,
  History,
  Layers3,
  Link2,
  Map,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  Star,
  Trash2,
  WandSparkles,
  TreePine,
  Leaf,
  Waves,
  Mountain,
  Flame,
  Zap,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Info,
  MessageSquare,
  Database,
  Network,
  Filter,
  X,
  Wrench,
  Building2,
  AlertTriangle,
  FileText,
  BookOpen,
  ShieldCheck,
  Activity,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/src/lib/utils";

import { ChatConversation, LayerContextScope } from "../lib/chat-history";
import {
  RemoteServiceConfig,
  RemoteServiceType,
  SUPPORTED_REMOTE_SERVICE_TYPES,
} from "../lib/catalog";
import { DATA_SOURCE_CATEGORIES } from "../lib/additional-sources";
import { checkServiceHealth } from "../lib/service-health";
import { LayerSummary, setProjectCrs } from "../lib/qgis";
import {
  type CadastreParcelSearchOptions,
  type CopernicusSearchResult,
  type CopernicusSearchResultItem,
  type GeoApiCommuneSearchOptions,
  type NasaCatalogSearchResult,
  type NasaCatalogSearchResultItem,
  type OverpassSearchOptions,
  OVERPASS_ENDPOINTS,
  searchOfficialSources,
} from "../lib/official-sources";
import PerformancePanel from "./PerformancePanel";
import { useFavoriteLayersStore } from "../stores/useFavoriteLayersStore";

interface WorkspaceSidebarProps {
  activeConversationId: string | null;
  conversations: ChatConversation[];
  isOpen: boolean;
  isRefreshingLayers: boolean;
  layerContextById: Record<string, LayerContextScope>;
  layers: LayerSummary[];
  selectedLayerIds: string[];
  onApplyParcelStylePreset: (layerId: string, presetId?: string) => void | Promise<void>;
  onLoadOfficialSource: (sourceId: string) => void | Promise<void>;
  onAddRemoteService: (config: RemoteServiceConfig) => void | Promise<void>;
  onAddRasterFile: (filePath: string, layerName?: string) => void | Promise<void>;
  onMergeRasterBands: (
    layerIds: string[],
    outputName: string,
    outputPath?: string,
  ) => void | Promise<void>;
  onCalculateMnh: (
    mnsLayerId: string,
    mntLayerId: string,
    outputName: string,
    outputPath?: string,
    clampNegative?: boolean,
  ) => void | Promise<void>;
  onCalculateRasterFormula: (
    layerIds: string[],
    formula: string,
    outputName: string,
    outputPath?: string,
  ) => void | Promise<void>;
  onCreateInventoryGrid: (
    layerId: string,
    cellWidth: number,
    cellHeight: number,
    gridName: string,
    centroidsName: string,
    clipToSource?: boolean,
  ) => void | Promise<void>;
  onCreateConversation: () => void | Promise<void>;
  onDeleteConversation: (conversationId: string) => void;
  onInspectLayer: (layerId: string) => void | Promise<void>;
  onSearchCadastreParcels: (
    options: CadastreParcelSearchOptions,
  ) => void | Promise<void>;
  onSearchGeoApiCommunes: (
    options: GeoApiCommuneSearchOptions,
  ) => void | Promise<void>;
  onSearchCopernicusProducts: (options: {
    collection?: string;
    nameContains?: string;
    limit?: number;
  }) => Promise<CopernicusSearchResult>;
  onSearchNasaCatalog: (options: {
    collection: string;
    bbox?: string;
    limit?: number;
  }) => Promise<NasaCatalogSearchResult>;
  onSearchOverpassFeatures: (
    options: OverpassSearchOptions,
  ) => void | Promise<void>;
  onPickRasterFile?: () => Promise<string | null>;
  onRefreshLayers: () => void | Promise<void>;
  onSelectConversation: (conversationId: string) => void;
  onSetLayerLabels: (
    layerId: string,
    fieldName?: string,
    enabled?: boolean,
  ) => void | Promise<void>;
  onSetLayerContextScope: (
    layerId: string,
    scope: LayerContextScope,
  ) => void | Promise<void>;
  onSetLayerOpacity: (layerId: string, opacity: number) => void | Promise<void>;
  onSetLayerVisibility: (layerId: string, visible: boolean) => void | Promise<void>;
  onToggleLayerSelection: (layerId: string) => void;
  onToggleOpen: () => void;
  onZoomToLayer: (layerId: string) => void | Promise<void>;
  onSendMessage?: (message: string) => void;
}

type SidebarTab = "history" | "layers" | "services" | "tools";

interface CustomServiceDraft {
  name: string;
  serviceType: RemoteServiceType;
  url: string;
  layerName: string;
  style: string;
  format: string;
  crs: string;
  tileMatrixSet: string;
  version: string;
}

const DEFAULT_SERVICE_DRAFT: CustomServiceDraft = {
  name: "",
  serviceType: "WMS",
  url: "",
  layerName: "",
  style: "",
  format: "image/png",
  crs: "EPSG:3857",
  tileMatrixSet: "PM",
  version: "2.0.0",
};

const DEFAULT_CADASTRE_DRAFT: CadastreParcelSearchOptions = {
  codeInsee: "",
  section: "",
  numero: "",
  sourceIgn: "PCI",
  addToMap: true,
  layerName: "",
};

function formatConversationTimestamp(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function SidebarSection({
  title,
  description,
  accentClassName,
  children,
}: {
  title: string;
  description?: string;
  accentClassName: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02] p-4 shadow-sm">
      <div className="mb-3.5">
        <p className={cn("text-[10px] font-black uppercase tracking-[0.28em]", accentClassName)}>
          {title}
        </p>
        {description ? <p className="mt-1 text-[11px] text-gray-500 dark:text-white/35">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function CollapsibleSection({
  title,
  description,
  accentClassName,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  description?: string;
  accentClassName: string;
  icon: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02] overflow-hidden shadow-sm">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3.5 text-left transition-all hover:bg-gray-100/80 dark:hover:bg-white/[0.04]"
      >
        <span className={cn("shrink-0", accentClassName)}>{icon}</span>
        <div className="flex-1">
          <span className={cn("block text-[10px] font-black uppercase tracking-[0.28em]", accentClassName)}>
            {title}
          </span>
          {description && <p className="mt-0.5 text-[10px] text-gray-500 dark:text-white/30">{description}</p>}
        </div>
        <ChevronDown
          size={13}
          className={cn("shrink-0 text-gray-400 dark:text-white/25 transition-transform duration-200", isOpen && "rotate-180")}
        />
      </button>
      {isOpen && <div className="border-t border-gray-200 dark:border-white/[0.05] p-3.5 pt-3">{children}</div>}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICES TAB — META & HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

type ServicesSubTab = "catalog" | "favorites" | "tools" | "custom";
type ServiceTypeFilter = "all" | "WMS" | "WMTS" | "WFS" | "XYZ";

const CATEGORY_META: Record<string, { icon: ReactNode; tone: string; ring: string }> = {
  base: { icon: <Map size={13} />, tone: "text-cyan-600 dark:text-cyan-300", ring: "ring-cyan-500/20" },
  topographic: { icon: <Mountain size={13} />, tone: "text-amber-600 dark:text-amber-300", ring: "ring-amber-500/20" },
  satellite: { icon: <Globe size={13} />, tone: "text-sky-600 dark:text-sky-300", ring: "ring-sky-500/20" },
  lidar: { icon: <Layers3 size={13} />, tone: "text-violet-600 dark:text-violet-300", ring: "ring-violet-500/20" },
  administrative: { icon: <Building2 size={13} />, tone: "text-blue-600 dark:text-blue-300", ring: "ring-blue-500/20" },
  infrastructure: { icon: <Network size={13} />, tone: "text-fuchsia-600 dark:text-fuchsia-300", ring: "ring-fuchsia-500/20" },
  forestry: { icon: <TreePine size={13} />, tone: "text-emerald-600 dark:text-emerald-300", ring: "ring-emerald-500/20" },
  risks: { icon: <AlertTriangle size={13} />, tone: "text-red-600 dark:text-red-300", ring: "ring-red-500/20" },
  biodiversity: { icon: <Leaf size={13} />, tone: "text-green-600 dark:text-green-300", ring: "ring-green-500/20" },
  urbanPlanning: { icon: <FileText size={13} />, tone: "text-indigo-600 dark:text-indigo-300", ring: "ring-indigo-500/20" },
  hydrography: { icon: <Waves size={13} />, tone: "text-blue-500 dark:text-blue-300", ring: "ring-blue-400/20" },
  landcover: { icon: <MapPin size={13} />, tone: "text-orange-600 dark:text-orange-300", ring: "ring-orange-500/20" },
  demography: { icon: <Database size={13} />, tone: "text-slate-600 dark:text-slate-300", ring: "ring-slate-500/20" },
};

const SERVICE_TYPE_BADGE: Record<string, string> = {
  WMS: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  WMTS: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  WFS: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  XYZ: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  WCS: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  TMS: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  ArcGISMapServer: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  ArcGISFeatureServer: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
};

const FAVORITE_SERVICES_KEY = "qgisia-favorite-services";

function loadFavoriteServiceIds(): string[] {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(FAVORITE_SERVICES_KEY) : null;
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function persistFavoriteServiceIds(ids: string[]) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(FAVORITE_SERVICES_KEY, JSON.stringify(ids));
  } catch {}
}

const COMMON_CRS = [
  { code: "EPSG:2154", label: "RGF93 / Lambert-93 (France)" },
  { code: "EPSG:4326", label: "WGS 84 (lat/lon)" },
  { code: "EPSG:3857", label: "Web Mercator" },
  { code: "EPSG:32630", label: "UTM zone 30N" },
  { code: "EPSG:32631", label: "UTM zone 31N" },
  { code: "EPSG:32632", label: "UTM zone 32N" },
  { code: "EPSG:3035", label: "ETRS89-LAEA (Europe)" },
  { code: "EPSG:27572", label: "NTF Lambert II étendu" },
];

export default function WorkspaceSidebar(props: WorkspaceSidebarProps) {
  const {
    activeConversationId,
    conversations,
    isOpen,
    isRefreshingLayers,
    layerContextById,
    layers,
    selectedLayerIds,
    onApplyParcelStylePreset,
    onLoadOfficialSource,
    onAddRemoteService,
    onAddRasterFile,
    onMergeRasterBands,
    onCalculateMnh,
    onCalculateRasterFormula,
    onCreateInventoryGrid,
    onCreateConversation,
    onDeleteConversation,
    onInspectLayer,
    onSearchCadastreParcels,
    onSearchCopernicusProducts,
    onSearchGeoApiCommunes,
    onSearchNasaCatalog,
    onSearchOverpassFeatures,
    onPickRasterFile,
    onRefreshLayers,
    onSelectConversation,
    onSetLayerLabels,
    onSetLayerContextScope,
    onSetLayerOpacity,
    onSetLayerVisibility,
    onToggleLayerSelection,
    onToggleOpen,
    onZoomToLayer,
    onSendMessage,
  } = props;

  const [activeTab, setActiveTab] = useState<SidebarTab>("history");
  const [conversationQuery, setConversationQuery] = useState("");
  const [layerQuery, setLayerQuery] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [selectedCrs, setSelectedCrs] = useState("EPSG:2154");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [opacityDrafts, setOpacityDrafts] = useState<Record<string, number>>({});
  const [serviceDraft, setServiceDraft] =
    useState<CustomServiceDraft>(DEFAULT_SERVICE_DRAFT);
  const [cadastreDraft, setCadastreDraft] =
    useState<CadastreParcelSearchOptions>(DEFAULT_CADASTRE_DRAFT);
  const [communeSearchName, setCommuneSearchName] = useState("");
  const [copernicusCollection, setCopernicusCollection] = useState("SENTINEL-2");
  const [copernicusNameContains, setCopernicusNameContains] = useState("");
  const [copernicusLimit, setCopernicusLimit] = useState("5");
  const [copernicusResults, setCopernicusResults] = useState<
    CopernicusSearchResultItem[]
  >([]);
  const [nasaCollection, setNasaCollection] = useState("HLSS30.v2.0");
  const [nasaBbox, setNasaBbox] = useState("");
  const [nasaLimit, setNasaLimit] = useState("5");
  const [nasaResults, setNasaResults] = useState<NasaCatalogSearchResultItem[]>([]);
  const [overpassEndpoint, setOverpassEndpoint] = useState<string>(
    OVERPASS_ENDPOINTS[0],
  );
  const [overpassQuery, setOverpassQuery] = useState(
    "[out:json][timeout:25];node(48.85,2.34,48.86,2.35)[amenity=drinking_water];out body;",
  );
  const [overpassLayerName, setOverpassLayerName] = useState("OSM_query");
  const [rasterPath, setRasterPath] = useState("");
  const [rasterName, setRasterName] = useState("");
  const [formulaLayerIds, setFormulaLayerIds] = useState<string[]>([]);
  const [rasterFormula, setRasterFormula] = useState("A");
  const [rasterFormulaOutputName, setRasterFormulaOutputName] = useState("Raster_calc");
  const [rasterFormulaOutputPath, setRasterFormulaOutputPath] = useState("");
  const [mergeLayerIds, setMergeLayerIds] = useState<string[]>([]);
  const [mergeOutputName, setMergeOutputName] = useState("Fusion_biannuelle");
  const [mergeOutputPath, setMergeOutputPath] = useState("");
  const [mnsLayerId, setMnsLayerId] = useState("");
  const [mntLayerId, setMntLayerId] = useState("");
  const [mnhOutputName, setMnhOutputName] = useState("MNH");
  const [mnhOutputPath, setMnhOutputPath] = useState("");
  const [clampNegativeMnh, setClampNegativeMnh] = useState(true);
  const [inventoryLayerId, setInventoryLayerId] = useState("");
  const [inventoryCellWidth, setInventoryCellWidth] = useState("250");
  const [inventoryCellHeight, setInventoryCellHeight] = useState("250");
  const [inventoryGridName, setInventoryGridName] = useState("Grille_inventaire");
  const [inventoryCentroidsName, setInventoryCentroidsName] = useState(
    "Grille_inventaire_centroides",
  );
  const [inventoryClipToSource, setInventoryClipToSource] = useState(true);

  // Services tab — sub-tabs, filters, favorites
  const [servicesSubTab, setServicesSubTab] = useState<ServicesSubTab>("catalog");
  const [toolsSubTab, setToolsSubTab] = useState<"data" | "diagnostic" | "dossiers">("data");
  const [overpassAdvanced, setOverpassAdvanced] = useState(false);
  const [nasaBboxLoading, setNasaBboxLoading] = useState(false);
  const [copBboxLoading, setCopBboxLoading] = useState(false);
  const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceTypeFilter>("all");
  const [reliableOnly, setReliableOnly] = useState(true);
  const [favoriteServiceIds, setFavoriteServiceIds] = useState<string[]>(() => loadFavoriteServiceIds());
  const [addingServiceId, setAddingServiceId] = useState<string | null>(null);
  const [collapsedCatalogCategories, setCollapsedCatalogCategories] = useState<Record<string, boolean>>({});

  const toggleFavoriteService = (id: string) => {
    setFavoriteServiceIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      persistFavoriteServiceIds(next);
      return next;
    });
  };

  const handleAddServiceCard = async (source: import("../lib/catalog").CatalogItem) => {
    setAddingServiceId(source.id);
    const probeToastId = toast.loading(`Vérification de ${source.name}...`);
    try {
      // Pré-check de reachability avant de solliciter QGIS
      const health = await checkServiceHealth(source);
      if (!health.ok) {
        toast.error(health.message, {
          id: probeToastId,
          description:
            health.reason === "requires-key"
              ? "Va dans Paramètres → Clés API."
              : health.reason === "timeout"
                ? "Le serveur est peut-être surchargé ou hors-ligne."
                : health.reason === "network"
                  ? "Problème réseau ou serveur inaccessible."
                  : undefined,
          duration: 6000,
        });
        return;
      }

      // Service joignable — on délègue à QGIS (Chat.tsx affiche son propre toast)
      toast.dismiss(probeToastId);
      await onAddRemoteService(source);
    } catch (err) {
      toast.error(
        `Échec : ${err instanceof Error ? err.message : "service indisponible"}`,
        { id: probeToastId },
      );
    } finally {
      setAddingServiceId(null);
    }
  };

  const allServiceSourcesFlat = useMemo(() => {
    return Object.entries(DATA_SOURCE_CATEGORIES).flatMap(([key, cat]) =>
      cat.sources.map((s) => ({ source: s, categoryKey: key })),
    );
  }, []);

  const filteredServiceSources = useMemo(() => {
    const q = serviceQuery.toLowerCase().trim();
    return allServiceSourcesFlat.filter(({ source }) => {
      if (reliableOnly && !source.reliable) return false;
      if (serviceTypeFilter !== "all" && source.serviceType !== serviceTypeFilter) return false;
      if (q) {
        const hay = `${source.name} ${source.provider ?? ""} ${source.description ?? ""} ${source.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allServiceSourcesFlat, serviceQuery, reliableOnly, serviceTypeFilter]);

  const filteredByCategory = useMemo(() => {
    const grouped: Record<string, { name: string; description: string; sources: import("../lib/catalog").CatalogItem[] }> = {};
    for (const { source, categoryKey } of filteredServiceSources) {
      const cat = DATA_SOURCE_CATEGORIES[categoryKey as keyof typeof DATA_SOURCE_CATEGORIES];
      if (!grouped[categoryKey]) {
        grouped[categoryKey] = { name: cat.name, description: cat.description, sources: [] };
      }
      grouped[categoryKey].sources.push(source);
    }
    return grouped;
  }, [filteredServiceSources]);

  const favoriteSources = useMemo(() => {
    return allServiceSourcesFlat
      .filter(({ source }) => favoriteServiceIds.includes(source.id))
      .map(({ source }) => source);
  }, [allServiceSourcesFlat, favoriteServiceIds]);

  const toggleCatalogCategory = (key: string) => {
    setCollapsedCatalogCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleFavorite = useFavoriteLayersStore((s) => s.toggleFavorite);
  const isFavorite = useFavoriteLayersStore((s) => s.isFavorite);

  useEffect(() => {
    setOpacityDrafts((current) => {
      const next = { ...current };
      for (const layer of layers) {
        next[layer.id] = Math.round(layer.opacity * 100);
      }
      return next;
    });
  }, [layers]);

  const filteredLayers = useMemo(() => {
    const query = layerQuery.trim().toLowerCase();
    if (!query) {
      return layers;
    }

    return layers.filter((layer) =>
      [layer.name, layer.type, layer.geometryType, layer.crs, layer.provider]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [layerQuery, layers]);

  const filteredConversations = useMemo(() => {
    const query = conversationQuery.trim().toLowerCase();
    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      [conversation.title, conversation.mode]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [conversationQuery, conversations]);

  const rasterLayers = useMemo(
    () => layers.filter((layer) => layer.type.toLowerCase() === "raster"),
    [layers],
  );
  const polygonLayers = useMemo(
    () =>
      layers.filter(
        (layer) =>
          layer.type.toLowerCase() === "vector" &&
          layer.geometryType.toLowerCase().includes("polygon"),
      ),
    [layers],
  );

  useEffect(() => {
    if (!mnsLayerId && rasterLayers[0]) {
      setMnsLayerId(rasterLayers[0].id);
    }
    if (!mntLayerId && rasterLayers[1]) {
      setMntLayerId(rasterLayers[1].id);
    } else if (!mntLayerId && rasterLayers[0]) {
      setMntLayerId(rasterLayers[0].id);
    }
    setFormulaLayerIds((current) =>
      current.filter((layerId) => rasterLayers.some((layer) => layer.id === layerId)),
    );
    setMergeLayerIds((current) =>
      current.filter((layerId) => rasterLayers.some((layer) => layer.id === layerId)),
    );
  }, [mntLayerId, mnsLayerId, rasterLayers]);

  useEffect(() => {
    if (!inventoryLayerId && polygonLayers[0]) {
      setInventoryLayerId(polygonLayers[0].id);
      const safeName = polygonLayers[0].name.replace(/\s+/g, "_");
      setInventoryGridName(`${safeName}_grille_inventaire`);
      setInventoryCentroidsName(`${safeName}_centroides`);
      return;
    }

    if (inventoryLayerId && !polygonLayers.some((layer) => layer.id === inventoryLayerId)) {
      const fallback = polygonLayers[0];
      setInventoryLayerId(fallback?.id || "");
      if (fallback) {
        const safeName = fallback.name.replace(/\s+/g, "_");
        setInventoryGridName(`${safeName}_grille_inventaire`);
        setInventoryCentroidsName(`${safeName}_centroides`);
      }
    }
  }, [inventoryLayerId, polygonLayers]);

  const submitCustomService = async () => {
    if (!serviceDraft.name.trim() || !serviceDraft.url.trim()) {
      toast.error("Nom et URL du service requis.");
      return;
    }

    await onAddRemoteService({
      ...serviceDraft,
      name: serviceDraft.name.trim(),
      url: serviceDraft.url.trim(),
      layerName: serviceDraft.layerName.trim() || undefined,
      style: serviceDraft.style.trim() || undefined,
      format: serviceDraft.format.trim() || undefined,
      crs: serviceDraft.crs.trim() || undefined,
      tileMatrixSet: serviceDraft.tileMatrixSet.trim() || undefined,
      version: serviceDraft.version.trim() || undefined,
    });
  };

  const submitCadastreSearch = async () => {
    if (!cadastreDraft.codeInsee?.trim()) {
      toast.error("Le code INSEE est requis pour le cadastre.");
      return;
    }

    await onSearchCadastreParcels({
      ...cadastreDraft,
      codeInsee: cadastreDraft.codeInsee.trim(),
      section: cadastreDraft.section?.trim() || undefined,
      numero: cadastreDraft.numero?.trim() || undefined,
      layerName: cadastreDraft.layerName?.trim() || undefined,
      sourceIgn: cadastreDraft.sourceIgn === "BDP" ? "BDP" : "PCI",
      addToMap: true,
    });
  };

  const submitCommuneSearch = async () => {
    if (!communeSearchName.trim()) {
      toast.error("Saisis un nom de commune.");
      return;
    }

    await onSearchGeoApiCommunes({
      name: communeSearchName.trim(),
      addToMap: true,
      layerName: `Communes_${communeSearchName.trim().replace(/\s+/g, "_")}`,
    });
  };

  const submitCopernicusSearch = async () => {
    const result = await onSearchCopernicusProducts({
      collection: copernicusCollection.trim() || undefined,
      nameContains: copernicusNameContains.trim() || undefined,
      limit: Math.max(1, Math.min(Number(copernicusLimit) || 5, 20)),
    });
    setCopernicusResults(result.items);
  };

  const submitNasaSearch = async () => {
    if (!nasaCollection.trim()) {
      toast.error("La collection NASA est requise.");
      return;
    }

    const result = await onSearchNasaCatalog({
      collection: nasaCollection.trim(),
      bbox: nasaBbox.trim() || undefined,
      limit: Math.max(1, Math.min(Number(nasaLimit) || 5, 20)),
    });
    setNasaResults(result.items);
  };

  const submitOverpassSearch = async () => {
    if (!overpassQuery.trim()) {
      toast.error("La requete Overpass est requise.");
      return;
    }

    await onSearchOverpassFeatures({
      endpoint: overpassEndpoint,
      query: overpassQuery.trim(),
      addToMap: true,
      layerName: overpassLayerName.trim() || "OSM_query",
    });
  };

  const submitRasterFile = async () => {
    if (!rasterPath.trim()) {
      toast.error("Chemin raster requis.");
      return;
    }
    await onAddRasterFile(rasterPath.trim(), rasterName.trim() || undefined);
  };

  const submitRasterFormula = async () => {
    if (formulaLayerIds.length === 0) {
      toast.error("Choisissez au moins un raster.");
      return;
    }
    if (!rasterFormula.trim()) {
      toast.error("La formule raster est requise.");
      return;
    }
    await onCalculateRasterFormula(
      formulaLayerIds,
      rasterFormula.trim(),
      rasterFormulaOutputName.trim() || "Raster_calc",
      rasterFormulaOutputPath.trim() || undefined,
    );
  };

  const submitRasterMerge = async () => {
    if (mergeLayerIds.length < 2) {
      toast.error("Choisissez au moins deux rasters à fusionner.");
      return;
    }

    await onMergeRasterBands(
      mergeLayerIds,
      mergeOutputName.trim() || "Fusion_biannuelle",
      mergeOutputPath.trim() || undefined,
    );
  };

  const submitMnh = async () => {
    if (!mnsLayerId || !mntLayerId) {
      toast.error("Choisissez un MNS et un MNT.");
      return;
    }
    await onCalculateMnh(
      mnsLayerId,
      mntLayerId,
      mnhOutputName.trim() || "MNH",
      mnhOutputPath.trim() || undefined,
      clampNegativeMnh,
    );
  };

  const submitInventoryGrid = async () => {
    if (!inventoryLayerId) {
      toast.error("Choisissez une couche d'emprise polygonale.");
      return;
    }

    const cellWidth = Number(inventoryCellWidth.replace(",", "."));
    const cellHeight = Number(inventoryCellHeight.replace(",", "."));
    if (!Number.isFinite(cellWidth) || cellWidth <= 0) {
      toast.error("La largeur de maille doit être positive.");
      return;
    }
    if (!Number.isFinite(cellHeight) || cellHeight <= 0) {
      toast.error("La hauteur de maille doit être positive.");
      return;
    }

    await onCreateInventoryGrid(
      inventoryLayerId,
      cellWidth,
      cellHeight,
      inventoryGridName.trim() || "Grille_inventaire",
      inventoryCentroidsName.trim() || "Grille_inventaire_centroides",
      inventoryClipToSource,
    );
  };

  const openRasterPicker = async () => {
    if (!onPickRasterFile) {
      toast.error("Sélecteur de fichiers indisponible.");
      return;
    }
    const picked = await onPickRasterFile();
    if (picked) {
      setRasterPath(picked);
      if (!rasterName.trim()) {
        const parts = picked.split(/[\\/]/);
        const filename = parts[parts.length - 1] || picked;
        setRasterName(filename.replace(/\.[^.]+$/, ""));
      }
    }
  };

  const renderHistoryTab = () => (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/25"
          size={14}
        />
        <input
          value={conversationQuery}
          onChange={(event) => setConversationQuery(event.target.value)}
          placeholder="Rechercher une discussion..."
          className="w-full rounded-xl border border-gray-200 dark:border-white/[0.07] bg-gray-100/80 dark:bg-white/[0.03] py-2 pl-9 pr-3 text-[13px] text-gray-700 dark:text-gray-200 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-white/25 focus:border-blue-400/50 focus:bg-white dark:focus:bg-white/[0.05] dark:focus:border-blue-500/40"
        />
      </div>
      
      {filteredConversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.07] bg-gray-50/60 dark:bg-white/[0.01] p-5 text-center">
          <MessageSquare size={20} className="mx-auto mb-2 text-gray-300 dark:text-white/20" />
          <p className="text-[12px] text-gray-400 dark:text-white/30">
            {conversations.length === 0 ? "Aucune discussion enregistrée" : "Aucun résultat"}
          </p>
        </div>
      ) : (
        filteredConversations.map((conversation) => {
          const isActive = conversation.id === activeConversationId;
          return (
            <div
              key={conversation.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectConversation(conversation.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelectConversation(conversation.id); }}
              className={cn(
                "group w-full cursor-pointer rounded-2xl border p-3.5 text-left transition-all duration-200",
                isActive
                  ? "border-blue-500/40 bg-gradient-to-br from-blue-500/12 to-blue-600/6 shadow-md shadow-blue-500/10"
                  : "border-gray-200 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02] hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:border-gray-300 dark:hover:border-white/[0.06]",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest",
                      conversation.mode === "free"
                        ? "bg-violet-500/15 text-violet-400 border border-violet-500/25"
                        : "bg-blue-500/15 text-blue-400 border border-blue-500/25"
                    )}>
                      {conversation.mode === "free" ? "Libre" : "Action"}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-white/30 tabular-nums">
                      {conversation.messages.length} msg
                    </span>
                  </div>
                  <p className={cn(
                    "truncate text-[13px] font-semibold leading-tight",
                    isActive ? "text-blue-700 dark:text-blue-200" : "text-gray-700 dark:text-gray-200"
                  )}>
                    {conversation.title}
                  </p>
                </div>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteConversation(conversation.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-100 dark:bg-white/[0.05] p-1.5 text-gray-400 dark:text-white/30 transition-all hover:border-red-400/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                  title="Supprimer"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-gray-400 dark:text-white/30">{formatConversationTimestamp(conversation.updatedAt)}</span>
                {conversation.selectedLayerIds.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400/70">
                    <Database size={9} />{conversation.selectedLayerIds.length} couche(s)
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const renderLayersTab = () => (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/25"
          size={14}
        />
        <input
          value={layerQuery}
          onChange={(event) => setLayerQuery(event.target.value)}
          placeholder="Nom, CRS, type..."
          className="w-full rounded-xl border border-gray-200 dark:border-white/[0.07] bg-gray-100/80 dark:bg-white/[0.03] py-2 pl-9 pr-3 text-[13px] text-gray-700 dark:text-gray-200 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-white/25 focus:border-emerald-400/50 focus:bg-white dark:focus:bg-white/[0.05] dark:focus:border-emerald-500/40"
        />
      </div>

      {filteredLayers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.07] bg-gray-50/60 dark:bg-white/[0.01] p-5 text-center">
          <Database size={20} className="mx-auto mb-2 text-gray-300 dark:text-white/20" />
          <p className="text-[12px] text-gray-400 dark:text-white/30">
            {layers.length === 0 ? "Aucune couche chargée" : "Aucun résultat"}
          </p>
        </div>
      ) : (
        filteredLayers.map((layer) => {
          const isSelected = selectedLayerIds.includes(layer.id);
          const scope = layerContextById[layer.id] || "layer";
          const opacityValue = opacityDrafts[layer.id] ?? Math.round(layer.opacity * 100);
          const isNonL93 = layer.crs && layer.crs !== "EPSG:2154" && layer.type.toLowerCase() === "vector";
          const typeColor = layer.type.toLowerCase() === "raster"
            ? "text-amber-500 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
            : layer.geometryType.toLowerCase().includes("polygon")
              ? "text-violet-500 dark:text-violet-400 border-violet-500/30 bg-violet-500/10"
              : layer.geometryType.toLowerCase().includes("line")
                ? "text-blue-500 dark:text-blue-400 border-blue-500/30 bg-blue-500/10"
                : "text-emerald-500 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
          return (
            <motion.div
              key={layer.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              whileHover={{ y: -1, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
              className="group rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.02] p-3.5 transition-all duration-150 hover:border-gray-300 dark:hover:border-white/[0.06] hover:bg-white dark:hover:bg-white/[0.04] hover:shadow-sm dark:hover:shadow-[0_1px_3px_rgba(255,255,255,0.03)]">
            
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => onToggleLayerSelection(layer.id)}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-all",
                        isSelected
                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                          : "border-gray-200 dark:border-white/[0.08] bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-white/40 hover:border-emerald-500/30 hover:text-emerald-600",
                      )}
                    >
                      {isSelected ? "✓ Contexte" : "+ Cibler"}
                    </button>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-semibold", typeColor)}>
                      {layer.type || "?"}  {layer.geometryType ? `· ${layer.geometryType}` : ""}
                    </span>
                    {isNonL93 && (
                      <span className="rounded-full border border-orange-400/30 bg-orange-400/10 px-2 py-0.5 text-[9px] font-bold text-orange-500 dark:text-orange-400">
                        ⚠ {layer.crs}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 truncate text-[13px] font-semibold text-gray-800 dark:text-gray-100">{layer.name}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500 dark:text-white/35">
                    {layer.featureCount != null ? `${layer.featureCount.toLocaleString("fr-FR")} entité(s)` : "n/a"}
                    {layer.selectedFeatureCount > 0 && <span className="text-blue-500 dark:text-blue-400"> · {layer.selectedFeatureCount} sélect.</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleFavorite(layer.id)}
                    className={cn(
                      "rounded-xl border p-1.5 transition-all",
                      isFavorite(layer.id)
                        ? "border-amber-400/35 bg-amber-400/12 text-amber-400"
                        : "border-gray-200 dark:border-white/[0.08] bg-gray-100 dark:bg-white/[0.04] text-gray-400 dark:text-white/30 hover:text-amber-400",
                    )}
                    title={isFavorite(layer.id) ? "Retirer des favoris" : "Ajouter aux favoris"}
                  >
                    <Star size={13} className={isFavorite(layer.id) ? "fill-current" : ""} />
                  </button>
                  <button
                    onClick={() => void onInspectLayer(layer.id)}
                    className="rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-100 dark:bg-white/[0.04] p-1.5 text-gray-400 dark:text-white/30 transition-all hover:border-violet-400/35 hover:text-violet-400"
                    title="Diagnostic"
                  >
                    <FlaskConical size={13} />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => void onSetLayerVisibility(layer.id, !layer.visible)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-medium transition-all",
                    layer.visible
                      ? "border-gray-200 dark:border-white/[0.08] bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-white/50 hover:border-gray-300 dark:hover:border-white/[0.06]"
                      : "border-orange-400/30 bg-orange-400/10 text-orange-500 dark:text-orange-400"
                  )}
                >
                  {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  {layer.visible ? "Visible" : "Masquée"}
                </button>
                <button
                  onClick={() => void onZoomToLayer(layer.id)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-100 dark:bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-gray-600 dark:text-white/50 transition-all hover:border-blue-400/35 hover:text-blue-500 dark:hover:text-blue-400"
                >
                  <Crosshair size={12} />
                  Centrer
                </button>
              </div>

              {layer.type.toLowerCase() === "vector" ? (
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => void onApplyParcelStylePreset(layer.id, "cadastre")}
                    className="rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-100 dark:bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-gray-600 dark:text-white/50 transition-all hover:border-violet-400/30 hover:text-violet-500 dark:hover:text-violet-400"
                  >
                    Style parcelle
                  </button>
                  <button
                    onClick={() => void onSetLayerLabels(layer.id, "", true)}
                    className="rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-100 dark:bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-gray-600 dark:text-white/50 transition-all hover:border-cyan-400/30 hover:text-cyan-500 dark:hover:text-cyan-400"
                  >
                    Étiquettes
                  </button>
                </div>
              ) : null}

              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => void onSetLayerContextScope(layer.id, "layer")}
                  className={cn(
                    "rounded-xl border px-2.5 py-1.5 text-[11px] font-medium transition-all",
                    scope === "layer"
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                      : "border-gray-200 dark:border-white/[0.08] bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-white/40 hover:border-emerald-400/30 hover:text-emerald-600",
                  )}
                >
                  Couche entière
                </button>
                <button
                  onClick={() => void onSetLayerContextScope(layer.id, "selection")}
                  className={cn(
                    "rounded-xl border px-2.5 py-1.5 text-[11px] font-medium transition-all",
                    scope === "selection"
                      ? "border-blue-500/40 bg-blue-500/15 text-blue-600 dark:text-blue-300"
                      : "border-gray-200 dark:border-white/[0.08] bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-white/40 hover:border-blue-400/30 hover:text-blue-600",
                  )}
                >
                  Sélection
                </button>
              </div>

              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30">Opacité</span>
                  <span className="text-[11px] font-bold text-gray-600 dark:text-white/50 tabular-nums">{opacityValue}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={opacityValue}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setOpacityDrafts((current) => ({ ...current, [layer.id]: value }));
                  }}
                  onMouseUp={() =>
                    void onSetLayerOpacity(layer.id, (opacityDrafts[layer.id] ?? opacityValue) / 100)
                  }
                  onTouchEnd={() =>
                    void onSetLayerOpacity(layer.id, (opacityDrafts[layer.id] ?? opacityValue) / 100)
                  }
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-300 dark:bg-gray-700 accent-emerald-400"
                />
              </div>

              {layer.subsetString ? (
                <div className="mt-3 rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-[11px] text-gray-600 dark:text-white/45">
                  Filtre: {layer.subsetString}
                </div>
              ) : null}
            </motion.div>
          );
        })
      )}
    </div>
  );

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSetProjectCrs = async () => {
    const result = await setProjectCrs(selectedCrs);
    if (result) {
      toast.success(`Projection changée en ${selectedCrs}`);
    } else {
      toast.error("Impossible de changer la projection (QGIS non connecté ?).");
    }
  };

  const OVERPASS_TEMPLATES = [
    { label: "Routes", query: '[out:json][timeout:25];\narea[name="Rennes"]->.a;\n(way[highway](area.a););\nout geom;', layerName: "Routes_OSM" },
    { label: "Bâtiments", query: '[out:json][timeout:25];\narea[name="Rennes"]->.a;\n(way[building](area.a););\nout geom;', layerName: "Batiments_OSM" },
    { label: "Eau", query: '[out:json][timeout:25];\narea[name="Bretagne"]->.a;\n(way[waterway](area.a);relation[waterway](area.a););\nout geom;', layerName: "Cours_eau_OSM" },
    { label: "Forêts", query: '[out:json][timeout:25];\narea[name="Bretagne"]->.a;\n(way[landuse=forest](area.a);way[natural=wood](area.a););\nout geom;', layerName: "Forets_OSM" },
    { label: "Fontaines", query: '[out:json][timeout:25];\nnode(48.85,2.34,48.86,2.35)[amenity=drinking_water];\nout body;', layerName: "Fontaines_OSM" },
    { label: "Sentiers", query: '[out:json][timeout:25];\narea[name="Bretagne"]->.a;\n(way[highway=footway](area.a);way[highway=path](area.a););\nout geom;', layerName: "Sentiers_OSM" },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // SERVICES TAB — Premium UI: Catalogue / Favoris / Outils / Custom
  // ─────────────────────────────────────────────────────────────────────────

  const renderServiceCard = (source: import("../lib/catalog").CatalogItem) => {
    const isFav = favoriteServiceIds.includes(source.id);
    const isLoading = addingServiceId === source.id;
    const typeBadge = SERVICE_TYPE_BADGE[source.serviceType] ?? "border-gray-500/30 bg-gray-500/10 text-gray-700";
    return (
      <div
        key={source.id}
        className="group relative flex flex-col rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.025] p-3 transition-all duration-200 hover:border-cyan-400/40 dark:hover:border-cyan-500/30 hover:shadow-md hover:shadow-cyan-500/10"
      >
        <div className="flex items-start gap-2 mb-2">
          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
            <span className={cn("rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider", typeBadge)}>
              {source.serviceType}
            </span>
            {source.reliable ? (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-green-700 dark:text-green-300" title="Source vérifiée fiable">
                <ShieldCheck size={9} />Fiable
              </span>
            ) : (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300" title="Beta — non testée">
                β Beta
              </span>
            )}
            {source.requiresKey && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300" title="Clé API requise">
                🔑
              </span>
            )}
          </div>
          <button
            onClick={() => toggleFavoriteService(source.id)}
            className={cn(
              "shrink-0 rounded-lg p-1 transition-all",
              isFav ? "text-amber-400" : "text-gray-300 dark:text-white/20 hover:text-amber-400",
            )}
            title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            <Star size={12} className={isFav ? "fill-current" : ""} />
          </button>
        </div>
        <p className="text-[12.5px] font-semibold text-gray-800 dark:text-gray-100 leading-tight mb-0.5 line-clamp-2">
          {source.name}
        </p>
        <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-white/35 mb-2">
          {source.provider}
        </p>
        {source.description ? (
          <p className="text-[11px] text-gray-600 dark:text-white/45 line-clamp-2 mb-2.5 flex-1">
            {source.description}
          </p>
        ) : (
          <div className="flex-1" />
        )}
        <button
          onClick={() => void handleAddServiceCard(source)}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/12 to-cyan-600/8 px-2 py-1.5 text-[11px] font-bold text-cyan-700 dark:text-cyan-300 transition-all hover:from-cyan-500/22 hover:to-cyan-600/15 hover:shadow-md hover:shadow-cyan-500/15 disabled:opacity-50 disabled:cursor-wait"
        >
          {isLoading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
          {isLoading ? "Chargement..." : "Ajouter à la carte"}
        </button>
      </div>
    );
  };

  const renderCatalogSubTab = () => {
    const totalVisible = filteredServiceSources.length;
    const totalAll = allServiceSourcesFlat.length;
    const reliableCount = allServiceSourcesFlat.filter(({ source }) => source.reliable).length;
    const filterChips: Array<{ id: ServiceTypeFilter; label: string }> = [
      { id: "all", label: "Tous" },
      { id: "WMS", label: "WMS" },
      { id: "WMTS", label: "WMTS" },
      { id: "WFS", label: "WFS" },
      { id: "XYZ", label: "XYZ" },
    ];
    return (
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30" size={14} />
          <input
            value={serviceQuery}
            onChange={(e) => setServiceQuery(e.target.value)}
            placeholder="Rechercher (nom, fournisseur, thème...)"
            className="w-full rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.03] py-2 pl-9 pr-9 text-[13px] text-gray-700 dark:text-gray-200 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-cyan-400/50 focus:bg-white dark:focus:bg-white/[0.05]"
          />
          {serviceQuery && (
            <button
              onClick={() => setServiceQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <Filter size={11} className="shrink-0 text-gray-400 dark:text-white/30" />
          {filterChips.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setServiceTypeFilter(id)}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all",
                serviceTypeFilter === id
                  ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
                  : "border-gray-200 dark:border-white/[0.08] bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-white/40 hover:border-cyan-400/30 hover:text-cyan-600 dark:hover:text-cyan-300",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
          <label className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-gray-600 dark:text-white/55">
            <input
              type="checkbox"
              checked={reliableOnly}
              onChange={(e) => setReliableOnly(e.target.checked)}
              className="h-3.5 w-3.5 accent-green-500"
            />
            <ShieldCheck size={12} className="text-green-500" />
            Sources fiables uniquement
          </label>
          <span className="text-[10px] tabular-nums text-gray-400 dark:text-white/30">
            {totalVisible} / {reliableOnly ? reliableCount : totalAll}
          </span>
        </div>

        {totalVisible === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.07] bg-gray-50/60 dark:bg-white/[0.01] p-6 text-center">
            <BookOpen size={22} className="mx-auto mb-2 text-gray-300 dark:text-white/20" />
            <p className="text-[12px] text-gray-400 dark:text-white/30">Aucun résultat</p>
            <p className="mt-1 text-[10px] text-gray-400 dark:text-white/25">
              Essaie de désactiver « Fiables uniquement » ou modifier ta recherche.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(filteredByCategory).map(([catKey, cat]) => {
              const meta = CATEGORY_META[catKey] ?? { icon: <Database size={13} />, tone: "text-gray-500", ring: "ring-gray-500/20" };
              const isCollapsed = collapsedCatalogCategories[catKey];
              return (
                <div key={catKey} className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/40 dark:bg-white/[0.015] overflow-hidden">
                  <button
                    onClick={() => toggleCatalogCategory(catKey)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left transition-all hover:bg-gray-100/50 dark:hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("flex h-6 w-6 items-center justify-center rounded-lg ring-1", meta.tone, meta.ring)}>
                        {meta.icon}
                      </span>
                      <div>
                        <p className="text-[11.5px] font-bold text-gray-700 dark:text-gray-200">{cat.name}</p>
                        <p className="text-[9px] text-gray-400 dark:text-white/30">{cat.sources.length} source{cat.sources.length > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <ChevronDown size={13} className={cn("text-gray-400 dark:text-white/30 transition-transform", isCollapsed ? "" : "rotate-180")} />
                  </button>
                  {!isCollapsed && (
                    <div className="grid grid-cols-2 gap-2 border-t border-gray-200 dark:border-white/[0.05] p-2">
                      {cat.sources.map((s) => renderServiceCard(s))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderFavoritesSubTab = () => {
    if (favoriteSources.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.07] bg-gray-50/60 dark:bg-white/[0.01] p-8 text-center">
          <Star size={26} className="mx-auto mb-3 text-gray-300 dark:text-white/20" />
          <p className="text-[13px] font-semibold text-gray-500 dark:text-white/40">Aucun favori</p>
          <p className="mt-1.5 text-[11px] text-gray-400 dark:text-white/30 leading-relaxed">
            Clique sur l'étoile d'une source<br />pour l'ajouter à tes favoris.
          </p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-2">
        {favoriteSources.map((s) => renderServiceCard(s))}
      </div>
    );
  };

  const renderCustomSubTab = () => (
    <div className="space-y-3">
      <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/8 to-cyan-600/4 p-3.5">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
            <Server size={15} />
          </div>
          <div>
            <p className="text-[12px] font-bold text-gray-800 dark:text-gray-100">Service personnalisé</p>
            <p className="mt-0.5 text-[10.5px] text-gray-500 dark:text-white/45 leading-relaxed">
              Connecte un serveur WMS, WMTS, WFS, WCS ou ArcGIS REST.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40">Nom *</span>
          <input
            value={serviceDraft.name}
            onChange={(e) => setServiceDraft((c) => ({ ...c, name: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-white/25 focus:border-cyan-400/50"
            placeholder="Ex : Mon serveur WMS"
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40">Type de service</span>
          <select
            value={serviceDraft.serviceType}
            onChange={(e) => setServiceDraft((c) => ({ ...c, serviceType: e.target.value as RemoteServiceType }))}
            className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200 outline-none focus:border-cyan-400/50"
          >
            {SUPPORTED_REMOTE_SERVICE_TYPES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40">URL *</span>
          <input
            value={serviceDraft.url}
            onChange={(e) => setServiceDraft((c) => ({ ...c, url: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-2 font-mono text-[12px] text-gray-700 dark:text-gray-200 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-white/25 focus:border-cyan-400/50"
            placeholder="https://..."
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40">Couche (optionnel)</span>
          <input
            value={serviceDraft.layerName}
            onChange={(e) => setServiceDraft((c) => ({ ...c, layerName: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-white/25 focus:border-cyan-400/50"
            placeholder="Ex : workspace:layer"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40">CRS</span>
            <input
              value={serviceDraft.crs}
              onChange={(e) => setServiceDraft((c) => ({ ...c, crs: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200 outline-none focus:border-cyan-400/50"
              placeholder="EPSG:3857"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40">Format</span>
            <input
              value={serviceDraft.format}
              onChange={(e) => setServiceDraft((c) => ({ ...c, format: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200 outline-none focus:border-cyan-400/50"
              placeholder="image/png"
            />
          </label>
        </div>

        <button
          onClick={() => void submitCustomService()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-gradient-to-r from-cyan-500/15 to-cyan-600/10 px-3 py-2.5 text-[13px] font-bold text-cyan-700 dark:text-cyan-300 transition-all hover:from-cyan-500/25 hover:to-cyan-600/18 hover:shadow-lg hover:shadow-cyan-500/15"
        >
          <Link2 size={14} />
          Ajouter le service
        </button>
      </div>
    </div>
  );

  const renderServicesTab = () => {
    const subTabs: Array<{ id: ServicesSubTab; label: string; icon: ReactNode; badge?: number }> = [
      { id: "catalog", label: "Catalogue", icon: <BookOpen size={12} /> },
      { id: "favorites", label: "Favoris", icon: <Star size={12} />, badge: favoriteServiceIds.length },
      { id: "tools", label: "Outils", icon: <Wrench size={12} /> },
      { id: "custom", label: "Custom", icon: <Server size={12} /> },
    ];
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-1 rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.02] p-1">
          {subTabs.map(({ id, label, icon, badge }) => (
            <button
              key={id}
              onClick={() => setServicesSubTab(id)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-bold transition-all",
                servicesSubTab === id
                  ? "bg-white dark:bg-white/[0.08] text-cyan-600 dark:text-cyan-300 shadow-sm"
                  : "text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60",
              )}
            >
              <span className="flex items-center gap-1">
                {icon}
                {label}
              </span>
              {badge != null && badge > 0 && (
                <span className={cn(
                  "absolute -top-1 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[8px] font-bold tabular-nums",
                  servicesSubTab === id ? "bg-cyan-500 text-white" : "bg-gray-300 dark:bg-white/15 text-gray-600 dark:text-white/60",
                )}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {servicesSubTab === "catalog" && renderCatalogSubTab()}
        {servicesSubTab === "favorites" && renderFavoritesSubTab()}
        {servicesSubTab === "tools" && renderToolsSubTab()}
        {servicesSubTab === "custom" && renderCustomSubTab()}
      </div>
    );
  };

  const renderToolsSubTab = () => (
    <div className="space-y-4">
      {/* ── Inventaire forestier ── */}
      <CollapsibleSection
        title="Inventaire forestier"
        description="Créez une grille d'inventaire et ses centroïdes pour des relevés terrain"
        accentClassName="text-emerald-600 dark:text-emerald-300/80"
        icon={<Crosshair size={14} />}
        isOpen={expandedSections["inventory"] ?? false}
        onToggle={() => toggleSection("inventory")}
      >
        {polygonLayers.length === 0 ? (
          <p className="text-xs text-gray-700 dark:text-gray-300/40">Chargez d'abord une couche polygonale (ex: parcelles, forêt).</p>
        ) : (
          <div className="space-y-3">
            <p className="text-[10px] text-gray-700 dark:text-gray-300/35">Générez une grille régulière et ses centroïdes pour des relevés de terrain forestier</p>
            <select value={inventoryLayerId} onChange={(e) => { const id = e.target.value; setInventoryLayerId(id); const l = polygonLayers.find((x) => x.id === id); if (l) { const s = l.name.replace(/\s+/g, "_"); setInventoryGridName(`${s}_grille`); setInventoryCentroidsName(`${s}_centroides`); } }} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-emerald-500/40">
              {polygonLayers.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input value={inventoryCellWidth} onChange={(e) => setInventoryCellWidth(e.target.value)} className="rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-emerald-500/40" placeholder="Largeur (m)" />
              <input value={inventoryCellHeight} onChange={(e) => setInventoryCellHeight(e.target.value)} className="rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-emerald-500/40" placeholder="Hauteur (m)" />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300/65"><input type="checkbox" checked={inventoryClipToSource} onChange={(e) => setInventoryClipToSource(e.target.checked)} className="h-3.5 w-3.5 accent-emerald-400" /> Découper à l'emprise de la couche</label>
            <button onClick={() => void submitInventoryGrid()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/12 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-emerald-500/18"><Crosshair size={15} /> Créer grille + centroïdes</button>
          </div>
        )}
      </CollapsibleSection>

      {/* ── Cadastre ── */}
      <SidebarSection
        title="Cadastre"
        description="Chargez les parcelles cadastrales d'une commune."
        accentClassName="text-emerald-600 dark:text-emerald-300/80"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-700 dark:text-gray-300/30" size={14} />
            <input
              value={communeSearchName}
              onChange={(e) => setCommuneSearchName(e.target.value)}
              placeholder="Nom de commune (ex: Rennes, Paris...)"
              className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 py-2.5 pl-9 pr-3 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/28 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
            />
            {communeSearchName && (
              <button
                onClick={() => setCommuneSearchName("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-700 dark:text-gray-300/30 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <CheckCircle2 size={14} />
              </button>
            )}
          </div>
          
          {/* Action Cards */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void submitCommuneSearch()}
              className="group relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-emerald-500/12 px-3 py-3 text-left transition-all hover:bg-emerald-500/18 hover:shadow-lg hover:shadow-emerald-500/10"
            >
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-emerald-500/20 via-transparent to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <div className="relative flex flex-col items-center gap-1.5">
                <Map size={20} className="text-emerald-600 dark:text-emerald-300" />
                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Contours</span>
                <span className="text-[9px] text-gray-700 dark:text-gray-300/50">Limites communales</span>
              </div>
            </button>
            <button
              onClick={() => void submitCadastreSearch()}
              className="group relative overflow-hidden rounded-2xl border border-orange-500/25 bg-orange-500/12 px-3 py-3 text-left transition-all hover:bg-orange-500/18 hover:shadow-lg hover:shadow-orange-500/10"
            >
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-orange-500/20 via-transparent to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <div className="relative flex flex-col items-center gap-1.5">
                <MapPin size={20} className="text-orange-500 dark:text-orange-300" />
                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Parcelles</span>
                <span className="text-[9px] text-gray-700 dark:text-gray-300/50">Cadastre complet</span>
              </div>
            </button>
          </div>

          {/* Info Tip */}
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-2.5">
            <Info size={12} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
            <p className="text-[10px] text-gray-700 dark:text-gray-300/50 leading-relaxed">
              Les parcelles seront chargées avec le style par défaut et la carte sera centrée dessus automatiquement.
            </p>
          </div>
        </div>
      </SidebarSection>

      {/* ── Images satellites ── */}
      <CollapsibleSection
        title="Images satellites"
        description="Cherchez des images Sentinel-2 (Copernicus) ou Landsat (NASA)"
        accentClassName="text-sky-600 dark:text-sky-300/80"
        icon={<Globe size={14} />}
        isOpen={expandedSections["satellite"] ?? false}
        onToggle={() => toggleSection("satellite")}
      >
        <div className="space-y-4">
          {/* Copernicus */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300/70">Copernicus Sentinel-2</p>
            <p className="text-[10px] text-gray-700 dark:text-gray-300/35">Images haute résolution (10m) pour l'Europe et le monde</p>
            {/* Collection masquée — valeur par défaut SENTINEL-2 */}
            <input value={copernicusNameContains} onChange={(e) => setCopernicusNameContains(e.target.value)} className="w-full rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-gray-100/80 dark:bg-white/[0.03] px-3 py-2 text-[12px] text-gray-700 dark:text-white/70 outline-none placeholder:text-gray-400 dark:placeholder:text-white/25 focus:border-sky-500/40 transition-colors" placeholder="Filtrer par nom (optionnel)" />
            <button onClick={() => void submitCopernicusSearch()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/25 bg-sky-500/12 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-sky-500/18"><Search size={15} /> Chercher Sentinel-2</button>
            {copernicusResults.length > 0 && (
              <div className="space-y-2">{copernicusResults.map((item) => (<div key={item.id} className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-xs text-gray-700 dark:text-gray-300/55"><p className="truncate font-medium text-gray-700 dark:text-gray-300">{item.name || item.id}</p><p className="text-gray-700 dark:text-gray-300/35">{item.online ? "En ligne" : "Hors ligne"} · {item.publicationDate || "n/a"}</p></div>))}</div>
            )}
          </div>

          {/* NASA */}
          <div className="border-t border-gray-300 dark:border-gray-700 pt-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300/70">NASA Landsat</p>
            <p className="text-[10px] text-gray-700 dark:text-gray-300/35">Images Landsat 8/9 pour le monde entier</p>
            {/* Bouton emprise — remplace la saisie BBOX manuelle */}
            <button
              onClick={async () => {
                setNasaBboxLoading(true);
                try {
                  const res = await fetch("http://localhost:8157/api/qgis/projectExtent");
                  if (res.ok) {
                    const data = await res.json() as { bbox?: string };
                    if (data.bbox) { setNasaBbox(data.bbox); toast.success("Emprise récupérée"); }
                    else toast.warning("Pas de projet QGIS ouvert");
                  }
                } catch { toast.error("Erreur réseau"); }
                finally { setNasaBboxLoading(false); }
              }}
              disabled={nasaBboxLoading}
              className={cn(
                "flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 text-[12px] font-semibold transition-all disabled:opacity-50",
                nasaBbox
                  ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-400"
                  : "border-indigo-500/35 bg-gradient-to-r from-indigo-600/15 to-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:from-indigo-600/22"
              )}
            >
              {nasaBboxLoading ? <><Loader2 size={11} className="animate-spin" />Récupération…</> : nasaBbox ? <><CheckCircle2 size={11} />Emprise définie ✓</> : <><MapPin size={11} />Utiliser l'emprise du projet</>}
            </button>
            <button onClick={() => void submitNasaSearch()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-500/25 bg-indigo-500/12 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-indigo-500/18"><Search size={15} /> Chercher Landsat</button>
            {nasaResults.length > 0 && (
              <div className="space-y-2">{nasaResults.map((item) => (<div key={item.id} className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-xs text-gray-700 dark:text-gray-300/55"><p className="truncate font-medium text-gray-700 dark:text-gray-300">{item.id}</p><p className="text-gray-700 dark:text-gray-300/35">{item.datetime || "n/a"}</p></div>))}</div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Calculs raster ── */}
      <CollapsibleSection
        title="Calculs raster"
        description="Fusionnez des images, calculez des indices (NDVI), créez des MNH"
        accentClassName="text-rose-600 dark:text-rose-300/80"
        icon={<WandSparkles size={14} />}
        isOpen={expandedSections["raster-tools"] ?? false}
        onToggle={() => toggleSection("raster-tools")}
      >
        <div className="space-y-4">
          {rasterLayers.length === 0 ? (
            <p className="text-xs text-gray-700 dark:text-gray-300/40">Chargez d'abord des rasters pour activer les outils.</p>
          ) : (
            <>
              {/* Fusion multi-bandes */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-300/70">Fusion multi-bandes</p>
                <p className="text-[10px] text-gray-700 dark:text-gray-300/35">Combinez plusieurs rasters en une seule image multi-bandes (ex: NDVI bi-annuel)</p>
                {rasterLayers.map((layer) => { const checked = mergeLayerIds.includes(layer.id); return (
                  <label key={layer.id} className={cn("flex items-center justify-between rounded-2xl border px-3 py-2 text-sm transition-all", checked ? "border-rose-500/30 bg-rose-500/12 text-gray-700 dark:text-gray-300" : "border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300/65")}>
                    <span className="min-w-0 truncate">{checked ? `B${mergeLayerIds.indexOf(layer.id) + 1}` : "•"} {layer.name}</span>
                    <input type="checkbox" checked={checked} onChange={(e) => setMergeLayerIds((c) => e.target.checked ? [...c, layer.id] : c.filter((x) => x !== layer.id))} className="h-4 w-4 accent-rose-400" />
                  </label>
                ); })}
                <input value={mergeOutputName} onChange={(e) => setMergeOutputName(e.target.value)} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-rose-500/40" placeholder="Nom de sortie" />
                <button onClick={() => void submitRasterMerge()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/12 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-rose-500/18"><Layers3 size={14} /> Fusionner</button>
              </div>

              {/* Calcul raster */}
              <div className="space-y-2 border-t border-gray-300 dark:border-gray-700 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-300/70">Calculateur raster</p>
                <p className="text-[10px] text-gray-700 dark:text-gray-300/35">Appliquez des formules mathématiques (ex: NDVI = (NIR - Red) / (NIR + Red))</p>
                {rasterLayers.map((layer) => { const checked = formulaLayerIds.includes(layer.id); const alias = checked ? String.fromCharCode(65 + formulaLayerIds.indexOf(layer.id)) : "•"; return (
                  <label key={layer.id} className={cn("flex items-center justify-between rounded-2xl border px-3 py-2 text-sm transition-all", checked ? "border-fuchsia-500/30 bg-fuchsia-500/12 text-gray-700 dark:text-gray-300" : "border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300/65")}>
                    <span className="min-w-0 truncate">{alias} {layer.name}</span>
                    <input type="checkbox" checked={checked} onChange={(e) => { setFormulaLayerIds((c) => { if (e.target.checked) { if (c.length >= 6) { toast.error("Max 6 rasters."); return c; } return [...c, layer.id]; } return c.filter((x) => x !== layer.id); }); }} className="h-4 w-4 accent-fuchsia-400" />
                  </label>
                ); })}
                <input value={rasterFormula} onChange={(e) => setRasterFormula(e.target.value)} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 font-mono text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-fuchsia-500/40" placeholder="(A-B)*(A>B)" />
                <input value={rasterFormulaOutputName} onChange={(e) => setRasterFormulaOutputName(e.target.value)} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-fuchsia-500/40" placeholder="Nom de sortie" />
                <button onClick={() => void submitRasterFormula()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/12 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-fuchsia-500/18"><Sparkles size={14} /> Calculer</button>
              </div>

              {/* MNH */}
              {rasterLayers.length >= 2 && (
                <div className="space-y-2 border-t border-gray-300 dark:border-gray-700 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300/70">MNH (MNS − MNT)</p>
                  <p className="text-[10px] text-gray-700 dark:text-gray-300/35">Modèle Numérique de Hauteur = Modèle Numérique de Surface - Modèle Numérique de Terrain</p>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={mnsLayerId} onChange={(e) => setMnsLayerId(e.target.value)} className="rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-violet-500/40">
                      {rasterLayers.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
                    </select>
                    <select value={mntLayerId} onChange={(e) => setMntLayerId(e.target.value)} className="rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-violet-500/40">
                      {rasterLayers.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
                    </select>
                  </div>
                  <input value={mnhOutputName} onChange={(e) => setMnhOutputName(e.target.value)} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-violet-500/40" placeholder="MNH" />
                  <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300/65"><input type="checkbox" checked={clampNegativeMnh} onChange={(e) => setClampNegativeMnh(e.target.checked)} className="h-3.5 w-3.5 accent-violet-400" /> Tronquer négatifs à 0</label>
                  <button onClick={() => void submitMnh()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-500/25 bg-violet-500/12 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-violet-500/18"><WandSparkles size={14} /> Calculer MNH</button>
                </div>
              )}
            </>
          )}
        </div>
      </CollapsibleSection>

      {/* ── OpenStreetMap ── */}
      <CollapsibleSection
        title="OpenStreetMap"
        description="Extrayez des données OSM (bâtiments, routes, eau...) avec Overpass"
        accentClassName="text-orange-600 dark:text-orange-300/80"
        icon={<Link2 size={14} />}
        isOpen={expandedSections["overpass"] ?? false}
        onToggle={() => toggleSection("overpass")}
      >
        <div className="space-y-3">
          <p className="text-[10px] text-gray-700 dark:text-gray-300/35">Overpass QL est un langage de requête pour extraire des données OpenStreetMap</p>
          <div>
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Templates rapides</p>
            <div className="flex flex-wrap gap-1">
              {OVERPASS_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => { setOverpassQuery(tpl.query); setOverpassLayerName(tpl.layerName); }}
                  className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:text-orange-300 transition-all hover:bg-orange-500/20"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>
          {/* Nom de couche — auto-rempli par les templates */}
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02] px-3 py-2">
            <span className="text-[10px] text-gray-400 dark:text-white/30 shrink-0">Couche :</span>
            <input
              value={overpassLayerName}
              onChange={(e) => setOverpassLayerName(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-[12px] text-gray-700 dark:text-white/70 outline-none placeholder:text-gray-400 dark:placeholder:text-white/25"
              placeholder="Nom de la couche"
            />
          </div>

          {/* Mode avancé — toggle */}
          <button
            onClick={() => setOverpassAdvanced((v) => !v)}
            className="flex items-center gap-1.5 self-start text-[10px] text-orange-600 dark:text-orange-400/70 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
          >
            <ChevronDown size={11} className={cn("transition-transform", overpassAdvanced && "rotate-180")} />
            {overpassAdvanced ? "Masquer la requête" : "Mode avancé (éditer la requête)"}
          </button>

          {overpassAdvanced && (
            <div className="flex flex-col gap-2">
              <select value={overpassEndpoint} onChange={(e) => setOverpassEndpoint(e.target.value)} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-orange-500/40">
                {OVERPASS_ENDPOINTS.map((ep) => (<option key={ep} value={ep}>{ep}</option>))}
              </select>
              <textarea
                value={overpassQuery}
                onChange={(e) => setOverpassQuery(e.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-orange-500/40"
              />
            </div>
          )}
          <button onClick={() => void submitOverpassSearch()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-500/25 bg-orange-500/12 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-orange-500/18"><Plus size={15} /> Extraire données OSM</button>
        </div>
      </CollapsibleSection>

      {/* ── Fichiers locaux ── */}
      <CollapsibleSection
        title="Fichiers locaux"
        description="Chargez des fichiers GeoTIFF ou autres rasters depuis votre ordinateur"
        accentClassName="text-amber-600 dark:text-amber-300/80"
        icon={<Layers3 size={14} />}
        isOpen={expandedSections["raster"] ?? false}
        onToggle={() => toggleSection("raster")}
      >
        <div className="space-y-3">
          <p className="text-[10px] text-gray-700 dark:text-gray-300/35">Chargez des images raster (GeoTIFF, PNG, JPG...) pour analyse</p>
          <div className="flex gap-2">
            <input value={rasterPath} onChange={(e) => setRasterPath(e.target.value)} className="min-w-0 flex-1 rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-amber-500/40" placeholder="Chemin du fichier (ex: C:\donnees\mnt.tif)" />
            {onPickRasterFile && <button onClick={() => void openRasterPicker()} className="shrink-0 rounded-2xl border border-gray-300 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300/75 transition-all hover:text-white">Parcourir</button>}
          </div>
          <input value={rasterName} onChange={(e) => setRasterName(e.target.value)} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-amber-500/40" placeholder="Nom dans QGIS" />
          <button onClick={() => void submitRasterFile()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/12 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-amber-500/18"><Plus size={15} /> Charger le fichier</button>
        </div>
      </CollapsibleSection>

      {/* ── Projection du projet ── */}
      <SidebarSection
        title="Projection du projet"
        description="Changez le CRS du projet QGIS."
        accentClassName="text-violet-600 dark:text-violet-300/80"
      >
        <div className="space-y-3">
          <select
            value={selectedCrs}
            onChange={(e) => setSelectedCrs(e.target.value)}
            className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-violet-500/40"
          >
            {COMMON_CRS.map((crs) => (
              <option key={crs.code} value={crs.code}>
                {crs.code} — {crs.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => void handleSetProjectCrs()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-500/25 bg-violet-500/12 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-violet-500/18"
          >
            <Globe size={15} />
            Appliquer la projection
          </button>
        </div>
      </SidebarSection>

      {/* ── Performance ── */}
      <CollapsibleSection
        title="Performance"
        description="Temps de réponse LLM et QGIS"
        accentClassName="text-amber-600 dark:text-amber-300/80"
        icon={<WandSparkles size={14} />}
        isOpen={expandedSections["performance"] ?? false}
        onToggle={() => toggleSection("performance")}
      >
        <PerformancePanel />
      </CollapsibleSection>
    </div>
  );

  // ── Onglet Outils (panneaux Devin) — scroll unique ────────────────────────
  // IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI) — Superviseur : Claude Code 4.8 — 2026-06-08
  // Redesign UX 2026-06-08 : scroll unique, layers passées en prop pour selects auto
  function renderToolsTab() {
    const layerOptions = layers.map((l) => ({ id: l.id, name: l.name, type: l.type }));
    return (
      <div className="flex flex-col gap-4">
        {/* Label section Données */}
        <div className="flex items-center gap-2">
          <Globe size={13} className="text-cyan-500 dark:text-cyan-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-400">Sources de données</span>
        </div>
        <Suspense fallback={<div className="flex items-center justify-center h-24 text-xs text-gray-400 dark:text-white/30 gap-2"><Loader2 size={14} className="animate-spin" />Chargement…</div>}>
          <DataPanel
            onSourceLoaded={(sourceId) => {
              void onRefreshLayers();
              if (onSendMessage) onSendMessage(`La source "${sourceId}" vient d'être chargée. Analyse les nouvelles couches et propose une étude adaptée.`);
            }}
          />
        </Suspense>

        {/* Séparateur */}
        <div className="h-px bg-gray-200 dark:bg-white/[0.06]" />

        {/* Label section Analyse */}
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-emerald-500 dark:text-emerald-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">Analyse satellite</span>
        </div>
        <Suspense fallback={<div className="flex items-center justify-center h-24 text-xs text-gray-400 dark:text-white/30 gap-2"><Loader2 size={14} className="animate-spin" />Chargement…</div>}>
          <DiagnosticPanel
            layers={layerOptions}
            onResult={(type, detail) => {
              if (onSendMessage) onSendMessage(`Calcul ${type.toUpperCase()} terminé sur "${detail}". Analyse le résultat et propose une interprétation cartographique.`);
            }}
          />
        </Suspense>

        {/* Séparateur */}
        <div className="h-px bg-gray-200 dark:bg-white/[0.06]" />

        {/* Label section Dossiers */}
        <div className="flex items-center gap-2">
          <FolderOpen size={13} className="text-amber-500 dark:text-amber-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">Dossiers territoriaux</span>
        </div>
        <Suspense fallback={<div className="flex items-center justify-center h-24 text-xs text-gray-400 dark:text-white/30 gap-2"><Loader2 size={14} className="animate-spin" />Chargement…</div>}>
          <DossierPanel
            onDossierRun={(dossierId, result) => {
              void onRefreshLayers();
              if (onSendMessage) {
                const layerNames = result.layers?.join(", ") || "couches chargées";
                onSendMessage(`Dossier "${dossierId}" déroulé : ${result.steps_done ?? "?"}/${result.total ?? "?"} étapes. Couches : ${layerNames}. Lance une analyse territoriale.`);
              }
            }}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <motion.div
      className="relative flex h-full shrink-0 flex-col border-r border-gray-200 dark:border-white/[0.05] sidebar-bg backdrop-blur-2xl shadow-[2px_0_32px_rgba(0,0,0,0.18)] overflow-hidden"
      animate={{ width: isOpen ? "22rem" : "0rem" }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      style={{ minWidth: 0 }}
    >

      <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/[0.05] bg-gradient-to-r from-transparent via-transparent to-transparent px-4 py-4">
        <div>
            <p className="text-[9px] font-black uppercase tracking-[0.35em] bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              QGISAI+
            </p>
            <h2 className="mt-0.5 text-[13px] font-bold text-gray-100">
              Workspace QGIS
            </h2>
          </div>
      </div>

      <div className={"flex gap-1.5 px-3 py-2.5"}>
        {[
          { id: "history" as SidebarTab, label: "Historique", Icon: MessageSquare, badge: conversations.length,
            accent: "blue" },
          { id: "layers" as SidebarTab, label: "Couches", Icon: Database, badge: layers.length,
            accent: "emerald" },
          { id: "services" as SidebarTab, label: "Services", Icon: Network, badge: null,
            accent: "cyan" },
          { id: "tools" as SidebarTab, label: "Outils", Icon: Wrench, badge: null,
            accent: "violet" },
        ].map(({ id, label, Icon, badge, accent }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "relative flex items-center gap-2 rounded-2xl border px-3 py-2 text-[12px] font-semibold transition-all duration-200",
              "flex-1",
              activeTab === id
                ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300 shadow-sm"
                : "border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.03] text-gray-500 dark:text-white/35 hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:text-gray-700 dark:hover:text-white/60",
            )}
            title={label}
          >
            <Icon size={14} />
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.span
                  key="label"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {isOpen && badge !== null && badge > 0 && (
                <motion.span
                  key="badge"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className={cn(
                    "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                    activeTab === id ? "bg-white/20" : "bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-white/40"
                  )}
                >
                  {badge}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        ))}
      </div>

      <div className={"px-3 pb-2"}>
        {activeTab === "history" ? (
          <button
            onClick={() => void onCreateConversation()}
            className={cn(
              "group relative flex items-center justify-center rounded-2xl border transition-all duration-200 overflow-hidden",
              "border-blue-500/35 bg-gradient-to-r from-blue-600/15 to-blue-500/10 text-blue-600 dark:text-blue-300 hover:from-blue-600/25 hover:to-blue-500/18 hover:shadow-lg hover:shadow-blue-500/20",
              "w-full gap-2 px-4 py-2.5 text-[13px] font-bold",
            )}
          >
            <Plus size={15} />
            {isOpen && "Nouvelle discussion"}
          </button>
        ) : activeTab === "layers" ? (
          <button
            onClick={() => void onRefreshLayers()}
            className={cn(
              "flex items-center justify-center rounded-2xl border transition-all duration-200",
              "border-emerald-500/35 bg-gradient-to-r from-emerald-600/15 to-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:from-emerald-600/25 hover:to-emerald-500/18 hover:shadow-lg hover:shadow-emerald-500/20",
              !isOpen ? "h-12 w-full" : "w-full gap-2 px-4 py-2.5 text-[13px] font-bold",
            )}
          >
            <RefreshCw size={isOpen ? 15 : 20} className={cn(isRefreshingLayers && "animate-spin")} />
            {isOpen && "Rafraîchir les couches"}
          </button>
        ) : activeTab === "services" ? (
          <div
            className={cn(
              "flex items-center justify-center rounded-2xl border",
              "border-cyan-500/30 bg-gradient-to-r from-cyan-600/12 to-cyan-500/8 text-cyan-600 dark:text-cyan-300",
              !isOpen ? "h-12 w-full" : "w-full gap-2 px-4 py-2.5 text-[13px] font-bold",
            )}
          >
            <Link2 size={isOpen ? 15 : 20} />
            {isOpen && "Sources connectées"}
          </div>
        ) : (
          <div
            className={cn(
              "flex items-center justify-center rounded-2xl border",
              "border-violet-500/30 bg-gradient-to-r from-violet-600/12 to-violet-500/8 text-violet-600 dark:text-violet-300",
              !isOpen ? "h-12 w-full" : "w-full gap-2 px-4 py-2.5 text-[13px] font-bold",
            )}
          >
            <Wrench size={isOpen ? 15 : 20} />
            {isOpen && "Données · Diagnostic · Dossiers"}
          </div>
        )}
      </div>

      {!isOpen ? (
        <div className="mt-4 flex flex-1 flex-col items-center gap-3 px-3">
          {activeTab === "history"
            ? conversations.slice(0, 6).map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  className={cn(
                    "h-16 w-16 rounded-2xl border transition-all relative overflow-hidden",
                    conversation.id === activeConversationId
                      ? "border-blue-500/40 bg-blue-500/18 text-gray-700 dark:text-gray-300 shadow-lg shadow-blue-500/20"
                      : "border-gray-300 dark:border-gray-800 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300/60 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-white hover:scale-105",
                  )}
                  title={conversation.title}
                >
                  <MessageSquare size={24} className="text-gray-700 dark:text-gray-300/80" />
                </button>
              ))
            : activeTab === "layers"
              ? layers.slice(0, 6).map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => onToggleLayerSelection(layer.id)}
                    className={cn(
                      "h-16 w-16 rounded-2xl border transition-all relative overflow-hidden",
                      selectedLayerIds.includes(layer.id)
                        ? "border-emerald-500/40 bg-emerald-500/18 text-gray-700 dark:text-gray-300 shadow-lg shadow-emerald-500/20"
                        : "border-gray-300 dark:border-gray-800 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300/60 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-white hover:scale-105",
                    )}
                    title={layer.name}
                  >
                    <Database size={24} className="text-gray-700 dark:text-gray-300/80" />
                  </button>
                ))
              : SUPPORTED_REMOTE_SERVICE_TYPES.slice(0, 6).map((service) => (
                  <div
                    key={service.id}
                    className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-gray-700 dark:text-gray-300 shadow-lg shadow-cyan-500/10"
                    title={service.description}
                  >
                    <Network size={24} className="text-gray-700 dark:text-gray-300/80" />
                  </div>
                ))}
        </div>
      ) : (
        <div className="sidebar-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
          {activeTab === "history"
            ? renderHistoryTab()
            : activeTab === "layers"
              ? renderLayersTab()
              : activeTab === "services"
                ? renderServicesTab()
                : renderToolsTab()}
        </div>
      )}
    </motion.div>
  );
}
