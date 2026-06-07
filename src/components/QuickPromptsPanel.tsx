import { useMemo, useState } from "react";
import { Layers, Globe, BarChart3, FileText, Search, Zap, Flame, Mountain } from "lucide-react";
import { QUICK_PROMPTS, type QuickPrompt } from "../lib/quick-prompts";

interface QuickPromptsPanelProps {
  onSelectPrompt: (prompt: string) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Layers: <Layers size={16} />,
  Globe: <Globe size={16} />,
  BarChart3: <BarChart3 size={16} />,
  FileText: <FileText size={16} />,
  Search: <Search size={16} />,
  Zap: <Zap size={16} />,
  Flame: <Flame size={16} />,
  Mountain: <Mountain size={16} />,
};

type Category = QuickPrompt["category"];

const CATEGORY_META: { id: Category; label: string }[] = [
  { id: "data", label: "Données" },
  { id: "analysis", label: "Analyse" },
  { id: "visualization", label: "Visualisation" },
  { id: "export", label: "Export & livrables" },
  { id: "general", label: "Général" },
];

function categoryColor(category: Category): string {
  switch (category) {
    case "analysis":
      return "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40";
    case "data":
      return "from-cyan-500/10 to-cyan-500/5 border-cyan-500/20 hover:border-cyan-500/40";
    case "visualization":
      return "from-indigo-500/10 to-indigo-500/5 border-indigo-500/20 hover:border-indigo-500/40";
    case "export":
      return "from-green-500/10 to-green-500/5 border-green-500/20 hover:border-green-500/40";
    default:
      return "from-teal-500/10 to-teal-500/5 border-teal-500/20 hover:border-teal-500/40";
  }
}

export default function QuickPromptsPanel({ onSelectPrompt }: QuickPromptsPanelProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return QUICK_PROMPTS;
    return QUICK_PROMPTS.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.prompt.toLowerCase().includes(q),
    );
  }, [query]);

  const groups = useMemo(
    () =>
      CATEGORY_META.map((cat) => ({
        ...cat,
        items: filtered.filter((p) => p.category === cat.id),
      })).filter((g) => g.items.length > 0),
    [filtered],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-white/55">
          Actions GeoIA
        </p>
        <span className="text-[10px] text-gray-400 dark:text-white/40">
          {filtered.length} / {QUICK_PROMPTS.length}
        </span>
      </div>

      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/40"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une action (NDVI, atlas, dossier…)"
          className="w-full rounded-xl border border-gray-200 bg-white/60 py-1.5 pl-8 pr-2 text-xs text-gray-800 placeholder:text-gray-400 outline-none transition focus:border-emerald-500/50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/35"
        />
      </div>

      {groups.length === 0 && (
        <p className="py-6 text-center text-xs text-gray-400 dark:text-white/40">
          Aucune action ne correspond à « {query} ».
        </p>
      )}

      {groups.map((group) => (
        <div key={group.id} className="space-y-2">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-white/40">
            {group.label}
            <span className="rounded-full bg-gray-200/60 px-1.5 text-[9px] text-gray-500 dark:bg-white/10 dark:text-white/45">
              {group.items.length}
            </span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {group.items.map((prompt) => (
              <button
                key={prompt.id}
                onClick={() => onSelectPrompt(prompt.prompt)}
                title={prompt.description}
                className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-3 text-left transition-all hover:scale-[1.02] ${categoryColor(prompt.category)}`}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-gray-400 transition-colors group-hover:text-gray-700 dark:text-white/60 dark:group-hover:text-white/90">
                    {ICON_MAP[prompt.iconName] || <Zap size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-gray-800 dark:text-white">{prompt.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[10px] text-gray-500 dark:text-white/45">{prompt.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
