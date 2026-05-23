import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { promptHistory } from "@/lib/prompts";
import { topTerms } from "@/lib/tags";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Topic/tag cloud: frequent terms extracted locally from prompt text (no LLM).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 40), 1), 200);
  try {
    const prompts = promptHistory(db, 500);
    return NextResponse.json({ terms: topTerms(prompts.map((p) => p.text ?? ""), limit) });
  } catch (err) {
    log.error("/api/tags failed", err);
    return NextResponse.json({ terms: [] });
  }
}
