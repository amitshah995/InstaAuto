import { type NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { isUuid } from "@/lib/audit/service"

const INTERESTS = ["dm_automation", "smm_services", "tools", "other"] as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// POST /api/leads - signed-in user leaves contact details (Instagram Login gives no email).
export async function POST(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const phoneDigits = typeof body.phone === "string" ? body.phone.replace(/[^\d]/g, "") : ""
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : null
  const interest = INTERESTS.includes(body.interest) ? body.interest : "other"
  const consent = body.consent === true
  const auditId = typeof body.auditId === "string" && isUuid(body.auditId) ? body.auditId : null

  if (!email && !phoneDigits) {
    return NextResponse.json({ error: "Add an email or a phone number." }, { status: 400 })
  }
  if (email && (email.length > 254 || !EMAIL_RE.test(email))) {
    return NextResponse.json({ error: "That email does not look right." }, { status: 400 })
  }
  if (phoneDigits && (phoneDigits.length < 8 || phoneDigits.length > 15)) {
    return NextResponse.json({ error: "That phone number does not look right." }, { status: 400 })
  }
  if (!consent) {
    return NextResponse.json({ error: "Please agree to be contacted so we can follow up." }, { status: 400 })
  }

  const db = await getSupabaseServerClient()
  const now = new Date().toISOString()

  const { error } = await db.from("leads").insert({
    user_id: userId,
    audit_id: auditId,
    name,
    email: email || null,
    phone: phoneDigits || null,
    interest,
    consent: true,
  })
  if (error) {
    console.error("[leads] insert failed:", error.message)
    return NextResponse.json({ error: "Could not save your details. Please try again." }, { status: 500 })
  }

  await db.from("users").update({
    ...(email ? { email } : {}),
    ...(phoneDigits ? { phone: phoneDigits } : {}),
    marketing_consent: true,
    contact_captured_at: now,
  }).eq("id", userId)

  return NextResponse.json({ success: true })
}
