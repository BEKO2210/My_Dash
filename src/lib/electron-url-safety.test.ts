import { describe, expect, it } from "vitest";
import { isExternallyOpenable, isInternalNavigation } from "../../electron/url-safety.js";

describe("isExternallyOpenable (#22)", () => {
  it("allows http(s) and mailto", () => {
    expect(isExternallyOpenable("https://example.com")).toBe(true);
    expect(isExternallyOpenable("http://example.com/path?q=1")).toBe(true);
    expect(isExternallyOpenable("mailto:hi@example.com")).toBe(true);
  });

  it("blocks file/smb/custom/javascript/invalid schemes", () => {
    expect(isExternallyOpenable("file:///etc/passwd")).toBe(false);
    expect(isExternallyOpenable("smb://host/share")).toBe(false);
    expect(isExternallyOpenable("javascript:alert(1)")).toBe(false);
    expect(isExternallyOpenable("vscode://x")).toBe(false);
    expect(isExternallyOpenable("not a url")).toBe(false);
    expect(isExternallyOpenable("")).toBe(false);
  });
});

describe("isInternalNavigation (#23)", () => {
  const base = "http://127.0.0.1:3000";

  it("allows same-origin navigation within the dashboard", () => {
    expect(isInternalNavigation("http://127.0.0.1:3000/", base)).toBe(true);
    expect(isInternalNavigation("http://127.0.0.1:3000/session?id=1", base)).toBe(true);
  });

  it("blocks other origins, ports and schemes", () => {
    expect(isInternalNavigation("https://evil.example.com", base)).toBe(false);
    expect(isInternalNavigation("http://127.0.0.1:9999/", base)).toBe(false); // different port
    expect(isInternalNavigation("file:///x", base)).toBe(false);
    expect(isInternalNavigation("garbage", base)).toBe(false);
  });
});
