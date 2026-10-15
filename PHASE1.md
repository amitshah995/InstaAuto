# Phase 1: Instagram Audit funnel (connect-first)

Apply **after** Phase 0 (needs `migrations/10-audit-schema.sql` and `lib/auth.ts`).

## Why connect-first

Spike 0 result, verified on the live app: with an Instagram-Login token, Instagram answers
`Tried accessing nonexisting field (business_discovery)`. Looking up OTHER people's accounts is
therefore not possible with the current login. The funnel audits the **signed-in user's own account**
(`/me` and `/me/media`), which works with the permission the app already has
(`instagram_business_basic`). No new Meta review is needed.

## Flow

```
/instagram-audit  --click-->  POST /api/audit
                                 |-- 401 login_required -> Instagram login -> back to /instagram-audit?run=1 (auto-runs)
                                 '-- 200 {id} -> /audit/[id]   (full report, owner only)
```

## Files

| File | Role |
|---|---|
| `lib/audit/types.ts` | Source-agnostic shapes |
| `lib/audit/score.ts` | Pure scoring. Thresholds live in `TUNING` (heuristics, not official benchmarks; the report says so) |
| `lib/audit/lookup.ts` | **The only file that knows how data is fetched.** Reads the user's own profile and last 30 posts with their token |
| `lib/audit/service.ts` | `createOwnAudit` (reuses a result created in the last 10 minutes), `getAuditView` (owner only) |
| `lib/audit/oauth-url.ts` | Instagram login URL + the "pending audit" flag |
| `app/api/audit/route.ts` | `POST` (signed session required) |
| `app/api/audit/[id]/route.ts` | `GET`, owner only; everyone else gets 404 |
| `app/api/audit/[id]/claim/route.ts` | Retired stub (410), kept so old deployments keep building |
| `app/api/leads/route.ts` | Signed-in user leaves email/WhatsApp with explicit consent; links only to their own audit |
| `app/instagram-audit`, `app/audit/[id]`, `components/audit` | Landing (SEO) and private result page (noindex) |
| `hooks/use-instagram-session.ts` | After login, returns the user to `/instagram-audit?run=1` |

## Security notes

- The audit endpoints accept **signed sessions only** (`getVerifiedSessionUserId`), never the legacy
  unsigned cookie, so a forged cookie cannot read or trigger another user's audit.
- Reports are private. A report id is useless to anyone but the owner.

## Needs to be true in production

- `SESSION_SECRET` set (otherwise login issues the legacy cookie and the audit says "connect" again).
- `TOKEN_ENCRYPTION_KEY` is optional, tokens are decrypted transparently.
- Users who logged in before `SESSION_SECRET` existed hold a legacy cookie: they simply connect again.

## Not verified against real Instagram

`/me` and `/me/media` field names follow the Instagram API docs. If `media_product_type` is rejected,
the provider retries without it. Check the first real audit in the Vercel logs (`[audit]` lines).

## Not built yet

Competitor benchmark (needs a Facebook Login based lookup account), connected-tier extras (reach, saves,
best time to post: need `instagram_business_manage_insights` and Meta review), PDF export, email follow-up,
free tools hub, token refresh (tokens last about 60 days).
