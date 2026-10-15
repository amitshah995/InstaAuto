"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
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
      <button type="button" className="au-btn" onClick={run} disabled={loading}>
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Instagram size={18} />}
        {loading ? "Reading your account..." : "Connect Instagram & get my audit"}
      </button>
      {error && (
        <p role="alert" className="au-err" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
    </div>
  )
}
