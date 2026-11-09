"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AtSign, Loader2, Play, FileText } from "lucide-react"
import { instagramAuthUrl, PENDING_AUDIT_FLAG } from "@/lib/audit/oauth-url"

type SessionInfo =
  | { signedIn: false; reason: "no_session" | "session_upgrade" | "no_account" }
  | { signedIn: true; username: string | null; needsReconnect: boolean; latest: { id: string; score: number; createdAt: string } | null }

/** Human reason shown above the Connect button, so a reconnect never looks arbitrary. */
const WHY: Record<string, string> = {
  no_session: "Connect the Instagram account you want to audit. You only do this once.",
  session_upgrade: "We updated how sign-in works, so your older session needs one quick reconnect.",
  no_account: "We could not find your account. Connect Instagram again to continue.",
  expired: "Your Instagram connection expired or was revoked, so we cannot read your account. Reconnect to continue.",
}

function connect() {
  // After Instagram login the session hook sends them back here with ?run=1 to finish the audit.
  try { localStorage.setItem(PENDING_AUDIT_FLAG, "1") } catch {}
  window.location.href = instagramAuthUrl
}

/**
 * Audit entry. The server (cookie) decides who is signed in:
 *  - unknown yet: skeleton (never the Connect button, which would flash for signed-in users)
 *  - signed in: "Run my audit" on their own account, plus their latest audit if one exists. No OAuth.
 *  - not signed in, or Instagram access gone: Connect, with the reason spelled out.
 */
export function AuditForm() {
  const router = useRouter()
  const [info, setInfo] = useState<SessionInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    let alive = true
    fetch("/api/audit/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setInfo(d))
      // If the check itself fails, fall back to the signed-out view; the run call still decides for real.
      .catch(() => alive && setInfo({ signedIn: false, reason: "no_session" }))
    return () => { alive = false }
  }, [])

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
        // Do not bounce straight to Instagram: explain, then let them choose.
        setExpired(true)
        setInfo((cur) => (cur && cur.signedIn ? { signedIn: false, reason: "no_session" } : cur))
        setError(data.error || WHY.expired)
      } else {
        setError(data.error || "Something went wrong. Please try again.")
      }
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

  if (!info) {
    return (
      <div className="w-full max-w-xl mx-auto" role="status" aria-live="polite" aria-label="Checking your sign-in">
        <div className="au-card animate-pulse" style={{ height: 76 }} />
        <span className="sr-only">Checking your sign-in...</span>
      </div>
    )
  }

  const signedIn = info.signedIn && !info.needsReconnect && !expired
  const reason = expired ? WHY.expired : info.signedIn ? (info.needsReconnect ? WHY.expired : "") : WHY[info.reason]

  return (
    <div className="w-full max-w-xl mx-auto text-center" style={{ display: "grid", gap: 14 }}>
      {signedIn && info.signedIn ? (
        <>
          {info.username && <p className="au-muted" style={{ fontSize: 14 }}>Signed in as <b className="au-head">@{info.username}</b></p>}
          <button type="button" className="au-btn" onClick={run} disabled={loading}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            {loading ? "Reading your account..." : info.latest ? "Run a fresh audit" : "Run my audit"}
          </button>
          {info.latest && (
            <Link href={`/audit/${info.latest.id}`} className="au-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, textAlign: "left", textDecoration: "none", color: "inherit" }}>
              <span className="au-icon"><FileText size={16} /></span>
              <span style={{ flex: 1 }}>
                <b className="au-head" style={{ fontSize: 15 }}>Latest audit: {info.latest.score}/100</b>
                <span className="au-muted" style={{ display: "block", fontSize: 13 }}>{new Date(info.latest.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} · view the report</span>
              </span>
            </Link>
          )}
        </>
      ) : (
        <>
          {reason && <p className="au-muted" style={{ fontSize: 14 }}>{reason}</p>}
          <button type="button" className="au-btn" onClick={connect} disabled={loading}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <AtSign size={18} />}
            {loading ? "Reading your account..." : "Connect Instagram & get my audit"}
          </button>
        </>
      )}
      <div aria-live="polite">
        {error && <p role="alert" className="au-err" style={{ marginTop: 4 }}>{error}</p>}
      </div>
    </div>
  )
}
