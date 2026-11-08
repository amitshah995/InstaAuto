"use client"

/**
 * Alert strip shown at the top of every dashboard page when DMs have failed recently.
 * Who renders it: app/dashboard/layout.tsx. Data: GET /api/dashboard/send-health.
 * Why: a failed DM used to be invisible; now the creator sees a count and can dismiss it.
 */
import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"

type Health = { failedLast24h: number; retrying: number; needsAttention: number }

export function SendHealthBanner() {
  const [h, setH] = useState<Health | null>(null)

  useEffect(() => {
    fetch("/api/dashboard/send-health")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setH(d))
      .catch(() => {})
  }, [])

  if (!h || (h.failedLast24h === 0 && h.needsAttention === 0)) return null

  const dismiss = async () => {
    await fetch("/api/dashboard/send-health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    }).catch(() => {})
    setH(null)
  }

  return (
    <div role="alert" className="flex flex-wrap items-center justify-center gap-3 bg-primary/10 px-3 py-2 text-xs font-medium text-foreground">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>
        {h.failedLast24h} DM{h.failedLast24h === 1 ? "" : "s"} failed in the last 24 hours
        {h.retrying > 0 ? `, ${h.retrying} will be retried automatically` : ""}
        {h.needsAttention > 0 ? `, ${h.needsAttention} could not be delivered (for example the 24-hour window closed or the account needs reconnecting)` : ""}.
      </span>
      <button onClick={dismiss} className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold hover:bg-primary/20">
        Dismiss
      </button>
    </div>
  )
}
