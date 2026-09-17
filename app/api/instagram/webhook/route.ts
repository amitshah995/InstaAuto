import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import crypto from "crypto"

const WEBHOOK_VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || "your_verify_token"

// Escapes regex special characters so a keyword like "10% off" or "a+b"
// can't crash new RegExp() or match unintended patterns.
function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Returns true if this exact event_id was already processed (Meta redelivered it).
// Inserts a row on first sight; a duplicate insert (unique violation) means "already seen".
async function isDuplicateEvent(supabase: any, eventId: string, eventType: string): Promise<boolean> {
  const { error } = await supabase.from("processed_events").insert({ event_id: eventId, event_type: eventType })
  if (error) {
    // 23505 = Postgres unique_violation. Anything else is a real DB error, not a duplicate —
    // fail open (treat as not-duplicate) so a transient DB hiccup doesn't silently eat events.
    if (error.code === "23505") return true
    console.error("[v0] ⚠️ processed_events insert error (treating as not-duplicate):", error.message)
    return false
  }
  return false
}

// Logs one automation decision to automation_runs. Never throws — logging must not
// block the actual automation from running.
async function logRun(
  supabase: any,
  params: {
    userId: number
    automationId?: string | null
    eventType: "comment" | "dm" | "story" | "postback"
    triggerText?: string | null
    matched: boolean
    actionStatus?: "sent" | "failed" | "skipped" | null
    errorMessage?: string | null
  },
) {
  try {
    await supabase.from("automation_runs").insert({
      user_id: params.userId,
      automation_id: params.automationId || null,
      event_type: params.eventType,
      trigger_text: params.triggerText || null,
      matched: params.matched,
      action_status: params.actionStatus || null,
      error_message: params.errorMessage || null,
    })
  } catch (e) {
    console.error("[v0] ⚠️ Failed to write automation_runs log:", e)
  }
}

