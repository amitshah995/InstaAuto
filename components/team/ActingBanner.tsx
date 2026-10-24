"use client"

import { useEffect, useState } from "react"
import { Users } from "lucide-react"
import { switchWorkspace } from "@/components/team/switchWorkspace"

/** Thin bar shown while a teammate is working inside someone else's account. */
export function ActingBanner() {
  const [info, setInfo] = useState<{ account?: { username: string } } | null>(null)
  useEffect(() => {
    fetch("/api/team")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.acting && setInfo(d))
      .catch(() => {})
  }, [])
  if (!info) return null
  return (
    <div className="flex items-center justify-center gap-3 bg-fuchsia-600 px-3 py-1.5 text-xs font-medium text-white">
      <Users className="h-3.5 w-3.5" />
      Working inside @{info.account?.username}'s account
      <button onClick={() => switchWorkspace()} className="rounded-full bg-white/20 px-2.5 py-0.5 font-semibold hover:bg-white/30">
        Back to my account
      </button>
    </div>
  )
}
