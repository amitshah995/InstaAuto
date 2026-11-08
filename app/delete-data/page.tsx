import Link from "next/link"
import { SUPPORT_EMAIL } from "@/lib/site"
import { PageShell } from "@/components/marketing/page-shell"
import { ArrowLeft, Trash2, ShieldAlert, Mail, Info, RefreshCw, Key } from "lucide-react"
import { BRAND_NAME } from "@/lib/site"

export const metadata = { title: "Delete my data", description: `How to delete your ${BRAND_NAME} data and revoke Instagram access.`, alternates: { canonical: "./" } }

export default function DataDeletionInstructions() {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-c-brand-soft border border-destructive/20 text-c-ink text-[10px] uppercase font-bold tracking-wider">
            <Trash2 className="w-3 h-3" /> Data deletion
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-c-brand">
            Data Deletion Instructions
          </h1>
          <p className="text-c-muted text-xs font-medium">Last updated: June 2026 • Version 2.0</p>
        </div>

        {/* Introduction */}
        <p className="text-sm text-c-ink leading-relaxed max-w-2xl font-medium">
          {BRAND_NAME} values your privacy and follows the Meta Platform Terms. We provide a simple, transparent, and direct way for you to delete all your connected Instagram account data from our databases at any time.
        </p>

        {/* Main Content Sections */}
        <div className="space-y-6">
          
          {/* Card 1: How to Delete */}
          <div className="p-6 rounded-2xl border border-c-line bg-c-surface  space-y-4">
            <div className="flex items-center gap-3 border-b border-c-line pb-3">
              <div className="w-8 h-8 rounded-lg bg-c-brand-soft flex items-center justify-center border border-destructive/20">
                <Trash2 className="w-4 h-4 text-c-ink" />
              </div>
              <h2 className="text-lg font-bold text-c-ink tracking-tight">How to Disconnect and Delete Your Data:</h2>
            </div>
            
            <div className="space-y-4 text-xs text-c-muted">
              {/* Step 1 */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-c-soft flex items-center justify-center font-bold text-c-ink shrink-0 mt-0.5">1</div>
                <div className="space-y-1">
                  <h4 className="text-c-ink font-bold">Log out (optional):</h4>
                  <p>In your {BRAND_NAME} dashboard, open Settings and use Log out. This only ends your session in this browser; it does not delete data and your automations keep running.</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-c-soft flex items-center justify-center font-bold text-c-ink shrink-0 mt-0.5">2</div>
                <div className="space-y-1">
                  <h4 className="text-c-ink font-bold">Remove {BRAND_NAME} App from Instagram:</h4>
                  <p>Go to Instagram Settings, open Apps and Websites, find {BRAND_NAME} and tap Remove. This revokes our access token. If you also choose to delete your data there, Instagram sends us a signed deletion request and we delete your account data (automations, conversations, contacts, links, shop pages, reports and your account record).</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-c-soft flex items-center justify-center font-bold text-c-ink shrink-0 mt-0.5">3</div>
                <div className="space-y-1">
                  <h4 className="text-c-ink font-bold">Request Manual Purge:</h4>
                  <p>To have your data deleted directly, or if the steps above do not work, email <span className="text-c-ink font-semibold underline">{SUPPORT_EMAIL}</span> with your Instagram username. We aim to complete deletion within 30 days.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: What is deleted */}
          <div className="p-6 rounded-2xl border border-c-line bg-c-surface  space-y-4">
            <div className="flex items-center gap-3 border-b border-c-line pb-3">
              <div className="w-8 h-8 rounded-lg bg-c-brand-soft flex items-center justify-center border border-brand/20">
                <Info className="w-4 h-4 text-c-brand" />
              </div>
              <h2 className="text-lg font-bold text-c-ink tracking-tight">What Data Will Be Deleted?</h2>
            </div>
            <p className="text-xs text-c-muted leading-relaxed">
              Upon requesting deletion or disconnecting your account, the following information is permanently erased from our database:
            </p>
            <ul className="list-disc list-inside space-y-2 text-xs text-c-muted pl-2">
              <li><span className="text-c-ink font-semibold">Credentials:</span> Your Instagram Business/Creator Account Access Tokens.</li>
              <li><span className="text-c-ink font-semibold">Profile Logs:</span> Your Instagram user ID, username, and cache.</li>
              <li><span className="text-c-ink font-semibold">Activity Records:</span> Webhook-received messages, comments, and story logs.</li>
              <li><span className="text-c-ink font-semibold">Rules:</span> All custom trigger rules and dynamic response settings you constructed.</li>
            </ul>
          </div>

          {/* Contact Card */}
          <div className="p-6 rounded-2xl border border-c-line bg-c-brand-soft  flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-c-ink">Need help with your data deletion?</h3>
              <p className="text-xs text-c-muted">Send us a direct request and we will purge your data within 24 hours.</p>
            </div>
            <a 
              href={`mailto:${SUPPORT_EMAIL}`} 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-c-accent text-c-accent-ink font-bold text-xs hover:bg-c-soft hover:scale-105 transition-all duration-200"
            >
              <Mail className="w-4 h-4" /> Request Purge via Email
            </a>
          </div>

        </div>

      </div>
    </div>
    </PageShell>
  )
}
