/**
 * Database access for the AI Sales Agent. Every statement is scoped by user_id ($1) so one account can never read or
 * change another account's rows. The query function is injected so tests can check this without a database.
 *
 * Who calls this: lib/agent/runtime.ts (live path) and the app/api/ai-agent/* routes, each building a store with rawQuery.
 * Rule enforced by tests/agent-store.test.ts: every statement contains "user_id = $1" and the first parameter is the user id.
 * Never selects or logs access tokens. Contact phone/email are only read for the dashboard and CSV of the same account.
 */
import { parseState } from "./engine.ts"
import type { AgentState, Faq, Knowledge } from "./types.ts"
import { LEAD_STATUSES, clampScores, isLeadStatus, type LeadStatus, type ScoreConfig } from "./scoring.ts"

export type QueryFn = <T = any>(text: string, values?: any[]) => Promise<T[]>

const asFaqs = (v: unknown): Faq[] =>
  (Array.isArray(v) ? v : [])
    .filter((f: any) => f && typeof f.q === "string" && typeof f.a === "string")
    .slice(0, 20)
    .map((f: any) => ({ q: f.q.slice(0, 300), a: f.a.slice(0, 800) }))

/** Cleans knowledge input from the dashboard (the API is the real gate for length limits). */
export function sanitizeKnowledgeInput(i: any): Knowledge | null {
  const mediaId = typeof i?.mediaId === "string" ? i.mediaId.trim() : ""
  if (!/^\d{5,40}$/.test(mediaId)) return null
  const t = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "")
  return { mediaId, title: t(i.title, 120), caption: t(i.caption, 2200), offer: t(i.offer, 1000), faqs: asFaqs(i.faqs) }
}

export interface AgentSettings {
  enabled: boolean
  tone: "friendly" | "professional" | "casual"
  language: "auto" | "english" | "hindi" | "hinglish"
  handoffRules: string
  scores: ScoreConfig
  connectorSkipped: boolean
  settingsSaved: boolean
}

