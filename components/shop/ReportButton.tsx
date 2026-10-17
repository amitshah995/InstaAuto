"use client"

import { useState } from "react"
import { Check, Flag } from "lucide-react"

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
    <button
      onClick={report}
      aria-label={done ? "Reported" : "Report this link"}
      title={done ? "Reported" : "Report this link"}
      className="grid h-7 w-7 place-items-center rounded-full bg-background/85 text-muted-foreground shadow-sm backdrop-blur hover:text-foreground"
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Flag className="h-3.5 w-3.5" />}
    </button>
  )
}
