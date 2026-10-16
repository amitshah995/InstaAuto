import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { getSessionUserId } from "@/lib/auth"
import { SegmentSchema, matchesSegment } from "@/lib/contacts/segments"
import { MAX_TEXT, personalize, splitRecipients, type Recipient } from "@/lib/broadcast/eligibility"
import { sendSteps } from "@/lib/messaging/send-steps"

export const maxDuration = 60

const BodySchema = z.object({
  segment: SegmentSchema,
  text: z.string().trim().min(1).max(MAX_TEXT),
  dryRun: z.boolean().default(true),
})

/**
 * POST { segment, text, dryRun }
 * dryRun=true  -> only counts who could receive it.
 * dryRun=false -> sends to contacts who messaged you in the last 24 hours (Instagram rule), max 100 per call.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getSessionUserId(request)
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const parsed = BodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    const { segment, text, dryRun } = parsed.data

    const supabase = await getSupabaseServerClient()
    const { data: contacts } = await supabase.from("contacts").select("*").eq("user_id", userId)
    const { data: convs } = await supabase
      .from("conversations")
      .select("recipient_id, last_inbound_at, human_handled")
      .eq("user_id", userId)
    const convByIg = new Map<string, any>((convs || []).map((c: any) => [String(c.recipient_id), c]))

    const matched: Recipient[] = (contacts || [])
      .filter((c: any) => matchesSegment(c, segment))
      .map((c: any) => {
        const cv = convByIg.get(String(c.igsid))
        return { igsid: String(c.igsid), name: c.name, lastInboundAt: cv?.last_inbound_at ?? null, humanHandled: !!cv?.human_handled }
      })
    const split = splitRecipients(matched)
    const summary = {
      matched: matched.length,
      canReceive: split.eligible.length,
      outsideWindow: split.outsideWindow,
      humanHandled: split.humanHandled,
      overCap: split.overCap,
    }
    if (dryRun) return NextResponse.json({ dryRun: true, ...summary })
    if (split.eligible.length === 0) return NextResponse.json({ dryRun: false, ...summary, sent: 0, failed: 0 })

    const { data: user } = await supabase.from("users").select("id, access_token").eq("id", userId).single()
    if (!user?.access_token || user.access_token === "REVOKED") {
      return NextResponse.json({ error: "Instagram account is not connected" }, { status: 400 })
    }

    let sent = 0
    let failed = 0
    for (const r of split.eligible) {
      const res = await sendSteps(user.access_token, { id: r.igsid }, r.igsid, { message: personalize(text, r.name) })
      if (res.ok) sent++
      else failed++
      await new Promise((resolve) => setTimeout(resolve, 250)) // gentle pacing
    }
    return NextResponse.json({ dryRun: false, ...summary, sent, failed })
  } catch (e) {
    console.error("[broadcast] error:", e)
    return NextResponse.json({ error: "Broadcast failed" }, { status: 500 })
  }
}
