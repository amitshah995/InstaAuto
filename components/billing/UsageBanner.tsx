"use client"

/**
 * Dashboard-wide strip that appears only when a plan limit is close or reached.
 * Who renders it: app/dashboard/layout.tsx. Data: GET /api/billing/status.
 * Why: the friendly paywall. Instead of DMs silently stopping, the creator is told clearly what
 * happened and gets an upgrade link. Never shown during the free beta (limits are not enforced).
 */
import { useEffect, useState } from "react"
import Link from "next/link"
import { Gauge } from "lucide-react"

type Q = { used: number; limit: number; state: "ok" | "warn" | "limit" }

export function UsageBanner() {
  const [d, setD] = useState<{ plan: { name: string }; usage: { dms: Q; ai: Q; enforced: boolean } } | null>(null)

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((x) => x && setD(x))
      .catch(() => {})
  }, [])

  if (!d || !d.usage.enforced) return null
  const { dms, ai } = d.usage
  if (dms.state === "ok" && ai.state !== "limit") return null

  const text =
    dms.state === "limit"
      ? `You have reached your ${d.plan.name} plan limit of ${dms.limit.toLocaleString("en-IN")} DMs this month, so new automatic DMs are paused until it resets or you upgrade.`
      : dms.state === "warn"
        ? `You have used ${dms.used.toLocaleString("en-IN")} of ${dms.limit.toLocaleString("en-IN")} DMs on your ${d.plan.name} plan this month.`
        : `You have used all AI runs for today on your ${d.plan.name} plan. AI replies resume tomorrow.`

  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-3 bg-brand-soft px-3 py-2 text-xs font-medium text-brand">
      <Gauge className="h-3.5 w-3.5 shrink-0" />
      <span>{text}</span>
      <Link href="/dashboard/billing" className="rounded-full bg-brand/10 px-2.5 py-0.5 font-semibold hover:bg-brand/20">
        View plans
      </Link>
    </div>
  )
}
