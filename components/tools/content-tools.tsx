"use client"

import { useMemo, useState } from "react"
import { beatSheet, checkCaption, checkHook, PREVIEW_CHARS, splitCarousel, type Goal } from "@/lib/tools/text"
import { toolBySlug } from "@/lib/tools/registry"
import { LeadCapture } from "./lead-capture"
import { CheckList, CopyButton, NumField, Panel, SelectField, TextField, Tile, toNum } from "./ui"

const Lead = ({ slug, context }: { slug: string; context: string }) => {
  const o = toolBySlug(slug)!.offer
  return <LeadCapture tool={slug} context={context} headline={o.headline} text={o.text} button={o.button} />
}

// ------------------------------------------------------------------ caption checker
export function CaptionChecker() {
  const [text, setText] = useState("")
  const r = useMemo(() => checkCaption(text), [text])
  return (
    <>
      <Panel title="Your caption">
        <TextField id="cap" label="Paste or type your caption" value={text} onChange={setText} multiline rows={8} placeholder="Write the first line like a headline..." />
        <p className="au-muted" style={{ fontSize: 13 }}>{r.length} / 2,200 characters</p>
      </Panel>
      {text.trim() && (
        <>
          <Panel title="What people see before &quot;more&quot;">
            <div className="au-bubble">
              <span style={{ color: "#fff" }}>{r.preview}</span>
              {r.hidden && <><span className="au-muted"> ... </span><b style={{ color: "#9a9aa6" }}>more</b></>}
            </div>
            <p className="au-muted" style={{ fontSize: 12 }}>About the first {PREVIEW_CHARS} characters show in the feed. The rest is hidden until someone taps &quot;more&quot;.</p>
          </Panel>
          <Panel title={`Checks: ${r.passed} of ${r.total} passed`}>
            <CheckList checks={r.checks} />
            {r.hashtags.length > 0 && <p className="au-muted" style={{ fontSize: 13 }}>Hashtags found: {r.hashtags.join(" ")}</p>}
          </Panel>
        </>
      )}
      <Lead slug="caption-checker" context={`caption ${r.length} chars | ${r.hashtags.length} hashtags | ${r.passed}/${r.total} checks`} />
    </>
  )
}

// ------------------------------------------------------------------ hook checker
export function HookChecker() {
  const [hook, setHook] = useState("")
  const [topic, setTopic] = useState("")
  const r = useMemo(() => checkHook(hook, topic), [hook, topic])
  return (
    <>
      <Panel title="Your hook">
        <TextField id="hk" label="First line of your Reel (spoken or on screen)" value={hook} onChange={setHook} placeholder="Stop making these 3 mistakes in your Reels" maxLength={300} />
        <TextField id="hk-t" label="Your topic (for rewrite ideas)" value={topic} onChange={setTopic} placeholder="Instagram growth" maxLength={80} />
      </Panel>
      {hook.trim() && (
        <Panel title={`Checks: ${r.passed} of ${r.total} passed`}>
          <CheckList checks={r.checks} />
          <p className="au-muted" style={{ fontSize: 12 }}>This is a checklist for common problems. It cannot predict how a Reel will perform.</p>
        </Panel>
      )}
      <Panel title="Hook ideas to try">
        <div style={{ display: "grid", gap: 10 }}>
          {r.ideas.map((i) => (
            <div key={i.name} className="au-tile au-row">
              <div><p className="au-muted" style={{ fontSize: 12 }}>{i.name}</p><p style={{ fontSize: 15 }}>{i.text}</p></div>
              <CopyButton text={i.text} small />
            </div>
          ))}
        </div>
      </Panel>
      <Lead slug="hook-checker" context={`hook ${r.words} words | ${r.passed}/${r.total} checks | topic ${topic || "-"}`} />
    </>
  )
}

