/**
 * Système d'intelligence de prompt utilisant un modèle local ultra-léger
 * pour analyser la demande utilisateur et la décomposer en plan d'action
 * 
 * ROBUSTESSE: Gère les fautes, abréviations, formulations floues
 */

import { detectOllama, getOllamaModels } from "./ollama-auto-detect";
import { AppSettings } from "./settings";
import { toast } from "sonner";

// ===== CORRECTION ORTHOGRAPHIQUE ET EXPANSION =====

const COMMON_MISSPELLINGS: Record<string, string> = {
  // Fautes courantes
  "kadastre": "cadastre", "cadast": "cadastre", "cadasstre": "cadastre",
  "parcele": "parcelle", "parcel": "parcelle", "parselle": "parcelle",
  "comune": "commune", "commun": "commune", "conmune": "commune",
  "couche": "couche", "couch": "couche", "kouche": "couche",
  "baffer": "buffer", "bufeur": "buffer", "buffe": "buffer",
  "interection": "intersection", "intesection": "intersection",
  "dissoudre": "dissolve", "disolve": "dissolve", "dissol": "dissolve",
  "zoomer": "zoom", "zom": "zoom", "zoum": "zoom",
  "exporte": "export", "exporter": "export", "expot": "export",
  "charg": "charger", "charge": "charger",
  "affiche": "afficher", "afiche": "afficher",
  "calcule": "calculer", "calcul": "calculer",
  "crée": "créer", "cree": "créer", "creer": "créer",
  "ajoute": "ajouter", "ajoue": "ajouter",
  "suprime": "supprimer", "supprime": "supprimer",
  "renome": "renommer", "renomme": "renommer",
  "mesure": "mesurer", "mesur": "mesurer",
  "selectione": "sélectionner", "selectionne": "sélectionner",
  "filtre": "filtrer", "filtr": "filtrer",
  "style": "style", "styl": "style",
  "symbole": "symbologie", "simbol": "symbologie",
  "etiquet": "étiquette", "etiquette": "étiquette",
  "legend": "légende", "legende": "légende",
  "cart": "carte", "kart": "carte",
  "fore": "forêt", "foret": "forêt", "boi": "bois",
  "placet": "placette", "place": "placette",
  "esen": "essence", "esence": "essence", "essens": "essence",
  "chene": "chêne", "chène": "chêne",
  "sapin": "sapin", "sapain": "sapin",
  "pin": "pin", "pine": "pin",
  "hectar": "hectare", "ectare": "hectare", "ha": "ha",
  "metre": "mètre", "metr": "mètre", "m": "m",
  "kilometre": "kilomètre", "km": "km",
  "surface": "surface", "surfac": "surface",
  "perimetre": "périmètre", "perimètre": "périmètre",
  "aire": "aire", "air": "aire",
  "geojson": "geojson", "geojsn": "geojson", "geo jon": "geojson",
  "shapefile": "shapefile", "shp": "shp", "shep": "shapefile",
  "geopackage": "geopackage", "gpkg": "gpkg",
  "dxf": "dxf", "déf": "dxf",
  "inventair": "inventaire", "inventer": "inventaire",
  "ifn": "ifn", "nfi": "ifn",
  "analyse": "analyse", "analise": "analyse",
  "stat": "statistique", "statistiks": "statistique",
  "moyen": "moyenne", "moyenn": "moyenne",
  "som": "somme", "somm": "somme",
  "total": "total", "totale": "total",
  "médian": "médiane", 
  "ecart": "écart", "varian": "variance",
  "corélation": "corrélation",
  "clusteur": "cluster",
  "proxi": "proximité", "proximiter": "proximité",
  "distans": "distance", "distan": "distance",
  "converti": "convertir", "conver": "convertir",
  "projec": "projection", "projete": "projection",
  "repro": "reprojection",
  "pyton": "python", "pithon": "python",
  "scipt": "script",
  "cod": "code",
  "ereur": "erreur",
  "problem": "problème", "probleme": "problème",
  "plante": "plantage",
  "aid": "aide",
  "explain": "expliquer",
  "comen": "comment",
  "pourkoi": "pourquoi",
  "ke": "que", "koi": "quoi",
  "sa va": "çava",
};

