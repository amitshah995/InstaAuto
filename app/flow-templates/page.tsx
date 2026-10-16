import type { Metadata } from "next"
import Link from "next/link"
import { AuditShell } from "@/components/audit/audit-theme"
import { FLOW_TEMPLATES } from "@/lib/flows/templates"

export const metadata: Metadata = {
  title: "Instagram DM Automation Flow Templates",
  description: "Ready-made Instagram DM and comment-to-DM flow templates: lead magnet, price and demo qualifier, giveaway entry and welcome menu. See the conversation before you use it.",
  alternates: { canonical: "/flow-templates" },
}

export default function FlowTemplatesHub() {
  return (
    <AuditShell>
      <div className="au-wrap" style={{ padding: "64px 16px 80px", display: "grid", gap: 32 }}>
        <header style={{ textAlign: "center", display: "grid", gap: 14, justifyItems: "center" }}>
          <span className="au-pill">{FLOW_TEMPLATES.length} flow templates</span>
          <h1 className="au-head" style={{ fontSize: "clamp(32px,6vw,52px)", lineHeight: 1.1, fontWeight: 800, maxWidth: 760 }}>Instagram DM flow templates</h1>
          <p className="au-muted" style={{ fontSize: 18, maxWidth: 600 }}>Pick a flow, read the exact conversation, then use it in DMSpark and change the messages to fit your brand.</p>
        </header>
        <div className="au-grid3">
          {FLOW_TEMPLATES.map((t) => (
            <Link key={t.slug} href={`/flow-templates/${t.slug}`} className="au-toolcard">
              <b className="au-head" style={{ fontSize: 17 }}>{t.name}</b>
              <span className="au-muted" style={{ fontSize: 14 }}>{t.intro}</span>
            </Link>
          ))}
        </div>
      </div>
    </AuditShell>
  )
}
