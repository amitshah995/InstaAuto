"use client"

import { useState, type ReactNode } from "react"
import { Check, Copy, AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import type { Check as CheckItem } from "@/lib/tools/text"

/** Parses what the user typed ("1,200", "") into a number (0 when empty or invalid). */
export const toNum = (s: string) => {
  const n = parseFloat(String(s).replace(/,/g, ""))
  return isFinite(n) && n > 0 ? n : 0
}
export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN")
export const int = (n: number) => Math.round(n).toLocaleString("en-IN")

export function NumField({ label, value, onChange, prefix, suffix, hint, id }: {
  label: string; value: string; onChange: (v: string) => void; prefix?: string; suffix?: string; hint?: string; id: string
}) {
  return (
    <div>
      <label className="au-label" htmlFor={id}>{label}</label>
      <div className="au-aff">
        {prefix && <span className="pre">{prefix}</span>}
        <input id={id} className={`au-input${prefix ? " hasp" : ""}${suffix ? " hass" : ""}`} inputMode="decimal" value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))} aria-describedby={hint ? `${id}-h` : undefined} />
        {suffix && <span className="suf">{suffix}</span>}
      </div>
      {hint && <p id={`${id}-h`} className="au-muted" style={{ fontSize: 12, marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

export function TextField({ label, value, onChange, placeholder, id, maxLength, multiline, rows }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; id: string; maxLength?: number; multiline?: boolean; rows?: number
}) {
  return (
    <div>
      <label className="au-label" htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea id={id} className="au-input ta" value={value} rows={rows ?? 6} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className="au-input" value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}

export function SelectField({ label, value, onChange, options, id }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; id: string }) {
  return (
    <div>
      <label className="au-label" htmlFor={id}>{label}</label>
      <select id={id} className="au-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export function CopyButton({ text, label = "Copy", small }: { text: string; label?: string; small?: boolean }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement("textarea")
      ta.value = text; document.body.appendChild(ta); ta.select()
      try { document.execCommand("copy") } catch {}
      ta.remove()
    }
    setDone(true)
    setTimeout(() => setDone(false), 1600)
  }
  return (
    <button type="button" className="au-btn ghost" onClick={copy} style={{ padding: small ? "7px 14px" : "10px 20px", fontSize: small ? 13 : 14 }} aria-live="polite">
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? "Copied" : label}
    </button>
  )
}

export function Tile({ label, value, color, sub }: { label: string; value: ReactNode; color?: string; sub?: string }) {
  return (
    <div className="au-stat">
      <b style={color ? { color } : undefined}>{value}</b>
      <span>{label}</span>
      {sub && <p className="au-muted" style={{ fontSize: 11, marginTop: 4, textTransform: "none", letterSpacing: 0 }}>{sub}</p>}
    </div>
  )
}

export function CheckList({ checks }: { checks: CheckItem[] }) {
  const meta = {
    good: { Icon: CheckCircle2, bg: "rgba(40,167,69,.16)", fg: "#3ddc6b" },
    warn: { Icon: AlertTriangle, bg: "rgba(245,179,1,.15)", fg: "#f5b301" },
    bad: { Icon: XCircle, bg: "rgba(255,59,82,.15)", fg: "#ff3b52" },
  } as const
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {checks.map((c) => {
        const { Icon, bg, fg } = meta[c.state]
        return (
          <div key={c.id} className="au-tile" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="au-icon" style={{ background: bg, color: fg }}><Icon size={16} /></span>
            <div><p className="au-head" style={{ fontSize: 14 }}>{c.label}</p><p className="au-muted" style={{ fontSize: 13 }}>{c.detail}</p></div>
          </div>
        )
      })}
    </div>
  )
}

export function Panel({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="au-card" style={{ display: "grid", gap: 14 }}>
      {(title || actions) && (
        <div className="au-row">{title && <h2 className="au-head" style={{ fontSize: 18 }}>{title}</h2>}{actions}</div>
      )}
      {children}
    </div>
  )
}