const ABBREVIATION_EXPANSIONS: Record<string, string> = {
  // Abréviations techniques
  "sig": "SIG système d'information géographique",
  "qgis": "QGIS",
  "py": "python",
  "pyqgis": "PyQGIS",
  "epsg": "EPSG système de coordonnées",
  "crs": "CRS système de coordonnées de référence",
  "wgs": "WGS84",
  "l93": "Lambert 93",
  "rgf": "RGF93",
  "mnt": "MNT modèle numérique de terrain",
  "mns": "MNS modèle numérique de surface",
  "mnh": "MNH modèle numérique de hauteur",
  "ndvi": "NDVI indice de végétation",
  "ifn": "IFN inventaire forestier national",
  "shp": "shapefile",
  "gpkg": "geopackage",
  "geo": "géographique",
  "geom": "géométrie",
  "attr": "attribut",
  "champ": "champ",
  "tab": "table",
  "dist": "distance",
  "surf": "surface",
  "perim": "périmètre",
  "long": "longueur",
  "lat": "latitude",
  "lon": "longitude",
  "coord": "coordonnées",
  "proj": "projection",
  "reproj": "reprojection",
  "buf": "buffer",
  "tampon": "buffer",
  "inter": "intersection",
  "union": "union",
  "diff": "différence",
  "diss": "dissolve",
  "clip": "clip découpe",
  "merge": "fusion merge",
  "filt": "filtre",
  "exp": "export",
  "imp": "import",
  "add": "ajouter",
  "del": "supprimer",
  "rm": "supprimer",
  "mod": "modifier",
  "edit": "éditer modifier",
  "chg": "changer modifier",
  "ren": "renommer",
  "vis": "visible visibilité",
  "opac": "opacité",
  "symb": "symbologie",
  "leg": "légende",
  "etiq": "étiquette",
  "lab": "label étiquette",
  "cad": "cadastre",
  "par": "parcelle",
  "parce": "parcelle",
  "com": "commune",
  "dep": "département",
  "reg": "région",
  "addr": "adresse",
  "adr": "adresse",
  "ess": "essence",
  "spe": "espèce essence",
  "dbh": "diamètre à hauteur de poitrine",
  "dhp": "diamètre à hauteur de poitrine",
  "st": "surface terrière",
  "dens": "densité",
  "vol": "volume",
  "haut": "hauteur",
  "nb": "nombre",
  "nbr": "nombre",
  "nbre": "nombre",
  "qt": "quantité",
  "qte": "quantité",
  "min": "minimum",
  "max": "maximum",
  "avg": "moyenne",
  "sum": "somme",
  "count": "compter",
  "tot": "total",
  "chk": "vérifier",
  "check": "vérifier",
  "valid": "valider validation",
  "rep": "réparer",
  "fix": "réparer",
  "corr": "corriger",
  "cre": "créer",
  "creat": "créer",
  "comp": "calculer",
  "aff": "afficher",
  "show": "afficher montrer",
  "disp": "afficher",
  "voir": "afficher visualiser",
  "save": "sauvegarder enregistrer",
  "sav": "sauvegarder",
  "load": "charger ouvrir",
  "open": "ouvrir charger",
  "close": "fermer",
  "quit": "quitter fermer",
  "sup": "supprimer",
  "eff": "effacer",
  "efface": "effacer supprimer",
  "raz": "réinitialiser",
  "reset": "réinitialiser",
  "init": "initialiser",
  "upd": "mettre à jour",
  "update": "mettre à jour",
  "maj": "mise à jour",
  "sync": "synchroniser",
  "link": "lier relier",
  "attach": "attacher joindre",
  "split": "diviser",
  "sep": "séparer",
  "extract": "extraire",
  "extr": "extraire",
  "select": "sélectionner",
  "deselect": "désélectionner",
  "dsel": "désélectionner",
  "all": "tout tous",
  "none": "aucun rien",
  "invert": "inverser",
  "toggle": "basculer",
  "switch": "changer basculer",
  "conf": "configuration",
  "cfg": "configuration",
  "param": "paramètre",
  "pref": "préférence",
  "prop": "propriété",
  "info": "information",
  "data": "données",
  "metad": "métadonnées",
  "meta": "métadonnées",
  "doc": "documentation",
  "help": "aide",
  "?": "aide",
  "wtf": "problème erreur",
  "bug": "bug erreur",
  "pb": "problème",
  "pblm": "problème",
  "err": "erreur",
  "warn": "avertissement",
  "alert": "alerte",
  "notif": "notification",
  "msg": "message",
  "log": "journal log",
  "hist": "historique",
  "undo": "annuler",
  "redo": "refaire",
  "cancel": "annuler",
  "stop": "arrêter",
  "pause": "pauser",
  "run": "exécuter lancer",
  "exec": "exécuter",
  "start": "démarrer lancer",
  "go": "aller exécuter",
  "do": "faire exécuter",
  "get": "obtenir récupérer",
  "fetch": "récupérer obtenir",
  "put": "placer mettre",
  "set": "définir configurer",
  "apply": "appliquer",
};

const ACTION_SYNONYMS: Record<string, string[]> = {
  "charger": ["charge", "charg", "load", "open", "ouvre", "ouvrir", "import", "imp", "ajoute", "add"],
  "afficher": ["affiche", "afiche", "montre", "show", "voir", "visualise", "display", "disp", "rendre visible"],
  "créer": ["cree", "crée", "fais", "make", "generer", "gen", "produire", "construire", "build"],
  "supprimer": ["supprime", "efface", "eff", "del", "rm", "remove", "delete", "enleve", "retire", "ote"],
  "modifier": ["modifie", "change", "edit", "alter", "transforme", "convertis", "met a jour", "update"],
  "calculer": ["calcule", "calcul", "comp", "compute", "evaluate", "mesure", "quantifie"],
  "zoomer": ["zoom", "zom", "cadre", "focus", "centrer sur", "va sur"],
  "exporter": ["exporte", "exp", "save", "sauvegarde", "enregistre", "write", "output"],
  "filtrer": ["filtre", "filt", "selectionne", "sel", "where", "subset", "filter"],
  "style": ["symbo", "symbologie", "couleur", "couleure", "color", "rendu", "apparence", "look"],
};

