"use client"

import React, { useState, useEffect, useRef } from "react"
import { TopNavbar } from "@/components/layout/top-navbar"
import { DMSparkGoogleLogo } from "@/components/ui/dmspark-logo"
import { InstagramReelsIcon } from "@/components/ui/instagram-reels-icon"
import { Search, Zap, Instagram, MessageCircle, Shield, Clock, ArrowRight, X, ExternalLink, Sparkles, Check, Mic, Camera } from "lucide-react"
import Link from "next/link"

export function GoogleSearchHome() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)

  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const instagramAuthUrl = `https://api.instagram.com/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID}&redirect_uri=${process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI}&response_type=code&scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments#weblink`
  // Animated rotating search placeholders
  const placeholders = [
    "Try: 'price' to auto-send catalog in DMs...",
    "Try: 'link' to auto-reply to post comments...",
    "Connect Instagram to auto-reply to comments with a DM...",
    "Type any keyword to create instant reply funnels...",
  ]
  const [placeholderIndex, setPlaceholderIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length)
    }, 3200)
    return () => clearInterval(interval)
  }, [placeholders.length])

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const featurePills = [
    { label: "Instant Comment Auto-Reply", icon: <Zap className="w-3.5 h-3.5 text-amber-500" /> },
    { label: "Follower Growth Gate", icon: <Shield className="w-3.5 h-3.5 text-[#1a73e8]" /> },
    { label: "Replies While You Sleep", icon: <Clock className="w-3.5 h-3.5 text-emerald-500" /> },
    { label: "Direct Message Funnels", icon: <MessageCircle className="w-3.5 h-3.5 text-indigo-500" /> },
  ]

  return (
    <div className="h-screen w-full bg-background text-foreground flex flex-col justify-between overflow-hidden select-none">
      {/* Top Navbar */}
      <TopNavbar isConnected={false} />

      {/* Main Google Search Body — Perfectly Optically Centered in Viewport */}
      <main className="flex-1 flex flex-col items-center justify-center -mt-6 sm:-mt-10 px-4 w-full max-w-3xl mx-auto text-center">

        {/* Google-Style Centered Logo with SEO h1 */}
        <div className="mb-4 md:mb-5 group cursor-pointer transition-transform duration-300 hover:scale-105 active:scale-95 select-none">
          <h1 className="sr-only">DMSpark — Instagram comment to DM automation</h1>
          <DMSparkGoogleLogo size="xl" showIcon={true} layout="vertical" />
        </div>

        {/* Clean, Elegant Subtitle */}
        <div className="flex items-center justify-center gap-2 mb-6 md:mb-8 text-xs md:text-sm text-muted-foreground font-medium select-none">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span>Instagram Comment & DM Automation</span>
          <span className="text-muted-foreground/40">•</span>
          <span className="text-muted-foreground/80">24/7 Autopilot</span>
        </div>

        {/* Google-style Search Bar with Dropdown */}
        <div className="w-full max-w-2xl relative" ref={searchRef}>
          <div
            className={`flex items-center w-full h-12 md:h-14 rounded-full border bg-background px-4 md:px-6 gap-3 transition-all duration-300 ${
              searchFocused
                ? "border-[#1a73e8] shadow-xl shadow-[#1a73e8]/10 ring-4 ring-[#1a73e8]/15 scale-[1.01]"
                : "border-border/90 shadow-sm hover:shadow-md hover:border-border"
            }`}
          >
            <Search className={`w-5 h-5 shrink-0 transition-all duration-300 ${searchFocused ? "text-[#1a73e8] scale-110" : "text-muted-foreground/50"}`} />
            
            <div className="relative flex-1 h-full flex items-center">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                className="w-full h-full bg-transparent border-none outline-none text-sm md:text-base text-foreground z-10"
              />
              {!searchQuery && (
                <span
                  key={placeholderIndex}
                  className="absolute inset-0 flex items-center text-sm md:text-base text-muted-foreground/50 pointer-events-none select-none truncate animate-in fade-in slide-in-from-bottom-1 duration-500"
                >
                  {placeholders[placeholderIndex]}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("")
                    searchInputRef.current?.focus()
                  }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer mr-0.5"
                  title="Clear"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {/* Official Instagram Reels Icon */}
              <button
                type="button"
                onClick={() => {
                  setSearchFocused(true)
                  searchInputRef.current?.focus()
                }}
                className="group/reel p-1.5 rounded-full hover:bg-secondary/80 transition-all duration-300 cursor-pointer"
                title="Search with Instagram Reels & Posts"
              >
                <InstagramReelsIcon gradient={true} className="w-5 h-5 group-hover/reel:scale-115 transition-transform" />
              </button>
            </div>
          </div>

          {/* Search Dropdown on Focus — Connect Prompt */}
          {searchFocused && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-background/98 backdrop-blur-md border border-border rounded-2xl shadow-2xl z-50 overflow-hidden p-5 text-left animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-[#1a73e8]" />
                <span className="text-xs font-bold text-foreground">
                  {searchQuery ? `Auto-Reply Trigger: "${searchQuery}"` : "Instant Instagram Automation"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Connect your Instagram account to start auto-replying to comments and sending automated DMs whenever users comment {searchQuery ? `"${searchQuery}"` : "your keywords"}!
              </p>
              <a
                href={instagramAuthUrl}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-bold transition-all shadow-md shadow-blue-500/15 cursor-pointer"
              >
                <Instagram className="w-4 h-4" />
                <span>Connect Instagram to Launch</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Action Buttons (from Landing Page: Connect Instagram & WhatsApp) */}
        <div className="flex items-center gap-3 mt-7 md:mt-8 flex-wrap justify-center">
          <a
            href={instagramAuthUrl}
            className="group flex items-center gap-2 h-11 md:h-12 px-6 md:px-7 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95 cursor-pointer"
          >
            <Instagram className="w-4 h-4 transition-transform group-hover:scale-110" />
            <span>Connect Instagram</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </a>

          {/* Free audit: works as a no-commitment entry point. (The old "Connect WhatsApp" button
              and fake sandbox were removed: WhatsApp is not a launched feature.) */}
          <Link
            href="/instagram-audit"
            className="group flex items-center gap-2 h-11 md:h-12 px-6 md:px-7 rounded-full bg-secondary/80 hover:bg-secondary border border-border/80 text-sm font-semibold text-foreground transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md active:scale-95"
          >
            <span>Free Instagram Audit</span>
          </Link>
        </div>

        {/* Feature Pills Row */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-8 md:mt-10 max-w-2xl">
          {featurePills.map((pill, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-secondary/60 hover:bg-secondary border border-border/60 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors select-none"
            >
              {pill.icon}
              {pill.label}
            </span>
          ))}
        </div>
      </main>

      {/* Clean Google-Style Footer with Meta Review Compliance */}
      <footer className="w-full shrink-0 border-t border-border/60 py-3 px-4 md:px-8 text-[11px] sm:text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2 select-none text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2">
          <span>© 2026 DMSpark</span>
          <span className="hidden sm:inline">•</span>
          <span className="text-[10px] sm:text-xs text-muted-foreground/75">Not affiliated with Meta Platforms Inc. or Instagram</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 font-medium text-[11px] sm:text-xs">
          <Link href="/privacy" className="hover:text-foreground transition-colors hover:underline">
            Privacy Policy
          </Link>
          <span className="text-muted-foreground/40">•</span>
          <Link href="/terms" className="hover:text-foreground transition-colors hover:underline">
            Terms of Service
          </Link>
          <span className="text-muted-foreground/40">•</span>
          <Link href="/delete-data" className="hover:text-foreground transition-colors hover:underline">
            Data Deletion
          </Link>
        </div>
      </footer>
    </div>
  )
}
