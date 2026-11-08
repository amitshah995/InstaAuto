/**
 * Pure decision logic for the auth rollout flags (see the doc block in lib/auth.ts).
 *
 * Who calls this: lib/auth.ts at request time. Kept free of app imports so it is unit-testable.
 * Why: production must be safe by default (signed sessions only, userId never trusted from the
 * client) without anyone having to remember to flip flags, while an explicit "1" / "0" always wins.
 */

/** Production with a signing secret configured: the safe defaults apply. */
export function isProductionSafeDefaults(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === "production" && !!env.SESSION_SECRET
}

export function resolveAuthFlags(env: Record<string, string | undefined> = process.env) {
  const safe = isProductionSafeDefaults(env)
  const acceptLegacy = env.SESSION_ACCEPT_LEGACY === "1" ? true : env.SESSION_ACCEPT_LEGACY === "0" ? false : !safe
  const enforce = env.AUTH_ENFORCE === "1" ? true : env.AUTH_ENFORCE === "0" ? false : safe
  return { acceptLegacy, enforce }
}