export function createAgentStore(q: QueryFn) {
  const rowToKnowledge = (r: any): Knowledge & { active: boolean; id: number } => ({
    id: Number(r.id), mediaId: r.media_id, title: r.title ?? "", caption: r.caption ?? "", offer: r.offer ?? "", faqs: asFaqs(r.faqs), active: r.active !== false,
  })

  return {
    async listKnowledge(userId: string | number) {
      const rows = await q(`SELECT * FROM media_knowledge WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 100`, [userId])
      return rows.map(rowToKnowledge)
    },
    /** Active entry for one Reel, or null. */
    async getKnowledge(userId: string | number, mediaId: string) {
      const rows = await q(`SELECT * FROM media_knowledge WHERE user_id = $1 AND media_id = $2 AND active = TRUE`, [userId, mediaId])
      return rows[0] ? rowToKnowledge(rows[0]) : null
    },
    async upsertKnowledge(userId: string | number, k: Knowledge, active: boolean) {
      await q(
        `INSERT INTO media_knowledge (user_id, media_id, title, caption, offer, faqs, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (user_id, media_id) DO UPDATE SET title=$3, caption=$4, offer=$5, faqs=$6, active=$7, updated_at=now()`,
        [userId, k.mediaId, k.title, k.caption, k.offer, JSON.stringify(k.faqs), active],
      )
    },
    async setKnowledgeActive(userId: string | number, mediaId: string, active: boolean) {
      await q(`UPDATE media_knowledge SET active = $3, updated_at = now() WHERE user_id = $1 AND media_id = $2`, [userId, mediaId, active])
    },
    async deleteKnowledge(userId: string | number, mediaId: string) {
      await q(`DELETE FROM media_knowledge WHERE user_id = $1 AND media_id = $2`, [userId, mediaId])
    },

    async getConversation(userId: string | number, igsid: string) {
      const rows = await q(`SELECT media_id, status, state, turn_count, version, started_at, updated_at FROM agent_conversations WHERE user_id = $1 AND igsid = $2`, [userId, igsid])
      const r = rows[0]
      return r ? { mediaId: r.media_id as string, status: r.status as string, state: parseState(r.state), turnCount: Number(r.turn_count), version: Number(r.version) } : null
    },
    /** Starts (or restarts, for a new comment) the conversation with a fresh state. */
    async startConversation(userId: string | number, igsid: string, mediaId: string, state: AgentState) {
      await q(
        `INSERT INTO agent_conversations (user_id, igsid, media_id, status, state, turn_count, version)
         VALUES ($1,$2,$3,'active',$4,0,0)
         ON CONFLICT (user_id, igsid) DO UPDATE SET media_id=$3, status='active', state=$4, turn_count=0, version=agent_conversations.version+1, started_at=now(), updated_at=now()`,
        [userId, igsid, mediaId, JSON.stringify(state)],
      )
    },
    /** Compare-and-set: returns false when another request already advanced the conversation (this one is dropped). */
    async saveConversation(userId: string | number, igsid: string, expectedVersion: number, state: AgentState): Promise<boolean> {
      const rows = await q(
        `UPDATE agent_conversations SET state=$4, status=$5, turn_count=$6, version=version+1, updated_at=now()
          WHERE user_id = $1 AND igsid = $2 AND version = $3 RETURNING id`,
        [userId, igsid, expectedVersion, JSON.stringify(state), state.status, state.turn],
      )
      return rows.length > 0
    },
    async setConversationStatus(userId: string | number, igsid: string, status: "active" | "ended" | "handoff") {
      await q(`UPDATE agent_conversations SET status = $3, updated_at = now() WHERE user_id = $1 AND igsid = $2`, [userId, igsid, status])
    },
    async listConversations(userId: string | number, limit = 50) {
      const n = Math.min(limit, 200)
      try {
        return await q(
          `SELECT a.igsid, a.media_id, a.status, a.turn_count, a.started_at, a.updated_at,
                  c.recipient_username, c.human_handled
             FROM agent_conversations a
             LEFT JOIN conversations c ON c.user_id = a.user_id AND c.recipient_id = a.igsid
            WHERE a.user_id = $1 ORDER BY a.updated_at DESC LIMIT $2`,
          [userId, n],
        )
      } catch (e) {
        // The inbox table `conversations` has no migration in this repo, so its columns/types can differ between databases.
        // The username and handoff flag are nice-to-have here: if the join fails we still show the agent's own rows instead
        // of breaking the whole Overview / Conversations tab. Logged without request data.
        console.error("[ai-agent] listConversations join failed, using plain query:", ((e as Error)?.message || "").slice(0, 200))
        return q(
          `SELECT a.igsid, a.media_id, a.status, a.turn_count, a.started_at, a.updated_at,
                  NULL::text AS recipient_username, NULL::boolean AS human_handled
             FROM agent_conversations a
            WHERE a.user_id = $1 ORDER BY a.updated_at DESC LIMIT $2`,
          [userId, n],
        )
      }
    },
    /** Takes over: silences the agent and the bot for this person. Scoped to the account. */
    async takeOver(userId: string | number, igsid: string) {
      await q(`UPDATE agent_conversations SET status='handoff', updated_at=now() WHERE user_id = $1 AND igsid = $2`, [userId, igsid])
      await q(`UPDATE conversations SET human_handled = TRUE WHERE user_id = $1 AND recipient_id = $2`, [userId, igsid])
    },
    async getMessages(userId: string | number, igsid: string, limit = 60) {
      return q(
        `SELECT m.content, m.is_from_instagram, m.created_at
           FROM messages m JOIN conversations c ON c.id = m.conversation_id
          WHERE m.user_id = $1 AND c.user_id = $1 AND c.recipient_id = $2
          ORDER BY m.created_at DESC LIMIT $3`,
        [userId, igsid, Math.min(limit, 200)],
      )
    },

    async getSettings(userId: string | number): Promise<AgentSettings> {
      const rows = await q(`SELECT * FROM agent_settings WHERE user_id = $1`, [userId])
      const r = rows[0]
      return {
        enabled: r?.enabled === true,
        tone: ["friendly", "professional", "casual"].includes(r?.tone) ? r.tone : "friendly",
        language: ["auto", "english", "hindi", "hinglish"].includes(r?.language) ? r.language : "auto",
        handoffRules: r?.handoff_rules ?? "",
        scores: clampScores(r?.scores),
        connectorSkipped: r?.connector_skipped === true,
        settingsSaved: r?.settings_saved === true,
      }
    },
    async saveSettings(userId: string | number, s: Partial<AgentSettings>) {
      const cur = await this.getSettings(userId)
      const m = { ...cur, ...s }
      await q(
        `INSERT INTO agent_settings (user_id, enabled, tone, language, handoff_rules, scores, connector_skipped, settings_saved)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (user_id) DO UPDATE SET enabled=$2, tone=$3, language=$4, handoff_rules=$5, scores=$6, connector_skipped=$7, settings_saved=$8, updated_at=now()`,
        [userId, m.enabled, m.tone, m.language, m.handoffRules.slice(0, 600), JSON.stringify(clampScores(m.scores)), m.connectorSkipped, m.settingsSaved],
      )
    },

    async getContact(userId: string | number, igsid: string) {
      const rows = await q(
        `SELECT id, name, phone, email, lead_status, lead_score, unverified_phone FROM contacts WHERE user_id = $1 AND igsid = $2`,
        [userId, igsid],
      )
      return rows[0] ?? null
    },
    /** Creates the contact if needed, then applies the lead fields. Only the listed columns can change. */
    async applyLead(
      userId: string | number,
      igsid: string,
      p: {
        status: LeadStatus; score: number; mediaId: string
        phone?: string; unverifiedPhone?: string; email?: string
        consentAt?: string | null; consentText?: string | null; emailConsentAt?: string | null
      },
    ): Promise<string | null> {
      const rows = await q(
        `INSERT INTO contacts (user_id, igsid, lead_status, lead_score, lead_media_id, phone, unverified_phone, email, phone_consent_at, consent_text, email_consent_at, lead_updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
         ON CONFLICT (user_id, igsid) DO UPDATE SET
           lead_status=$3, lead_score=GREATEST(contacts.lead_score,$4), lead_media_id=$5,
           phone=COALESCE($6, contacts.phone), unverified_phone=COALESCE($7, contacts.unverified_phone),
           email=COALESCE($8, contacts.email),
           phone_consent_at=COALESCE($9, contacts.phone_consent_at), consent_text=COALESCE($10, contacts.consent_text),
           email_consent_at=COALESCE($11, contacts.email_consent_at),
           lead_updated_at=now(), updated_at=now()
         RETURNING id`,
        [userId, igsid, p.status, p.score, p.mediaId, p.phone ?? null, p.unverifiedPhone ?? null, p.email ?? null, p.consentAt ?? null, p.consentText ?? null, p.emailConsentAt ?? null],
      )
      return rows[0]?.id ?? null
    },
    async listLeads(userId: string | number, status?: string, limit = 100) {
      const filter = status && isLeadStatus(status) ? status : null
      const n = Math.min(limit, 500)
      try {
        return await q(
          `SELECT c.id, c.igsid, c.name, c.lead_status, c.lead_score, c.lead_media_id, c.phone, c.email, c.lead_updated_at,
                  v.recipient_username
             FROM contacts c LEFT JOIN conversations v ON v.user_id = c.user_id AND v.recipient_id = c.igsid
            WHERE c.user_id = $1 AND c.lead_status IS NOT NULL AND ($2::text IS NULL OR c.lead_status = $2)
            ORDER BY c.lead_updated_at DESC NULLS LAST LIMIT $3`,
          [userId, filter, n],
        )
      } catch (e) {
        // Same reason as listConversations: the optional username join must never take the Leads tab down.
        console.error("[ai-agent] listLeads join failed, using plain query:", ((e as Error)?.message || "").slice(0, 200))
        return q(
          `SELECT c.id, c.igsid, c.name, c.lead_status, c.lead_score, c.lead_media_id, c.phone, c.email, c.lead_updated_at,
                  NULL::text AS recipient_username
             FROM contacts c
            WHERE c.user_id = $1 AND c.lead_status IS NOT NULL AND ($2::text IS NULL OR c.lead_status = $2)
            ORDER BY c.lead_updated_at DESC NULLS LAST LIMIT $3`,
          [userId, filter, n],
        )
      }
    },

    /** True only for the first caller for this (person, reel, kind). This is the "one dispatch per contact per media" guarantee. */
    async claimLeadDispatch(userId: string | number, igsid: string, mediaId: string, kind: "whatsapp" | "email"): Promise<boolean> {
      const rows = await q(
        `INSERT INTO lead_events (user_id, igsid, media_id, kind) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, igsid, media_id, kind) DO NOTHING RETURNING id`,
        [userId, igsid, mediaId, kind],
      )
      return rows.length > 0
    },

    /** The AiSend connector is a webhook_endpoints row with preset 'aisend'. Never returns the key. */
    async getConnector(userId: string | number) {
      const rows = await q(
        `SELECT id, url, enabled, disabled_reason, events FROM webhook_endpoints WHERE user_id = $1 AND preset = 'aisend' ORDER BY id LIMIT 1`,
        [userId],
      )
      return rows[0] ?? null
    },
    async saveConnector(userId: string | number, url: string, encryptedKey: string | null, enabled: boolean, events: string[]): Promise<number> {
      const cur = await this.getConnector(userId)
      if (cur) {
        await q(
          `UPDATE webhook_endpoints SET url=$3, secret=COALESCE($4, secret), enabled=$5, events=$6, consecutive_failures=0, disabled_reason=NULL WHERE id=$2 AND user_id = $1`,
          [userId, cur.id, url, encryptedKey, enabled, events],
        )
        return Number(cur.id)
      }
      const rows = await q(
        `INSERT INTO webhook_endpoints (user_id, label, url, secret, events, preset, enabled) VALUES ($1,'AiSend',$2,$3,$4,'aisend',$5) RETURNING id`,
        [userId, url, encryptedKey, events, enabled],
      )
      return Number(rows[0].id)
    },
    async removeConnector(userId: string | number) {
      await q(`DELETE FROM webhook_endpoints WHERE user_id = $1 AND preset = 'aisend'`, [userId])
    },

    /** The agent's own comment rules (response_kind = ai_agent). */
    async listAgentRules(userId: string | number) {
      return q(
        `SELECT id, name, trigger_value, specific_media_id, is_active FROM automations WHERE user_id = $1 AND response_content->>'response_kind' = 'ai_agent' ORDER BY created_at DESC`,
        [userId],
      )
    },
  }
}

export type AgentStore = ReturnType<typeof createAgentStore>
export { LEAD_STATUSES }
