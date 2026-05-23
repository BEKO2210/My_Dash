// Derive a file-change estimate from an Edit/Write/NotebookEdit tool_input, so we
// can track which files get touched and how much (file-hotspot analytics). Line
// counts are estimates from the payload — Edit knows both sides; Write/NotebookEdit
// only the added content.

export interface FileEdit {
  path: string;
  added: number;
  removed: number;
}

function lineCount(s: unknown): number {
  return typeof s === "string" && s.length > 0 ? s.split("\n").length : 0;
}

export function describeFileEdit(toolName: string | null, input: unknown): FileEdit | null {
  if (!toolName || !input || typeof input !== "object") return null;
  const i = input as Record<string, unknown>;
  switch (toolName) {
    case "Edit":
      if (typeof i.file_path !== "string") return null;
      return { path: i.file_path, added: lineCount(i.new_string), removed: lineCount(i.old_string) };
    case "Write":
      if (typeof i.file_path !== "string") return null;
      return { path: i.file_path, added: lineCount(i.content), removed: 0 };
    case "NotebookEdit":
      if (typeof i.notebook_path !== "string") return null;
      return { path: i.notebook_path, added: lineCount(i.new_source), removed: 0 };
    default:
      return null;
  }
}
