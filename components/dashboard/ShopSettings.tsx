"use client"

import { useCallback, useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { compressImage } from "@/lib/shop/compress"
import { Loader2, Copy, Check, Store, Camera, X } from "lucide-react"

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
  const [avatar, setAvatar] = useState<string | null>(null)
  const [avatarDirty, setAvatarDirty] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [bannerDirty, setBannerDirty] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
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
      setAvatar(json.profile?.avatar_url || null)
      setAvatarDirty(false)
      setBanner(json.profile?.banner_url || null)
      setBannerDirty(false)
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
        body: JSON.stringify({ published: nextPublished, display_name: displayName, bio, ...(avatarDirty ? { avatar_url: avatar ?? "" } : {}), ...(bannerDirty ? { banner_url: banner ?? "" } : {}) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not save")
      setPublished(nextPublished)
      setAvatarDirty(false)
      setBannerDirty(false)
      setUrl(json.url)
      setMsg(nextPublished ? "Saved. Your page is live." : "Saved. Your page is hidden.")
      onChanged?.()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const blob = await compressImage(file, 600)
      const fd = new FormData()
      fd.append("file", blob, "logo")
      const res = await fetch("/api/shop/upload", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Upload failed")
      setAvatar(json.url)
      setAvatarDirty(true)
      setMsg("Picture added. Press Save to apply it.")
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const pickBanner = async (file: File | undefined) => {
    if (!file) return
    setUploadingBanner(true)
    setError(null)
    try {
      const blob = await compressImage(file, 1800)
      const fd = new FormData()
      fd.append("file", blob, "banner")
      const res = await fetch("/api/shop/upload", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Upload failed")
      setBanner(json.url)
      setBannerDirty(true)
      setMsg("Banner added. Press Save to apply it.")
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploadingBanner(false)
    }
  }

  if (loading) return <Card className="p-4"><Loader2 className="w-4 h-4 animate-spin" /></Card>

  return (
    <Card className="p-4 space-y-3 border-border bg-card/90">
      <h2 className="text-sm font-black flex items-center gap-2"><Store className="w-4 h-4 text-primary" /> Your shop page</h2>
      <p className="text-xs text-muted-foreground">
        A public page with only the links you tick below. It is hidden until you publish it, and it is not listed on search engines.
      </p>
      <div className="space-y-1.5">
        <div className="overflow-hidden rounded-xl border border-dashed border-border bg-muted aspect-[4.6/1]">
          {banner ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={banner} alt="Banner" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">No banner yet</div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 font-semibold">
            {uploadingBanner ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            {banner ? "Change banner" : "Add banner image"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploadingBanner} onChange={(e) => { pickBanner(e.target.files?.[0]); e.target.value = "" }} />
          </label>
          {banner && (
            <button type="button" onClick={() => { setBanner(null); setBannerDirty(true) }} className="inline-flex items-center gap-1 text-muted-foreground underline">
              <X className="w-3 h-3" /> Remove
            </button>
          )}
          <span className="text-muted-foreground">Wide image works best, about 1800 x 400 pixels. Shown across the top of your page.</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="Profile picture" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground"><Camera className="w-5 h-5" /></div>
          )}
        </div>
        <div className="space-y-1 text-xs">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 font-semibold">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            {avatar ? "Change picture" : "Add profile picture or brand logo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(e) => { pickAvatar(e.target.files?.[0]); e.target.value = "" }} />
          </label>
          {avatar && (
            <button type="button" onClick={() => { setAvatar(null); setAvatarDirty(true) }} className="ml-2 inline-flex items-center gap-1 text-muted-foreground underline">
              <X className="w-3 h-3" /> Remove
            </button>
          )}
          <p className="text-muted-foreground">Shown in a round frame on your shop page. JPG, PNG or WebP.</p>
        </div>
      </div>
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
    </Card>
  )
}
