"use client"

import { useEffect, useState } from "react"
import { Loader2, Sparkles, CheckCircle2, AlertTriangle, Lightbulb, CalendarDays, Target } from "lucide-react"
import type { AiReport } from "@/lib/audit/ai/schema"

interface Brief { niche: string; goal: string; audience: string; offer: string; postsPerWeek: number; language: "en" | "hinglish" }
interface Saved { report: AiReport; brief: Brief; generatedAt: string; runsLeft: number }

const GOALS: [string, string][] = [["sales", "Sales"], ["leads", "Leads / enquiries"], ["followers", "Followers"], ["brand", "Brand awareness"], ["community", "Community"]]

const H = ({ children }: { children: React.ReactNode }) => <h4 className="au-head" style={{ fontSize: 16, margin: "6px 0 2px" }}>{children}</h4>

export function AiReportSection({ auditId }: { auditId: string }) {
  const [saved, setSaved] = useState<Saved | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [b, setB] = useState<Brief>({ niche: "", goal: "sales", audience: "", offer: "", postsPerWeek: 3, language: "en" })

  useEffect(() => {
    let off = false
    fetch(`/api/audit/${auditId}/ai`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!off && d) { setSaved(d); setB(d.brief) } })
      .catch(() => {})
      .finally(() => !off && setLoaded(true))
    return () => { off = true }
  }, [auditId])

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    setErr(""); setBusy(true)
    try {
      const res = await fetch(`/api/audit/${auditId}/ai`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setErr(d.error || "Something went wrong. Please try again.")
      else setSaved(d)
    } catch { setErr("Network problem. Please try again.") }
    setBusy(false)
  }

  if (!loaded) return null
  const r = saved?.report

  return (
    <section className="au-card" style={{ display: "grid", gap: 16, borderColor: "rgba(255,59,82,.25)" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span className="au-icon red"><Sparkles size={16} /></span>
        <h3 className="au-head" style={{ fontSize: 20 }}>AI Growth Report <span className="au-pill" style={{ marginLeft: 6 }}>Free preview</span></h3>
      </div>

      {(!r || showForm(saved)) && (
        <form onSubmit={generate} style={{ display: "grid", gap: 12 }}>
          <p className="au-muted" style={{ fontSize: 14 }}>Tell us about your account. We combine it with your last posts to write a content plan for you.</p>
          <div className="au-grid2">
            <div><label className="au-label" htmlFor="ai-niche">What do you sell or post about?</label><input id="ai-niche" className="au-input" required minLength={2} maxLength={80} placeholder="e.g. handmade jewellery" value={b.niche} onChange={(e) => setB({ ...b, niche: e.target.value })} /></div>
            <div><label className="au-label" htmlFor="ai-goal">Main goal</label><select id="ai-goal" className="au-input" value={b.goal} onChange={(e) => setB({ ...b, goal: e.target.value })}>{GOALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className="au-label" htmlFor="ai-aud">Who is your audience?</label><input id="ai-aud" className="au-input" required minLength={2} maxLength={120} placeholder="e.g. women 22-35 in India" value={b.audience} onChange={(e) => setB({ ...b, audience: e.target.value })} /></div>
            <div><label className="au-label" htmlFor="ai-offer">What do you want people to do or buy?</label><input id="ai-offer" className="au-input" required minLength={2} maxLength={160} placeholder="e.g. custom rings, DM to order" value={b.offer} onChange={(e) => setB({ ...b, offer: e.target.value })} /></div>
            <div><label className="au-label" htmlFor="ai-ppw">Posts you can make per week</label><input id="ai-ppw" type="number" min={1} max={14} className="au-input" value={b.postsPerWeek} onChange={(e) => setB({ ...b, postsPerWeek: Math.min(14, Math.max(1, Number(e.target.value) || 1)) })} /></div>
            <div><label className="au-label" htmlFor="ai-lang">Language</label><select id="ai-lang" className="au-input" value={b.language} onChange={(e) => setB({ ...b, language: e.target.value as Brief["language"] })}><option value="en">English</option><option value="hinglish">Hinglish</option></select></div>
          </div>
          {err && <p className="au-err" role="alert">{err}</p>}
          <div><button className="au-btn" disabled={busy}>{busy ? <><Loader2 size={16} className="animate-spin" /> Writing your report (up to a minute)</> : saved ? "Generate again" : "Generate my AI report"}</button></div>
        </form>
      )}

      {r && (
        <div style={{ display: "grid", gap: 14 }}>
          <div className="au-tile">
            <p className="au-head" style={{ fontSize: 18 }}>{r.summary.headline}</p>
            <p style={{ fontSize: 14, marginTop: 6 }}>{r.summary.verdict}</p>
            <p className="au-muted" style={{ fontSize: 12, marginTop: 8 }}><span className={`au-pill ${r.summary.confidence === "high" ? "" : r.summary.confidence === "medium" ? "medium" : "low"}`}>Confidence: {r.summary.confidence}</span> {r.summary.confidenceNote}</p>
          </div>

          <H><CheckCircle2 size={14} style={{ display: "inline", marginRight: 6 }} />What worked</H>
          {r.whatWorked.map((w, i) => <div key={i} className="au-tile"><b>{w.postRef}</b> <span style={{ fontSize: 14 }}>{w.why}</span><p className="au-muted" style={{ fontSize: 12 }}>{w.evidence}</p></div>)}

          <H><AlertTriangle size={14} style={{ display: "inline", marginRight: 6 }} />What is not working</H>
          {r.whatIsntWorking.map((w, i) => <div key={i} className="au-tile"><b style={{ fontSize: 14 }}>{w.issue}</b><p className="au-muted" style={{ fontSize: 12 }}>{w.evidence}</p><p style={{ fontSize: 14, marginTop: 4 }}>Fix: {w.fix}</p></div>)}

          <H>Patterns in your posts</H>
          {r.patterns.map((p, i) => <div key={i} className="au-tile"><b style={{ fontSize: 14 }}>{p.pattern}</b><p className="au-muted" style={{ fontSize: 12 }}>{p.evidence}</p><p style={{ fontSize: 14, marginTop: 4 }}>{p.howToUse}</p></div>)}

          <H>Content pillars</H>
          <div className="au-grid3">{r.contentPillars.map((p, i) => <div key={i} className="au-tile"><b style={{ fontSize: 14 }}>{p.name}</b> <span className="au-muted" style={{ fontSize: 12 }}>{Math.round(p.sharePct)}% · {p.performance}</span><p className="au-muted" style={{ fontSize: 12, marginTop: 4 }}>{p.note}</p></div>)}</div>

          <H><Lightbulb size={14} style={{ display: "inline", marginRight: 6 }} />Next {r.nextContent.length} content ideas</H>
          {r.nextContent.map((c, i) => <div key={i} className="au-tile"><b style={{ fontSize: 14 }}>{i + 1}. {c.title}</b> <span className="au-pill">{c.format}</span><p style={{ fontSize: 14, marginTop: 6 }}>Hook: “{c.hook}”</p><p className="au-muted" style={{ fontSize: 12 }}>{c.whyItShouldWork}</p><p style={{ fontSize: 13, marginTop: 4 }}>CTA: {c.cta}</p></div>)}

          <H><CalendarDays size={14} style={{ display: "inline", marginRight: 6 }} />30-day plan</H>
          {r.plan30.map((w) => (
            <div key={w.week} className="au-tile">
              <b style={{ fontSize: 14 }}>Week {w.week}: {w.focus}</b>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "grid", gap: 6, fontSize: 13 }}>
                {w.posts.map((p, i) => { const c = r.nextContent[p.ideaNumber - 1]; return <li key={i}><b>{p.day}</b> · {c ? `${c.format} · ${c.title}` : `Idea ${p.ideaNumber}`}{c && <><br /><span className="au-muted">Hook: “{c.hook}” · CTA: {c.cta}</span></>}</li> })}
              </ul>
            </div>
          ))}

          <H><Target size={14} style={{ display: "inline", marginRight: 6 }} />30 / 60 / 90 day roadmap</H>
          <div className="au-grid3">{r.roadmap.map((p, i) => <div key={i} className="au-tile"><b style={{ fontSize: 14 }}>{p.phase}</b><p style={{ fontSize: 13, marginTop: 4 }}>{p.goal}</p><ul style={{ margin: "6px 0", paddingLeft: 18, fontSize: 13 }}>{p.actions.map((a, j) => <li key={j}>{a}</li>)}</ul><p className="au-muted" style={{ fontSize: 12 }}>Watch: {p.metric}</p></div>)}</div>

          <H>Quick wins this week</H>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, display: "grid", gap: 4 }}>{r.quickWins.map((q, i) => <li key={i}>{q}</li>)}</ul>

          <H>What this report could not see</H>
          <ul className="au-muted" style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: "grid", gap: 4 }}>{r.dataLimits.map((q, i) => <li key={i}>{q}</li>)}</ul>

          <p className="au-muted" style={{ fontSize: 12, borderTop: "1px solid var(--au-line)", paddingTop: 10 }}>
            AI-generated from your recent posts' likes and comments only. It is a starting point, not a guarantee of results. Always check ideas against your own Instagram Insights.
          </p>
        </div>
      )}
    </section>
  )
}

// Show the form again only when the user can still regenerate and has asked to (kept simple: always when runs remain).
function showForm(s: Saved | null) { return !!s && s.runsLeft > 0 }
