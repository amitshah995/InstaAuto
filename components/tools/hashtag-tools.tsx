"use client"

import { useState } from "react"
import { Loader2, Sparkles, X } from "lucide-react"
import { GROUP_META, HASHTAG_CATEGORIES, HASHTAG_LIMIT, smartPick, type HashtagGroups } from "@/lib/tools/hashtags"
import { toolBySlug } from "@/lib/tools/registry"
import { LeadCapture } from "./lead-capture"
import { CopyButton, Panel, TextField } from "./ui"

const CSS = `
.ht-grid{display:grid;gap:8px;grid-template-columns:1fr}
@media(min-width:560px){.ht-grid{grid-template-columns:1fr 1fr}}
@media(min-width:900px){.ht-grid{grid-template-columns:repeat(3,1fr)}}
.ht-row{display:flex;align-items:center;justify-content:space-between;gap:10px;border-radius:12px;padding:10px 12px;background:rgba(255,255,255,.03);border:1px solid var(--au-line);cursor:pointer;min-height:46px}
.ht-row:hover{border-color:rgba(255,59,82,.4)}
.ht-row.on{background:rgba(255,59,82,.1);border-color:rgba(255,59,82,.5)}
.ht-row.off{opacity:.45;cursor:not-allowed}
.ht-tag{color:#ff8a99;font-weight:600;overflow-wrap:anywhere}
.ht-rank{font-size:12px;color:var(--au-muted);margin-left:auto}
.ht-box{width:18px;height:18px;accent-color:#ff3b52;flex:none}
.ht-tray{position:sticky;top:8px;z-index:5;background:#101016;border:1px solid rgba(255,59,82,.35);border-radius:18px;padding:14px 16px;display:grid;gap:10px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
.ht-chips{display:flex;flex-wrap:wrap;gap:8px}
.ht-x{border:0;background:rgba(0,0,0,.4);color:#fff;border-radius:99px;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
`

function useSelection() {
  const [sel, setSel] = useState<string[]>([])
  const full = sel.length >= HASHTAG_LIMIT
  const toggle = (t: string) => setSel((s) => (s.includes(t) ? s.filter((x) => x !== t) : s.length >= HASHTAG_LIMIT ? s : [...s, t]))
  return { sel, setSel, full, toggle }
}

