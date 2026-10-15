export type CheckState = "good" | "warn" | "bad"
export interface Check { id: string; label: string; detail: string; state: CheckState }

export const PREVIEW_CHARS = 125
export const CAPTION_LIMIT = 2200
const CTA_RE = /\b(dm|comment|link in bio|whatsapp|book|order|shop|buy|call|contact|sign ?up|subscribe|swipe|tag a friend|save this|share|follow|click|tap|join|get)\b/i
const URL_RE = /(https?:\/\/|www\.)\S+/gi
const EMOJI_RE = /\p{Extended_Pictographic}/gu

// ---------------------------------------------------------------- caption
export function checkCaption(text: string) {
  const length = [...text].length
  const preview = [...text].slice(0, PREVIEW_CHARS).join("")
  const hidden = length > PREVIEW_CHARS ? [...text].slice(PREVIEW_CHARS).join("") : ""
  const firstLine = text.split("\n").find((l) => l.trim()) ?? ""
  const hashtags = Array.from(new Set((text.match(/#[\p{L}\p{N}_]+/gu) || []).map((t) => t.toLowerCase())))
  const urls = text.match(URL_RE) || []
  const emojis = (text.match(EMOJI_RE) || []).length
  const letters = (text.match(/\p{L}/gu) || []).length
  const caps = (text.match(/\p{Lu}/gu) || []).length
  const capsPct = letters > 0 ? Math.round((caps / letters) * 100) : 0
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length
  const checks: Check[] = []
  const add = (id: string, label: string, state: CheckState, detail: string) => checks.push({ id, label, state, detail })
  if (!text.trim()) return { length, preview, hidden, firstLine, hashtags, urls, emojis, capsPct, paragraphs, checks, passed: 0, total: 0 }

  const fl = [...firstLine].length
  if (fl <= PREVIEW_CHARS) add("hook", "Opening line", "good", `Your first line is ${fl} characters, so it shows in full before "more".`)
  else add("hook", "Opening line", "warn", `Your first line is ${fl} characters. Only the first ~${PREVIEW_CHARS} show before "more", so put the hook first.`)

  if (length > CAPTION_LIMIT) add("length", "Length", "bad", `${length} characters. Instagram allows ${CAPTION_LIMIT}.`)
  else if (length < 50) add("length", "Length", "warn", `Short caption (${length} characters). Add context or value.`)
  else if (length > 2000) add("length", "Length", "warn", `${length} of ${CAPTION_LIMIT} characters. Close to the limit.`)
  else add("length", "Length", "good", `${length} characters.`)

  if (hashtags.length === 0) add("hashtags", "Hashtags", "warn", "No hashtags. Add a few relevant ones.")
  else if (hashtags.length > 15) add("hashtags", "Hashtags", "warn", `${hashtags.length} hashtags is a lot. A smaller, relevant set usually reads better. Check Instagram's current guidance.`)
  else add("hashtags", "Hashtags", "good", `${hashtags.length} hashtag${hashtags.length === 1 ? "" : "s"}.`)

  if (CTA_RE.test(text)) add("cta", "Call to action", "good", "Your caption tells people what to do next.")
  else add("cta", "Call to action", "warn", 'No clear next step. Try "Comment LINK and we will DM you the details".')

  if (urls.length) add("links", "Links", "warn", "Links in captions are not clickable. Send people to your bio link or a DM instead.")
  else add("links", "Links", "good", "No dead links in the caption.")

  if (length > 300 && paragraphs < 2) add("readability", "Readability", "warn", "Long text in one block. Break it into short paragraphs.")
  else add("readability", "Readability", "good", paragraphs > 1 ? `${paragraphs} paragraphs, easy to scan.` : "Short enough to scan.")

  if (capsPct > 40 && letters > 20) add("caps", "Capital letters", "warn", `${capsPct}% of letters are capitals. It can read as shouting.`)
  if (emojis > 8) add("emoji", "Emoji", "warn", `${emojis} emoji. Fewer reads cleaner.`)
  if (/\?/.test(text)) add("question", "Question", "good", "A question invites comments.")

  const passed = checks.filter((c) => c.state === "good").length
  return { length, preview, hidden, firstLine, hashtags, urls, emojis, capsPct, paragraphs, checks, passed, total: checks.length }
}

// ---------------------------------------------------------------- hook
export const HOOK_FORMULAS: { id: string; name: string; re: RegExp; template: string }[] = [
  { id: "stop", name: "Stop / do not", re: /\b(stop|don'?t|never|quit)\b/i, template: "Stop {topic} like this" },
  { id: "number", name: "Number or list", re: /\b\d+\s+(ways|tips|mistakes|things|reasons|steps|hacks|rules)\b|\b(top|best)\s+\d+\b/i, template: "3 {topic} mistakes that cost you followers" },
  { id: "story", name: "I tried / story", re: /\b(i tried|i tested|i did|i spent|i made|i quit)\b/i, template: "I tried {topic} for 30 days. Here is what happened" },
  { id: "secret", name: "Nobody tells you", re: /\b(nobody|no one|secret|they don'?t tell|truth about|hidden)\b/i, template: "Nobody tells you this about {topic}" },
  { id: "audience", name: "Call out the viewer", re: /\b(if you'?re|if you are|for (anyone|creators|owners|beginners)|you need)\b/i, template: "If you struggle with {topic}, watch this" },
  { id: "howto", name: "How to", re: /\bhow to\b|\bhow i\b/i, template: "How to {topic} in 30 seconds" },
  { id: "pov", name: "POV", re: /^\s*pov\b/i, template: "POV: you finally figured out {topic}" },
  { id: "result", name: "Result in a time", re: /\b(in|within)\s+\d+\s*(seconds?|minutes?|days?|weeks?|hours?)\b/i, template: "Get {topic} done in 7 days" },
  { id: "mistake", name: "Mistake / wrong", re: /\b(mistake|wrong|myth|lie|stupid|worst)\b/i, template: "The biggest {topic} mistake I see every day" },
  { id: "contrast", name: "Before and after", re: /\b(before|after|vs\.?|versus|instead of)\b/i, template: "{topic}: what I did before vs what works now" },
  { id: "free", name: "Free / guide offer", re: /\b(free|guide|checklist|template|cheat ?sheet)\b/i, template: "Free {topic} checklist (comment GUIDE)" },
]
const FILLER_RE = /^\s*(hey+|hi+|hello|what'?s up|welcome( back)?|so,?|um+|okay,?|ok,?|today (i|we)|in this (video|reel))\b/i

export function checkHook(hook: string, topic = "") {
  const text = hook.trim()
  const words = text ? text.split(/\s+/).length : 0
  const checks: Check[] = []
  const add = (id: string, label: string, state: CheckState, detail: string) => checks.push({ id, label, state, detail })
  const formulas = text ? HOOK_FORMULAS.filter((f) => f.re.test(text)) : []
  if (text) {
    if (words <= 12) add("len", "Length", "good", `${words} words, quick to read or hear in about three seconds.`)
    else if (words <= 18) add("len", "Length", "warn", `${words} words. Try to cut to 12 or fewer.`)
    else add("len", "Length", "bad", `${words} words is too long for an opening line.`)

    if (FILLER_RE.test(text)) add("filler", "Opening words", "bad", 'Starts with filler such as "hey guys" or "in this video". Start with the point.')
    else add("filler", "Opening words", "good", "Gets to the point right away.")

    if (/\b(you|your|you'?re|you'?ll)\b/i.test(text)) add("you", "Speaks to the viewer", "good", 'Uses "you", which makes it personal.')
    else add("you", "Speaks to the viewer", "warn", 'Add "you" or "your" so viewers feel it is for them.')

    if (/\d/.test(text)) add("number", "Specific detail", "good", "Contains a number, which makes it concrete.")
    else add("number", "Specific detail", "warn", "No number or concrete detail. Specifics earn trust.")

    if (formulas.length) add("formula", "Proven structure", "good", `Matches: ${formulas.map((f) => f.name).join(", ")}.`)
    else add("formula", "Proven structure", "warn", "Does not follow a common hook structure. See the ideas below.")

    if (/\?/.test(text) || /\b(why|how|what|secret|truth|mistake)\b/i.test(text)) add("curiosity", "Curiosity", "good", "Opens a question the viewer wants answered.")
    else add("curiosity", "Curiosity", "warn", "Make the viewer want the answer: ask a question or hint at a result.")
  }
  const t = topic.trim() || "your topic"
  const missing = HOOK_FORMULAS.filter((f) => !formulas.includes(f)).slice(0, 6)
  const ideas = missing.map((f) => ({ name: f.name, text: f.template.replace("{topic}", t) }))
  return { words, checks, formulas, ideas, passed: checks.filter((c) => c.state === "good").length, total: checks.length }
}

// ---------------------------------------------------------------- beat sheet
export type Goal = "sell" | "educate" | "entertain"
export interface Beat { range: string; name: string; say: string; onScreen: string }
export function beatSheet(i: { topic: string; seconds: number; goal: Goal; keyword: string }): Beat[] {
  const topic = i.topic.trim() || "your topic"
  const kw = (i.keyword.trim() || "LINK").toUpperCase().replace(/\s+/g, "")
  const total = Math.max(10, i.seconds)
  const ctaLen = total >= 45 ? 5 : 3
  const points = total >= 45 ? 3 : total >= 25 ? 2 : 1
  const hookEnd = 3
  const setupEnd = hookEnd + Math.round(total * 0.15)
  const proofLen = total >= 30 ? Math.round(total * 0.12) : 0
  const valueStart = setupEnd
  const valueEnd = total - ctaLen - proofLen
  const slice = (valueEnd - valueStart) / points
  const fmt = (a: number, b: number) => `${Math.round(a)}-${Math.round(b)}s`
  const beats: Beat[] = [
    { range: fmt(0, hookEnd), name: "Hook", say: `Say the biggest promise or problem about ${topic} in one line.`, onScreen: "Short bold text with the same line" },
    { range: fmt(hookEnd, setupEnd), name: "Problem", say: `Show why ${topic} matters to the viewer and what goes wrong without it.`, onScreen: "One line naming the problem" },
  ]
  for (let p = 0; p < points; p++) {
    beats.push({
      range: fmt(valueStart + p * slice, valueStart + (p + 1) * slice),
      name: points > 1 ? `Value ${p + 1}` : "Value",
      say: `Give one clear, useful point about ${topic}${p === 0 ? " (your strongest first)" : ""}.`,
      onScreen: p === 0 ? "Point title, then demo or example" : "Next point title",
    })
  }
  if (proofLen) beats.push({ range: fmt(valueEnd, valueEnd + proofLen), name: "Proof", say: "Show a result, a number, a screenshot or a customer example.", onScreen: "The number or result, large" })
  const cta =
    i.goal === "sell" ? `Comment ${kw} and I will DM you the details.`
    : i.goal === "educate" ? `Comment ${kw} and I will DM you the full guide. Save this for later.`
    : `Follow for part 2, and comment ${kw} if you want it.`
  beats.push({ range: fmt(total - ctaLen, total), name: "Call to action", say: cta, onScreen: `Comment "${kw}"` })
  return beats
}

// ---------------------------------------------------------------- fancy fonts
type Range = { upper: number; lower: number; digit?: number; exceptions?: Record<string, string> }
const MATH: Record<string, Range> = {
  "Bold": { upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7ce },
  "Italic": { upper: 0x1d434, lower: 0x1d44e, exceptions: { h: "ℎ" } },
  "Bold italic": { upper: 0x1d468, lower: 0x1d482 },
  "Script (bold)": { upper: 0x1d4d0, lower: 0x1d4ea },
  "Gothic (bold)": { upper: 0x1d56c, lower: 0x1d586 },
  "Double-struck": { upper: 0x1d538, lower: 0x1d552, digit: 0x1d7d8, exceptions: { C: "ℂ", H: "ℍ", N: "ℕ", P: "ℙ", Q: "ℚ", R: "ℝ", Z: "ℤ" } },
  "Sans bold": { upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec },
  "Sans italic": { upper: 0x1d608, lower: 0x1d622 },
  "Monospace": { upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 },
  "Fullwidth": { upper: 0xff21, lower: 0xff41, digit: 0xff10 },
}
const SMALL_CAPS = "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ"
function mapRange(text: string, r: Range): string {
  return [...text].map((ch) => {
    if (r.exceptions?.[ch]) return r.exceptions[ch]
    const c = ch.codePointAt(0)!
    if (c >= 65 && c <= 90) return String.fromCodePoint(r.upper + c - 65)
    if (c >= 97 && c <= 122) return String.fromCodePoint(r.lower + c - 97)
    if (r.digit !== undefined && c >= 48 && c <= 57) return String.fromCodePoint(r.digit + c - 48)
    return ch
  }).join("")
}
function circled(text: string): string {
  return [...text].map((ch) => {
    const c = ch.codePointAt(0)!
    if (c >= 65 && c <= 90) return String.fromCodePoint(0x24b6 + c - 65)
    if (c >= 97 && c <= 122) return String.fromCodePoint(0x24d0 + c - 97)
    if (c >= 49 && c <= 57) return String.fromCodePoint(0x2460 + c - 49)
    if (c === 48) return "⓪"
    return ch
  }).join("")
}
export function fancyFonts(text: string): { name: string; out: string }[] {
  const out = Object.entries(MATH).map(([name, r]) => ({ name, out: mapRange(text, r) }))
  out.push({ name: "Circled", out: circled(text) })
  out.push({ name: "Small caps", out: [...text].map((ch) => { const c = ch.toLowerCase().charCodeAt(0); return c >= 97 && c <= 122 ? SMALL_CAPS[c - 97] : ch }).join("") })
  out.push({ name: "Underline", out: [...text].map((ch) => (ch.trim() ? ch + "̲" : ch)).join("") })
  out.push({ name: "Strikethrough", out: [...text].map((ch) => (ch.trim() ? ch + "̶" : ch)).join("") })
  return out
}

// ---------------------------------------------------------------- caption formatter
export const SPACER = "⠀" // braille blank: invisible, and not trimmed like a normal space
export function formatCaption(text: string, opts: { bullets: boolean; collapse: boolean }): string {
  let lines = text.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/[ \t]+$/g, ""))
  if (opts.bullets) lines = lines.map((l) => l.replace(/^(\s*)[-*]\s+/, "$1• "))
  const out: string[] = []
  let blanks = 0
  for (const l of lines) {
    if (l.trim() === "" || l === SPACER) {
      blanks++
      if (opts.collapse && blanks > 1) continue
      out.push(SPACER)
    } else { blanks = 0; out.push(l) }
  }
  while (out.length && out[0] === SPACER) out.shift()
  while (out.length && out[out.length - 1] === SPACER) out.pop()
  return out.join("\n")
}

// ---------------------------------------------------------------- carousel splitter
export function splitCarousel(text: string, max: number): string[] {
  const limit = Math.max(40, Math.floor(max))
  const paras = text.replace(/\r\n?/g, "\n").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const units: string[] = []
  for (const p of paras) {
    if ([...p].length <= limit) { units.push(p); continue }
    const sentences = p.match(/[^.!?\n]+[.!?]+["')\]]*\s*|[^.!?\n]+$/g) || [p]
    for (const s of sentences.map((x) => x.trim()).filter(Boolean)) {
      if ([...s].length <= limit) { units.push(s); continue }
      let cur = ""
      for (const w of s.split(/\s+/)) {
        if (!cur) cur = w
        else if ([...cur].length + 1 + [...w].length <= limit) cur += " " + w
        else { units.push(cur); cur = w }
      }
      if (cur) units.push(cur)
    }
  }
  const slides: string[] = []
  let cur = ""
  for (const u of units) {
    if (!cur) cur = u
    else if ([...cur].length + 2 + [...u].length <= limit) cur += "\n\n" + u
    else { slides.push(cur); cur = u }
  }
  if (cur) slides.push(cur)
  return slides
}

// ---------------------------------------------------------------- giveaway
export function parseEntries(raw: string): string[] {
  return raw.split(/[\n,;]+/).map((s) => s.trim().replace(/^@/, "")).filter(Boolean)
}
export function secureInt(maxExclusive: number, rand?: () => number): number {
  if (rand) return Math.floor(rand() * maxExclusive)
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive
  do { crypto.getRandomValues(buf) } while (buf[0] >= limit)
  return buf[0] % maxExclusive
}
export function pickWinners(i: { entries: string[]; winners: number; backups: number; dedupe: boolean; exclude: string[] }, rand?: () => number) {
  const ex = new Set(i.exclude.map((s) => s.toLowerCase()))
  const seen = new Set<string>()
  let pool: string[] = []
  for (const e of i.entries) {
    const k = e.toLowerCase()
    if (ex.has(k)) continue
    if (i.dedupe) { if (seen.has(k)) continue; seen.add(k) }
    pool.push(e)
  }
  const poolSize = pool.length
  const picked: string[] = []
  // Without de-duplication, extra entries for the same person raise their odds, but nobody can win twice.
  const unique = new Set(pool.map((x) => x.toLowerCase())).size
  const want = Math.min(unique, Math.max(0, i.winners) + Math.max(0, i.backups))
  for (let n = 0; n < want && pool.length > 0; n++) {
    const idx = secureInt(pool.length, rand)
    const chosen = pool[idx]
    picked.push(chosen)
    pool = pool.filter((x) => x.toLowerCase() !== chosen.toLowerCase())
  }
  return { poolSize, winners: picked.slice(0, Math.max(0, i.winners)), backups: picked.slice(Math.max(0, i.winners)) }
}
