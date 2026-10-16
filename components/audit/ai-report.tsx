"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Sparkles, CheckCircle2, Lightbulb, CalendarDays, Target, Copy, Check, Trophy, Wrench, ChevronDown, Flag, Rocket, Film, LayoutGrid, Image as ImageIcon, Video, Circle, Flame } from "lucide-react"
import type { AiReport } from "@/lib/audit/ai/schema"
import type { AuditReport, MediaKind } from "@/lib/audit/types"
import { Donut } from "@/components/audit/charts"
import { DAY_SHORT, timeBreakdown } from "@/lib/audit/insights"

interface Brief { niche: string; goal: string; audience: string; offer: string; postsPerWeek: number; language: "en" | "hinglish" }
interface Saved { report: AiReport; brief: Brief; generatedAt: string; runsLeft: number }
type Fmt = "reel" | "carousel" | "image" | "video" | "story"

const GOALS: [string, string][] = [["sales", "Sales"], ["leads", "Leads / enquiries"], ["followers", "Followers"], ["brand", "Brand awareness"], ["community", "Community"]]
const FMT: Record<Fmt, { label: string; color: string; Icon: typeof Film }> = {
  reel: { label: "Reel", color: "#d6246e", Icon: Film },
  carousel: { label: "Carousel", color: "#4aa8ff", Icon: LayoutGrid },
  image: { label: "Image", color: "#f5b301", Icon: ImageIcon },
  video: { label: "Video", color: "#9b6bff", Icon: Video },
  story: { label: "Story", color: "#2dd4bf", Icon: Circle },
}
const fmtOf = (k: string) => FMT[(k in FMT ? k : "image") as Fmt]
const PERF: Record<string, { color: string; label: string }> = { above: { color: "#3ddc6b", label: "Above your average" }, average: { color: "#f5b301", label: "About average" }, below: { color: "#ff6477", label: "Below your average" } }
const CONF: Record<string, { pct: number; color: string }> = { low: { pct: 34, color: "#6cb4ff" }, medium: { pct: 67, color: "#f5b301" }, high: { pct: 100, color: "#3ddc6b" } }
const DAY_IDX = (d: string) => Math.max(0, ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].indexOf(d.trim().slice(0, 3).toLowerCase()))

