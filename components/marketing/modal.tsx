"use client"

import { useEffect, useRef, type ReactNode, type RefObject } from "react"
import { X } from "lucide-react"
import { focusRing } from "./ui"

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'

/** Esc to close, Tab trapped inside `ref`, page scroll locked, focus restored on close. */
export function useDialogA11y(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const node = ref.current
    const first = node?.querySelector<HTMLElement>("input,textarea") ?? node?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return }
      if (e.key !== "Tab" || !ref.current) return
      const els = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (!els.length) return
      const a = els[0], z = els[els.length - 1]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
      prev?.focus?.()
    }
  }, [open, onClose, ref])
}

/** Centered dialog with overlay, Esc to close, focus trap and scroll lock. Render it inside `.celra-landing`. */
export function Modal({ open, onClose, label, children, wide }: { open: boolean; onClose: () => void; label: string; children: ReactNode; wide?: boolean }) {
  const box = useRef<HTMLDivElement>(null)

  useDialogA11y(box, open, onClose)

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-[#071A20]/60" aria-hidden />
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`celra-pop relative max-h-[90vh] w-full overflow-y-auto rounded-xl border border-c-line bg-c-surface p-6 text-c-ink shadow-2xl sm:p-8 ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        <button type="button" onClick={onClose} aria-label="Close" className={`absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-c-muted hover:bg-c-soft hover:text-c-ink cursor-pointer ${focusRing}`}>
          <X className="h-5 w-5" aria-hidden />
        </button>
        {children}
      </div>
    </div>
  )
}
