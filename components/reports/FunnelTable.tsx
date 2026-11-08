"use client"

/**
 * Per-post funnel table for the Reports page.
 * Shows, for every automation: comments matched -> DMs sent -> link clicks.
 * Data comes from /api/funnel (account-scoped, needs a signed-in session).
 */
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { FunnelRow } from "@/lib/funnel"

const pct = (n: number | null) => (n === null ? "-" : `${n}%`)

export function FunnelTable() {
  const [days, setDays] = useState(30)
  const [rows, setRows] = useState<FunnelRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setRows(null)
    setFailed(false)
    fetch(`/api/funnel?days=${days}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setRows(d.rows || []))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [days])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Per-post funnel</CardTitle>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2 py-1 rounded-md text-xs font-semibold border ${days === d ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {failed && <p className="text-xs text-muted-foreground">Could not load the funnel. Try again in a moment.</p>}
        {!failed && rows === null && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        {rows && rows.length === 0 && <p className="text-xs text-muted-foreground">No automations yet. Create one to see how each post performs.</p>}
        {rows && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3 font-semibold">Automation / post</th>
                  <th className="py-2 px-2 font-semibold text-right">Comments matched</th>
                  <th className="py-2 px-2 font-semibold text-right">DMs sent</th>
                  <th className="py-2 px-2 font-semibold text-right">Failed</th>
                  <th className="py-2 px-2 font-semibold text-right">Link clicks</th>
                  <th className="py-2 pl-2 font-semibold text-right">Clicks / 100 DMs</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.automationId} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-foreground">
                        {r.name}
                        {!r.active && <span className="ml-1.5 text-[10px] text-muted-foreground">(paused)</span>}
                      </div>
                      <div className="text-muted-foreground">
                        {r.source} · {r.keywords || "all"}
                      </div>
                      {r.caption && <div className="text-muted-foreground italic truncate max-w-[260px]">{r.caption}</div>}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{r.matched}</td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {r.sent} <span className="text-muted-foreground">({pct(r.sendRate)})</span>
                    </td>
                    <td className={`py-2 px-2 text-right tabular-nums ${r.failed ? "text-destructive font-semibold" : ""}`}>{r.failed}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{r.hasTrackedLink ? r.clicks : "-"}</td>
                    <td className="py-2 pl-2 text-right tabular-nums">{r.clickRate === null ? "-" : r.clickRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Comments matched = comments that triggered a rule (not all comments on the post). Link clicks need a tracked link ({"{link:...}"}) in the
          message; bots are not counted. Numbers start from when logging began.
        </p>
      </CardContent>
    </Card>
  )
}
