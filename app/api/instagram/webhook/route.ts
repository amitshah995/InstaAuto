import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import crypto from "crypto"
import { postGraphMessage, sendSteps } from "@/lib/messaging/send-steps"
import { releaseDm, reserveAiRun, reserveDm } from "@/lib/billing/usage"
import { runFlow } from "@/lib/messaging/flow-runner"
import { emitEvent } from "@/lib/webhooks/events"
import { checkFollowStatus } from "@/lib/messaging/follow-check"
import { matchesAnyKeyword } from "@/lib/matching/keywords"
import { isOncePerPerson, onceKey } from "@/lib/automations/once"
import { extractReferral, findRefRule, sourceForRef } from "@/lib/automations/referral"
import { recordContactSource } from "@/lib/contacts/source"
import { fetchMediaMeta, needsMediaTimestamp, pickCommentAutomation, pinNextPostRule } from "@/lib/automations/comment-scope"
import { findQuickReplyRule, findQuickReplyTarget } from "@/lib/messaging/quick-replies"
import { firstNameFrom, resolvePublicReply, variantsNeedName } from "@/lib/automations/public-reply"
import {
  LIVE_COMMENT_FIELD,
  LIVE_RETRY_WINDOW_MS,
  isStaleLiveEvent,
  normalizeEntryChanges,
  pickLiveAutomation,
  readCommentValue,
} from "@/lib/automations/comment-events"

// No default token: a guessable fallback would let anyone subscribe. If this env var is unset, verification fails.
const WEBHOOK_VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || ""

// Long delayed-reply sequences and AI "typing" waits can exceed the default function time limit.
export const maxDuration = 60

// Last public-reply variant used per rule on this server instance, so two comments in a row do not get the same text.
// Best effort only (serverless instances do not share memory); the random pick is the real rotation.
const lastPublicReplyIndex = new Map<string, number>()

// Keyword matching lives in lib/matching/keywords.ts (Unicode-aware, whole-word).

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
    /** Instagram-scoped id of the person involved, forwarded to outbound webhooks. */
    igsid?: string | null
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

  // Outbound webhooks (Phase 4): every matched rule is a comment_matched / dm_sent / dm_failed event.
  // emitEvent never throws and does nothing when the user has no endpoints.
  if (params.matched && params.actionStatus !== "skipped") {
    const data = {
      automation_id: params.automationId || null,
      source: params.eventType,
      igsid: params.igsid || null,
      trigger_text: params.triggerText || null,
    }
    if (params.eventType === "comment") await emitEvent(params.userId, "comment_matched", data)
    if (params.actionStatus === "sent") await emitEvent(params.userId, "dm_sent", data)
    else if (params.actionStatus === "failed") await emitEvent(params.userId, "dm_failed", { ...data, error: params.errorMessage || null })
  }
}

