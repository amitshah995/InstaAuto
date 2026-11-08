"use client"

import { useEffect, useRef, useState } from "react"
import { SampleTag, SectionHead, container } from "../ui"

const STATS = [
  { to: 24, suffix: "/7", label: "Always-on replies", text: "Your DM goes out even when you are asleep or offline.", tag: false },
  { to: 3, suffix: " steps", label: "To go live", text: "Connect, pick a word, write your message.", tag: false },
  { to: 10, suffix: " min", label: "Typical first setup", text: "A rough guide for a first automation.", tag: true },
  { to: 100, suffix: "%", label: "Written by you", text: "We send only the words you wrote. Nothing is made up.", tag: false },
]

function CountUp({ to, suffix }: { to: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [n, setN] = useState(to) // final value first, so no-JS and reduced motion see the real number
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return
    setN(0)
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const t0 = performance.now()
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / 1200)
        setN(Math.round(to * (1 - Math.pow(1 - k, 3))))
        if (k < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [to])
  return <span ref={ref} aria-label={`${to}${suffix}`}><span aria-hidden>{n}{suffix}</span></span>
}

export function Stats() {
  return (
    <section className="pt-[72px]" aria-labelledby="stats-h">
      <div className={container}>
        <SectionHead id="stats-h" title="Why Instagram DMs?" sub="People who comment are already interested. A DM answers them while they still care." />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <li key={s.label} className="rounded-xl border border-c-line bg-c-surface p-6">
              <p className="font-display text-5xl font-semibold tracking-tight text-c-brand"><CountUp to={s.to} suffix={s.suffix} /></p>
              <p className="mt-3 flex items-center gap-2 font-display text-lg font-semibold">{s.label} {s.tag && <SampleTag>Illustrative</SampleTag>}</p>
              <p className="mt-1 text-sm leading-relaxed text-c-muted">{s.text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-xs text-c-muted">Numbers describe how Celra works or are illustrative. They are not measured results.</p>
      </div>
    </section>
  )
}
