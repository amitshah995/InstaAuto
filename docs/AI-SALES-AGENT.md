# AI Sales Agent (phase 1)

A comment on a Reel starts a private-reply conversation. An LLM answers only from the business's own details for that Reel, asks for the person's WhatsApp number with explicit consent wording, and (with consent) hands the lead to the owner's AiSend account. If the person says no, it offers email once and stores it. Celra sends no email in this phase.

Code lives in `lib/agent/*`. Dashboard: `/dashboard/ai-agent` (Overview, Setup, Conversations, Leads, Test the agent). Public page: `/features/ai-sales-agent`.

## Flow

1. Owner runs the setup wizard: connect AiSend (optional), add Reel knowledge, set tone/language/handoff, turn on. Turning on creates a normal comment automation (`trigger_source=comment`, keyword, `specific_media_id` = the Reel, `response_content.response_kind = "ai_agent"`). It is visible and editable under Automations.
2. Someone comments the keyword. The webhook picks the rule with the existing `pickCommentAutomation`. For an agent rule, `prepareAgentIntro` writes the first private reply from the Reel knowledge (at most 1000 characters, links only if they are in the knowledge text, always says it is an automated assistant). Still exactly one private reply per comment (Meta allows it within 7 days). If the agent cannot run (no model key, no knowledge, quota), nothing is sent and the reason is logged on the automation run.
3. After the private reply is delivered, `commitAgentStart` stores an `agent_conversations` row (one live conversation per person per account; a new comment restarts it) and a contact with `lead_status = new`.
4. The person replies. In the DM path, after the human-handled check and the 24h check, `routeIncomingDm` (`lib/agent/routing.ts`) sends the message to `handleAgentDm`, before keyword rules and the generic AI fallback. Ref links, quick-reply chips and postbacks keep their old behaviour. Outside the 24h window nothing is sent.
5. Each turn: consent is updated by code from the person's own words, the model runs with four tools, tool calls are validated in code, effects are applied (contact fields, status/score, handoff, dispatch), and the reply is sent. The consent line or the email offer is appended by code, never written by the model.
6. Handoff (`request_human`, 12-turn cap, token budget, repeated prompt-injection attempts) sets `human_handled` on the conversation, so every bot stays silent. "Take over" in the Conversations tab does the same.

## Data model (migration 31)

| Table / columns | Purpose |
| --- | --- |
| `media_knowledge` (user_id, media_id, title, caption, offer, faqs jsonb, active) unique(user_id, media_id) | What the agent may answer from, per Reel |
| `agent_conversations` (user_id, igsid, media_id, status, state jsonb, turn_count, version) unique(user_id, igsid) | Loop memory; `version` is a compare-and-set guard so two racing DMs cannot both answer |
| `agent_settings` (user_id, enabled, tone, language, handoff_rules, scores, connector_skipped, settings_saved) | Per-account behaviour and editable lead score numbers |
| `contacts.lead_status, lead_score, lead_media_id, phone_consent_at, consent_text, unverified_phone, email_consent_at, lead_updated_at` | Lead fields on the existing contacts table |
| `lead_events` unique(user_id, igsid, media_id, kind) | One dispatch per person per Reel per kind, even under races |

Every query in `lib/agent/store.ts` filters on `user_id = $1` (or inserts `user_id` first). `tests/agent-integration.test.ts` fails if any statement is not scoped. The webhook's stored state keeps a pending phone number (E.164) only between "number given" and "consent given", then clears it.

## Safety

- The model never writes to the database. It can only request four tools: `capture_phone`, `capture_email`, `request_human`, `end_conversation`. Code validates arguments (`lib/agent/tools.ts`, `validate.ts`) and refuses any number or email that is not literally in the person's latest message, so an invented or injected value cannot be stored.
- Phone: 10 digits starting 6-9, optional `+91`/`91`/`0091`/`0`, spaces and dashes stripped. Repeats (9999999999, 9898989898) and sequences (9876543210) are rejected. Email: format check and 254 character cap.
- Untrusted text: follower messages, captions and FAQs are cleaned (tags removed, length capped) and only appear inside data tags. "Ignore previous instructions" style messages are detected, counted and flagged to the model; three of them hand the chat to a human. The reply is filtered on the way out: prompt leaks are replaced with a safe fallback, links not present in the knowledge text are removed.
- Limits: 6-message history window, 12 agent turns per conversation, 30,000 tokens per conversation, `max_tokens` 400, a per-account rate guard (30 model calls a minute per server instance) and a daily plan counter.
- Logging: no phone, email, key, token or message text is logged. Run logs for agent chats carry no message text. `tests/agent-copy-and-secrets.test.ts` checks the log lines.
- The AiSend key is encrypted with `lib/token-crypto.ts` (like Instagram tokens), never returned by any API after saving, and only sent to the stored URL after the SSRF check (https only, no private addresses, no redirects).
- Retention: the raw Instagram webhook payload (`webhook_events`) can contain a number the person typed, and `webhook_deliveries.payload` stores the lead event (including the phone) for the delivery log. Both follow the existing retention settings (`WEBHOOK_RETENTION_DAYS`, default 30). Shorten them if you want numbers to disappear sooner. This phase does not redact the delivery log.

