"use client"

import { useState } from "react"

export default function ReportButton({ slug }: { slug: string }) {
  const [done, setDone] = useState(false)
  const report = async () => {
    if (done) return
    try {
      await fetch("/api/links/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      })
    } catch {
      /* ignore */
    }
    setDone(true)
  }
  return (
    <button onClick={report} className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur" aria-label="Report this link">
      {done ? "Reported" : "Report"}
    </button>
  )
}
