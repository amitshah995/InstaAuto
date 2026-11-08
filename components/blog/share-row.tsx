"use client"

import { useState } from "react"
import { Check, Link2, Linkedin, MessageCircle, Twitter } from "lucide-react"
import { focusRing } from "@/components/marketing/ui"

const btn = `inline-flex min-h-11 items-center gap-2 rounded-full border border-c-line bg-c-surface px-4 text-sm font-medium text-c-ink hover:border-c-brand ${focusRing}`

export function ShareRow({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false)
  const enc = encodeURIComponent
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2000) } catch { window.prompt("Copy this link", url) }
  }
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Share this article">
      <p className="mr-1 text-sm font-semibold">Share</p>
      <button type="button" onClick={copy} className={`${btn} cursor-pointer`}>
        {copied ? <Check className="h-4 w-4 text-c-brand" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}{copied ? "Link copied" : "Copy link"}
      </button>
      <a className={btn} target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`}><Twitter className="h-4 w-4" aria-hidden />X<span className="sr-only"> (opens in a new tab)</span></a>
      <a className={btn} target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`}><Linkedin className="h-4 w-4" aria-hidden />LinkedIn<span className="sr-only"> (opens in a new tab)</span></a>
      <a className={btn} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${enc(`${title} ${url}`)}`}><MessageCircle className="h-4 w-4" aria-hidden />WhatsApp<span className="sr-only"> (opens in a new tab)</span></a>
      <span className="sr-only" role="status">{copied ? "Link copied to clipboard" : ""}</span>
    </div>
  )
}