/**
 * Normalise un message utilisateur pour améliorer la compréhension
 * Gère fautes d'orthographe, abréviations, et formulations floues
 */
function normalizeUserMessage(userMessage: string): string {
  let normalized = userMessage.toLowerCase().trim();
  
  // 1. Correction des fautes courantes
  for (const [misspelled, correct] of Object.entries(COMMON_MISSPELLINGS)) {
    const regex = new RegExp(`\\b${misspelled}\\b`, 'gi');
    normalized = normalized.replace(regex, correct);
  }
  
  // 2. Expansion des abréviations
  for (const [abbr, expansion] of Object.entries(ABBREVIATION_EXPANSIONS)) {
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    normalized = normalized.replace(regex, expansion);
  }
  
  // 3. Remplacement des synonymes d'actions (garder le terme canonique)
  for (const [canonical, synonyms] of Object.entries(ACTION_SYNONYMS)) {
    for (const synonym of synonyms) {
      const regex = new RegExp(`\\b${synonym}\\b`, 'gi');
      normalized = normalized.replace(regex, canonical);
    }
  }
  
  // 4. Corrections spécifiques SIG
  normalized = normalized
    .replace(/\bl93\b/gi, "lambert 93")
    .replace(/\bwgs\s*84\b/gi, "wgs84")
    .replace(/\bepsg\s*:?\s*(\d+)/gi, "EPSG:$1")
    .replace(/\blambert\s*2\s*(etendu|étendu)?\b/gi, "lambert 2 étendu")
    .replace(/\brgf\s*93\b/gi, "rgf93")
    .replace(/\b(\d+)\s*(m|mètre|metre|metres|mètres?)\b/gi, "$1m")
    .replace(/\b(\d+)\s*(km|kilometre|kilomètres?)\b/gi, "$1km")
    .replace(/\b(\d+)\s*(ha|hectare|hectares?)\b/gi, "$1ha")
    .replace(/\bgeo\s*json\b/gi, "geojson")
    .replace(/\bshape\s*file\b/gi, "shapefile")
    .replace(/\bgeo\s*package\b/gi, "geopackage")
    .replace(/\bpour\s*quoi\b/gi, "pourquoi")
    .replace(/\bca\s*va\b/gi, "çava")
    .replace(/\bce\s*que\b/gi, "est-ce que")
    .replace(/\by\s*a\s*t\s*il\b/gi, "y a-t-il")
    .replace(/\bcomment\s*ça\s*marche\b/gi, "expliquer fonctionnement");
  
  // 5. Suppression des répétitions de caractères (ex: "couuuuche" → "couche")
  normalized = normalized.replace(/(.)\1{2,}/g, "$1$1");
  
  // 6. Gestion des formulations interrogatives courtes
  if (normalized.length < 20 && !normalized.includes("?")) {
    // Ajouter contexte si c'est une demande implicite
    if (/^\s*(cadastre|parcelle|commune|couche|style|buffer|export)\s*$/.test(normalized)) {
      normalized = `afficher ${normalized}`;
    }
  }
  
  return normalized;
}

/**
 * Détecte si c'est une demande d'aide implicite
 */
