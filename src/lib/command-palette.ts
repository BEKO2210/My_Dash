// Pure command-list filtering for the ⌘K palette. Multi-term substring match over
// each command's label, group and keywords — kept here so it's unit-testable.

export interface CommandItem {
  id: string;
  label: string;
  group: string;
  keywords?: string;
}

export function filterCommands<T extends CommandItem>(commands: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  const terms = q.split(/\s+/);
  return commands.filter((c) => {
    const hay = `${c.label} ${c.group} ${c.keywords ?? ""}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}
