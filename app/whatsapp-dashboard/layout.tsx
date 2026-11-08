"use client"

import { useState, useEffect } from "react"
import { useWhatsAppSession } from "@/hooks/use-whatsapp-session"
import { Loader2, ChevronLeft, ChevronRight, Compass, MessageSquare, LayoutDashboard, Zap, BarChart3, Settings, LogOut } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import { CelraLogo } from "@/components/ui/celra-logo"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BRAND_NAME } from "@/lib/site"

export default function WhatsAppDashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { waUsername, waUserId, logoutWhatsApp, isLoading } = useWhatsAppSession()
    const router = useRouter()
    const pathname = usePathname()
    const [isCollapsed, setIsCollapsed] = useState(false)

    // Redirect to landing page if not logged in
    useEffect(() => {
        if (!isLoading && !waUserId) {
            router.replace("/")
        }
    }, [isLoading, waUserId, router])

    const isActive = (path: string) => path === "/whatsapp-dashboard" ? pathname === path : pathname.startsWith(path)

    if (isLoading || !waUserId) {
        return (
            <div className="flex h-screen items-center justify-center bg-background text-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-brand" />
            </div>
        )
    }

    return (
        <div className="flex min-h-screen md:h-screen md:overflow-hidden bg-background text-foreground transition-colors duration-300 relative">
            
            {/* Collapse Toggle Button (Desktop Only) */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={cn(
                    "hidden md:inline-flex fixed top-[36px] z-[60] w-6 h-6 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground shadow-md hover:shadow-lg items-center justify-center cursor-pointer transition-all duration-300 hover:scale-110 active:scale-95",
                    isCollapsed ? "left-[52px]" : "left-[244px]"
                )}
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
                {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-brand" />
                ) : (
                    <ChevronLeft className="w-3.5 h-3.5 text-brand" />
                )}
            </button>

            {/* Desktop Sidebar (Celra themed) */}
            <div className={cn(
                "hidden md:flex md:flex-col md:fixed md:inset-y-0 z-40 transition-all duration-300",
                isCollapsed ? "md:w-16" : "md:w-64"
            )}>
                <aside className="flex flex-col bg-sidebar border-r border-sidebar-border text-sidebar-foreground h-full transition-all duration-300">
                    {/* Sidebar Header */}
                    <div className={cn("flex shrink-0 select-none items-center", isCollapsed ? "p-4 justify-center" : "p-6 gap-3")}>
                        <CelraLogo variant="mark" size={40} />
                        {!isCollapsed && (
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-black text-xl tracking-tight text-brand leading-none">
                                        {BRAND_NAME}
                                    </span>
                                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20 select-none animate-pulse shrink-0">
                                        WA
                                    </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase mt-1">
                                    WhatsApp Auto
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-sidebar-border mx-6" />

                    {/* Nav Items */}
                    <div className="flex-1 px-4 space-y-2 py-4 overflow-y-auto hover-scrollbar">
                        {!isCollapsed && (
                            <div className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Main</div>
                        )}
                        <NavItem
                            href="/whatsapp-dashboard"
                            icon={<LayoutDashboard className="w-4 h-4" />}
                            label="Dashboard"
                            active={isActive("/whatsapp-dashboard") && pathname === "/whatsapp-dashboard"}
                            isCollapsed={isCollapsed}
                        />
                        <NavItem
                            href="/whatsapp-dashboard/automations"
                            icon={<Zap className="w-4 h-4" />}
                            label="Automations"
                            active={isActive("/whatsapp-dashboard/automations")}
                            isCollapsed={isCollapsed}
                        />
                        <NavItem
                            href="/whatsapp-dashboard/inbox"
                            icon={<MessageSquare className="w-4 h-4" />}
                            label="Inbox"
                            active={isActive("/whatsapp-dashboard/inbox")}
                            isCollapsed={isCollapsed}
                        />
                        <NavItem
                            href="/whatsapp-dashboard/analytics"
                            icon={<BarChart3 className="w-4 h-4" />}
                            label="Analytics"
                            active={isActive("/whatsapp-dashboard/analytics")}
                            isCollapsed={isCollapsed}
                        />
                        <NavItem
                            href="/whatsapp-dashboard/settings"
                            icon={<Settings className="w-4 h-4" />}
                            label="Settings"
                            active={isActive("/whatsapp-dashboard/settings")}
                            isCollapsed={isCollapsed}
                        />
                    </div>

                    {/* Profile & Logout Footer */}
                    <div className="p-4 border-t border-sidebar-border bg-sidebar">
                        <div className={cn(
                            "flex items-center rounded-xl bg-sidebar-border/60 border border-sidebar-border group",
                            isCollapsed ? "justify-center p-2" : "gap-3 px-3 py-3"
                        )}>
                            <div className="w-9 h-9 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shadow-inner shrink-0 text-brand font-bold">
                                {waUsername ? waUsername.charAt(0).toUpperCase() : "W"}
                            </div>
                            {!isCollapsed && (
                                <>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-xs font-bold text-foreground truncate">{waUsername}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shadow-sm shadow-black/5" />
                                            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Active</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={logoutWhatsApp}
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors cursor-pointer"
                                    >
                                        <LogOut className="w-4 h-4" />
                                    </Button>
                                </>
                            )}
                        </div>
                        {isCollapsed && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={logoutWhatsApp}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors cursor-pointer mt-2 mx-auto block"
                                title="Logout"
                            >
                                <LogOut className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </aside>
            </div>

            {/* Main Content Area */}
            <div className={cn(
                "flex-1 flex flex-col transition-all duration-300",
                isCollapsed ? "md:pl-16" : "md:pl-64"
            )}>
                {/* Mobile Header (Visible only on small screens) */}
                <header className="md:hidden h-16 border-b border-border bg-card flex items-center justify-between px-4 sticky top-0 z-40">
                    <div className="flex items-center gap-2">
                        <CelraLogo variant="mark" size={32} />
                        <span className="font-black text-lg tracking-tighter text-brand">{BRAND_NAME} WA</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={logoutWhatsApp} className="text-muted-foreground hover:text-destructive">
                        <LogOut className="w-4 h-4" />
                    </Button>
                </header>

                <main className="flex-1 relative overflow-hidden h-[calc(100dvh-4rem)] md:h-full flex flex-col">
                    <div className="flex-1 overflow-y-auto hover-scrollbar w-full h-full flex flex-col relative">
                        
                        <div className="relative z-10 flex-1 flex flex-col">
                            {children}
                        </div>
                    </div>
                </main>
            </div>

        </div>
    )
}

function NavItem({
  icon,
  label,
  active = false,
  href,
  isCollapsed = false,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  href: string
  isCollapsed?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 font-semibold text-[13px] group relative overflow-hidden ",
        active 
          ? "bg-brand text-brand-foreground " 
          : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
        isCollapsed ? "justify-center px-2 hover:translate-x-0" : ""
      )}
      title={isCollapsed ? label : undefined}
    >
      {active && (
        <div className="absolute inset-0  translate-x-[-100%] animate-shimmer" />
      )}
      <span className={active ? "text-brand-foreground" : "text-muted-foreground group-hover:text-foreground transition-colors duration-200"}>{icon}</span>
      {!isCollapsed && <span>{label}</span>}
    </Link>
  )
}