// ------------------------------------------------------------------ beat sheet
export function ReelBeatSheet() {
  const [v, setV] = useState({ topic: "", seconds: "30", goal: "sell" as Goal, keyword: "LINK" })
  const beats = useMemo(() => beatSheet({ topic: v.topic, seconds: toNum(v.seconds) || 30, goal: v.goal, keyword: v.keyword }), [v])
  const plain = beats.map((b) => `${b.range} ${b.name}\nSay: ${b.say}\nOn screen: ${b.onScreen}`).join("\n\n")
  return (
    <>
      <Panel title="Your Reel">
        <div className="au-grid2">
          <TextField id="bs-t" label="Topic" value={v.topic} onChange={(x) => setV({ ...v, topic: x })} placeholder="How to price your services" maxLength={100} />
          <SelectField id="bs-s" label="Length" value={v.seconds} onChange={(x) => setV({ ...v, seconds: x })} options={["15", "30", "45", "60", "90"].map((s) => ({ value: s, label: `${s} seconds` }))} />
          <SelectField id="bs-g" label="Goal" value={v.goal} onChange={(x) => setV({ ...v, goal: x as Goal })} options={[{ value: "sell", label: "Sell or get enquiries" }, { value: "educate", label: "Teach something" }, { value: "entertain", label: "Entertain and grow" }]} />
          <TextField id="bs-k" label="Comment keyword" value={v.keyword} onChange={(x) => setV({ ...v, keyword: x })} placeholder="LINK" maxLength={20} />
        </div>
      </Panel>
      <Panel title="Your beat sheet" actions={<CopyButton text={plain} label="Copy all" small />}>
        <div style={{ display: "grid", gap: 10 }}>
          {beats.map((b) => (
            <div key={b.range + b.name} className="au-tile" style={{ display: "grid", gap: 4 }}>
              <div className="au-row"><b className="au-head">{b.name}</b><span className="au-pill">{b.range}</span></div>
              <p style={{ fontSize: 14 }}>{b.say}</p>
              <p className="au-muted" style={{ fontSize: 13 }}>On screen: {b.onScreen}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Lead slug="reel-beat-sheet" context={`${v.seconds}s reel | ${v.goal} | topic ${v.topic || "-"}`} />
    </>
  )
}

// ------------------------------------------------------------------ carousel splitter
export function CarouselTextSplitter() {
  const [text, setText] = useState("")
  const [max, setMax] = useState("180")
  const slides = useMemo(() => splitCarousel(text, toNum(max) || 180), [text, max])
  const all = slides.map((s, i) => `Slide ${i + 1}/${slides.length}\n${s}`).join("\n\n")
  return (
    <>
      <Panel title="Your text">
        <TextField id="cs" label="Paste your long text" value={text} onChange={setText} multiline rows={8} />
        <div style={{ maxWidth: 260 }}><NumField id="cs-m" label="Max characters per slide" value={max} onChange={setMax} /></div>
      </Panel>
      {slides.length > 0 && (
        <Panel title={`${slides.length} slide${slides.length === 1 ? "" : "s"}`} actions={<CopyButton text={all} label="Copy all" small />}>
          <div className="au-media" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))" }}>
            {slides.map((s, i) => (
              <div key={i} className="au-tile" style={{ display: "grid", gap: 8, alignContent: "space-between" }}>
                <div><span className="au-pill">{i + 1}/{slides.length}</span><p style={{ marginTop: 10, fontSize: 14, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{s}</p></div>
                <div><CopyButton text={s} small /></div>
              </div>
            ))}
          </div>
        </Panel>
      )}
      <Lead slug="carousel-text-splitter" context={`${slides.length} slides | ${text.length} chars`} />
    </>
  )
}

// ------------------------------------------------------------------ image sizes
const SIZES: { group: string; rows: [string, string, string, string][] }[] = [
  { group: "Instagram", rows: [
    ["Feed post (portrait)", "1080 x 1350", "4:5", "Takes the most room in the feed"],
    ["Feed post (square)", "1080 x 1080", "1:1", ""],
    ["Feed post (landscape)", "1080 x 566", "1.91:1", "Smaller in the feed"],
    ["Carousel", "1080 x 1350", "4:5", "Keep every slide the same size"],
    ["Reel", "1080 x 1920", "9:16", "Keep text away from the top and bottom edges"],
    ["Story", "1080 x 1920", "9:16", "Leave room at the top and bottom for buttons"],
    ["Profile photo", "320 x 320", "1:1", "Shown as a circle"],
    ["Reel cover", "1080 x 1920", "9:16", "Keep the title in the centre so grid crops do not cut it"],
  ] },
  { group: "Other platforms", rows: [
    ["YouTube Shorts / WhatsApp status", "1080 x 1920", "9:16", ""],
    ["YouTube thumbnail", "1280 x 720", "16:9", ""],
    ["Facebook post", "1200 x 630", "1.91:1", ""],
    ["LinkedIn post", "1200 x 627", "1.91:1", ""],
    ["X (Twitter) post", "1600 x 900", "16:9", ""],
  ] },
]
export function InstagramImageSizes() {
  return (
    <>
      {SIZES.map((g) => (
        <Panel key={g.group} title={g.group}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 460 }}>
              <thead><tr className="au-muted" style={{ textAlign: "left", fontSize: 12 }}><th style={{ padding: "8px 8px 8px 0" }}>Format</th><th>Size (px)</th><th>Ratio</th><th>Tip</th></tr></thead>
              <tbody>
                {g.rows.map(([n, s, ratio, tip]) => (
                  <tr key={n} style={{ borderTop: "1px solid var(--au-line)" }}>
                    <td style={{ padding: "10px 8px 10px 0", fontWeight: 600 }}>{n}</td>
                    <td className="au-head" style={{ color: "#ff6e80", whiteSpace: "nowrap" }}>{s}</td>
                    <td className="au-muted">{ratio}</td>
                    <td className="au-muted" style={{ fontSize: 13 }}>{tip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {g.group === "Instagram" && <p className="au-muted" style={{ fontSize: 12 }}>Sizes are the commonly recommended ones and platforms change them from time to time.</p>}
        </Panel>
      ))}
      <Lead slug="instagram-image-sizes" context="image sizes cheat sheet" />
    </>
  )
}
