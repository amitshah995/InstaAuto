"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Compass,
  Zap,
  MessageSquare,
  ArrowRight,
  Sparkles,
  ArrowUpRight,
  Play,
  Pause,
  UserCheck,
  Laptop,
  Smartphone,
  TrendingUp,
  Info,
  Flame,
  Inbox,
  Heart,
  BarChart3,
  Users,
  Send,
  Activity,
  LayoutDashboard,
  Settings,
  Menu,
  MessageCircle,
  MousePointerClick
} from "lucide-react"
import Link from "next/link"
import { BRAND_NAME, getSiteHost } from "@/lib/site"
import { CelraLogo } from "@/components/ui/celra-logo"

export default function HowToUsePage() {
  const [isVisible, setIsVisible] = useState(false)
  const [deviceMode, setDeviceMode] = useState<"mobile" | "laptop">("mobile")
  const [animationStep, setAnimationStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setAnimationStep((prev) => (prev + 1) % 5)
    }, 4500)
    return () => clearInterval(interval)
  }, [isPlaying])

  const handleStepSelect = (stepIdx: number) => {
    setIsPlaying(false)
    setAnimationStep(stepIdx)
  }

  const onboardingSteps = [
    {
      num: 1,
      stepLabel: "01",
      title: "Connect your account Profile",
      desc: "Connect your Instagram Creator or Business account in seconds through Meta OAuth verification.",
      icon: <UserCheck className="w-5 h-5 text-brand" />,
      action: "Integrate Now",
      href: "/dashboard"
    },
    {
      num: 2,
      stepLabel: "02",
      title: "Set Keyword Triggers",
      desc: "Specify exact keyword matches (like 'coupon', 'price') that watch comments or story tags.",
      icon: <Zap className="w-5 h-5 text-warn" />,
      action: "Configure Keywords",
      href: "/dashboard/flow-builder"
    },
    {
      num: 3,
      stepLabel: "03",
      title: "Construct Responses",
      desc: "Design templates with links, dynamic discount coupon codes, and automated reply text blocks.",
      icon: <MessageSquare className="w-5 h-5 text-brand" />,
      action: "Write DM Templates",
      href: "/dashboard/automations"
    },
    {
      num: 4,
      stepLabel: "04",
      title: "Monitor Performance",
      desc: "Watch analytics capture automated messages sent, conversion triggers, and target reach charts.",
      icon: <Sparkles className="w-5 h-5 text-brand" />,
      action: "Analyze Traffic",
      href: "/dashboard/analytics"
    }
  ]

  // ─── Shared Screen Content Components ───
  const DashboardScreen = () => (
    <div className="flex-1 p-2 flex flex-col gap-1.5 overflow-hidden text-left">
      <div>
        <div className="flex items-center gap-1 mb-0.5">
          <Sparkles className="w-2 h-2 text-brand" />
          <span className="text-[5px] font-bold text-brand uppercase tracking-widest">Good Morning</span>
        </div>
        <p className="font-black text-[8px] text-slate-800 leading-tight">Welcome back, <span className="text-brand">user</span></p>
        <p className="text-[5px] text-slate-400 flex items-center gap-0.5 mt-0.5">
          <span className="w-1 h-1 rounded-full bg-brand animate-pulse" /> Your automations are running smoothly.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {[
          { label: "Automations", val: "12", color: "var(--chart-1)", icon: <Zap className="w-2 h-2" /> },
          { label: "Messages", val: "1.4K", color: "var(--chart-1)", icon: <Send className="w-2 h-2" /> },
          { label: "Triggers", val: "8", color: "var(--chart-1)", icon: <Activity className="w-2 h-2" /> },
          { label: "Audience", val: "320", color: "var(--chart-1)", icon: <Users className="w-2 h-2" /> },
        ].map((s, i) => (
          <div key={i} className="bg-white p-1.5 rounded border border-slate-200/60 shadow-sm">
            <div className="flex items-center justify-between mb-0.5">
              <span className="p-0.5 rounded bg-brand-soft text-brand">{s.icon}</span>
              <span className="text-[4px] font-bold text-slate-400 uppercase">Active</span>
            </div>
            <div className="text-[9px] font-black text-slate-800 leading-tight">{s.val}</div>
            <div className="text-[4.5px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="bg-white p-1.5 rounded border border-slate-200/60 shadow-sm flex-1">
        <div className="flex items-center justify-between border-b border-slate-100 pb-0.5 mb-1">
          <span className="text-[5px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-0.5">
            <TrendingUp className="w-2 h-2 text-brand" /> Recent Activity
          </span>
          <span className="text-[4px] text-brand font-bold">View All</span>
        </div>
        {[
          { user: "@shop_lover", msg: "Auto-reply sent", time: "2m ago" },
          { user: "@insta_deal", msg: "Coupon delivered", time: "5m ago" },
        ].map((a, i) => (
          <div key={i} className="flex items-center justify-between py-0.5 text-[5px]">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-brand-soft flex items-center justify-center">
                <MessageCircle className="w-1.5 h-1.5 text-brand" />
              </div>
              <div>
                <span className="font-bold text-slate-700">{a.user}</span>
                <span className="text-slate-400 ml-0.5">{a.msg}</span>
              </div>
            </div>
            <span className="text-slate-300 font-semibold">{a.time}</span>
          </div>
        ))}
      </div>
    </div>
  )

  const ConnectScreen = () => (
    <div className="flex-1 p-2 flex items-center justify-center">
      <div className="bg-white rounded-xl border border-slate-200 p-3 text-center space-y-2 shadow-lg w-full max-w-[160px] animate-in zoom-in-95 duration-300">
        <div className="w-8 h-8 rounded-full bg-brand p-0.5 mx-auto">
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
            <UserCheck className="w-3.5 h-3.5 text-brand" />
          </div>
        </div>
        <div>
          <h4 className="text-[8px] font-extrabold text-slate-800">Connect your account</h4>
          <p className="text-[5.5px] text-slate-500 font-medium mt-0.5 leading-relaxed">
            Link your Business or Creator account to enable DM automation.
          </p>
        </div>
        <div className="h-5 w-full rounded-lg bg-primary flex items-center justify-center gap-1 text-primary-foreground text-[6px] font-bold shadow-md relative">
          Connect Account <ArrowRight className="w-2 h-2" />
          <MousePointerClick className="w-2.5 h-2.5 text-brand absolute -bottom-1 -right-1 animate-bounce" />
        </div>
        <p className="text-[4px] text-slate-400 font-bold uppercase tracking-wider">Secured via Meta OAuth 2.0</p>
      </div>
    </div>
  )

  const AutomationsScreen = () => (
    <div className="flex-1 p-2 flex flex-col gap-1.5 overflow-hidden text-left">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-black text-[8px] text-slate-800 flex items-center gap-0.5"><Zap className="w-2 h-2 text-warn" /> Automations</p>
          <p className="text-[5px] text-slate-400">3 active rules</p>
        </div>
        <div className="h-4 px-1.5 rounded-md bg-primary text-primary-foreground text-[5px] font-bold flex items-center gap-0.5 shadow-sm">+ New Rule</div>
      </div>
      <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-md">
        {["Comments", "DMs", "Stories"].map((t, i) => (
          <div key={i} className={`flex-1 text-center text-[5px] py-0.5 rounded font-bold ${i === 0 ? "bg-white text-slate-800 shadow-sm" : "text-slate-400"}`}>{t}</div>
        ))}
      </div>
      {[
        { keyword: "coupon", reply: "50% discount code: CELRA50", status: "Active" },
        { keyword: "price", reply: "Check our latest catalog!", status: "Active" },
        { keyword: "info", reply: `Visit ${getSiteHost()}`, status: "Paused" },
      ].map((rule, i) => (
        <div key={i} className="bg-white rounded-lg border border-slate-200/60 p-1.5 shadow-sm">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[6px] font-extrabold text-slate-700 flex items-center gap-0.5">
              <Zap className="w-2 h-2 text-warn" /> &quot;{rule.keyword}&quot;
            </span>
            <span className={`text-[4px] px-1 py-0.5 rounded-full font-bold ${rule.status === "Active" ? "bg-brand-soft text-brand border border-brand" : "bg-slate-100 text-slate-400 border border-slate-200"}`}>
              {rule.status}
            </span>
          </div>
          <p className="text-[5px] text-slate-500 truncate">→ {rule.reply}</p>
        </div>
      ))}
    </div>
  )

  const ResponseScreen = () => (
    <div className="flex-1 p-2 flex flex-col justify-end gap-1.5 overflow-hidden text-left">
      <div className="flex items-start gap-1">
        <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[6px] font-bold text-slate-500 shrink-0">U</div>
        <div className="bg-white rounded-xl rounded-tl-none p-1.5 border border-slate-200/50 shadow-sm max-w-[80%]">
          <p className="text-[6px] font-black text-slate-800">@insta_shopper</p>
          <p className="text-[7px] text-slate-600 font-semibold mt-0.5 flex items-center gap-0.5">
            coupon <Flame className="w-2 h-2 text-warn fill-current" />
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 self-end">
        <div className="flex items-center gap-1 bg-slate-100 rounded-full px-1.5 py-0.5">
          <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0s' }} />
          <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
          <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>
      <div className="flex items-start gap-1 justify-end">
        <div className="bg-primary text-primary-foreground rounded-xl rounded-tr-none p-1.5 shadow-md max-w-[85%]">
          <div className="flex items-center gap-0.5 mb-0.5">
            <CelraLogo variant="mark" size={8} />
            <span className="text-[5px] font-black uppercase tracking-wider opacity-85">{BRAND_NAME}</span>
          </div>
          <p className="text-[7px] font-semibold leading-relaxed">
            Here&apos;s your 50% discount code: <span className="font-black">CELRA50</span> 🎟️
          </p>
          <div className="mt-1 pt-1 border-t border-white/20">
            <span className="text-[5px] font-black uppercase tracking-wider bg-white/10 px-1 py-0.5 rounded flex items-center justify-between">
              Claim Coupon <ArrowUpRight className="w-1.5 h-1.5" />
            </span>
          </div>
        </div>
        <div className="w-4 h-4 rounded-full bg-brand-soft flex items-center justify-center p-0.5 border border-brand/30 shrink-0">
          <CelraLogo variant="mark" size={28} className="h-full w-full" />
        </div>
      </div>
      <div className="self-center bg-brand-soft border border-brand px-2 py-0.5 rounded-full text-brand text-[5px] font-black uppercase flex items-center gap-0.5 animate-pulse">
        <Heart className="w-2 h-2 text-destructive fill-current" /> Auto-Reply Delivered!
      </div>
    </div>
  )

  const AnalyticsScreen = () => (
    <div className="flex-1 p-2 flex flex-col gap-1.5 overflow-hidden text-left">
      <div>
        <p className="font-black text-[8px] text-slate-800">Deep Analytics</p>
        <p className="text-[5px] text-slate-400">Real-time engagement insights</p>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {[
          { label: "Replies", val: "1.4K", color: "text-brand" },
          { label: "Audience", val: "320", color: "text-brand" },
          { label: "Rate", val: "33%", color: "text-brand" },
        ].map((s, i) => (
          <div key={i} className="bg-white p-1 rounded border border-slate-200/50 shadow-sm">
            <div className="text-[4px] text-slate-400 font-bold uppercase">{s.label}</div>
            <div className={`text-[8px] font-black ${s.color} leading-tight`}>{s.val}</div>
          </div>
        ))}
      </div>
      {/* Mini Chart */}
      <div className="bg-white rounded border border-slate-200/50 shadow-sm p-1.5 h-[45px]">
        <div className="text-[4.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">Automation Flow</div>
        <svg viewBox="0 0 200 40" className="w-full h-[24px]" preserveAspectRatio="none">
          <polygon fill="var(--chart-1)" fillOpacity="0.12" points="0,40 0,30 30,25 60,28 90,15 120,20 150,8 180,12 200,5 200,40" />
          <polyline fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinecap="round" points="0,30 30,25 60,28 90,15 120,20 150,8 180,12 200,5" />
        </svg>
      </div>
      {/* Traffic + Activity */}
      <div className="flex gap-1 flex-1">
        <div className="bg-white rounded border border-slate-200/50 shadow-sm p-1 flex-1 flex flex-col items-center justify-center">
          <div className="text-[4px] font-bold text-slate-400 uppercase mb-0.5">Channels</div>
          <div className="w-8 h-8 relative">
            <svg viewBox="0 0 36 36" className="w-full h-full">
              <circle cx="18" cy="18" r="12" fill="none" stroke="#e2e8f0" strokeWidth="4" />
              <circle cx="18" cy="18" r="12" fill="none" stroke="var(--chart-1)" strokeWidth="4" strokeDasharray="45 75" strokeDashoffset="0" strokeLinecap="round" />
              <circle cx="18" cy="18" r="12" fill="none" stroke="var(--chart-2)" strokeWidth="4" strokeDasharray="30 90" strokeDashoffset="-45" strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[5px] font-black text-slate-700">12</div>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="flex items-center gap-0.5 text-[3.5px] text-slate-500"><span className="w-1 h-1 rounded-full bg-primary" />Comments</span>
            <span className="flex items-center gap-0.5 text-[3.5px] text-slate-500"><span className="w-1 h-1 rounded-full bg-primary" />DMs</span>
          </div>
        </div>
        <div className="bg-white rounded border border-slate-200/50 shadow-sm p-1 flex-1">
          <div className="text-[4px] font-bold text-slate-400 uppercase mb-0.5 flex items-center gap-0.5">
            <span className="w-1 h-1 rounded-full bg-destructive animate-ping" /> Live Log
          </div>
          {["@user_101 → DM Sent", "@deal_fan → Coupon", "@buyer99 → Reply"].map((l, i) => (
            <div key={i} className="text-[4px] text-slate-500 font-semibold py-0.5 border-b border-slate-50 last:border-0 truncate">{l}</div>
          ))}
        </div>
      </div>
    </div>
  )

  // ─── Sidebar for Laptop Mockup ───
  const LaptopSidebar = ({ activeIdx }: { activeIdx: number }) => {
    const navItems = [
      { icon: <LayoutDashboard className="w-2 h-2" />, label: "Dashboard", idx: 0 },
      { icon: <Zap className="w-2 h-2" />, label: "Automations", idx: 2 },
      { icon: <MessageSquare className="w-2 h-2" />, label: "Inbox", idx: 3 },
      { icon: <BarChart3 className="w-2 h-2" />, label: "Analytics", idx: 4 },
      { icon: <Settings className="w-2 h-2" />, label: "Settings", idx: -1 },
    ]
    return (
      <div className="w-[65px] border-r border-slate-200 bg-white p-1.5 shrink-0 flex flex-col text-left">
        <div className="flex items-center gap-1 mb-2 pb-1.5 border-b border-slate-100">
          <CelraLogo variant="mark" size={14} />
          <span className="font-black text-[6.5px] text-brand leading-none">{BRAND_NAME}</span>
        </div>
        <div className="space-y-0.5 flex-1">
          {navItems.map((item, i) => (
            <div
              key={i}
              className={`flex items-center gap-1 px-1 py-0.5 rounded text-[5.5px] font-bold transition-all ${
                activeIdx === item.idx
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 pt-1 flex items-center gap-1">
          <div className="w-3.5 h-3.5 rounded-full bg-slate-200 flex items-center justify-center text-[5px] font-bold text-slate-500">U</div>
          <div className="text-[5px] font-bold text-slate-500 truncate">user</div>
        </div>
      </div>
    )
  }

  // ─── Get screen content for step ───
  const getScreenContent = () => {
    switch (animationStep) {
      case 0: return <DashboardScreen />
      case 1: return <ConnectScreen />
      case 2: return <AutomationsScreen />
      case 3: return <ResponseScreen />
      case 4: return <AnalyticsScreen />
      default: return <DashboardScreen />
    }
  }

  const stepLabels = [
    `Overview: Your ${BRAND_NAME} Dashboard`,
    "Step 01: Connect via Meta OAuth",
    "Step 02: Configure keyword triggers",
    "Step 03: Automated DM reply templates",
    "Step 04: Real-time analytics & insights"
  ]

  return (
    <div className="p-4 md:p-8 space-y-6 text-foreground min-h-0 md:min-h-[90vh] flex flex-col justify-between font-sans relative z-10 animate-in fade-in duration-500">

      <style jsx global>{`
        .laptop-mockup-scaler-help {
          transform: scale(0.65);
          transform-origin: center;
          transition: transform 0.2s ease;
        }
        @media (min-width: 480px) {
          .laptop-mockup-scaler-help { transform: scale(0.75); }
        }
        @media (min-width: 1200px) {
          .laptop-mockup-scaler-help { transform: scale(0.9); }
        }
        @media (min-width: 1400px) {
          .laptop-mockup-scaler-help { transform: scale(1); }
        }
      `}</style>

      {/* Page Header */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div>
          <span className="text-xs font-bold text-primary/80 uppercase tracking-widest flex items-center gap-1.5 mb-1">
            <Compass className="w-3.5 h-3.5 text-primary animate-spin" style={{ animationDuration: '10s' }} /> Interactive Guide
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            How to Use {BRAND_NAME}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Click any step to preview real app screens in Mobile or Laptop mode.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
            className="text-xs font-bold gap-1.5 h-9 bg-card/50 border-border/80 rounded-full"
          >
            {isPlaying ? (
              <><Pause className="w-3.5 h-3.5 text-warn fill-current" /> Pause</>
            ) : (
              <><Play className="w-3.5 h-3.5 text-brand fill-current animate-pulse" /> Resume</>
            )}
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch relative mt-2">

        {/* Left: Step Cards */}
        <div className={`lg:col-span-3 space-y-4 flex flex-col justify-between transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Overview Card */}
            <Card
              onClick={() => handleStepSelect(0)}
              className={`p-4 bg-card/60 backdrop-blur-md cursor-pointer transition-all duration-300 col-span-1 md:col-span-2 group relative overflow-hidden border-2 ${
                animationStep === 0
                  ? 'border-primary shadow-lg ring-2 ring-primary/10 -translate-y-0.5 bg-brand-soft'
                  : 'border-border/60 hover:border-border hover:-translate-y-0.5'
              }`}
            >
              {animationStep === 0 && (
                <div className="absolute top-0 right-0 w-16 h-16 bg-brand-soft pointer-events-none" />
              )}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-secondary/80 text-muted-foreground border border-border/50 uppercase tracking-widest">
                      Getting Started
                    </span>
                    {animationStep === 0 && (
                      <span className="flex h-1.5 w-1.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand" />
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-sm text-foreground group-hover:text-primary transition-colors">
                    {BRAND_NAME} Automation Engine Overview
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed font-semibold">
                    See your real Dashboard with live stats, automation counters, and activity feeds. Toggle between Mobile and Laptop views!
                  </p>
                </div>
              </div>
            </Card>

            {/* Step Cards */}
            {onboardingSteps.map((step) => {
              const isActiveStep = animationStep === step.num
              return (
                <Card
                  key={step.num}
                  onClick={() => handleStepSelect(step.num)}
                  className={`p-4 bg-card/60 backdrop-blur-md cursor-pointer transition-all duration-300 flex flex-col justify-between group relative overflow-hidden border-2 ${
                    isActiveStep
                      ? 'border-primary shadow-lg ring-2 ring-primary/10 -translate-y-0.5 bg-brand-soft'
                      : 'border-border/60 hover:border-border hover:-translate-y-0.5'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-muted-foreground/60 tracking-widest uppercase">
                          Step {step.stepLabel}
                        </span>
                        {isActiveStep && (
                          <span className="flex h-1.5 w-1.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand" />
                          </span>
                        )}
                      </div>
                      <span className={`p-1.5 rounded-lg border transition-all duration-300 ${
                        isActiveStep
                          ? 'bg-primary/10 border-primary/20 scale-105'
                          : 'bg-secondary/50 border-border/50 group-hover:bg-secondary'
                      }`}>
                        {step.icon}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-sm text-foreground tracking-tight group-hover:text-primary transition-colors">
                      {step.title}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed font-semibold">
                      {step.desc}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border/30">
                    <Link
                      href={step.href}
                      className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1 hover:underline w-fit"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {step.action} <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </Link>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Help Banner */}
          <Card className="p-4.5 bg-primary/5 border-primary/20 shadow-sm flex items-start gap-3.5 mt-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20 shadow-inner">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider">Setup audit or customization?</h4>
              <p className="text-[11px] text-muted-foreground mt-1 font-semibold leading-relaxed">
                Need help with custom webhook configurations, CRM pipelines, or advanced interactive triggers? Contact us using the support email on the Privacy Policy page.
              </p>
            </div>
          </Card>
        </div>

        {/* Right: Device Simulator */}
        <Card className={`lg:col-span-2 p-5 bg-card/60 backdrop-blur-md border-border shadow-md flex flex-col justify-between relative overflow-hidden min-h-[520px] transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div className="absolute inset-0 bg-brand-soft pointer-events-none rounded-xl" />

          <div className="space-y-4 flex flex-col h-full justify-between relative z-10">

            {/* Device Toggle */}
            <div className="flex items-center justify-between border-b border-border/50 pb-2.5 shrink-0 gap-2">
              <h3 className="font-extrabold text-foreground text-xs tracking-tight flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                App Preview
              </h3>
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/80 border border-border/40 shadow-inner">
                <button
                  onClick={() => setDeviceMode("mobile")}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                    deviceMode === "mobile"
                      ? "bg-background text-primary shadow-sm border border-border/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}
                >
                  <Smartphone className="w-3 h-3" /> Mobile
                </button>
                <button
                  onClick={() => setDeviceMode("laptop")}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                    deviceMode === "laptop"
                      ? "bg-background text-primary shadow-sm border border-border/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}
                >
                  <Laptop className="w-3 h-3" /> Laptop
                </button>
              </div>
            </div>

            {/* Device Frame */}
            <div className="flex-1 flex items-center justify-center py-4 min-h-[360px]">

              {deviceMode === "mobile" ? (
                /* ─── MOBILE MOCKUP ─── */
                <div className="relative bg-white border-[6px] border-slate-900 rounded-[34px] shadow-2xl w-[200px] h-[380px] flex flex-col overflow-hidden select-none shrink-0 animate-in zoom-in-95 duration-500" key={`mobile-${animationStep}`}>
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-3 bg-slate-900 rounded-b-lg z-20" />

                  {/* Mobile Header */}
                  <div className="flex items-center gap-2 border-b border-slate-100 py-2 pt-4 px-3 shrink-0 bg-white z-10">
                    <Menu className="w-3 h-3 text-slate-400" />
                    <span className="font-black text-[8px] text-brand">{BRAND_NAME}</span>
                  </div>

                  {/* Screen Content */}
                  <div className="flex-1 bg-slate-50/50 flex flex-col overflow-hidden">
                    {getScreenContent()}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-slate-100 p-2 flex items-center justify-between text-[6px] text-slate-400 font-bold shrink-0 bg-white">
                    <span className="flex items-center gap-0.5">
                      <Heart className="w-2 h-2 text-destructive fill-current" /> 1.2k
                    </span>
                    <span className="text-brand flex items-center gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-brand animate-pulse" /> Live
                    </span>
                  </div>
                </div>
              ) : (
                /* ─── LAPTOP MOCKUP ─── */
                <div className="laptop-mockup-scaler-help shrink-0 flex items-center justify-center" key={`laptop-${animationStep}`}>
                  <div className="flex flex-col items-center select-none animate-in zoom-in-95 duration-500">
                    <div className="relative w-[420px] h-[270px] bg-white border-[8px] border-slate-800 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden text-slate-800">

                      {/* Browser Chrome */}
                      <div className="h-6 bg-slate-100 border-b border-slate-200/60 px-3 flex items-center gap-2 shrink-0">
                        <div className="flex gap-1 shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        </div>
                        <div className="bg-white rounded border border-slate-200/60 px-2 py-0.5 text-[7px] text-slate-400 w-40 mx-auto text-center font-bold">
                          {getSiteHost()}/dashboard
                        </div>
                      </div>

                      {/* App Layout */}
                      <div className="flex-1 flex bg-slate-50">
                        <LaptopSidebar activeIdx={animationStep} />
                        <div className="flex-1 flex flex-col overflow-hidden">
                          {getScreenContent()}
                        </div>
                      </div>
                    </div>

                    {/* Keyboard Base */}
                    <div className="w-[470px] h-[10px] bg-slate-300 rounded-b-md shadow-lg relative border-b-[3px] border-slate-400 shrink-0">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-2 bg-slate-400 rounded-b" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step Status Banner */}
            <div className="pt-2.5 border-t border-border/50 text-center shrink-0">
              <span className="text-[10px] text-primary font-black uppercase tracking-widest block opacity-85 leading-normal">
                {stepLabels[animationStep]}
              </span>
            </div>
          </div>
        </Card>

      </div>
    </div>
  )
}
