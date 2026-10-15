# Phase 1: public Instagram Audit funnel

Apply **after** Phase 0 (needs `migrations/10-audit-schema.sql` and `lib/auth.ts`).

## Flow

```
/instagram-audit  ->  POST /api/audit {username}  ->  /audit/[id]
                                                        |-- anonymous: score + 2 finding TITLES (teaser)
                                                        '-- "Unlock" -> sign in with Instagram
                                                              -> POST /api/audit/[id]/claim
                                                              -> full report + lead form + upsell cards
```

## Files

| File | Role |
|---|---|
| `lib/audit/types.ts` | Source-agnostic shapes (`ProfileSnapshot`, `AuditReport`, `AuditTeaser`) |
| `lib/audit/score.ts` | Pure scoring. **All thresholds live in `TUNING`** and are heuristics, not official benchmarks (the report says so) |
| `lib/audit/lookup.ts` | **The only file that knows how profile data is fetched.** Business Discovery today; 24h cache; hourly cap |
| `lib/audit/service.ts` | Throttle (5 audits/hour/IP, hashed), create, gate (`getAuditView`), claim |
| `app/api/audit/*` | `POST /api/audit`, `GET /api/audit/[id]`, `POST /api/audit/[id]/claim` |
| `app/api/leads/route.ts` | Signed-in user leaves email/WhatsApp (+ explicit consent) |
| `app/instagram-audit`, `app/audit/[id]`, `components/audit` | Landing (SEO) and result pages (noindex) |
| `hooks/use-instagram-session.ts` | After login, returns the user to `/audit/<pending id>` |

## How the gate works

The browser never receives locked data. `GET /api/audit/[id]` adds `report` only when the audit's
`user_id` equals the signed-in user. The teaser is built server-side and contains titles only, no
detail, fixes, categories or stats. The blurred block on the page is static placeholders.

## Config

Set `AUDIT_LOOKUP_USER_ID` (a `users.id` with a valid token). Optional: `AUDIT_MAX_LOOKUPS_PER_HOUR`.
`AUDIT_PROVIDER=fixture` serves fake profiles for local testing and is ignored in production.

## Read before launching

- **Spike 0 decides whether lookups work at all.** `lookup.ts` assumes Business Discovery works with an
  Instagram-Login token. Unverified. If the spike fails, replace only `BusinessDiscoveryProvider`.
- The "not found" error wording from Instagram is also unconfirmed; `mapGraphError` classifies by
  code and message and may need adjusting after the first real call.
- `VIDEO` media is treated as a Reel (the product-type field is not requested, because an unsupported
  field would fail the whole call).
- A claim only needs *a* signed-in session. While `SESSION_ACCEPT_LEGACY` is on, that session can be
  forged, so someone could unlock a public-data report. No private data is exposed, but turn the flag
  off once users have re-logged in (see PHASE0.md).
- Privacy policy: add that public Business/Creator profile data is read and cached for 24h, and that
  contact details given in the lead form are stored. Meta requires an accurate policy.
- The unlock claim links an audit to any account, not only the audited one. Intentional (it is a signup
  gate on public data), but it means this is **lead generation, not proof of ownership**.

## Not built yet

Connected-tier audit (reach, saves, best time to post), competitor benchmark, PDF export, email follow-up,
the free tools hub, and the Meta review for insights.
