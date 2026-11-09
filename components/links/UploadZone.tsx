"use client"

import { useRef, useState } from "react"
import { Camera, ImagePlus, Loader2, X } from "lucide-react"

/**
 * Click or drag-and-drop image slot with live preview, spinner and an inline error that stays next to
 * the field (also announced to screen readers). `shape` decides the frame: wide banner or round avatar.
 */
export default function UploadZone({
  kind, label, hint, value, busy, error, name, onFile, onRemove,
}: {
  kind: "banner" | "avatar"
  label: string
  hint: string
  value: string | null
  busy: boolean
  error: string | null
  name: string
  onFile: (f: File) => void
  onRemove: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const pick = (f?: File | null) => { if (f) onFile(f) }
  const round = kind === "avatar"
  const frame = round ? "h-24 w-24 rounded-full" : "aspect-[4.5/1] w-full rounded-xl"

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold">{label}</span>
        {value && (
          <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-destructive hover:underline focus-visible:outline-2 focus-visible:outline-c-brand">
            <X className="h-3 w-3" /> Remove
          </button>
        )}
      </div>
      <div className={round ? "flex items-center gap-4" : ""}>
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]) }}
          aria-label={value ? `Change ${name}` : `Add ${name}`}
          className={`group relative grid shrink-0 place-items-center overflow-hidden border-2 border-dashed bg-c-soft text-muted-foreground transition-colors hover:border-c-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-c-brand ${frame} ${over ? "border-c-brand bg-c-brand-soft" : "border-c-line"}`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 px-2 text-center text-xs font-semibold">
              {round ? <Camera className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}
              {!round && <span>Drop an image here or click to browse</span>}
            </span>
          )}
          {value && !busy && (
            <span className="absolute inset-0 grid place-items-center bg-c-ink/55 text-xs font-bold text-c-bg opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Change</span>
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-c-bg/80" role="status" aria-label="Uploading">
              <Loader2 className="h-6 w-6 animate-spin text-c-brand" />
            </span>
          )}
        </button>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          {round && (
            <button type="button" onClick={() => input.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-c-line px-2.5 py-1.5 text-xs font-semibold text-foreground hover:border-c-brand focus-visible:outline-2 focus-visible:outline-c-brand disabled:opacity-60">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              {value ? "Change picture" : "Add profile picture or brand logo"}
            </button>
          )}
          <p>{hint}</p>
        </div>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = "" }} />
      <p role="alert" aria-live="assertive" className={error ? "text-xs font-semibold text-destructive" : "sr-only"}>{error || ""}</p>
    </div>
  )
}
