"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { uploadShopImage } from "@/lib/shop/client-upload"
import type { ShopDraft } from "./types"

const EMPTY: ShopDraft = { displayName: "", bio: "", avatar: null, banner: null }

/** Loads, edits and saves the shop profile (GET/PUT /api/shop). `draft` is what the preview shows; `saved` is what the server has. */
export function useShopProfile() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saved, setSaved] = useState<ShopDraft>(EMPTY)
  const [draft, setDraft] = useState<ShopDraft>(EMPTY)
  const [handle, setHandle] = useState<string | null>(null)
  const [handleError, setHandleError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [published, setPublished] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState({ avatar: false, banner: false })
  const [errors, setErrors] = useState<{ avatar: string | null; banner: string | null; save: string | null }>({ avatar: null, banner: null, save: null })

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/shop")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not load your shop page")
      const d: ShopDraft = {
        displayName: json.profile?.display_name || "",
        bio: json.profile?.bio || "",
        avatar: json.profile?.avatar_url || null,
        banner: json.profile?.banner_url || null,
      }
      setSaved(d)
      setDraft(d)
      setUrl(json.url)
      setHandle(json.handle)
      setHandleError(json.handleError || null)
      setPublished(!!json.profile?.published)
      setLoadError(null)
    } catch (e: any) {
      setLoadError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const patchDraft = (p: Partial<ShopDraft>) => setDraft((d) => ({ ...d, ...p }))

  const upload = async (kind: "avatar" | "banner", file: File) => {
    setBusy((b) => ({ ...b, [kind]: true }))
    setErrors((e) => ({ ...e, [kind]: null }))
    try {
      const u = await uploadShopImage(file, kind)
      patchDraft({ [kind]: u } as Partial<ShopDraft>)
      toast.success(kind === "banner" ? "Banner added. Press Save to apply it." : "Picture added. Press Save to apply it.")
    } catch (e: any) {
      setErrors((x) => ({ ...x, [kind]: e.message }))
      toast.error(e.message)
    } finally {
      setBusy((b) => ({ ...b, [kind]: false }))
    }
  }

  const remove = (kind: "avatar" | "banner") => patchDraft({ [kind]: null } as Partial<ShopDraft>)

  const save = async (nextPublished: boolean = published) => {
    setSaving(true)
    setErrors((e) => ({ ...e, save: null }))
    try {
      const res = await fetch("/api/shop", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          published: nextPublished,
          display_name: draft.displayName,
          bio: draft.bio,
          // Only send a picture when it changed: the server treats "" as "remove".
          ...(draft.avatar !== saved.avatar ? { avatar_url: draft.avatar ?? "" } : {}),
          ...(draft.banner !== saved.banner ? { banner_url: draft.banner ?? "" } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not save")
      setSaved(draft)
      setPublished(nextPublished)
      setUrl(json.url)
      toast.success(nextPublished ? "Saved. Your page is live." : "Saved. Your page is hidden.")
      return true
    } catch (e: any) {
      setErrors((x) => ({ ...x, save: e.message }))
      toast.error(e.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  const dirty = draft.displayName !== saved.displayName || draft.bio !== saved.bio || draft.avatar !== saved.avatar || draft.banner !== saved.banner
  return { loading, loadError, draft, patchDraft, handle, handleError, url, published, saving, busy, errors, dirty, upload, remove, save, reload: load }
}
