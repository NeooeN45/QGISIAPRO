/**
 * Parser pour le raisonnement structuré du LLM.
 *
 * Le system prompt impose au modèle de produire des réponses avec des marqueurs :
 *   [PLAN] ... [EXECUTE] ... [VERIFY] ... [REPORT] ...
 *
 * Ce module détecte ces marqueurs et sépare le contenu pour :
 *  - Afficher PLAN/EXECUTE/VERIFY en bulle de "thinking" repliable
 *  - Afficher uniquement REPORT comme réponse finale visible par défaut
 *  - Conserver le texte brut si aucun marqueur (compatibilité descendante)
 */

export type ReasoningPhase = "plan" | "execute" | "verify" | "report";

export interface ParsedReasoning {
  /** Phases extraites dans l'ordre où elles apparaissent */
  phases: Array<{ phase: ReasoningPhase; content: string }>;
  /** Texte de la phase REPORT (réponse utilisateur), ou texte brut si pas de marqueur */
  finalAnswer: string;
  /** True si au moins un marqueur a été détecté */
  hasStructuredReasoning: boolean;
}

const MARKER_REGEX = /\[(PLAN|EXECUTE|VERIFY|REPORT)\]/gi;

/**
 * Parse un texte de réponse LLM et extrait les phases marquées.
 *
 * Tolérant : accepte les marqueurs en majuscules ou minuscules, avec ou sans
 * espaces alentour. Si aucun marqueur n'est trouvé, retourne le texte tel quel
 * comme `finalAnswer`.
 */
export function parseReasoning(text: string): ParsedReasoning {
  if (!text || typeof text !== "string") {
    return { phases: [], finalAnswer: "", hasStructuredReasoning: false };
  }

  const matches: Array<{ phase: ReasoningPhase; index: number; length: number }> = [];
  let m: RegExpExecArray | null;
  MARKER_REGEX.lastIndex = 0;
  while ((m = MARKER_REGEX.exec(text)) !== null) {
    matches.push({
      phase: m[1].toLowerCase() as ReasoningPhase,
      index: m.index,
      length: m[0].length,
    });
  }

  if (matches.length === 0) {
    return {
      phases: [],
      finalAnswer: text.trim(),
      hasStructuredReasoning: false,
    };
  }

  const phases: ParsedReasoning["phases"] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const content = text.slice(start, end).trim();
    if (content.length > 0) {
      phases.push({ phase: matches[i].phase, content });
    }
  }

  // Préfixe avant le premier marqueur (commentaire libre du modèle) → conservé
  // dans phases[0] si non vide
  const prefix = text.slice(0, matches[0].index).trim();
  if (prefix.length > 0) {
    phases.unshift({ phase: "plan", content: prefix });
  }

  const reportPhase = [...phases].reverse().find((p) => p.phase === "report");
  const finalAnswer = reportPhase ? reportPhase.content : phases[phases.length - 1]?.content || text.trim();

  return {
    phases,
    finalAnswer,
    hasStructuredReasoning: true,
  };
}

/**
 * Renvoie un résumé compact des phases non-REPORT pour affichage dans une
 * bulle "thinking" sous le message final.
 */
export function summarizeThinking(parsed: ParsedReasoning): string {
  if (!parsed.hasStructuredReasoning) return "";
  const internal = parsed.phases.filter((p) => p.phase !== "report");
  if (internal.length === 0) return "";
  return internal
    .map((p) => `**[${p.phase.toUpperCase()}]**\n${p.content}`)
    .join("\n\n");
}
