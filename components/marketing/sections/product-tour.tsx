"use client"

import { useState } from "react"
import { Play } from "lucide-react"
import { BRAND_NAME } from "@/lib/site"
import { Modal } from "../modal"
import { SectionHead, SampleTag, container, focusRing } from "../ui"
import { CommentThread, DmCard, StatsCard } from "./visuals"

export function ProductTour() {
  const [open, setOpen] = useState(false)
  return (
    <section className="pt-[72px]" aria-labelledby="tour-h">
      <div className={container}>
        <SectionHead id="tour-h" title={`See ${BRAND_NAME} in two minutes`} sub="A short tour from the first comment to the finished order." />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Play product tour"
          className={`group relative mt-8 block w-full overflow-hidden rounded-2xl bg-c-brand p-4 text-left cursor-pointer sm:p-8 ${focusRing}`}
        >
          <div className="mx-auto grid max-w-[900px] gap-3 opacity-90 md:grid-cols-3" aria-hidden>
            <CommentThread className="hidden md:block" /><DmCard /><StatsCard className="hidden md:block" />
          </div>
          <span className="absolute inset-0 bg-[#071A20]/35" aria-hidden />
          <span className="absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-c-accent text-c-accent-ink shadow-xl transition-transform group-hover:scale-105">
            <Play className="ml-1 h-8 w-8" fill="currentColor" aria-hidden />
          </span>
          <span className="absolute bottom-3 left-4 sm:bottom-5 sm:left-8"><SampleTag>Poster</SampleTag></span>
        </button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} label="Product tour" wide>
        <h2 className="font-display text-2xl font-semibold">Product tour</h2>
        <div className="mt-4 grid aspect-video place-items-center rounded-xl border border-dashed border-c-line bg-c-soft p-6 text-center">
          <div>
            <Play className="mx-auto h-10 w-10 text-c-brand" aria-hidden />
            <p className="mt-3 font-display text-lg font-semibold">Video coming soon</p>
            <p className="mt-1 text-sm text-c-muted">We are recording the walkthrough. Until then, try the free audit or connect your account.</p>
          </div>
        </div>
      </Modal>
    </section>
  )
}
