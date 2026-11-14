/**
 * Text embeddings for the agent's knowledge search (OpenAI text-embedding-3-small, 1536 dimensions).
 *
 * Who calls this: lib/agent/rag/service.ts (ingest: one batched call per source; retrieve: one call per agent turn).
 * Why: mirrors AiSend's rag/embed.ts so both products search the same way. Embeddings are independent of the chat model
 * (Anthropic) because the vector column is a fixed 1536-dimension space.
 * Contract: a missing key or a failed call is NOT an error for the agent. Callers treat it as "no vector search right now"
 * and fall back to keyword search; ingest stores the chunk without a vector instead of losing it.
 * Privacy: chunk text and queries are sent to OpenAI. The key and the text are never logged (errors carry a status code only).
 */
export const EMBEDDING_MODEL = "text-embedding-3-small"
export const EMBEDDING_DIMENSIONS = 1536
/** OpenAI accepts up to 2048 inputs; we send small batches so one slow call cannot hold up a whole source. */
export const EMBED_BATCH_SIZE = 64
/** Per-input cap in characters (the model limit is 8191 tokens; Hindi needs more tokens per character, so stay well under). */
export const EMBED_MAX_CHARS = 6000
export const QUERY_TIMEOUT_MS = 4000
export const INGEST_TIMEOUT_MS = 20000

export interface EmbedDeps {
  fetchImpl?: typeof fetch
  apiKey?: string
  timeoutMs?: number
}

/** True when OPENAI_API_KEY is set on the server. Only this boolean ever reaches the browser. */
export function hasEmbeddingKey(apiKey: string | undefined = process.env.OPENAI_API_KEY): boolean {
  return typeof apiKey === "string" && apiKey.trim().length > 0
}

/** Error whose message never contains request text or the key. */
export class EmbedError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = "EmbedError"
    this.status = status
  }
}

/** A usable vector: exactly 1536 finite numbers. */
export function isValidVector(v: unknown): v is number[] {
  return Array.isArray(v) && v.length === EMBEDDING_DIMENSIONS && v.every((x) => typeof x === "number" && Number.isFinite(x))
}

/** pgvector text form: "[0.1,0.2,...]". */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`
}

/**
 * One embeddings request for up to EMBED_BATCH_SIZE texts. Results are sorted by the returned `index` so a provider-side
 * reorder cannot attach one chunk's vector to another chunk's text. Throws EmbedError on any problem.
 */
export async function embedBatch(texts: string[], deps: EmbedDeps = {}): Promise<number[][]> {
  if (texts.length === 0) return []
  if (texts.length > EMBED_BATCH_SIZE) throw new EmbedError(`Too many inputs in one batch (max ${EMBED_BATCH_SIZE})`)
  const key = deps.apiKey ?? process.env.OPENAI_API_KEY
  if (!hasEmbeddingKey(key)) throw new EmbedError("OPENAI_API_KEY is not set")
  const f = deps.fetchImpl ?? fetch
  const input = texts.map((t) => String(t ?? "").slice(0, EMBED_MAX_CHARS) || " ")
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs ?? INGEST_TIMEOUT_MS)
  try {
    const res = await f("https://api.openai.com/v1/embeddings", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
    })
    if (!res.ok) throw new EmbedError(`Embeddings API returned ${res.status}`, res.status)
    const json: any = await res.json()
    const items: { index: number; embedding: unknown }[] = Array.isArray(json?.data) ? json.data : []
    if (items.length !== input.length) throw new EmbedError("Embeddings API returned the wrong number of vectors")
    const sorted = [...items].sort((a, b) => a.index - b.index).map((i) => i.embedding)
    if (!sorted.every(isValidVector)) throw new EmbedError("Embeddings API returned an unexpected vector size")
    return sorted as number[][]
  } catch (e) {
    if (e instanceof EmbedError) throw e
    throw new EmbedError((e as Error)?.name === "AbortError" ? "Embeddings request timed out" : "Embeddings request failed")
  } finally {
    clearTimeout(timer)
  }
}

/** Query embedding for one agent turn: short timeout, returns null (never throws) so the caller falls back to keywords. */
export async function embedQuery(text: string, deps: EmbedDeps = {}): Promise<number[] | null> {
  if (!hasEmbeddingKey(deps.apiKey ?? process.env.OPENAI_API_KEY)) return null
  try {
    const [v] = await embedBatch([text], { ...deps, timeoutMs: deps.timeoutMs ?? QUERY_TIMEOUT_MS })
    return v ?? null
  } catch {
    return null
  }
}
