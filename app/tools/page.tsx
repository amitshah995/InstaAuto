import type { Metadata } from "next"
import Link from "next/link"
import { AuditShell } from "@/components/audit/audit-theme"
import { ToolIcon } from "@/components/tools/tool-icon"
import { LeadCapture } from "@/components/tools/lead-capture"
import { CATEGORIES, TOOLS } from "@/lib/tools/registry"
import { ClipboardCheck } from "lucide-react"

export const metadata: Metadata = {
  title: "Free Instagram Tools",
  description: "Free Instagram tools with no login: engagement rate calculator, DM link and QR generator, caption and hook checkers, DM templates, giveaway picker and more.",
  alternates: { canonical: "/tools" },
}

export default function ToolsHub() {
  return (
    <AuditShell>
      <div className="au-wrap" style={{ padding: "64px 16px 80px", display: "grid", gap: 40 }}>
        <header style={{ textAlign: "center", display: "grid", gap: 16, justifyItems: "center" }}>
          <span className="au-pill">{TOOLS.length} free tools &middot; no login</span>
          <h1 className="au-head" style={{ fontSize: "clamp(34px,6vw,56px)", lineHeight: 1.08, fontWeight: 800, maxWidth: 760 }}>Free Instagram tools</h1>
          <p className="au-muted" style={{ fontSize: 18, maxWidth: 600 }}>Calculators, checkers and generators for creators and businesses. Open one and use it. Nothing is read from your Instagram account.</p>
          <Link href="/instagram-audit" className="au-btn"><ClipboardCheck size={18} /> Get your free Instagram audit</Link>
        </header>

        {CATEGORIES.map((cat) => (
          <section key={cat} style={{ display: "grid", gap: 14 }}>
            <h2 className="au-head" style={{ fontSize: 22 }}>{cat}</h2>
            <div className="au-grid3">
              {TOOLS.filter((t) => t.category === cat).map((t) => (
                <Link key={t.slug} href={`/tools/${t.slug}`} className="au-toolcard">
                  <span className="au-icon red"><ToolIcon name={t.icon} size={16} /></span>
                  <b className="au-head" style={{ fontSize: 17 }}>{t.name}</b>
                  <span className="au-muted" style={{ fontSize: 14 }}>{t.short}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <div style={{ maxWidth: 640, margin: "0 auto", width: "100%" }}>
          <LeadCapture tool="hub" context="tools hub" headline="Get new tools and Instagram tips" text="Leave your details and we will tell you when new tools launch and share what works on Instagram." button="Keep me posted" />
        </div>
      </div>
    </AuditShell>
  )
}
