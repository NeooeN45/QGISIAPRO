import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENT_SIZE_MB,
  extractAttachment,
  formatAttachmentsForPrompt,
  getImageDataUrls,
  type ExtractedAttachment,
} from "../file-attachments";

function makeFile(name: string, content: string, type = "text/plain"): File {
  return new File([content], name, { type });
}

describe("extractAttachment - text", () => {
  it("extracts plain text content", async () => {
    const f = makeFile("notes.txt", "Hello world\nContenu test");
    const att = await extractAttachment(f);
    expect(att.kind).toBe("text");
    expect(att.textContent).toContain("Hello world");
    expect(att.warning).toBeUndefined();
  });

  it("flags empty text files with warning", async () => {
    const f = makeFile("empty.txt", "   \n\t  ");
    const att = await extractAttachment(f);
    expect(att.textContent).toBe("");
    expect(att.warning).toMatch(/Aucun texte/i);
  });

  it("truncates oversized text content", async () => {
    const huge = "x".repeat(60_000);
    const f = makeFile("huge.txt", huge);
    const att = await extractAttachment(f);
    expect(att.textContent.length).toBeLessThanOrEqual(60_000);
    expect(att.warning).toMatch(/tronque/i);
  });

  it("recognizes csv as text by extension", async () => {
    const f = makeFile("data.csv", "id,name\n1,foo", "application/octet-stream");
    const att = await extractAttachment(f);
    expect(att.kind).toBe("text");
  });
});

describe("extractAttachment - size limit", () => {
  it("rejects files above MAX_ATTACHMENT_SIZE_MB", async () => {
    const big = new File([new Uint8Array((MAX_ATTACHMENT_SIZE_MB + 1) * 1024 * 1024)], "big.bin", {
      type: "application/octet-stream",
    });
    const att = await extractAttachment(big);
    expect(att.warning).toMatch(/trop volumineux/i);
  });
});

describe("extractAttachment - unknown formats", () => {
  it("flags unknown binary formats", async () => {
    const f = new File([new Uint8Array([1, 2, 3])], "weird.xyz", {
      type: "application/octet-stream",
    });
    const att = await extractAttachment(f);
    expect(att.kind).toBe("unknown");
    expect(att.warning).toMatch(/non supporte/i);
  });
});

describe("formatAttachmentsForPrompt", () => {
  it("returns empty string when no textual attachments", () => {
    expect(formatAttachmentsForPrompt([])).toBe("");
  });

  it("ignores images-only attachments", () => {
    const att: ExtractedAttachment = {
      name: "photo.jpg",
      size: 100,
      mimeType: "image/jpeg",
      kind: "image",
      textContent: "",
      dataUrl: "data:image/jpeg;base64,xxx",
    };
    expect(formatAttachmentsForPrompt([att])).toBe("");
  });

  it("formats single text attachment with header", () => {
    const att: ExtractedAttachment = {
      name: "notes.txt",
      size: 1024,
      mimeType: "text/plain",
      kind: "text",
      textContent: "Le contenu",
    };
    const out = formatAttachmentsForPrompt([att]);
    expect(out).toContain("Pieces jointes");
    expect(out).toContain("notes.txt");
    expect(out).toContain("Le contenu");
    expect(out).toContain("TEXT");
  });

  it("includes multiple attachments separated", () => {
    const a1: ExtractedAttachment = {
      name: "a.txt", size: 10, mimeType: "text/plain", kind: "text", textContent: "AAA",
    };
    const a2: ExtractedAttachment = {
      name: "b.md", size: 20, mimeType: "text/markdown", kind: "text", textContent: "BBB",
    };
    const out = formatAttachmentsForPrompt([a1, a2]);
    expect(out).toContain("a.txt");
    expect(out).toContain("b.md");
    expect(out).toContain("AAA");
    expect(out).toContain("BBB");
  });
});

describe("getImageDataUrls", () => {
  it("returns only image attachments with dataUrl", () => {
    const items: ExtractedAttachment[] = [
      { name: "txt.txt", size: 10, mimeType: "text/plain", kind: "text", textContent: "x" },
      { name: "img.png", size: 100, mimeType: "image/png", kind: "image", textContent: "", dataUrl: "data:image/png;base64,A" },
      { name: "broken.jpg", size: 100, mimeType: "image/jpeg", kind: "image", textContent: "" },
    ];
    const urls = getImageDataUrls(items);
    expect(urls).toHaveLength(1);
    expect(urls[0].name).toBe("img.png");
  });

  it("returns empty array when no images", () => {
    expect(getImageDataUrls([])).toEqual([]);
  });
});
