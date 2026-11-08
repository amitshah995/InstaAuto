"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { PageShell } from "@/components/marketing/page-shell"

export default function JoinTeamPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const [state, setState] = useState<"loading" | "login" | "done" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    let loggedIn = false
    try {
      loggedIn = !!localStorage.getItem("ig_user_id")
    } catch {}
    if (!loggedIn) return setState("login")
    fetch("/api/team/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (r.status === 401) return setState("login")
        if (!r.ok) {
          setMessage(d.error || "Could not join")
          return setState("error")
        }
        setMessage(d.owner?.username ? `You can now work in @${d.owner.username}'s account.` : "You joined the team.")
        setState("done")
      })
      .catch(() => {
        setMessage("Network error")
        setState("error")
      })
  }, [code])

  return (
    <PageShell strip={false}>
    <div className="text-c-ink flex items-center justify-center px-4  min-h-[60vh]">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-c-line bg-c-surface p-6 text-center ">
        <h1 className="text-xl font-bold">Team invite</h1>
        {state === "loading" && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
        {state === "login" && (
          <>
            <p className="text-sm text-c-muted">Log in with your own Instagram account first, then open this invite link again.</p>
            <Link href="/" className="inline-block rounded-[5px] bg-c-accent px-5 py-2.5 text-sm font-semibold text-c-accent-ink">Go to login</Link>
          </>
        )}
        {state === "done" && (
          <>
            <p className="text-sm text-c-muted">{message}</p>
            <Link href="/dashboard/settings" className="inline-block rounded-[5px] bg-c-accent px-5 py-2.5 text-sm font-semibold text-c-accent-ink">Open Settings → Team</Link>
          </>
        )}
        {state === "error" && <p className="text-sm text-destructive">{message}</p>}
      </div>
    </div>
    </PageShell>
  )
}
