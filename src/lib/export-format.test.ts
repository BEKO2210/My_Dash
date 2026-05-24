import { describe, expect, it } from "vitest";
import { toCsv, toJson } from "@/lib/export-format";

describe("toJson", () => {
  it("pretty-prints", () => {
    expect(toJson({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
});

describe("toCsv", () => {
  it("writes a header and rows with CRLF and a trailing newline", () => {
    const csv = toCsv([
      { id: 1, name: "a" },
      { id: 2, name: "b" },
    ]);
    expect(csv).toBe("id,name\r\n1,a\r\n2,b\r\n");
  });

  it("escapes commas, quotes, and newlines per RFC 4180", () => {
    const csv = toCsv([{ text: 'he said "hi", ok', note: "line1\nline2" }]);
    expect(csv).toBe('text,note\r\n"he said ""hi"", ok","line1\nline2"\r\n');
  });

  it("serializes objects/arrays as JSON and blanks null/undefined", () => {
    const csv = toCsv([{ meta: { k: 1 }, tags: ["x", "y"], empty: null, missing: undefined }]);
    expect(csv).toBe('meta,tags,empty,missing\r\n"{""k"":1}","[""x"",""y""]",,\r\n');
  });

  it("unions keys across heterogeneous rows in first-seen order", () => {
    const csv = toCsv([{ a: 1 }, { b: 2 }]);
    expect(csv).toBe("a,b\r\n1,\r\n,2\r\n");
  });

  it("respects an explicit column list", () => {
    const csv = toCsv([{ a: 1, b: 2, c: 3 }], ["c", "a"]);
    expect(csv).toBe("c,a\r\n3,1\r\n");
  });

  it("returns the header alone for empty rows with explicit columns, and '' with none", () => {
    expect(toCsv([], ["a", "b"])).toBe("a,b\r\n");
    expect(toCsv([])).toBe("");
  });
});
