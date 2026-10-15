#!/usr/bin/env node
/**
 * Spike 0: what does an Instagram-Login access token (the kind DMSpark already has)
 * actually allow?  Decides how competitor tracking and the public audit are built.
 *
 * Usage (use YOUR OWN connected account's token; nothing is written anywhere):
 *   IG_ACCESS_TOKEN=... node scripts/spike-business-discovery.mjs nasa
 *
 * Get a token from the `users.access_token` column. If TOKEN_ENCRYPTION_KEY is enabled
 * the column is encrypted, so use a freshly issued token or decrypt via the app instead.
 * The token is never printed.
 */

const token = process.env.IG_ACCESS_TOKEN
const target = (process.argv[2] || "nasa").replace(/^@/, "")
const V = "v24.0"

if (!token) {
  console.error("Set IG_ACCESS_TOKEN (an Instagram Login access token).")
  process.exit(1)
}

async function call(label, url) {
  try {
    const res = await fetch(url)
    const body = await res.json().catch(() => ({}))
    const ok = res.ok && !body.error
    console.log(`\n[${ok ? "PASS" : "FAIL"}] ${label}  (HTTP ${res.status})`)
    if (!ok) {
      const e = body.error || body
      console.log(`   code=${e.code} type=${e.type} message=${e.message}`)
    } else {
      console.log("   " + JSON.stringify(body).slice(0, 400))
    }
    return ok
  } catch (e) {
    console.log(`\n[FAIL] ${label}: ${e.message}`)
    return false
  }
}

const base = `https://graph.instagram.com/${V}`
const t = `access_token=${encodeURIComponent(token)}`

const results = {}

results.profile = await call(
  "Own profile (sanity check)",
  `${base}/me?fields=user_id,username,followers_count,media_count&${t}`
)

results.businessDiscovery = await call(
  `Business Discovery on @${target} (competitor / public audit)`,
  `${base}/me?fields=business_discovery.username(${target}){username,followers_count,media_count,media.limit(5){like_count,comments_count,timestamp,media_type}}&${t}`
)

results.accountInsights = await call(
  "Account insights: reach (needs instagram_business_manage_insights)",
  `${base}/me/insights?metric=reach&period=day&${t}`
)

results.hashtagSearch = await call(
  "Hashtag search (expected to fail on Instagram Login)",
  `${base}/ig_hashtag_search?user_id=me&q=travel&${t}`
)

console.log("\n================ VERDICT ================")
console.log(
  results.businessDiscovery
    ? "Business Discovery WORKS with Instagram Login -> competitor tracking + public audit need no new login flow."
    : "Business Discovery FAILED -> competitor/public-audit data needs the Facebook Login path (lookup account + app review). See error above."
)
console.log(
  results.accountInsights
    ? "Insights WORK -> connected audit can use reach/profile-views."
    : "Insights FAILED -> request instagram_business_manage_insights in the OAuth scope and Meta App Review."
)
console.log(
  results.hashtagSearch
    ? "Hashtag search works (unexpected)."
    : "Hashtag search unavailable on this login type, as documented."
)
