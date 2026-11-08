/**
 * Real follow verification for the Follow Gate, using the Instagram User Profile API.
 *
 * Who calls this: app/api/instagram/webhook/route.ts (DM path, when a rule has check_follow on).
 * Why it exists: the gate used to be an honour system (the "I Followed!" button just unlocked).
 * Meta documents the field `is_user_follow_business` ("Indicates whether the Instagram user
 * follows your app user"), returned by GET /<INSTAGRAM_SCOPED_ID>?fields=is_user_follow_business
 * on graph.instagram.com with instagram_business_basic + instagram_business_manage_messages.
 * Source (checked 2026-11-09):
 * https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api/user-profile
 * Limits stated there: the user's consent is required (set when they message the account or tap
 * an icebreaker), and the profile is hidden if the user blocked the account. So the call can fail
 * or omit the field; those cases return "unknown" and the gate falls back to the honour system.
 */

export type FollowStatus = "following" | "not_following" | "unknown"

/** Pure: turns a Graph response body into a status. Anything but an explicit boolean is "unknown". */
export function parseFollowResponse(json: unknown): FollowStatus {
  const j = json as { is_user_follow_business?: unknown; error?: unknown } | null
  if (!j || j.error) return "unknown"
  if (j.is_user_follow_business === true) return "following"
  if (j.is_user_follow_business === false) return "not_following"
  return "unknown"
}

/** Asks Instagram whether `igsid` follows the connected account. Never throws; never logs the token. */
export async function checkFollowStatus(
  accessToken: string,
  igsid: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FollowStatus> {
  try {
    const res = await fetchImpl(
      `https://graph.instagram.com/v24.0/${encodeURIComponent(igsid)}?fields=is_user_follow_business&access_token=${encodeURIComponent(accessToken)}`,
      { signal: AbortSignal.timeout(5000) }, // the webhook must stay fast
    )
    return parseFollowResponse(await res.json().catch(() => null))
  } catch {
    return "unknown" // network error or timeout: keep the honest honour-system behaviour
  }
}
