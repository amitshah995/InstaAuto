import { z } from "zod"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { isUuid } from "@/lib/audit/service"
import type { AuditReport } from "@/lib/audit/types"
import { buildFacts, GOALS, type AiBrief } from "./facts"
import { generateAiReport, AiReportError } from "./generate"
import type { AiReport } from "./schema"

export const MAX_RUNS_PER_AUDIT = 2
export const MAX_RUNS_PER_USER_PER_DAY = 4

const short = (max: number) => z.string().trim().min(2).max(max)
export const BriefSchema = z.object({
  niche: short(80),
  goal: z.enum(GOALS),
  audience: short(120),
  offer: short(160),
  postsPerWeek: z.number().int().min(1).max(14),
  language: z.enum(["en", "hinglish"]),
})

const parse = <T,>(v: unknown): T => (typeof v === "string" ? JSON.parse(v) : v) as T

export interface SavedAiReport { report: AiReport; brief: AiBrief; generatedAt: string; runsLeft: number }

export async function getSavedAiReport(id: string, userId: string | null): Promise<SavedAiReport | null> {
  if (!userId || !isUuid(id)) return null
  const db = await getSupabaseServerClient()
  const { data } = await db.from("audits").select("user_id, ai_report, ai_brief, ai_generated_at, ai_runs").eq("id", id).single()
  if (!data || String(data.user_id) !== String(userId) || !data.ai_report) return null
  return {
    report: parse<AiReport>(data.ai_report),
    brief: parse<AiBrief>(data.ai_brief),
    generatedAt: new Date(data.ai_generated_at).toISOString(),
    runsLeft: Math.max(0, MAX_RUNS_PER_AUDIT - (data.ai_runs ?? 0)),
  }
}

export type CreateOutcome =
  | { ok: true; saved: SavedAiReport }
  | { ok: false; status: number; error: string }

export async function createAiReport(id: string, userId: string, brief: AiBrief, apiKey: string): Promise<CreateOutcome> {
  if (!isUuid(id)) return { ok: false, status: 404, error: "Audit not found" }
  const db = await getSupabaseServerClient()
  const { data: row } = await db.from("audits").select("user_id, report, status, ai_runs").eq("id", id).single()
  if (!row || row.status !== "ready" || !row.report || String(row.user_id) !== String(userId)) return { ok: false, status: 404, error: "Audit not found" }
  if ((row.ai_runs ?? 0) >= MAX_RUNS_PER_AUDIT) return { ok: false, status: 429, error: "AI report limit reached for this audit. Run a fresh audit to generate another." }

  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { data: recent } = await db.from("audits").select("id").eq("user_id", userId).gte("ai_generated_at", since)
  if (Array.isArray(recent) && recent.length >= MAX_RUNS_PER_USER_PER_DAY) return { ok: false, status: 429, error: "Daily AI report limit reached. Try again tomorrow." }

  let facts
  try { facts = buildFacts(parse<AuditReport>(row.report)) } catch { return { ok: false, status: 422, error: "This audit has no post data. Run a new audit and try again." } }

  // Count the attempt before calling the model so a failing loop cannot burn credits.
  await db.from("audits").update({ ai_runs: (row.ai_runs ?? 0) + 1 }).eq("id", id)

  try {
    const { report } = await generateAiReport(facts, brief, { apiKey })
    const generatedAt = new Date().toISOString()
    await db.from("audits").update({ ai_report: report, ai_brief: brief, ai_generated_at: generatedAt }).eq("id", id)
    return { ok: true, saved: { report, brief, generatedAt, runsLeft: Math.max(0, MAX_RUNS_PER_AUDIT - ((row.ai_runs ?? 0) + 1)) } }
  } catch (e) {
    const kind = e instanceof AiReportError ? e.kind : "api"
    console.error("[ai-report] failed", kind, e instanceof Error ? e.message.slice(0, 300) : "")
    return { ok: false, status: kind === "timeout" ? 504 : 502, error: "Could not generate the report right now. Please try again in a minute." }
  }
}
