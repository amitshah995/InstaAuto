import { type NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { toolBySlug } from "@/lib/tools/registry"

// POST /api/tools/lead  (public, no login)
// A visitor of a free tool leaves contact details. Stored in `leads` with interest "tools";
// which tool and what they calculated goes in `notes`, so follow-up can be specific.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 8
const hits = new Map<string, number[]>() // best-effort per server instance

function tooMany(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k)
  return recent.length > MAX_PER_WINDOW
}

export async function POST(request: NextRequest) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown"
  if (tooMany(ip)) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  // Honeypot: bots fill hidden fields. Pretend success and store nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") return NextResponse.json({ success: true })

  const tool = typeof body.tool === "string" ? body.tool : ""
  if (tool !== "hub" && !toolBySlug(tool)) return NextResponse.json({ error: "Unknown tool." }, { status: 400 })

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const phoneDigits = typeof body.phone === "string" ? body.phone.replace(/[^\d]/g, "") : ""
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : null
  const context = typeof body.context === "string" ? body.context.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 300) : ""

  if (!email && !phoneDigits) return NextResponse.json({ error: "Add an email or a WhatsApp number." }, { status: 400 })
  if (email && (email.length > 254 || !EMAIL_RE.test(email))) return NextResponse.json({ error: "That email does not look right." }, { status: 400 })
  if (phoneDigits && (phoneDigits.length < 8 || phoneDigits.length > 15)) return NextResponse.json({ error: "That phone number does not look right." }, { status: 400 })
  if (body.consent !== true) return NextResponse.json({ error: "Please tick the box so we can contact you." }, { status: 400 })

  const prefix = `tool:${tool}`
  const notes = context ? `${prefix} | ${context}` : prefix

  try {
    const db = await getSupabaseServerClient()

    // Same person submitting the same tool again within a day: say thanks, do not store a duplicate.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const q = db.from("leads").select("id, notes").gte("created_at", since)
    const { data: recent } = await (email ? q.eq("email", email) : q.eq("phone", phoneDigits)).limit(20)
    if (Array.isArray(recent) && recent.some((r: any) => typeof r.notes === "string" && (r.notes === prefix || r.notes.startsWith(prefix + " ")))) {
      return NextResponse.json({ success: true })
    }

    const userId = getSessionUserId(request) // linked when the visitor happens to be signed in
    const { error } = await db.from("leads").insert({
      user_id: userId || null,
      name,
      email: email || null,
      phone: phoneDigits || null,
      interest: "tools",
      notes,
      consent: true,
    })
    if (error) {
      console.error("[tools-lead] insert failed:", error.message)
      return NextResponse.json({ error: "Could not save your details. Please try again." }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error("[tools-lead] error:", e?.message)
    return NextResponse.json({ error: "Could not save your details. Please try again." }, { status: 500 })
  }
}