function detectImplicitHelp(userMessage: string): boolean {
  const helpPatterns = [
    /^\s*(aide|help|\?|comment|pourquoi|kezako|kesako|keski)\s*$/i,
    /^\s*(je ne sais pas|je sais pas|jsp|j'y comprends rien|comprends pas)\s*/i,
    /^\s*(ça marche pas|ca marche pas|cmarchepas|bug|problème|pb)\s*/i,
    /^\s*(c quoi|c koi|c'est quoi|keskecé|kesskecé)\s+(.+)$/i,
    /^\s*(comment on fait|comment faire|comment ça marche)\s*/i,
  ];
  return helpPatterns.some(p => p.test(userMessage));
}

/**
 * Complète une demande incomplète ou ambiguë
 */
function completeAmbiguousRequest(userMessage: string, normalized: string): string {
  // Détecter les demandes trop courtes
  if (normalized.split(/\s+/).length < 3) {
    // Ajouter du contexte selon les mots-clés présents
    if (/cadastre|parcelle/.test(normalized) && !/charger|afficher|ajouter/.test(normalized)) {
      return `charger ${normalized}`;
    }
    if (/couche/.test(normalized) && !/créer|modifier|supprimer|style/.test(normalized)) {
      return `afficher ${normalized}`;
    }
    if (/buffer|tampon/.test(normalized) && !/créer|calculer/.test(normalized)) {
      return `créer ${normalized}`;
    }
    if (/export|sauvegarder/.test(normalized) && !/exporter/.test(normalized)) {
      return `exporter ${normalized}`;
    }
    if (/calcul|somme|moyenne|total/.test(normalized)) {
      return `calculer ${normalized}`;
    }
  }
  return normalized;
}

export type UserIntent =
  | "DATA_QUERY"           // Requête de données (cadastre, communes, etc.)
  | "ANALYSIS"             // Analyse spatiale ou statistique
  | "VISUALIZATION"        // Création/Modification de carte, styles
  | "PROCESSING"           // Traitement de données (raster, vectoriel)
  | "WORKFLOW"             // Workflow complexe multi-étapes
  | "CODE_GENERATION"      // Génération de code PyQGIS
  | "EXPLANATION"          // Explication, documentation
  | "DEBUG"                // Diagnostic, débogage
  | "FOREST_INVENTORY"     // Inventaire forestier spécifique
  | "GEOCODING"            // Géocodage adresses
  | "EXPORT"               // Export de données
  | "FREE_CHAT";           // Discussion libre

export type ActionComplexity = "SIMPLE" | "MODERATE" | "COMPLEX" | "VERY_COMPLEX";

export interface IntentAnalysis {
  intent: UserIntent;
  complexity: ActionComplexity;
  confidence: number;           // 0-1
  needsQgisContext: boolean;    // Nécessite le contexte QGIS
  needsTools: boolean;          // Nécessite l'appel d'outils
  estimatedSteps: number;       // Nombre d'étapes estimées
  suggestedApproach: "LOCAL_ROUTER" | "TOOL_CALLING" | "CODE_GENERATION" | "HYBRID";
  keywords: string[];           // Mots-clés extraits
  entities: {                  // Entités géographiques détectées
    communes?: string[];
    layers?: string[];
    dataSources?: string[];
    operations?: string[];
    species?: string[];        // Espèces forestières
    attributes?: string[];     // Attributs/champs demandés
    formats?: string[];        // Formats d'export
    crs?: string;              // Système de coordonnées mentionné
    distances?: number[];      // Distances (buffer, etc.)
  };
  requiresLargeContext: boolean; // Nécessite une fenêtre de contexte large
  suggestedModelTier: "ULTRA_LIGHT" | "LIGHT" | "MEDIUM" | "HEAVY";
}

const INTENT_ANALYSIS_PROMPT = `Tu es un analyseur d'intentions SIG expert. Analyse la demande utilisateur et réponds UNIQUEMENT en JSON valide.

INTENTIONS POSSIBLES:
- DATA_QUERY: Requête données (cadastre, communes, sources officielles)
- ANALYSIS: Analyse spatiale/statistique (corrélation, stats, clustering)
- VISUALIZATION: Style, symbologie, cartographie, légendes
- PROCESSING: Traitement géospatial (buffer, intersection, dissolve, reprojection)
- WORKFLOW: Workflow complexe multi-étapes avec dépendances
- FOREST_INVENTORY: Inventaire forestier (placettes, grille, IFN, essences)
- GEOCODING: Géocodage d'adresses
- EXPORT: Export de données (GeoJSON, Shapefile, etc.)
- CODE_GENERATION: Génération script PyQGIS
- EXPLANATION: Explication concept/méthode
- DEBUG: Diagnostic erreur
- FREE_CHAT: Discussion générale

RÈGLES:
1. Détecte l'intention principale avec confiance élevée
2. Évalue la complexité: SIMPLE (1), MODERATE (2-3), COMPLEX (4-6), VERY_COMPLEX (7+)
3. Extrais les entités: communes, couches, sources, opérations, distances, formats, CRS
4. Détermine l'approche optimale: LOCAL_ROUTER, TOOL_CALLING, CODE_GENERATION, HYBRID

FORMAT JSON REQUIS:
{
  "intent": "...",
  "complexity": "...",
  "confidence": 0.0-1.0,
  "needsQgisContext": true/false,
  "needsTools": true/false,
  "estimatedSteps": number,
  "suggestedApproach": "...",
  "keywords": ["..."],
  "entities": {
    "communes": ["..."],
    "layers": ["..."],
    "dataSources": ["..."],
    "operations": ["..."],
    "species": ["..."],
    "attributes": ["..."],
    "formats": ["..."],
    "crs": "...",
    "distances": [number]
  },
  "requiresLargeContext": true/false,
  "suggestedModelTier": "ULTRA_LIGHT|LIGHT|MEDIUM|HEAVY"
}

EXEMPLES:

Exemple 1 - "Charge le cadastre de Lyon et zoom dessus":
{
  "intent": "DATA_QUERY",
  "complexity": "SIMPLE",
  "confidence": 0.95,
  "needsQgisContext": false,
  "needsTools": true,
  "estimatedSteps": 2,
  "suggestedApproach": "LOCAL_ROUTER",
  "keywords": ["cadastre", "Lyon", "zoom"],
  "entities": {
    "communes": ["Lyon"],
    "layers": [],
    "dataSources": ["cadastre"],
    "operations": ["charger", "zoom"],
    "species": [],
    "attributes": [],
    "formats": [],
    "crs": null,
    "distances": []
  },
  "requiresLargeContext": false,
  "suggestedModelTier": "ULTRA_LIGHT"
}

Exemple 2 - "Analyse la corrélation entre le NDVI 2020 et 2023 sur toutes les communes de mon projet, puis crée une carte choroplèthe avec légende personnalisée":
{
  "intent": "ANALYSIS",
  "complexity": "VERY_COMPLEX",
  "confidence": 0.88,
  "needsQgisContext": true,
  "needsTools": true,
  "estimatedSteps": 8,
  "suggestedApproach": "HYBRID",
  "keywords": ["NDVI", "corrélation", "analyse", "carte", "choroplèthe", "légende"],
  "entities": {
    "communes": [],
    "layers": ["NDVI 2020", "NDVI 2023"],
    "dataSources": [],
    "operations": ["analyse corrélation", "carte choroplèthe", "légende personnalisée"],
    "species": [],
    "attributes": [],
    "formats": [],
    "crs": null,
    "distances": []
  },
  "requiresLargeContext": true,
  "suggestedModelTier": "MEDIUM"
}

Exemple 3 - "Crée une grille d'inventaire avec des placettes de 15m sur ma zone forestière et calcule la surface par essence":
{
  "intent": "FOREST_INVENTORY",
  "complexity": "COMPLEX",
  "confidence": 0.92,
  "needsQgisContext": true,
  "needsTools": true,
  "estimatedSteps": 5,
  "suggestedApproach": "TOOL_CALLING",
  "keywords": ["grille", "inventaire", "placettes", "forestière", "surface", "essence"],
  "entities": {
    "communes": [],
    "layers": ["zone forestière"],
    "dataSources": [],
    "operations": ["créer grille", "placettes 15m", "calculer surface"],
    "species": [],
    "attributes": ["essence"],
    "formats": [],
    "crs": null,
    "distances": [15]
  },
  "requiresLargeContext": false,
  "suggestedModelTier": "LIGHT"
}

Analyse cette demande:`;

// Modèles recommandés par tier pour l'analyse d'intention
const ULTRA_LIGHT_MODELS = ["smollm2:360m", "smollm2:1.7b", "gemma4:2b", "llama3.2:1b"];
const FALLBACK_MODEL = "gemma4:2b";

/**
 * Analyse la demande utilisateur avec un modèle local ultra-léger
 */
export async function analyzeUserIntent(
  userMessage: string,
  settings: AppSettings
): Promise<IntentAnalysis | null> {
  // Vérifier si Ollama est disponible
  const ollamaAvailable = await detectOllama();
  if (!ollamaAvailable) {
    // Fallback: analyse heuristique simple sans LLM
    return heuristicIntentAnalysis(userMessage);
  }

  // Récupérer les modèles disponibles
  const models = await getOllamaModels();
  
  // Trouver le meilleur modèle ultra-léger disponible
  const availableUltraLight = models
    .map(m => m.name)
    .filter(name => ULTRA_LIGHT_MODELS.some(ul => name.includes(ul)));
  
  const modelToUse = availableUltraLight[0] || 
                     models.find(m => m.name.includes("2b") || m.name.includes("1b"))?.name || 
                     models[0]?.name || 
                     FALLBACK_MODEL;

  try {
    const prompt = `${INTENT_ANALYSIS_PROMPT}\n\n"${userMessage}"`;
    
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelToUse,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1,  // Très faible pour du JSON fiable
          num_predict: 800,
          stop: ["\n\n", "User:", "Assistant:"],
        },
      }),
      signal: AbortSignal.timeout(5000), // 5 secondes max pour l'analyse
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawResponse = data.response?.trim() || "";
    
    // Extraire le JSON de la réponse
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[IntentAnalyzer] Pas de JSON trouvé dans la réponse:", rawResponse);
      return heuristicIntentAnalysis(userMessage);
    }

    const parsedAnalysis = JSON.parse(jsonMatch[0]);
    
    // Validation et mapping vers IntentAnalysis avec toutes les entités
    const analysis: IntentAnalysis = {
      intent: parsedAnalysis.intent || "FREE_CHAT",
      complexity: parsedAnalysis.complexity || "SIMPLE",
      confidence: Math.max(0, Math.min(1, parsedAnalysis.confidence || 0.5)),
      needsQgisContext: parsedAnalysis.needsQgisContext ?? true,
      needsTools: parsedAnalysis.needsTools ?? false,
      estimatedSteps: Math.max(1, parsedAnalysis.estimatedSteps || 1),
      suggestedApproach: parsedAnalysis.suggestedApproach || "CODE_GENERATION",
      keywords: parsedAnalysis.keywords || [],
      entities: {
        communes: parsedAnalysis.entities?.communes || [],
        layers: parsedAnalysis.entities?.layers || [],
        dataSources: parsedAnalysis.entities?.dataSources || [],
        operations: parsedAnalysis.entities?.operations || [],
        species: parsedAnalysis.entities?.species || [],
        attributes: parsedAnalysis.entities?.attributes || [],
        formats: parsedAnalysis.entities?.formats || [],
        crs: parsedAnalysis.entities?.crs || undefined,
        distances: parsedAnalysis.entities?.distances || [],
      },
      requiresLargeContext: parsedAnalysis.requiresLargeContext ?? false,
      suggestedModelTier: parsedAnalysis.suggestedModelTier || "LIGHT",
    };
    
    return analysis;

  } catch (error) {
    console.warn("[IntentAnalyzer] Erreur analyse LLM:", error);
    return heuristicIntentAnalysis(userMessage);
  }
}

