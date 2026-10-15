import Link from "next/link"
import type { ReactNode } from "react"
import { AuditShell } from "@/components/audit/audit-theme"
import { ToolIcon } from "./tool-icon"
import { TOOLS, type ToolMeta } from "@/lib/tools/registry"
import { ArrowLeft, ClipboardCheck, Zap } from "lucide-react"

/** Page frame for one tool: heading, the tool, FAQ (with structured data), related tools, DMSpark CTA. */
export function ToolShell({ tool, children }: { tool: ToolMeta; children: ReactNode }) {
  const related = [...TOOLS.filter((t) => t.slug !== tool.slug && t.category === tool.category), ...TOOLS.filter((t) => t.slug !== tool.slug && t.category !== tool.category)].slice(0, 3)
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: tool.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  }
  return (
    <AuditShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <div className="au-wrap" style={{ maxWidth: 860, padding: "40px 16px 80px", display: "grid", gap: 24 }}>
        <div>
          <Link href="/tools" className="au-muted" style={{ fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}><ArrowLeft size={14} /> All free tools</Link>
        </div>
        <header style={{ textAlign: "center", display: "grid", gap: 14 }}>
          <span className="au-pill" style={{ justifySelf: "center" }}><ToolIcon name={tool.icon} size={13} /> {tool.category}</span>
          <h1 className="au-head" style={{ fontSize: "clamp(30px,5vw,46px)", lineHeight: 1.1, fontWeight: 800 }}>{tool.h1}</h1>
          <p className="au-muted" style={{ fontSize: 17, maxWidth: 620, margin: "0 auto" }}>{tool.intro}</p>
          <p className="au-muted" style={{ fontSize: 13 }}>Free. No login. Nothing is read from your Instagram account.</p>
        </header>

        {children}

        <section className="au-card" style={{ display: "grid", gap: 6 }}>
          <h2 className="au-head" style={{ fontSize: 20, marginBottom: 6 }}>Questions</h2>
          <div className="au-faq">
            {tool.faq.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p className="au-muted" style={{ fontSize: 14, paddingBottom: 14 }}>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="au-grid2">
          <div className="au-card" style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <span className="au-icon red"><ClipboardCheck size={16} /></span>
            <h3 className="au-head" style={{ fontSize: 18 }}>Free Instagram audit</h3>
            <p className="au-muted" style={{ fontSize: 14 }}>Connect your account and get a score with the exact fixes, charts and your best posting time.</p>
            <div><Link href="/instagram-audit" className="au-btn" style={{ padding: "11px 24px", fontSize: 15 }}>Run my audit</Link></div>
          </div>
          <div className="au-card" style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <span className="au-icon red"><Zap size={16} /></span>
            <h3 className="au-head" style={{ fontSize: 18 }}>Reply to comments and DMs automatically</h3>
            <p className="au-muted" style={{ fontSize: 14 }}>DMSpark sends the right message the moment someone comments a keyword or writes to you.</p>
            <div><Link href="/" className="au-btn ghost" style={{ padding: "11px 24px", fontSize: 15 }}>See DMSpark</Link></div>
          </div>
        </section>

        <section style={{ display: "grid", gap: 14 }}>
          <h2 className="au-head" style={{ fontSize: 20 }}>More free tools</h2>
          <div className="au-grid3">
            {related.map((t) => (
              <Link key={t.slug} href={`/tools/${t.slug}`} className="au-toolcard">
                <span className="au-icon red"><ToolIcon name={t.icon} size={16} /></span>
                <b className="au-head" style={{ fontSize: 16 }}>{t.name}</b>
                <span className="au-muted" style={{ fontSize: 13 }}>{t.short}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AuditShell>
  )
}
