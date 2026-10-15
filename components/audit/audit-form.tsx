"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Instagram, Loader2 } from "lucide-react"
import { instagramAuthUrl, PENDING_AUDIT_FLAG } from "@/lib/audit/oauth-url"

/**
 * One button. If the visitor is signed in, run the audit on their own account; if the server says
 * login is needed, send them through Instagram login and come back here (?run=1) to finish.
 */
export function AuditForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const run = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/audit", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.id) {
        router.push(`/audit/${data.id}`)
        return
      }
      if (res.status === 401) {
        try { localStorage.setItem(PENDING_AUDIT_FLAG, "1") } catch {}
        window.location.href = instagramAuthUrl
        return
      }
      setError(data.error || "Something went wrong. Please try again.")
    } catch {
      setError("Network error. Please try again.")
    }
    setLoading(false)
  }, [router])

  // Returning from Instagram login: finish the audit automatically (once).
  useEffect(() => {
    if (started.current) return
    if (new URLSearchParams(window.location.search).get("run") === "1") {
      started.current = true
      window.history.replaceState(null, "", "/instagram-audit")
      void run()
    }
  }, [run])

  return (
    <div className="w-full max-w-xl mx-auto text-center">
      <Button size="lg" onClick={run} disabled={loading} className="h-12 px-8 text-base">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Instagram className="h-4 w-4" />}
        {loading ? "Reading your account..." : "Connect Instagram & get my audit"}
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