/**
 * Analyse heuristique améliorée avec patterns étendus et extraction complète des entités
 * Intègre la normalisation pour gérer fautes d'orthographe et formulations floues
 */
function heuristicIntentAnalysis(userMessage: string): IntentAnalysis {
  // 1. Détecter les demandes d'aide implicites
  if (detectImplicitHelp(userMessage)) {
    return {
      intent: "EXPLANATION",
      complexity: "SIMPLE",
      confidence: 0.9,
      needsQgisContext: false,
      needsTools: false,
      estimatedSteps: 1,
      suggestedApproach: "LOCAL_ROUTER",
      keywords: ["aide", "explication"],
      entities: {},
      requiresLargeContext: false,
      suggestedModelTier: "ULTRA_LIGHT",
    };
  }
  
  // 2. Normaliser le message (correction fautes, expansion abréviations)
  let normalized = normalizeUserMessage(userMessage);
  
  // 3. Compléter les demandes ambiguës ou trop courtes
  normalized = completeAmbiguousRequest(userMessage, normalized);
  
  // ===== PATTERNS DÉTAILLÉS PAR INTENTION =====
  
  // DATA_QUERY - Requêtes de données
  const dataQueryPatterns = {
    cadastre: /cadastre|parcelle|section|numéro|propriétaire/i,
    communes: /commune|ville|département|région|code\s*insee/i,
    adresses: /adresse|rue|avenue|boulevard|lieu-dit|localisation/i,
    sources: /ign|geoportail|openstreetmap|osm|google|bing/i,
  };
  
  // ANALYSIS - Analyses
  const analysisPatterns = {
    stats: /statistique|moyenne|médiane|somme|count|min|max|écart|variance/i,
    spatial: /corrélation|cluster|hotspot|analyse\s*spatiale|proximité|distance/i,
    surface: /surface|aire|superficie|ha\b|hectare|km²|m²/i,
  };
  
  // VISUALIZATION - Visualisation
  const vizPatterns = {
    style: /style|symbologie|couleur|remplissage|contour|hachure/i,
    legend: /légende|étiquette|label|annotation|texte/i,
    layout: /mise\s*en\s*page|composition|carte|atlas|print/i,
  };
  
  // PROCESSING - Traitement
  const processingPatterns = {
    buffer: /buffer|tampon|zone\s*de\s*protection|distance/i,
    overlay: /intersection|union|différence|fusion|découpe|clip/i,
    transform: /reprojection|transformation|convertir|project/i,
    raster: /ndvi|sentinel|landsat|raster|ortho|dem|mnt|mns/i,
  };
  
  // FOREST_INVENTORY - Forestier
  const forestPatterns = {
    inventory: /inventaire|placette|maille|grille|ifn/i,
    species: /essence|espèce|chêne|pin|sapin|hêtre|érable|bouleau/i,
    metrics: /diamètre|hauteur|dbh|surface\s*terrière|volume/i,
    forest: /forêt|bois|peuplement|parcelle\s*forestière/i,
  };
  
  // EXPORT - Export
  const exportPatterns = {
    formats: /geojson|shapefile|shp|geopackage|gpkg|kml|kmz|dxf|csv|excel|pdf/i,
    action: /exporter|sauvegarder|enregistrer|télécharger|save/i,
  };
  
  // CODE & DEBUG
  const hasCode = /python|script|code|pyqgis|plugin|développer|programmer/i.test(normalized);
  const hasDebug = /debug|erreur|problème|bug|diagnostic|planté|crash|échoue/i.test(normalized);
  const hasExplain = /expliquer|comment|pourquoi|qu'est-ce|documentation|aide/i.test(normalized);
  
  // ===== DÉTECTION DES INTENTIONS =====
  const hasDataQuery = Object.values(dataQueryPatterns).some(p => p.test(normalized));
  const hasAnalysis = Object.values(analysisPatterns).some(p => p.test(normalized));
  const hasVisualization = Object.values(vizPatterns).some(p => p.test(normalized));
  const hasProcessing = Object.values(processingPatterns).some(p => p.test(normalized));
  const hasForest = Object.values(forestPatterns).some(p => p.test(normalized));
  const hasExport = exportPatterns.formats.test(normalized) && exportPatterns.action.test(normalized);
  
  // Déterminer l'intention (ordre de priorité)
  let intent: UserIntent = "FREE_CHAT";
  if (hasForest) intent = "FOREST_INVENTORY";
  else if (hasExport) intent = "EXPORT";
  else if (hasDataQuery) intent = "DATA_QUERY";
  else if (hasAnalysis) intent = "ANALYSIS";
  else if (hasVisualization) intent = "VISUALIZATION";
  else if (hasProcessing) intent = "PROCESSING";
  else if (hasDebug) intent = "DEBUG";
  else if (hasCode) intent = "CODE_GENERATION";
  else if (hasExplain) intent = "EXPLANATION";
  
  // ===== CALCUL COMPLEXITÉ =====
  const stepConnectors = /\b(et|puis|ensuite|après|enfin|d'abord|puis\s*ensuite|ensuite\s*puis|et\s*enfin)\b/gi;
  const stepIndicators = (normalized.match(stepConnectors) || []).length;
  
  // Complexité basée sur le nombre d'opérations détectées
  const operationCount = [
    hasDataQuery, hasAnalysis, hasVisualization, hasProcessing, hasForest
  ].filter(Boolean).length;
  
  let estimatedSteps = Math.max(stepIndicators + 1, operationCount);
  
  let complexity: ActionComplexity = "SIMPLE";
  if (estimatedSteps >= 7 || normalized.length > 800) complexity = "VERY_COMPLEX";
  else if (estimatedSteps >= 4 || normalized.length > 400) complexity = "COMPLEX";
  else if (estimatedSteps >= 2 || normalized.length > 200) complexity = "MODERATE";
  
  // ===== DÉTERMINER L'APPROCHE =====
  let approach: IntentAnalysis["suggestedApproach"] = "CODE_GENERATION";
  if ((hasDataQuery) && estimatedSteps <= 2) approach = "LOCAL_ROUTER";
  else if (estimatedSteps <= 3 && !hasCode && !hasDebug) approach = "TOOL_CALLING";
  else if (estimatedSteps > 3 && (hasAnalysis || hasProcessing || hasForest)) approach = "HYBRID";
  
  // ===== EXTRACTION COMPLÈTE DES ENTITÉS =====
  
  // Communes/Villes
  const communePatterns = [
    /(?:commune|ville|de|d')\s+([A-Za-zÀ-ÿ\s'-]+?)(?:\s+(?:et|avec|sans|pour|dans|sur|,|\.|$|\d))/i,
    /([A-Za-zÀ-ÿ\s'-]+?)\s*\(\s*\d{2,5}\s*\)/,  // Lyon (69000)
    /\b(Paris|Lyon|Marseille|Bordeaux|Nantes|Strasbourg|Toulouse|Nice)\b/i,  // Grandes villes
  ];
  const communes: string[] = [];
  for (const pattern of communePatterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length > 2 && !communes.includes(name)) {
        communes.push(name);
      }
    }
  }
  
  // Couches (patterns améliorés)
  const layerPatterns = [
    /couche[s]?\s+(?:"|'|«)?([^"'»]{2,50})(?:"|'|»)?/gi,
    /(?:de|du|la|sur)\s+la\s+couche\s+["']?([^"']{2,50})["']?/gi,
    /(?:charger|ouvrir|ajouter)\s+["']?([^"']{10,50}\.(shp|geojson|gpkg|tif))["']?/gi,
  ];
  const layers: string[] = [];
  for (const pattern of layerPatterns) {
    const matches = normalized.matchAll(pattern);
    for (const match of matches) {
      const name = match[1]?.trim();
      if (name && name.length > 1 && !layers.includes(name)) {
        layers.push(name);
      }
    }
  }
  
  // Distances (buffer, etc.)
  const distancePattern = /(\d+(?:\.\d+)?)\s*(m|mètre|km|hectare|ha)\b/gi;
  const distances: number[] = [];
  let distMatch;
  while ((distMatch = distancePattern.exec(normalized)) !== null) {
    const value = parseFloat(distMatch[1]);
    const unit = distMatch[2].toLowerCase();
    // Normaliser en mètres
    if (unit.includes('km')) distances.push(value * 1000);
    else if (unit.includes('ha')) distances.push(Math.sqrt(value * 10000)); // Approximation
    else distances.push(value);
  }
  
  // Formats d'export
  const formatMatches = normalized.match(/geojson|shapefile|shp|geopackage|gpkg|kml|kmz|dxf|csv/gi) || [];
  const formats = [...new Set(formatMatches.map(f => f.toLowerCase()))];
  
  // CRS/Système de coordonnées
  const crsPattern = /(EPSG:[\d]{4,6}|Lambert\s*93|WGS\s*84|RGF93)/i;
  const crsMatch = normalized.match(crsPattern);
  const crs = crsMatch ? crsMatch[1] : undefined;
  
  // Sources de données
  const dataSources: string[] = [];
  if (dataQueryPatterns.cadastre.test(normalized)) dataSources.push("cadastre");
  if (processingPatterns.raster.test(normalized)) dataSources.push("raster");
  if (/ign|geoportail/i.test(normalized)) dataSources.push("ign");
  if (/osm|openstreetmap/i.test(normalized)) dataSources.push("openstreetmap");
  
  // Espèces forestières
  const speciesPattern = /(chêne|pin|sapin|hêtre|érable|bouleau|châtaignier|douglas|pin\s*maritime|pin\s*sylvestre|chêne\s*pédonculé|chêne\s*pubescent)/gi;
  const speciesMatches = normalized.match(speciesPattern) || [];
  const species = [...new Set(speciesMatches.map(s => s.toLowerCase()))];
  
  // Attributs/Champs
  const attrPattern = /champ\s+["']?([^"']+)["']?|attribut\s+["']?([^"']+)["']?|colonne\s+["']?([^"']+)["']?/gi;
  const attributes: string[] = [];
  const attrMatches = normalized.matchAll(attrPattern);
  for (const match of attrMatches) {
    const name = (match[1] || match[2] || match[3])?.trim();
    if (name && !attributes.includes(name)) {
      attributes.push(name);
    }
  }
  
  // Opérations détectées
  const operations: string[] = [];
  if (processingPatterns.buffer.test(normalized)) operations.push("buffer");
  if (processingPatterns.overlay.test(normalized)) operations.push("overlay");
  if (analysisPatterns.surface.test(normalized)) operations.push("calcul_surface");
  if (hasForest) operations.push("inventaire_forestier");
  if (hasExport) operations.push("export");
  
  // Keywords filtrés
  const stopWords = /\b(le|la|les|de|du|des|et|ou|un|une|en|dans|sur|avec|sans|pour|par|que|qui|quoi|ce|ces|cette|mon|ma|mes|ton|ta|tes|son|sa|ses|notre|votre|leur|leurs|je|tu|il|elle|nous|vous|ils|elles|me|te|se|lui|soi)\b/gi;
  const keywords = normalized
    .replace(stopWords, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && /^[a-zàâäéèêëîïôöùûüç]/i.test(w))
    .slice(0, 15);
  
  return {
    intent,
    complexity,
    confidence: 0.65,
    needsQgisContext: !["FREE_CHAT", "EXPLANATION"].includes(intent),
    needsTools: !["FREE_CHAT", "EXPLANATION", "CODE_GENERATION"].includes(intent),
    estimatedSteps,
    suggestedApproach: approach,
    keywords: [...new Set(keywords)],
    entities: {
      communes,
      layers,
      dataSources,
      operations,
      species,
      attributes,
      formats,
      crs,
      distances,
    },
    requiresLargeContext: estimatedSteps > 5 || normalized.length > 500,
    suggestedModelTier: complexity === "VERY_COMPLEX" ? "HEAVY" : complexity === "COMPLEX" ? "MEDIUM" : "LIGHT",
  };
}

