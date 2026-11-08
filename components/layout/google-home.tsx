"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { ArrowRight, Cake, CheckCheck, ClipboardCheck, Heart, MessageCircle, Send, KeyRound, MessageSquareText, MessagesSquare, Moon, ShieldCheck, Sun, UserCheck, Plug } from "lucide-react"
import { CelraLogo } from "@/components/ui/celra-logo"
import { BRAND_NAME } from "@/lib/site"

const instagramAuthUrl = `https://api.instagram.com/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID}&redirect_uri=${process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI}&response_type=code&scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments#weblink`

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-brand focus-visible:ring-offset-2 focus-visible:ring-offset-c-bg"

const steps = [
  {
    icon: Plug,
    title: "Connect Instagram",
    body: "Sign in with Instagram's own login. We never ask for your password.",
  },
  {
    icon: MessageSquareText,
    title: "Write your reply",
    body: "Pick a reel, choose a word like “price”, and write the DM you want sent.",
  },
  {
    icon: MessagesSquare,
    title: "Celra does the rest",
    body: "When someone comments that word, they get your DM. You can pause it any time.",
  },
]

const trust = [
  {
    icon: ShieldCheck,
    title: "Official Instagram API",
    body: "No scraping, no password sharing. You log in on Instagram itself.",
  },
  {
    icon: KeyRound,
    title: "You write every message",
    body: "We send only what you wrote. Nothing is made up on your behalf.",
  },
  {
    icon: UserCheck,
    title: "Only people who reached out",
    body: "DMs go to people who commented on your reel or messaged you first.",
  },
]

const faqs = [
  {
    q: `Is ${BRAND_NAME} free?`,
    a: `${BRAND_NAME} is free to use while it is in beta. We will tell you clearly before anything changes, and nothing is charged without your yes.`,
  },
  {
    q: "Do I need a special Instagram account?",
    a: "Yes. Your account must be an Instagram Business or Creator account (you can switch for free in Instagram settings).",
  },
  {
    q: "Is it safe for my account?",
    a: `${BRAND_NAME} uses the official Instagram API and Instagram's own login. Follow Instagram's messaging rules when you write your automations, and keep your messages useful and honest.`,
  },
  {
    q: "Will it message random people?",
    a: "No. A DM goes out only to someone who commented your keyword on your reel, or who messaged you first.",
  },
  {
    q: "How do I stop or delete my data?",
    a: "Pause or delete any automation inside the dashboard. To remove your data completely, use the data deletion page below.",
  },
]

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const dark = mounted && resolvedTheme === "dark"
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={`h-10 w-10 rounded-full grid place-items-center text-c-muted hover:text-c-ink hover:bg-c-soft transition-colors cursor-pointer ${focusRing}`}
    >
      {dark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </button>
  )
}

