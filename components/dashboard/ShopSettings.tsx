"use client"

import { useCallback, useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Copy, Check, Store, Trash2, Video } from "lucide-react"

export default function ShopSettings({ onChanged }: { onChanged?: () => void }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [handle, setHandle] = useState<string | null>(null)
  const [published, setPublished] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [bio, setBio] = useState("")
  const [copied, setCopied] = useState(false)
  const [videos, setVideos] = useState<{ id: string; title: string | null; url: string }[]>([])
  const [vUrl, setVUrl] = useState("")
  const [vTitle, setVTitle] = useState("")
  const [vBusy, setVBusy] = useState(false)
  const [vError, setVError] = useState<string | null>(null)

  const loadVideos = useCallback(async () => {
    try {
      const res = await fetch("/api/shop/videos")
      const json = await res.json()
      if (res.ok) setVideos(json.videos)
      else setVError(json.error || null)
    } catch {
      /* ignore */
    }
  }, [])
  useEffect(() => { loadVideos() }, [loadVideos])

  const addVideo = async () => {
    setVBusy(true)
    setVError(null)
    try {
      const res = await fetch("/api/shop/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: vUrl, title: vTitle }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not add")
      setVUrl("")
      setVTitle("")
      await loadVideos()
    } catch (e: any) {
      setVError(e.message)
    } finally {
      setVBusy(false)
    }
  }

  const removeVideo = async (id: string) => {
    await fetch(`/api/shop/videos?id=${id}`, { method: "DELETE" })
    loadVideos()
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/shop")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not load")
      setUrl(json.url)
      setHandle(json.handle)
      setPublished(!!json.profile?.published)
      setDisplayName(json.profile?.display_name || "")
      setBio(json.profile?.bio || "")
      setError(json.handleError)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const save = async (nextPublished: boolean) => {
    setSaving(true)
    setError(null)
    setMsg(null)
    try {
      const res = await fetch("/api/shop", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: nextPublished, display_name: displayName, bio }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not save")
      setPublished(nextPublished)
      setUrl(json.url)
      setMsg(nextPublished ? "Saved. Your page is live." : "Saved. Your page is hidden.")
      onChanged?.()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Card className="p-4"><Loader2 className="w-4 h-4 animate-spin" /></Card>

  return (
    <Card className="p-4 space-y-3 border-border bg-card/90">
      <h2 className="text-sm font-black flex items-center gap-2"><Store className="w-4 h-4 text-primary" /> Your shop page</h2>
      <p className="text-xs text-muted-foreground">
        A public page with only the links you tick below. It is hidden until you publish it, and it is not listed on search engines.
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={handle ? `@${handle}` : "Display name"} maxLength={60} className="rounded-xl" />
        <Input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio (optional)" maxLength={160} className="rounded-xl" />
      </div>
      {url && (
        <div className="flex items-center gap-2 text-xs">
          <code className="rounded-lg border border-border px-2.5 py-1.5 font-mono break-all">{url.replace("https://", "")}</code>
          <button
            onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {} }}
            aria-label="Copy shop URL"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          {published && <a href={url} target="_blank" rel="noreferrer" className="underline text-primary">Open</a>}
        </div>
      )}
      {error && <p className="text-xs text-destructive font-semibold">{error}</p>}
      {msg && <p className="text-xs text-green-600 font-semibold">{msg}</p>}
      <div className="flex gap-2">
        <Button disabled={saving || !handle} onClick={() => save(true)} className="rounded-xl font-bold">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : published ? "Save" : "Publish"}
        </Button>
        {published && (
          <Button disabled={saving} variant="outline" onClick={() => save(false)} className="rounded-xl font-bold">Hide page</Button>
        )}
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <h3 className="text-sm font-black flex items-center gap-2"><Video className="w-4 h-4 text-primary" /> Videos on your shop</h3>
        <p className="text-xs text-muted-foreground">
          Paste the link of your Instagram reel or post. It plays on your shop page through Instagram's own player (the reel must be public).
        </p>
        <div className="grid gap-2 md:grid-cols-[2fr_1fr_auto]">
          <Input value={vUrl} onChange={(e) => setVUrl(e.target.value)} placeholder="https://www.instagram.com/reel/..." className="rounded-xl" />
          <Input value={vTitle} onChange={(e) => setVTitle(e.target.value)} placeholder="Caption (optional)" maxLength={80} className="rounded-xl" />
          <Button disabled={vBusy || !vUrl.trim()} onClick={addVideo} className="rounded-xl font-bold">
            {vBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add video"}
          </Button>
        </div>
        {vError && <p className="text-xs text-destructive font-semibold">{vError}</p>}
        {videos.length > 0 && (
          <ul className="space-y-1">
            {videos.map((v) => (
              <li key={v.id} className="flex items-center gap-2 text-xs">
                <a href={v.url} target="_blank" rel="noreferrer" className="truncate underline">{v.title || v.url.replace("https://www.", "")}</a>
                <span className="flex-1" />
                <button onClick={() => removeVideo(v.id)} aria-label="Remove video" className="text-destructive"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
