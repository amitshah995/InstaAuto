"use client"

import { useCallback, useEffect, useState } from "react"
import { useInstagramSession } from "@/hooks/use-instagram-session"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import ShopSettings from "@/components/dashboard/ShopSettings"
import { Link2, Loader2, Copy, Trash2, MousePointerClick, Check } from "lucide-react"

type LinkRow = {
  id: string
  slug: string
  title: string
  url: string
  network: string | null
  disclose: boolean
  disabled: boolean
  shop_visible: boolean
  image_url: string | null
  price_inr?: number | null
  mrp_inr?: number | null
  clicks_total: number
  clicks_7d: number
  visitors_7d: number
}

const NETWORKS = ["Amazon", "EarnKaro", "Cuelinks", "Other"]

function hostOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "")
  } catch {
    return u
  }
}

export default function LinksPage() {
  const { userId, isLoading: sessionLoading } = useInstagramSession()
  const [links, setLinks] = useState<LinkRow[]>([])
  const [base, setBase] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [network, setNetwork] = useState("Amazon")
  const [disclose, setDisclose] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/links")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not load links")
      setLinks(json.links)
      setBase(json.base)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (userId) load()
  }, [userId, load])

  const add = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, url, network, disclose }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not save")
      setTitle("")
      setUrl("")
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const patch = async (id: string, body: object) => {
    const res = await fetch("/api/links", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || "Update failed")
    } else {
      setError(null)
    }
    load()
  }

  const pasteImage = (l: LinkRow) => {
    const v = window.prompt("Paste an image address (https://...). Leave empty to remove the image.", l.image_url || "")
    if (v !== null) patch(l.id, { image_url: v.trim() })
  }

  const setPrice = (l: LinkRow) => {
    const num = (v: string | null) => {
      if (v === null) return undefined // cancelled
      const t = v.replace(/[^0-9]/g, "")
      return t ? Number(t) : null // empty clears
    }
    const price = num(window.prompt("Selling price in rupees (e.g. 1765). Leave empty to remove the price.", l.price_inr ? String(l.price_inr) : ""))
    if (price === undefined) return
    if (price === null) return patch(l.id, { price_inr: null, mrp_inr: null })
    const mrp = num(window.prompt("Original price / MRP in rupees (e.g. 4999), so the page can show the discount. Leave empty to skip.", l.mrp_inr ? String(l.mrp_inr) : ""))
    if (mrp === undefined) return
    patch(l.id, { price_inr: price, mrp_inr: mrp })
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this link and its click history? Messages that use it will stop including it.")) return
    await fetch(`/api/links?id=${id}`, { method: "DELETE" })
    load()
  }

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }

  if (sessionLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-semibold">Loading links...</p>
      </div>
    )
  }

  const totalClicks7d = links.reduce((a, l) => a + l.clicks_7d, 0)

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <div className="border-b border-border/80 pb-6 space-y-1">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2.5">
          <Link2 className="w-6 h-6 text-primary" /> Links
        </h1>
        <p className="text-sm text-muted-foreground">
          Save your product or affiliate links, then use <code>{"{link:code}"}</code> in any DM message. We send a short tracked link and count the clicks.
          {" "}Last 7 days: <b>{totalClicks7d}</b> clicks.
        </p>
      </div>

      <ShopSettings />

      <Card className="p-4 space-y-3 border-border bg-card/90">
        <h2 className="text-sm font-black">Add a link</h2>
        <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name, e.g. Black kurta" maxLength={80} className="rounded-xl" />
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="rounded-xl" />
          <select value={network} onChange={(e) => setNetwork(e.target.value)} className="rounded-xl border border-border bg-background px-3 text-sm h-10">
            {NETWORKS.map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={disclose} onChange={(e) => setDisclose(e.target.checked)} />
          Add "This is an affiliate link" note to messages that use it (recommended)
        </label>
        <p className="text-xs text-muted-foreground">
          Check your affiliate network's rules before using redirected links. Some networks (Amazon Associates for example) limit how links may be shared. Only https links are accepted. We try to pick up the product's picture automatically for your shop page; if a site hides it, use "Paste image URL" on the link.
        </p>
        {error && <p className="text-xs text-destructive font-semibold">{error}</p>}
        <Button disabled={saving || !title.trim() || !url.trim()} onClick={add} className="rounded-xl font-bold">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save link"}
        </Button>
      </Card>

      {links.length === 0 ? (
        <Card className="border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          No links yet. Add one above, then put its code in a flow message.
        </Card>
      ) : (
        <div className="space-y-3">
          {links.map((l) => {
            const short = `${base}/l/${l.slug}`
            const token = `{link:${l.slug}}`
            return (
              <Card key={l.id} className={`p-4 border-border bg-card/90 space-y-2 ${l.disabled ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  {l.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.image_url} alt="" referrerPolicy="no-referrer" className="h-14 w-14 rounded-lg object-cover border border-border" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{l.title} {l.disabled && <span className="text-xs text-destructive">(disabled)</span>}</p>
                    <p className="text-xs text-muted-foreground truncate">{l.network ? `${l.network} · ` : ""}{hostOf(l.url)}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1"><MousePointerClick className="w-3.5 h-3.5" /><b>{l.clicks_7d}</b> in 7 days</span>
                    <span className="text-muted-foreground">{l.visitors_7d} people</span>
                    <span className="text-muted-foreground">{l.clicks_total} total</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button onClick={() => copy(`s${l.id}`, short)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 font-mono">
                    {copied === `s${l.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {short.replace("https://", "")}
                  </button>
                  <button onClick={() => copy(`t${l.id}`, token)} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 text-primary px-2.5 py-1.5 font-mono">
                    {copied === `t${l.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {token}
                  </button>
                  <span className="flex-1" />
                  <label className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <input type="checkbox" checked={!!l.shop_visible} onChange={(e) => patch(l.id, { shop_visible: e.target.checked })} />
                    On shop page
                  </label>
                  <button onClick={() => patch(l.id, { refresh_image: true })} className="text-muted-foreground underline">
                    Fetch image
                  </button>
                  <button onClick={() => setPrice(l)} className="text-muted-foreground underline">
                    {l.price_inr ? `Price: \u20B9${l.price_inr}${l.mrp_inr ? ` (MRP \u20B9${l.mrp_inr})` : ""}` : "Set price"}
                  </button>
                  <button onClick={() => pasteImage(l)} className="text-muted-foreground underline">
                    Paste image URL
                  </button>
                  <button onClick={() => patch(l.id, { disclose: !l.disclose })} className="text-muted-foreground underline">
                    Affiliate note: {l.disclose ? "on" : "off"}
                  </button>
                  <button onClick={() => patch(l.id, { disabled: !l.disabled })} className="text-muted-foreground underline">
                    {l.disabled ? "Enable" : "Disable"}
                  </button>
                  <button onClick={() => remove(l.id)} aria-label="Delete link" className="text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
