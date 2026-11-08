"use client"

/**
 * Settings panel to add, test, disable and delete outbound webhooks, with a Google Sheets preset
 * and a delivery log. Who renders it: app/dashboard/settings/page.tsx.
 * Talks to: /api/webhooks (list/create/update/delete) and /api/webhooks/test.
 * Why: lets creators push leads and DM events to Sheets, CRMs or Zapier without us building each integration.
 */
import { useCallback, useEffect, useState } from "react"
import { Copy, Loader2, Send, Trash2, Webhook } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

type Endpoint = { id: number; label: string | null; url: string; events: string[]; preset: string; enabled: boolean; disabled_reason: string | null; secretHint: string }
type Delivery = { id: number; endpoint_id: number; event: string; status: string; attempts: number; last_status_code: number | null; last_error: string | null; created_at: string }

const EVENT_LABELS: Record<string, string> = {
  lead_captured: "Lead captured",
  dm_sent: "DM sent",
  dm_failed: "DM failed",
  comment_matched: "Comment matched",
}

export function WebhooksPanel() {
  const [eps, setEps] = useState<Endpoint[] | null>(null)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState("")
  const [label, setLabel] = useState("")
  const [preset, setPreset] = useState<"generic" | "sheets">("generic")
  const [events, setEvents] = useState<string[]>(["lead_captured"])
  const [newSecret, setNewSecret] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/webhooks")
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return setError(d.error || "Could not load webhooks")
    setError(null)
    setEps(d.endpoints)
    setDeliveries(d.deliveries)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const call = async (fn: () => Promise<Response>, ok?: string) => {
    setBusy(true)
    try {
      const res = await fn()
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || "Failed")
      if (ok) toast.success(ok)
      await load()
      return d
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const json = (method: string, body: unknown) => () =>
    fetch("/api/webhooks", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })

  const add = async () => {
    const d = await call(json("POST", { url, label, preset, events }))
    if (d?.secret) {
      setNewSecret(d.secret)
      setUrl("")
      setLabel("")
    }
  }

  const test = async (id: number) => {
    setBusy(true)
    const res = await fetch("/api/webhooks/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (d.ok) toast.success(`Test delivered (HTTP ${d.status})`)
    else toast.error(`Test failed: ${d.error || "unknown error"}`)
    load()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5" /> Webhooks and Google Sheets</CardTitle>
        <CardDescription>Send leads and DM events to your own URL, signed so you can trust them. https only.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {error && <p className="text-destructive">{error}</p>}

        {newSecret && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
            <p className="font-medium">Copy your signing secret now. It is shown only once.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="break-all rounded bg-white px-2 py-1">{newSecret}</code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(newSecret); toast.success("Copied") }}><Copy className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setNewSecret(null)}>Done</Button>
            </div>
          </div>
        )}

        {eps === null ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          eps.map((e) => (
            <div key={e.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.label || e.url}{e.preset === "sheets" ? " (Google Sheets)" : ""}</p>
                  <p className="truncate text-xs text-muted-foreground">{e.url}</p>
                </div>
                <Switch checked={e.enabled} disabled={busy} onCheckedChange={(v) => call(json("PATCH", { id: e.id, enabled: v }))} aria-label="Enabled" />
              </div>
              <p className="text-xs text-muted-foreground">
                Events: {e.events.map((x) => EVENT_LABELS[x] || x).join(", ")} · Secret {e.secretHint}
                {!e.enabled && e.disabled_reason ? ` · ${e.disabled_reason}` : ""}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => test(e.id)}><Send className="mr-1 h-3.5 w-3.5" /> Send test</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => confirm("Delete this webhook?") && call(() => fetch(`/api/webhooks?id=${e.id}`, { method: "DELETE" }), "Deleted")}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))
        )}

        <div className="space-y-3 rounded-lg border border-dashed p-3">
          <p className="font-medium">Add a webhook</p>
          <div className="flex gap-2">
            <Button size="sm" variant={preset === "generic" ? "default" : "outline"} onClick={() => setPreset("generic")}>Custom URL</Button>
            <Button size="sm" variant={preset === "sheets" ? "default" : "outline"} onClick={() => setPreset("sheets")}>Google Sheets</Button>
          </div>
          <Input placeholder={preset === "sheets" ? "https://script.google.com/macros/s/.../exec" : "https://example.com/hooks/celra"} value={url} onChange={(e) => setUrl(e.target.value)} />
          <Input placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <div className="flex flex-wrap gap-3">
            {Object.entries(EVENT_LABELS).map(([k, v]) => (
              <label key={k} className="flex items-center gap-1.5">
                <input type="checkbox" checked={events.includes(k)} onChange={(e) => setEvents(e.target.checked ? [...events, k] : events.filter((x) => x !== k))} />
                {v}
              </label>
            ))}
          </div>
          {preset === "sheets" && (
            <p className="text-xs text-muted-foreground">Paste your Apps Script web app URL. The ready-made script is in docs/SHEETS.md. Each event becomes one row.</p>
          )}
          <Button disabled={busy || !url || events.length === 0} onClick={add}>Add webhook</Button>
        </div>

        {deliveries.length > 0 && (
          <div>
            <p className="mb-1 font-medium">Recent deliveries</p>
            <ul className="space-y-1 text-xs">
              {deliveries.map((d) => (
                <li key={d.id} className="flex justify-between gap-2">
                  <span>{EVENT_LABELS[d.event] || d.event} · {new Date(d.created_at).toLocaleString("en-IN")}</span>
                  <span className={d.status === "delivered" ? "text-emerald-700" : d.status === "dead" ? "text-destructive" : "text-amber-700"}>
                    {d.status}{d.last_status_code ? ` (${d.last_status_code})` : ""}{d.attempts > 1 ? ` · ${d.attempts} tries` : ""}{d.status !== "delivered" && d.last_error ? ` · ${d.last_error}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
