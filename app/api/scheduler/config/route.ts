import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { getSessionUserId } from "@/lib/auth"

export async function GET(request: NextRequest) {
    try {
        const userId = getSessionUserId(request)
        if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

        const supabase = await getSupabaseServerClient()

        const { data, error } = await supabase
            .from("scheduler_config")
            .select("*")
            .eq("user_id", userId)
            .single()

        // Returns null data if not found, which is fine
        return NextResponse.json(data)
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = getSessionUserId(request)
        if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

        const body = await request.json()
        const { is_running, interval_minutes, start_time, end_time } = body

        const supabase = await getSupabaseServerClient()

        const updates = {
            is_running,
            interval_minutes,
            start_time,
            end_time,
            updated_at: new Date().toISOString()
        }

        const { data, error } = await supabase
            .from("scheduler_config")
            .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' }) // upsert on PK
            .select()
            .single()

        if (error) throw error

        return NextResponse.json(data)
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
