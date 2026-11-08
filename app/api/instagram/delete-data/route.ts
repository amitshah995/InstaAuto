import { type NextRequest, NextResponse } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import crypto from "crypto"

/**
 * Meta Data Deletion Request Callback
 * 
 * When a user removes your app from Instagram Settings → "Apps and Websites",
 * Meta sends a POST request to this endpoint with a signed_request.
 * 
 * We must:
 * 1. Parse and verify the signed_request
 * 2. Delete the user's data from our database
 * 3. Return a JSON response with a status URL and confirmation code
 * 
 * Meta docs: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */

function parseSignedRequest(signedRequest: string, appSecret: string): any | null {
  try {
    const [encodedSig, payload] = signedRequest.split(".")
    if (!encodedSig || !payload) return null

    // Decode signature
    const sig = Buffer.from(encodedSig.replace(/-/g, "+").replace(/_/g, "/"), "base64")

    // Decode payload
    const data = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
    )

    // Verify signature
    const expectedSig = crypto
      .createHmac("sha256", appSecret)
      .update(payload)
      .digest()

    if (!crypto.timingSafeEqual(sig, expectedSig)) {
      console.error("[DMSpark] ❌ Data deletion: Invalid signature")
      return null
    }

    return data
  } catch (e) {
    console.error("[DMSpark] ❌ Data deletion: Failed to parse signed_request", e)
    return null
  }
}

export async function GET(request: NextRequest) {
  // If visited via browser (GET), redirect to the user-facing deletion instructions page
  const redirectUrl = new URL("/delete-data", request.url)
  return NextResponse.redirect(redirectUrl)
}

export async function POST(request: NextRequest) {
  try {
    const appSecret = process.env.INSTAGRAM_APP_SECRET
    if (!appSecret) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const body = await request.text()
    const params = new URLSearchParams(body)
    const signedRequest = params.get("signed_request")

    if (!signedRequest) {
      return NextResponse.json({ error: "Missing signed_request" }, { status: 400 })
    }

    const data = parseSignedRequest(signedRequest, appSecret)
    if (!data) {
      return NextResponse.json({ error: "Invalid signed_request" }, { status: 403 })
    }

    const userId = data.user_id?.toString()
    if (!userId) {
      return NextResponse.json({ error: "No user_id in signed_request" }, { status: 400 })
    }

    console.log(`[DMSpark] 🗑️ Data deletion request for user: ${userId}`)

    // Raw SQL so we can check every result. Each statement runs on its own, so a table that
    // doesn't exist yet (a migration not run) is skipped instead of aborting the whole deletion.
    // Order matters: child rows first, then the users row last.
    const uid = Number(userId)
    const steps: { label: string; sql: string }[] = [
      { label: "messages", sql: "DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = $1)" },
      { label: "conversations", sql: "DELETE FROM conversations WHERE user_id = $1" },
      { label: "link_clicks", sql: "DELETE FROM link_clicks WHERE link_id IN (SELECT id FROM links WHERE user_id = $1)" },
      { label: "link_reports", sql: "DELETE FROM link_reports WHERE link_id IN (SELECT id FROM links WHERE user_id = $1)" },
      { label: "links", sql: "DELETE FROM links WHERE user_id = $1" },
      { label: "contacts", sql: "DELETE FROM contacts WHERE user_id = $1" },
      { label: "scheduled_messages", sql: "DELETE FROM scheduled_messages WHERE user_id = $1" },
      { label: "automation_runs", sql: "DELETE FROM automation_runs WHERE user_id = $1" },
      { label: "automation_versions", sql: "DELETE FROM automation_versions WHERE user_id = $1" },
      { label: "automations", sql: "DELETE FROM automations WHERE user_id = $1" },
      { label: "ice_breakers", sql: "DELETE FROM ice_breakers WHERE user_id = $1" },
      { label: "media_cache", sql: "DELETE FROM media_cache WHERE user_id = $1" },
      { label: "content_pool", sql: "DELETE FROM content_pool WHERE user_id = $1" },
      { label: "scheduler_config", sql: "DELETE FROM scheduler_config WHERE user_id = $1" },
      { label: "reels_posts", sql: "DELETE FROM reels_posts WHERE user_id = $1" },
      { label: "webhook_events", sql: "DELETE FROM webhook_events WHERE user_id = $1" },
      { label: "shop_videos", sql: "DELETE FROM shop_videos WHERE user_id = $1" },
      { label: "shop_posts", sql: "DELETE FROM shop_posts WHERE user_id = $1" },
      { label: "shop_profiles", sql: "DELETE FROM shop_profiles WHERE user_id = $1" },
      // leads/audits only SET NULL on user delete, so their email/phone would survive. Remove them explicitly.
      { label: "leads", sql: "DELETE FROM leads WHERE user_id = $1" },
      { label: "audits", sql: "DELETE FROM audits WHERE user_id = $1" },
      { label: "follower_snapshots", sql: "DELETE FROM follower_snapshots WHERE user_id = $1" },
      { label: "report_shares", sql: "DELETE FROM report_shares WHERE user_id = $1" },
      { label: "team_members", sql: "DELETE FROM team_members WHERE owner_id = $1 OR member_id = $1" },
      { label: "team_invites", sql: "DELETE FROM team_invites WHERE owner_id = $1" },
    ]
    for (const step of steps) {
      try {
        await rawQuery(step.sql, [uid])
      } catch (e: any) {
        // 42P01 = table missing, 42703 = column missing: nothing to delete there, safe to skip.
        if (e?.code === "42P01" || e?.code === "42703") continue
        console.error(`[DMSpark] delete step failed: ${step.label}`, e?.message)
        // Return 500 so Meta retries the callback instead of believing the data is gone.
        return NextResponse.json({ error: "Deletion incomplete" }, { status: 500 })
      }
    }
    // Last: the account row itself (this also removes the stored access token).
    await rawQuery("DELETE FROM users WHERE id = $1", [uid])

    console.log(`[DMSpark] ✅ All data deleted for user: ${userId}`)

    // Generate confirmation code
    const confirmationCode = crypto.randomUUID()

    // Meta expects this exact response format
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dmspark.in"
    return NextResponse.json({
      url: `${baseUrl}/delete-data?confirmation=${confirmationCode}`,
      confirmation_code: confirmationCode,
    })
  } catch (error: any) {
    console.error("[DMSpark] ❌ Data deletion error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
