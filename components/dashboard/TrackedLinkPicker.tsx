"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { BarChart3, Link2 } from "lucide-react"
import { toast } from "sonner"

interface TrackedLink {
  id: string
  slug: string
  title: string
  clicks_total?: number
}

const TOKEN = /^\{link:[a-z0-9]{4,12}\}$/i

/**
 * Small helper shown under a button's URL field.
 * - pick one of your tracked links (inserts {link:slug}, clicks are counted per link)
 * - or turn the pasted URL into a tracked link in one tap
 */
export function TrackedLinkPicker({
  url,
  label,
  onChange,
}: {
  url: string
  label: string
  onChange: (next: string) => void
}) {
  const [links, setLinks] = useState<TrackedLink[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    fetch("/api/links")
      .then((r) => (r.ok ? r.json() : { links: [] }))
      .then((d) => alive && setLinks(Array.isArray(d.links) ? d.links : []))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const current = TOKEN.test(url.trim()) ? links.find((l) => `{link:${l.slug}}` === url.trim()) : null
  const looksLikeUrl = /^(https?:\/\/)?[^\s{}]+\.[^\s{}]+/.test(url.trim()) && !TOKEN.test(url.trim())

  const trackThis = async () => {
    setBusy(true)
    try {
      let dest = url.trim()
      if (!/^https?:\/\//i.test(dest)) dest = `https://${dest}`
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: label.trim() || "DM button", url: dest }),
      })
      const data = await res.json()
      if (!res.ok || !data.link) throw new Error(data.error || "Could not track link")
      setLinks((prev) => [data.link, ...prev])
      onChange(`{link:${data.link.slug}}`)
      toast.success("Tracked link ready", { description: "Clicks on this button will be counted separately." })
    } catch (e: any) {
      toast.error("Could not track link", { description: e?.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      {current ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-600">
          <BarChart3 className="h-3 w-3" /> Tracked: {current.title} · {current.clicks_total ?? 0} clicks
        </span>
      ) : looksLikeUrl ? (
        <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px]" disabled={busy} onClick={trackThis}>
          <BarChart3 className="mr-1 h-3 w-3" /> {busy ? "Saving…" : "Track clicks on this link"}
        </Button>
      ) : null}
      {links.length > 0 && (
        <label className="inline-flex items-center gap-1 text-muted-foreground">
          <Link2 className="h-3 w-3" />
          <select
            className="h-6 rounded-md border border-border bg-background px-1 text-[11px]"
            value=""
            onChange={(e) => e.target.value && onChange(`{link:${e.target.value}}`)}
          >
            <option value="">Use a saved tracked link…</option>
            {links.map((l) => (
              <option key={l.id} value={l.slug}>
                {l.title} ({l.clicks_total ?? 0})
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
