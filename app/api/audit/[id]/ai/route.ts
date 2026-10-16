import { type NextRequest, NextResponse } from "next/server"
import { getVerifiedSessionUserId } from "@/lib/auth"
import { BriefSchema, createAiReport, getSavedAiReport } from "@/lib/audit/ai/service"

export const maxDuration = 60
const NO_STORE = { "Cache-Control": "private, no-store" }

// GET: saved AI report for the owner (404 for anyone else).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const saved = await getSavedAiReport(id, getVerifiedSessionUserId(request))
  if (!saved) return NextResponse.json({ error: "No AI report yet" }, { status: 404 })
  return NextResponse.json(saved, { headers: NO_STORE })
}

// POST: generate (demo mode, free, capped per audit and per user per day).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = getVerifiedSessionUserId(request)
  if (!userId) return NextResponse.json({ error: "Please log in" }, { status: 401 })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || process.env.AI_REPORT_ENABLED === "0") return NextResponse.json({ error: "AI report is not available yet." }, { status: 503 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }) }
  const parsed = BriefSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Please fill every field correctly", issues: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 400 })

  const out = await createAiReport(id, userId, parsed.data, apiKey)
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status, headers: NO_STORE })
  return NextResponse.json(out.saved, { headers: NO_STORE })
}