/**
 * Sélectionne le modèle approprié selon l'analyse d'intention
 */
export function selectModelForIntent(
  analysis: IntentAnalysis,
  availableModels: string[],
  settings: AppSettings
): { model: string; reason: string } {
  const tier = analysis.suggestedModelTier;
  
  // Mapping des tiers vers les modèles
  const tierMapping: Record<string, string[]> = {
    "ULTRA_LIGHT": ["smollm2:360m", "smollm2:1.7b", "gemma4:2b", "llama3.2:1b", "qwen3:1.7b"],
    "LIGHT": ["gemma4:4b", "qwen3:4b", "llama3.2:3b", "phi4:3b", "gemma4:2b"],
    "MEDIUM": ["gemma4:9b", "qwen3:8b", "llama3.3:8b", "mistral:7b", "gemma4:4b"],
    "HEAVY": ["gemma4:27b", "qwen3:30b-a3b", "llama3.3:70b", "qwen3:14b", "gemma4:12b"],
  };
  
  const candidates = tierMapping[tier] || tierMapping["LIGHT"];
  
  // Trouver le premier modèle disponible
  for (const candidate of candidates) {
    const found = availableModels.find(m => 
      m.toLowerCase().includes(candidate.toLowerCase().split(":")[0]) &&
      m.toLowerCase().includes(candidate.toLowerCase().split(":")[1] || "")
    );
    if (found) {
      return { 
        model: found, 
        reason: `Modèle ${tier} sélectionné pour ${analysis.intent} (${analysis.complexity})` 
      };
    }
  }
  
  // Fallback sur le premier modèle disponible
  return { 
    model: availableModels[0] || "gemma4:4b", 
    reason: `Fallback: premier modèle disponible (tier ${tier} non trouvé)` 
  };
}

/**
 * Détermine si on peut utiliser le local router basé sur l'analyse
 */
export function canUseLocalRouter(analysis: IntentAnalysis): boolean {
  return analysis.suggestedApproach === "LOCAL_ROUTER" && 
         analysis.confidence > 0.8 && 
         analysis.complexity === "SIMPLE";
}

/**
 * Détermine si on doit utiliser le streaming pour la réponse
 */
export function shouldUseStreaming(analysis: IntentAnalysis): boolean {
  return analysis.complexity !== "SIMPLE" || analysis.estimatedSteps > 3;
}
