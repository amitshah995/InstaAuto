"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"

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
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-fuchsia-50 to-orange-50 px-4 font-sans text-neutral-900">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold">Team invite</h1>
        {state === "loading" && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
        {state === "login" && (
          <>
            <p className="text-sm text-neutral-600">Log in with your own Instagram account first, then open this invite link again.</p>
            <Link href="/" className="inline-block rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white">Go to login</Link>
          </>
        )}
        {state === "done" && (
          <>
            <p className="text-sm text-neutral-600">{message}</p>
            <Link href="/dashboard/settings" className="inline-block rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white">Open Settings → Team</Link>
          </>
        )}
        {state === "error" && <p className="text-sm text-red-600">{message}</p>}
      </div>
    </main>
  )
}
