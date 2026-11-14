/**
 * Plain text from an HTML page. Pure, no I/O.
 *
 * Who calls this: lib/agent/rag/fetch-page.ts after downloading one web page for "Import a page".
 * Why: the agent should learn the page's content, not its scripts, menus or footers. Scripts, styles, navigation, headers,
 * footers, asides, forms, SVG and comments are removed before tags are stripped. The result is text only (no HTML survives),
 * so a hostile page cannot smuggle markup into a prompt.
 */

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: "-", mdash: "-", hellip: "...", copy: "(c)", rupee: "Rs" }

/** Decodes the common named entities and numeric ones (&#8377; &#x20B9;). Unknown entities are dropped. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code > 8 && code < 0x110000 && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : " "
    }
    return NAMED[e.toLowerCase()] ?? " "
  })
}

/** ASCII-only lowercase: unlike toLowerCase() it never changes the string length, so indexes stay valid. */
const asciiLower = (s: string) => s.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32))

/**
 * Removes every `open ... close` block in ONE linear pass. A regex like /<nav\b[\s\S]*?<\/nav>/g is quadratic on a page with
 * thousands of unclosed "<nav" (each attempt scans to the end): a 1.5 MB hostile page blocked the server for 10-30 seconds.
 * Here, once no closing marker exists after a position, none exists for any later opening either, so we stop.
 * `closeTag` true: close is "</tag" and the block ends at the next ">". `block` false: only the tag itself is removed.
 */
function stripBlocks(h: string, open: string, close: string, closeTag: boolean): string {
  const lower = asciiLower(h)
  const parts: string[] = []
  let pos = 0
  let from = 0
  for (;;) {
    const i = lower.indexOf(open, from)
    if (i < 0) break
    if (closeTag && /[a-z0-9_-]/.test(lower[i + open.length] ?? "")) { from = i + open.length; continue } // "<navigation" is not "<nav"
    const j = lower.indexOf(close, i + open.length)
    if (j < 0) break
    let end = j + close.length
    if (closeTag) { const gt = lower.indexOf(">", end); end = gt < 0 ? lower.length : gt + 1 }
    parts.push(h.slice(pos, i), " ")
    pos = end
    from = end
  }
  parts.push(h.slice(pos))
  return parts.join("")
}

/** Text of the first <title>...</title>, or "" (linear). */
function firstTitle(h: string): string {
  const lower = asciiLower(h)
  let i = lower.indexOf("<title")
  while (i >= 0 && /[a-z0-9_-]/.test(lower[i + 6] ?? "")) i = lower.indexOf("<title", i + 6)
  if (i < 0) return ""
  const gt = lower.indexOf(">", i)
  const end = gt < 0 ? -1 : lower.indexOf("</title", gt)
  return end < 0 ? "" : h.slice(gt + 1, end)
}

export function extractTextFromHtml(html: string, maxChars = 200_000): string {
  let h = String(html ?? "").slice(0, maxChars * 3)
  h = stripBlocks(h, "<!--", "-->", false)
  for (const tag of ["script", "style", "noscript", "nav", "header", "footer", "aside", "form", "svg", "iframe", "template", "select", "button"]) {
    h = stripBlocks(h, `<${tag}`, `</${tag}`, true)
  }
  const title = firstTitle(h)
  h = stripBlocks(h, "<title", "</title", true)
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|table|ul|ol|blockquote)\s*>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>?/g, " ")
  const body = decodeEntities(h)
    .replace(/[ \t ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  const t = title ? decodeEntities(title).replace(/\s+/g, " ").trim() : ""
  return (t ? `${t}\n\n${body}` : body).slice(0, maxChars)
}
