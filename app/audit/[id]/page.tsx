"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { AuditShell } from "@/components/audit/audit-theme"
import { Loader2, Zap, Briefcase, CheckCircle2, Instagram, Target, ClipboardCheck, Clock, Gauge, Hash, TrendingDown, TrendingUp, CalendarDays, BarChart3, PieChart, Crown, ExternalLink, Activity, AlertTriangle } from "lucide-react"
import { Bars, Donut, LineChart } from "@/components/audit/charts"
import { AiReportSection } from "@/components/audit/ai-report"
import { DAY_SHORT, hourLabel, timeBreakdown } from "@/lib/audit/insights"
import { instagramAuthUrl, PENDING_AUDIT_FLAG } from "@/lib/audit/oauth-url"
import type { AuditReport, MediaKind, PostPoint, Severity } from "@/lib/audit/types"

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

const KIND_LABEL: Record<MediaKind, string> = { reel: "Reel", carousel: "Carousel", image: "Photo", video: "Video", other: "Post" }
const KIND_COLOR: Record<MediaKind, string> = { reel: "#d6246e", carousel: "#4aa8ff", image: "#f5b301", video: "#9b6bff", other: "#8b8b97" }
const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString("en-US"))
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
const inter = (m: PostPoint) => (m.likes ?? 0) + m.comments

function Panel({ title, icon, badge, sub, children, style }: { title: string; icon: React.ReactNode; badge?: string; sub?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section className="au-card" style={{ display: "grid", gap: 14, alignContent: "start", ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h2 className="au-head" style={{ fontSize: 18, display: "flex", alignItems: "center", gap: 10 }}>{icon}{title}</h2>
        {badge && <span className="au-pill">{badge}</span>}
      </div>
      {sub && <p className="au-muted" style={{ fontSize: 14, marginTop: -6 }}>{sub}</p>}
      {children}
    </section>
  )
}

function Avatar({ url, name }: { url?: string; name: string }) {
  const [bad, setBad] = useState(false)
  const box: React.CSSProperties = { width: 88, height: 88, borderRadius: "50%", padding: 3, background: "linear-gradient(135deg,#f09433,#ff3b52 55%,#c13584)", flex: "none" }
  return (
    <div style={box}>
      {url && !bad ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" onError={() => setBad(true)} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", border: "3px solid #101016" }} />
      ) : (
        <div className="au-head" style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#1a1a22", border: "3px solid #101016", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800 }}>
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  )
}

function Thumb({ post }: { post: PostPoint }) {
  const [bad, setBad] = useState(false)
  return (
    <div className="img">
      {post.thumb && !bad ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.thumb} alt="" loading="lazy" onError={() => setBad(true)} />
      ) : (
        <span>{KIND_LABEL[post.kind]}</span>
      )}
    </div>
  )
}

