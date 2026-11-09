"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Check, Copy, ExternalLink, Share2 } from "lucide-react"
import QrCode from "./QrCode"

const btn = "inline-flex items-center gap-1.5 rounded-lg border border-c-line bg-c-surface px-3 py-2 text-xs font-bold hover:border-c-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-c-brand"

/** Copy, WhatsApp, X, native share and a client-side QR for the public page address. */
export default function SharePanel({ url, handle, published }: { url: string; handle: string; published: boolean }) {
  const [copied, setCopied] = useState(false)
  const text = `Shop my picks on Celra: ${url}`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success("Link copied")
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Copy was blocked by your browser. Select the link and copy it.")
    }
  }
  const nativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function"
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-c-line bg-c-soft px-3 py-2 font-mono text-xs" title={url}>{url.replace(/^https?:\/\//, "")}</code>
        <button type="button" onClick={copy} className={btn} aria-label="Copy page link">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
        </button>
        {published && (
          <a href={url} target="_blank" rel="noreferrer" className={btn}><ExternalLink className="h-3.5 w-3.5" /> Open</a>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <a className={btn} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(text)}`}>Share on WhatsApp</a>
        <a className={btn} target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("Shop my picks")}&url=${encodeURIComponent(url)}`}>Share on X</a>
        {nativeShare && (
          <button type="button" className={btn} onClick={() => navigator.share({ title: `@${handle} on Celra`, url }).catch(() => {})}><Share2 className="h-3.5 w-3.5" /> More</button>
        )}
      </div>
      {!published && <p className="text-xs text-muted-foreground">Visitors see a 404 until you publish. Sharing now would send them to an empty page.</p>}
      <QrCode value={url} handle={handle} />
    </div>
  )
}
