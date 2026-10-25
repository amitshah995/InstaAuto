"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Upload, X, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { compressImage } from "@/lib/shop/compress"

type Status = "idle" | "finding" | "found" | "missing"

/**
 * Card image for a DM.
 * 1. When the field is empty and a button link is set, the product's image is looked up automatically.
 * 2. If none can be found, the user is asked to upload one (or paste a URL).
 */
export function CardImageField({
  value,
  onChange,
  linkUrl,
}: {
  value: string
  onChange: (v: string) => void
  /** First button link (https://... or {link:slug}) used to look up the product image. */
  linkUrl: string
}) {
  const [status, setStatus] = useState<Status>("idle")
  const [uploading, setUploading] = useState(false)
  const tried = useRef<string>("")
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const link = linkUrl.trim()
    if (value || !link || link === tried.current) return
    if (!/^(\{link:[a-z0-9]{4,12}\}|(https?:\/\/)?[^\s{}]+\.[^\s{}]{2,})$/i.test(link)) return
    const t = setTimeout(async () => {
      tried.current = link
      setStatus("finding")
      try {
        const res = await fetch(`/api/links/image?url=${encodeURIComponent(link)}`)
        const d = await res.json().catch(() => ({}))
        if (d.image) {
          onChange(d.image)
          setStatus("found")
        } else setStatus("missing")
      } catch {
        setStatus("missing")
      }
    }, 900)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkUrl, value])

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const blob = await compressImage(file, 1000)
      const form = new FormData()
      form.append("file", blob, "card.jpg")
      const res = await fetch("/api/shop/upload", { method: "POST", body: form })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.url) throw new Error(d.error || "Upload failed")
      onChange(d.url)
      setStatus("found")
    } catch (e: any) {
      toast.error("Upload failed", { description: e?.message })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            if (!e.target.value) tried.current = ""
          }}
          className="bg-background border-border text-xs text-foreground"
          placeholder="Image URL (https://...) — or let us fetch it"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-secondary px-3 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>

      {status === "finding" && !value && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Finding the product image…</p>
      )}
      {status === "missing" && !value && (
        <p className="text-[11px] text-amber-600">Is link se image nahi mili — Upload dabakar apni photo daalein.</p>
      )}
      {value && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-10 w-10 rounded object-cover" onError={(e) => ((e.currentTarget.style.visibility = "hidden"))} />
          <span className="flex min-w-0 flex-1 items-center gap-1 text-[11px] text-muted-foreground">
            {status === "found" && <Sparkles className="h-3 w-3 shrink-0 text-emerald-600" />}
            <span className="truncate">{value}</span>
          </span>
          <button type="button" onClick={() => { onChange(""); tried.current = ""; setStatus("idle") }} className="rounded p-1 text-red-500 hover:bg-red-500/10">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