const CSS = `
.ai-hero{position:relative;border-radius:24px;padding:1px;background:linear-gradient(135deg,#f09433,#ff3b52 45%,#c13584 75%,#4aa8ff)}
.ai-hero>div{background:linear-gradient(180deg,#14101a,#0f0f15);border-radius:23px;padding:24px;display:grid;gap:18px}
.ai-hero-top{display:grid;gap:18px;align-items:center}
@media(min-width:720px){.ai-hero-top{grid-template-columns:1fr auto}}
.ai-nav{display:flex;gap:8px;flex-wrap:wrap}
.ai-nav a{font-size:12px;font-weight:600;color:#c9c9d1;text-decoration:none;border:1px solid var(--au-line);background:rgba(255,255,255,.04);border-radius:999px;padding:5px 12px}
.ai-nav a:hover{border-color:rgba(255,59,82,.5);color:#fff}
.ai-sec{display:grid;gap:12px;scroll-margin-top:16px}
.ai-sec>h4{display:flex;align-items:center;gap:8px;font-size:17px}
.ai-sec>h4 .ic{display:inline-flex;width:30px;height:30px;border-radius:10px;align-items:center;justify-content:center;flex:none}
.ai-sub{font-size:13px;color:var(--au-muted);margin-top:-6px}
.ai-card{background:rgba(255,255,255,.025);border:1px solid var(--au-line);border-radius:16px;padding:14px 16px}
.ai-win{border-left:3px solid #3ddc6b}
.ai-bad{border-left:3px solid #ff6477}
.ai-fix{margin-top:8px;border-radius:12px;background:rgba(61,220,107,.08);border:1px solid rgba(61,220,107,.22);padding:8px 12px;font-size:14px}
.ai-grid{display:grid;gap:12px}
@media(min-width:720px){.ai-grid.c2{grid-template-columns:1fr 1fr}.ai-grid.c3{grid-template-columns:repeat(3,1fr)}}
.ai-thumb{width:64px;height:80px;border-radius:12px;object-fit:cover;background:#15151c;flex:none}
.ai-mult{display:inline-flex;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700;background:rgba(61,220,107,.14);color:#3ddc6b}
.ai-bars{position:relative;display:flex;align-items:flex-end;gap:6px;height:170px;padding-top:8px}
.ai-bar{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;height:100%;position:relative}
.ai-bar span{height:14px;line-height:14px}
.ai-bar i{display:block;width:100%;max-width:38px;border-radius:6px 6px 2px 2px;min-height:3px}
.ai-bar span{font-size:10px;color:var(--au-muted)}
.ai-bar.cited i{outline:2px solid #3ddc6b;outline-offset:2px}
.ai-median{position:absolute;left:0;right:0;border-top:1.5px dashed rgba(255,255,255,.45);pointer-events:none}
.ai-median em{position:absolute;left:0;top:-18px;font-style:normal;font-size:11px;color:#c9c9d1;background:#101016;padding:0 4px}
.ai-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--au-muted)}
.ai-legend b{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.ai-idea{display:grid;gap:8px;align-content:start}
.ai-num{display:inline-flex;width:28px;height:28px;border-radius:50%;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#0a0a0c;flex:none}
.ai-hook{border-radius:12px;background:rgba(255,255,255,.05);padding:10px 12px;font-size:15px;font-weight:600;line-height:1.4}
.ai-copy{border:1px solid var(--au-line);background:transparent;color:#c9c9d1;border-radius:999px;padding:3px 10px;font-size:12px;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.ai-copy:hover{background:rgba(255,255,255,.07)}
.ai-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.ai-cal .dow{font-size:11px;text-align:center;color:var(--au-muted);padding-bottom:2px}
.ai-cell{min-height:44px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid var(--au-line);display:flex;align-items:center;justify-content:center}
.ai-chip{border:0;cursor:pointer;width:100%;height:100%;min-height:42px;border-radius:9px;color:#0a0a0c;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;gap:4px}
.ai-chip[aria-pressed=true]{outline:2px solid #fff;outline-offset:1px}
.ai-chip:focus-visible{outline:2px solid #fff;outline-offset:1px}
.ai-stack{display:flex;gap:2px;height:14px}
.ai-stack i{display:block;height:100%;border-radius:4px;min-width:4px}
.ai-road{display:grid;gap:12px}
@media(min-width:720px){.ai-road{grid-template-columns:repeat(3,1fr)}}
.ai-phase{position:relative;border-radius:18px;padding:16px;border:1px solid var(--au-line);background:rgba(255,255,255,.025);display:grid;gap:8px;align-content:start}
.ai-phase .dot{display:inline-flex;width:34px;height:34px;border-radius:50%;align-items:center;justify-content:center;color:#fff}
.ai-watch{display:flex;gap:6px;align-items:flex-start;border-radius:12px;padding:6px 10px;font-size:12px;background:rgba(74,168,255,.12);color:#7cc0ff;border:1px solid rgba(74,168,255,.28)}
.ai-todo{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left;cursor:pointer;color:inherit;font:inherit;font-size:14px}
.ai-tick{flex:none;width:24px;height:24px;border-radius:8px;border:2px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center}
.ai-todo[aria-pressed=true] .ai-tick{background:#3ddc6b;border-color:#3ddc6b;color:#0a0a0c}
.ai-todo[aria-pressed=true] span:last-child{opacity:.6;text-decoration:line-through}
.ai-ring{position:relative;width:112px;height:112px;flex:none}
.ai-ring b{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--font-audit-head),sans-serif;font-size:15px;text-transform:capitalize}
.ai-ring b small{font-family:var(--font-audit-body),sans-serif;font-size:10px;color:var(--au-muted);text-transform:none;font-weight:400}
.ai-det summary{cursor:pointer;font-weight:600;font-size:14px;list-style:none;display:flex;align-items:center;gap:8px}
.ai-det summary::-webkit-details-marker{display:none}
@media (prefers-reduced-motion:no-preference){.ai-ring circle.p{transition:stroke-dashoffset .9s ease}}
`

function Sec({ id, icon, color, title, sub, children }: { id: string; icon: React.ReactNode; color: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div id={id} className="ai-sec">
      <h4 className="au-head"><span className="ic" style={{ background: color + "22", color }}>{icon}</span>{title}</h4>
      {sub && <p className="ai-sub">{sub}</p>}
      {children}
    </div>
  )
}

