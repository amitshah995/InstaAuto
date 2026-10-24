import type { Metadata } from "next"
import Link from "next/link"
import { getSiteUrl } from "@/lib/site"

export const metadata: Metadata = {
  title: "Meta App Review — how DMSpark uses Instagram permissions",
  description: "What each Instagram permission is used for in DMSpark, what data we keep and how to test the app.",
}

const PERMISSIONS = [
  { name: "instagram_business_basic", use: "Identify the connected account (username, profile picture) after login." },
  { name: "instagram_business_manage_comments", use: "Read comments on the user's own posts so a keyword can trigger an automation, and post the public reply." },
  { name: "instagram_business_manage_messages", use: "Send the automated DM (private reply to a comment, or a reply inside the 24-hour window) and receive replies for flows." },
  { name: "instagram_business_manage_insights", use: "Show the account's follower count and growth chart on the Reports and Analytics pages." },
  { name: "instagram_business_content_publish", use: "Only if the user schedules a post or reel from the Publisher page." },
]

export default function MetaReviewPage() {
  const base = getSiteUrl()
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-12 font-sans text-neutral-900">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">How DMSpark uses Instagram permissions</h1>
        <p className="text-neutral-600">A plain summary for reviewers and for users who want to know what the app does with their account.</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Permissions and why we need them</h2>
        <ul className="space-y-3">
          {PERMISSIONS.map((p) => (
            <li key={p.name} className="rounded-xl border border-neutral-200 p-4">
              <code className="text-sm font-semibold">{p.name}</code>
              <p className="mt-1 text-sm text-neutral-600">{p.use}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Rules the app follows</h2>
        <ul className="list-disc space-y-1 pl-5 text-neutral-700">
          <li>A DM is sent only after the person comments or messages the account first.</li>
          <li>The 24-hour messaging window is respected; no promotional DMs outside it.</li>
          <li>The account owner can pause or delete any automation at any time.</li>
          <li>Access tokens are stored encrypted (AES-256-GCM) once the encryption key is configured.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Test it yourself (reviewer steps)</h2>
        <ol className="list-decimal space-y-1 pl-5 text-neutral-700">
          <li>Open <a className="underline" href={base}>{base}</a> and log in with Instagram.</li>
          <li>Go to Automations → create a rule with keyword <code>link</code> on any post.</li>
          <li>From a second account, comment “link” on that post.</li>
          <li>The comment gets a public reply and the commenter receives the DM.</li>
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Your data</h2>
        <p className="text-neutral-700">
          Read our <Link className="underline" href="/privacy">Privacy Policy</Link>, <Link className="underline" href="/terms">Terms</Link> and the{" "}
          <Link className="underline" href="/delete-data">data deletion page</Link>.
        </p>
      </section>
    </main>
  )
}
