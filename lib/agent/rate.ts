/**
 * Per-account guard on LLM calls. Pure sliding window.
 *
 * Who calls this: lib/agent/runtime.ts and app/api/ai-agent/test before any model call (state kept in a module Map).
 * Why: protects cost if a post goes viral or someone floods DMs. Best effort per serverless instance; the daily plan
 * counter (lib/billing/usage.ts reserveAgentTurn) is the shared limit.
 */
export const RATE_MAX_CALLS = 30
export const RATE_WINDOW_MS = 60_000

export function slideWindow(stamps: number[], now: number, max = RATE_MAX_CALLS, windowMs = RATE_WINDOW_MS): { allowed: boolean; stamps: number[] } {
  const live = stamps.filter((t) => now - t < windowMs)
  if (live.length >= max) return { allowed: false, stamps: live }
  return { allowed: true, stamps: [...live, now] }
}