function Tray({ sel, onRemove, onClear, extra }: { sel: string[]; onRemove: (t: string) => void; onClear: () => void; extra?: React.ReactNode }) {
  const text = sel.map((t) => "#" + t).join(" ")
  return (
    <div className="ht-tray" aria-live="polite">
      <div className="au-row">
        <b className="au-head" style={{ fontSize: 15 }}>Your hashtags <span className="au-muted" style={{ fontWeight: 400 }}>({sel.length}/{HASHTAG_LIMIT})</span></b>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {sel.length > 0 && <button type="button" className="au-tab" onClick={onClear}>Clear</button>}
          {sel.length > 0 && <CopyButton text={text} label="Copy set" small />}
        </div>
      </div>
      {sel.length === 0
        ? <p className="au-muted" style={{ fontSize: 13 }}>Tick up to {HASHTAG_LIMIT} hashtags. Instagram now limits posts and Reels to {HASHTAG_LIMIT} hashtags, so pick the ones that fit your post best.</p>
        : <div className="ht-chips">{sel.map((t) => <span key={t} className="au-chip">#{t}<button type="button" className="ht-x" aria-label={`Remove #${t}`} onClick={() => onRemove(t)}><X size={11} /></button></span>)}</div>}
      {extra}
    </div>
  )
}

function Row({ tag, rank, on, disabled, onToggle }: { tag: string; rank?: number; on: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <label className={`ht-row${on ? " on" : ""}${disabled && !on ? " off" : ""}`}>
      <span className="ht-tag">#{tag}</span>
      {rank != null && <span className="ht-rank">#{rank}</span>}
      <input className="ht-box" type="checkbox" checked={on} disabled={disabled && !on} onChange={onToggle} aria-label={`Select #${tag}`} />
    </label>
  )
}

const Lead = ({ slug, context }: { slug: string; context: string }) => {
  const o = toolBySlug(slug)!.offer
  return <LeadCapture tool={slug} context={context} headline={o.headline} text={o.text} button={o.button} />
}

export function TopHashtags() {
  const [cat, setCat] = useState("top")
  const { sel, setSel, full, toggle } = useSelection()
  const current = HASHTAG_CATEGORIES.find((c) => c.id === cat) ?? HASHTAG_CATEGORIES[0]
  return (
    <>
      <style>{CSS}</style>
      <Tray sel={sel} onRemove={toggle} onClear={() => setSel([])} />
      <Panel title="Pick a list">
        <div className="au-tabs" role="tablist" aria-label="Hashtag lists">
          {HASHTAG_CATEGORIES.map((c) => <button key={c.id} type="button" className="au-tab" role="tab" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</button>)}
        </div>
        <div className="ht-grid">
          {current.tags.map((t, i) => <Row key={t} tag={t} rank={cat === "top" ? i + 1 : undefined} on={sel.includes(t)} disabled={full} onToggle={() => toggle(t)} />)}
        </div>
        <p className="au-muted" style={{ fontSize: 12 }}>These are commonly used hashtags, not live data. The order is a rough guide and we do not show post counts or reach. A popular tag is also a crowded one, so mix general tags with specific ones that match your post.</p>
      </Panel>
      <Lead slug="top-instagram-hashtags" context={`top hashtags | list ${cat} | ${sel.length} picked`} />
    </>
  )
}

export function HashtagGenerator() {
  const [kw, setKw] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [groups, setGroups] = useState<HashtagGroups | null>(null)
  const [used, setUsed] = useState<string[]>([])
  const { sel, setSel, full, toggle } = useSelection()

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setErr(""); setBusy(true)
    try {
      const res = await fetch("/api/tools/hashtags", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ keywords: kw }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setErr(d.error || "Something went wrong. Please try again.")
      else { setGroups(d.groups); setUsed(d.keywords); setSel(smartPick(d.groups)) }
    } catch { setErr("Network problem. Please try again.") }
    setBusy(false)
  }

  return (
    <>
      <style>{CSS}</style>
      <Panel title="Describe your post">
        <form onSubmit={run} style={{ display: "grid", gap: 12 }}>
          <TextField id="hk" label="Up to 5 keywords, separated by commas" value={kw} onChange={setKw} maxLength={160} placeholder="e.g. handmade rings, silver jewellery, gift ideas" />
          {err && <p className="au-err" role="alert">{err}</p>}
          <div><button className="au-btn" disabled={busy || kw.trim().length < 2}>{busy ? <><Loader2 size={16} className="animate-spin" /> Finding hashtags</> : <><Sparkles size={16} /> Generate hashtags</>}</button></div>
        </form>
      </Panel>
      {groups && (
        <>
          <Tray sel={sel} onRemove={toggle} onClear={() => setSel([])}
            extra={<div><button type="button" className="au-tab" onClick={() => setSel(smartPick(groups))}>Smart pick: balanced mix</button></div>} />
          {GROUP_META.map((g) => groups[g.key].length > 0 && (
            <Panel key={g.key} title={g.label}>
              <p className="au-muted" style={{ fontSize: 13, marginTop: -4 }}>{g.hint}</p>
              <div className="ht-grid">{groups[g.key].map((t) => <Row key={t} tag={t} on={sel.includes(t)} disabled={full} onToggle={() => toggle(t)} />)}</div>
            </Panel>
          ))}
          <p className="au-muted" style={{ fontSize: 12 }}>AI-suggested for: {used.join(", ")}. Suggestions are ideas to try, with no post counts or reach shown. Check that each tag fits your post before you use it.</p>
        </>
      )}
      <Lead slug="instagram-hashtag-generator" context={`hashtag generator | ${used.join(", ").slice(0, 120)}`} />
    </>
  )
}
