import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { rawQuery } from "@/lib/supabase-server"
import { decryptToken } from "@/lib/token-crypto"
import { siteBase } from "@/lib/links/core"

/**
 * Webhook + polling safety net.
 *
 * Instagram webhooks can occasionally be dropped. Every run (see vercel.json) this looks at the
 * latest comments on each connected account's recent posts and, for any comment we never processed,
 * replays it into our own webhook (signed the same way Meta signs it). The webhook already de-duplicates
 * by comment id, so a comment that WAS handled is never answered twice.
 */
export const maxDuration = 60

const GRAPH = "https://graph.instagram.com/v24.0"
const MIN_AGE_MS = 10 * 60 * 1000 // give the real webhook time to arrive first
const MAX_AGE_MS = 26 * 60 * 60 * 1000 // last ~day (cron runs daily on the free Vercel plan)
const MAX_USERS = 25
const MAX_REPLAYS_PER_RUN = 40

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")
  const ok =
    (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) ||
    (process.env.API_SECRET_KEY && auth === `Bearer ${process.env.API_SECRET_KEY}`)
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const users = await rawQuery<{ id: number; business_account_id: string; access_token: string; username: string }>(
    `SELECT DISTINCT u.id, u.business_account_id, u.access_token, u.username
       FROM users u JOIN automations a ON a.user_id = u.id
      WHERE a.is_active = TRUE AND a.trigger_source = 'comment'
        AND u.access_token IS NOT NULL AND u.access_token <> 'REVOKED' AND u.business_account_id IS NOT NULL
      LIMIT ${MAX_USERS}`,
  )

  const secret = process.env.INSTAGRAM_APP_SECRET
  let checked = 0
  let replayed = 0
  const now = Date.now()

  for (const u of users) {
    if (replayed >= MAX_REPLAYS_PER_RUN) break
    let token: string
    try {
      token = decryptToken(u.access_token)
    } catch {
      continue
    }
    try {
      const mediaRes = await fetch(`${GRAPH}/me/media?fields=id&limit=5&access_token=${encodeURIComponent(token)}`)
      const media = await mediaRes.json()
      for (const m of media?.data || []) {
        const cRes = await fetch(
          `${GRAPH}/${m.id}/comments?fields=id,text,timestamp,from{id,username}&limit=25&access_token=${encodeURIComponent(token)}`,
        )
        const comments = await cRes.json()
        const fresh = (comments?.data || []).filter((c: any) => {
          const age = now - new Date(c.timestamp).getTime()
          return c.id && c.text && c.from?.id && age >= MIN_AGE_MS && age <= MAX_AGE_MS && c.from.id !== u.business_account_id
        })
        if (!fresh.length) continue
        checked += fresh.length

        const keys = fresh.map((c: any) => `comment_${c.id}`)
        const seen = await rawQuery<{ event_id: string }>(
          `SELECT event_id FROM processed_events WHERE event_id = ANY($1::text[])`,
          [keys],
        )
        const seenSet = new Set(seen.map((r) => r.event_id))

        for (const c of fresh) {
          if (seenSet.has(`comment_${c.id}`) || replayed >= MAX_REPLAYS_PER_RUN) continue
          const payload = JSON.stringify({
            object: "instagram",
            entry: [
              {
                id: u.business_account_id,
                time: Math.floor(Date.now() / 1000),
                changes: [
                  {
                    field: "comments",
                    value: { id: c.id, text: c.text, from: { id: c.from.id, username: c.from.username }, media: { id: m.id } },
                  },
                ],
              },
            ],
          })
          const headers: Record<string, string> = { "Content-Type": "application/json" }
          if (secret) headers["x-hub-signature-256"] = "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex")
          const r = await fetch(`${siteBase()}/api/instagram/webhook`, { method: "POST", headers, body: payload })
          if (r.ok) replayed++
        }
      }
    } catch (e: any) {
      console.error(`[reconcile] @${u.username}:`, e?.message)
    }
  }

  if (replayed) console.log(`[DMSpark] 🔁 Reconciliation replayed ${replayed} missed comment(s)`)
  return NextResponse.json({ users: users.length, checked, replayed })
}
