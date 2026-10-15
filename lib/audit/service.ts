import { getSupabaseServerClient } from "@/lib/supabase-server"
import { getProvider, type LookupProvider } from "./lookup"
import { scoreProfile, toTeaser } from "./score"
import type { AuditReport } from "./types"

/** Re-running within this window returns the existing audit instead of calling Instagram again. */
export const REUSE_WINDOW_MS = 10 * 60 * 1000

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (s: string) => UUID_RE.test(s)

function parseJson<T>(v: unknown): T {
  return (typeof v === "string" ? JSON.parse(v) : v) as T
}

/**
 * Audits the signed-in user's own account. The report belongs to that user (audits.user_id) and
 * is only ever returned to them (see getAuditView).
 */
export async function createOwnAudit(
  userId: string,
  provider: LookupProvider = getProvider(),
  now = Date.now()
): Promise<{ id: string; reused: boolean }> {
  const db = await getSupabaseServerClient()

  const since = new Date(now - REUSE_WINDOW_MS).toISOString()
  const { data: recent } = await db
    .from("audits")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "ready")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
  if (Array.isArray(recent) && recent.length > 0) return { id: recent[0].id, reused: true }

  const profile = await provider.fetchOwnProfile(userId)
  const report = scoreProfile(profile, new Date(now))

  const { data, error } = await db.from("audits").insert({
    ig_username: profile.username.toLowerCase(),
    user_id: userId,
    tier: "connected",
    status: "ready",
    score: report.score,
    teaser: toTeaser(report),
    report,
  })
  if (error || !data) throw new Error("Failed to save audit")

  const { data: u } = await db.from("users").select("signup_source").eq("id", userId).single()
  if (u && !u.signup_source) await db.from("users").update({ signup_source: "audit" }).eq("id", userId)

  return { id: data.id, reused: false }
}

export interface AuditView {
  id: string
  report: AuditReport
  createdAt: string
}

/** Owner-only. Anyone else (including anonymous) gets null, which the API turns into a 404. */
export async function getAuditView(id: string, sessionUserId: string | null): Promise<AuditView | null> {
  if (!sessionUserId || !isUuid(id)) return null
  const db = await getSupabaseServerClient()
  const { data } = await db.from("audits").select("id, user_id, report, status, created_at").eq("id", id).single()
  if (!data || data.status !== "ready" || !data.report) return null
  if (data.user_id === null || String(data.user_id) !== String(sessionUserId)) return null
  return { id: data.id, report: parseJson<AuditReport>(data.report), createdAt: new Date(data.created_at).toISOString() }
}

/** True when the audit exists and belongs to the user (used to link leads safely). */
export async function auditBelongsTo(id: string, userId: string): Promise<boolean> {
  if (!isUuid(id)) return false
  const db = await getSupabaseServerClient()
  const { data } = await db.from("audits").select("user_id").eq("id", id).single()
  return !!data && data.user_id !== null && String(data.user_id) === String(userId)
}
