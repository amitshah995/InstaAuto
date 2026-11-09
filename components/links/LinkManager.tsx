"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Check, Copy, GripVertical, Link2, Loader2, MousePointerClick, Plus, Trash2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { LinkRow } from "./types"
import type { useLinks } from "./use-links"

type L = ReturnType<typeof useLinks>
const NETWORKS = ["Amazon", "EarnKaro", "Cuelinks", "Other"]

const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, "") } catch { return u } }
const urlProblem = (u: string): string | null => {
  if (!u.trim()) return null
  try {
    const p = new URL(u.trim())
    return p.protocol === "https:" ? null : "Only https links are accepted."
  } catch {
    return "Enter a full address, like https://example.com/product."
  }
}

const chip = "inline-flex items-center gap-1.5 rounded-lg border border-c-line px-2.5 py-1.5 text-xs font-semibold hover:border-c-brand focus-visible:outline-2 focus-visible:outline-c-brand"

export default function LinkManager({ state }: { state: L }) {
  const { links, base, loading, error } = state
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [network, setNetwork] = useState("Amazon")
  const [disclose, setDisclose] = useState(true)
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [announce, setAnnounce] = useState("")

  const problem = touched ? urlProblem(url) : null
  const valid = title.trim() && url.trim() && !urlProblem(url)

  const add = async () => {
    setTouched(true)
    if (!valid) return
    setSaving(true)
    try {
      await state.add({ title: title.trim(), url: url.trim(), network, disclose })
      setTitle(""); setUrl(""); setTouched(false)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); toast.success("Copied"); setTimeout(() => setCopied(null), 1500) } catch { toast.error("Copy was blocked by your browser.") }
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= links.length) return
    const next = [...links]
    ;[next[i], next[j]] = [next[j], next[i]]
    state.reorder(next)
    setAnnounce(`${next[j].title} moved to position ${j + 1} of ${next.length}`)
  }

  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const from = links.findIndex((l) => l.id === dragId)
    const to = links.findIndex((l) => l.id === targetId)
    const next = [...links]
    next.splice(to, 0, next.splice(from, 1)[0])
    state.reorder(next)
    setAnnounce(`${links[from].title} moved to position ${to + 1} of ${next.length}`)
  }

  const pasteImage = (l: LinkRow) => {
    const v = window.prompt("Paste an image address (https://...). Leave empty to remove the image.", l.image_url || "")
    if (v !== null) state.patch(l.id, { image_url: v.trim() })
  }
  const setPrice = (l: LinkRow) => {
    const num = (v: string | null) => { if (v === null) return undefined; const t = v.replace(/[^0-9]/g, ""); return t ? Number(t) : null }
    const price = num(window.prompt("Selling price in rupees (e.g. 1765). Leave empty to remove the price.", l.price_inr ? String(l.price_inr) : ""))
    if (price === undefined) return
    if (price === null) return state.patch(l.id, { price_inr: null, mrp_inr: null })
    const mrp = num(window.prompt("Original price / MRP in rupees (e.g. 4999), so the page can show the discount. Leave empty to skip.", l.mrp_inr ? String(l.mrp_inr) : ""))
    if (mrp === undefined) return
    state.patch(l.id, { price_inr: price, mrp_inr: mrp })
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-3 border-c-line bg-c-surface p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Plus className="h-4.5 w-4.5 text-c-brand" /> Add a link</h2>
        <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
          <div className="space-y-1">
            <label htmlFor="link-title" className="text-xs font-bold">Name</label>
            <Input id="link-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Black kurta" maxLength={80} className="rounded-xl" />
          </div>
          <div className="space-y-1">
            <label htmlFor="link-url" className="text-xs font-bold">Link</label>
            <Input id="link-url" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={() => url && setTouched(true)} placeholder="https://..." inputMode="url" aria-invalid={!!problem} aria-describedby={problem ? "link-url-err" : undefined} className="rounded-xl" />
          </div>
          <div className="space-y-1">
            <label htmlFor="link-network" className="text-xs font-bold">Network</label>
            <select id="link-network" value={network} onChange={(e) => setNetwork(e.target.value)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-c-brand">
              {NETWORKS.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>
        {problem && <p id="link-url-err" role="alert" className="text-xs font-semibold text-destructive">{problem}</p>}
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={disclose} onChange={(e) => setDisclose(e.target.checked)} className="accent-[var(--c-brand)]" />
          Add a "This is an affiliate link" note to messages that use it (recommended)
        </label>
        <p className="text-xs text-muted-foreground">Check your affiliate network's rules before using redirected links. Only https links are accepted. We try to pick up the product picture automatically; if a site hides it, use "Paste image" on the link.</p>
        <button type="button" disabled={saving || !title.trim() || !url.trim()} onClick={add} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-c-accent px-5 text-sm font-bold text-c-accent-ink hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-c-brand disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save link
        </button>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Your links {links.length > 0 && <span className="text-sm font-medium text-muted-foreground">({links.length})</span>}</h2>
          {links.length > 1 && <p className="text-xs text-muted-foreground">Drag the handle or use the arrows to reorder.</p>}
        </div>
        <p className="sr-only" aria-live="polite">{announce}</p>
        {error && <p role="alert" className="text-xs font-semibold text-destructive">{error}</p>}

        {loading ? (
          <div className="space-y-3" role="status" aria-label="Loading links">
            {[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-c-soft" />)}
          </div>
        ) : links.length === 0 ? (
          <Card className="border-dashed border-c-line bg-c-cream p-8 text-center">
            <Link2 className="mx-auto h-8 w-8 text-c-brand" />
            <p className="mt-3 font-display text-base font-bold">No links yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Add a product or affiliate link above. Then use its code in any DM message and we track the clicks.</p>
            <ul className="mx-auto mt-4 max-w-sm space-y-1 text-left text-xs text-muted-foreground">
              <li><b className="text-foreground">Name:</b> Black cotton kurta</li>
              <li><b className="text-foreground">Link:</b> https://www.amazon.in/dp/...</li>
              <li><b className="text-foreground">Message:</b> Here is the one you asked about {"{link:abc123}"}</li>
            </ul>
          </Card>
        ) : (
          <ul className="space-y-3">
            {links.map((l, i) => {
              const short = `${base}/l/${l.slug}`
              const token = `{link:${l.slug}}`
              return (
                <li
                  key={l.id}
                  draggable={dragId === l.id}
                  onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverId(l.id) } }}
                  onDrop={(e) => { e.preventDefault(); drop(l.id); setDragId(null); setOverId(null) }}
                  onDragEnd={() => { setDragId(null); setOverId(null) }}
                >
                  <Card className={`space-y-3 border-c-line bg-c-surface p-4 transition-colors ${l.disabled ? "opacity-60" : ""} ${overId === l.id && dragId !== l.id ? "border-c-brand" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex shrink-0 flex-col items-center gap-0.5">
                        <button type="button" aria-label={`Move ${l.title} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-c-brand disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <span
                          onPointerDown={() => setDragId(l.id)} onPointerUp={() => setDragId(null)}
                          className="cursor-grab touch-none rounded p-0.5 text-muted-foreground active:cursor-grabbing" aria-hidden title="Drag to reorder"
                        ><GripVertical className="h-4 w-4" /></span>
                        <button type="button" aria-label={`Move ${l.title} down`} disabled={i === links.length - 1} onClick={() => move(i, 1)} className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-c-brand disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                      </div>
                      {l.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.image_url} alt="" referrerPolicy="no-referrer" className="h-14 w-14 shrink-0 rounded-lg border border-c-line object-cover" />
                      ) : (
                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-c-brand-soft font-display text-xl font-black text-c-brand">{(l.title.match(/[A-Za-z0-9]/)?.[0] || "?").toUpperCase()}</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{l.title} {l.disabled && <span className="text-xs font-semibold text-destructive">(disabled)</span>}</p>
                        <p className="truncate text-xs text-muted-foreground">{l.network ? `${l.network} · ` : ""}{hostOf(l.url)}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                          <span className="inline-flex items-center gap-1"><MousePointerClick className="h-3.5 w-3.5 text-c-brand" /><b>{l.clicks_7d}</b> in 7 days</span>
                          <span className="text-muted-foreground">{l.visitors_7d} people</span>
                          <span className="text-muted-foreground">{l.clicks_total} total</span>
                        </p>
                      </div>
                      <label className="flex shrink-0 flex-col items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                        <Switch checked={!!l.shop_visible} onCheckedChange={(v) => state.patch(l.id, { shop_visible: v })} aria-label={`Show ${l.title} on shop page`} className="data-[state=checked]:bg-c-brand" />
                        On page
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <button type="button" onClick={() => copy(`s${l.id}`, short)} className={`${chip} font-mono`}>
                        {copied === `s${l.id}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {short.replace(/^https?:\/\//, "")}
                      </button>
                      <button type="button" onClick={() => copy(`t${l.id}`, token)} className={`${chip} border-c-brand/40 font-mono text-c-brand`}>
                        {copied === `t${l.id}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {token}
                      </button>
                      <span className="flex-1" />
                      <button type="button" onClick={() => state.patch(l.id, { refresh_image: true })} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">Fetch image</button>
                      <button type="button" onClick={() => pasteImage(l)} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">Paste image</button>
                      <button type="button" onClick={() => setPrice(l)} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">{l.price_inr ? `Price: ₹${l.price_inr}${l.mrp_inr ? ` (MRP ₹${l.mrp_inr})` : ""}` : "Set price"}</button>
                      <button type="button" onClick={() => state.patch(l.id, { disclose: !l.disclose })} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">Affiliate note: {l.disclose ? "on" : "off"}</button>
                      <button type="button" onClick={() => state.patch(l.id, { disabled: !l.disabled })} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">{l.disabled ? "Enable" : "Disable"}</button>
                      <button type="button" onClick={() => state.remove(l)} aria-label={`Delete ${l.title}`} className="rounded p-1 text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
