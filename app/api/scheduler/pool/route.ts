import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { getSessionUserId } from "@/lib/auth"

export async function GET(request: NextRequest) {
    try {
        const userId = getSessionUserId(request)
        if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

        const supabase = await getSupabaseServerClient()

        // Fetch items ordered by sequence
        const { data, error } = await supabase
            .from("content_pool")
            .select("*")
            .eq("user_id", userId)
            .eq("is_active", true)
            .order("sequence_index", { ascending: true })

        if (error) throw error

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
        const { video_url, caption, cover_url } = body

        if (!video_url) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

        const supabase = await getSupabaseServerClient()

        // Get current max sequence
        const { data: maxContent } = await supabase
            .from("content_pool")
            .select("sequence_index")
            .eq("user_id", userId)
            .order("sequence_index", { ascending: false })
            .limit(1)
            .single()

        const nextSeq = (maxContent?.sequence_index || 0) + 1

        const { data, error } = await supabase
            .from("content_pool")
            .insert({
                user_id: userId,
                video_url,
                caption,
                sequence_index: nextSeq,
                cover_url: cover_url || null
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json(data)
    } catch (err: any) {
        console.error("Pool Error:", err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const userId = getSessionUserId(request)
        if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

        const searchParams = request.nextUrl.searchParams
        const id = searchParams.get("id")
        if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

        const supabase = await getSupabaseServerClient()

        const { error } = await supabase
            .from("content_pool")
            .delete()
            .eq("id", id)
            .eq("user_id", userId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
