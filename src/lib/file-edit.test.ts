import { describe, expect, it } from "vitest";
import { describeFileEdit } from "@/lib/file-edit";

describe("describeFileEdit", () => {
  it("counts both sides for an Edit", () => {
    expect(
      describeFileEdit("Edit", { file_path: "/a.ts", old_string: "x\ny", new_string: "x\ny\nz" }),
    ).toEqual({ path: "/a.ts", added: 3, removed: 2 });
  });

  it("counts added content for a Write (removed unknown -> 0)", () => {
    expect(describeFileEdit("Write", { file_path: "/b.ts", content: "a\nb\nc\nd" })).toEqual({
      path: "/b.ts",
      added: 4,
      removed: 0,
    });
  });

  it("uses notebook_path and new_source for NotebookEdit", () => {
    expect(
      describeFileEdit("NotebookEdit", { notebook_path: "/n.ipynb", new_source: "print(1)" }),
    ).toEqual({ path: "/n.ipynb", added: 1, removed: 0 });
  });

  it("treats empty strings as zero lines", () => {
    expect(describeFileEdit("Edit", { file_path: "/a.ts", old_string: "gone", new_string: "" })).toEqual(
      { path: "/a.ts", added: 0, removed: 1 },
    );
  });

  it("returns null for non-file tools or a missing path", () => {
    expect(describeFileEdit("Bash", { command: "ls" })).toBeNull();
    expect(describeFileEdit("Edit", { old_string: "x", new_string: "y" })).toBeNull();
    expect(describeFileEdit(null, {})).toBeNull();
  });
});
