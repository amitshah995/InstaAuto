-- Phase 2: flat-price billing (Razorpay Subscriptions) and usage metering.
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

-- One row per account: which plan and what Razorpay says about the subscription.
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id                  BIGINT PRIMARY KEY,
  plan_id                  TEXT NOT NULL DEFAULT 'free',     -- free | starter | pro
  status                   TEXT NOT NULL DEFAULT 'created',  -- created | authenticated | active | pending | halted | paused | cancelled | completed | expired
  razorpay_subscription_id TEXT UNIQUE,
  razorpay_plan_id         TEXT,
  current_period_end       TIMESTAMPTZ,
  cancel_at_cycle_end      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook idempotency: Razorpay retries deliveries, the event id makes each one apply once.
CREATE TABLE IF NOT EXISTS billing_events (
  event_id     TEXT PRIMARY KEY,
  event_type   TEXT NOT NULL,
  user_id      BIGINT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Usage counters. kind 'dm_month' uses period 'YYYY-MM'; kind 'ai_day' uses 'YYYY-MM-DD' (both UTC).
-- The quota check is one atomic upsert, so concurrent sends cannot overshoot the limit.
CREATE TABLE IF NOT EXISTS usage_counters (
  user_id BIGINT NOT NULL,
  kind    TEXT NOT NULL,
  period  TEXT NOT NULL,
  count   INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, kind, period)
);
