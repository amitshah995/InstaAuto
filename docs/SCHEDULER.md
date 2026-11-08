# Scheduler (delayed DMs, DM retries, data retention)

One endpoint does all background work:

    GET /api/cron/process-scheduled
    Authorization: Bearer <CRON_SECRET>

Each call (in this order, each stage isolated):
1. Sends delayed DM steps that are due (`scheduled_messages`, migration 12).
2. Retries stored transient DM failures (`failed_sends`, migration 26) on a 1 / 5 / 20 / 60 / 180 minute backoff,
   only while the Meta window is open (24h for DMs, 7 days for comment private replies). Permanent errors are never retried.
3. Deletes raw webhook payloads older than `WEBHOOK_RETENTION_DAYS` (default 30).
4. Delivers outbound webhooks that are due for retry (Phase 4).

The response is JSON with counts. A call with a missing or wrong secret gets 401. If `CRON_SECRET` is not set the endpoint refuses everyone.

## Vercel Hobby vs Pro

`vercel.json` contains the endpoint on a **daily** schedule (`0 5 * * *`), which is the only frequency Hobby allows. This is a safety net only.
Vercel sends `Authorization: Bearer $CRON_SECRET` automatically for its own crons once `CRON_SECRET` is set in the project.

- **Pro**: change the schedule to `* * * * *` in `vercel.json` (every minute).
- **Hobby (no GitHub Actions needed)**: use an external pinger such as cron-job.org (free):
  - URL: `https://<your-domain>/api/cron/process-scheduled`
  - Schedule: every minute
  - Header: `Authorization: Bearer <your CRON_SECRET>`
  - Method: GET

## Turning on delayed steps

Delays of 5 seconds or less always wait inside the request. Longer delays are queued **only if** `SCHEDULER_ENABLED=1`.
Set that flag **only after** the every-minute pinger (or Pro cron) is running; with only the daily safety-net cron a queued
step could go out hours late and miss the 24-hour window. Without the flag, behaviour is unchanged (the request sleeps, up to the 60s function limit).

## Health check

Call the endpoint by hand with curl and the secret; you should see `{"claimed":0,"sent":0,...,"retries":{...},"retention":{...}}`.
