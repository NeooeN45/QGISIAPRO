/**
 * Extraction de contenu depuis les pieces jointes utilisateur
 * (PDF, DOCX, TXT, CSV, JSON, images...) pour les injecter en contexte
 * dans le prompt LLM, comme ChatGPT/Claude.
 *
 * Strategie :
 *   - PDF        : pdfjs-dist → texte concatene par page
 *   - DOCX       : mammoth.extractRawText
 *   - Texte      : lecture directe (.txt, .md, .csv, .json, .xml, code)
 *   - Image      : base64 dataURL pour les modeles vision (Gemini, Claude, GPT-4V)
 *
 * Limites :
 *   - PDF/DOCX scannes (sans texte) : non supportes (OCR non implemente)
 *   - Texte tronque a MAX_TEXT_CHARS_PER_FILE pour ne pas exploser le contexte
 */

export const MAX_TEXT_CHARS_PER_FILE = 50_000;
export const MAX_TOTAL_ATTACHMENT_CHARS = 200_000;
export const MAX_ATTACHMENT_SIZE_MB = 25;

export type AttachmentKind = "text" | "pdf" | "docx" | "image" | "unknown";

export interface ExtractedAttachment {
  /** Nom de fichier original */
  name: string;
  /** Taille en octets */
  size: number;
  /** Type MIME */
  mimeType: string;
  /** Categorie d'extraction */
  kind: AttachmentKind;
  /** Contenu textuel extrait (vide pour images) */
  textContent: string;
  /** Pour images : data URL base64 (pour modeles vision) */
  dataUrl?: string;
  /** Avertissement non bloquant (ex: tronque, partiellement lu) */
  warning?: string;
}

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "csv", "tsv", "json", "xml", "yaml", "yml",
  "js", "ts", "tsx", "jsx", "py", "sql", "sh", "html", "css",
  "log", "env", "ini", "toml", "geojson", "wkt",
]);

const IMAGE_MIME_PREFIX = "image/";

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

function detectKind(file: File): AttachmentKind {
  const ext = getExtension(file.name);
  if (file.type.startsWith(IMAGE_MIME_PREFIX)) return "image";
  if (file.type === "application/pdf" || ext === "pdf") return "pdf";
  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    return "docx";
  }
  if (TEXT_EXTENSIONS.has(ext) || file.type.startsWith("text/")) return "text";
  return "unknown";
}

function truncateText(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  return {
    text: `${text.slice(0, max)}\n\n[... contenu tronque a ${max.toLocaleString()} caracteres ...]`,
    truncated: true,
  };
}

// ─── Extracteurs ──────────────────────────────────────────────────────────────

async function extractText(file: File): Promise<string> {
  // FileReader.readAsText : large compatibilite (browsers + jsdom).
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("FileReader echec"));
    reader.readAsText(file, "utf-8");
  });
}

async function extractPdf(file: File): Promise<string> {
  // Import dynamique pour ne pas charger pdfjs au boot
  const pdfjs = await import("pdfjs-dist");
  // Worker : utilise la version bundled
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    // Vite resout cet import en URL via ?url
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url"))
      .default as string;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  }

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .join(" ");
    parts.push(`--- Page ${i} ---\n${pageText}`);
  }
  return parts.join("\n\n");
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value || "";
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("FileReader echec"));
    reader.readAsDataURL(file);
  });
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Extrait le contenu d'un fichier en pre-traitement avant envoi au LLM.
 * Ne lance JAMAIS — encapsule l'erreur dans `warning`.
 */
export async function extractAttachment(file: File): Promise<ExtractedAttachment> {
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_ATTACHMENT_SIZE_MB) {
    return {
      name: file.name,
      size: file.size,
      mimeType: file.type,
      kind: "unknown",
      textContent: "",
      warning: `Fichier trop volumineux (${sizeMb.toFixed(1)} Mo > ${MAX_ATTACHMENT_SIZE_MB} Mo).`,
    };
  }

  const kind = detectKind(file);

  try {
    if (kind === "image") {
      const dataUrl = await fileToDataUrl(file);
      return {
        name: file.name,
        size: file.size,
        mimeType: file.type,
        kind,
        textContent: "",
        dataUrl,
      };
    }

    let raw = "";
    if (kind === "text") raw = await extractText(file);
    else if (kind === "pdf") raw = await extractPdf(file);
    else if (kind === "docx") raw = await extractDocx(file);
    else {
      return {
        name: file.name,
        size: file.size,
        mimeType: file.type,
        kind,
        textContent: "",
        warning: `Format non supporte (.${getExtension(file.name) || "?"}).`,
      };
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      return {
        name: file.name,
        size: file.size,
        mimeType: file.type,
        kind,
        textContent: "",
        warning: "Aucun texte extrait (document scanne ou vide ?).",
      };
    }

    const { text, truncated } = truncateText(trimmed, MAX_TEXT_CHARS_PER_FILE);
    return {
      name: file.name,
      size: file.size,
      mimeType: file.type,
      kind,
      textContent: text,
      warning: truncated ? "Contenu tronque (trop long)." : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      name: file.name,
      size: file.size,
      mimeType: file.type,
      kind,
      textContent: "",
      warning: `Echec extraction : ${message}`,
    };
  }
}

/**
 * Extrait toutes les pieces jointes en parallele.
 */
export async function extractAttachments(
  files: File[],
): Promise<ExtractedAttachment[]> {
  return Promise.all(files.map(extractAttachment));
}

/**
 * Formate les pieces jointes textuelles en bloc Markdown a injecter dans
 * le message utilisateur (avant envoi au LLM).
 *
 * Respecte MAX_TOTAL_ATTACHMENT_CHARS pour eviter d'exploser le contexte.
 */
export function formatAttachmentsForPrompt(
  attachments: ExtractedAttachment[],
): string {
  if (attachments.length === 0) return "";

  const textuals = attachments.filter(
    (a) => a.kind !== "image" && a.textContent.length > 0,
  );
  if (textuals.length === 0) return "";

  let used = 0;
  const blocks: string[] = ["## Pieces jointes fournies par l'utilisateur"];

  for (const att of textuals) {
    const remaining = MAX_TOTAL_ATTACHMENT_CHARS - used;
    if (remaining <= 500) {
      blocks.push(`\n[... ${textuals.length - blocks.length + 1} fichier(s) omis (limite globale atteinte) ...]`);
      break;
    }
    const { text } = truncateText(att.textContent, remaining - 200);
    used += text.length;
    blocks.push(
      `\n### ${att.name} (${att.kind.toUpperCase()}, ${(att.size / 1024).toFixed(1)} Ko)\n` +
        "```\n" +
        text +
        "\n```",
    );
  }

  return blocks.join("\n");
}

/**
 * Retourne la liste des images (data URLs) pour usage avec modeles vision.
 */
export function getImageDataUrls(
  attachments: ExtractedAttachment[],
): Array<{ name: string; dataUrl: string }> {
  return attachments
    .filter((a): a is ExtractedAttachment & { dataUrl: string } =>
      a.kind === "image" && typeof a.dataUrl === "string" && a.dataUrl.length > 0,
    )
    .map((a) => ({ name: a.name, dataUrl: a.dataUrl }));
}
