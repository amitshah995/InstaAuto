import { AiReportSchema, PartASchema, PartBSchema, checkGrounding, type AiReport } from "./schema"
import { buildRetryMessage, buildUserMessage, SYSTEM_PROMPT } from "./prompt"
import type { AiBrief, Facts } from "./facts"

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<any>; text: () => Promise<string> }>

export interface GenerateOptions {
  apiKey: string
  model?: string
  fetchImpl?: FetchLike
  timeoutMs?: number
}
export interface GenerateResult { report: AiReport; attempts: number; usage: { input: number; output: number } }

export class AiReportError extends Error {
  constructor(message: string, public readonly kind: "api" | "invalid" | "timeout" = "api") { super(message) }
}

/** Pull the first balanced {...} out of the text, so stray prose or code fences don't break parsing. */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{")
  if (start < 0) throw new Error("no JSON object found")
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue }
    if (c === '"') inStr = true
    else if (c === "{") depth++
    else if (c === "}" && --depth === 0) return JSON.parse(text.slice(start, i + 1))
  }
  throw new Error("JSON object is incomplete")
}

type Usage = { input: number; output: number }

async function runPart(part: "A" | "B", facts: Facts, brief: AiBrief, opts: GenerateOptions, usage: Usage): Promise<{ data: any; attempts: number }> {
  const f: FetchLike = opts.fetchImpl ?? ((u, i) => fetch(u, i as RequestInit) as any)
  const model = opts.model || process.env.AI_REPORT_MODEL || "claude-sonnet-5-5"
  const schema = part === "A" ? PartASchema : PartBSchema
  const messages: { role: "user" | "assistant"; content: string }[] = [{ role: "user", content: buildUserMessage(facts, brief, part) }]

  for (let attempt = 1; attempt <= 2; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 55_000)
    let res
    try {
      res = await f("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 8000, system: SYSTEM_PROMPT, messages }),
        signal: ctrl.signal,
      })
    } catch (e: any) {
      throw new AiReportError(e?.name === "AbortError" ? "AI request timed out" : "AI request failed", e?.name === "AbortError" ? "timeout" : "api")
    } finally { clearTimeout(timer) }

    if (!res.ok) {
      let detail = ""
      try { detail = String(((await res.json()) as any)?.error?.message ?? "").slice(0, 200) } catch {}
      throw new AiReportError(`AI provider returned ${res.status}${detail ? `: ${detail}` : ""}`, "api")
    }
    const data = await res.json()
    usage.input += data?.usage?.input_tokens ?? 0
    usage.output += data?.usage?.output_tokens ?? 0
    if (data?.stop_reason === "max_tokens") console.error("[ai-report] output hit max_tokens, part", part)
    const text: string = (data?.content ?? []).filter((b: any) => b?.type === "text").map((b: any) => b.text).join("")

    let problems: string[] = []
    try {
      const parsed = schema.safeParse(extractJson(text))
      if (parsed.success) {
        problems = checkGrounding(parsed.data as Partial<AiReport>, facts, brief.postsPerWeek)
        if (!problems.length) return { data: parsed.data, attempts: attempt }
      } else {
        problems = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      }
    } catch (e: any) {
      problems = [`output was not valid JSON (${e?.message ?? "parse error"})`]
    }
    if (attempt === 2) throw new AiReportError(`AI output failed validation (part ${part}): ` + problems.join("; "), "invalid")
    messages.push({ role: "assistant", content: text }, { role: "user", content: buildRetryMessage(problems) })
  }
  throw new AiReportError("unreachable", "invalid")
}

/** Writes the two halves of the report in parallel (about half the wall-clock time of one long answer). */
export async function generateAiReport(facts: Facts, brief: AiBrief, opts: GenerateOptions): Promise<GenerateResult> {
  const usage: Usage = { input: 0, output: 0 }
  const [a, b] = await Promise.all([runPart("A", facts, brief, opts, usage), runPart("B", facts, brief, opts, usage)])
  const merged = AiReportSchema.parse({ ...a.data, ...b.data })
  return { report: merged, attempts: Math.max(a.attempts, b.attempts), usage }
}
