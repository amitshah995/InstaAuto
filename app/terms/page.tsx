import Link from "next/link"
import { SUPPORT_EMAIL } from "@/lib/site"
import { PageShell } from "@/components/marketing/page-shell"
import { ArrowLeft, FileText, CheckCircle, AlertTriangle, HelpCircle, UserCheck, ShieldAlert, Mail } from "lucide-react"
import { BRAND_NAME } from "@/lib/site"

export const metadata = { title: "Terms of Service", description: `The terms for using ${BRAND_NAME}.`, alternates: { canonical: "./" } }

export default function TermsOfService() {
  return (
    <PageShell strip={false}>
    <div className="px-4 py-10 md:py-16 text-c-ink">
      <div className="max-w-4xl mx-auto space-y-10 relative z-10 animate-in fade-in duration-700">
        
        {/* Back Navigation */}
        <div>
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-xs font-semibold text-c-muted hover:text-c-ink transition-all hover:translate-x-[-4px] duration-200"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>

        {/* Header */}
        <div className="space-y-3 border-b border-c-line pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-c-brand-soft border border-brand/20 text-c-brand text-[10px] uppercase font-bold tracking-wider">
            <FileText className="w-3 h-3" /> Plain-English terms
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-c-brand">
            Terms of Service
          </h1>
          <p className="text-c-muted text-xs font-medium">Last updated: November 2026 • Version 2.1</p>
        </div>

        {/* Introduction */}
        <p className="text-sm text-c-ink leading-relaxed max-w-2xl font-medium">
          Welcome to {BRAND_NAME}. By registering, accessing, or using our automation services, you explicitly agree to be bound by the terms and conditions outlined below.
        </p>

        {/* Main Content Sections */}
        <div className="space-y-6">
          
          {/* Card 1 */}
          <div className="p-6 rounded-2xl border border-c-line bg-c-surface  space-y-4">
            <div className="flex items-center gap-3 border-b border-c-line pb-3">
              <div className="w-8 h-8 rounded-lg bg-c-brand-soft flex items-center justify-center border border-c-line">
                <UserCheck className="w-4 h-4 text-c-brand" />
              </div>
              <h2 className="text-lg font-bold text-c-ink tracking-tight">1. Acceptance of Terms & Eligibility</h2>
            </div>
            <p className="text-xs text-c-muted leading-relaxed">
              By using our service, you affirm that you are at least 18 years of age and possess the legal authority to bind your business or creator page to these terms. If you do not accept these terms in their entirety, you must immediately cease all usage of {BRAND_NAME}.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl border border-c-line bg-c-surface  space-y-4">
            <div className="flex items-center gap-3 border-b border-c-line pb-3">
              <div className="w-8 h-8 rounded-lg bg-c-brand-soft flex items-center justify-center border border-brand/20">
                <CheckCircle className="w-4 h-4 text-c-brand" />
              </div>
              <h2 className="text-lg font-bold text-c-ink tracking-tight">2. Scope of Service & Meta Compliance</h2>
            </div>
            <p className="text-xs text-c-muted leading-relaxed">
              {BRAND_NAME} provides highly optimized messaging and commenting automation platforms via official Meta API integrations.
            </p>
            <ul className="list-disc list-inside space-y-2 text-xs text-c-muted pl-2">
              <li><span className="text-c-ink font-semibold">Official API:</span> We comply strictly with Meta's developer protocols. We do not engage in browser automation, data scraping, or unofficial hacks.</li>
              <li><span className="text-c-ink font-semibold">Platform Terms:</span> You agree to abide by the <a href="https://developers.facebook.com/terms/" target="_blank" rel="noreferrer" className="text-c-brand hover:underline">Meta Platform Terms</a> and <a href="https://help.instagram.com/478798032474962" target="_blank" rel="noreferrer" className="text-c-brand hover:underline">Instagram Community Guidelines</a>. Any violation of Meta's terms on your account may lead to suspension of our service.</li>
            </ul>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl border border-c-line bg-c-surface  space-y-4">
            <div className="flex items-center gap-3 border-b border-c-line pb-3">
              <div className="w-8 h-8 rounded-lg bg-c-brand-soft flex items-center justify-center border border-c-line">
                <AlertTriangle className="w-4 h-4 text-c-brand" />
              </div>
              <h2 className="text-lg font-bold text-c-ink tracking-tight">3. User Responsibilities & Prohibited Acts</h2>
            </div>
            <p className="text-xs text-c-muted leading-relaxed">
              As a user of our platform, you hold exclusive responsibility for all automation configurations:
            </p>
            <ul className="list-disc list-inside space-y-2 text-xs text-c-muted pl-2">
              <li><span className="text-c-ink font-semibold">Content Ownership:</span> You are entirely responsible for the text, links, and replies sent by your bot.</li>
              <li><span className="text-c-ink font-semibold">Anti-Spam Policy:</span> You must not configure automations designed to harass, spam, send unsolicited promotional messages, or distribute malicious software.</li>
              <li><span className="text-c-ink font-semibold">Account Maintenance:</span> You are responsible for keeping your Instagram account status active and healthy.</li>
            </ul>
          </div>

          {/* Card 4 */}
          <div className="p-6 rounded-2xl border border-c-line bg-c-surface  space-y-4">
            <div className="flex items-center gap-3 border-b border-c-line pb-3">
              <div className="w-8 h-8 rounded-lg bg-c-brand-soft flex items-center justify-center border border-destructive/20">
                <ShieldAlert className="w-4 h-4 text-c-ink" />
              </div>
              <h2 className="text-lg font-bold text-c-ink tracking-tight">4. Limitations of Liability</h2>
            </div>
            <p className="text-xs text-c-muted leading-relaxed">
              {BRAND_NAME} is provided "as is" and "as available" without any warranty of any kind. Meta's platform features, policies, and API availability can change at any time.
            </p>
            <p className="text-xs text-c-muted leading-relaxed">
              We shall not be liable for any direct, indirect, incidental, or consequential damages resulting from Meta API outages, account suspensions, or automated messaging choices made under your account credentials.
            </p>
          </div>

          {/* Card 5 */}
          <div className="p-6 rounded-2xl border border-c-line bg-c-surface  space-y-4">
            <div className="flex items-center gap-3 border-b border-c-line pb-3">
              <div className="w-8 h-8 rounded-lg bg-c-brand-soft flex items-center justify-center border border-brand/20">
                <HelpCircle className="w-4 h-4 text-c-brand" />
              </div>
              <h2 className="text-lg font-bold text-c-ink tracking-tight">5. Term Modifications</h2>
            </div>
            <p className="text-xs text-c-muted leading-relaxed">
              We reserve the right to modify or replace these terms at any time. We will publish notifications of terms updates directly on this portal. Continued utilization of the service following updates denotes formal acceptance of modified terms.
            </p>
          </div>

          {/* Contact Card */}
          <div className="p-6 rounded-2xl border border-c-line bg-c-brand-soft  flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-c-ink">Have terms-related questions?</h3>
              <p className="text-xs text-c-muted">Our customer support and legal team is here to help.</p>
            </div>
            <a 
              href={`mailto:${SUPPORT_EMAIL}`} 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-c-accent text-c-accent-ink font-bold text-xs hover:bg-c-soft hover:scale-105 transition-all duration-200"
            >
              <Mail className="w-4 h-4" /> Contact Support
            </a>
          </div>

        </div>

      </div>
    </div>
    </PageShell>
  )
}
