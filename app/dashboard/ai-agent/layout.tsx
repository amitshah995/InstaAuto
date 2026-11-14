"use client"

/**
 * Shell for the AI Sales Agent feature: heading and tab bar (Overview, Setup, Knowledge, Conversations, Leads, Test). Each tab is its
 * own route under /dashboard/ai-agent so links can be shared and the mobile back button works.
 */
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bot } from "lucide-react"
import { cn } from "@/lib/utils"
import { HEADING } from "@/components/ai-agent/shared"

const TABS = [
  { href: "/dashboard/ai-agent", label: "Overview", exact: true },
  { href: "/dashboard/ai-agent/setup", label: "Setup" },
  { href: "/dashboard/ai-agent/knowledge", label: "Knowledge" },
  { href: "/dashboard/ai-agent/conversations", label: "Conversations" },
  { href: "/dashboard/ai-agent/leads", label: "Leads" },
  { href: "/dashboard/ai-agent/test", label: "Test the agent" },
]

export default function AiAgentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-foreground"><Bot className="h-5 w-5" /></span>
        <div>
          <h1 className={`${HEADING} text-2xl font-bold text-foreground sm:text-3xl`}>AI Sales Agent</h1>
          <p className="text-sm text-muted-foreground">Answers from your own Reel details, asks before taking a number, hands off to you when needed.</p>
        </div>
      </div>
      <nav aria-label="AI Sales Agent sections" className="-mx-4 mt-5 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href)
          return (
            <Link key={t.href} href={t.href} className={cn("shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors", active ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t.label}
            </Link>
          )
        })}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  )
}
