# TODO: Android app login is not secure (client-side work, not done)

Found in PHASE0.md. `insta-auto-android` "logs in" by picking an account from the open `/api/instagram/users` list and then
sends a bare `userId`. That is not authentication.

## Why this is not fixed server-side
The server already supports the secure path (signed `sessionToken` returned by `POST /api/instagram/callback`, accepted as
`Authorization: Bearer`). The fix is in the app: real OAuth (in-app browser + redirect), store `sessionToken` in SecureStore,
send `Authorization: Bearer <token>` on every call (`src/api/apiClient.ts`, `src/context/AuthContext.tsx`, `src/screens/LoginScreen.tsx`).

## What changed in Phase 1
In production with `SESSION_SECRET` set, `AUTH_ENFORCE` now defaults to ON and `SESSION_ACCEPT_LEGACY` to OFF.
That makes the old Android login stop working (and `/api/instagram/users` returns only the caller's own account).
If the Android app is still in use, set `AUTH_ENFORCE=0` in Vercel to restore the old behaviour **temporarily** (insecure) until the app is migrated.
