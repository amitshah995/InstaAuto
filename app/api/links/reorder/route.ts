import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { rawQuery } from "@/lib/supabase-server"
import { getSessionUserId } from "@/lib/auth"
import { hasPositionColumn } from "@/lib/shop/schema"

const Body = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) })

// POST /api/links/reorder { ids } : saves the owner's manual order (first id = top of the page).
// The WHERE user_id guard means ids that belong to someone else are silently ignored, never reordered.
export async function POST(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 })
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  try {
    if (!(await hasPositionColumn())) return NextResponse.json({ error: "Reordering is not set up yet (run migration 29)." }, { status: 503 })
    // One statement: position = index in the submitted array.
    await rawQuery(
      `UPDATE links l SET position = o.ord - 1
         FROM unnest($2::uuid[]) WITH ORDINALITY AS o(id, ord)
        WHERE l.id = o.id AND l.user_id = $1`,
      [userId, parsed.data.ids],
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[links] reorder error:", e)
    return NextResponse.json({ error: "Could not save the order" }, { status: 500 })
  }
}
