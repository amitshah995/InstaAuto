"use client"

import { useMemo, useState } from "react"
import { Download } from "lucide-react"
import { qrMatrix, qrSvg } from "@/lib/tools/qr"
import { DM_CATEGORIES, DM_TEMPLATES, fillTemplate } from "@/lib/tools/templates"
import { toolBySlug } from "@/lib/tools/registry"
import { LeadCapture } from "./lead-capture"
import { CopyButton, Panel, TextField } from "./ui"

const Lead = ({ slug, context }: { slug: string; context: string }) => {
  const o = toolBySlug(slug)!.offer
  return <LeadCapture tool={slug} context={context} headline={o.headline} text={o.text} button={o.button} />
}

/** Accepts "@name", "name" or a full instagram.com/name URL. */
function cleanUsername(raw: string): string {
  let s = raw.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "")
  s = s.split(/[/?#]/)[0]
  return s
}
const USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function ChatLinkGenerator() {
  const [raw, setRaw] = useState("")
  const username = cleanUsername(raw)
  const valid = USERNAME_RE.test(username)
  const link = valid ? `https://ig.me/m/${username}` : ""
  const svg = useMemo(() => (link ? qrSvg(link, 256) : ""), [link])

  function pngDownload() {
    const m = qrMatrix(link), scale = 12, quiet = 4
    const size = (m.length + quiet * 2) * scale
    const c = document.createElement("canvas")
    c.width = size; c.height = size
    const ctx = c.getContext("2d")!
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = "#000"
    m.forEach((row, y) => row.forEach((v, x) => { if (v) ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale) }))
    c.toBlob((b) => b && download(`instagram-chat-${username}.png`, b), "image/png")
  }

  return (
    <>
      <Panel title="Your Instagram username">
        <TextField id="cl" label="Username" value={raw} onChange={setRaw} placeholder="@yourusername" maxLength={80} />
        {raw.trim() && !valid && <p role="alert" className="au-err">Usernames use letters, numbers, dots and underscores (up to 30 characters).</p>}
      </Panel>
      {valid && (
        <Panel title="Your chat link and QR code">
          <div className="au-tile au-row" style={{ flexWrap: "wrap" }}>
            <code style={{ fontSize: 15, overflowWrap: "anywhere" }}>{link}</code>
            <CopyButton text={link} label="Copy link" small />
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} alt={`QR code that opens a chat with ${username}`} width={200} height={200} style={{ borderRadius: 12, background: "#fff" }} />
            <div style={{ display: "grid", gap: 10 }}>
              <button type="button" className="au-btn" onClick={pngDownload} style={{ padding: "11px 22px", fontSize: 15 }}><Download size={16} /> Download PNG</button>
              <button type="button" className="au-btn ghost" onClick={() => download(`instagram-chat-${username}.svg`, new Blob([qrSvg(link, 1024)], { type: "image/svg+xml" }))} style={{ padding: "10px 22px", fontSize: 14 }}><Download size={14} /> Download SVG</button>
            </div>
          </div>
          <p className="au-muted" style={{ fontSize: 13 }}>Use it in your bio, story links, ads, WhatsApp status, business cards and shop packaging. The link opens a chat with you in the Instagram app.</p>
        </Panel>
      )}
      <Lead slug="chat-link-generator" context={`chat link for ${valid ? "@" + username : "-"}`} />
    </>
  )
}

export function DmTemplates() {
  const [v, setV] = useState({ name: "", business: "", link: "", keyword: "", offer: "", price: "", time: "" })
  const [cat, setCat] = useState(DM_CATEGORIES[0])
  const vars = { ...v, business: v.business || "{business}" }
  const list = DM_TEMPLATES.filter((t) => t.category === cat)
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x })
  return (
    <>
      <Panel title="Your details (optional)">
        <div className="au-grid2">
          <TextField id="d-b" label="Business name" value={v.business} onChange={set("business")} placeholder="Asha Boutique" maxLength={60} />
          <TextField id="d-n" label="Customer name" value={v.name} onChange={set("name")} placeholder="Leave empty to keep {name}" maxLength={40} />
          <TextField id="d-l" label="Link" value={v.link} onChange={set("link")} placeholder="https://..." maxLength={200} />
          <TextField id="d-k" label="Comment keyword" value={v.keyword} onChange={set("keyword")} placeholder="LINK" maxLength={30} />
          <TextField id="d-o" label="Offer or product" value={v.offer} onChange={set("offer")} placeholder="Our bridal collection" maxLength={80} />
          <TextField id="d-p" label="Price" value={v.price} onChange={set("price")} placeholder={"₹999"} maxLength={30} />
          <TextField id="d-t" label="Time or date" value={v.time} onChange={set("time")} placeholder="10am to 7pm" maxLength={40} />
        </div>
      </Panel>
      <Panel title="Pick a situation">
        <div className="au-tabs" role="group" aria-label="Template category">
          {DM_CATEGORIES.map((c) => <button key={c} className="au-tab" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {list.map((t) => {
            const body = fillTemplate(t.body, vars)
            return (
              <div key={t.id} className="au-tile" style={{ display: "grid", gap: 10 }}>
                <div className="au-row"><b className="au-head" style={{ fontSize: 15 }}>{t.title}</b><CopyButton text={body} small /></div>
                <div className="au-bubble">{body}</div>
              </div>
            )
          })}
        </div>
        <p className="au-muted" style={{ fontSize: 12 }}>Send these as replies to people who messaged or commented. Do not send unsolicited bulk messages.</p>
      </Panel>
      <Lead slug="dm-templates" context={`dm templates | ${cat}`} />
    </>
  )
}
