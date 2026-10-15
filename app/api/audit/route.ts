import { type NextRequest, NextResponse } from "next/server"
import { LookupError, normalizeUsername } from "@/lib/audit/lookup"
import { createPublicAudit, hashIp, ThrottleError } from "@/lib/audit/service"

// Public, unauthenticated. POST /api/audit { "username": "@handle" } -> { id, teaser }
// Only the teaser is ever returned here; the full report is gated behind sign-in (GET /api/audit/[id]).
export const maxDuration = 30

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"
}

export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const username = normalizeUsername(body?.username)
  if (!username) {
    return NextResponse.json(
      { error: "Enter a valid Instagram username (letters, numbers, dots and underscores)." },
      { status: 400 }
    )
  }

  try {
    const { id, teaser } = await createPublicAudit(username, hashIp(clientIp(request)))
    return NextResponse.json({ id, teaser })
  } catch (e: any) {
    if (e instanceof ThrottleError) {
      return NextResponse.json({ error: e.message }, { status: 429 })
    }
    if (e instanceof LookupError) {
      const status = { invalid_username: 400, not_found_or_not_professional: 404, rate_limited: 429, provider_unavailable: 503 }[e.code]
      const message =
        e.code === "not_found_or_not_professional"
          ? "We could not find that account. Audits work for public Business and Creator accounts. Switching to a Professional account is free in Instagram settings."
          : e.code === "provider_unavailable"
            ? "The audit service is temporarily unavailable. Please try again later."
            : e.message
      if (e.code === "provider_unavailable") console.error("[audit] provider unavailable:", e.message)
      return NextResponse.json({ error: message }, { status })
    }
    console.error("[audit] unexpected error:", e)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
