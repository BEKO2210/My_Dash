import { describe, expect, it } from "vitest";
import { widgets, widgetTitle } from "@/plugins/registry";
import { externalWidgets } from "@/plugins/external.generated";
import { translate } from "@/lib/i18n";

const CATEGORIES = ["overview", "sessions", "economy", "activity", "tools", "quality"];

// Built-in widgets ship with a titleKey; external/third-party ones may not.
const builtins = widgets.filter((w) => !externalWidgets.includes(w));

describe("widget registry manifest", () => {
  it("has unique widget ids", () => {
    const ids = widgets.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every widget complete manifest metadata", () => {
    for (const w of widgets) {
      expect(w.id, "id").toBeTruthy();
      expect(w.title, `${w.id} title`).toBeTruthy();
      expect(w.span, `${w.id} span`).toMatch(/col-span/);
      expect(w.height, `${w.id} height`).toBeTruthy();
      expect(w.icon, `${w.id} icon`).toBeTruthy();
      expect(CATEGORIES, `${w.id} category`).toContain(w.category);
      expect(w.description, `${w.id} description`).toMatch(/\./); // i18n key
      expect(typeof w.component, `${w.id} component`).toBe("function");
    }
  });
});

describe("widget display-name i18n (#11)", () => {
  it("every built-in widget declares a titleKey", () => {
    for (const w of builtins) {
      expect(w.titleKey, `${w.id} titleKey`).toBeTruthy();
    }
  });

  it("every titleKey resolves to a real DE and EN string (not the raw key)", () => {
    for (const w of builtins) {
      const key = w.titleKey!;
      const de = translate("de", key);
      const en = translate("en", key);
      expect(de, `${w.id} DE`).toBeTruthy();
      expect(en, `${w.id} EN`).toBeTruthy();
      expect(de, `${w.id} DE not raw key`).not.toBe(key);
      expect(en, `${w.id} EN not raw key`).not.toBe(key);
    }
  });

  it("widgetTitle follows the active language", () => {
    const en = (k: string) => translate("en", k);
    const de = (k: string) => translate("de", k);
    for (const w of builtins) {
      expect(widgetTitle(w, en)).toBe(translate("en", w.titleKey!));
      expect(widgetTitle(w, de)).toBe(translate("de", w.titleKey!));
    }
  });

  it("EN gallery names are not the hardcoded German literals (where locales differ)", () => {
    const en = (k: string) => translate("en", k);
    const byId = new Map(widgets.map((w) => [w.id, w]));
    // Spot-check widgets whose German and English names genuinely differ.
    expect(widgetTitle(byId.get("kpi-bar")!, en)).not.toBe("Übersicht");
    expect(widgetTitle(byId.get("error-rate")!, en)).not.toBe("Fehlerrate");
    expect(widgetTitle(byId.get("model-donut")!, en)).not.toBe("Modelle");
    expect(widgetTitle(byId.get("file-hotspots")!, en)).not.toBe("Datei-Hotspots");
  });

  it("falls back to the literal title for widgets without a titleKey", () => {
    const stub = { id: "x", title: "Reference Plugin", span: "", height: "", icon: (() => null) as never, category: "tools" as const, description: "x", component: () => null };
    expect(widgetTitle(stub, (k) => `T:${k}`)).toBe("Reference Plugin");
  });
});
