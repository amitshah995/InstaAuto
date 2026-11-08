import type { AutomationTemplate } from "@/lib/automation-templates"
import type { Finding } from "./types"

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Connects the free Instagram Audit to the automation builder. An audit finding such as
 * "Posts rarely ask people to take an action" gets 4 one-tap "recipes" (Link / Price / Guide / Booking).
 * A recipe never creates anything by itself: it opens the normal create-rule form PRE-FILLED, and the
 * owner must still pick the post and replace the [bracketed] parts before the rule can go live.
 *
 * Pure data + pure functions. No I/O, safe to import from both client and server code.
 *
 * COPY RULES (agreed by the product team): no invented numbers, no result promises, no fake urgency,
 * every DM says it is an automatic reply, no claim about how long the messaging window is.
 */

export type Lang = "en" | "hi"
export type RecipeId = "link" | "price" | "guide" | "booking"

/** Stable ids of every finding score.ts can produce (same issue = same id in every report). */
export const FINDING_KEYS = [
  "bio_empty", "bio_short", "no_profile_link", "bio_no_cta",
  "no_posts_30d", "low_frequency",
  "engagement_very_low", "engagement_low",
  "almost_no_reels", "single_format",
  "captions_short", "few_hashtags",
  "posts_rarely_cta", "comments_unconverted",
] as const
export type FindingKey = (typeof FINDING_KEYS)[number]

/**
 * Reports saved BEFORE stable ids existed carry positional ids ("lead_capture-3").
 * Their titles never changed, so we map title -> key to keep old reports working.
 */
const TITLE_TO_KEY: Record<string, FindingKey> = {
  "Your bio is empty": "bio_empty",
  "Your bio is very short": "bio_short",
  "No link in your profile": "no_profile_link",
  "Your bio has no call to action": "bio_no_cta",
  "No posts in the last 30 days": "no_posts_30d",
  "Posting frequency is low": "low_frequency",
  "Engagement is well below target for your size": "engagement_very_low",
  "Engagement is slightly under target": "engagement_low",
  "Almost no Reels": "almost_no_reels",
  "You only use one content format": "single_format",
  "Captions are too short": "captions_short",
  "Few or no hashtags": "few_hashtags",
  "Posts rarely ask people to take an action": "posts_rarely_cta",
  "Comments are likely going unconverted": "comments_unconverted",
}

/** Which findings get recipe chips: only where an automation is genuinely the fix. */
export const RECIPE_FINDINGS: Partial<Record<FindingKey, RecipeId[]>> = {
  posts_rarely_cta: ["link", "price", "guide", "booking"],
  comments_unconverted: ["link", "price", "guide", "booking"],
  no_profile_link: ["link", "price", "guide", "booking"],
}

interface Recipe {
  label: Record<Lang, string>
  /** English keywords always apply; Hinglish ones are ADDED when the owner picks Hinglish. */
  keywords: { en: string[]; hi: string[] }
  /** Single text DM. [Brackets] are placeholders the owner must replace (the form blocks "Next" until they do). */
  dm: Record<Lang, string>
  /** Line the owner can paste into the post caption so followers know what to comment. */
  captionLine: Record<Lang, string>
}

