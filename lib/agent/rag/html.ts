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

export function extractTextFromHtml(html: string, maxChars = 200_000): string {
  let h = String(html ?? "").slice(0, maxChars * 3)
  h = h.replace(/<!--[\s\S]*?-->/g, " ")
  for (const tag of ["script", "style", "noscript", "nav", "header", "footer", "aside", "form", "svg", "iframe", "template", "select", "button"]) {
    h = h.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}\\s*>`, "gi"), " ")
  }
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(h)?.[1]
  h = h
    .replace(/<title[\s\S]*?<\/title>/gi, " ")
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
