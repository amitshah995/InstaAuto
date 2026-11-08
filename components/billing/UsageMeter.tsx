"use client"

/**
 * Progress bar for one quota (DMs this month, AI runs today).
 * Who renders it: app/dashboard/billing/page.tsx. Props come from GET /api/billing/status.
 * Why: creators on a flat plan need to see how close they are to the limit before automations stop.
 */
import { Progress } from "@/components/ui/progress"

export interface QuotaProps {
  used: number
  limit: number
  percent: number
  state: "ok" | "warn" | "limit"
}

export function UsageMeter({ label, quota, resetNote }: { label: string; quota: QuotaProps; resetNote: string }) {
  const tone = quota.state === "limit" ? "text-destructive" : quota.state === "warn" ? "text-amber-700" : "text-muted-foreground"
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={tone}>
          {quota.used.toLocaleString("en-IN")} / {quota.limit.toLocaleString("en-IN")}
        </span>
      </div>
      <Progress value={quota.percent} aria-label={`${label}: ${quota.percent}% used`} />
      <p className="text-xs text-muted-foreground">{resetNote}</p>
    </div>
  )
}