// Keywords: 3+ letters, everyday words, no generic ones (call/send/free/yes) that would fire on normal chatter.
export const RECIPES: Record<RecipeId, Recipe> = {
  link: {
    label: { en: "Link", hi: "Link" },
    keywords: { en: ["link", "links"], hi: ["link do", "link bhejo", "link chahiye"] },
    dm: {
      en: "Hi! Here's the link you asked for: [your link]. This is an automatic reply from [your brand]. Reply here if anything is unclear.",
      hi: "Hi! Ye raha aapka link: [your link]. Ye [your brand] ka automatic reply hai. Kuch samajh na aaye to yahin puchh lo.",
    },
    captionLine: { en: "Comment “link” and I'll send it to your DMs.", hi: "“link” comment karo, main DM mein bhej dunga." },
  },
  price: {
    label: { en: "Price", hi: "Price" },
    keywords: { en: ["price", "pricing", "cost"], hi: ["kitna", "kitne ka", "kimat", "daam"] },
    dm: {
      en: "Hi! Thanks for asking. [Product] starts at Rs [your price]. Reply here for size, colour or delivery and we'll answer personally. (Automatic reply from [your brand])",
      hi: "Hi! Poochne ke liye thanks. [Product] Rs [your price] se shuru hota hai. Size, colour ya delivery ke liye yahin reply karo, hum khud jawab denge. ([your brand] ka automatic reply)",
    },
    captionLine: { en: "Comment “price” and we'll DM you the details.", hi: "“price” comment karo, details DM mein bhej denge." },
  },
  guide: {
    label: { en: "Guide", hi: "Guide" },
    keywords: { en: ["guide", "checklist", "pdf"], hi: ["guide chahiye", "pdf bhejo"] },
    dm: {
      en: "Hi! Here's the [guide name]: [your link]. This is an automatic reply from [your brand]. Reply here if you have a question.",
      hi: "Hi! Ye raha [guide name]: [your link]. Ye [your brand] ka automatic reply hai. Koi sawal ho to yahin reply karo.",
    },
    captionLine: { en: "Comment “guide” and I'll DM it to you.", hi: "“guide” comment karo, main DM kar dunga." },
  },
  booking: {
    label: { en: "Booking", hi: "Booking" },
    keywords: { en: ["book", "booking", "appointment"], hi: ["slot chahiye", "booking karna"] },
    dm: {
      en: "Hi! You can book here: [booking or WhatsApp link]. You can also reply with the date and time you prefer and we'll get back to you. (Automatic reply from [your brand])",
      hi: "Hi! Booking yahan karein: [booking or WhatsApp link]. Aap apni pasand ki date aur time yahin reply bhi kar sakte ho, hum wapas batayenge. ([your brand] ka automatic reply)",
    },
    captionLine: { en: "Comment “book” and I'll DM you the booking link.", hi: "“book” comment karo, booking link DM mein milega." },
  },
}

export const isRecipeId = (v: unknown): v is RecipeId => typeof v === "string" && v in RECIPES
export const isLang = (v: unknown): v is Lang => v === "en" || v === "hi"

/** Stable key of a finding (new reports: its id; old reports: via title). null = unknown, so no chips. */
export function keyOf(f: Pick<Finding, "id" | "title">): FindingKey | null {
  if ((FINDING_KEYS as readonly string[]).includes(f.id)) return f.id as FindingKey
  return TITLE_TO_KEY[f.title] ?? null
}

export const recipesFor = (f: Pick<Finding, "id" | "title">): RecipeId[] => {
  const k = keyOf(f)
  return (k && RECIPE_FINDINGS[k]) || []
}

/** Link the audit page uses for a chip. Opens the dashboard create form pre-filled; creates nothing. */
export const recipeHref = (id: RecipeId, lang: Lang) => `/dashboard/automations?recipe=${id}&lang=${lang}`

/** Builds a normal AutomationTemplate so the existing create form needs no new template format. */
export function recipeToTemplate(id: RecipeId, lang: Lang): AutomationTemplate {
  const r = RECIPES[id]
  const triggers = lang === "hi" ? [...r.keywords.en, ...r.keywords.hi] : [...r.keywords.en]
  return {
    id: `audit-${id}`, // the "audit-" prefix switches the form into strict mode
    title: `Audit: ${r.label[lang]} → DM`,
    description: "Suggested from your Instagram audit.",
    triggerSource: "comment",
    goal: "Capture leads",
    kind: "quick",
    defaults: {
      triggers,
      type: "text",
      messageText: r.dm[lang],
      name: `Audit: ${r.label[lang]} → DM`,
    },
  }
}

/** Placeholder check used by the form's strict mode (anything still in [brackets]). */
export const hasPlaceholders = (text: string) => /\[[^\]]+\]/.test(text)
