"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { 
  LayoutDashboard, 
  Zap, 
  LogOut, 
  Settings, 
  BarChart3, 
  MessageSquare,
  Snowflake,
  Clapperboard,
  Sun,
  Moon,
  Compass,
  Users,
  Link2,
  ClipboardCheck,
  Wrench
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { CelraLogo } from "@/components/ui/celra-logo"
import { BRAND_NAME } from "@/lib/site"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  username?: string
  profilePictureUrl?: string
  className?: string
  onLogout?: () => void
  onNavigate?: () => void
  isCollapsed?: boolean
}

export function Sidebar({ className, username = "Demo User", profilePictureUrl, onLogout, onNavigate, isCollapsed = false, ...props }: SidebarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isActive = (path: string) => path === "/dashboard" ? pathname === path : pathname.startsWith(path)

  return (
    <aside className={cn("flex flex-col bg-sidebar border-r border-sidebar-border text-sidebar-foreground h-full transition-all duration-300", className)} {...props}>
      <div className={cn("flex shrink-0 select-none", isCollapsed ? "p-4 justify-center items-center" : "p-6 items-center gap-3")}>
        {isCollapsed ? (
          <CelraLogo variant="mark" size={36} />
        ) : (
          <CelraLogo variant="full" size={34} className="text-sidebar-foreground" />
        )}
      </div>

      {/* Subtle Horizontal Divider */}
      <div className="h-px bg-sidebar-border mx-6" />

      <div className="flex-1 px-4 space-y-2 py-4 overflow-y-auto hover-scrollbar">
        {!isCollapsed ? (
          <div className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Main</div>
        ) : (
          <div className="h-px bg-sidebar-border my-2" />
        )}
        <NavItem
          href="/dashboard"
          icon={<LayoutDashboard className="w-4 h-4" />}
          label="Dashboard"
          active={isActive("/dashboard")}
          onClick={onNavigate}
          isCollapsed={isCollapsed}
        />
        <NavItem
          href="/dashboard/automations"
          icon={<Zap className="w-4 h-4" />}
          label="Automations"
          active={isActive("/dashboard/automations")}
          onClick={onNavigate}
          isCollapsed={isCollapsed}
        />
        <NavItem
          href="/dashboard/flow-builder"
          icon={<Compass className="w-4 h-4" />}
          label="Flow Builder"
          active={isActive("/dashboard/flow-builder")}
          onClick={onNavigate}
          isCollapsed={isCollapsed}
        />
        <NavItem
          href="/dashboard/inbox"
          icon={<MessageSquare className="w-4 h-4" />}
          label="Inbox"
          active={isActive("/dashboard/inbox")}
          onClick={onNavigate}
          isCollapsed={isCollapsed}
        />
        <NavItem
          href="/dashboard/contacts"
          icon={<Users className="w-4 h-4" />}
          label="Contacts"
          active={isActive("/dashboard/contacts")}
          onClick={onNavigate}
          isCollapsed={isCollapsed}
        />
        <NavItem
          href="/dashboard/links"
          icon={<Link2 className="w-4 h-4" />}
          label="Links"
          active={isActive("/dashboard/links")}
          onClick={onNavigate}
          isCollapsed={isCollapsed}
        />
        <NavItem
          href="/dashboard/studio"
          icon={<Clapperboard className="w-4 h-4" />}
          label="Studio"
          active={isActive("/dashboard/studio")}
          onClick={onNavigate}
          isCollapsed={isCollapsed}
        />
        {/* Publisher & Ice Breakers hidden during App Review — restore after approval */}
        <NavItem
          href="/dashboard/analytics"
          icon={<BarChart3 className="w-4 h-4" />}
          label="Analytics"
          active={isActive("/dashboard/analytics")}
          onClick={onNavigate}
          isCollapsed={isCollapsed}
        />
        <NavItem
          href="/instagram-audit"
          icon={<ClipboardCheck className="w-4 h-4" />}
          label="Audit"
          active={isActive("/instagram-audit") || isActive("/audit")}
          onClick={onNavigate}
          isCollapsed={isCollapsed}
        />
        <NavItem
          href="/tools"
          icon={<Wrench className="w-4 h-4" />}
          label="Tools"
          active={isActive("/tools")}
          onClick={onNavigate}
          isCollapsed={isCollapsed}
        />
        <NavItem
          href="/dashboard/help"
          icon={<Compass className="w-4 h-4 text-brand" />}
          label="How to Use"
          active={isActive("/dashboard/help")}
          onClick={onNavigate}
          isCollapsed={isCollapsed}
        />

        {!isCollapsed ? (
          <div className="px-2 mb-2 mt-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
            System
          </div>
        ) : (
          <div className="h-px bg-sidebar-border my-4" />
        )}
        <NavItem
          href="/dashboard/settings"
          icon={<Settings className="w-4 h-4" />}
          label="Settings"
          active={isActive("/dashboard/settings")}
          onClick={onNavigate}
          isCollapsed={isCollapsed}
        />

        {/* Dynamic Light/Dark Switcher */}
        <div className="pt-4 border-t border-sidebar-border mt-4">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={cn(
              "flex items-center rounded-lg text-sidebar-foreground/80 hover:text-foreground hover:bg-sidebar-accent/60 transition-all duration-300 font-medium text-[13px] group cursor-pointer",
              isCollapsed ? "justify-center p-2.5 w-full" : "w-full justify-between px-4 py-2.5"
            )}
            title={isCollapsed ? "Toggle Theme" : undefined}
          >
            <div className="flex items-center gap-3">
              {mounted && theme === "dark" ? (
                <Sun className="w-4 h-4 transition-transform duration-500 rotate-0 group-hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 transition-transform duration-500 rotate-0 group-hover:-rotate-12" />
              )}
              {!isCollapsed && <span>Theme Mode</span>}
            </div>
            {!isCollapsed && (
              <div className="w-8 h-4 rounded-full bg-sidebar-border relative p-0.5 transition-colors group-hover:bg-sidebar-accent border border-sidebar-border/50">
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full bg-foreground shadow-sm transition-all",
                  mounted && theme === "dark" ? "translate-x-3.5" : "translate-x-0"
                )} />
              </div>
            )}
          </button>
        </div>
      </div>

      <div className="p-4 border-t border-sidebar-border bg-sidebar/50">
        <div className={cn(
          "flex items-center rounded-xl bg-sidebar-accent/30 border border-sidebar-border backdrop-blur-sm group",
          isCollapsed ? "justify-center p-2" : "gap-3 px-3 py-3"
        )}>
          <div className="w-9 h-9 rounded-full bg-secondary border border-sidebar-border flex items-center justify-center shadow-inner shrink-0 overflow-hidden ring-2 ring-offset-1 ring-offset-sidebar ring-primary/30 group-hover:ring-primary/60 transition-all duration-300">
            {profilePictureUrl ? (
              <img src={profilePictureUrl} alt={username} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-foreground">{username.charAt(0).toUpperCase()}</span>
            )}
          </div>
          {!isCollapsed && (
            <>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold text-foreground truncate">{username}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shadow-sm shadow-black/5" />
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Active</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onLogout}
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
            onClick={onLogout}
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors cursor-pointer mt-2 mx-auto block"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        )}
      </div>
    </aside>
  )
}

function NavItem({
  icon,
  label,
  active = false,
  href,
  onClick,
  isCollapsed = false,
  badge,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  href: string
  onClick?: () => void
  isCollapsed?: boolean
  badge?: string
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 font-semibold text-[13px] group relative overflow-hidden ",
        active 
          ? "bg-primary text-primary-foreground " 
          : "text-sidebar-foreground/80 hover:text-foreground hover:bg-sidebar-accent/50 ",
        isCollapsed ? "justify-center px-2 hover:translate-x-0" : ""
      )}
      title={isCollapsed ? label : undefined}
    >
      <span className={active ? "text-primary-foreground" : "text-sidebar-foreground/75 group-hover:text-foreground transition-colors duration-200"}>{icon}</span>
      {!isCollapsed && (
        <div className="flex-1 flex items-center justify-between">
          <span>{label}</span>
          {badge && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-sidebar-border/80 border border-sidebar-border/20 text-muted-foreground font-black uppercase tracking-wider scale-90 origin-right transition-colors duration-200">
              {badge}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}