/** Small HTML/CSS illustration: a comment on a reel turns into a DM. Example only. */
function CommentToDmDemo() {
  return (
    <figure
      className="relative w-full max-w-[420px] mx-auto lg:mx-0 lg:ml-auto"
      aria-label="Example: a comment saying price on a reel, and the DM sent back automatically"
    >
      <div className="rounded-3xl border border-c-line bg-c-surface p-4 sm:p-5 shadow-[0_20px_50px_-24px_rgba(11,92,110,0.35)]">
        {/* the reel + comment */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 rounded-xl bg-c-brand-soft grid place-items-center text-c-brand" aria-hidden>
            <Cake className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-c-ink truncate">Chocolate cake, 1 kg</p>
            <p className="text-xs text-c-muted">Your reel · 3 new comments</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4 text-c-muted" aria-hidden>
          <Heart className="h-[18px] w-[18px]" />
          <MessageCircle className="h-[18px] w-[18px]" />
          <Send className="h-[18px] w-[18px]" />
        </div>

        <div className="mt-3 space-y-2.5">
          <div className="flex items-start gap-2.5 opacity-70">
            <span className="h-7 w-7 shrink-0 rounded-full bg-c-soft grid place-items-center text-[11px] font-semibold text-c-muted" aria-hidden>S</span>
            <p className="text-sm text-c-muted pt-0.5"><span className="font-semibold">sana_m</span> Looks so good!</p>
          </div>
          <div className="celra-pop flex items-start gap-2.5 rounded-2xl bg-c-brand-soft px-3 py-2.5" style={{ ["--d" as string]: "0.2s" }}>
            <span className="h-7 w-7 shrink-0 rounded-full bg-c-brand text-c-bg grid place-items-center text-[11px] font-bold ring-2 ring-c-accent ring-offset-2 ring-offset-c-brand-soft" aria-hidden>R</span>
            <p className="text-sm text-c-ink pt-0.5"><span className="font-semibold">riya.k</span> price?</p>
          </div>
        </div>

        {/* connector */}
        <div className="my-4 flex items-center gap-3 text-xs font-medium text-c-muted" aria-hidden>
          <span className="h-px flex-1 bg-c-line" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-c-line px-2.5 py-1">
            <span className="h-2 w-2 rounded-full bg-c-accent" />
            {BRAND_NAME} sends a DM
          </span>
          <span className="h-px flex-1 bg-c-line" />
        </div>

        {/* the DM thread */}
        <div className="rounded-2xl bg-c-soft p-3">
          <p className="mb-2 text-center text-[11px] font-medium text-c-muted">Today, 10:42 am</p>
          <div className="celra-pop rounded-2xl rounded-bl-md bg-c-brand text-c-bg px-4 py-3 text-sm leading-relaxed max-w-[92%]" style={{ ["--d" as string]: "1s" }}>
            <p>Hi Riya! 😊 Chocolate cake 1 kg is ₹850. Order here: <span className="underline underline-offset-2">your-shop.link/cake</span></p>
          </div>
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-c-muted">
            10:42 am <span aria-hidden>·</span> <CheckCheck className="h-3.5 w-3.5 text-c-brand" aria-hidden /> Seen
          </p>
        </div>
      </div>
      <figcaption className="mt-3 text-center lg:text-right text-xs text-c-muted">Example only. You write your own message.</figcaption>
    </figure>
  )
}

export function GoogleSearchHome() {
  return (
    <div className="celra-landing min-h-screen w-full bg-c-bg text-c-ink">
      <a
        href="#main"
        className={`sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-c-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold ${focusRing}`}
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-c-line bg-c-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label={`${BRAND_NAME} home`} className={`flex items-center rounded-lg text-c-ink ${focusRing}`}>
            <CelraLogo variant="full" size={34} />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <a href="#how" className={`hidden sm:inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-c-muted hover:text-c-ink ${focusRing}`}>How it works</a>
            <a href="#faq" className={`hidden sm:inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-c-muted hover:text-c-ink ${focusRing}`}>FAQ</a>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main id="main">
        {/* HERO */}
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-6 sm:px-6 sm:pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14 lg:pb-24 lg:pt-20">
          <div className="text-center lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border border-c-line bg-c-surface px-3 py-1 text-xs font-medium text-c-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-c-accent" aria-hidden />
              Instagram comment to DM, free during beta
            </p>
            <h1 className="mt-4 font-display text-[2.35rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              <span className="sr-only">{BRAND_NAME}: </span>
              Turn every comment
              <br />
              <span className="text-c-brand">into a DM.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg leading-relaxed text-c-muted lg:mx-0">
              {BRAND_NAME} sends the price, link or details to anyone who comments on your reel, automatically, through the official Instagram API.
            </p>
            <div className="mt-6 sm:mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
              <a
                href={instagramAuthUrl}
                className={`group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-c-accent px-7 text-base font-semibold text-c-accent-ink shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 ${focusRing}`}
              >
                <Plug className="h-4 w-4" aria-hidden />
                Connect Instagram
              </a>
              <Link
                href="/instagram-audit"
                className={`inline-flex h-12 items-center justify-center rounded-full border border-c-brand px-7 text-base font-semibold text-c-brand transition-colors hover:bg-c-brand-soft ${focusRing}`}
              >
                Free Instagram Audit
              </Link>
            </div>
            <p className="mt-4 text-sm text-c-muted">No password needed. Pause or stop any time.</p>
          </div>
          <CommentToDmDemo />
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="scroll-mt-20 border-y border-c-line bg-c-soft">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Start in three steps</h2>
            <p className="mt-2 text-c-muted">Three steps, no technical setup.</p>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="rounded-2xl border border-c-line bg-c-surface p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-c-brand-soft text-c-brand">
                      <s.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="font-display text-sm font-semibold text-c-muted">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-display text-xl font-semibold">{s.title}</h3>
                  <p className="mt-1.5 leading-relaxed text-c-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* TRUST */}
        <section aria-labelledby="trust-h" className="bg-c-cream"><div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <h2 id="trust-h" className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Safe and simple</h2>
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {trust.map((t) => (
              <li key={t.title} className="flex gap-4">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-c-brand-soft text-c-brand">
                  <t.icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold">{t.title}</h3>
                  <p className="mt-1 leading-relaxed text-c-muted">{t.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div></section>

        {/* AUDIT */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <div className="flex flex-col items-start gap-5 rounded-3xl bg-c-brand p-6 text-c-bg sm:flex-row sm:items-center sm:justify-between sm:p-9">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-sm font-medium opacity-90">
                <ClipboardCheck className="h-4 w-4" aria-hidden /> Free for Business and Creator accounts
              </div>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Check your Instagram first</h2>
              <p className="mt-2 leading-relaxed opacity-90">
                Connect Instagram and get a score for your profile, posting and engagement, with clear fixes.
              </p>
            </div>
            <Link
              href="/instagram-audit"
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-c-bg px-6 font-semibold text-c-ink outline-none focus-visible:ring-2 focus-visible:ring-c-accent focus-visible:ring-offset-2 focus-visible:ring-offset-c-brand"
            >
              Start the free audit <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 bg-c-cream"><div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Frequently asked questions</h2>
          <div className="mt-6 divide-y divide-c-line border-y border-c-line">
            {faqs.map((f) => (
              <details key={f.q} className="group py-1">
                <summary className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-3 font-display text-lg font-medium [&::-webkit-details-marker]:hidden ${focusRing}`}>
                  {f.q}
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-c-soft text-c-brand transition-transform group-open:rotate-45" aria-hidden>
                    <span className="text-lg leading-none">+</span>
                  </span>
                </summary>
                <p className="pb-4 pr-10 leading-relaxed text-c-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div></section>
      </main>

      <footer className="border-t border-c-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-sm text-c-muted sm:px-6 md:flex-row md:justify-between">
          <div className="flex max-w-xl flex-col items-center gap-3 md:items-start">
            <CelraLogo variant="full" size={28} className="text-c-ink" />
            <span className="text-xs leading-relaxed text-center md:text-left">
              Celra is an independent product. It is not affiliated with, endorsed by or sponsored by Meta Platforms, Inc. or Instagram. Instagram is a trademark of Meta Platforms, Inc.
            </span>
            <span className="text-xs">© 2026 {BRAND_NAME}</span>
          </div>
          <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-medium">
            <Link href="/instagram-audit" className={`rounded py-2 hover:text-c-ink hover:underline ${focusRing}`}>Free Audit</Link>
            <Link href="/privacy" className={`rounded py-2 hover:text-c-ink hover:underline ${focusRing}`}>Privacy Policy</Link>
            <Link href="/terms" className={`rounded py-2 hover:text-c-ink hover:underline ${focusRing}`}>Terms of Service</Link>
            <Link href="/delete-data" className={`rounded py-2 hover:text-c-ink hover:underline ${focusRing}`}>Data Deletion</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
