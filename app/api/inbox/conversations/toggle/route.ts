import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { getSessionUserId } from "@/lib/auth"

export async function GET(request: NextRequest) {
    try {
        const userId = getSessionUserId(request)
        if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

        const conversationId = request.nextUrl.searchParams.get("conversationId")
        if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 })

        const supabase = await getSupabaseServerClient()
        const { data: conv } = await supabase
            .from("conversations")
            .select("human_handled")
            .eq("id", conversationId)
            .eq("user_id", userId)
            .single()

        if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
        return NextResponse.json({ human_handled: !!conv.human_handled })
    } catch (error) {
        console.error("[Inbox] Toggle GET error:", error)
        return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = getSessionUserId(request)
        if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

        const { conversationId, human_handled } = await request.json()
        if (!conversationId || typeof human_handled !== "boolean") {
            return NextResponse.json({ error: "Missing conversationId or human_handled" }, { status: 400 })
        }

        const supabase = await getSupabaseServerClient()
        const { data, error } = await supabase
            .from("conversations")
            .update({ human_handled })
            .eq("id", conversationId)
            .eq("user_id", userId)
            .select()
            .single()

        if (error) throw error
        if (!data) return NextResponse.json({ error: "Conversation not found" }, { status: 404 })

        return NextResponse.json({ human_handled: !!data.human_handled })
    } catch (error) {
        console.error("[Inbox] Toggle POST error:", error)
        return NextResponse.json({ error: "Failed to update status" }, { status: 500 })
    }
}
