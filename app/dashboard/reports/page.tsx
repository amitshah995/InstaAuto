"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Copy, Share2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { FollowerChart } from "@/components/reports/FollowerChart"

interface ReportData {
  setup: boolean
  series: { day: string; followers: number }[]
  stats: { commentsMatched: number; dmsSent: number; linkClicks: number; contacts: number }
  share: { slug: string; enabled: boolean; title: string | null } | null
  url: string | null
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState("")

  const load = useCallback(async () => {
    const res = await fetch("/api/reports")
    if (res.ok) {
      const d = await res.json()
      setData(d)
      setTitle(d.share?.title || "")
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const post = async (body: object) => {
    setSaving(true)
    try {
      const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || "Failed")
      await load()
    } catch (e: any) {
      toast.error("Could not update", { description: e?.message })
    } finally {
      setSaving(false)
    }
  }

  if (!data) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
  const last = data.series[data.series.length - 1]?.followers
  const first = data.series[0]?.followers
  const tiles = [
    ["Comments matched", data.stats.commentsMatched],
    ["DMs sent", data.stats.dmsSent],
    ["Link clicks", data.stats.linkClicks],
    ["New contacts", data.stats.contacts],
  ] as const

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">Growth & client reports</h1>
        <p className="text-sm text-muted-foreground">Follower growth plus a read-only link you can send to clients.</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-end justify-between space-y-0">
          <CardTitle className="text-base">Followers {last !== undefined && <span className="ml-2 text-2xl font-bold">{last.toLocaleString("en-IN")}</span>}</CardTitle>
          {first !== undefined && last !== undefined && data.series.length > 1 && (
            <span className={`text-sm font-semibold ${last - first >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {last - first >= 0 ? "+" : ""}{last - first}
            </span>
          )}
        </CardHeader>
        <CardContent><FollowerChart data={data.series} /></CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, v]) => (
          <Card key={label}><CardContent className="p-4"><p className="text-2xl font-bold">{v.toLocaleString("en-IN")}</p><p className="text-xs text-muted-foreground">{label} · 30d</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Share2 className="h-4 w-4" /> Share with a client</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!data.setup ? (
            <p className="text-sm text-amber-600">Sharing is not set up yet — run migration 24 in Supabase.</p>
          ) : !data.share ? (
            <Button onClick={() => post({ enabled: true })} disabled={saving}>Create share link</Button>
          ) : (
            <>
              <div className="flex gap-2">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Report title (optional)" />
                <Button variant="outline" onClick={() => post({ title })} disabled={saving}>Save</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input readOnly value={data.url || ""} className="flex-1 font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(data.url || ""); toast.success("Link copied") }}><Copy className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" asChild><a href={data.url || "#"} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={data.share.enabled} onChange={(e) => post({ enabled: e.target.checked })} className="h-4 w-4 accent-primary" />
                Link is active (untick to stop sharing)
              </label>
              <p className="text-xs text-muted-foreground">Clients see follower growth and counts only — no follower names, messages or tokens.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
