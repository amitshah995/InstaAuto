import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AuditShell } from "@/components/audit/audit-theme"
import { FLOW_TEMPLATES, templateBySlug } from "@/lib/flows/templates"
import { simulate } from "@/lib/flows/engine"
import { ArrowLeft, Zap } from "lucide-react"

export const dynamicParams = false

export function generateStaticParams() {
  return FLOW_TEMPLATES.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const t = templateBySlug(slug)
  if (!t) return {}
  return {
    title: t.h1,
    description: t.intro,
    alternates: { canonical: `/flow-templates/${t.slug}` },
    openGraph: { title: t.h1, description: t.intro, url: `/flow-templates/${t.slug}`, type: "website" },
  }
}

export default async function TemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const t = templateBySlug(slug)
  if (!t) notFound()

  // Same engine the live runner uses, so the preview matches what really happens.
  const sim = simulate(t.graph, t.sampleReplies)
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: t.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  }

  return (
    <AuditShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <div className="au-wrap" style={{ maxWidth: 820, padding: "40px 16px 80px", display: "grid", gap: 24 }}>
        <Link href="/flow-templates" className="au-muted" style={{ fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
          <ArrowLeft size={14} /> All templates
        </Link>
        <header style={{ display: "grid", gap: 12 }}>
          <h1 className="au-head" style={{ fontSize: "clamp(28px,5vw,42px)", lineHeight: 1.12, fontWeight: 800 }}>{t.h1}</h1>
          <p className="au-muted" style={{ fontSize: 17 }}>{t.intro}</p>
          <p className="au-muted" style={{ fontSize: 14 }}><b>Starts when:</b> {t.trigger}</p>
        </header>

        <section className="au-card" style={{ display: "grid", gap: 10 }}>
          <h2 className="au-head" style={{ fontSize: 18 }}>What the conversation looks like</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {sim.lines.map((l, i) =>
              l.from === "system" ? (
                <p key={i} className="au-muted" style={{ fontSize: 12, textAlign: "center" }}>{l.text}</p>
              ) : (
                <div key={i} style={{ display: "flex", justifyContent: l.from === "user" ? "flex-end" : "flex-start" }}>
                  <span
                    style={{
                      maxWidth: "82%",
                      padding: "10px 14px",
                      borderRadius: 18,
                      fontSize: 14,
                      whiteSpace: "pre-wrap",
                      background: l.from === "user" ? "var(--au-accent, #e1306c)" : "rgba(128,128,128,0.14)",
                      color: l.from === "user" ? "#fff" : "inherit",
                    }}
                  >
                    {l.text}
                  </span>
                </div>
              ),
            )}
          </div>
          <p className="au-muted" style={{ fontSize: 12 }}>Text in [brackets] is a placeholder you replace with your own link or details.</p>
        </section>

        <section className="au-card" style={{ display: "grid", gap: 8 }}>
          <h2 className="au-head" style={{ fontSize: 18 }}>Tips</h2>
          <ul style={{ paddingLeft: 20, listStyle: "disc", display: "grid", gap: 6 }}>
            {t.tips.map((tip) => <li key={tip} className="au-muted" style={{ fontSize: 14 }}>{tip}</li>)}
          </ul>
        </section>

        <section className="au-card" style={{ display: "grid", gap: 6 }}>
          <h2 className="au-head" style={{ fontSize: 18, marginBottom: 6 }}>Questions</h2>
          <div className="au-faq">
            {t.faq.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p className="au-muted" style={{ fontSize: 14, paddingBottom: 14 }}>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="au-card" style={{ display: "grid", gap: 10, justifyItems: "start" }}>
          <span className="au-icon red"><Zap size={16} /></span>
          <h3 className="au-head" style={{ fontSize: 18 }}>Use this flow with DMSpark</h3>
          <p className="au-muted" style={{ fontSize: 14 }}>Connect your Instagram professional account, build this flow in the visual builder and test it before it goes live.</p>
          <Link href="/" className="au-btn" style={{ padding: "11px 24px", fontSize: 15 }}>Get started</Link>
        </section>
      </div>
    </AuditShell>
  )
}
