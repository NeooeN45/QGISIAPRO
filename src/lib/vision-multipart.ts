/**
 * Vision multipart : conversion des images attachees en payload natif
 * pour les modeles vision (GPT-4o, Claude 3.5+, Gemini 2.x).
 *
 * Au lieu d'envoyer un marqueur texte "[IMAGE: foo.png]" dans le prompt,
 * on transmet directement le data URL base64 dans le content multipart.
 *
 * Format OpenRouter / OpenAI / Claude :
 *   { role: "user", content: [
 *       { type: "text", text: "..." },
 *       { type: "image_url", image_url: { url: "data:image/png;base64,..." } },
 *   ]}
 *
 * Format Gemini SDK (parts) :
 *   parts: [
 *     { text: "..." },
 *     { inlineData: { mimeType: "image/png", data: "<base64-only>" } },
 *   ]
 */

export interface AttachedImage {
  /** Nom de fichier original */
  name: string;
  /** Data URL complete : data:image/png;base64,XXXXX */
  dataUrl: string;
}

// ─── Types OpenRouter / OpenAI ───────────────────────────────────────────────

export interface OpenAiTextPart {
  type: "text";
  text: string;
}

export interface OpenAiImagePart {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
}

export type OpenAiContentPart = OpenAiTextPart | OpenAiImagePart;

// ─── Types Gemini ────────────────────────────────────────────────────────────

export interface GeminiTextPart {
  text: string;
}

export interface GeminiInlineDataPart {
  inlineData: { mimeType: string; data: string };
}

export type GeminiPart = GeminiTextPart | GeminiInlineDataPart;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Decompose un data URL "data:image/png;base64,XXXX" en {mimeType, base64}.
 * Retourne null si format invalide.
 */
export function parseDataUrl(
  dataUrl: string,
): { mimeType: string; base64: string } | null {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

/**
 * Construit un message user OpenRouter compatible vision.
 * Si aucune image, retourne `content: string` (compatible legacy).
 */
export function buildOpenRouterUserContent(
  text: string,
  images: AttachedImage[] = [],
): string | OpenAiContentPart[] {
  if (images.length === 0) return text;

  const parts: OpenAiContentPart[] = [{ type: "text", text }];
  for (const img of images) {
    if (!img.dataUrl) continue;
    parts.push({
      type: "image_url",
      image_url: { url: img.dataUrl, detail: "auto" },
    });
  }
  return parts;
}

/**
 * Construit les parts Gemini compatibles vision.
 */
export function buildGeminiParts(
  text: string,
  images: AttachedImage[] = [],
): GeminiPart[] {
  const parts: GeminiPart[] = [{ text }];
  for (const img of images) {
    const parsed = parseDataUrl(img.dataUrl);
    if (!parsed) continue;
    parts.push({
      inlineData: { mimeType: parsed.mimeType, data: parsed.base64 },
    });
  }
  return parts;
}

/**
 * Filtre les images valides pour vision : data URL parseable + mime image/*.
 */
export function filterValidImages(images: AttachedImage[]): AttachedImage[] {
  return images.filter((img) => {
    const p = parseDataUrl(img.dataUrl);
    return p !== null && p.mimeType.startsWith("image/");
  });
}
