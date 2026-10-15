import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { authorizeUser, isEnforced } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const auth = authorizeUser(request, request.nextUrl.searchParams.get("userId"))
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const userId = auth.userId

    const supabase = await getSupabaseServerClient()

    // STABLE FIX: Fetch rules by the Login ID (userId) directly.
    // We stop caring about the shifting Business ID here.
    const { data, error } = await supabase
      .from("automations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Automations GET error:", error)
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId: claimedUserId, name, trigger_source, trigger_type, trigger_value, content, specific_media_id } = await request.json()

    const auth = authorizeUser(request, claimedUserId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const userId = auth.userId

    if (!name || !trigger_value || !content || !trigger_source) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    // Validate trigger_source
    if (!['comment', 'dm', 'story', 'live'].includes(trigger_source)) {
      return NextResponse.json({ error: "Invalid trigger source" }, { status: 400 })
    }

    const supabase = await getSupabaseServerClient()

    // STABLE FIX: Always save to the Login ID
    const finalTriggerValue =
      trigger_type === "postback"
        ? `PAYLOAD_${Date.now()}_${Math.random().toString(36).substring(7)}`
        : trigger_value.toLowerCase()

    const { data, error } = await supabase
      .from("automations")
      .insert({
        user_id: userId,
        name,
        trigger_source,
        trigger_type: trigger_type || "keyword",
        trigger_value: finalTriggerValue,
        response_type: "pro",
        response_content: content,
        is_active: true,
        specific_media_id: specific_media_id || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Automations POST error:", error)
    return NextResponse.json({ error: "Failed to create" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
    const auth = authorizeUser(request, request.nextUrl.searchParams.get("userId"))
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const userId = auth.userId
    const supabase = await getSupabaseServerClient()
    const { error } = await supabase.from("automations").delete().eq("id", id).eq("user_id", userId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Automations DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, userId: claimedUserId, name, trigger_source, trigger_type, trigger_value, content, specific_media_id } = await request.json()

    if (!id || !name || !trigger_value || !content) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    // Ownership: this route used to update ANY automation by id. Scope to the caller.
    // Legacy clients (e.g. Android) send neither session nor userId here; allowed only
    // until AUTH_ENFORCE=1, with a warning.
    const auth = authorizeUser(request, claimedUserId ?? request.nextUrl.searchParams.get("userId"))
    if (!auth.ok && (isEnforced() || auth.status === 403)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const ownerId = auth.ok ? auth.userId : null
    if (!ownerId) console.warn("[auth] automations PUT without any user identity (legacy client)")

    // Validate trigger_source if provided
    if (trigger_source && !['comment', 'dm', 'story', 'live'].includes(trigger_source)) {
      return NextResponse.json({ error: "Invalid trigger source" }, { status: 400 })
    }

    const supabase = await getSupabaseServerClient()

    const updateData: any = {
      name,
      trigger_type: trigger_type || "keyword",
      trigger_value: trigger_value.toLowerCase(),
      response_content: content,
      specific_media_id: specific_media_id || null,
    }

    // Only update trigger_source if provided
    if (trigger_source) {
      updateData.trigger_source = trigger_source
    }

    let query = supabase.from("automations").update(updateData).eq("id", id)
    if (ownerId) query = query.eq("user_id", ownerId)
    const { data, error } = await query.select().single()

    if (error) throw error
    // No row matched: either the id does not exist or it belongs to someone else.
    if (!data) return NextResponse.json({ error: "Automation not found" }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Automations PUT error:", error)
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }
}
