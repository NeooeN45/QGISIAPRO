// NOTE PERF : pdfjs-dist, mammoth et jszip sont importés DYNAMIQUEMENT dans les
// branches qui les utilisent. Cela évite de charger ~1,5 Mo de code au boot ;
// ces libs ne sont récupérées que lorsqu'un PDF/DOCX/XLSX est réellement traité.

export async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  
  // Text files
  if (
    fileType === "text/plain" ||
    fileType === "text/markdown" ||
    fileType === "text/csv" ||
    fileType === "application/json" ||
    fileName.endsWith(".txt") ||
    fileName.endsWith(".md") ||
    fileName.endsWith(".csv") ||
    fileName.endsWith(".json") ||
    fileName.endsWith(".xml")
  ) {
    return await file.text();
  }
  
  // Code files
  if (
    fileType === "text/javascript" ||
    fileType === "text/x-python" ||
    fileType === "text/x-java" ||
    fileType === "text/x-csrc" ||
    fileType === "text/x-c++src" ||
    fileName.endsWith(".js") ||
    fileName.endsWith(".py") ||
    fileName.endsWith(".java") ||
    fileName.endsWith(".c") ||
    fileName.endsWith(".cpp") ||
    fileName.endsWith(".h") ||
    fileName.endsWith(".ts") ||
    fileName.endsWith(".tsx") ||
    fileName.endsWith(".jsx") ||
    fileName.endsWith(".sql") ||
    fileName.endsWith(".sh") ||
    fileName.endsWith(".bat") ||
    fileName.endsWith(".ps1")
  ) {
    return await file.text();
  }
  
  // PDF Extraction
  if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
    try {
      const arrayBuffer = await file.arrayBuffer();

      // Import dynamique : pdfjs n'est chargé que pour traiter un PDF.
      const pdfjsLib = await import("pdfjs-dist");
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url"))
          .default as string;
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
      }

      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = "";
      
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((item: any) => item.str)
            .join(" ");
          fullText += `[Page ${i}]\n${pageText}\n\n`;
        } catch (pageError) {
          console.warn(`[PDF] Erreur page ${i}:`, pageError);
          fullText += `[Page ${i}] [Erreur de lecture]\n\n`;
        }
      }
      
      if (!fullText.trim()) {
        throw new Error("Aucun texte n'a pu être extrait du PDF");
      }
      
      return fullText.trim();
    } catch (error) {
      console.error("[PDF Extraction] Erreur:", error);
      console.error("[PDF Extraction] Fichier:", file.name, "Taille:", file.size);
      throw new Error(`Erreur lors de la lecture du PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // DOCX Extraction (Word)
  if (
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
    fileName.endsWith(".docx")
  ) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const mammoth = (await import("mammoth")).default;
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (error) {
      console.error("DOCX Extraction error:", error);
      throw new Error("Erreur lors de la lecture du fichier Word DOCX.");
    }
  }

  // XLSX Extraction (Excel) - Basic XML extraction since we don't want a heavy dependency like sheetjs just for text
  if (
    fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
    fileName.endsWith(".xlsx")
  ) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // Try to find shared strings which contain most of the text in XLSX
      const sharedStringsFile = zip.file("xl/sharedStrings.xml");
      if (!sharedStringsFile) {
        return "[Fichier Excel détecté mais aucune chaîne de texte partagée trouvée]";
      }
      
      const xmlData = await sharedStringsFile.async("string");
      // Extract everything between <t> and </t> tags
      const regex = /<t[^>]*>(.*?)<\/t>/g;
      let match;
      const strings: string[] = [];
      
      while ((match = regex.exec(xmlData)) !== null) {
        // Unescape XML entities
        const text = match[1]
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
        if (text.trim()) strings.push(text);
      }
      
      return `[Contenu extrait du classeur Excel]\n${strings.join(" | ")}`;
    } catch (error) {
      console.error("XLSX Extraction error:", error);
      throw new Error("Erreur lors de la lecture du fichier Excel XLSX.");
    }
  }

  // Images : envoyees en base64 aux modeles vision (Claude/Gemini/GPT-4o)
  if (fileType.startsWith("image/") || fileName.endsWith(".png") || fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".webp") || fileName.endsWith(".gif")) {
    // Le contenu textuel est vide ; le data URL est porte par extractFileForLLM().
    // Pour la retrocompatibilite, on retourne un marqueur lisible.
    return `[IMAGE: ${file.name}] (envoyee au modele vision - le LLM peut la decrire)`;
  }

  throw new Error(
    `Type de fichier non supporté: ${fileType || fileName}. Types supportés: PDF, DOCX, XLSX, TXT, MD, CSV, JSON, code et images (PNG/JPG/WebP).`,
  );
}

/**
 * Extracteur enrichi : retourne content + dataUrl pour images, kind pour
 * routage cote prompt LLM.
 */
export interface ExtractedFile {
  content: string;
  dataUrl?: string;
  kind: "text" | "image";
}

export async function extractFileForLLM(file: File): Promise<ExtractedFile> {
  const fileName = file.name.toLowerCase();
  const isImage =
    file.type.startsWith("image/") ||
    fileName.endsWith(".png") ||
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg") ||
    fileName.endsWith(".webp") ||
    fileName.endsWith(".gif");

  if (isImage) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("FileReader echec"));
      reader.readAsDataURL(file);
    });
    return {
      content: `[IMAGE: ${file.name}]`,
      dataUrl,
      kind: "image",
    };
  }

  const content = await extractTextFromFile(file);
  return { content, kind: "text" };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

export function getFileIcon(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  
  const iconMap: Record<string, string> = {
    txt: "📄",
    md: "📝",
    pdf: "📕",
    doc: "📘",
    docx: "📘",
    xls: "📗",
    xlsx: "📗",
    csv: "📊",
    json: "📋",
    xml: "📋",
    py: "🐍",
    js: "📜",
    ts: "📘",
    sql: "🗃️",
    sh: "⚙️",
  };
  
  return iconMap[ext] || "📄";
}
