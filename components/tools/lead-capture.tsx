"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, ClipboardCheck } from "lucide-react"

/**
 * Lead form shown under every tool result. No login. Posts to /api/tools/lead.
 * `context` is a short summary of what the visitor just calculated, so follow-up can be specific.
 */
export function LeadCapture({ tool, context, headline, text, button }: { tool: string; context: string; headline: string; text: string; button: string }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", consent: false, website: "" })
  const [state, setState] = useState<"idle" | "saving" | "done">("idle")
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!f.email.trim() && !f.phone.trim()) return setError("Add an email or a WhatsApp number.")
    if (!f.consent) return setError("Please tick the box so we can contact you.")
    setState("saving")
    try {
      const res = await fetch("/api/tools/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, context, ...f }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || "Could not save your details. Please try again."); setState("idle"); return }
      setState("done")
    } catch {
      setError("Network error. Please try again.")
      setState("idle")
    }
  }

  return (
    <section className="au-card" style={{ display: "grid", gap: 14, borderColor: "rgba(255,59,82,.28)", background: "linear-gradient(180deg, rgba(255,59,82,.07), var(--au-card) 60%)" }} aria-labelledby={`lead-${tool}`}>
      {state === "done" ? (
        <div style={{ display: "grid", gap: 12 }}>
          <p style={{ display: "flex", alignItems: "center", gap: 8, color: "#3ddc6b", fontWeight: 600 }}><CheckCircle2 size={18} /> Thanks! We will reach out soon.</p>
          <p className="au-muted" style={{ fontSize: 14 }}>While you wait, get your free Instagram audit. It takes about a minute.</p>
          <div><Link href="/instagram-audit" className="au-btn" style={{ padding: "11px 24px", fontSize: 15 }}><ClipboardCheck size={16} /> Run my free audit</Link></div>
        </div>
      ) : (
        <>
          <div>
            <h2 id={`lead-${tool}`} className="au-head" style={{ fontSize: 20 }}>{headline}</h2>
            <p className="au-muted" style={{ fontSize: 14, marginTop: 4 }}>{text}</p>
          </div>
          <form onSubmit={submit} noValidate style={{ display: "grid", gap: 12 }}>
            <div className="au-grid2">
              <input className="au-input" placeholder="Your name (optional)" aria-label="Your name" value={f.name} maxLength={100} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />
              <input className="au-input" type="email" placeholder="Email" aria-label="Email" value={f.email} maxLength={254} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" />
            </div>
            <input className="au-input" type="tel" placeholder="WhatsApp number (optional)" aria-label="WhatsApp number" value={f.phone} maxLength={20} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" />
            {/* Honeypot: real visitors never see or fill this. */}
            <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} name="website" />
            <label className="au-muted" style={{ display: "flex", gap: 8, fontSize: 12 }}>
              <input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} style={{ marginTop: 2 }} />
              <span>I agree to be contacted by DMSpark about this and related services. See the <Link href="/privacy" className="au-link">privacy policy</Link>.</span>
            </label>
            {error && <p role="alert" className="au-err">{error}</p>}
            <div>
              <button type="submit" className="au-btn" disabled={state === "saving"} style={{ padding: "12px 28px", fontSize: 15 }}>
                {state === "saving" && <Loader2 size={16} className="animate-spin" />} {button}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  )
}
