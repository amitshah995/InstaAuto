# Phase 0: hardening + audit-funnel foundations

Branch: `feat/phase0-hardening-audit-schema`. Nothing here changes behaviour for existing
users until you flip the flags below (rollout-safe by default).

## What changed

| Area | Change |
|---|---|
| Sessions | `insta_session` is now an HMAC-signed, `httpOnly` token (`lib/session.ts`). The same token is returned as `sessionToken` by `POST /api/instagram/callback` and accepted as `Authorization: Bearer`. |
| Auth | `authorizeUser()` in `lib/auth.ts` replaces trusting `?userId=` / body `userId` on 12 routes. A valid session always wins; a different claimed id is a 403. |
| IDOR fixes | `PUT /api/automations` could edit **any** automation by id; now scoped to the owner. `/api/upload` used `userId` as a directory name (path traversal); now digits only + must match session. |
| Token storage | `users.access_token` is encrypted with AES-256-GCM transparently in `lib/supabase-server.ts` (encrypt on write, decrypt on read). No route code changed. Plaintext rows keep working. |
| Schema | `migrations/10-audit-schema.sql`: `audits`, `ig_lookup_cache`, `audit_snapshots`, `competitors`, `competitor_snapshots`, `leads`, plus contact columns on `users`. Idempotent. |
| Scripts | `scripts/spike-business-discovery.mjs` (Spike 0), `scripts/encrypt-existing-tokens.mjs` (backfill, dry-run by default). |
| Logout | `POST /api/instagram/logout` (an httpOnly cookie cannot be cleared from JS). |

## Deploy order

1. Set `SESSION_SECRET` (`openssl rand -base64 48`) and `TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`). **Back up the encryption key**: losing it makes stored tokens unrecoverable (users would have to reconnect).
2. Run `migrations/10-audit-schema.sql` on Neon.
3. Deploy. Defaults: `SESSION_ACCEPT_LEGACY` on, `AUTH_ENFORCE` off, so web and Android keep working.
4. Run `node scripts/encrypt-existing-tokens.mjs` (dry run), then `--apply`.
5. After users have logged in again on the web (new signed cookie), set `SESSION_ACCEPT_LEGACY=0`.
6. **Only after** the Android app is changed (below), set `AUTH_ENFORCE=1`.

## Not done yet (and why)

- **Android app must change before `AUTH_ENFORCE=1`.** It "logs in" by picking an account from the open `/api/instagram/users` list and then sends a bare `userId`. That is the same hole this branch closes on the server. It needs to use the real OAuth flow, store `sessionToken` in SecureStore, and send `Authorization: Bearer`.
- **OAuth `state`** (CSRF + carrying the audit id through signup) is deferred to Phase 1 because the auth URL is hard-coded in three components.
- `/api/hooks/*` use `API_SECRET_KEY`, left unchanged.
- I did not audit the webhook's request-signature verification. Worth a separate look.
- `next.config.mjs` has `ignoreBuildErrors: true`; there are 87 pre-existing TypeScript errors (none in files touched here).
- `/api/upload` writes to local disk (`public/uploads`), which does not persist on Vercel.

## Spike 0 (30 minutes, decides the competitor / public-audit design)

```
IG_ACCESS_TOKEN=<a fresh token for your own connected account> node scripts/spike-business-discovery.mjs nasa
```

It tests Business Discovery, insights and hashtag search with an Instagram-Login token and prints a verdict.
If tokens are already encrypted, use a freshly issued token (or decrypt one via the app).

## Meta scope note

The Android config already requests `instagram_business_content_publish` and
`instagram_business_manage_insights`, but the web OAuth URL and the App Review submitted
on 2026-08-24 cover only basic, messages and comments. Insights and publishing need their own review
before the audit and scheduler can use them in production.
