"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Megaphone } from "lucide-react"
import type { Segment } from "@/lib/contacts/segments"

type Counts = { matched: number; canReceive: number; outsideWindow: number; humanHandled: number; overCap: number; sent?: number; failed?: number }

/** One-off message to the contacts in the current filter. Only people who messaged in the last 24h can receive it. */
export function BroadcastPanel({ segment }: { segment: Segment }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [counts, setCounts] = useState<Counts | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const call = async (dryRun: boolean) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment, text, dryRun }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Request failed")
      setCounts(json)
      setDone(!dryRun)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const send = async () => {
    if (!counts) return
    if (!confirm(`Send this message to ${counts.canReceive} contact(s) now? This cannot be undone.`)) return
    await call(false)
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="rounded-xl font-bold gap-2">
        <Megaphone className="w-4 h-4" /> Message these contacts
      </Button>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card/80 p-4 space-y-3 max-w-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" /> Message filtered contacts</h3>
        <button className="text-xs text-muted-foreground" onClick={() => setOpen(false)}>Close</button>
      </div>
      <p className="text-xs text-muted-foreground">
        Instagram only allows this for people who messaged you in the last 24 hours. Everyone else is skipped automatically.
        Use {"{name}"} to add their first name. Max 100 people per send.
      </p>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setCounts(null); setDone(false) }}
        maxLength={900}
        rows={4}
        placeholder="Hi {name}, quick update..."
        className="w-full rounded-lg border border-border bg-background p-3 text-sm"
      />
      {counts && (
        <div className="text-xs space-y-1 rounded-lg bg-secondary/30 p-3">
          <p><b>{counts.canReceive}</b> can receive this now (of {counts.matched} in this filter)</p>
          {counts.outsideWindow > 0 && <p className="text-muted-foreground">{counts.outsideWindow} skipped: last message was over 24 hours ago</p>}
          {counts.humanHandled > 0 && <p className="text-muted-foreground">{counts.humanHandled} skipped: handled by a person</p>}
          {counts.overCap > 0 && <p className="text-muted-foreground">{counts.overCap} more not included (100 per send)</p>}
          {done && <p className="font-bold text-emerald-600">Sent {counts.sent}, failed {counts.failed}</p>}
        </div>
      )}
      {error && <p className="text-xs text-destructive font-semibold">{error}</p>}
      <div className="flex gap-2">
        <Button variant="outline" disabled={busy || !text.trim()} onClick={() => call(true)} className="rounded-lg">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check who can receive"}
        </Button>
        <Button disabled={busy || done || !counts || counts.canReceive === 0} onClick={send} className="rounded-lg font-bold">
          Send{counts ? ` to ${counts.canReceive}` : ""}
        </Button>
      </div>
    </div>
  )
}