## Consent

Wording (fixed, sent by code): `To send your brochure on WhatsApp I need your number. OK to message you there? (This is an automated assistant)`

State machine (`lib/agent/consent.ts`): `none -> asked` when code sends the line (from the second reply onwards, so the first reply gives value). `asked -> granted` on a clear yes, or when the person sends a valid number right after the line. `asked -> declined` on a no; the email offer is then sent once. `granted -> declined` on "stop" or "don't message me". A declined person is not asked again.

- A number given without consent is saved as `contacts.unverified_phone` and NOT sent anywhere. If the person says yes later, the held number is promoted and dispatched.
- On consent, `contacts.phone` (E.164), `phone_consent_at` and `consent_text` are stored.
- Email: stored as `contacts.email`. It is forwarded only if the person typed it after the email offer (that counts as agreeing to be contacted by email). An email volunteered without the offer is stored but not forwarded.

Why: India's Digital Personal Data Protection Act, 2023 centres on clear, specific, informed consent for processing personal data, and on being able to show it. The design records the exact words and the time, tells the person it is an automated assistant, and does not pass a number on without a yes. This is a design rationale, not legal advice; the business owner should confirm its own obligations (notice, retention, withdrawal, the AiSend side) with a lawyer.

## Lead score and status

`lib/agent/scoring.ts`. Defaults: wa_lead 95, email_lead 60, engaged 30 (editable per account in Setup step 3). Status: new, engaged, email_lead, wa_lead, handoff. Score never decreases. A captured lead is not demoted by a handoff (handoff only changes status for new/engaged contacts, and always keeps the score).

## AiSend connector

AiSend's lead door is `POST {AISEND_BASE_URL}/api/leads/ingest` with header `x-api-key: <key>`. The connector is a `webhook_endpoints` row with `preset = 'aisend'`, so it reuses the delivery queue, retries, delivery log, auto-disable and the SSRF guard. The generic signed webhook stays available for other receivers: subscribe any endpoint to `lead.whatsapp_captured` / `lead.email_captured` in Settings and it receives the standard signed envelope with the data below.

Event data (generic webhook, inside `data`):

```json
{
  "contact_id": "uuid",
  "igsid_hash": "32 hex chars, sha256 of celra:<account>:<igsid>, not the Instagram id",
  "name": "string or null",
  "phone": "+919876501234 or null",
  "email": "string or null",
  "interest": "Reel title",
  "source_media_id": "179...",
  "consent_given": true,
  "consent_at": "ISO time",
  "consent_text": "the exact line agreed to",
  "score": 95
}
```

Body sent to AiSend (built from the same data by `aiSendBodyFromEventData`):

```json
{
  "source": "instagram_dm",
  "campaign": "celra_ai_agent",
  "name": "optional",
  "phone": "+919876501234",
  "email": "optional",
  "interest": "Reel title (max 300)",
  "consent": true,
  "extra": {
    "celra_media_id": "179...",
    "lead_score": 95,
    "consent_text": "...",
    "consent_at": "ISO time",
    "ig_contact_id": "uuid",
    "source": "celra_ai_agent"
  }
}
```

AiSend needs a phone or an email, replies `{ ok, lead_id, is_new }`, de-duplicates one lead per phone per tenant and runs its own `lead_created` automation. `consent` is true only when the consent gate passed; consent=false leads are never dispatched by the agent (the test lead is the only consent=false body).

Delivery: event id is deterministic per (account, person, Reel, kind), so retries and receivers de-duplicate; `lead_events` guarantees one dispatch per person per Reel per kind. Retries follow the existing schedule (1m, 5m, 30m, 2h, 12h). For the aisend preset, a 4xx other than 408/429 (wrong key, bad body) is permanent and is not retried (`decideAfterAttempt` in `lib/webhooks/policy.ts`). Generic and Sheets endpoints keep their old behaviour.

"Send test lead" (Setup step 1) delivers one clearly labelled email-only lead (`celra-test@example.com`, consent false) once, never a phone, because the receiver may message every new lead.

## Retrieval (RAG)

The agent no longer reads the whole Reel record on every turn when the knowledge is indexed. It searches first and shows the model only the best passages.

**Data flow.** Saving Reel knowledge, pasting a document or importing a page splits the text into chunks (about 800 characters, 100 overlap, FAQ question and answer kept together, at most 200 chunks per source) and stores them in `agent_kb_chunks` with an OpenAI embedding (`text-embedding-3-small`, 1536 dims) in pgvector. On each turn `lib/agent/rag/retrieve.ts` builds a query from the latest message (plus the last user and assistant text when the message is 4 words or fewer, e.g. "kitna?"), embeds it (4s timeout) and calls `match_agent_chunks`. Only passages from this account, for this Reel or the whole business, above a minimum similarity are used: at most 5 passages and about 3000 characters. The prompt gets those passages plus the Reel title and offer headline, inside the same untrusted-data fence and with the same safety rules. If nothing relevant is found and the knowledge is large, the model is told no passage was found and hands over to a human. If the knowledge is small (under about 3500 characters) the whole record is used as before.

