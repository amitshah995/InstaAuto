import type { BlogCategory } from "@/lib/blog/types"

/** Small stable number from a slug, so each post gets its own variation of the category drawing. */
export function seedOf(slug: string) {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return h
}

/**
 * Cover art drawn in SVG with the Celra palette (so it follows light and dark mode).
 * One drawing per category, nudged by the slug so no two covers are identical.
 */
export function PostCover({ category, slug, className = "" }: { category: BlogCategory; slug: string; className?: string }) {
  const s = seedOf(slug)
  const a = s % 5
  const b = (s >> 3) % 4
  const common = { viewBox: "0 0 400 250", preserveAspectRatio: "xMidYMid slice", "aria-hidden": true, className: `block h-full w-full ${className}` } as const

  if (category === "Guides") {
    return (
      <svg {...common}>
        <rect width="400" height="250" className="fill-c-brand-soft" />
        <circle cx={90 + a * 40} cy={60 + b * 20} r="120" className="fill-c-cream" />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${96 + i * 34} ${54 + i * 18}) rotate(${-6 + i * 5})`}>
            <rect width="150" height="132" rx="10" className={i === 2 ? "fill-c-surface" : "fill-c-bg"} stroke="currentColor" strokeWidth="0" />
            <rect width="150" height="132" rx="10" fill="none" className="stroke-c-brand" strokeWidth="2.5" />
            {i === 2 && (
              <>
                <rect x="18" y="22" width="70" height="9" rx="4.5" className="fill-c-brand" />
                <rect x="18" y="44" width="112" height="6" rx="3" className="fill-c-line" />
                <rect x="18" y="58" width="100" height="6" rx="3" className="fill-c-line" />
                <rect x="18" y="72" width="108" height="6" rx="3" className="fill-c-line" />
                <circle cx="124" cy="104" r="11" className="fill-c-accent" />
              </>
            )}
          </g>
        ))}
      </svg>
    )
  }

  if (category === "Templates") {
    const tiles = [
      ["fill-c-brand", 0], ["fill-c-surface", 1], ["fill-c-accent", 2],
      ["fill-c-surface", 3], ["fill-c-brand-soft", 4], ["fill-c-brand", 5],
    ] as const
    const shift = a % 3
    return (
      <svg {...common}>
        <rect width="400" height="250" className="fill-c-cream" />
        {tiles.map(([cls], i) => {
          const idx = (i + shift) % 6
          const x = 52 + (i % 3) * 100
          const y = 36 + Math.floor(i / 3) * 90
          return (
            <g key={i}>
              <rect x={x} y={y} width="88" height="78" rx="10" className={cls} />
              <rect x={x} y={y} width="88" height="78" rx="10" fill="none" className="stroke-c-brand" strokeWidth="2" />
              <rect x={x + 12} y={y + 14} width={34 + (idx % 3) * 10} height="7" rx="3.5" className={cls === "fill-c-brand" ? "fill-c-bg" : "fill-c-brand"} opacity="0.85" />
              <rect x={x + 12} y={y + 30} width="60" height="5" rx="2.5" className={cls === "fill-c-brand" ? "fill-c-bg" : "fill-c-line"} opacity="0.6" />
              <rect x={x + 12} y={y + 42} width="46" height="5" rx="2.5" className={cls === "fill-c-brand" ? "fill-c-bg" : "fill-c-line"} opacity="0.6" />
            </g>
          )
        })}
      </svg>
    )
  }

  if (category === "Growth") {
    const hs = [46, 70, 62, 104, 96, 138, 160]
    return (
      <svg {...common}>
        <rect width="400" height="250" className="fill-c-brand" />
        <circle cx={330 - a * 18} cy={60 + b * 8} r="46" className="fill-c-bg" opacity="0.14" />
        {hs.map((h, i) => (
          <rect key={i} x={40 + i * 48} y={210 - h} width="30" height={h} rx="6" className="fill-c-bg" opacity={0.28 + i * 0.1} />
        ))}
        <polyline points={hs.map((h, i) => `${55 + i * 48},${196 - h}`).join(" ")} fill="none" className="stroke-c-accent" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={55 + 6 * 48} cy={196 - hs[6]} r="9" className="fill-c-accent" />
      </svg>
    )
  }

  if (category === "Product") {
    return (
      <svg {...common}>
        <rect width="400" height="250" className="fill-c-soft" />
        <circle cx={310 - a * 14} cy={190} r="90" className="fill-c-brand-soft" />
        <g transform="translate(46 40)">
          <rect width="170" height="56" rx="18" className="fill-c-surface" />
          <rect width="170" height="56" rx="18" fill="none" className="stroke-c-brand" strokeWidth="2.5" />
          <circle cx="26" cy="28" r="12" className="fill-c-brand-soft" />
          <rect x="48" y="19" width="92" height="8" rx="4" className="fill-c-brand" />
          <rect x="48" y="33" width="60" height="6" rx="3" className="fill-c-line" />
        </g>
        <path d="M150 112 C150 140 190 140 206 150" fill="none" className="stroke-c-accent" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 10" />
        <g transform="translate(150 150)">
          <rect width="200" height="64" rx="20" className="fill-c-brand" />
          <rect x="22" y="18" width="120" height="8" rx="4" className="fill-c-bg" opacity="0.9" />
          <rect x="22" y="34" width="150" height="8" rx="4" className="fill-c-bg" opacity="0.6" />
          <circle cx="176" cy="18" r="8" className="fill-c-accent" />
        </g>
      </svg>
    )
  }

  // Safety
  return (
    <svg {...common}>
      <rect width="400" height="250" className="fill-c-brand" />
      {[150, 112, 76].map((r, i) => (
        <circle key={r} cx={200 + (b - 1) * 12} cy="125" r={r} fill="none" className="stroke-c-bg" strokeWidth="2" opacity={0.18 + i * 0.1} />
      ))}
      <g transform={`translate(${200 + (b - 1) * 12} 125)`}>
        <path d="M0 -62 L50 -42 V6 C50 38 26 56 0 68 C-26 56 -50 38 -50 6 V-42 Z" className="fill-c-bg" />
        <path d="M-20 4 L-6 18 L22 -14" fill="none" className="stroke-c-accent" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}
