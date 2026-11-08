/**
 * Pure retry and error-classification logic for Instagram (Meta Graph) message sends.
 *
 * Who calls this: lib/messaging/send-steps.ts (inline retry while a webhook is being handled) and
 * lib/messaging/retry-failed.ts (the scheduler retrying stored failures).
 * Why it exists: Meta returns transient errors (rate limits, 5xx, network) that are worth retrying
 * and permanent ones (bad token, closed 24h window, blocked user) that must NEVER be retried
 * because retrying them can only waste calls or look like spam.
 *
 * No imports from the app on purpose, so it can be unit-tested with plain node.
 */

export interface MetaError {
  code?: number
  error_subcode?: number
  is_transient?: boolean
  message?: string
  type?: string
}

export type FailureReason =
  | "rate_limit"
  | "server"
  | "network"
  | "token"
  | "window"
  | "permission"
  | "invalid"
  | "spam"
  | "unavailable"
  | "unknown"

export interface Classification {
  kind: "transient" | "permanent"
  reason: FailureReason
}

// Meta codes that mean "slow down": 4 app limit, 17 user limit, 32 page limit, 613 custom limit,
// 80002 / 80006 Instagram messaging limits.
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80002, 80006])
// 1 = unknown error, 2 = service temporarily unavailable: Meta documents these as safe to retry.
const SERVER_CODES = new Set([1, 2])
// Subcode for "message sent outside of allowed window" (24h rule, or 7 days for private replies).
const WINDOW_SUBCODES = new Set([2534022, 2018278])

/** Decides whether a failed send may be retried. Anything unknown is treated as permanent (safe). */
export function classifyFailure(input: {
  status?: number
  error?: MetaError | null
  networkError?: boolean
}): Classification {
  const { status, error, networkError } = input
  if (networkError) return { kind: "transient", reason: "network" }

  const code = error?.code
  const sub = error?.error_subcode

  // Permanent classes are checked FIRST so a 5xx wrapper around a token error is never retried.
  if (sub !== undefined && WINDOW_SUBCODES.has(sub)) return { kind: "permanent", reason: "window" }
  if (code === 190) return { kind: "permanent", reason: "token" }
  if (code === 368) return { kind: "permanent", reason: "spam" }
  if (code === 551) return { kind: "permanent", reason: "unavailable" }
  if (code === 10 || (code !== undefined && code >= 200 && code <= 299)) return { kind: "permanent", reason: "permission" }
  if (code === 100) return { kind: "permanent", reason: "invalid" }

  if (status === 429) return { kind: "transient", reason: "rate_limit" }
  if (code !== undefined && RATE_LIMIT_CODES.has(code)) return { kind: "transient", reason: "rate_limit" }
  if (code !== undefined && SERVER_CODES.has(code)) return { kind: "transient", reason: "server" }
  if (error?.is_transient === true) return { kind: "transient", reason: "server" }
  if (status !== undefined && status >= 500) return { kind: "transient", reason: "server" }

  return { kind: "permanent", reason: "unknown" }
}

/**
 * Exponential backoff with jitter. attempt is 1-based (the wait AFTER attempt N).
 * rand is injectable so tests are deterministic.
 */
export function backoffMs(attempt: number, opts: { baseMs?: number; capMs?: number; rand?: () => number } = {}): number {
  const base = opts.baseMs ?? 400
  const cap = opts.capMs ?? 3000
  const rand = opts.rand ?? Math.random
  const raw = Math.min(cap, base * 2 ** Math.max(0, attempt - 1))
  return Math.round(raw * (0.5 + rand() * 0.5))
}

/** Waits before the scheduler's next retry of a stored failure, by attempts already made. */
const STORED_RETRY_DELAYS_MIN = [1, 5, 20, 60, 180]
export const MAX_STORED_ATTEMPTS = STORED_RETRY_DELAYS_MIN.length + 1

/** Returns minutes until the next stored retry, or null when we should give up. */
export function storedRetryDelayMinutes(attemptsMade: number): number | null {
  return STORED_RETRY_DELAYS_MIN[attemptsMade - 1] ?? null
}

export interface AttemptOutcome<T> {
  ok: boolean
  value?: T
  status?: number
  error?: MetaError | null
  networkError?: boolean
  /** Seconds from a Retry-After header, if Meta sent one. */
  retryAfterSec?: number
}

export interface RetryResult<T> {
  outcome: AttemptOutcome<T>
  attempts: number
  classification?: Classification
}

/**
 * Runs `attempt` up to maxAttempts times, retrying only transient failures.
 * A Retry-After longer than maxWaitMs stops the inline retry (the stored retry will pick it up)
 * so a webhook request is never held open for long.
 */
export async function withRetry<T>(
  attempt: () => Promise<AttemptOutcome<T>>,
  opts: { maxAttempts?: number; maxWaitMs?: number; sleep?: (ms: number) => Promise<void>; rand?: () => number } = {},
): Promise<RetryResult<T>> {
  const maxAttempts = opts.maxAttempts ?? 3
  const maxWaitMs = opts.maxWaitMs ?? 3000
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))

  let last: AttemptOutcome<T> = { ok: false }
  let classification: Classification | undefined
  for (let n = 1; n <= maxAttempts; n++) {
    last = await attempt()
    if (last.ok) return { outcome: last, attempts: n }
    classification = classifyFailure(last)
    // Permanent error: stop at once, retrying cannot help.
    if (classification.kind === "permanent" || n === maxAttempts) return { outcome: last, attempts: n, classification }
    const wait = last.retryAfterSec !== undefined ? last.retryAfterSec * 1000 : backoffMs(n, { rand: opts.rand })
    if (wait > maxWaitMs) return { outcome: last, attempts: n, classification }
    await sleep(wait)
  }
  return { outcome: last, attempts: maxAttempts, classification }
}
