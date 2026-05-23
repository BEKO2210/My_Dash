// Local, LLM-free keyword extraction from prompt text for the topic/tag cloud.
// Lowercase, split on non-word chars, drop stop words / pure numbers / short
// tokens, then count. German + English stop words since prompts are mixed.

export interface TermCount {
  term: string;
  count: number;
}

const STOP = new Set<string>([
  // German
  "der", "die", "das", "und", "oder", "aber", "ist", "sind", "war", "wird", "werden", "wurde",
  "ein", "eine", "einen", "einem", "einer", "eines", "den", "dem", "des", "auf", "für", "mit",
  "von", "vom", "zum", "zur", "aus", "bei", "nach", "über", "unter", "auch", "noch", "schon",
  "nur", "nicht", "kein", "keine", "man", "ich", "wir", "ihr", "sie", "mir", "mich", "dich",
  "dir", "uns", "euch", "ihn", "ihm", "hier", "dort", "dann", "wenn", "weil", "dass", "als",
  "wie", "was", "wer", "wo", "wann", "warum", "soll", "sollte", "kann", "könnte", "muss",
  "mach", "mache", "machen", "bitte", "alle", "alles", "dem", "im", "am", "an", "zu", "so",
  // English
  "the", "and", "for", "are", "was", "were", "with", "from", "this", "that", "these", "those",
  "you", "your", "our", "their", "its", "have", "has", "had", "will", "would", "could", "should",
  "can", "may", "might", "must", "not", "but", "all", "any", "into", "out", "off", "over",
  "then", "than", "when", "where", "what", "which", "who", "why", "how", "please", "make",
  "use", "using", "add", "let", "get", "set", "run", "new", "via", "per", "also", "just",
]);

export function topTerms(texts: string[], limit = 40, minLen = 3): TermCount[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    if (!text) continue;
    for (const raw of text.toLowerCase().split(/[^a-z0-9äöüß]+/)) {
      if (raw.length < minLen) continue;
      if (STOP.has(raw)) continue;
      if (/^\d+$/.test(raw)) continue;
      counts.set(raw, (counts.get(raw) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, limit);
}
