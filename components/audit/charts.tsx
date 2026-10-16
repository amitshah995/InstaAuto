"use client"

import { useState } from "react"

/** Tiny dependency-free SVG charts in the audit palette. */

const RED = "#ff3b52"
const BLUE = "#4aa8ff"
const GRID = "rgba(255,255,255,.07)"
const AXIS = "#8b8b97"

function niceMax(v: number) {
  if (v <= 0) return 10
  const p = 10 ** Math.floor(Math.log10(v))
  const f = v / p
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
  return (steps.find((s) => f <= s) ?? 10) * p
}

export function LineChart({ labels, likes, comments }: { labels: string[]; likes: number[]; comments: number[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640, H = 240, L = 40, R = 12, T = 12, B = 28
  const n = labels.length
  const max = niceMax(Math.max(1, ...likes, ...comments))
  const x = (i: number) => (n <= 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1))
  const y = (v: number) => T + (1 - v / max) * (H - T - B)
  const path = (xs: number[]) => xs.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const area = `${path(likes)} L${x(n - 1)},${H - B} L${x(0)},${H - B} Z`
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t))
  const step = Math.max(1, Math.ceil(n / 7))
  return (
    <div>
      <div style={{ display: "flex", gap: 16, fontSize: 12, marginBottom: 6, color: AXIS }}>
        <span><i style={{ display: "inline-block", width: 14, height: 3, background: RED, marginRight: 6, verticalAlign: "middle" }} />Likes</span>
        <span><i style={{ display: "inline-block", width: 14, height: 0, borderTop: `2px dashed ${BLUE}`, marginRight: 6, verticalAlign: "middle" }} />Comments</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Likes and comments per post over time" style={{ width: "100%", height: "auto" }}
        onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill={AXIS}>{t}</text>
          </g>
        ))}
        <defs>
          <linearGradient id="au-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={RED} stopOpacity=".35" /><stop offset="1" stopColor={RED} stopOpacity="0" />
          </linearGradient>
        </defs>
        {n > 1 && <path d={area} fill="url(#au-area)" />}
        <path d={path(likes)} fill="none" stroke={RED} strokeWidth="2.5" strokeLinejoin="round" />
        <path d={path(comments)} fill="none" stroke={BLUE} strokeWidth="2" strokeDasharray="5 4" />
        {likes.map((v, i) => (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <circle cx={x(i)} cy={y(v)} r={hover === i ? 5 : 3.5} fill={RED} />
            <rect x={x(i) - 10} y={T} width="20" height={H - T - B} fill="transparent" />
          </g>
        ))}
        {labels.map((l, i) => (i % step === 0 || i === n - 1) && (
          <text key={i} x={x(i)} y={H - 8} textAnchor={i === n - 1 && n > 1 ? "end" : "middle"} fontSize="10" fill={AXIS}>{l}</text>
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <rect x={Math.min(Math.max(x(hover) - 55, L), W - R - 110)} y={T + 2} width="110" height="44" rx="8" fill="#050507" stroke={GRID} />
            <text x={Math.min(Math.max(x(hover) - 55, L), W - R - 110) + 8} y={T + 18} fontSize="11" fill="#fff">{labels[hover]}</text>
            <text x={Math.min(Math.max(x(hover) - 55, L), W - R - 110) + 8} y={T + 31} fontSize="11" fill={RED}>Likes: {likes[hover]}</text>
            <text x={Math.min(Math.max(x(hover) - 55, L), W - R - 110) + 8} y={T + 43} fontSize="11" fill={BLUE}>Comments: {comments[hover]}</text>
          </g>
        )}
      </svg>
    </div>
  )
}

export function Donut({ parts, center, hideLegend }: { parts: { label: string; value: number; color: string }[]; center?: { value: string; label: string }; hideLegend?: boolean }) {
  const total = parts.reduce((a, p) => a + p.value, 0)
  const R = 70, C = 2 * Math.PI * R
  let acc = 0
  return (
    <div>
      <svg viewBox="0 0 200 200" role="img" aria-label="Content format mix" style={{ width: "100%", maxWidth: 220, margin: "0 auto", display: "block" }}>
        <circle cx="100" cy="100" r={R} fill="none" stroke={GRID} strokeWidth="26" />
        {total > 0 && parts.filter((p) => p.value > 0).map((p) => {
          const len = (p.value / total) * C
          const el = (
            <circle key={p.label} cx="100" cy="100" r={R} fill="none" stroke={p.color} strokeWidth="26"
              strokeDasharray={`${Math.max(0, len - 2)} ${C - Math.max(0, len - 2)}`} strokeDashoffset={-acc}
              transform="rotate(-90 100 100)" />
          )
          acc += len
          return el
        })}
        <text x="100" y="98" textAnchor="middle" fontSize="26" fontWeight="800" fill="#fff">{center ? center.value : total}</text>
        <text x="100" y="116" textAnchor="middle" fontSize="11" fill={AXIS}>{center ? center.label : "posts"}</text>
      </svg>
      {!hideLegend && <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginTop: 12, fontSize: 13 }}>
        {parts.map((p) => (
          <span key={p.label}><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: p.color, marginRight: 6 }} />{p.label} ({p.value})</span>
        ))}
      </div>}
    </div>
  )
}

export function Bars({ items, color = RED }: { items: { label: string; value: number; color?: string }[]; color?: string }) {
  const W = 420, H = 200, L = 34, B = 24, T = 8
  const max = niceMax(Math.max(1, ...items.map((i) => i.value)))
  const bw = (W - L) / items.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ width: "100%", height: "auto" }}>
      {[0, 0.5, 1].map((t) => {
        const v = Math.round(max * t), yy = T + (1 - t) * (H - T - B)
        return <g key={t}><line x1={L} x2={W} y1={yy} y2={yy} stroke={GRID} /><text x={L - 6} y={yy + 4} textAnchor="end" fontSize="10" fill={AXIS}>{v}</text></g>
      })}
      {items.map((it, i) => {
        const h = (it.value / max) * (H - T - B)
        return (
          <g key={it.label}>
            <rect x={L + i * bw + bw * 0.2} y={H - B - h} width={bw * 0.6} height={Math.max(h, 0)} rx="6" fill={it.color ?? color} opacity={it.value ? 0.9 : 0.25} />
            {it.value > 0 && <text x={L + i * bw + bw / 2} y={H - B - h - 5} textAnchor="middle" fontSize="10" fill="#d4d4dc">{it.value}</text>}
            <text x={L + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill={AXIS}>{it.label}</text>
          </g>
        )
      })}
    </svg>
  )
}
