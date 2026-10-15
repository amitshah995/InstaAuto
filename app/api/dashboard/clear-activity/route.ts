import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { authorizeUser } from "@/lib/auth"

export async function POST(request: NextRequest) {
    try {
        const auth = authorizeUser(request, request.nextUrl.searchParams.get("userId"))
        if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
        const userId = auth.userId

        const supabase = await getSupabaseServerClient()

        // Delete recent activity message logs for this user
        const { error } = await supabase
            .from("messages")
            .delete()
            .eq("user_id", userId)

        if (error) {
            console.error("Supabase clear activity error:", error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Clear activity error:", error)
        return NextResponse.json({ error: "Failed to clear activity" }, { status: 500 })
    }
}