// Saves one answer from a lead-qualification flow to the contacts table.
// name/email/phone get their own columns; anything else goes into custom_fields
// (merged, not overwritten, so earlier answers in the same flow aren't lost).
async function saveFlowAnswer(supabase: any, userId: number, igsid: string, field: string, value: string) {
  const standardFields = ["name", "email", "phone"]
  const { data: existing } = await supabase
    .from("contacts")
    .select("id, custom_fields")
    .eq("user_id", userId)
    .eq("igsid", igsid)
    .single()

  const customFields = { ...(existing?.custom_fields || {}) }
  if (!standardFields.includes(field)) customFields[field] = value

  const payload: any = { updated_at: new Date().toISOString(), custom_fields: customFields }
  if (standardFields.includes(field)) payload[field] = value

  if (existing) {
    await supabase.from("contacts").update(payload).eq("id", existing.id)
  } else {
    await supabase.from("contacts").insert({ user_id: userId, igsid, created_at: new Date().toISOString(), ...payload })
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (WEBHOOK_VERIFY_TOKEN && mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN && challenge) {
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

    // FAIL CLOSED: without the app secret we cannot tell Meta from an attacker, and a forged event
    // would make a customer's account send DMs. So refuse everything until it is configured.
    if (!appSecret) {
      console.error("[Celra] INSTAGRAM_APP_SECRET is not set: refusing webhook event")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }
    if (!signature) {
      console.error("[Celra] Missing webhook signature")
      return NextResponse.json({ error: "Missing signature" }, { status: 403 })
    }
    const expectedSig = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")
    const sigA = Buffer.from(signature)
    const sigB = Buffer.from(expectedSig)
    // Constant-time compare so the signature can't be guessed byte by byte.
    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
      console.error("[Celra] Invalid webhook signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
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
      // Live comments arrive on their own webhook field ("live_comments") with the same payload as "comments".
      // normalizeEntryChanges also accepts the flat entry.field/entry.value layout Meta shows in its docs.
      const commentChanges = normalizeEntryChanges(entry)
      if (commentChanges.length > 0) {
        for (const change of commentChanges) {
          const isLive = change.field === LIVE_COMMENT_FIELD
          const parsedComment = change.field === "comments" || isLive ? readCommentValue(change.value) : null
          if (parsedComment) {
            const commentId = parsedComment.commentId

            // --- Idempotency guard: skip if this exact comment was already processed ---
            if (await isDuplicateEvent(supabase, `comment_${commentId}`, "comment")) {
              console.log(`[v0] 🔁 Duplicate comment event skipped: ${commentId}`)
              continue
            }

            // Live: Meta only allows a private reply while the broadcast is on air, so a late redelivery is dropped.
            if (isLive && isStaleLiveEvent(entry.time, Date.now())) {
              console.log(`[v0] ⏭️ Stale live comment skipped (broadcast over): ${commentId}`)
              continue
            }

            const commentText = parsedComment.text.toLowerCase().trim()
            const senderId = parsedComment.senderId
            const mediaId = parsedComment.mediaId

            // Safety check for self-reply
            if (senderId === webhookId || senderId === user.business_account_id || senderId === user.page_id) continue

            // ============================================================
            // 🧠 SMART MATCHING LOGIC
            // ============================================================
            const commentAutomations = automations.filter((a: any) => a.trigger_source === (isLive ? 'live' : 'comment'))

            // Live comments only ever fire rules created on the Live tab (see lib/automations/comment-events.ts).
            // Post/reel comments: bound-to-this-post rules, then a pending "next post" rule, then "all posts" keyword
            // rules (see lib/automations/comment-scope.ts for the priority and for how "next post" binds).
            let match: any = null
            let pinNextPost = false
            if (isLive) {
              match = pickLiveAutomation(commentAutomations, commentText)
            } else {
              let publishedMs: number | null = null
              let productType: string | null = parsedComment.mediaProductType
              // Only ask Instagram for the post's publish time when a pending "next post" rule could match this comment.
              if (needsMediaTimestamp(commentAutomations, commentText)) {
                const meta = await fetchMediaMeta(user.access_token, mediaId)
                publishedMs = meta.publishedMs
                productType = meta.productType ?? productType
              }
              const pick = pickCommentAutomation(commentAutomations, { mediaId, text: commentText, mediaPublishedMs: publishedMs, mediaProductType: productType })
              match = pick.match
              pinNextPost = pick.pin
            }

            if (!match) {
              // Only log a "no match" row when there WERE comment automations to consider —
              // otherwise every comment on every account with zero automations spams the log.
              if (commentAutomations.length > 0) {
                await logRun(supabase, {
                  userId: user.id,
                  igsid: senderId,
                  eventType: "comment",
                  triggerText: commentText,
                  matched: false,
                })
              }
              continue
            }

            console.log(`[v0] ✅ Comment Match: "${match.name}" (ID: ${match.id})`)
            const content = match.response_content

            // "Next post" rule seeing its first eligible post: bind it to this post before anything is sent.
            if (pinNextPost) {
              const pinned = await pinNextPostRule(supabase, String(match.id), String(mediaId))
              if (!pinned) {
                console.log(`[v0] ⏭️ Next-post rule ${match.id} is already bound to another post`)
                continue
              }
              match.specific_media_id = mediaId
              console.log(`[v0] 📌 Next-post rule "${match.name}" pinned to media ${mediaId}`)
            }

            // "Once per person per post": claim (rule, person, post) atomically. A repeat comment
            // gets neither the public reply nor the DM.
            let onceClaimKey: string | null = null
            if (isOncePerPerson(content)) {
              onceClaimKey = onceKey(String(match.id), String(senderId), String(mediaId))
              if (await isDuplicateEvent(supabase, onceClaimKey, "once")) {
                console.log(`[v0] ⏭️ Skipped: ${senderId} already got "${match.name}" on this post`)
                await logRun(supabase, {
                  userId: user.id,
                  igsid: senderId,
                  automationId: match.id,
                  eventType: "comment",
                  triggerText: commentText,
                  matched: true,
                  actionStatus: "skipped",
                  errorMessage: "Already sent once to this person on this post",
                })
                continue
              }
            }

            // Public reply under the comment. What it says, whether it is sent at all, and the {first_name} /
            // {username} placeholders come from the rule (lib/automations/public-reply.ts). Rules without a
            // public_reply keep the old three phrases; live comments get none unless the rule turns it on.
            let publicReplyOk = true
            const publicVars = { username: parsedComment.username, firstName: firstNameFrom(null, parsedComment.username) }
            if (Array.isArray(content?.public_reply?.variants) && variantsNeedName(content.public_reply.variants)) {
              try {
                const { data: knownContact } = await supabase
                  .from("contacts")
                  .select("name")
                  .eq("user_id", user.id)
                  .eq("igsid", senderId)
                  .single()
                publicVars.firstName = firstNameFrom(knownContact?.name, parsedComment.username)
              } catch {
                // no saved name: the username fallback above is used
              }
            }
            const publicChoice = resolvePublicReply(content, publicVars, {
              isLive,
              lastIndex: lastPublicReplyIndex.get(String(match.id)) ?? null,
            })
            if (publicChoice.text !== null) {
              if (publicChoice.index !== null) lastPublicReplyIndex.set(String(match.id), publicChoice.index)
              try {
                const pubRes = await fetch(
                  `https://graph.instagram.com/v24.0/${commentId}/replies?access_token=${encodeURIComponent(user.access_token)}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: publicChoice.text }),
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
            }

            // Private Reply (DM) — one or more sequential steps
            const { ok: dmOk, results: dmResults } = await sendSteps(
              user.access_token,
              { comment_id: commentId },
              senderId,
              content,
              // Live: a failed private reply may only be retried while the broadcast can still be on air.
              { userId: user.id, windowUntil: isLive ? new Date(Date.now() + LIVE_RETRY_WINDOW_MS) : undefined },
            )

            if (!dmOk) {
              const lastError = dmResults[dmResults.length - 1]?.error
              console.error("[v0] 🔴 Private DM Failed:", lastError)
              // Nothing reached the person, so release the once-per-person claim — they can comment again.
              if (onceClaimKey) {
                try {
                  await supabase.from("processed_events").delete().eq("event_id", onceClaimKey)
                } catch (e) {
                  console.error("[v0] ⚠️ Could not release once-per-person claim:", e)
                }
              }
              await logRun(supabase, {
                userId: user.id,
                igsid: senderId,
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
                igsid: senderId,
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
                    content: `${isLive ? "📡 Live comment" : "💬 Commented"}: "${parsedComment.text}"`,
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
                return triggers.some((keyword: string) => matchesAnyKeyword(messageText, keyword))
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
                { userId: user.id },
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

          // Referral data from an ig.me link can ride inside message, inside postback, or alone (lib/automations/referral.ts).
          const referral = extractReferral(event)
          let triggerType = "",
            triggerValue = ""
          const rawMessageText = event.message?.text || ""
          // Tapping a quick reply chip posts its title as text AND adds message.quick_reply.payload
          // (https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api/quick-replies).
          // The text path below keeps working (flow answers, keywords); the payload lets a chip answer by itself.
          const quickReplyPayload: string | null = event.message?.quick_reply?.payload ? String(event.message.quick_reply.payload) : null

          if (event.message?.text) {
            triggerType = "keyword"
            triggerValue = event.message.text.toLowerCase().trim()
          } else if (event.postback?.payload) {
            triggerType = "postback"
            triggerValue = event.postback.payload
          } else if (referral) {
            // Someone opened an ig.me/m/<you>?ref=<code> link in an existing chat: the event holds only the referral
            // (webhook field messaging_referral). Meta gives the app 24 hours to reply.
            triggerType = "ref"
            triggerValue = referral.ref.toLowerCase()
          } else {
            continue
          }

          // --- Idempotency guard ---
          const dmEventId =
            triggerType === "keyword"
              ? event.message?.mid || `dm_${senderId}_${event.timestamp || Date.now()}`
              : triggerType === "ref"
                ? `ref_${senderId}_${event.timestamp || triggerValue}`
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
              .select("id, last_inbound_at, active_flow_automation_id, active_flow_step, active_flow_node_id, human_handled")
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
                .select("id, last_inbound_at, active_flow_automation_id, active_flow_step, active_flow_node_id")
                .single()
              conv = newConv
            } else {
              await supabase
                .from("conversations")
                .update({ last_message_at: nowIso, last_inbound_at: nowIso })
                .eq("id", existingConv.id)
              conv = {
                id: existingConv.id,
                last_inbound_at: nowIso,
                active_flow_automation_id: existingConv.active_flow_automation_id,
                active_flow_step: existingConv.active_flow_step,
                active_flow_node_id: existingConv.active_flow_node_id,
                human_handled: existingConv.human_handled,
              }
            }

            if (conv) {
              await supabase.from("messages").insert({
                id: event.message?.mid || `mid_${Date.now()}_${Math.random()}`,
                conversation_id: conv.id,
                user_id: user.id,
                sender_id: senderId,
                sender_username: "User",
                content: triggerType === "ref" ? `🔗 Opened your chat link (code: ${triggerValue})` : triggerValue,
                is_from_instagram: true,
              })
            }
          } catch (err) {
            console.error("[v0] Failed to save incoming message DB", err)
          }

          // Source tracking: remember which link/QR brought this person in (first touch wins). Independent of
          // whether a rule matches or the chat is handed to a human.
          if (referral) await recordContactSource(supabase, user.id, senderId, sourceForRef(referral.ref))
          // ============================================================

          // ============================================================
          // 🙋 HUMAN HANDOFF — a human agent has taken over this conversation
          // from the Inbox. Automations and AI stay silent until it's turned
          // back off, so the bot never talks over a human mid-conversation.
          // ============================================================
          if (conv?.human_handled) {
            console.log(`[v0] 🙋 Human is handling ${senderId} — skipping automation`)
            await logRun(supabase, {
              userId: user.id,
              igsid: senderId,
              eventType: triggerType === "postback" ? "postback" : "dm",
              triggerText: triggerValue,
              matched: false,
              actionStatus: "skipped",
              errorMessage: "Human handoff active",
            })
            continue
          }

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

          // ============================================================
          // 🧭 LEAD-QUALIFICATION FLOW — if this conversation is mid-flow (a
          // lead-qualification automation asked a question), this message is
          // the ANSWER to that question, not something to keyword-match.
          // ============================================================
          // Opening a ref link means "start that automation", so it wins over answering the previous flow.
          const refRule = referral ? findRefRule(automations, referral.ref) : null
          if (triggerType === "keyword" && !refRule && conv?.active_flow_automation_id && withinWindow) {
            const flowAutomation = automations.find((a: any) => a.id === conv.active_flow_automation_id)
            const questions = flowAutomation?.response_content?.questions
            const stepIndex = conv.active_flow_step ?? 0

            if (flowAutomation && Array.isArray(questions) && questions[stepIndex]) {
              const currentQuestion = questions[stepIndex]
              await saveFlowAnswer(supabase, user.id, senderId, currentQuestion.field, rawMessageText.trim())

              const nextIndex = stepIndex + 1
              const nextQuestion = questions[nextIndex]

              if (nextQuestion) {
                await supabase.from("conversations").update({ active_flow_step: nextIndex }).eq("id", conv.id)
                await sendSteps(user.access_token, { id: senderId }, senderId, { message: nextQuestion.prompt }, { userId: user.id })
              } else {
                await supabase
                  .from("conversations")
                  .update({ active_flow_automation_id: null, active_flow_step: null })
                  .eq("id", conv.id)
                // Lead complete: tell the creator's outbound webhooks (Sheets, CRM, Zapier...).
                const { data: lead } = await supabase
                  .from("contacts")
                  .select("name, email, phone, custom_fields")
                  .eq("user_id", user.id)
                  .eq("igsid", senderId)
                  .single()
                await emitEvent(user.id, "lead_captured", {
                  automation_id: flowAutomation.id,
                  igsid: senderId,
                  name: lead?.name ?? null,
                  email: lead?.email ?? null,
                  phone: lead?.phone ?? null,
                  custom_fields: lead?.custom_fields ?? {},
                })
                if (flowAutomation.response_content.closing_message) {
                  await sendSteps(user.access_token, { id: senderId }, senderId, {
                    message: flowAutomation.response_content.closing_message,
                  }, { userId: user.id })
                }
              }

              await logRun(supabase, {
                userId: user.id,
                igsid: senderId,
                automationId: flowAutomation.id,
                eventType: "dm",
                triggerText: triggerValue,
                matched: true,
                actionStatus: "sent",
                errorMessage: nextQuestion ? `Flow step ${nextIndex}/${questions.length}` : "Flow completed",
              })

              const outText = nextQuestion ? nextQuestion.prompt : flowAutomation.response_content.closing_message || null
              if (outText) {
                await supabase.from("messages").insert({
                  id: `mid_flow_${Date.now()}_${Math.random()}`,
                  conversation_id: conv.id,
                  user_id: user.id,
                  sender_id: user.business_account_id,
                  sender_username: user.username,
                  content: outText,
                  is_from_instagram: false,
                })
              }

              continue
            }
          }

          // ============================================================
          // 🌳 BRANCHING FLOW — if this conversation is paused at a condition
          // node in a Flow Builder automation, resume it with this reply.
          // ============================================================
          if (triggerType === "keyword" && !refRule && conv?.active_flow_automation_id && conv?.active_flow_node_id && withinWindow) {
            const flowAutomation = automations.find((a: any) => a.id === conv.active_flow_automation_id)
            const flow = flowAutomation?.response_content?.flow

            if (flowAutomation && flow?.nodes) {
              const { nodeId: runNodeId, sentTexts, scheduled: flowScheduled } = await runFlow(
                user.access_token,
                senderId,
                flow,
                conv.active_flow_node_id,
                rawMessageText.trim(),
                { ctx: { userId: user.id }, automationId: flowAutomation.id },
              )
              const nextNodeId = flowScheduled ? null : runNodeId

              await supabase
                .from("conversations")
                .update({
                  active_flow_node_id: nextNodeId,
                  active_flow_automation_id: nextNodeId ? conv.active_flow_automation_id : null,
                })
                .eq("id", conv.id)

              await logRun(supabase, {
                userId: user.id,
                igsid: senderId,
                automationId: flowAutomation.id,
                eventType: "dm",
                triggerText: triggerValue,
                matched: true,
                actionStatus: sentTexts.length > 0 ? "sent" : "skipped",
                errorMessage: nextNodeId ? "Flow continuing" : "Flow completed",
              })

              for (const text of sentTexts) {
                await supabase.from("messages").insert({
                  id: `mid_flow_${Date.now()}_${Math.random()}`,
                  conversation_id: conv.id,
                  user_id: user.id,
                  sender_id: user.business_account_id,
                  sender_username: user.username,
                  content: text,
                  is_from_instagram: false,
                })
              }

              continue
            }
          }

          if (!withinWindow) {
            console.log(`[v0] ⏸️ Skipped DM to ${senderId} — outside 24h messaging window`)
            await logRun(supabase, {
              userId: user.id,
              igsid: senderId,
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

            // Priority -1: an ig.me ref link. The "ref" rule with that code runs first, even when the first
            // message carries text, because the link says exactly which automation the person asked for.
            if (refRule) match = refRule

            // Priority 0: a tapped quick reply chip. A chip with its own reply answers by itself; a rule can also be
            // triggered by the chip payload (trigger_type quick_reply). Anything else falls through to keywords,
            // because the chip title also arrived as ordinary text.
            if (!match && quickReplyPayload) {
              const chip = findQuickReplyTarget(automations, quickReplyPayload)
              if (chip) {
                match = { id: chip.automation.id, name: `Quick reply: ${chip.title}`, response_content: { message: chip.reply } }
              } else {
                match = findQuickReplyRule(dmAutomations, quickReplyPayload)
              }
            }

            // Priority 1: specific keyword match. A link opened with no text (triggerType "ref") is not a message, so
            // keyword and "any DM" rules stay out of it; only a ref rule answers it.
            if (!match && triggerType !== "ref") match = dmAutomations.find(
              (a: any) =>
                a.trigger_type === "keyword" &&
                matchesAnyKeyword(triggerValue, a.trigger_value),
            )

            // Priority 2: wildcard catch-all — matches ANY DM. Only used when no
            // specific keyword automation matched, so keyword rules always win.
            if (!match && triggerType !== "ref") {
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

                // Plan AI limit (daily). Over the limit: skip the AI fallback silently (no reply is sent).
                const aiQuota = await reserveAiRun(user.id)
                if (!aiQuota.allowed) {
                  await logRun(supabase, {
                    userId: user.id,
                    igsid: senderId,
                    eventType: "dm",
                    triggerText: triggerValue,
                    matched: false,
                    actionStatus: "skipped",
                    errorMessage: aiQuota.message,
                  })
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
- If the person asks something you genuinely don't know, seems upset/frustrated, asks for a refund, or needs a decision only the real account owner should make — reply with EXACTLY this and nothing else: ESCALATE_TO_HUMAN
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
- Vary your style slightly — don't always start with "Hey" or the same word.
- If the person asks something you genuinely don't know, seems upset/frustrated, asks for a refund, or needs a decision only the real account owner should make — reply with EXACTLY this and nothing else: ESCALATE_TO_HUMAN`

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
                    igsid: senderId,
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

                // ============================================================
                // 🙋 AI ESCALATION — model decided it can't/shouldn't handle this
                // itself. Flip on human handoff and send one handoff message
                // instead of the raw sentinel text.
                // ============================================================
                if (aiReply.includes("ESCALATE_TO_HUMAN")) {
                  console.log(`[v0] 🙋 AI requested escalation for ${senderId}`)
                  if (conv) {
                    await supabase.from("conversations").update({ human_handled: true }).eq("id", conv.id)
                  }
                  const handoffMessage = "Let me get one of our team to help you with that — they'll be with you shortly! 🙋"
                  const handoffRes = await fetch(
                    `https://graph.instagram.com/v24.0/me/messages?access_token=${encodeURIComponent(user.access_token)}`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ recipient: { id: senderId }, message: { text: handoffMessage } }),
                    },
                  )
                  const handoffJson = await handoffRes.json()
                  await logRun(supabase, {
                    userId: user.id,
                    igsid: senderId,
                    eventType: "dm",
                    triggerText: triggerValue,
                    matched: false,
                    actionStatus: handoffJson.error ? "failed" : "sent",
                    errorMessage: "Escalated to human",
                  })
                  if (!handoffJson.error && conv) {
                    await supabase.from("messages").insert({
                      id: `mid_escalate_${Date.now()}_${Math.random()}`,
                      conversation_id: conv.id,
                      user_id: user.id,
                      sender_id: user.business_account_id,
                      sender_username: user.username,
                      content: handoffMessage,
                      is_from_instagram: false,
                    })
                  }
                  continue
                }

                console.log(`[v0] 🤖 AI Reply: "${aiReply}"`)

                const aiApiBody = {
                  recipient: { id: senderId },
                  message: { text: aiReply },
                }

                // Plan DM limit, then send with the shared retry helper (transient Meta errors are retried).
                const dmQuota = await reserveDm(user.id)
                if (!dmQuota.allowed) {
                  await logRun(supabase, {
                    userId: user.id,
                    igsid: senderId,
                    eventType: "dm",
                    triggerText: triggerValue,
                    matched: false,
                    actionStatus: "skipped",
                    errorMessage: dmQuota.message,
                  })
                  continue
                }
                const aiSent = await postGraphMessage(user.access_token, aiApiBody)
                if (!aiSent.ok) await releaseDm(user.id) // failed sends are not billed
                const sendJson = { error: aiSent.ok ? null : (aiSent.error ?? { message: "Network error talking to Instagram" }) }
                if (sendJson.error) {
                  console.error("[v0] 🔴 AI Reply Send Failed:", sendJson.error)
                  await logRun(supabase, {
                    userId: user.id,
                    igsid: senderId,
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
                    igsid: senderId,
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
              igsid: senderId,
              eventType: triggerType === "postback" ? "postback" : "dm",
              triggerText: triggerValue,
              matched: false,
            })
            continue
          }

          console.log(`[v0] ✅ Match: "${match.name}"`)
          const content = match.response_content

          // Ref links: "once per person" (default on in the rule form) so re-opening the link does not repeat the welcome.
          // Claimed atomically like the comment rules; released below if nothing could be sent.
          let refOnceClaim: string | null = null
          if (match.trigger_type === "ref" && isOncePerPerson(content)) {
            refOnceClaim = onceKey(String(match.id), String(senderId), `ref:${triggerValue}`)
            if (await isDuplicateEvent(supabase, refOnceClaim, "once")) {
              console.log(`[v0] ⏭️ Skipped: ${senderId} already got ref rule "${match.name}"`)
              await logRun(supabase, {
                userId: user.id,
                igsid: senderId,
                automationId: match.id,
                eventType: "dm",
                triggerText: triggerValue,
                matched: true,
                actionStatus: "skipped",
                errorMessage: "Already sent once to this person for this link",
              })
              continue
            }
          }

          // Lead-qualification flow: instead of sending the configured reply
          // directly, ask the first question and mark this conversation as
          // "in a flow" — the next inbound DM is captured as the answer by
          // the flow-answer block above, not matched against keywords.
          if ((triggerType === "keyword" || triggerType === "ref") && conv && Array.isArray(content.questions) && content.questions.length > 0) {
            const firstQuestion = content.questions[0]
            await supabase
              .from("conversations")
              .update({ active_flow_automation_id: match.id, active_flow_step: 0 })
              .eq("id", conv.id)

            const { ok: flowStartOk } = await sendSteps(user.access_token, { id: senderId }, senderId, {
              message: firstQuestion.prompt,
            })

            await logRun(supabase, {
              userId: user.id,
              igsid: senderId,
              automationId: match.id,
              eventType: "dm",
              triggerText: triggerValue,
              matched: true,
              actionStatus: flowStartOk ? "sent" : "failed",
              errorMessage: flowStartOk ? "Flow started" : "Failed to send first question",
            })

            if (flowStartOk) {
              await supabase.from("messages").insert({
                id: `mid_flow_${Date.now()}_${Math.random()}`,
                conversation_id: conv.id,
                user_id: user.id,
                sender_id: user.business_account_id,
                sender_username: user.username,
                content: firstQuestion.prompt,
                is_from_instagram: false,
              })
            }

            continue
          }

          // Branching flow (Flow Builder): walk the graph from its start node,
          // auto-sending messages until it hits a condition node (then pause
          // and wait for the reply) or the end.
          if ((triggerType === "keyword" || triggerType === "ref") && conv && content.flow?.nodes && content.flow?.startNodeId) {
            const { nodeId: runNodeId, sentTexts, scheduled: flowScheduled } = await runFlow(
              user.access_token,
              senderId,
              content.flow,
              content.flow.startNodeId,
              null,
              { ctx: { userId: user.id }, automationId: match.id },
            )
            // A delayed node is owned by the scheduler; don't leave the chat parked on it.
            const nextNodeId = flowScheduled ? null : runNodeId

            await supabase
              .from("conversations")
              .update({
                active_flow_automation_id: nextNodeId ? match.id : null,
                active_flow_node_id: nextNodeId,
              })
              .eq("id", conv.id)

            await logRun(supabase, {
              userId: user.id,
              igsid: senderId,
              automationId: match.id,
              eventType: "dm",
              triggerText: triggerValue,
              matched: true,
              actionStatus: sentTexts.length > 0 ? "sent" : "failed",
              errorMessage: nextNodeId ? "Flow started, paused at condition" : "Flow completed in one pass",
            })

            for (const text of sentTexts) {
              await supabase.from("messages").insert({
                id: `mid_flow_${Date.now()}_${Math.random()}`,
                conversation_id: conv.id,
                user_id: user.id,
                sender_id: user.business_account_id,
                sender_username: user.username,
                content: text,
                is_from_instagram: false,
              })
            }

            continue
          }

          const isUnlockEvent = triggerType === "postback" && triggerValue.startsWith("UNLOCK_CONTENT_")

          // Real follow check (Instagram User Profile API). Only asked when the rule has the gate on.
          // "unknown" (field missing, no consent yet, error) keeps the old honour-system behaviour.
          const followStatus = content.check_follow === true ? await checkFollowStatus(user.access_token, senderId) : "unknown"

          // Verified NOT following, and they tapped "I Followed!": do not unlock. Keep the button and ask kindly.
          const stillLocked = isUnlockEvent && followStatus === "not_following"
          // Already verified as a follower: no need to gate them at all, send the content straight away.
          const isFollowGate = content.check_follow === true && !isUnlockEvent && followStatus !== "following"

          // Follow-gate is always a single locked-content card, never a sequence —
          // steps only apply to the normal (non-gated) reply content.
          const sendContent = isFollowGate || stillLocked
            ? {
                card: {
                  title: stillLocked ? "Almost there" : "🔒 Content Locked",
                  subtitle: stillLocked
                    ? `We could not see that you follow @${user.username} yet. Please follow first, then tap the button again.`
                    : `Please follow @${user.username} to see this!`,
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
            { userId: user.id },
          )

          if (!dmOk) {
            const lastError = dmResults[dmResults.length - 1]?.error
            console.error("[v0] 🔴 Reply Failed:", lastError)
            if (refOnceClaim) {
              try {
                await supabase.from("processed_events").delete().eq("event_id", refOnceClaim)
              } catch (e) {
                console.error("[v0] ⚠️ Could not release ref once-per-person claim:", e)
              }
            }
            await logRun(supabase, {
              userId: user.id,
              igsid: senderId,
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
              igsid: senderId,
              automationId: match.id,
              eventType: triggerType === "postback" ? "postback" : "dm",
              triggerText: triggerValue,
              matched: true,
              actionStatus: "sent",
              // Transparent in the run log: this unlock was not verified by Instagram.
              errorMessage: isUnlockEvent && content.check_follow === true && followStatus === "unknown" ? "Follow not verified (honour system)" : stillLocked ? "Follow gate: not following yet, content kept locked" : null,
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
