/**
 * Keyword helpers for the fallback search and for building the retrieval query. Pure, no I/O.
 *
 * Who calls this: lib/agent/rag/retrieve.ts (when there is no embedding key, the embedding call fails, or no vector matched).
 * Why: people write in English, Hindi and Hinglish ("kitna?", "fees kya hai", "kab start hoga"). We lowercase, split on
 * anything that is not a letter or digit (Unicode, so Devanagari survives), drop filler words in all three styles, trim common
 * English endings and expand a few high-value intents (price, timing, place, duration) so "kitna?" finds a chunk that says "fees".
 * Terms are letters and digits only, so they are safe to put into a Postgres tsquery.
 */

const STOP = new Set([
  "a", "an", "the", "and", "or", "but", "of", "to", "for", "in", "on", "at", "by", "with", "from", "as", "is", "are", "was", "were", "be", "been",
  "do", "does", "did", "can", "could", "will", "would", "should", "may", "might", "have", "has", "had", "what", "which", "who", "when", "where",
  "why", "how", "any", "some", "there", "here", "this", "that", "these", "those", "it", "its", "i", "me", "my", "we", "our", "you", "your",
  "about", "into", "than", "then", "also", "just", "tell", "please", "pls", "plz", "kindly", "want", "need", "know", "get", "give", "say",
  // Hinglish filler
  "kya", "hai", "hain", "hoga", "hogi", "hota", "ka", "ki", "ke", "ko", "me", "mein", "main", "se", "ye", "yeh", "wo", "woh", "aur", "bhi", "to", "toh",
  "nahi", "nahin", "mujhe", "aap", "apka", "aapka", "hum", "tum", "bhai", "sir", "mam", "madam", "ji", "haan", "han", "ok", "okay", "batao", "bataiye", "bata",
  // Devanagari filler
  "क्या", "है", "हैं", "का", "की", "के", "को", "में", "से", "और", "भी", "तो", "यह", "ये", "वो", "मुझे", "आप", "जी",
])

/** Intent groups: any word in a group also searches for the others. */
const GROUPS: string[][] = [
  ["price", "cost", "fees", "fee", "charges", "charge", "rate", "rates", "pricing", "paisa", "paise", "rupees", "rs", "kitna", "kitni", "kitne", "कितना", "कितनी", "कीमत", "फीस", "दाम", "रेट"],
  ["when", "timing", "timings", "schedule", "date", "dates", "time", "start", "kab", "कब", "samay", "तारीख"],
  ["where", "location", "address", "place", "venue", "kahan", "kaha", "कहाँ", "कहां", "पता"],
  ["duration", "long", "minutes", "hours", "kitni der", "der", "अवधि"],
  ["discount", "offer", "offers", "deal", "off", "discounts", "छूट", "ऑफर"],
  ["book", "booking", "appointment", "register", "registration", "slot", "बुकिंग"],
  ["refund", "cancel", "cancellation", "return", "वापसी"],
]
const GROUP_OF = new Map<string, string[]>()
for (const g of GROUPS) for (const w of g) if (!w.includes(" ")) GROUP_OF.set(w, g.filter((x) => !x.includes(" ")))

/** Strips a common English ending so "charges/charged" and "surgeries" meet their root. Left alone for non-Latin words. */
function trim(word: string): string {
  if (!/^[a-z0-9]+$/.test(word) || word.length <= 5) return word
  for (const end of ["ing", "ies", "ed", "es", "s"]) {
    if (word.endsWith(end) && word.length - end.length >= 4) return end === "ies" ? `${word.slice(0, -3)}y` : word.slice(0, -end.length)
  }
  return word
}

/** Lowercase tokens: letters (any script), marks and digits only, at least 2 characters. */
export function tokenize(text: string): string[] {
  return String(text ?? "").toLowerCase().normalize("NFC").split(/[^\p{L}\p{M}\p{N}]+/u).filter((t) => Array.from(t).length >= 2)
}

/**
 * The words worth searching for: tokens without filler, trimmed, plus the other words of any intent group they belong to.
 * At most `max` terms, longest first. Returns [] when the text has nothing searchable.
 */
export function extractSearchTerms(query: string, max = 12): string[] {
  const seen = new Set<string>()
  const base: { t: string; word: string }[] = []
  for (const word of tokenize(query)) {
    if (STOP.has(word)) continue
    const t = trim(word)
    if (seen.has(t)) continue
    seen.add(t)
    base.push({ t, word })
  }
  const out = base.map((b) => b.t)
  for (const { t, word } of base) {
    // Group lookup uses the word as typed (before ending-trimming), e.g. "charges".
    for (const g of GROUP_OF.get(word) ?? GROUP_OF.get(t) ?? []) if (!seen.has(g)) { seen.add(g); out.push(g) }
  }
  return out.sort((a, b) => Array.from(b).length - Array.from(a).length).slice(0, max)
}

/** How many of the terms appear in the text (substring match, so "fee" is found inside "fees"). */
export function termHits(text: string, terms: string[]): number {
  const lower = String(text ?? "").toLowerCase()
  let n = 0
  for (const t of terms) if (lower.includes(t)) n++
  return n
}

/** Postgres tsquery text: prefix-matched terms joined with OR. Terms are letters/digits only, so this cannot inject operators. */
export function toTsQuery(terms: string[]): string {
  return terms.filter((t) => /^[\p{L}\p{M}\p{N}]+$/u.test(t)).map((t) => `${t}:*`).join(" | ")
}

/** Short follow-ups ("kitna?", "and the price?") are searched together with the assistant's last question. */
export const SHORT_QUERY_WORDS = 4

/**
 * Query for this turn: the person's message, plus (when the message is very short) the last thing the assistant said, so
 * "kitna?" after "Do you want the hair PRP details?" searches for hair PRP price. History is our own text, capped.
 */
export function buildRetrievalQuery(userText: string, history: { role: "user" | "assistant"; text: string }[]): string {
  const base = String(userText ?? "").trim().slice(0, 500)
  const words = tokenize(base).length
  if (words > SHORT_QUERY_WORDS) return base
  const lastAssistant = [...history].reverse().find((h) => h.role === "assistant")?.text ?? ""
  const lastUser = [...history].reverse().find((h) => h.role === "user")?.text ?? ""
  const context = `${lastUser.slice(0, 200)} ${lastAssistant.slice(0, 200)}`.trim()
  return context ? `${base} ${context}`.trim() : base
}
