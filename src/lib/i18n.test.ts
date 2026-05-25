import { describe, expect, it } from "vitest";
import { translate, tFormat } from "@/lib/i18n";

describe("tFormat (placeholder interpolation)", () => {
  it("interpolates named placeholders", () => {
    expect(tFormat("Error rate {rate}% (≥ {threshold}%)", { rate: 45, threshold: 30 })).toBe(
      "Error rate 45% (≥ 30%)",
    );
  });

  it("leaves unknown placeholders intact", () => {
    expect(tFormat("Hi {name}", {})).toBe("Hi {name}");
  });

  it("coerces string and number params", () => {
    expect(tFormat("{tool} x{n}", { tool: "Bash", n: 2 })).toBe("Bash x2");
  });
});

describe("alert message templates (#30) — localized end-to-end", () => {
  const types = ["mcp_error", "error_spike", "session_long", "cost_session"];

  it("every alert type has a real DE and EN template (not the raw key)", () => {
    for (const ty of types) {
      expect(translate("de", `alert.${ty}`), `${ty} DE`).not.toBe(`alert.${ty}`);
      expect(translate("en", `alert.${ty}`), `${ty} EN`).not.toBe(`alert.${ty}`);
    }
  });

  it("renders params into the active language", () => {
    expect(tFormat(translate("en", "alert.error_spike"), { rate: 45, threshold: 30 })).toBe(
      "Error rate 45% (≥ 30%)",
    );
    expect(tFormat(translate("de", "alert.error_spike"), { rate: 45, threshold: 30 })).toBe(
      "Fehlerrate 45% (≥ 30%)",
    );
    expect(tFormat(translate("en", "alert.mcp_error"), { tool: "Bash" })).toBe("MCP tool failed: Bash");
  });
});
