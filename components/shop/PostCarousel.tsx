"use client"

import { useRef, useState } from "react"

/** Swipe carousel (CSS scroll-snap) with a photo counter and dots. */
export default function PostCarousel({ images, alt }: { images: string[]; alt: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(0)
  const onScroll = () => {
    const el = ref.current
    if (el && el.clientWidth) setI(Math.round(el.scrollLeft / el.clientWidth))
  }
  return (
    <div className="relative bg-muted">
      <div ref={ref} onScroll={onScroll} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {images.map((src, n) => (
          <div key={src} className="aspect-[4/5] w-full shrink-0 snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${alt} (${n + 1} of ${images.length})`} loading={n === 0 ? "eager" : "lazy"} className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <>
          <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">{i + 1}/{images.length}</span>
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden>
            {images.map((src, n) => (
              <span key={src} className={`h-1.5 rounded-full bg-white shadow transition-all motion-reduce:transition-none ${n === i ? "w-4 opacity-100" : "w-1.5 opacity-60"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