function Gauge({ level }: { level: string }) {
  const c = CONF[level] ?? CONF.low
  const R = 46, C = 2 * Math.PI * R
  return (
    <div className="ai-ring" role="img" aria-label={`Confidence ${level}`}>
      <svg viewBox="0 0 112 112" width="112" height="112">
        <circle cx="56" cy="56" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" />
        <circle className="p" cx="56" cy="56" r={R} fill="none" stroke={c.color} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - c.pct / 100)} transform="rotate(-90 56 56)" />
      </svg>
      <b>{level}<small>confidence</small></b>
    </div>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button type="button" className="ai-copy" aria-label="Copy hook" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500) } catch {} }}>
      {ok ? <Check size={12} /> : <Copy size={12} />}{ok ? "Copied" : "Copy"}
    </button>
  )
}

export function AiReportSection({ auditId, report }: { auditId: string; report: AuditReport }) {
  const [saved, setSaved] = useState<Saved | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [sel, setSel] = useState<{ w: number; d: number } | null>(null)
  const [done, setDone] = useState<boolean[]>([false, false, false])
  const [b, setB] = useState<Brief>({ niche: "", goal: "sales", audience: "", offer: "", postsPerWeek: 3, language: "en" })

  const storeKey = `dmspark-qw-${auditId}`
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(storeKey) || "null"); if (Array.isArray(v) && v.length === 3) setDone(v.map(Boolean)) } catch {} }, [storeKey])
  const toggle = (i: number) => setDone((d) => { const n = d.map((x, j) => (j === i ? !x : x)); try { localStorage.setItem(storeKey, JSON.stringify(n)) } catch {} return n })

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
      else { setSaved(d); setSel(null) }
    } catch { setErr("Network problem. Please try again.") }
    setBusy(false)
  }

  const posts = report.posts ?? []
  const chart = useMemo(() => {
    const items = posts.slice(0, 12).map((p, i) => ({ ref: `P${i + 1}`, v: (p.likes ?? 0) + p.comments, kind: p.kind, thumb: p.thumb }))
    const all = posts.map((p) => (p.likes ?? 0) + p.comments).sort((x, y) => x - y)
    const m = all.length ? (all.length % 2 ? all[(all.length - 1) / 2] : (all[all.length / 2 - 1] + all[all.length / 2]) / 2) : 0
    return { items, median: m, max: Math.max(1, ...items.map((x) => x.v), m) }
  }, [posts])
  const tb = useMemo(() => (posts.length >= 4 ? timeBreakdown(posts, -new Date().getTimezoneOffset()) : null), [posts])

  const r = saved?.report
  const planned = useMemo(() => {
    const c: Record<string, number> = {}
    r?.plan30.forEach((w) => w.posts.forEach((p) => { const k = r.nextContent[p.ideaNumber - 1]?.format ?? "image"; c[k] = (c[k] || 0) + 1 }))
    return c
  }, [r])

  if (!loaded) return null
  const showForm = !r
  const formEl = (
    <form onSubmit={generate} style={{ display: "grid", gap: 12 }}>
      {!r && <p className="au-muted" style={{ fontSize: 14 }}>Answer 5 quick questions. We combine them with your last posts and write a content plan made for your account: what to post, when, and why.</p>}
      <div className="au-grid2">
        <div><label className="au-label" htmlFor="ai-niche">What do you sell or post about?</label><input id="ai-niche" className="au-input" required minLength={2} maxLength={80} placeholder="e.g. handmade jewellery" value={b.niche} onChange={(e) => setB({ ...b, niche: e.target.value })} /></div>
        <div><label className="au-label" htmlFor="ai-goal">Main goal</label><select id="ai-goal" className="au-input" value={b.goal} onChange={(e) => setB({ ...b, goal: e.target.value })}>{GOALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className="au-label" htmlFor="ai-aud">Who is your audience?</label><input id="ai-aud" className="au-input" required minLength={2} maxLength={120} placeholder="e.g. women 22-35 in India" value={b.audience} onChange={(e) => setB({ ...b, audience: e.target.value })} /></div>
        <div><label className="au-label" htmlFor="ai-offer">What should people do or buy?</label><input id="ai-offer" className="au-input" required minLength={2} maxLength={160} placeholder="e.g. custom rings, DM to order" value={b.offer} onChange={(e) => setB({ ...b, offer: e.target.value })} /></div>
        <div><label className="au-label" htmlFor="ai-ppw">Posts you can make per week</label><input id="ai-ppw" type="number" min={1} max={14} className="au-input" value={b.postsPerWeek} onChange={(e) => setB({ ...b, postsPerWeek: Math.min(14, Math.max(1, Number(e.target.value) || 1)) })} /></div>
        <div><label className="au-label" htmlFor="ai-lang">Report language</label><select id="ai-lang" className="au-input" value={b.language} onChange={(e) => setB({ ...b, language: e.target.value as Brief["language"] })}><option value="en">English</option><option value="hinglish">Hinglish</option></select></div>
      </div>
      {err && <p className="au-err" role="alert">{err}</p>}
      <div><button className="au-btn" disabled={busy}>{busy ? <><Loader2 size={16} className="animate-spin" /> Writing your report (about 40 seconds)</> : r ? "Update brief and regenerate" : <><Sparkles size={16} /> Generate my AI report</>}</button></div>
    </form>
  )

  if (!r) {
    return (
      <section className="au-card" style={{ display: "grid", gap: 16, borderColor: "rgba(255,59,82,.25)" }}>
        <style>{CSS}</style>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}><span className="au-icon red"><Sparkles size={16} /></span><h3 className="au-head" style={{ fontSize: 20 }}>AI Growth Report <span className="au-pill" style={{ marginLeft: 6 }}>Free preview</span></h3></div>
        {showForm && formEl}
      </section>
    )
  }

  const selIdea = sel ? r.nextContent[(r.plan30[sel.w]?.posts.filter((p) => DAY_IDX(p.day) === sel.d)[0]?.ideaNumber ?? 0) - 1] : null
  const currentMix = report.insights?.formats ?? []
  const currentTotal = currentMix.reduce((a, f) => a + f.count, 0) || 1
  const plannedTotal = Object.values(planned).reduce((a, n) => a + n, 0) || 1
  const doneCount = done.filter(Boolean).length

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <style>{CSS}</style>

      <div className="ai-hero"><div>
        <div className="ai-hero-top">
          <div style={{ display: "grid", gap: 10 }}>
            <span className="au-pill high" style={{ width: "fit-content" }}><Sparkles size={12} /> Your AI Growth Report</span>
            <h3 className="au-head" style={{ fontSize: 26, lineHeight: 1.2 }}>{r.summary.headline}</h3>
            <p style={{ fontSize: 15, color: "#d6d6dd", lineHeight: 1.55 }}>{r.summary.verdict}</p>
          </div>
          <div style={{ display: "grid", gap: 6, justifyItems: "center", maxWidth: 200, textAlign: "center" }}>
            <Gauge level={r.summary.confidence} />
            <p className="au-muted" style={{ fontSize: 11 }}>{r.summary.confidenceNote}</p>
          </div>
        </div>
        <div className="au-stats">
          <div className="au-stat"><b>{report.insights?.postsUsed ?? posts.length}</b><span>Posts analysed</span></div>
          <div className="au-stat"><b style={{ color: (report.insights?.deltaPct ?? 0) >= 0 ? "#3ddc6b" : "#f5b301" }}>{report.insights?.erPct != null ? `${report.insights.erPct}%` : "n/a"}</b><span>Engagement rate</span></div>
          <div className="au-stat"><b style={{ color: "#4aa8ff" }}>{Math.round(chart.median)}</b><span>Typical post (median)</span></div>
          <div className="au-stat"><b style={{ color: "#f09433" }}>{tb?.peakDay ? tb.peakDay.slice(0, 3) : "n/a"}</b><span>Best day so far</span></div>
        </div>
        <nav className="ai-nav" aria-label="Report sections">
          {[["ai-posts", "Your posts"], ["ai-works", "What worked"], ["ai-fix", "What to fix"], ["ai-pillars", "Pillars"], ["ai-ideas", "Ideas"], ["ai-plan", "30-day plan"], ["ai-road", "Roadmap"], ["ai-wins", "Quick wins"]].map(([h, l]) => <a key={h} href={`#${h}`}>{l}</a>)}
        </nav>
      </div></div>

      <section className="au-card" style={{ display: "grid", gap: 26 }}>
        <Sec id="ai-posts" icon={<Flame />} color="#ff6b35" title="How each recent post did" sub="Likes plus comments per post. The dashed line is your median, the green outline marks posts the report calls out.">
          <div className="ai-bars" role="img" aria-label="Interactions per recent post compared with the median">
            {chart.items.map((x) => {
              const cited = r.whatWorked.some((w) => w.postRef === x.ref)
              return (
                <div key={x.ref} className={`ai-bar${cited ? " cited" : ""}`} title={`${x.ref}: ${x.v} interactions (${fmtOf(x.kind).label})`}>
                  <i style={{ height: Math.max(3, Math.round((x.v / chart.max) * 130)), background: fmtOf(x.kind).color }} />
                  <span>{x.ref}</span>
                </div>
              )
            })}
            {chart.median > 0 && <div className="ai-median" style={{ bottom: 18 + Math.round((chart.median / chart.max) * 130) }}><em>median {Math.round(chart.median)}</em></div>}
          </div>
          <div className="ai-legend">{(["reel", "carousel", "image", "video"] as Fmt[]).filter((k) => chart.items.some((x) => x.kind === k)).map((k) => <span key={k}><b style={{ background: FMT[k].color }} />{FMT[k].label}</span>)}<span>P1 = newest post</span></div>
        </Sec>

        <Sec id="ai-works" icon={<Trophy />} color="#3ddc6b" title="What worked" sub="Your strongest posts and the reason they likely landed.">
          <div className="ai-grid c2">
            {r.whatWorked.map((w, i) => {
              const idx = Number(w.postRef.slice(1)) - 1, p = posts[idx]
              const v = p ? (p.likes ?? 0) + p.comments : 0
              const mult = chart.median > 0 ? Math.round((v / chart.median) * 10) / 10 : null
              return (
                <div key={i} className="ai-card ai-win" style={{ display: "flex", gap: 12 }}>
                  {p?.thumb ? <img className="ai-thumb" src={p.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="ai-thumb" />}
                  <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b>{w.postRef}</b>{mult != null && <span className="ai-mult">{mult}x your median</span>}</div>
                    <p style={{ fontSize: 14 }}>{w.why}</p>
                    <p className="au-muted" style={{ fontSize: 12 }}>{w.evidence}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Sec>

        <Sec id="ai-fix" icon={<Wrench />} color="#ff6477" title="What to fix first" sub="Each problem comes with one concrete fix.">
          <div className="ai-grid c2">
            {r.whatIsntWorking.map((w, i) => (
              <div key={i} className="ai-card ai-bad">
                <b style={{ fontSize: 14 }}>{w.issue}</b>
                <p className="au-muted" style={{ fontSize: 12, marginTop: 4 }}>{w.evidence}</p>
                <div className="ai-fix"><b style={{ color: "#3ddc6b" }}>Fix:</b> {w.fix}</div>
              </div>
            ))}
          </div>
        </Sec>

        <Sec id="ai-patterns" icon={<Lightbulb />} color="#f5b301" title="Patterns to use" sub="Early signals from your own posts. Treat them as things to test.">
          <div className="ai-grid c2">
            {r.patterns.map((p, i) => (
              <div key={i} className="ai-card"><b style={{ fontSize: 14 }}>{p.pattern}</b><p className="au-muted" style={{ fontSize: 12, margin: "4px 0 6px" }}>{p.evidence}</p><p style={{ fontSize: 14 }}>{p.howToUse}</p></div>
            ))}
          </div>
        </Sec>

        <Sec id="ai-pillars" icon={<Target />} color="#9b6bff" title="Your content pillars" sub="The themes in your recent posts and how each one performs.">
          {(() => { const pal = ["#d6246e", "#4aa8ff", "#f5b301", "#9b6bff", "#2dd4bf"]; return (
            <div className="ai-grid c2" style={{ alignItems: "center" }}>
              <Donut hideLegend center={{ value: String(r.contentPillars.length), label: "themes" }} parts={r.contentPillars.map((p, i) => ({ label: p.name, value: Math.max(p.sharePct, 0.5), color: pal[i % pal.length] }))} />
              <div style={{ display: "grid", gap: 8 }}>
                {r.contentPillars.map((p, i) => (
                  <div key={i} className="ai-card" style={{ borderLeft: `3px solid ${pal[i % pal.length]}` }}>
                    <div className="au-row"><b style={{ fontSize: 14 }}>{p.name}</b><span style={{ fontSize: 12, color: PERF[p.performance].color, fontWeight: 600 }}>{Math.round(p.sharePct)}% · {PERF[p.performance].label}</span></div>
                    <p className="au-muted" style={{ fontSize: 12, marginTop: 4 }}>{p.note}</p>
                  </div>
                ))}
              </div>
            </div>
          ) })()}
        </Sec>
      </section>

      <section className="au-card" style={{ display: "grid", gap: 26 }}>
        <Sec id="ai-ideas" icon={<Rocket />} color="#ff3b52" title={`${r.nextContent.length} posts to make next`} sub="Ready-to-use hooks. Tap Copy and paste the first line into your caption or reel.">
          <div className="ai-grid c2">
            {r.nextContent.map((c, i) => { const f = fmtOf(c.format); return (
              <div key={i} className="ai-card ai-idea" style={{ borderTop: `3px solid ${f.color}` }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span className="ai-num" style={{ background: f.color }}>{i + 1}</span>
                  <b style={{ fontSize: 15, flex: 1 }}>{c.title}</b>
                  <span className="au-pill"><f.Icon size={12} />{f.label}</span>
                </div>
                <div className="ai-hook">“{c.hook}”</div>
                <div><CopyBtn text={c.hook} /></div>
                <p className="au-muted" style={{ fontSize: 12 }}>{c.whyItShouldWork}</p>
                <p style={{ fontSize: 13 }}><b>Call to action:</b> {c.cta}</p>
              </div>
            ) })}
          </div>
        </Sec>

        <Sec id="ai-plan" icon={<CalendarDays />} color="#4aa8ff" title="Your 30-day content calendar" sub="Each coloured box is one post. Tap a box to see the idea behind it.">
          <div style={{ display: "grid", gap: 14 }}>
            {r.plan30.map((w, wi) => (
              <div key={w.week} style={{ display: "grid", gap: 6 }}>
                <p style={{ fontSize: 14 }}><b>Week {w.week}</b> <span className="au-muted">· {w.focus}</span></p>
                <div className="ai-cal">
                  {DAY_SHORT.map((d) => <span key={d} className="dow">{d}</span>)}
                  {DAY_SHORT.map((_, di) => {
                    const ps = w.posts.filter((p) => DAY_IDX(p.day) === di)
                    return (
                      <div key={di} className="ai-cell">
                        {ps.length > 0 && (() => { const idea = r.nextContent[ps[0].ideaNumber - 1]; const f = fmtOf(idea?.format ?? "image"); const on = sel?.w === wi && sel?.d === di; return (
                          <button type="button" className="ai-chip" style={{ background: f.color }} aria-pressed={on} aria-label={`Week ${w.week} ${DAY_SHORT[di]}: ${idea?.title ?? "post"}`} onClick={() => setSel(on ? null : { w: wi, d: di })}>
                            <f.Icon size={13} />{ps[0].ideaNumber}
                          </button>
                        ) })()}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {selIdea ? (
              <div className="ai-card" style={{ borderColor: fmtOf(selIdea.format).color }}>
                <b>{selIdea.title}</b> <span className="au-pill" style={{ marginLeft: 6 }}>{fmtOf(selIdea.format).label}</span>
                <div className="ai-hook" style={{ margin: "8px 0" }}>“{selIdea.hook}”</div>
                <p className="au-muted" style={{ fontSize: 12 }}>{selIdea.whyItShouldWork}</p>
                <p style={{ fontSize: 13, marginTop: 4 }}><b>Call to action:</b> {selIdea.cta}</p>
              </div>
            ) : <p className="au-muted" style={{ fontSize: 12 }}>Tap a coloured box above to open that day's idea.</p>}
            <div className="ai-legend">{(Object.keys(FMT) as Fmt[]).filter((k) => planned[k]).map((k) => <span key={k}><b style={{ background: FMT[k].color }} />{FMT[k].label} ({planned[k]})</span>)}</div>
          </div>
          <div className="ai-card" style={{ display: "grid", gap: 10 }}>
            <b style={{ fontSize: 14 }}>Format mix: what you post now vs this plan</b>
            <div style={{ display: "grid", gap: 4 }}><span className="au-muted" style={{ fontSize: 12 }}>Now ({currentTotal === 1 && !currentMix.length ? 0 : currentTotal} posts)</span>
              <div className="ai-stack" role="img" aria-label="Current format mix">{(Object.keys(FMT) as string[]).map((k) => currentMix.find((f) => f.kind === k)).filter((f): f is NonNullable<typeof f> => !!f && f.count > 0).map((f) => <i key={f.kind} title={`${fmtOf(f.kind).label}: ${f.count}`} style={{ width: `${(f.count / currentTotal) * 100}%`, background: fmtOf(f.kind).color }} />)}</div></div>
            <div style={{ display: "grid", gap: 4 }}><span className="au-muted" style={{ fontSize: 12 }}>This plan ({plannedTotal} posts)</span>
              <div className="ai-stack" role="img" aria-label="Planned format mix">{(Object.keys(FMT) as Fmt[]).filter((k) => planned[k]).map((k) => <i key={k} title={`${fmtOf(k).label}: ${planned[k]}`} style={{ width: `${(planned[k] / plannedTotal) * 100}%`, background: fmtOf(k).color }} />)}</div></div>
          </div>
        </Sec>

        <Sec id="ai-road" icon={<Flag />} color="#f09433" title="Your 30 / 60 / 90 day roadmap" sub="One focus per month. The blue tag is a number you can watch in your own Instagram Insights.">
          <div className="ai-road">
            {r.roadmap.map((p, i) => { const c = ["#ff6b35", "#d6246e", "#9b6bff"][i]; return (
              <div key={i} className="ai-phase" style={{ borderTop: `3px solid ${c}` }}>
                <span className="dot" style={{ background: c }}>{i + 1}</span>
                <b className="au-head" style={{ fontSize: 15 }}>{p.phase}</b>
                <p style={{ fontSize: 14 }}>{p.goal}</p>
                <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 13, listStyle: "disc" }}>{p.actions.map((a, j) => <li key={j}>{a}</li>)}</ul>
                <span className="ai-watch"><Target size={12} />Watch: {p.metric}</span>
              </div>
            ) })}
          </div>
        </Sec>
      </section>

      <section id="ai-wins" className="au-card" style={{ display: "grid", gap: 12, borderColor: "rgba(61,220,107,.3)", scrollMarginTop: 16 }}>
        <div className="au-row"><h4 className="au-head" style={{ fontSize: 17 }}><CheckCircle2 size={16} style={{ display: "inline", color: "#3ddc6b", marginRight: 8 }} />3 quick wins for this week</h4><span className="au-muted" style={{ fontSize: 13 }}>{doneCount}/3 done</span></div>
        <div className="au-bar" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={doneCount}><i style={{ width: `${(doneCount / 3) * 100}%`, background: "linear-gradient(90deg,#28a745,#3ddc6b)" }} /></div>
        {r.quickWins.map((q, i) => (
          <button key={i} type="button" className="ai-todo ai-card" aria-pressed={done[i]} onClick={() => toggle(i)}>
            <span className="ai-tick">{done[i] && <Check size={14} />}</span><span>{q}</span>
          </button>
        ))}
        <p style={{ fontSize: 14, color: doneCount === 3 ? "#3ddc6b" : "var(--au-muted)" }}>
          {doneCount === 3 ? "All three done. Nice work. Run a fresh audit in two weeks and see what changed." : "Small steps add up. Tick each one as you finish it."}
        </p>
      </section>

      <section className="au-card" style={{ display: "grid", gap: 10 }}>
        <details className="ai-det"><summary><ChevronDown size={16} />What this report could not see</summary>
          <ul className="au-muted" style={{ margin: "10px 0 0", paddingLeft: 20, fontSize: 13, display: "grid", gap: 4, listStyle: "disc" }}>{r.dataLimits.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </details>
        {saved && saved.runsLeft > 0 && (
          <details className="ai-det"><summary><ChevronDown size={16} />Change my answers and regenerate ({saved.runsLeft} left)</summary><div style={{ marginTop: 12 }}>{formEl}</div></details>
        )}
        <p className="au-muted" style={{ fontSize: 12, borderTop: "1px solid var(--au-line)", paddingTop: 10 }}>
          AI-generated from the likes and comments on your recent posts. It is a starting point, not a guarantee of results. Check every idea against your own Instagram Insights.
        </p>
      </section>
    </div>
  )
}