// Sends a response as one or more sequential DM steps, each with its own delay.
// Falls back to the legacy single message/card shape when content.steps isn't
// present, so every existing automation keeps working unmodified.
// firstRecipient is { comment_id } for a comment's private reply, or { id: psid }
// for a normal DM/story reply. Every step after the first always targets psid,
// since only the very first private-reply message can be addressed by comment_id.
async function sendSteps(
  accessToken: string,
  firstRecipient: any,
  psid: string,
  content: any,
): Promise<{ ok: boolean; results: { text: string; ok: boolean; messageId?: string; error?: string }[] }> {
  const steps: any[] =
    Array.isArray(content.steps) && content.steps.length > 0
      ? content.steps
      : [{ text: content.message, card: content.card, delay_seconds: content.delay_seconds }]

  const results: { text: string; ok: boolean; messageId?: string; error?: string }[] = []
  let allOk = true

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const delay = step.delay_seconds || 0
    if (delay > 0) {
      console.log(`[v0] ⏳ Delaying step ${i + 1}/${steps.length} by ${delay}s...`)
      await new Promise((resolve) => setTimeout(resolve, delay * 1000))
    }

    const apiBody: any = { recipient: i === 0 ? firstRecipient : { id: psid } }
    let textLog = ""

    if (step.card) {
      const card = step.card
      const apiButtons = card.buttons.map((b: any) => ({
        type: b.type,
        title: b.title,
        url: b.url || undefined,
        payload: b.payload || undefined,
      }))
      const element: any = { title: card.title, buttons: apiButtons }
      if (card.subtitle) element.subtitle = card.subtitle
      if (card.image_url && card.image_url.startsWith("http")) element.image_url = card.image_url
      apiBody.message = { attachment: { type: "template", payload: { template_type: "generic", elements: [element] } } }
      textLog = `[Card] ${card.title}`
    } else {
      apiBody.message = { text: step.text || "" }
      textLog = step.text || ""
    }

    try {
      const res = await fetch(
        `https://graph.instagram.com/v24.0/me/messages?access_token=${encodeURIComponent(accessToken)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(apiBody) },
      )
      const json = await res.json()
      if (json.error) {
        console.error(`[v0] 🔴 Step ${i + 1}/${steps.length} send failed:`, JSON.stringify(json.error))
        results.push({ text: textLog, ok: false, error: JSON.stringify(json.error) })
        allOk = false
        break // stop the sequence on first failure — don't send later steps out of order
      }
      results.push({ text: textLog, ok: true, messageId: json.message_id })
    } catch (e) {
      console.error(`[v0] 🔴 Step ${i + 1}/${steps.length} network error:`, e)
      results.push({ text: textLog, ok: false, error: String(e) })
      allOk = false
      break
    }
  }

  return { ok: allOk, results }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: "Invalid token" }, { status: 403 })
}

export async function POST(request: NextRequest) {
  try {
    // Verify Meta webhook signature
    const signature = request.headers.get("x-hub-signature-256")
    const appSecret = process.env.INSTAGRAM_APP_SECRET
    const rawBody = await request.text()

    if (appSecret) {
      // App secret is configured (production-ready) — signature is REQUIRED, not optional.
      if (!signature) {
        console.error("[v0] ❌ Missing webhook signature (INSTAGRAM_APP_SECRET is set)")
        return NextResponse.json({ error: "Missing signature" }, { status: 403 })
      }
      const expectedSig = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")
      if (signature !== expectedSig) {
        console.error("[v0] ❌ Invalid webhook signature")
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
      }
    } else {
      // No app secret set yet (e.g. Meta app not configured yet) — allow through for local/dev testing,
      // but make it loud so this never goes unnoticed in production logs.
      console.warn("[v0] ⚠️ INSTAGRAM_APP_SECRET not set — webhook signature NOT verified")
    }

    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch (e) {
      console.error("[v0] ❌ Malformed JSON in webhook body")
      return NextResponse.json({ error: "Malformed JSON" }, { status: 400 })
    }

    if (!body.entry) return NextResponse.json({ ok: true })
    const supabase = await getSupabaseServerClient()

    // Log webhook event for debugging
    try {
      await supabase.from("webhook_events").insert({
        event_type: body.object || "unknown",
        data: body,
      })
    } catch (logErr) {
      // Non-critical: don't block webhook processing if logging fails
    }

    for (const entry of body.entry) {
      // ============================================================
      // 🔇 ECHO SILENCER (The Fix for "ID Not Found" logs)
      // ============================================================
      if (entry.messaging) {
        const isSystemEvent = entry.messaging.every(
          (event: any) => event.read || event.delivery || (event.message && event.message.is_echo),
        )
        if (isSystemEvent) {
          continue
        }
      }
      // ============================================================

      const webhookId = entry.id

      // 1. DUAL ID LOOKUP
      let { data: user } = await supabase
        .from("users")
        .select("*")
        .or(`business_account_id.eq.${webhookId},page_id.eq.${webhookId}`)
        .single()

      // ============================================================
      // 🔍 FALLBACK 1: Extract actual IG ID from payload
      // ============================================================
      if (!user) {
        console.log(`[v0] ⚠️ ID ${webhookId} not found in DB. Trying payload fallback...`)

        const candidateIds = new Set<string>()

        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.value?.media?.owner?.id) candidateIds.add(String(change.value.media.owner.id))
          }
        }
        if (entry.messaging) {
          for (const event of entry.messaging) {
            if (event.recipient?.id) candidateIds.add(String(event.recipient.id))
          }
        }

        for (const candidateId of candidateIds) {
          if (candidateId === webhookId) continue
          const { data: fallbackUser } = await supabase
            .from("users")
            .select("*")
            .or(`business_account_id.eq.${candidateId},page_id.eq.${candidateId}`)
            .single()

          if (fallbackUser) {
            console.log(`[v0] ✅ Payload fallback matched! ${candidateId} → ${fallbackUser.username}`)
            await supabase.from("users").update({ page_id: webhookId }).eq("id", fallbackUser.id)
            user = fallbackUser
            break
          }
        }
      }

      // ============================================================
      // 🔍 FALLBACK 2: Token verification (tests ALL users)
      // ============================================================
      if (!user) {
        console.log(`[v0] 🔎 Trying token verification for ${webhookId}...`)
        const { data: allUsers } = await supabase.from("users").select("*")

        if (allUsers) {
          for (const candidate of allUsers) {
            if (!candidate.access_token) continue
            try {
              const testRes = await fetch(
                `https://graph.instagram.com/v24.0/${webhookId}?fields=id&access_token=${candidate.access_token}`
              )
              if (testRes.ok) {
                console.log(`[v0] ✅ Token verified! ${webhookId} belongs to ${candidate.username}. Saving permanently.`)
                await supabase
                  .from("users")
                  .update({ page_id: webhookId })
                  .eq("id", candidate.id)
                user = candidate
                break
              }
            } catch (e) {
              // Network error, skip this user
            }
          }
        }
      }
      // ============================================================

      if (!user) {
        console.log(`[v0] ❌ Could not resolve User for ID ${webhookId}`)
        continue
      }

      // Skip if user's token has been revoked (deauthorized)
      if (user.access_token === "REVOKED") {
        console.log(`[v0] 🔌 Skipping revoked user: ${user.username}`)
        continue
      }

      const { data: automations } = await supabase
        .from("automations")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)

      if (!automations?.length) continue

      // ============================================================
      //  PART A: COMMENTS
      // ============================================================
      if (entry.changes) {
        for (const change of entry.changes) {
          if (change.field === "comments" && change.value?.text) {
            const commentId = change.value.id

            // --- Idempotency guard: skip if this exact comment was already processed ---
            if (await isDuplicateEvent(supabase, `comment_${commentId}`, "comment")) {
              console.log(`[v0] 🔁 Duplicate comment event skipped: ${commentId}`)
              continue
            }

            const commentText = change.value.text.toLowerCase().trim()
            const senderId = change.value.from.id
            const mediaId = change.value.media.id

            // Safety check for self-reply
            if (senderId === webhookId || senderId === user.business_account_id || senderId === user.page_id) continue

            // ============================================================
            // 🧠 SMART MATCHING LOGIC
            // ============================================================
            const commentAutomations = automations.filter((a: any) => a.trigger_source === 'comment')

            // Priority 1: Reply-All (Specific post, ALL comments)
            let match = commentAutomations.find(
              (a: any) => a.specific_media_id === mediaId && a.trigger_type === "reply_all",
            )

            // Priority 2: Specific Post + Keyword Match
            if (!match) {
              match = commentAutomations.find(
                (a: any) =>
                  a.specific_media_id === mediaId &&
                  a.trigger_type === "keyword" &&
                  a.trigger_value
                    .split(",")
                    .some((k: string) => new RegExp(`\\b${escapeRegex(k.trim())}\\b`, "i").test(commentText)),
              )
            }

            // Priority 3: Global Keyword Match (Only if no specific match found)
            if (!match) {
              match = automations.find(
                (a: any) =>
                  !a.specific_media_id &&
                  a.trigger_type === "keyword" &&
                  a.trigger_value
                    .split(",")
                    .some((k: string) => new RegExp(`\\b${escapeRegex(k.trim())}\\b`, "i").test(commentText)),
              )
            }

            if (!match) {
              // Only log a "no match" row when there WERE comment automations to consider —
              // otherwise every comment on every account with zero automations spams the log.
              if (commentAutomations.length > 0) {
                await logRun(supabase, {
                  userId: user.id,
                  eventType: "comment",
                  triggerText: commentText,
                  matched: false,
                })
              }
              continue
            }

            console.log(`[v0] ✅ Comment Match: "${match.name}" (ID: ${match.id})`)
            const content = match.response_content
            const replies = ["Check your DMs! 📥", "Sent! 🔥", "Check inbox! ✨"]
            const randomReply = replies[Math.floor(Math.random() * replies.length)]

            let publicReplyOk = true

            // Public Reply
            try {
              const pubRes = await fetch(
                `https://graph.instagram.com/v24.0/${commentId}/replies?access_token=${encodeURIComponent(user.access_token)}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ message: randomReply }),
                },
              )
              const pubJson = await pubRes.json()
              if (pubJson.error) {
                console.error("[v0] 🔴 Public Reply Failed:", JSON.stringify(pubJson.error))
                publicReplyOk = false
              } else {
                console.log("[v0] 🟢 Public Reply Sent!", pubJson)
              }
            } catch (e) {
              console.error("[v0] 🔴 Public Reply Network Error:", e)
              publicReplyOk = false
            }

            // Private Reply (DM) — one or more sequential steps
            const { ok: dmOk, results: dmResults } = await sendSteps(
              user.access_token,
              { comment_id: commentId },
              senderId,
              content,
            )

            if (!dmOk) {
              const lastError = dmResults[dmResults.length - 1]?.error
              console.error("[v0] 🔴 Private DM Failed:", lastError)
              await logRun(supabase, {
                userId: user.id,
                automationId: match.id,
                eventType: "comment",
                triggerText: commentText,
                matched: true,
                actionStatus: "failed",
                errorMessage: lastError,
              })
            } else {
              console.log(`[v0] 🟢 Private DM Sent! (${dmResults.length} step${dmResults.length > 1 ? "s" : ""})`)
              await logRun(supabase, {
                userId: user.id,
                automationId: match.id,
                eventType: "comment",
                triggerText: commentText,
                matched: true,
                actionStatus: publicReplyOk ? "sent" : "sent",
                errorMessage: publicReplyOk ? null : "Public reply failed, private DM sent",
              })

              // Save comment trigger and DM reply steps to DB
              try {
                let { data: conv } = await supabase
                  .from("conversations")
                  .select("id")
                  .eq("user_id", user.id)
                  .eq("recipient_id", senderId)
                  .single()

                if (!conv) {
                  let realUsername = `cnt_${senderId.slice(0, 5)}...`
                  try {
                    const profileUrl = `https://graph.instagram.com/v24.0/${senderId}?fields=username&access_token=${user.access_token}`
                    const profileRes = await fetch(profileUrl)
                    const profileData = await profileRes.json()
                    if (profileData.username) {
                      realUsername = profileData.username
                    }
                  } catch (e) {
                    console.error("[v0] Failed to fetch username in comment DM log", e)
                  }

                  const { data: newConv } = await supabase
                    .from("conversations")
                    .insert({
                      user_id: user.id,
                      recipient_id: senderId,
                      recipient_username: realUsername,
                      last_message_at: new Date().toISOString(),
                    })
                    .select("id")
                    .single()
                  conv = newConv
                } else {
                  await supabase
                    .from("conversations")
                    .update({ last_message_at: new Date().toISOString() })
                    .eq("id", conv.id)
                }

                if (conv) {
                  await supabase.from("messages").insert({
                    id: `mid_cmt_trig_${Date.now()}_${Math.random()}`,
                    conversation_id: conv.id,
                    user_id: user.id,
                    sender_id: senderId,
                    sender_username: "User",
                    content: `💬 Commented: "${change.value.text}"`,
                    is_from_instagram: true,
                  })

                  for (const step of dmResults) {
                    await supabase.from("messages").insert({
                      id: step.messageId || `mid_cmt_reply_${Date.now()}_${Math.random()}`,
                      conversation_id: conv.id,
                      user_id: user.id,
                      sender_id: user.business_account_id,
                      sender_username: user.username,
                      content: step.text || "[Sent rich card]",
                      is_from_instagram: false,
                    })
                  }
                }
              } catch (dbErr) {
                console.error("[v0] Failed to log comment automation to DB:", dbErr)
              }
            }
          }
        }
      }

      // ============================================================
      //  PART A.5: STORY AUTOMATION HANDLING
      // ============================================================
      if (entry.messaging) {
        for (const event of entry.messaging) {
          const senderId = event.sender.id
          const recipientId = event.recipient.id

          if (event.read || event.delivery || event.message?.is_echo || senderId === recipientId) continue

          const storyAutomations = automations.filter((a: any) => a.trigger_source === 'story')
          if (storyAutomations.length === 0) continue

          // --- Idempotency guard ---
          const storyEventId =
            event.message?.mid || `story_${senderId}_${event.reaction?.mid || event.timestamp || ""}`
          if (await isDuplicateEvent(supabase, `story_${storyEventId}`, "story")) {
            console.log(`[v0] 🔁 Duplicate story event skipped: ${storyEventId}`)
            continue
          }

          let match = null
          let storyMediaId: string | null = null

          // 1️⃣ Story Mention Handler
          if (event.message?.attachments?.[0]?.type === 'story_mention') {
            const attachment = event.message.attachments[0]
            storyMediaId = attachment.payload?.url || null

            match = storyAutomations.find((a: any) =>
              a.trigger_type === 'mention' &&
              (!a.specific_media_id || a.specific_media_id === storyMediaId)
            )
          }

          // 2️⃣ Story Reaction Handler
          else if (event.reaction) {
            const reactionEmoji = event.reaction.emoji
            storyMediaId = event.reaction.mid || null

            match = storyAutomations.find((a: any) => {
              if (a.trigger_type !== 'reaction') return false
              if (a.specific_media_id && a.specific_media_id !== storyMediaId) return false

              const triggers = a.trigger_value?.split(',').map((t: string) => t.trim()) || []
              if (triggers.length > 0 && triggers[0] !== 'ALL' && triggers[0] !== '') {
                return triggers.includes(reactionEmoji)
              }
              return true
            })
          }

          // 3️⃣ Story Reply Handler
          else if (event.message?.reply_to?.story) {
            const messageText = event.message.text || ''
            storyMediaId = event.message.reply_to.story.id || null

            match = storyAutomations.find((a: any) => {
              if (a.trigger_type !== 'reply') return false
              if (a.specific_media_id && a.specific_media_id !== storyMediaId) return false

              const triggers = a.trigger_value?.split(',').map((t: string) => t.trim()) || []
              if (triggers.length > 0 && triggers[0] !== 'ALL' && triggers[0] !== 'ALL_MENTIONS' && triggers[0] !== '') {
                return triggers.some((keyword: string) =>
                  new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i').test(messageText)
                )
              }
              return true
            })
          }

          if (match) {
            console.log(`✨ Story automation matched: ${match.name}`)

            try {
              const content = match.response_content
              const { ok: storyOk, results: storyResults } = await sendSteps(
                user.access_token,
                { id: senderId },
                senderId,
                content,
              )

              if (storyOk) {
                console.log(`✅ Story automation sent: ${match.name} (${storyResults.length} step${storyResults.length > 1 ? "s" : ""})`)
              } else {
                console.error(`❌ Story automation send failed: ${match.name}`, storyResults[storyResults.length - 1]?.error)
              }
            } catch (err) {
              console.error('❌ Story automation error:', err)
            }
          }
        }
      }

      // ============================================================
      //  PART B: MESSAGES (DMs)
      // ============================================================
      if (entry.messaging) {
        for (const event of entry.messaging) {
          if (event.read || event.delivery || event.reaction || event.message?.is_echo) continue

          const senderId = event.sender.id
          if (senderId === webhookId || senderId === user.business_account_id || senderId === user.page_id) continue

          let triggerType = "",
            triggerValue = ""

          if (event.message?.text) {
            triggerType = "keyword"
            triggerValue = event.message.text.toLowerCase().trim()
          } else if (event.postback?.payload) {
            triggerType = "postback"
            triggerValue = event.postback.payload
          } else {
            continue
          }

          // --- Idempotency guard ---
          const dmEventId =
            triggerType === "keyword"
              ? event.message?.mid || `dm_${senderId}_${event.timestamp || Date.now()}`
              : `postback_${senderId}_${event.timestamp || triggerValue}`
          if (await isDuplicateEvent(supabase, `dm_${dmEventId}`, "dm")) {
            console.log(`[v0] 🔁 Duplicate DM event skipped: ${dmEventId}`)
            continue
          }

          console.log(`[v0] 📩 DM from ${senderId}: "${triggerValue}"`)

          // ============================================================
          // 💾 1. SAVE INCOMING MESSAGE (Live Inbox Logic) + track last_inbound_at
          // ============================================================
          let conv: any = null
          try {
            let { data: existingConv } = await supabase
              .from("conversations")
              .select("id, last_inbound_at")
              .eq("user_id", user.id)
              .eq("recipient_id", senderId)
              .single()

            const nowIso = new Date().toISOString()

            if (!existingConv) {
              let realUsername = `cnt_${senderId.slice(0, 5)}...`
              try {
                const profileUrl = `https://graph.instagram.com/v24.0/${senderId}?fields=username&access_token=${user.access_token}`
                const profileRes = await fetch(profileUrl)
                const profileData = await profileRes.json()
                if (profileData.username) {
                  realUsername = profileData.username
                }
              } catch (e) {
                console.error("[v0] Failed to fetch username", e)
              }

              const { data: newConv } = await supabase
                .from("conversations")
                .insert({
                  user_id: user.id,
                  recipient_id: senderId,
                  recipient_username: realUsername,
                  last_message_at: nowIso,
                  last_inbound_at: nowIso,
                })
                .select("id, last_inbound_at")
                .single()
              conv = newConv
            } else {
              await supabase
                .from("conversations")
                .update({ last_message_at: nowIso, last_inbound_at: nowIso })
                .eq("id", existingConv.id)
              conv = { id: existingConv.id, last_inbound_at: nowIso }
            }

            if (conv) {
              await supabase.from("messages").insert({
                id: event.message?.mid || `mid_${Date.now()}_${Math.random()}`,
                conversation_id: conv.id,
                user_id: user.id,
                sender_id: senderId,
                sender_username: "User",
                content: triggerValue,
                is_from_instagram: true,
              })
            }
          } catch (err) {
            console.error("[v0] Failed to save incoming message DB", err)
          }
          // ============================================================

          // ============================================================
          // ⏰ 24-HOUR MESSAGING WINDOW CHECK
          // Meta only allows business-initiated sends within 24h of the user's
          // last message. This applies to standard DM replies (this section) —
          // NOT to comment-triggered private replies (PART A), which have their
          // own separate allowance under Meta's rules.
          // ============================================================
          const withinWindow = (() => {
            if (!conv?.last_inbound_at) return true // just created above, always within window
            const hoursSince = (Date.now() - new Date(conv.last_inbound_at).getTime()) / 36e5
            return hoursSince <= 24
          })()

          if (!withinWindow) {
            console.log(`[v0] ⏸️ Skipped DM to ${senderId} — outside 24h messaging window`)
            await logRun(supabase, {
              userId: user.id,
              eventType: triggerType === "postback" ? "postback" : "dm",
              triggerText: triggerValue,
              matched: false,
              actionStatus: "skipped",
              errorMessage: "Outside 24h messaging window",
            })
            continue
          }

          let match = null
          if (triggerType === "postback") {
            if (triggerValue.startsWith("UNLOCK_CONTENT_")) {
              const ruleId = triggerValue.replace("UNLOCK_CONTENT_", "")
              match = automations.find((a: any) => a.id === ruleId)
            } else if (triggerValue.startsWith("ICE_BREAKER_")) {
              const iceBreakerId = triggerValue.replace("ICE_BREAKER_", "")
              const { data: ibMatches } = await supabase
                .from("ice_breakers")
                .select("*")
                .eq("id", iceBreakerId)
                .eq("user_id", user.id)
                .single()

              if (ibMatches) {
                match = {
                  name: "Ice Breaker: " + ibMatches.question,
                  response_content: { message: ibMatches.response },
                }
              }
            } else {
              match = automations.find((a: any) => a.trigger_type === "postback" && a.trigger_value === triggerValue)
            }
          } else {
            const dmAutomations = automations.filter(
              (a: any) => a.trigger_source === 'dm' || !a.trigger_source
            )

            // Priority 1: specific keyword match
            match = dmAutomations.find(
              (a: any) =>
                a.trigger_type === "keyword" &&
                a.trigger_value.split(",").some((k: string) => new RegExp(`\\b${escapeRegex(k.trim())}\\b`, "i").test(triggerValue)),
            )

            // Priority 2: wildcard catch-all — matches ANY DM. Only used when no
            // specific keyword automation matched, so keyword rules always win.
            if (!match) {
              match = dmAutomations.find((a: any) => a.trigger_type === "wildcard")
            }
          }

          if (!match) {
            // ============================================================
            // 🤖 GROQ AI AUTO-REPLY FALLBACK
            // ============================================================
            if (user.groq_auto_reply_enabled && triggerType === "keyword") {
              console.log(`[v0] 🤖 No keyword match — trying AI for ${senderId}`)
              try {
                const gatewaySecret = process.env.GATEWAY_SECRET
                if (!gatewaySecret) {
                  console.log("[v0] ❌ GATEWAY_SECRET not set")
                  continue
                }

                let chatHistory: { role: string; content: string }[] = []
                const { data: convData } = await supabase
                  .from("conversations")
                  .select("id")
                  .eq("user_id", user.id)
                  .eq("recipient_id", senderId)
                  .single()

                if (convData?.id) {
                  const { data: recentMsgs } = await supabase
                    .from("messages")
                    .select("content, sender_id, is_from_instagram")
                    .eq("conversation_id", convData.id)
                    .order("created_at", { ascending: false })
                    .limit(10)

                  if (recentMsgs && recentMsgs.length > 0) {
                    chatHistory = recentMsgs
                      .reverse()
                      .map((m: any) => ({
                        role: m.is_from_instagram ? "user" : "assistant",
                        content: m.content,
                      }))
                  }
                }

                const hasHistory = chatHistory.length > 0
                const userMsgs = chatHistory.filter(m => m.role === "user").map(m => m.content).join(" ")

                const accountContext = (user as any).ai_context
                  ? `\n\nAbout this account (@${user.username}): ${(user as any).ai_context}`
                  : `\n\nYou manage the Instagram account @${user.username}.`

                const systemPrompt = hasHistory
                  ? `You are ${user.username} — a real person replying to your own Instagram DMs.${accountContext}

STRICT RULES — follow every single one:
- You ARE the account owner. Never say "I'm an AI" or "I can't" or "as an AI".
- Study the conversation history carefully. Match EXACTLY how this person talks — their language (Hindi/English/Hinglish), their energy level, punctuation style, whether they use emojis or not, how long their messages are.
- If they write casually with typos, you reply casually too. If they write formally, match that.
- Keep replies SHORT — max 1-2 sentences unless they asked something that needs more.
- Never be overly enthusiastic or use cringe phrases like "Absolutely!", "Great question!", "Of course!".
- Sound like a real busy person who replies quickly — not a customer service bot.
- If you don't know something, say "hmm let me check" or "kal bata deta hoon" — whatever fits the vibe.
- DO NOT use hashtags, bullet points, or formal formatting in DMs.
- Detect language from user's messages: ${userMsgs.slice(0, 100)}`
                  : `You are ${user.username} — a real person replying to your own Instagram DMs.${accountContext}

STRICT RULES — follow every single one:
- You ARE the account owner. Never say "I'm an AI" or "I can't".
- No prior chat history exists, so use a confident, natural tone — professional but not stiff. Think: smart Gen-Z founder who's friendly but busy.
- Keep it SHORT — 1-2 sentences max.
- Reply in the SAME language the person used (Hindi/English/Hinglish). If mixed, match the mix.
- NO cringe openers like "Absolutely!", "Sure thing!", "Great to hear!". Just reply normally.
- NO hashtags, NO bullet points, NO robotic formatting.
- If you don't know something, say something like "let me check and get back to you" — casual, real.
- Vary your style slightly — don't always start with "Hey" or the same word.`

                const aiMessages = [
                  { role: "system", content: systemPrompt },
                  ...chatHistory.slice(-6),
                  { role: "user", content: triggerValue },
                ]

                fetch(
                  `https://graph.instagram.com/v24.0/me/messages?access_token=${encodeURIComponent(user.access_token)}`,
                  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient: { id: senderId }, sender_action: "mark_seen" }) },
                ).catch(() => {})

                const preDelay = Math.floor(Math.random() * 3500) + 1500
                await new Promise(r => setTimeout(r, preDelay))

                const typingBody = {
                  recipient: { id: senderId },
                  sender_action: "typing_on",
                }
                fetch(
                  `https://graph.instagram.com/v24.0/me/messages?access_token=${encodeURIComponent(user.access_token)}`,
                  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(typingBody) },
                ).catch(() => {})

                const aiProxyUrl = process.env.AI_PROXY_URL || "https://triderai.vercel.app/api/chat"
                const aiRes = await fetch(aiProxyUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${gatewaySecret}`,
                  },
                  body: JSON.stringify({
                    model: "meta-llama/llama-4-maverick-17b-128e-instruct",
                    messages: aiMessages,
                    max_tokens: 120,
                    temperature: 0.85,
                  }),
                })

                fetch(
                  `https://graph.instagram.com/v24.0/me/messages?access_token=${encodeURIComponent(user.access_token)}`,
                  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient: { id: senderId }, sender_action: "typing_off" }) },
                ).catch(() => {})

                if (!aiRes.ok) {
                  console.log(`[v0] ❌ AI proxy error: ${aiRes.status}`)
                  await logRun(supabase, {
                    userId: user.id,
                    eventType: "dm",
                    triggerText: triggerValue,
                    matched: false,
                    actionStatus: "failed",
                    errorMessage: `AI proxy error: ${aiRes.status}`,
                  })
                  continue
                }

                let aiReply = ""
                let aiData: any = null
                const contentType = aiRes.headers.get("content-type") || ""
                console.log(`[v0] 🤖 AI response content-type: ${contentType}`)

                if (contentType.includes("text/event-stream")) {
                  const reader = aiRes.body?.getReader()
                  if (reader) {
                    const decoder = new TextDecoder()
                    let buf = ""
                    let chunkCount = 0
                    while (true) {
                      const { done, value } = await reader.read()
                      if (done) break
                      buf += decoder.decode(value, { stream: true })
                      const lines = buf.split("\n")
                      buf = lines.pop() || ""
                      for (const line of lines) {
                        if (!line.startsWith("data: ")) continue
                        const dataStr = line.slice(6).trim()
                        if (dataStr === "[DONE]") {
                          console.log(`[v0] 🤖 AI stream [DONE] received, chunks: ${chunkCount}`)
                          continue
                        }
                        try {
                          const parsed = JSON.parse(dataStr)
                          chunkCount++
                          const chunk = parsed.choices?.[0]?.delta?.content ||
                                        parsed.choices?.[0]?.text ||
                                        parsed.choices?.[0]?.delta?.text ||
                                        parsed.content ||
                                        parsed.delta?.content
                          if (chunk) aiReply += chunk
                          const full = parsed.choices?.[0]?.message?.content ||
                                       parsed.message?.content ||
                                       parsed.content
                          if (full && !aiReply) aiReply = full
                        } catch (e) {
                          console.log(`[v0] ⚠️ AI SSE parse error: ${e}, data: ${dataStr.slice(0, 100)}`)
                        }
                      }
                    }
                    console.log(`[v0] 🤖 AI SSE stream complete, total chunks: ${chunkCount}, reply length: ${aiReply.length}`)
                  }
                } else {
                  aiData = await aiRes.json()
                  console.log(`[v0] 🤖 AI JSON response keys: ${Object.keys(aiData).join(", ")}`)
                  console.log(`[v0] 🔍 choices[0]: ${JSON.stringify(aiData.choices?.[0])}`)
                  aiReply = aiData.choices?.[0]?.message?.content?.trim() ||
                            aiData.choices?.[0]?.text?.trim() ||
                            aiData.message?.content?.trim() ||
                            aiData.content?.trim() ||
                            aiData.response?.trim() ||
                            aiData.text?.trim() ||
                            ""
                }

                aiReply = aiReply.trim()

                if (!aiReply) {
                  console.log(`[v0] ❌ AI returned empty reply. finish_reason: ${aiData?.choices?.[0]?.finish_reason}`)
                  const fallbackReplies = [
                    "hanji batao",
                    "bolo",
                    "haan bhai",
                    "ji",
                    "sunao",
                    "kya haal hai",
                  ]
                  aiReply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)]
                  console.log(`[v0] 🔄 Using fallback reply: "${aiReply}"`)
                }

                console.log(`[v0] 🤖 AI Reply: "${aiReply}"`)

                const aiApiBody = {
                  recipient: { id: senderId },
                  message: { text: aiReply },
                }

                const sendRes = await fetch(
                  `https://graph.instagram.com/v24.0/me/messages?access_token=${encodeURIComponent(user.access_token)}`,
                  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(aiApiBody) },
                )
                const sendJson = await sendRes.json()
                if (sendJson.error) {
                  console.error("[v0] 🔴 AI Reply Send Failed:", sendJson.error)
                  await logRun(supabase, {
                    userId: user.id,
                    eventType: "dm",
                    triggerText: triggerValue,
                    matched: false,
                    actionStatus: "failed",
                    errorMessage: JSON.stringify(sendJson.error),
                  })
                } else {
                  console.log("[v0] 🟢 AI Reply Sent!")
                  await logRun(supabase, {
                    userId: user.id,
                    eventType: "dm",
                    triggerText: triggerValue,
                    matched: false,
                    actionStatus: "sent",
                    errorMessage: "AI fallback reply",
                  })

                  const { data: aiConv } = await supabase
                    .from("conversations")
                    .select("id")
                    .eq("user_id", user.id)
                    .eq("recipient_id", senderId)
                    .single()

                  if (aiConv) {
                    await supabase.from("messages").insert({
                      id: `mid_ai_${Date.now()}_${Math.random()}`,
                      conversation_id: aiConv.id,
                      user_id: user.id,
                      sender_id: user.business_account_id,
                      sender_username: user.username,
                      content: aiReply,
                      is_from_instagram: false,
                    })
                  }
                }
              } catch (groqErr) {
                console.error("[v0] 🔴 Groq AI Error:", groqErr)
              }
              continue
            }

            console.log(`[v0] ❌ No match.`)
            await logRun(supabase, {
              userId: user.id,
              eventType: triggerType === "postback" ? "postback" : "dm",
              triggerText: triggerValue,
              matched: false,
            })
            continue
          }

          console.log(`[v0] ✅ Match: "${match.name}"`)
          const content = match.response_content

          const isUnlockEvent = triggerType === "postback" && triggerValue.startsWith("UNLOCK_CONTENT_")
          const isFollowGate = content.check_follow === true && !isUnlockEvent

          // Follow-gate is always a single locked-content card, never a sequence —
          // steps only apply to the normal (non-gated) reply content.
          const sendContent = isFollowGate
            ? {
                card: {
                  title: "🔒 Content Locked",
                  subtitle: `Please follow @${user.username} to see this!`,
                  buttons: [
                    { type: "web_url", url: `https://instagram.com/${user.username}`, title: "Follow Us" },
                    { type: "postback", title: "I Followed! ✅", payload: `UNLOCK_CONTENT_${match.id}` },
                  ],
                },
              }
            : content

          const { ok: dmOk, results: dmResults } = await sendSteps(
            user.access_token,
            { id: senderId },
            senderId,
            sendContent,
          )

          if (!dmOk) {
            const lastError = dmResults[dmResults.length - 1]?.error
            console.error("[v0] 🔴 Reply Failed:", lastError)
            await logRun(supabase, {
              userId: user.id,
              automationId: match.id,
              eventType: triggerType === "postback" ? "postback" : "dm",
              triggerText: triggerValue,
              matched: true,
              actionStatus: "failed",
              errorMessage: lastError,
            })
          } else {
            console.log(`[v0] 🟢 Reply Sent! (${dmResults.length} step${dmResults.length > 1 ? "s" : ""})`)
            await logRun(supabase, {
              userId: user.id,
              automationId: match.id,
              eventType: triggerType === "postback" ? "postback" : "dm",
              triggerText: triggerValue,
              matched: true,
              actionStatus: "sent",
            })

            const { data: outConv } = await supabase
              .from("conversations")
              .select("id")
              .eq("user_id", user.id)
              .eq("recipient_id", senderId)
              .single()

            if (outConv) {
              for (const step of dmResults) {
                await supabase.from("messages").insert({
                  id: step.messageId || `mid_reply_${Date.now()}_${Math.random()}`,
                  conversation_id: outConv.id,
                  user_id: user.id,
                  sender_id: user.business_account_id,
                  sender_username: user.username,
                  content: step.text || "[Sent rich card]",
                  is_from_instagram: false,
                })
              }
            }
          }
        }
      }
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[v0] Webhook Error", error)
    return NextResponse.json({ ok: true })
  }
}
