import { type NextRequest, NextResponse } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { getSessionUserId } from "@/lib/auth"
import { siteBase } from "@/lib/links/core"
import { normalizeHandle } from "@/lib/shop/core"
import { sendPostToWhatsApp, whatsappConfigured } from "@/lib/whatsapp-saas"

export async function GET() {
  return NextResponse.json({ configured: whatsappConfigured() })
}

// Sends one of the owner's posts through the WhatsApp SaaS slot. Returns 501 until that API is filled in.
export async function POST(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === "string" ? body.id : ""
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  const rows = await rawQuery<{ caption: string | null; username: string | null }>(
    `SELECT p.caption, u.username FROM shop_posts p JOIN users u ON u.id = p.user_id WHERE p.id = $1 AND p.user_id = $2`,
    [id, userId],
  )
  const row = rows[0]
  const h = normalizeHandle(row?.username ?? "")
  if (!row || !h.ok) return NextResponse.json({ error: "Post not found" }, { status: 404 })
  const out = await sendPostToWhatsApp({ userId, postUrl: `${siteBase()}/@${h.handle}/p/${id}`, caption: row.caption })
  if (out.ok) return NextResponse.json(out)
  return NextResponse.json({ error: out.error }, { status: out.notConfigured ? 501 : 502 })
}
