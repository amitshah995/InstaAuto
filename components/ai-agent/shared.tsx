"use client"

/**
 * Small shared pieces for the AI Sales Agent dashboard: a fetch helper that turns errors into messages, the heading font
 * class, and a status pill. Who imports it: every component in components/ai-agent and the pages in app/dashboard/ai-agent.
 */
import { useCallback, useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export const HEADING = "font-[family-name:var(--font-outfit)] tracking-tight"

export async function apiJson<T = any>(url: string, init?: RequestInit): Promise<{ ok: boolean; data: T; error?: string }> {
  try {
    const res = await fetch(url, init ? { ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}) } } : undefined)
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, data: data as T, error: res.ok ? undefined : (data as any)?.error || "Something went wrong" }
  } catch {
    return { ok: false, data: {} as T, error: "Network problem. Please try again." }
  }
}

/** Loads a JSON endpoint once and lets the caller reload it. */
export function useApi<T = any>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    const r = await apiJson<T>(url)
    if (r.ok) { setData(r.data); setError(null) } else setError(r.error || "Could not load")
    setLoading(false)
  }, [url])
  useEffect(() => { load() }, [load])
  return { data, error, loading, reload: load }
}

const STATUS_STYLE: Record<string, string> = {
  wa_lead: "bg-brand text-brand-foreground",
  email_lead: "bg-accent text-accent-foreground",
  engaged: "bg-secondary text-secondary-foreground",
  new: "bg-secondary text-muted-foreground",
  handoff: "bg-[#FFF6F1] text-[#B4411F] border border-[#FFD9CC]",
  active: "bg-accent text-accent-foreground",
  ended: "bg-secondary text-muted-foreground",
}
export const STATUS_LABEL: Record<string, string> = {
  wa_lead: "WhatsApp lead", email_lead: "Email lead", engaged: "Engaged", new: "New", handoff: "Handoff", active: "Active", ended: "Ended",
}

export function StatusPill({ status }: { status: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[status] || STATUS_STYLE.new)}>{STATUS_LABEL[status] || status}</span>
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null
  return <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p>
}

export const card = "rounded-2xl border border-border bg-card p-4 sm:p-5"
export const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
export const primaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
export const ghostBtn = "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-50 cursor-pointer"
