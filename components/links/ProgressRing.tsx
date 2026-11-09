/** Circular completeness meter. Pure SVG, flat teal on a soft track (no gradient). */
export default function ProgressRing({ value, size = 64 }: { value: number; size?: number }) {
  const stroke = 6
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${pct}% complete`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-c-line" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          className="stroke-c-brand transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-black font-display">{pct}%</span>
    </div>
  )
}
