import { describe, expect, it } from "vitest";
import {
  buildGeminiParts,
  buildOpenRouterUserContent,
  filterValidImages,
  parseDataUrl,
} from "../vision-multipart";

const PNG_DATAURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
const JPG_DATAURL = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
const BAD_DATAURL = "not-a-dataurl";

describe("parseDataUrl", () => {
  it("extracts mime and base64 from valid data URL", () => {
    const r = parseDataUrl(PNG_DATAURL);
    expect(r).not.toBeNull();
    expect(r!.mimeType).toBe("image/png");
    expect(r!.base64).toBe("iVBORw0KGgoAAAANSUhEUg==");
  });

  it("returns null on invalid input", () => {
    expect(parseDataUrl(BAD_DATAURL)).toBeNull();
    expect(parseDataUrl("")).toBeNull();
  });

  it("handles jpeg mime", () => {
    const r = parseDataUrl(JPG_DATAURL);
    expect(r!.mimeType).toBe("image/jpeg");
  });
});

describe("buildOpenRouterUserContent", () => {
  it("returns plain string when no images", () => {
    const out = buildOpenRouterUserContent("Hello", []);
    expect(out).toBe("Hello");
  });

  it("returns multipart array when images present", () => {
    const out = buildOpenRouterUserContent("Décris cette image", [
      { name: "photo.png", dataUrl: PNG_DATAURL },
    ]);
    expect(Array.isArray(out)).toBe(true);
    const arr = out as Array<{ type: string }>;
    expect(arr).toHaveLength(2);
    expect(arr[0].type).toBe("text");
    expect(arr[1].type).toBe("image_url");
  });

  it("skips images with empty dataUrl", () => {
    const out = buildOpenRouterUserContent("x", [
      { name: "a.png", dataUrl: PNG_DATAURL },
      { name: "broken.png", dataUrl: "" },
    ]);
    expect((out as unknown[]).length).toBe(2); // text + 1 image (broken skipped)
  });

  it("preserves text content", () => {
    const out = buildOpenRouterUserContent("Question text", [
      { name: "x.png", dataUrl: PNG_DATAURL },
    ]) as Array<{ type: string; text?: string }>;
    expect(out[0].text).toBe("Question text");
  });
});

describe("buildGeminiParts", () => {
  it("always returns parts array with text first", () => {
    const parts = buildGeminiParts("Hello", []);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ text: "Hello" });
  });

  it("appends inlineData for valid images", () => {
    const parts = buildGeminiParts("Décris", [
      { name: "p.png", dataUrl: PNG_DATAURL },
    ]);
    expect(parts).toHaveLength(2);
    expect("inlineData" in parts[1]).toBe(true);
    if ("inlineData" in parts[1]) {
      expect(parts[1].inlineData.mimeType).toBe("image/png");
      expect(parts[1].inlineData.data).not.toContain("data:");
    }
  });

  it("ignores invalid data URLs", () => {
    const parts = buildGeminiParts("x", [
      { name: "ok.png", dataUrl: PNG_DATAURL },
      { name: "bad.png", dataUrl: BAD_DATAURL },
    ]);
    expect(parts).toHaveLength(2); // text + 1 valid
  });
});

describe("filterValidImages", () => {
  it("keeps only valid image data URLs", () => {
    const result = filterValidImages([
      { name: "ok.png", dataUrl: PNG_DATAURL },
      { name: "bad.png", dataUrl: BAD_DATAURL },
      { name: "ok.jpg", dataUrl: JPG_DATAURL },
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.name)).toEqual(["ok.png", "ok.jpg"]);
  });

  it("rejects non-image mime types", () => {
    const result = filterValidImages([
      { name: "x.txt", dataUrl: "data:text/plain;base64,SGVsbG8=" },
    ]);
    expect(result).toHaveLength(0);
  });
});
