"use client"

/**
 * Score history for the owner's audit page: a small line of past audit scores with the change since the first.
 * Why: a score only becomes motivating when the owner can see it move after they fix something.
 * Data: /api/audit/history (owner only). With fewer than 2 audits it shows a hint instead of a chart.
 */
import { useEffect, useState } from "react"

interface Point {
  id: string
  score: number
  at: string
}

export function ScoreHistory({ currentId }: { currentId: string }) {
  const [pts, setPts] = useState<Point[] | null>(null)
  useEffect(() => {
    let alive = true
    fetch("/api/audit/history")
      .then((r) => (r.ok ? r.json() : { points: [] }))
      .then((d) => alive && setPts(d.points || []))
      .catch(() => alive && setPts([]))
    return () => {
      alive = false
    }
  }, [])

  if (pts === null) return null
  if (pts.length < 2) {
    return (
      <section className="au-card" style={{ display: "grid", gap: 6 }}>
        <h2 className="au-head" style={{ fontSize: 20 }}>Score history</h2>
        <p style={{ fontSize: 14, opacity: 0.8 }}>
          Run this audit again after you fix something. Your scores will show here so you can see what moved.
        </p>
      </section>
    )
  }

  const W = 320
  const H = 90
  const P = 8
  const xs = (i: number) => P + (i * (W - 2 * P)) / (pts.length - 1)
  const ys = (s: number) => H - P - (s / 100) * (H - 2 * P)
  const line = pts.map((p, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)},${ys(p.score).toFixed(1)}`).join(" ")
  const delta = pts[pts.length - 1].score - pts[0].score
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })

  return (
    <section className="au-card" style={{ display: "grid", gap: 10 }}>
      <h2 className="au-head" style={{ fontSize: 20, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span>Score history</span>
        <span style={{ fontSize: 14, color: delta >= 0 ? "#3ddc6b" : "#ff3b52" }}>
          {delta >= 0 ? "+" : ""}
          {delta} since {fmt(pts[0].at)}
        </span>
      </h2>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Audit score over time, from ${pts[0].score} to ${pts[pts.length - 1].score}`}
        style={{ width: "100%", height: "auto" }}
      >
        <path d={line} fill="none" stroke="#3ddc6b" strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={p.id} cx={xs(i)} cy={ys(p.score)} r={p.id === currentId ? 4.5 : 3} fill={p.id === currentId ? "#ff3b52" : "#3ddc6b"}>
            <title>{`${fmt(p.at)}: ${p.score}/100`}</title>
          </circle>
        ))}
      </svg>
      <p style={{ fontSize: 12, opacity: 0.7 }}>
        The red dot is the audit you are viewing. A score change can also come from new posts, not only your fixes.
      </p>
    </section>
  )
}
