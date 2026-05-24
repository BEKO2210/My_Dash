// Minimal LCS line diff for the tool-call inspector (Edit/Write changes). Pure
// so it's unit-testable; the UI colours add/del/same lines green/red/grey.

export interface DiffLine {
  type: "add" | "del" | "same";
  text: string;
}

export function diffLines(a: string, b: string): DiffLine[] {
  const aL = a.length ? a.split("\n") : [];
  const bL = b.length ? b.split("\n") : [];
  const n = aL.length;
  const m = bL.length;

  // dp[i][j] = LCS length of aL[i:] and bL[j:].
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = aL[i] === bL[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aL[i] === bL[j]) {
      out.push({ type: "same", text: aL[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: aL[i] });
      i++;
    } else {
      out.push({ type: "add", text: bL[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: "del", text: aL[i++] });
  while (j < m) out.push({ type: "add", text: bL[j++] });
  return out;
}

export function diffStat(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.type === "add") added++;
    else if (l.type === "del") removed++;
  }
  return { added, removed };
}
