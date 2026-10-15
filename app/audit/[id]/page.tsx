"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Lock, Zap, Briefcase, CheckCircle2 } from "lucide-react"
import type { AuditReport, AuditTeaser, Severity } from "@/lib/audit/types"

interface View {
  id: string
  unlocked: boolean
  teaser: AuditTeaser
  report?: AuditReport
}

const SEVERITY_STYLE: Record<Severity, string> = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
}

const instagramAuthUrl = `https://api.instagram.com/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID}&redirect_uri=${process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI}&response_type=code&scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments#weblink`

function ScoreBadge({ score, grade }: { score: number; grade: string }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border-4 border-primary">
        <span className="text-4xl font-bold">{score}</span>
        <span className="text-xs text-muted-foreground">out of 100</span>
      </div>
      <div className="text-left">
        <p className="text-sm text-muted-foreground">Grade</p>
        <p className="text-4xl font-bold">{grade}</p>
      </div>
    </div>
  )
}

function FindingTitle({ title, severity }: { title: string; severity: Severity }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_STYLE[severity]}`}>{severity}</span>
      <span className="text-sm font-medium">{title}</span>
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
      <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" /> Thanks! We will reach out soon.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <Input placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input type="tel" placeholder="WhatsApp number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <select
        value={form.interest}
        onChange={(e) => setForm({ ...form, interest: e.target.value })}
        className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
        aria-label="What are you interested in?"
      >
        <option value="dm_automation">Instagram DM automation</option>
        <option value="smm_services">Social media marketing services</option>
        <option value="other">Something else</option>
      </select>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-0.5" />
        I agree to be contacted about my audit and related services.
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={state === "saving"}>
        {state === "saving" && <Loader2 className="h-4 w-4 animate-spin" />} Send
      </Button>
    </form>
  )
}

export default function AuditResultPage() {
  const { id } = useParams<{ id: string }>()
  const [view, setView] = useState<View | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [interest, setInterest] = useState("dm_automation")

  const load = useCallback(async () => {
    const res = await fetch(`/api/audit/${id}`, { cache: "no-store" })
    if (res.status === 404) return setNotFound(true)
    if (res.ok) setView(await res.json())
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function unlock() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/audit/${id}/claim`, { method: "POST" })
      if (res.ok) return await load()
      if (res.status === 401) {
        // Not signed in: connect Instagram, then the session hook brings the user back here.
        localStorage.setItem("pending_audit_id", id)
        window.location.href = instagramAuthUrl
        return
      }
      const data = await res.json().catch(() => ({}))
      setMessage(data.error || "Could not unlock the report.")
    } finally {
      setBusy(false)
    }
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Audit not found</h1>
        <Button asChild className="mt-6"><Link href="/instagram-audit">Run a new audit</Link></Button>
      </main>
    )
  }
  if (!view) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  const { teaser, report } = view

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 space-y-10">
      <header className="text-center space-y-4">
        <p className="text-muted-foreground">Audit for <span className="font-medium text-foreground">@{teaser.username}</span></p>
        <ScoreBadge score={teaser.score} grade={teaser.grade} />
      </header>

      {!view.unlocked || !report ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Top issues</h2>
          <div className="space-y-2">
            {teaser.topFindings.map((f) => <FindingTitle key={f.title} {...f} />)}
          </div>

          {/* Static placeholders only: the locked content is never sent to the browser. */}
          <div className="relative rounded-xl border p-4">
            <div aria-hidden className="space-y-3 blur-sm select-none">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-muted" />
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
              <Lock className="h-5 w-5" />
              <p className="text-sm font-medium">
                {teaser.lockedFindingsCount > 0
                  ? `${teaser.lockedFindingsCount} more findings, your score breakdown and step-by-step fixes`
                  : "Your score breakdown and step-by-step fixes"}
              </p>
              <Button onClick={unlock} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Unlock full report (free)
              </Button>
              <p className="text-xs text-muted-foreground">Connect your Instagram account securely. We never see your password.</p>
            </div>
          </div>
          {message && <p role="alert" className="text-sm text-destructive text-center">{message}</p>}
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Score breakdown</h2>
            {report.categories.map((c) => (
              <div key={c.id}>
                <div className="flex justify-between text-sm"><span>{c.label}</span><span className="font-medium">{c.score}</span></div>
                <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${c.score}%` }} /></div>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Findings and fixes ({report.findings.length})</h2>
            {report.findings.length === 0 && <p className="text-sm text-muted-foreground">No major issues found. Nice work.</p>}
            {report.findings.map((f) => (
              <article key={f.id} className="rounded-xl border bg-card p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_STYLE[f.severity]}`}>{f.severity}</span>
                  <h3 className="font-medium">{f.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{f.detail}</p>
                <p className="text-sm"><span className="font-medium">Fix:</span> {f.fix}</p>
              </article>
            ))}
            <p className="text-xs text-muted-foreground">{report.methodology}</p>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <Zap className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Automate comment and DM replies</h3>
              <p className="text-sm text-muted-foreground">Turn every "price?" or "link please" comment into an instant DM, 24/7.</p>
              <Button asChild><Link href="/dashboard/automations">Set up automation</Link></Button>
            </div>
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <Briefcase className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Want us to do it for you?</h3>
              <p className="text-sm text-muted-foreground">Social media management and content, built around this audit.</p>
              <Button variant="outline" onClick={() => { setInterest("smm_services"); document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" }) }}>
                Talk to us
              </Button>
            </div>
          </section>

          <section id="contact" className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="font-semibold">Get your plan reviewed</h3>
            <LeadForm key={interest} auditId={id} defaultInterest={interest} />
          </section>
        </>
      )}
    </main>
  )
}
