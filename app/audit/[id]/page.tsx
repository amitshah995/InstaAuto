"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { AuditShell } from "@/components/audit/audit-theme"
import { Loader2, Zap, Briefcase, CheckCircle2, Instagram, Target, ClipboardCheck } from "lucide-react"
import { instagramAuthUrl, PENDING_AUDIT_FLAG } from "@/lib/audit/oauth-url"
import type { AuditReport, Severity } from "@/lib/audit/types"

interface View {
  id: string
  report: AuditReport
  createdAt: string
}

const GRADE_COLOR = (score: number) => (score >= 70 ? "#3ddc6b" : score >= 40 ? "#f5b301" : "#ff3b52")

function ScoreBadge({ score, grade }: { score: number; grade: string }) {
  const c = GRADE_COLOR(score)
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div style={{ width: 120, height: 120, borderRadius: "50%", border: `5px solid ${c}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: `0 0 40px ${c}33` }}>
        <span className="au-head" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>{score}</span>
        <span className="au-muted" style={{ fontSize: 12 }}>out of 100</span>
      </div>
      <div style={{ textAlign: "left" }}>
        <p className="au-muted" style={{ fontSize: 13 }}>Grade</p>
        <p className="au-head" style={{ fontSize: 44, fontWeight: 800, color: c, lineHeight: 1 }}>{grade}</p>
      </div>
    </div>
  )
}

function LeadForm({ auditId, defaultInterest }: { auditId: string; defaultInterest: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", interest: defaultInterest, consent: false })
  const [state, setState] = useState<"idle" | "saving" | "done">("idle")
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setState("saving")
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, auditId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || "Could not save your details.")
      setState("idle")
      return
    }
    setState("done")
  }

  if (state === "done") {
    return (
      <p style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#3ddc6b" }}>
        <CheckCircle2 size={16} /> Thanks! We will reach out soon.
      </p>
    )
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: 12 }}>
      <input className="au-input" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <div className="au-grid2">
        <input className="au-input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="au-input" type="tel" placeholder="WhatsApp number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <select className="au-input" value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} aria-label="What are you interested in?">
        <option value="dm_automation">Instagram DM automation</option>
        <option value="smm_services">Social media marketing services</option>
        <option value="other">Something else</option>
      </select>
      <label className="au-muted" style={{ display: "flex", gap: 8, fontSize: 12 }}>
        <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} style={{ marginTop: 2 }} />
        I agree to be contacted about my audit and related services.
      </label>
      {error && <p role="alert" className="au-err">{error}</p>}
      <div>
        <button type="submit" className="au-btn" disabled={state === "saving"} style={{ padding: "12px 28px" }}>
          {state === "saving" && <Loader2 size={16} className="animate-spin" />} Send
        </button>
      </div>
    </form>
  )
}

export default function AuditResultPage() {
  const { id } = useParams<{ id: string }>()
  const [view, setView] = useState<View | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [interest, setInterest] = useState("dm_automation")

  const load = useCallback(async () => {
    const res = await fetch(`/api/audit/${id}`, { cache: "no-store" })
    if (res.status === 404) return setNotFound(true)
    if (res.ok) setView(await res.json())
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  function connect() {
    try { localStorage.setItem(PENDING_AUDIT_FLAG, "1") } catch {}
    window.location.href = instagramAuthUrl
  }

  if (notFound) {
    return (
      <AuditShell>
        <div className="au-wrap" style={{ maxWidth: 560, padding: "96px 16px", textAlign: "center", display: "grid", gap: 16 }}>
          <h1 className="au-head" style={{ fontSize: 28 }}>We could not open this report</h1>
          <p className="au-muted">
            Audit reports are private. Connect the Instagram account that created it, or run a new audit for your own account.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="au-btn" onClick={connect}><Instagram size={18} /> Connect Instagram</button>
            <Link href="/instagram-audit" className="au-btn ghost">Run a new audit</Link>
          </div>
        </div>
      </AuditShell>
    )
  }
  if (!view) {
    return (
      <AuditShell>
        <div style={{ display: "flex", minHeight: "60vh", alignItems: "center", justifyContent: "center" }}>
          <Loader2 size={32} className="animate-spin" style={{ color: "#ff3b52" }} />
        </div>
      </AuditShell>
    )
  }

  const { report } = view

  return (
    <AuditShell>
      <div className="au-wrap" style={{ maxWidth: 820, padding: "48px 16px 80px", display: "grid", gap: 20 }}>
        <header className="au-card" style={{ textAlign: "center", display: "grid", gap: 16 }}>
          <p className="au-muted">Audit for <span style={{ color: "#fff", fontWeight: 600 }}>@{report.username}</span></p>
          <ScoreBadge score={report.score} grade={report.grade} />
        </header>

        <section className="au-card" style={{ display: "grid", gap: 14 }}>
          <h2 className="au-head" style={{ fontSize: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <Target size={20} color="#ff3b52" /> Score breakdown
          </h2>
          {report.categories.map((c) => (
            <div key={c.id} className="au-tile">
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span>{c.label}</span><span className="au-head" style={{ color: GRADE_COLOR(c.score) }}>{c.score}</span>
              </div>
              <div className="au-bar" style={{ marginTop: 8 }}><i style={{ width: `${c.score}%` }} /></div>
            </div>
          ))}
        </section>

        <section className="au-card" style={{ display: "grid", gap: 12 }}>
          <h2 className="au-head" style={{ fontSize: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <ClipboardCheck size={20} color="#3ddc6b" /> Findings and fixes ({report.findings.length})
          </h2>
          {report.findings.length === 0 && <p className="au-muted" style={{ fontSize: 14 }}>No major issues found. Nice work.</p>}
          {report.findings.map((f) => (
            <article key={f.id} className="au-tile" style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className={`au-pill ${f.severity}`} style={{ textTransform: "capitalize" }}>{f.severity}</span>
                <h3 className="au-head" style={{ fontSize: 16 }}>{f.title}</h3>
              </div>
              <p className="au-muted" style={{ fontSize: 14 }}>{f.detail}</p>
              <p style={{ fontSize: 14 }}><b>Fix:</b> {f.fix}</p>
            </article>
          ))}
          <p className="au-muted" style={{ fontSize: 12 }}>{report.methodology}</p>
        </section>

        <section className="au-grid2">
          <div className="au-card" style={{ display: "grid", gap: 12, alignContent: "start" }}>
            <span className="au-icon red"><Zap size={16} /></span>
            <h3 className="au-head" style={{ fontSize: 18 }}>Automate comment and DM replies</h3>
            <p className="au-muted" style={{ fontSize: 14 }}>Turn every "price?" or "link please" comment into an instant DM, 24/7.</p>
            <div><Link href="/dashboard/automations" className="au-btn" style={{ padding: "11px 24px", fontSize: 15 }}>Set up automation</Link></div>
          </div>
          <div className="au-card" style={{ display: "grid", gap: 12, alignContent: "start" }}>
            <span className="au-icon red"><Briefcase size={16} /></span>
            <h3 className="au-head" style={{ fontSize: 18 }}>Want us to do it for you?</h3>
            <p className="au-muted" style={{ fontSize: 14 }}>Social media management and content, built around this audit.</p>
            <div>
              <button className="au-btn ghost" style={{ padding: "11px 24px", fontSize: 15 }} onClick={() => { setInterest("smm_services"); document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" }) }}>
                Talk to us
              </button>
            </div>
          </div>
        </section>

        <section id="contact" className="au-card" style={{ display: "grid", gap: 14 }}>
          <h3 className="au-head" style={{ fontSize: 18 }}>Get your plan reviewed</h3>
          <LeadForm key={interest} auditId={id} defaultInterest={interest} />
        </section>
      </div>
    </AuditShell>
  )
}
