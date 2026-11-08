"use client"

import { useState } from "react"
import { Clapperboard, Sparkles, Calendar, Zap, ArrowLeft, Mail, CheckCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function PublisherPage() {
  const [requested, setRequested] = useState(false)

  return (
    <div className="min-h-0 md:min-h-[85vh] flex items-center justify-center p-4 md:p-8 relative overflow-x-hidden select-none">
      {/* Background Decorative Glow */}

      <div className="max-w-xl w-full text-center space-y-8 relative z-10 animate-in fade-in duration-700">
        
        {/* Back Link */}
        <div className="text-left">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-foreground transition-all hover:translate-x-[-3px] duration-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
        </div>

        {/* Feature Icon Header */}
        <div className="relative w-24 h-24 mx-auto">
          <div className="w-full h-full rounded-2xl bg-primary p-0.5 shadow-xl flex items-center justify-center relative">
            <div className="w-full h-full rounded-[14px] bg-background flex items-center justify-center">
              <Clapperboard className="w-10 h-10 text-brand animate-bounce" />
            </div>
          </div>
        </div>

        {/* Text */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-[10px] uppercase font-black tracking-widest">
            <Sparkles className="w-3 h-3 text-brand animate-spin" /> Coming Soon
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
            Reels Publisher
          </h1>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed font-medium">
            Automate your Instagram content engine. Schedule, rotate, and dynamically publish high-converting Reels with zero manual work.
          </p>
        </div>

        {/* Highlighted bullets */}
        <div className="p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-sm space-y-3.5 text-left max-w-md mx-auto">
          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-brand shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-foreground">Smart Calendar Scheduler</h4>
              <p className="text-[10px] text-muted-foreground">Upload multiple clips and set customized intervals to keep your page active 24/7.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-foreground">AI Caption & Hashtag Generator</h4>
              <p className="text-[10px] text-muted-foreground">Automatically write high-converting, context-appropriate descriptions and tags using integrated AI.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Zap className="w-4 h-4 text-warn shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-foreground">Engagement Flow Rotator</h4>
              <p className="text-[10px] text-muted-foreground">Link specific automations directly to published reels to turn viral views into direct messages instantly.</p>
            </div>
          </div>
        </div>

        {/* Dynamic Action */}
        {/* Was a fake "Request Early Access" button that sent nothing. Replaced with an honest status line. */}
        <div className="max-w-xs mx-auto text-center text-xs font-semibold text-muted-foreground">
          Not available yet.
        </div>

      </div>
    </div>
  )
}
