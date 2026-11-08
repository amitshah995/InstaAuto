/**
 * Optional synonym groups for keyword triggers (Hinglish and common spelling variants).
 *
 * Who reads this: lib/matching/keywords.ts when aliases are switched on (KEYWORD_ALIASES=1).
 * Why: people write "kitna", "rate" or "daam" instead of "price". When a rule's keyword is one
 * member of a group, any other member also triggers it. EDIT THIS LIST to suit your audience.
 * Entries are compared after normalisation (lowercase, Unicode-folded), and may be several words
 * or another script (Devanagari). Off by default so existing rules behave exactly as before.
 */
export const ALIAS_GROUPS: string[][] = [
  ["price", "rate", "cost", "pricing", "kitna", "kitne", "daam", "dam", "kimat", "कीमत", "दाम", "कितना"],
  ["link", "lnk", "linkk", "लिंक"],
  ["info", "details", "detail", "jankari", "जानकारी"],
  ["buy", "order", "kharidna", "kharidni", "खरीदना"],
  ["free", "muft", "मुफ्त", "फ्री"],
]
