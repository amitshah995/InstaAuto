"use client"

import { useMemo } from "react"
import { Download } from "lucide-react"
import qrcode from "qrcode-generator"

/**
 * QR code drawn in the browser (no external service, so the page address never leaves the device).
 * Always dark-on-white, even in dark mode, because scanners need the contrast.
 */
export default function QrCode({ value, handle }: { value: string; handle: string }) {
  const svg = useMemo(() => {
    try {
      const q = qrcode(0, "M")
      q.addData(value)
      q.make()
      // The library emits only <svg>/<rect>/<path> built from numbers, so injecting it is safe.
      return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true })
    } catch {
      return null
    }
  }, [value])
  if (!svg) return null
  const download = () => {
    const blob = new Blob([svg], { type: "image/svg+xml" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `celra-${handle}-qr.svg`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  return (
    <div className="flex items-center gap-3">
      <div role="img" aria-label={`QR code for ${value}`} className="h-24 w-24 shrink-0 rounded-lg border border-c-line bg-white p-1 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>Print it on packaging or show it at events. It opens your page.</p>
        <button type="button" onClick={download} className="inline-flex items-center gap-1 font-semibold text-c-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-c-brand">
          <Download className="h-3.5 w-3.5" /> Download SVG
        </button>
      </div>
    </div>
  )
}
