import crypto from "crypto"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import {
  getCachedProfile,
  getProvider,
  liveLookupsLastHour,
  LookupError,
  putCachedProfile,
  type LookupProvider,
} from "./lookup"
import { scoreProfile, toTeaser } from "./score"
import type { AuditReport, AuditTeaser } from "./types"

export const MAX_AUDITS_PER_IP_PER_HOUR = 5
const MAX_LIVE_LOOKUPS_PER_HOUR = Number(process.env.AUDIT_MAX_LOOKUPS_PER_HOUR ?? 60)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isUuid = (s: string) => UUID_RE.test(s)

/** Hash of the requester IP, only used for throttling. Never store the raw IP. */
export function hashIp(ip: string): string {
  const salt = process.env.SESSION_SECRET || "audit-throttle"
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32)
}

export class ThrottleError extends Error {}

export async function auditsFromIpLastHour(ipHash: string): Promise<number> {
  const db = await getSupabaseServerClient()
  const since = new Date(Date.now() - 3_600_000).toISOString()
  const { data } = await db.from("audits").select("id").eq("requester_ip_hash", ipHash).gte("created_at", since)
  return Array.isArray(data) ? data.length : 0
}

export async function createPublicAudit(
  username: string,
  ipHash: string,
  provider: LookupProvider = getProvider()
): Promise<{ id: string; teaser: AuditTeaser }> {
  if ((await auditsFromIpLastHour(ipHash)) >= MAX_AUDITS_PER_IP_PER_HOUR) {
    throw new ThrottleError("Too many audits from this network. Try again in an hour.")
  }

  let profile = await getCachedProfile(username)
  if (!profile) {
    if ((await liveLookupsLastHour()) >= MAX_LIVE_LOOKUPS_PER_HOUR) {
      throw new LookupError("rate_limited", "We are busy right now. Please try again shortly.")
    }
    profile = await provider.fetchProfile(username)
    await putCachedProfile(profile)
  }

  const report = scoreProfile(profile)
  const teaser = toTeaser(report)

  const db = await getSupabaseServerClient()
  const { data, error } = await db.from("audits").insert({
    ig_username: username,
    tier: "public",
    status: "ready",
    score: report.score,
    teaser,
    report,
    requester_ip_hash: ipHash,
  })
  if (error || !data) throw new Error("Failed to save audit")
  return { id: data.id, teaser }
}

export interface AuditView {
  id: string
  unlocked: boolean
  teaser: AuditTeaser
  report?: AuditReport
}

function parseJson<T>(v: unknown): T {
  return (typeof v === "string" ? JSON.parse(v) : v) as T
}

/**
 * The gate. `report` is added ONLY when the audit has been claimed by the requesting user.
 * Anonymous and other users receive the teaser, built server-side from the stored teaser column.
 */
export async function getAuditView(id: string, sessionUserId: string | null): Promise<AuditView | null> {
  if (!isUuid(id)) return null
  const db = await getSupabaseServerClient()
  const { data } = await db.from("audits").select("id, user_id, teaser, report, status").eq("id", id).single()
  if (!data || data.status !== "ready") return null

  const teaser = parseJson<AuditTeaser>(data.teaser)
  const unlocked = !!sessionUserId && data.user_id !== null && String(data.user_id) === String(sessionUserId)
  const view: AuditView = { id: data.id, unlocked, teaser }
  if (unlocked && data.report) view.report = parseJson<AuditReport>(data.report)
  return view
}

export type ClaimResult = "claimed" | "already_yours" | "taken" | "not_found"

/**
 * Unlock = attach the audit to the signed-in user. The data is public-source, so this is a
 * lead gate (signup required), not a privacy boundary. One audit belongs to one account.
 */
export async function claimAudit(id: string, userId: string): Promise<ClaimResult> {
  if (!isUuid(id)) return "not_found"
  const db = await getSupabaseServerClient()
  const { data } = await db.from("audits").select("id, user_id").eq("id", id).single()
  if (!data) return "not_found"
  if (data.user_id !== null) return String(data.user_id) === String(userId) ? "already_yours" : "taken"

  // Conditional on user_id IS NULL so two simultaneous claims cannot both win.
  const { data: updated } = await db
    .from("audits")
    .update({ user_id: userId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", null)
  if (!Array.isArray(updated) || updated.length === 0) return "taken"

  const { data: u } = await db.from("users").select("signup_source").eq("id", userId).single()
  if (u && !u.signup_source) await db.from("users").update({ signup_source: "audit" }).eq("id", userId)
  return "claimed"
}
