import { describe, it, expect } from "vitest";
import { parseReasoning, summarizeThinking } from "../reasoning-parser";

describe("parseReasoning", () => {
  it("returns raw text when no markers", () => {
    const result = parseReasoning("Bonjour, voici la réponse simple.");
    expect(result.hasStructuredReasoning).toBe(false);
    expect(result.finalAnswer).toBe("Bonjour, voici la réponse simple.");
    expect(result.phases).toEqual([]);
  });

  it("handles empty input", () => {
    const result = parseReasoning("");
    expect(result.hasStructuredReasoning).toBe(false);
    expect(result.finalAnswer).toBe("");
  });

  it("extracts all 4 phases in order", () => {
    const text = `[PLAN]
- charger Hub'Eau
- styliser
[EXECUTE] loadHubEauStations(...)
[VERIFY] count=147 OK
[REPORT] 147 stations chargées.`;
    const result = parseReasoning(text);
    expect(result.hasStructuredReasoning).toBe(true);
    expect(result.phases).toHaveLength(4);
    expect(result.phases[0].phase).toBe("plan");
    expect(result.phases[1].phase).toBe("execute");
    expect(result.phases[2].phase).toBe("verify");
    expect(result.phases[3].phase).toBe("report");
    expect(result.finalAnswer).toBe("147 stations chargées.");
  });

  it("uses last REPORT when multiple phases", () => {
    const text = "[PLAN] x [REPORT] première [EXECUTE] y [REPORT] finale";
    const result = parseReasoning(text);
    expect(result.finalAnswer).toBe("finale");
  });

  it("falls back to last phase if no REPORT", () => {
    const text = "[PLAN] alpha [EXECUTE] beta [VERIFY] gamma";
    const result = parseReasoning(text);
    expect(result.finalAnswer).toBe("gamma");
  });

  it("is case-insensitive on markers", () => {
    const text = "[plan] a [Execute] b [REPORT] c";
    const result = parseReasoning(text);
    expect(result.phases).toHaveLength(3);
    expect(result.finalAnswer).toBe("c");
  });

  it("captures prefix text before first marker as plan", () => {
    const text = "Petit commentaire libre. [EXECUTE] action [REPORT] ok";
    const result = parseReasoning(text);
    expect(result.phases[0].phase).toBe("plan");
    expect(result.phases[0].content).toContain("commentaire libre");
  });

  it("ignores empty phase content", () => {
    const text = "[PLAN]   [EXECUTE]   [REPORT] résultat";
    const result = parseReasoning(text);
    expect(result.phases).toHaveLength(1);
    expect(result.phases[0].phase).toBe("report");
  });
});

describe("summarizeThinking", () => {
  it("returns empty string when no structured reasoning", () => {
    const parsed = parseReasoning("texte simple");
    expect(summarizeThinking(parsed)).toBe("");
  });

  it("excludes REPORT from summary", () => {
    const parsed = parseReasoning("[PLAN] a [EXECUTE] b [REPORT] c");
    const summary = summarizeThinking(parsed);
    expect(summary).toContain("PLAN");
    expect(summary).toContain("EXECUTE");
    expect(summary).not.toContain("[REPORT]");
    expect(summary).not.toContain("c");
  });

  it("returns empty when only REPORT phase", () => {
    const parsed = parseReasoning("[REPORT] juste la réponse");
    expect(summarizeThinking(parsed)).toBe("");
  });
});