function Report({ id, report }: { id: string; report: AuditReport }) {
  const [interest, setInterest] = useState("dm_automation")
  const [range, setRange] = useState<"12" | "25" | "all">("all")
  const [filter, setFilter] = useState<"all" | "video" | "image" | "carousel">("all")
  const [offset, setOffset] = useState(0)
  useEffect(() => { setOffset(-new Date().getTimezoneOffset()) }, [])

  const ins = report.insights
  const posts = report.posts ?? []
  const profile = report.profile
  const color = GRADE_COLOR(report.score)

  const chrono = useMemo(() => [...posts].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp)), [posts])
  const shown = range === "all" ? chrono : chrono.slice(-Number(range))
  const tb = useMemo(() => timeBreakdown(posts, offset), [posts, offset])
  const tzLabel = useMemo(() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return "your time zone" } }, [])
  const avgInter = posts.length ? posts.reduce((a, m) => a + inter(m), 0) / posts.length : 0
  const topPost = ins?.top ? posts[ins.top.index] : null
  const mediaShown = posts.filter((m) => filter === "all" || (filter === "video" ? m.kind === "reel" || m.kind === "video" : m.kind === filter))

  const below = ins && ins.deltaPct !== null && ins.deltaPct < 0
  const stateIcon = (st: "good" | "warn" | "bad") => (
    <span className="au-icon" style={st === "good" ? undefined : { background: st === "warn" ? "rgba(245,179,1,.15)" : "rgba(255,59,82,.15)", color: st === "warn" ? "#f5b301" : "#ff3b52" }}>
      {st === "good" ? <CheckCircle2 size={16} /> : <AlertTriangle size={15} />}
    </span>
  )

  return (
    <AuditShell>
      <div className="au-wrap" style={{ padding: "40px 16px 80px", display: "grid", gap: 20 }}>
        {/* Profile header */}
        <header className="au-card" style={{ display: "grid", gap: 20 }}>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 18, alignItems: "center", flex: "1 1 340px", minWidth: 0 }}>
              <Avatar url={profile?.pictureUrl} name={report.username} />
              <div style={{ minWidth: 0 }}>
                <h1 className="au-head" style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{profile?.name || report.username}</h1>
                <p style={{ color: "#ff6e80", fontWeight: 600, marginTop: 4 }}>@{report.username}</p>
                {profile?.bio && <p className="au-muted" style={{ fontSize: 14, marginTop: 8, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{profile.bio}</p>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div className="au-tile" style={{ textAlign: "center", minWidth: 120 }}>
                <b className="au-head" style={{ fontSize: 30, color }}>{report.score}/100</b>
                <p className="au-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>Health &middot; Grade {report.grade}</p>
              </div>
              <div className="au-tile" style={{ textAlign: "center", minWidth: 120 }}>
                <b className="au-head" style={{ fontSize: 26, color }}>{ins ? ins.tier.label : report.grade}</b>
                <p className="au-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>{ins ? "Growth tier" : "Grade"}</p>
              </div>
            </div>
          </div>
          {profile && (
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", borderTop: "1px solid var(--au-line)", paddingTop: 16, fontSize: 15 }}>
              <span><b className="au-head" style={{ fontSize: 20 }}>{fmt(profile.followers)}</b> <span className="au-muted">followers</span></span>
              {profile.following !== undefined && <span><b className="au-head" style={{ fontSize: 20 }}>{fmt(profile.following)}</b> <span className="au-muted">following</span></span>}
              <span><b className="au-head" style={{ fontSize: 20 }}>{fmt(profile.posts)}</b> <span className="au-muted">posts</span></span>
            </div>
          )}
        </header>

        {ins && (
          <>
            {/* Metric tiles */}
            <div className="au-stats">
              <div className="au-stat"><b style={{ color: "#ff3b52" }}>{ins.erPct === null ? "-" : `${ins.erPct}%`}</b><span>Engagement rate</span></div>
              <div className="au-stat"><b style={{ color: "#ff6e80" }}>{ins.likesHidden ? "Hidden" : fmt(ins.totalLikes)}</b><span>Likes ({ins.postsUsed} posts)</span></div>
              <div className="au-stat"><b style={{ color: "#4aa8ff" }}>{fmt(ins.totalComments)}</b><span>Comments ({ins.postsUsed} posts)</span></div>
              <div className="au-stat"><b>{report.stats.postsLast30d}</b><span>Posts, last 30 days</span></div>
              <div className="au-stat"><b>{ins.likesHidden ? "-" : fmt(ins.avgLikes)}</b><span>Avg. likes / post</span></div>
              <div className="au-stat"><b>{ins.avgComments}</b><span>Avg. comments / post</span></div>
              <div className="au-stat"><b style={{ color: "#f5b301" }}>{ins.likeCommentRatio === null ? "-" : `${ins.likeCommentRatio}:1`}</b><span>Like / comment ratio</span></div>
              <div className="au-stat"><b style={{ color: "#3ddc6b" }}>{ins.followerFollowingRatio === null ? "-" : `${ins.followerFollowingRatio}x`}</b><span>Follower / following</span></div>
            </div>

            {/* Benchmark + signals */}
            <div className="au-grid2">
              <Panel title="Engagement vs. working target" icon={<Target size={20} color="#ff3b52" />} badge={`${ins.tier.label} (${ins.tier.range})`}
                sub="How this account's engagement rate compares with a working target for accounts of the same size.">
                <div className="au-grid2" style={{ gap: 12 }}>
                  <div className="au-tile" style={{ textAlign: "center" }}><p className="au-muted" style={{ fontSize: 13 }}>Account ER</p><b className="au-head" style={{ fontSize: 28 }}>{ins.erPct === null ? "-" : `${ins.erPct}%`}</b></div>
                  <div className="au-tile" style={{ textAlign: "center" }}><p className="au-muted" style={{ fontSize: 13 }}>Working target</p><b className="au-head" style={{ fontSize: 28, color: "#9a9aa6" }}>{ins.targetPct}%</b></div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--au-line)", paddingTop: 14, fontSize: 14 }}>
                  <span className="au-muted">Benchmark status</span>
                  {ins.deltaPct === null ? <span className="au-pill">Not enough data</span> : (
                    <span className={`au-pill ${below ? "high" : ""}`} style={below ? undefined : { background: "rgba(40,167,69,.14)", color: "#3ddc6b", border: "1px solid rgba(40,167,69,.3)" }}>
                      {below ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                      {below ? "Below target" : "On or above target"} ({ins.deltaPct > 0 ? "+" : ""}{ins.deltaPct}%)
                    </span>
                  )}
                </div>
                {ins.likesHidden && <p className="au-muted" style={{ fontSize: 12 }}>Likes are hidden on this account, so engagement uses comments only.</p>}
              </Panel>

              <Panel title="Account optimization signals" icon={<ClipboardCheck size={20} color="#3ddc6b" />} badge="Audit check">
                {ins.signals.map((sg) => (
                  <div key={sg.id} className="au-tile" style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    {stateIcon(sg.state)}
                    <div><p className="au-head" style={{ fontSize: 14 }}>{sg.title}</p><p className="au-muted" style={{ fontSize: 13 }}>{sg.detail}</p></div>
                  </div>
                ))}
              </Panel>
            </div>

            {/* Peak / cadence / hashtags */}
            <div className="au-grid3">
              <Panel title="Peak publishing slot" icon={<Clock size={18} color="#f5b301" />} sub={`Best average interactions per post, in your time zone (${tzLabel}).`}>
                {tb.peakDay && tb.peakHour !== null && posts.length >= 4 ? (
                  <div className="au-tile">
                    <p className="au-muted" style={{ fontSize: 13 }}>Best day</p>
                    <b className="au-head" style={{ fontSize: 24 }}>{tb.peakDay}</b>
                    <p className="au-muted" style={{ fontSize: 13, marginTop: 10 }}>Best window</p>
                    <b className="au-head" style={{ fontSize: 20, color: "#f5b301" }}>{hourLabel(tb.peakHour)}</b>
                  </div>
                ) : <p className="au-muted" style={{ fontSize: 14 }}>Needs at least 4 recent posts.</p>}
                <span className="au-pill" style={{ justifySelf: "start" }}>Based on {posts.length} posts</span>
              </Panel>

              <Panel title="Cadence & consistency" icon={<Gauge size={18} color="#3ddc6b" />} sub="Upload regularity across your recent posts.">
                <div className="au-grid2" style={{ gap: 10 }}>
                  <div className="au-tile" style={{ textAlign: "center" }}><p className="au-muted" style={{ fontSize: 12 }}>Cadence</p><b className="au-head" style={{ fontSize: 22 }}>{ins.cadence.perWeek}/wk</b></div>
                  <div className="au-tile" style={{ textAlign: "center" }}><p className="au-muted" style={{ fontSize: 12 }}>Consistency</p><b className="au-head" style={{ fontSize: 22, color: ins.cadence.consistency === null ? undefined : GRADE_COLOR(ins.cadence.consistency) }}>{ins.cadence.consistency === null ? "-" : `${ins.cadence.consistency}/100`}</b></div>
                </div>
                {ins.cadence.avgGapDays !== null && <p className="au-muted" style={{ fontSize: 13 }}>{ins.cadence.avgGapDays} days average between posts</p>}
              </Panel>

              <Panel title="Frequent hashtags" icon={<Hash size={18} color="#ff3b52" />} sub="Tags that repeat across your recent captions.">
                {ins.hashtags.length ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {ins.hashtags.map((h) => <span key={h.tag} className="au-chip">{h.tag}<i>{h.count}</i></span>)}
                  </div>
                ) : <p className="au-muted" style={{ fontSize: 14 }}>No hashtags found in recent captions.</p>}
                <p className="au-muted" style={{ fontSize: 13 }}>Avg. caption: <b style={{ color: "#fff" }}>{ins.avgCaptionLength}</b> chars</p>
              </Panel>
            </div>

            {/* Charts */}
            {chrono.length >= 2 && (
              <div style={{ display: "grid", gap: 16 }} className="au-chartrow">
                <Panel title="Recent post performance" icon={<Activity size={18} color="#ff3b52" />} sub="Likes and comments across your recent published posts.">
                  <div className="au-tabs" role="group" aria-label="Range">
                    {([["12", "Last 12"], ["25", "Last 25"], ["all", "All"]] as const).map(([k, l]) => (
                      <button key={k} className="au-tab" aria-pressed={range === k} onClick={() => setRange(k)}>{l}</button>
                    ))}
                  </div>
                  <LineChart labels={shown.map((m) => shortDate(m.timestamp))} likes={shown.map((m) => m.likes ?? 0)} comments={shown.map((m) => m.comments)} />
                </Panel>
                <Panel title="Content format mix" icon={<PieChart size={18} color="#f5b301" />} sub="Audited post types.">
                  <Donut parts={(["reel", "image", "carousel", "video"] as MediaKind[]).map((k) => ({ label: KIND_LABEL[k] + "s", value: ins.formats.find((f) => f.kind === k)?.count ?? 0, color: KIND_COLOR[k] })).filter((p, i) => p.value > 0 || i < 3)} />
                </Panel>
              </div>
            )}
            <style>{`.au-chartrow{grid-template-columns:1fr}@media(min-width:900px){.au-chartrow{grid-template-columns:2fr 1fr}}`}</style>

            {posts.length >= 4 && (
              <div className="au-grid2">
                <Panel title="Day-of-week interaction" icon={<CalendarDays size={18} color="#ff3b52" />} sub="Average interactions per post by weekday.">
                  <Bars items={DAY_SHORT.map((d, i) => ({ label: d, value: tb.dayAvg[i] }))} color="#b3243a" />
                </Panel>
                <Panel title="Avg. interactions by format" icon={<BarChart3 size={18} color="#4aa8ff" />} sub="Which content type earns the most per upload.">
                  <Bars items={ins.formats.map((f) => ({ label: KIND_LABEL[f.kind], value: f.avgInteractions, color: KIND_COLOR[f.kind] }))} />
                </Panel>
              </div>
            )}

            {/* Top performer */}
            {topPost && ins.top && (
              <section className="au-card" style={{ display: "grid", gap: 16, borderColor: "rgba(255,59,82,.25)" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="au-pill" style={{ background: "#f5b301", color: "#1a1300" }}><Crown size={13} /> Top performer</span>
                    {ins.top.multipleOfAvg > 0 && <span className="au-pill high">{ins.top.multipleOfAvg}x vs avg</span>}
                  </div>
                  {topPost.permalink && <a href={topPost.permalink} target="_blank" rel="noopener noreferrer" className="au-btn ghost" style={{ padding: "8px 16px", fontSize: 13 }}>Open on Instagram <ExternalLink size={13} /></a>}
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <div className="au-post" style={{ width: 130, flex: "none" }}><Thumb post={topPost} /><span className="tag">{KIND_LABEL[topPost.kind]}</span></div>
                  <div className="au-tile" style={{ flex: "1 1 280px" }}>
                    <p className="au-muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".04em" }}>Winning hook / caption</p>
                    <p style={{ marginTop: 6, fontSize: 14, overflowWrap: "anywhere" }}>{topPost.caption ? `"${topPost.caption}"` : "No caption."}</p>
                  </div>
                </div>
                <div className="au-grid3" style={{ gap: 10 }}>
                  <div className="au-tile" style={{ textAlign: "center" }}><p className="au-muted" style={{ fontSize: 12 }}>Likes</p><b className="au-head" style={{ fontSize: 22, color: "#ff3b52" }}>{topPost.likes === null ? "Hidden" : fmt(topPost.likes)}</b></div>
                  <div className="au-tile" style={{ textAlign: "center" }}><p className="au-muted" style={{ fontSize: 12 }}>Comments</p><b className="au-head" style={{ fontSize: 22, color: "#4aa8ff" }}>{fmt(topPost.comments)}</b></div>
                  <div className="au-tile" style={{ textAlign: "center" }}><p className="au-muted" style={{ fontSize: 12 }}>Post ER</p><b className="au-head" style={{ fontSize: 22, color: "#f5b301" }}>{ins.top.erPct === null ? "-" : `${ins.top.erPct}%`}</b></div>
                </div>
              </section>
            )}
          </>
        )}

        {/* Score breakdown */}
        <section className="au-card" style={{ display: "grid", gap: 14 }}>
          <h2 className="au-head" style={{ fontSize: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <Target size={20} color="#ff3b52" /> Score breakdown
          </h2>
          <div className="au-grid2">
            {report.categories.map((c) => (
              <div key={c.id} className="au-tile">
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span>{c.label}</span><span className="au-head" style={{ color: GRADE_COLOR(c.score) }}>{c.score}</span>
                </div>
                <div className="au-bar" style={{ marginTop: 8 }}><i style={{ width: `${c.score}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        {/* Findings */}
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

        {/* Media stream */}
        {posts.length > 0 && (
          <section className="au-card" style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h2 className="au-head" style={{ fontSize: 20 }}>Audited media stream</h2>
                <p className="au-muted" style={{ fontSize: 13 }}>Showing {mediaShown.length} of {posts.length} posts audited</p>
              </div>
              <div className="au-tabs" role="group" aria-label="Filter posts">
                {([["all", "All"], ["video", "Reels/Videos"], ["image", "Photos"], ["carousel", "Carousels"]] as const).map(([k, l]) => (
                  <button key={k} className="au-tab" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="au-media">
              {mediaShown.map((m, i) => {
                const Tag: any = m.permalink ? "a" : "div"
                const extra = m.permalink ? { href: m.permalink, target: "_blank", rel: "noopener noreferrer" } : {}
                return (
                  <Tag key={`${m.timestamp}-${i}`} className="au-post" {...extra}>
                    <Thumb post={m} />
                    <span className="tag">{KIND_LABEL[m.kind]}</span>
                    <div className="meta">
                      <span style={{ color: "#ff6e80" }}>{m.likes === null ? "Likes hidden" : `${fmt(m.likes)} likes`}</span>
                      <span style={{ color: "#6cb4ff" }}>{fmt(m.comments)} {m.comments === 1 ? "comment" : "comments"}</span>
                    </div>
                  </Tag>
                )
              })}
            </div>
            {avgInter > 0 && <p className="au-muted" style={{ fontSize: 12 }}>Average per post: {Math.round(avgInter)} interactions.</p>}
          </section>
        )}

        {report.insights && report.posts && report.posts.length > 0 && <AiReportSection auditId={id} report={report} />}

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

export default function AuditResultPage() {
  const { id } = useParams<{ id: string }>()
  const [view, setView] = useState<View | null>(null)
  const [notFound, setNotFound] = useState(false)

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
  return <Report id={id} report={view.report} />
}
