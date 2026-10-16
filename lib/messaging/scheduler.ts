import { getSupabaseServerClient, rawQuery } from "@/lib/supabase-server"
import { sendSteps } from "@/lib/messaging/send-steps"
import { runFlow } from "@/lib/messaging/flow-runner"

const MAX_ATTEMPTS = 3

type Job = {
  id: number
  user_id: number
  kind: "steps" | "flow"
  psid: string
  payload: any
  expires_at: string
  attempts: number
}

/** Atomically claims due jobs. Stale 'processing' rows (crashed run) are retried. */
async function claimDue(limit: number): Promise<Job[]> {
  return rawQuery<Job>(
    `UPDATE scheduled_messages SET status='processing', attempts=attempts+1, locked_at=now()
     WHERE id IN (
       SELECT id FROM scheduled_messages
       WHERE (status='pending' AND run_at <= now())
          OR (status='processing' AND locked_at < now() - interval '5 minutes' AND attempts < $2)
       ORDER BY run_at LIMIT $1 FOR UPDATE SKIP LOCKED)
     RETURNING id, user_id, kind, psid, payload, expires_at, attempts`,
    [limit, MAX_ATTEMPTS],
  )
}

async function finish(id: number, status: "sent" | "failed" | "expired", error?: string) {
  await rawQuery(
    `UPDATE scheduled_messages SET status=$2, last_error=$3, finished_at=now() WHERE id=$1`,
    [id, status, error ?? null],
  )
}

export async function processDueMessages(limit = 25) {
  const jobs = await claimDue(limit)
  const supabase = await getSupabaseServerClient()
  const summary = { claimed: jobs.length, sent: 0, failed: 0, expired: 0 }

  for (const job of jobs) {
    try {
      // 24h guard: never send once the messaging window has closed.
      if (new Date(job.expires_at).getTime() < Date.now()) {
        await finish(job.id, "expired", "Outside 24h messaging window")
        summary.expired++
        continue
      }
      const { data: user } = await supabase.from("users").select("*").eq("id", job.user_id).single()
      if (!user?.access_token || user.access_token === "REVOKED") {
        await finish(job.id, "failed", "No valid access token")
        summary.failed++
        continue
      }
      const ctx = { userId: job.user_id, windowUntil: new Date(job.expires_at) }

      if (job.kind === "steps") {
        const { firstRecipient, steps } = job.payload
        const r = await sendSteps(user.access_token, firstRecipient, job.psid, { steps }, ctx)
        if (r.ok) {
          await finish(job.id, "sent")
          summary.sent++
        } else {
          await finish(job.id, "failed", r.results.find((x) => !x.ok)?.error)
          summary.failed++
        }
      } else {
        const { flow, nodeId, automationId } = job.payload
        const r = await runFlow(user.access_token, job.psid, flow, nodeId, null, {
          ctx,
          skipFirstDelay: true,
          automationId,
        })
        if (!r.scheduled) {
          await supabase
            .from("conversations")
            .update({
              active_flow_node_id: r.nodeId,
              active_flow_automation_id: r.nodeId ? automationId ?? null : null,
            })
            .eq("user_id", job.user_id)
            .eq("recipient_id", job.psid)
        }
        await finish(job.id, "sent")
        summary.sent++
      }
    } catch (e: any) {
      console.error("[scheduler] job failed", job.id, e)
      await finish(job.id, "failed", String(e?.message || e))
      summary.failed++
    }
  }
  return summary
}