**Fallbacks (never an error for the follower).** No `OPENAI_API_KEY`, embedding timeout or failure, no vector match: keyword search (Postgres full text with English/Hinglish/Devanagari terms and a few price/timing/place synonyms). Nothing indexed, migration 32 not run, or any retrieval error: the previous behaviour of putting the Reel record in the prompt. `AGENT_RAG=0` forces that previous behaviour server-wide.

**Tenant safety.** Every query filters `user_id` first, `match_agent_chunks` takes the user id as a parameter, and chunks have a composite foreign key `(source_id, user_id)`. Row level security is not relied on. The same media id under two accounts never mixes. Re-indexing a source goes through the SQL function `replace_agent_chunks` (per-source advisory lock, delete + insert in one transaction), so overlapping re-indexes never duplicate chunks; it only runs for a source that belongs to the account.

**Keyword fallback and partly indexed sources.** Synonyms of one intent (price, fees, cost, kitna...) count as one concept, so "price?" finds "Consultation charge: 500"; short terms (rs, fee, off) match whole words only. When vector search succeeds, up to 2 of the 5 slots go to keyword matches among chunks that have no vector (their embedding call failed), so a partly embedded source does not hide answers. A Reel saved before retrieval existed keeps using its whole knowledge until it is saved or re-indexed.

**Sources.** Reel offer, caption and FAQs (re-indexed on every save), pasted documents (up to 60,000 characters), and one web page per import (https only, public addresses only, redirects re-checked, 8s and 1.5 MB limits, scripts and navigation stripped, links are not followed). PDF upload is not supported. Up to 100 documents and pages per account. Dashboard: Knowledge tab and Setup step 2 (sources, status, Re-index, Delete, Search test).

**Cost.** Embeddings count in their own daily counter `embed_day` (limit twice `agentTurnsPerDay`, enforced only when `BILLING_ENABLED`). When it is used up, new questions fall back to keyword search and new chunks are stored without vectors. The Search test box also uses it. The Knowledge routes also have per-account rate guards (10 adds, 10 re-indexes and 20 searches a minute per server instance) and refuse oversized bodies (413).

**Privacy.** Chunk text and follower questions are sent to OpenAI to create embeddings. The text of pasted documents is stored in `agent_kb_sources.raw_text` so Re-index works. Links inside retrieved passages from the owner's own text (Reel offer, caption, FAQs, pasted documents) may appear in replies; links that exist only in an imported web page never do (third-party text), unless the same link is in the owner's own text. Invisible Unicode (tag characters, zero-width, bidi marks) is stripped from every passage before it reaches the model.

**Owner checklist.** Run migration 32 on a database that has pgvector (Supabase: enabled by the migration); set `OPENAI_API_KEY` on the server (never in the repo); mention OpenAI in the privacy policy; after the first deploy open the Knowledge tab and press Re-index on existing Reels, then try Search test.

## Quotas and billing

Each agent model call reserves one unit of a separate daily counter `agent_day` (`reserveAgentTurn`, plan field `agentTurnsPerDay`: 2000 on every plan for now (owner decision, to be tuned when pricing is final), editable in `lib/billing/plans.ts`). Blocking happens only when `BILLING_ENABLED` is on, like the other counters. The agent's outgoing DMs go through `sendSteps`, so they count as DMs as usual. The "Test the agent" panel uses the same counter. Not shown on the billing page yet.

## Environment

- `ANTHROPIC_API_KEY` (required for the agent to reply; without it nothing is sent)
- `AGENT_MODEL` (default `claude-haiku-5-5`)
- `AGENT_ENABLED=0` switches the agent off server-wide
- `TOKEN_ENCRYPTION_KEY` (existing) encrypts the AiSend key; without it the key is stored in plain text like other secrets would be
- `BILLING_ENABLED` (existing) turns the quotas into blocks
- `OPENAI_API_KEY` (optional) enables smart matching; without it keyword search is used
- `AGENT_RAG=0` (optional) switches retrieval off; `AGENT_RAG_MIN_SIMILARITY` (optional, default 0.28) tunes the cut-off

Run `migrations/31-ai-sales-agent.sql` (idempotent) after migrations 13 and 28, then `migrations/32-agent-rag.sql` (idempotent, needs pgvector).

## Deferred

- Sending email (no email provider yet; email is captured and forwarded to AiSend only).
- Meta Conversions API and ads audiences: deliberately not built, because of the health-data policy risk.
- Redacting the phone in the webhook delivery log after success.
- Per-Reel tone, multiple Reels per conversation, media other than Reels from the picker.
