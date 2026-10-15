import type { Metadata } from "next"
import Link from "next/link"
import { AuditForm } from "@/components/audit/audit-form"
import { AuditShell } from "@/components/audit/audit-theme"
import { User, CalendarClock, Heart, LayoutGrid, Hash, MessageCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "Free Instagram Audit",
  description:
    "Connect your Instagram account and get a free audit in seconds: profile, posting consistency, engagement, content mix and lead capture, scored with clear fixes. For Business and Creator accounts.",
  alternates: { canonical: "/instagram-audit" },
}

const CHECKS = [
  [User, "Profile & bio", "Is your bio, link and call to action turning visitors into followers?"],
  [CalendarClock, "Posting consistency", "How often you really post, versus what keeps you visible."],
  [Heart, "Engagement", "Likes and comments per post, compared with a working target for your size."],
  [LayoutGrid, "Content mix", "Reels, carousels and images, and whether you are reaching new people."],
  [Hash, "Captions & hashtags", "Hooks, length, calls to action and hashtag use."],
  [MessageCircle, "Lead capture", "How many of your posts turn attention into conversations and sales."],
] as const

export default function InstagramAuditPage() {
  return (
    <AuditShell>
      <section className="au-wrap" style={{ paddingTop: 72, paddingBottom: 40, textAlign: "center" }}>
        <span className="au-pill">Free · Business & Creator accounts</span>
        <h1 className="au-head" style={{ fontSize: "clamp(34px,6vw,56px)", lineHeight: 1.08, margin: "18px auto 0", maxWidth: 760, fontWeight: 800 }}>
          Free Instagram audit
        </h1>
        <p className="au-muted" style={{ fontSize: 18, margin: "16px auto 0", maxWidth: 560 }}>
          Connect your Instagram account and get your score in seconds, with the exact fixes for every issue.
        </p>
        <div style={{ marginTop: 32 }}>
          <AuditForm />
        </div>
        <p className="au-muted" style={{ fontSize: 12, margin: "18px auto 0", maxWidth: 620 }}>
          Switching to a Professional account is free. You sign in on Instagram, so we never see your password. The audit
          only reads your profile and recent posts; we do not post anything. Instagram will also list the permissions
          DMSpark uses for comment and DM automation.
        </p>
      </section>

      <section className="au-wrap" style={{ paddingBottom: 80 }}>
        <h2 className="au-head" style={{ fontSize: 22, textAlign: "center", marginBottom: 20 }}>What we check</h2>
        <ul className="au-grid2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {CHECKS.map(([Icon, title, text]) => (
            <li key={title} className="au-card" style={{ padding: 20, display: "flex", gap: 14 }}>
              <span className="au-icon red"><Icon size={16} /></span>
              <div>
                <p className="au-head" style={{ fontSize: 16 }}>{title}</p>
                <p className="au-muted" style={{ fontSize: 14, marginTop: 4 }}>{text}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="au-muted" style={{ textAlign: "center", fontSize: 14, marginTop: 40 }}>
          Built by <Link href="/" style={{ color: "#fff", textDecoration: "underline" }}>DMSpark</Link>, the Instagram automation
          platform for comment and DM replies.
        </p>
      </section>
    </AuditShell>
  )
}
