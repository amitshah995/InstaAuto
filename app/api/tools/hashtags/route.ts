import { type NextRequest, NextResponse } from "next/server"
import { generateHashtags, HashtagAiError } from "@/lib/tools/hashtag-ai"

export const maxDuration = 30

// POST /api/tools/hashtags  (public, no login)  body: { keywords: string | string[] }
// Cost guard: each call is one small Haiku request (about 1,500 output tokens at most), limited per visitor.
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 10
const hits = new Map<string, number[]>() // best-effort per server instance

function tooMany(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k)
  return recent.length > MAX_PER_WINDOW
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || process.env.HASHTAG_AI_ENABLED === "0") return NextResponse.json({ error: "The hashtag generator is not available right now." }, { status: 503 })

  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown"
  if (tooMany(ip)) return NextResponse.json({ error: "You have used the generator a lot. Please try again in an hour." }, { status: 429 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }) }

  try {
    const out = await generateHashtags(body?.keywords, { apiKey })
    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    if (e instanceof HashtagAiError && e.kind === "input") return NextResponse.json({ error: e.message }, { status: 400 })
    console.error("[hashtags] failed:", e instanceof Error ? e.message : "unknown")
    return NextResponse.json({ error: "Could not generate hashtags right now. Please try again." }, { status: 502 })
  }
}
