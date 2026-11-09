"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { LinkRow } from "./types"

const UNDO_MS = 6000

/** Link list state shared by the manager and the live preview. Edits are optimistic; the server stays the source of truth. */
export function useLinks(enabled: boolean) {
  const [links, setLinks] = useState<LinkRow[]>([])
  const [base, setBase] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Deletes wait UNDO_MS before hitting the server, so "Undo" is a pure client-side restore.
  const pending = useRef(new Map<string, { timer: ReturnType<typeof setTimeout> }>())

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/links")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not load links")
      setLinks((json.links as LinkRow[]).filter((l) => !pending.current.has(l.id)))
      setBase(json.base)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { if (enabled) load() }, [enabled, load])

  const add = async (body: { title: string; url: string; network: string; disclose: boolean }) => {
    const res = await fetch("/api/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || "Could not save the link")
    toast.success("Link added")
    await load()
  }

  const patch = async (id: string, body: Record<string, unknown>) => {
    // Optimistic for the plain flags so the preview reacts instantly.
    const local: Partial<LinkRow> = {}
    for (const k of ["shop_visible", "disabled", "disclose", "title"] as const) if (k in body) (local as any)[k] = body[k]
    if (Object.keys(local).length) setLinks((ls) => ls.map((l) => (l.id === id ? { ...l, ...local } : l)))
    const res = await fetch("/api/links", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast.error(j.error || "Update failed")
    }
    load()
  }

  const commitDelete = useCallback(async (id: string, keepalive = false) => {
    pending.current.delete(id)
    try {
      await fetch(`/api/links?id=${id}`, { method: "DELETE", keepalive })
    } catch {
      toast.error("Could not delete the link")
      load()
    }
  }, [load])

  const remove = (link: LinkRow) => {
    setLinks((ls) => ls.filter((l) => l.id !== link.id))
    const timer = setTimeout(() => commitDelete(link.id), UNDO_MS)
    pending.current.set(link.id, { timer })
    toast(`Deleted "${link.title}"`, {
      duration: UNDO_MS,
      action: {
        label: "Undo",
        onClick: () => {
          clearTimeout(timer)
          pending.current.delete(link.id)
          load()
        },
      },
    })
  }

  // If the tab closes inside the undo window, finish the deletes the owner already confirmed.
  useEffect(() => {
    const flush = () => { for (const [id, p] of pending.current) { clearTimeout(p.timer); commitDelete(id, true) } }
    window.addEventListener("pagehide", flush)
    return () => window.removeEventListener("pagehide", flush)
  }, [commitDelete])

  const reorder = async (next: LinkRow[]) => {
    setLinks(next)
    const res = await fetch("/api/links/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: next.map((l) => l.id) }) })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast.error(j.error || "Could not save the order")
      load()
    }
  }

  return { links, base, loading, error, add, patch, remove, reorder, reload: load }
}
