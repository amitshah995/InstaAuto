import type { Metadata } from "next"
import Link from "next/link"
import { AuditForm } from "@/components/audit/audit-form"

export const metadata: Metadata = {
  title: "Free Instagram Audit",
  description:
    "Get a free Instagram audit in seconds: profile, posting consistency, engagement, content mix and lead capture, scored with clear fixes. Works for public Business and Creator accounts.",
  alternates: { canonical: "/instagram-audit" },
}

const CHECKS = [
  ["Profile & bio", "Is your bio, link and call to action turning visitors into followers?"],
  ["Posting consistency", "How often you really post, versus what keeps you visible."],
  ["Engagement", "Likes and comments per post, compared with a working target for your size."],
  ["Content mix", "Reels, carousels and images, and whether you are reaching new people."],
  ["Captions & hashtags", "Hooks, length, calls to action and hashtag use."],
  ["Lead capture", "How many of your posts turn attention into conversations and sales."],
]

export default function InstagramAuditPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-3xl px-4 pt-20 pb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-balance">Free Instagram audit</h1>
        <p className="mt-4 text-lg text-muted-foreground text-balance">
          Enter your username. Get your score in seconds, then unlock the full report with fixes for every issue.
        </p>
        <div className="mt-8">
          <AuditForm />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Works for public Business and Creator accounts. No password needed. Switching to a Professional account is free.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-20">
        <h2 className="text-xl font-semibold text-center mb-6">What we check</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {CHECKS.map(([title, text]) => (
            <li key={title} className="rounded-xl border bg-card p-4">
              <p className="font-medium">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Built by <Link href="/" className="underline underline-offset-4">DMSpark</Link>, the Instagram automation
          platform for comment and DM replies.
        </p>
      </section>
    </main>
  )
}
