"use client"

import { useCallback, useEffect, useState } from "react"
import { useInstagramSession } from "@/hooks/use-instagram-session"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { compressImage } from "@/lib/shop/compress"
import { Clapperboard, Loader2, Trash2, Copy, Check, ArrowLeft, ArrowRight, X, ImagePlus, MessageCircle } from "lucide-react"

type Post = { id: string; kind: "images" | "reel"; caption: string | null; images: string[]; reel_code: string | null; ig_media_id?: string | null; link_ids: string[]; clicks: number; created_at: string }
type LinkRow = { id: string; title: string; image_url: string | null; disabled: boolean }

const MAX_IMAGES = 10
const MAX_PRODUCTS = 6

export default function StudioPage() {
  const { userId, isLoading: sessionLoading } = useInstagramSession()
  const [posts, setPosts] = useState<Post[]>([])
  const [links, setLinks] = useState<LinkRow[]>([])
  const [base, setBase] = useState("")
  const [handle, setHandle] = useState<string | null>(null)
  const [published, setPublished] = useState(true)
  const [waConfigured, setWaConfigured] = useState(false)
  const [setupIssues, setSetupIssues] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const [mode, setMode] = useState<"images" | "reel">("images")
  const [images, setImages] = useState<string[]>([])
  const [reels, setReels] = useState<{ id: string; thumb: string | null; caption: string | null }[]>([])
  const [reelsLoaded, setReelsLoaded] = useState(false)
  const [reelId, setReelId] = useState<string | null>(null)
  const [caption, setCaption] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [p, l, s, w, h] = await Promise.all([fetch("/api/shop/posts"), fetch("/api/links"), fetch("/api/shop"), fetch("/api/shop/posts/whatsapp"), fetch("/api/shop/health")])
      const pj = await p.json()
      if (!p.ok) throw new Error(pj.error || "Could not load posts")
      setPosts(pj.posts)
      setBase(pj.base)
      setHandle(pj.handle)
      if (l.ok) setLinks((await l.json()).links.filter((x: LinkRow) => !x.disabled))
      if (s.ok) setPublished(!!(await s.json()).profile?.published)
      if (w.ok) setWaConfigured(!!(await w.json()).configured)
      if (h.ok) {
        const hj = await h.json()
        setSetupIssues([...(hj.missingMigrations || []), ...(hj.imageStorageConfigured ? [] : ["image storage (bucket shop-media and Supabase keys in Vercel)"])])
      }
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { if (userId) load() }, [userId, load])

  useEffect(() => {
    if (mode !== "reel" || reelsLoaded) return
    ;(async () => {
      try {
        const res = await fetch("/api/instagram/media")
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Could not load your reels")
        setReels(
          (json.data || [])
            .filter((m: any) => m.media_type === "VIDEO")
            .map((m: any) => ({ id: m.id, thumb: m.thumbnail_url || null, caption: m.caption || null })),
        )
      } catch (e: any) {
        setError(e.message)
      } finally {
        setReelsLoaded(true)
      }
    })()
  }, [mode, reelsLoaded])

  const addFiles = async (files: FileList | null) => {
    if (!files) return
    setUploading(true)
    setError(null)
    try {
      for (const f of Array.from(files).slice(0, MAX_IMAGES - images.length)) {
        const blob = await compressImage(f)
        const fd = new FormData()
        fd.append("file", blob, "photo")
        const res = await fetch("/api/shop/upload", { method: "POST", body: fd })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Upload failed")
        setImages((cur) => [...cur, json.url])
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const move = (i: number, d: number) =>
    setImages((cur) => {
      const j = i + d
      if (j < 0 || j >= cur.length) return cur
      const next = [...cur]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const toggleProduct = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_PRODUCTS ? cur : [...cur, id]))

  const publish = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/shop/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: mode, caption, images: mode === "images" ? images : undefined, ig_media_id: mode === "reel" ? reelId : undefined, link_ids: picked }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not publish")
      setImages([])
      setReelId(null)
      setCaption("")
      setPicked([])
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this post?")) return
    await fetch(`/api/shop/posts?id=${id}`, { method: "DELETE" })
    load()
  }

  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500) } catch { /* ignore */ }
  }

  const sendWa = async (id: string) => {
    const res = await fetch("/api/shop/posts/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    const json = await res.json().catch(() => ({}))
    setError(res.ok ? null : json.error || "Could not send")
  }

  if (sessionLoading || loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
  }

  const canPublish = !saving && !uploading && (mode === "images" ? images.length > 0 : !!reelId)
  const postUrl = (id: string) => `${base}/@${handle}/studio/${id}`
  const studioUrl = handle ? `${base}/@${handle}/studio` : null

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="space-y-1 border-b border-border/80 pb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-black tracking-tight md:text-3xl"><Clapperboard className="h-6 w-6 text-primary" /> Studio</h1>
        <p className="text-sm text-muted-foreground">Post photos, carousels or an Instagram reel with your products tagged. Each post gets its own link you can send in DMs or WhatsApp.</p>
        {studioUrl && (
          <button onClick={() => copy("studio", studioUrl)} className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs">
            {copied === "studio" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {studioUrl.replace("https://", "")}
          </button>
        )}
        {setupIssues.length > 0 && <p className="text-xs font-semibold text-destructive">Setup still needed: {setupIssues.join(", ")}.</p>}
        {!published && <p className="text-xs font-semibold text-destructive">Your shop page is hidden. Publish it from the Links page so these posts can be opened.</p>}
      </div>

      <Card className="space-y-3 border-border bg-card/90 p-4">
        <div className="flex gap-2">
          {(["images", "reel"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-full border px-3 py-1 text-xs font-bold ${mode === m ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
              {m === "images" ? "Photos / carousel" : "Instagram reel"}
            </button>
          ))}
        </div>

        {mode === "images" ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {images.map((src, i) => (
                <div key={src} className="relative h-24 w-20 overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => setImages((c) => c.filter((x) => x !== src))} aria-label="Remove" className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5"><X className="h-3 w-3" /></button>
                  <div className="absolute bottom-0 flex w-full justify-between bg-background/70 px-0.5">
                    <button onClick={() => move(i, -1)} aria-label="Move left"><ArrowLeft className="h-3 w-3" /></button>
                    <button onClick={() => move(i, 1)} aria-label="Move right"><ArrowRight className="h-3 w-3" /></button>
                  </div>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <label className="flex h-24 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  {uploading ? "Uploading" : "Add"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" disabled={uploading} onChange={(e) => { addFiles(e.target.files); e.target.value = "" }} />
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Up to {MAX_IMAGES} photos. They are shrunk in your browser before upload. The first photo is the cover.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {!reelsLoaded ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : reels.length === 0 ? (
              <p className="text-xs text-muted-foreground">No reels found on your connected Instagram account.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
                {reels.map((r) => (
                  <button key={r.id} onClick={() => setReelId(r.id)} className={`relative aspect-[9/16] overflow-hidden rounded-lg border-2 bg-muted ${reelId === r.id ? "border-primary" : "border-transparent"}`} title={r.caption || ""}>
                    {r.thumb && /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.thumb} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
                    {reelId === r.id && <Check className="absolute right-1 top-1 h-4 w-4 rounded-full bg-primary p-0.5 text-primary-foreground" />}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Pick one of your own reels. It plays right on your Studio page, so visitors do not have to leave. Nothing is uploaded here.</p>
          </div>
        )}

        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={1000} rows={3} placeholder="Caption and #hashtags" className="w-full rounded-xl border border-border bg-background p-3 text-sm" />

        <div className="space-y-1">
          <p className="text-xs font-bold">Tag products ({picked.length}/{MAX_PRODUCTS})</p>
          {links.length === 0 ? (
            <p className="text-xs text-muted-foreground">No links yet. Add products on the Links page first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {links.map((l) => {
                const on = picked.includes(l.id)
                return (
                  <button key={l.id} onClick={() => toggleProduct(l.id)} className={`flex items-center gap-2 rounded-xl border px-2 py-1 text-xs ${on ? "border-primary bg-primary/10 font-bold" : "border-border"}`}>
                    {l.image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={l.image_url} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded object-cover" />}
                    <span className="max-w-[10rem] truncate">{l.title}</span>
                    {on && <Check className="h-3 w-3" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
        <Button disabled={!canPublish} onClick={publish} className="rounded-xl font-bold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish post"}
        </Button>
      </Card>

      {posts.length === 0 ? (
        <Card className="border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">No posts yet.</Card>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => {
            const url = handle ? postUrl(p.id) : ""
            return (
              <Card key={p.id} className="space-y-2 border-border bg-card/90 p-4">
                <div className="flex items-start gap-3">
                  {p.kind === "images" && p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt="" className="h-16 w-14 rounded-lg border border-border object-cover" />
                  ) : (
                    <div className="flex h-16 w-14 items-center justify-center rounded-lg border border-border text-[10px] text-muted-foreground">Reel</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-bold">{p.caption || (p.kind === "reel" ? "Instagram reel" : `${p.images.length} photo post`)}</p>
                    <p className="text-xs text-muted-foreground">{p.kind === "images" ? `${p.images.length} photo(s)` : "Reel"} · {p.link_ids.length} product(s) · <b>{p.clicks}</b> product clicks</p>
                    {p.kind === "reel" && !p.ig_media_id && <p className="text-xs font-semibold text-destructive">This reel was added by link and is not shown publicly. Delete it and add it again by picking it from your reels.</p>}
                  </div>
                  <button onClick={() => remove(p.id)} aria-label="Delete post" className="text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
                {url && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button onClick={() => copy(p.id, url)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 font-mono">
                      {copied === p.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {url.replace("https://", "")}
                    </button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(`${p.caption ? p.caption.slice(0, 120) + "\n" : ""}${url}`)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5">
                      <MessageCircle className="h-3.5 w-3.5" /> Share on WhatsApp
                    </a>
                    <button onClick={() => sendWa(p.id)} disabled={!waConfigured} title={waConfigured ? "" : "WhatsApp app is not connected yet"} className="rounded-lg border border-border px-2.5 py-1.5 disabled:opacity-50">
                      Send to my contacts{waConfigured ? "" : " (not connected)"}
                    </button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
