"use client"

/**
 * Overview tab: on/off switch, today's numbers, score distribution and the last 10 leads.
 * Data: GET /api/ai-agent/overview (aggregation in lib/agent/overview.ts). Rendered by app/dashboard/ai-agent/page.tsx.
 */
import Link from "next/link"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { ErrorNote, HEADING, StatusPill, apiJson, card, primaryBtn, useApi } from "./shared"

export function OverviewPanel() {
  const { data, error, loading, reload } = useApi<any>("/api/ai-agent/overview")

  const toggle = async (on: boolean) => {
    const r = on ? await apiJson("/api/ai-agent/settings", { method: "PUT", body: JSON.stringify({ enabled: true }) }) : await apiJson("/api/ai-agent/activate", { method: "DELETE" })
    if (!r.ok) toast.error(r.error)
    else toast.success(on ? "Agent is on" : "Agent paused")
    reload()
  }

  if (loading && !data) return <p className="text-sm text-muted-foreground">Loading...</p>
  if (error || !data) return <ErrorNote message={error || "Could not load"} />

  const tiles = [
    { label: "Conversations today", value: data.conversationsToday },
    { label: "WhatsApp leads", value: data.whatsappLeads },
    { label: "Email leads", value: data.emailLeads },
    { label: "Handoffs", value: data.handoffs },
  ]
  const dist = Object.entries(data.scoreDistribution as Record<string, number>)
  const max = Math.max(1, ...dist.map(([, n]) => n))

  return (
    <div className="space-y-5">
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <p className={`${HEADING} text-lg font-semibold text-foreground`}>{data.enabled ? "The agent is on" : "The agent is off"}</p>
          <p className="text-sm text-muted-foreground">{data.activeConversations} active conversation{data.activeConversations === 1 ? "" : "s"}.</p>
        </div>
        <div className="flex items-center gap-3">
          {!data.enabled && <Link href="/dashboard/ai-agent/setup" className={primaryBtn}>Finish setup</Link>}
          <Switch checked={!!data.enabled} onCheckedChange={toggle} aria-label="Turn the AI Sales Agent on or off" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className={card}>
            <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
            <p className={`${HEADING} mt-1 text-3xl font-bold text-foreground`}>{t.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className={card}>
          <h2 className={`${HEADING} text-base font-semibold text-foreground`}>Lead score distribution</h2>
          <ul className="mt-3 space-y-2">
            {dist.map(([bucket, n]) => (
              <li key={bucket} className="flex items-center gap-3 text-sm">
                <span className="w-14 shrink-0 text-muted-foreground">{bucket}</span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-brand" style={{ width: `${(n / max) * 100}%` }} /></span>
                <span className="w-6 text-right font-semibold text-foreground">{n}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={card}>
          <h2 className={`${HEADING} text-base font-semibold text-foreground`}>Latest leads</h2>
          {data.lastLeads.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No leads yet. Use the Test tab to rehearse a chat, then turn the agent on.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {data.lastLeads.map((l: any) => (
                <li key={l.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="truncate text-foreground">{l.username ? `@${l.username}` : l.name || "Contact"}</span>
                  <span className="flex shrink-0 items-center gap-2"><span className="text-xs text-muted-foreground">{l.score}</span><StatusPill status={l.status} /></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
