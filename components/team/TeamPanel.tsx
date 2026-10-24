"use client"

import { useCallback, useEffect, useState } from "react"
import { Copy, Loader2, Trash2, Users, LogIn } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { switchWorkspace } from "@/components/team/switchWorkspace"

interface TeamData {
  acting: boolean
  members: { id: string; username: string }[]
  invites: { code: string; url: string; expires_at: string }[]
  workspaces: { id: string; username: string }[]
}

export function TeamPanel() {
  const [data, setData] = useState<TeamData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch("/api/team")
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return setError(d.error || "Could not load team")
    setError(null)
    setData(d)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const act = async (fn: () => Promise<Response>, ok?: string) => {
    setBusy(true)
    try {
      const res = await fn()
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || "Failed")
      if (ok) toast.success(ok)
      await load()
      return d
    } catch (e: any) {
      toast.error(e?.message || "Failed")
    } finally {
      setBusy(false)
    }
  }

  if (error) return <Card><CardContent className="p-5 text-sm text-amber-600">{error}</CardContent></Card>
  if (!data) return <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>

  return (
    <Card className="border-border">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Team access</CardTitle></CardHeader>
      <CardContent className="space-y-5 text-sm">
        {data.workspaces.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accounts you can work in</p>
            {data.workspaces.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                <span>@{w.username}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7" onClick={async () => { const e = await switchWorkspace(w.id); if (e) toast.error(e) }}>
                    <LogIn className="mr-1 h-3 w-3" /> Open
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-red-500" disabled={busy} onClick={() => act(() => fetch(`/api/team?leave=${w.id}`, { method: "DELETE" }), "Left team")}>
                    Leave
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {data.acting ? (
          <p className="text-xs text-muted-foreground">You are working inside another account. Only its owner can invite or remove people.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your teammates</p>
            {data.members.length === 0 && <p className="text-muted-foreground">No teammates yet.</p>}
            {data.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                <span>@{m.username}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" disabled={busy} onClick={() => act(() => fetch(`/api/team?member=${m.id}`, { method: "DELETE" }), "Teammate removed")}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {data.invites.map((i) => (
              <div key={i.code} className="flex items-center gap-2 rounded-lg border border-dashed border-border p-2.5">
                <code className="flex-1 truncate text-[11px]">{i.url}</code>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(i.url); toast.success("Invite link copied") }}><Copy className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" disabled={busy} onClick={() => act(() => fetch(`/api/team?invite=${i.code}`, { method: "DELETE" }))}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
            <Button disabled={busy} onClick={() => act(() => fetch("/api/team", { method: "POST" }), "Invite link created")}>Create invite link</Button>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The teammate opens the link while logged in to DMSpark with their own Instagram account. They can then manage your automations, links, contacts and reports
              from their dashboard, but cannot invite or remove people. Links work once and expire in 7 days. Their access is re-checked every 2 hours.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
