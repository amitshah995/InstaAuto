"use client"

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts"

export function FollowerChart({ data }: { data: { day: string; followers: number }[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        Growth chart fills in as daily snapshots are collected (needs at least 2 days).
      </div>
    )
  }
  const min = Math.min(...data.map((d) => d.followers))
  const max = Math.max(...data.map((d) => d.followers))
  const pad = Math.max(2, Math.round((max - min) * 0.2))
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d946ef" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#d946ef" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={[min - pad, max + pad]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
          <Tooltip />
          <Area type="monotone" dataKey="followers" stroke="#d946ef" strokeWidth={2.5} fill="url(#fg)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
