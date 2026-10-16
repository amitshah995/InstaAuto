/**
 * Hashtag tools: a curated "commonly used" list and helpers to clean AI suggestions.
 * We have NO post counts or reach data for hashtags (the official Instagram API does not provide it),
 * so nothing here claims any. The list order is a rough guide, not live data.
 */

/** Instagram announced (Dec 2025) a cap of five hashtags per post and Reel, rolling out gradually. */
export const HASHTAG_LIMIT = 5

/** Engagement-bait and spam tags. We never suggest them and strip them from AI output. */
export const BLOCKED_TAGS = new Set([
  "follow", "followme", "followback", "follow4follow", "followforfollow", "followforfollowback", "f4f", "fff",
  "like", "likes", "like4like", "likeforlike", "l4l", "likeforlikes", "instalike", "instafollow", "instalikes",
  "tagsforlikes", "likesforlikes", "teamfollowback", "spam", "sfs", "shoutout", "followtrain", "gainfollowers", "getfollowers",
])

export const TOP_HASHTAGS: string[] = [
  "love", "instagram", "fashion", "photography", "art", "photooftheday", "nature", "beautiful", "travel", "instadaily",
  "happy", "style", "cute", "beauty", "food", "photo", "music", "life", "motivation", "fitness",
  "lifestyle", "summer", "picoftheday", "smile", "fun", "friends", "family", "selfie", "girl", "model",
  "makeup", "ootd", "design", "sunset", "home", "dog", "cat", "travelgram", "foodie", "instagood",
  "explore", "reels", "trending", "viral", "aesthetic", "inspiration", "wedding", "quotes", "dance", "couple",
  "party", "flowers", "sky", "landscape", "architecture", "drawing", "artist", "painting", "vibes", "goals",
  "mood", "weekend", "coffee", "healthy", "yoga", "workout", "gym", "health", "business", "entrepreneur",
  "success", "marketing", "smallbusiness", "shopping", "handmade", "jewelry", "sale", "india", "mumbai", "delhi",
  "desi", "bollywood", "streetstyle", "menswear", "outfit", "dress", "shoes", "hair", "skincare", "festival",
  "diwali", "cricket", "football", "sports", "memes", "comedy", "mindset", "growth", "positivity", "nofilter",
]

export interface HashtagCategory { id: string; label: string; tags: string[] }

export const HASHTAG_CATEGORIES: HashtagCategory[] = [
  { id: "top", label: "Top 100", tags: TOP_HASHTAGS },
  { id: "travel", label: "Travel", tags: ["travel", "travelgram", "wanderlust", "traveldiaries", "explore", "adventure", "vacation", "holiday", "roadtrip", "backpacking", "beach", "mountains", "hiking", "sunsetlovers", "incredibleindia", "travelblogger", "traveltheworld", "exploremore", "naturelovers", "tripoftheweek", "solotravel", "weekendgetaway", "hiddengems", "citybreak", "travelphotography", "staycation", "wildlife", "islandlife", "bucketlist", "traveltips"] },
  { id: "food", label: "Food", tags: ["food", "foodie", "foodphotography", "foodlover", "instafood", "homemade", "recipe", "cooking", "healthyfood", "dessert", "streetfood", "indianfood", "foodblogger", "breakfast", "dinner", "lunch", "baking", "vegan", "vegetarian", "coffeetime", "chai", "biryani", "pizza", "cake", "tasty", "yummy", "chef", "mealprep", "brunch", "cafe"] },
  { id: "fitness", label: "Fitness & health", tags: ["fitness", "workout", "gym", "fitnessmotivation", "health", "healthy", "yoga", "training", "wellness", "running", "weightloss", "strength", "cardio", "homeworkout", "nutrition", "mindfulness", "meditation", "selfcare", "personaltrainer", "bodybuilding", "crossfit", "stretching", "healthylifestyle", "fitfam", "legday", "protein", "mentalhealth", "pilates", "walking", "sleep"] },
  { id: "fashion", label: "Fashion & style", tags: ["fashion", "style", "ootd", "outfit", "streetstyle", "fashionblogger", "menswear", "womenswear", "fashionstyle", "outfitinspo", "lookbook", "stylish", "trendy", "ethnicwear", "saree", "kurti", "sneakers", "accessories", "fashiondesigner", "thrift", "styleinspo", "capsulewardrobe", "denim", "minimalstyle", "vintagefashion", "wedding", "bridalwear", "fashionweek", "shoes", "jewelry"] },
  { id: "beauty", label: "Beauty", tags: ["beauty", "makeup", "skincare", "makeupartist", "hair", "hairstyle", "nails", "nailart", "glam", "makeuptutorial", "skincareroutine", "beautytips", "lipstick", "eyeshadow", "glowingskin", "haircare", "bridalmakeup", "mua", "naturalbeauty", "cleanbeauty", "selfcare", "salon", "facial", "perfume", "foundation", "makeuplook", "browsandlashes", "spa", "beautyroutine", "grwm"] },
  { id: "business", label: "Business & marketing", tags: ["business", "entrepreneur", "marketing", "smallbusiness", "startup", "branding", "digitalmarketing", "socialmediamarketing", "success", "mindset", "ecommerce", "shoplocal", "supportsmallbusiness", "businessowner", "sidehustle", "contentcreator", "growthmindset", "leadership", "onlinebusiness", "womeninbusiness", "sales", "customerservice", "productivity", "freelancer", "workfromhome", "businesstips", "socialmediatips", "instagramtips", "contentstrategy", "madeinindia"] },
  { id: "photography", label: "Photography", tags: ["photography", "photooftheday", "picoftheday", "portrait", "landscape", "streetphotography", "naturephotography", "mobilephotography", "photographer", "travelphotography", "blackandwhite", "macro", "sunset", "goldenhour", "cityscape", "photoshoot", "candid", "lightroom", "cinematic", "naturelovers", "wildlifephotography", "architecture", "nightphotography", "minimal", "droneshots", "composition", "lowlight", "bokeh", "shotoniphone", "photoediting"] },
  { id: "india", label: "India", tags: ["india", "incredibleindia", "desi", "indian", "mumbai", "delhi", "bangalore", "bollywood", "indianfood", "indianwedding", "indianculture", "madeinindia", "vocalforlocal", "ethnicwear", "diwali", "holi", "cricket", "chai", "streetsofindia", "indiagram", "kolkata", "jaipur", "rajasthan", "kerala", "goa", "punjabi", "hindi", "indianfashion", "startupindia", "indiantraveller"] },
]

