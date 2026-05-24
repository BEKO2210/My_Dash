import { describe, expect, it } from "vitest";
import { widgets } from "@/plugins/registry";

const CATEGORIES = ["overview", "sessions", "economy", "activity", "tools", "quality"];

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
