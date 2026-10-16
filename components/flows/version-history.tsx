"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { History, Loader2 } from "lucide-react"

type Version = { id: number; name: string | null; created_at: string }

/** Lists earlier saved versions of an automation and restores one (current state is kept as a version too). */
export function VersionHistory({ automationId }: { automationId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [versions, setVersions] = useState<Version[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (!next || versions) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/automations/versions?id=${encodeURIComponent(automationId)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not load history")
      setVersions(json)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const restore = async (versionId: number) => {
    if (!confirm("Restore this version? Your current version is saved in history first.")) return
    setLoading(true)
    try {
      const res = await fetch("/api/automations/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: automationId, versionId }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Restore failed")
      window.location.reload()
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <Button variant="outline" onClick={toggle} className="rounded-xl font-bold gap-2">
        <History className="w-4 h-4" /> History
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-border bg-card p-3 shadow-xl space-y-2">
          <p className="text-xs font-bold text-muted-foreground">Earlier saves (latest 10)</p>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {error && <p className="text-xs text-destructive font-semibold">{error}</p>}
          {versions && versions.length === 0 && <p className="text-xs text-muted-foreground">No earlier versions yet. One is saved each time you save changes.</p>}
          {versions?.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate">{new Date(v.created_at).toLocaleString()}</span>
              <Button size="sm" variant="ghost" disabled={loading} onClick={() => restore(v.id)}>Restore</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