/** Lowercase, drop '#', allow letters/digits/underscore only (2-40 chars). Returns null when unusable. */
export function cleanTag(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const t = raw.trim().replace(/^#+/, "").toLowerCase()
  if (!/^[\p{L}\p{N}_]{2,40}$/u.test(t)) return null
  if (/^\d+$/.test(t)) return null
  if (BLOCKED_TAGS.has(t)) return null
  return t
}

/** Up to 5 keywords from free text: letters, digits and spaces only. Anything else is dropped. */
export function sanitizeKeywords(input: unknown): string[] {
  const raw = Array.isArray(input) ? input.map(String) : typeof input === "string" ? input.split(",") : []
  const out: string[] = []
  for (const r of raw) {
    const k = r.replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 30)
    if (k.length >= 2 && !out.some((x) => x.toLowerCase() === k.toLowerCase())) out.push(k)
    if (out.length === 5) break
  }
  return out
}

export const GROUP_META = [
  { key: "niche", label: "Niche", hint: "Very specific to your topic. Smaller, targeted audiences." },
  { key: "medium", label: "Medium", hint: "Related topics with a decent audience." },
  { key: "broad", label: "Broad", hint: "General, widely used tags." },
  { key: "community", label: "Community", hint: "Tags people and creators in this space use, plus ideas for your own branded tag." },
] as const
export type GroupKey = (typeof GROUP_META)[number]["key"]
export type HashtagGroups = Record<GroupKey, string[]>

/** Clean, dedupe across groups (first group wins) and cap each group at 10. Throws if too little is left. */
export function validateGroups(data: unknown): HashtagGroups {
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>
  const seen = new Set<string>()
  const out = {} as HashtagGroups
  for (const { key } of GROUP_META) {
    const list: string[] = []
    for (const v of Array.isArray(obj[key]) ? (obj[key] as unknown[]) : []) {
      const t = cleanTag(v)
      if (t && !seen.has(t)) { seen.add(t); list.push(t) }
      if (list.length === 10) break
    }
    out[key] = list
  }
  const total = GROUP_META.reduce((n, g) => n + out[g.key].length, 0)
  if (total < 12 || out.niche.length < 3 || out.medium.length < 3) throw new Error("too few usable hashtags")
  return out
}

/** A balanced starting set: 2 niche, 2 medium, 1 broad, up to `limit`. */
export function smartPick(groups: HashtagGroups, limit = HASHTAG_LIMIT): string[] {
  const order: GroupKey[] = ["niche", "medium", "broad", "niche", "medium", "community", "broad"]
  const idx: Record<GroupKey, number> = { niche: 0, medium: 0, broad: 0, community: 0 }
  const picked: string[] = []
  for (const k of order) {
    if (picked.length >= limit) break
    const t = groups[k][idx[k]++]
    if (t && !picked.includes(t)) picked.push(t)
  }
  return picked
}
