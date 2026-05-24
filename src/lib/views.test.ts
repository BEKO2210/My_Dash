import { describe, expect, it } from "vitest";
import { sanitizeViews, upsertView, type SavedView } from "@/lib/views";

const valid = ["a", "b", "c"];

const view = (over: Partial<SavedView> = {}): SavedView => ({
  name: "v",
  order: ["a", "b"],
  sizes: {},
  hidden: [],
  project: "",
  status: "",
  range: "all",
  ...over,
});

describe("sanitizeViews", () => {
  it("keeps valid views and scrubs unknown ids / bad fields", () => {
    const out = sanitizeViews(
      [
        {
          name: "Mine",
          order: ["a", "zzz", "b"],
          sizes: { a: { span: "lg:col-span-4", height: "h-auto" }, zzz: { span: "x", height: "y" } },
          hidden: ["c", 5],
          project: "alpha",
          status: "active",
          range: "7d",
        },
      ],
      valid,
    );
    expect(out).toHaveLength(1);
    expect(out[0].order).toEqual(["a", "b"]);
    expect(out[0].sizes).toEqual({ a: { span: "lg:col-span-4", height: "h-auto" } });
    expect(out[0].hidden).toEqual(["c"]);
    expect(out[0].project).toBe("alpha");
    expect(out[0].range).toBe("7d");
  });

  it("drops nameless views and falls back to safe defaults", () => {
    const out = sanitizeViews([{ name: "  " }, { name: "ok", range: "bogus", status: "weird" }], valid);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: "ok", range: "all", status: "" });
  });

  it("returns an empty array for non-array input", () => {
    expect(sanitizeViews(null, valid)).toEqual([]);
  });
});

describe("upsertView", () => {
  it("appends a new view", () => {
    expect(upsertView([], view({ name: "x" }))).toHaveLength(1);
  });

  it("replaces an existing view by case-insensitive name", () => {
    const out = upsertView([view({ name: "Home", range: "7d" })], view({ name: "home", range: "30d" }));
    expect(out).toHaveLength(1);
    expect(out[0].range).toBe("30d");
  });
});
