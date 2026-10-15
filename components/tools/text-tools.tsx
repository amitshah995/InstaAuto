"use client"

import { useMemo, useState } from "react"
import { Gift, RefreshCw } from "lucide-react"
import { fancyFonts, formatCaption, parseEntries, pickWinners, SPACER } from "@/lib/tools/text"
import { toolBySlug } from "@/lib/tools/registry"
import { LeadCapture } from "./lead-capture"
import { CopyButton, NumField, Panel, TextField, toNum } from "./ui"

const Lead = ({ slug, context }: { slug: string; context: string }) => {
  const o = toolBySlug(slug)!.offer
  return <LeadCapture tool={slug} context={context} headline={o.headline} text={o.text} button={o.button} />
}

export function FancyFontsGenerator() {
  const [text, setText] = useState("Your name here")
  const styles = useMemo(() => fancyFonts(text || "Your name here"), [text])
  return (
    <>
      <Panel title="Your text">
        <TextField id="ff" label="Type your text" value={text} onChange={setText} maxLength={300} />
      </Panel>
      <Panel title="Pick a style">
        <div style={{ display: "grid", gap: 10 }}>
          {styles.map((s) => (
            <div key={s.name} className="au-tile au-row">
              <div style={{ minWidth: 0 }}>
                <p className="au-muted" style={{ fontSize: 12 }}>{s.name}</p>
                <p style={{ fontSize: 20, overflowWrap: "anywhere" }}>{s.out}</p>
              </div>
              <CopyButton text={s.out} small />
            </div>
          ))}
        </div>
        <p className="au-muted" style={{ fontSize: 12 }}>These are special characters. Screen readers may read them badly, so use them for short text such as a name or heading, not whole captions.</p>
      </Panel>
      <Lead slug="fancy-fonts-generator" context={`fancy fonts | ${text.length} chars`} />
    </>
  )
}

export function CaptionFormatter() {
  const [text, setText] = useState("")
  const [bullets, setBullets] = useState(true)
  const [collapse, setCollapse] = useState(true)
  const out = useMemo(() => formatCaption(text, { bullets, collapse }), [text, bullets, collapse])
  return (
    <>
      <Panel title="Your caption">
        <TextField id="fm" label="Paste your caption with its line breaks" value={text} onChange={setText} multiline rows={8} />
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 14 }}>
          <label style={{ display: "flex", gap: 8 }}><input type="checkbox" checked={bullets} onChange={(e) => setBullets(e.target.checked)} /> Turn &quot;- item&quot; into bullets</label>
          <label style={{ display: "flex", gap: 8 }}><input type="checkbox" checked={collapse} onChange={(e) => setCollapse(e.target.checked)} /> Keep only one blank line between paragraphs</label>
        </div>
      </Panel>
      {out && (
        <Panel title="Formatted caption" actions={<CopyButton text={out} label="Copy caption" small />}>
          <div className="au-bubble">{out.split(SPACER).join(" ")}</div>
          <p className="au-muted" style={{ fontSize: 12 }}>Blank lines now hold an invisible character, so Instagram keeps your spacing. Paste the copied text into your caption.</p>
        </Panel>
      )}
      <Lead slug="caption-formatter" context={`caption formatter | ${text.length} chars`} />
    </>
  )
}

export function GiveawayPicker() {
  const [raw, setRaw] = useState("")
  const [exclude, setExclude] = useState("")
  const [winners, setWinners] = useState("1")
  const [backups, setBackups] = useState("1")
  const [dedupe, setDedupe] = useState(true)
  const [res, setRes] = useState<{ winners: string[]; backups: string[]; poolSize: number; at: string } | null>(null)
  const entries = useMemo(() => parseEntries(raw), [raw])

  function pick() {
    const r = pickWinners({ entries, winners: toNum(winners) || 1, backups: toNum(backups), dedupe, exclude: parseEntries(exclude) })
    setRes({ ...r, at: new Date().toLocaleString() })
  }
  const record = res ? `Giveaway draw on ${res.at}\nEntries in pool: ${res.poolSize}\nWinners: ${res.winners.map((w) => "@" + w).join(", ") || "-"}\nBackups: ${res.backups.map((w) => "@" + w).join(", ") || "-"}` : ""
  return (
    <>
      <Panel title="Entries">
        <TextField id="gp" label="Paste usernames, one per line (or separated by commas)" value={raw} onChange={setRaw} multiline rows={8} placeholder={"@anna\n@ravi\n@meera"} />
        <TextField id="gp-x" label="Leave out these usernames (your own account, partners)" value={exclude} onChange={setExclude} placeholder="@yourbrand" />
        <div className="au-grid2">
          <NumField id="gp-w" label="Number of winners" value={winners} onChange={setWinners} />
          <NumField id="gp-b" label="Backup winners" value={backups} onChange={setBackups} />
        </div>
        <label style={{ display: "flex", gap: 8, fontSize: 14 }}><input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} /> Count each username once</label>
        <p className="au-muted" style={{ fontSize: 13 }}>{entries.length} entr{entries.length === 1 ? "y" : "ies"} found.</p>
        <div><button type="button" className="au-btn" onClick={pick} disabled={entries.length === 0} style={{ padding: "12px 28px", fontSize: 15 }}>{res ? <RefreshCw size={16} /> : <Gift size={16} />} {res ? "Pick again" : "Pick winners"}</button></div>
      </Panel>
      {res && (
        <Panel title="Result" actions={<CopyButton text={record} label="Copy record" small />}>
          {res.winners.length === 0 ? <p className="au-muted">No eligible entries.</p> : (
            <div className="au-grid2">
              <div className="au-tile"><p className="au-muted" style={{ fontSize: 12 }}>Winner{res.winners.length > 1 ? "s" : ""}</p>{res.winners.map((w) => <p key={w} className="au-head" style={{ fontSize: 22, color: "#3ddc6b" }}>@{w}</p>)}</div>
              {res.backups.length > 0 && <div className="au-tile"><p className="au-muted" style={{ fontSize: 12 }}>Backup{res.backups.length > 1 ? "s" : ""}</p>{res.backups.map((w) => <p key={w} className="au-head" style={{ fontSize: 18 }}>@{w}</p>)}</div>}
            </div>
          )}
          <p className="au-muted" style={{ fontSize: 12 }}>Picked with your browser&apos;s secure random number generator from {res.poolSize} eligible entries. Check each winner follows your giveaway rules.</p>
        </Panel>
      )}
      <Lead slug="giveaway-picker" context={`giveaway | ${entries.length} entries`} />
    </>
  )
}
