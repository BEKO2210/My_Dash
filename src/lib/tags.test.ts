import { describe, expect, it } from "vitest";
import { topTerms } from "@/lib/tags";

describe("topTerms", () => {
  it("counts terms, sorted by frequency then name", () => {
    const terms = topTerms([
      "Refactor the ingest pipeline",
      "ingest pipeline cleanup",
      "ingest tests",
    ]);
    expect(terms[0]).toEqual({ term: "ingest", count: 3 });
    expect(terms.find((t) => t.term === "pipeline")?.count).toBe(2);
  });

  it("drops stop words, short tokens and pure numbers", () => {
    const terms = topTerms(["the widget is 42 ok"]);
    const words = terms.map((t) => t.term);
    expect(words).toContain("widget");
    expect(words).not.toContain("the"); // stop word
    expect(words).not.toContain("is"); // stop word + short
    expect(words).not.toContain("ok"); // too short (< 3)
    expect(words).not.toContain("42"); // pure number
  });

  it("handles German stop words and umlauts", () => {
    const terms = topTerms(["Bitte die Übersicht für das Widget verbessern"]);
    const words = terms.map((t) => t.term);
    expect(words).toContain("übersicht");
    expect(words).toContain("widget");
    expect(words).toContain("verbessern");
    expect(words).not.toContain("bitte");
    expect(words).not.toContain("die");
  });

  it("respects the limit and tolerates empty input", () => {
    expect(topTerms([])).toEqual([]);
    expect(topTerms(["alpha beta gamma delta"], 2)).toHaveLength(2);
  });
});
