import { describe, expect, it } from "vitest";
import { filterCommands, type CommandItem } from "@/lib/command-palette";

const cmds: CommandItem[] = [
  { id: "1", label: "Open session shopify-bot", group: "Sessions" },
  { id: "2", label: "Filter: last 7 days", group: "Range", keywords: "time week" },
  { id: "3", label: "Reset layout", group: "Actions" },
];

describe("filterCommands", () => {
  it("returns all commands for an empty query", () => {
    expect(filterCommands(cmds, "")).toHaveLength(3);
  });

  it("matches against label, group and keywords", () => {
    expect(filterCommands(cmds, "shopify").map((c) => c.id)).toEqual(["1"]);
    expect(filterCommands(cmds, "range").map((c) => c.id)).toEqual(["2"]);
    expect(filterCommands(cmds, "week").map((c) => c.id)).toEqual(["2"]);
  });

  it("requires all terms to match (AND)", () => {
    expect(filterCommands(cmds, "filter days").map((c) => c.id)).toEqual(["2"]);
    expect(filterCommands(cmds, "filter reset")).toHaveLength(0);
  });

  it("is case-insensitive", () => {
    expect(filterCommands(cmds, "RESET").map((c) => c.id)).toEqual(["3"]);
  });
});
