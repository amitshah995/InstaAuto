import { Inter, Outfit } from "next/font/google"
import type { ReactNode } from "react"

const outfit = Outfit({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-audit-head", display: "swap" })
const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-audit-body", display: "swap" })

/**
 * Dark audit look (near-black page, soft bordered cards, Outfit headings, Inter body, red accent).
 * Scoped to the audit pages only: the rest of the app keeps its own theme.
 * Use the .au-* classes below inside the wrapper.
 */
export function AuditShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main className={`au-root ${outfit.variable} ${inter.variable} ${className}`}>
      <style>{CSS}</style>
      {children}
    </main>
  )
}

const CSS = `
.au-root{--au-bg:#0a0a0c;--au-card:#101016;--au-tile:rgba(255,255,255,.02);--au-line:rgba(255,255,255,.06);--au-text:#f4f4f6;--au-muted:#9a9aa6;--au-red:#ff3b52;--au-orange:#ff6b35;--au-green:#28a745;--au-amber:#f5b301;
  min-height:100vh;background:var(--au-bg);color:var(--au-text);font-family:var(--font-audit-body),system-ui,sans-serif;
  background-image:radial-gradient(900px 380px at 50% -120px,rgba(255,59,82,.14),transparent 70%)}
.au-root *{box-sizing:border-box}
.au-head{font-family:var(--font-audit-head),system-ui,sans-serif;font-weight:700;letter-spacing:-.01em}
.au-wrap{max-width:1080px;margin:0 auto;padding:0 16px}
.au-card{background:var(--au-card);border:1px solid var(--au-line);border-radius:24px;padding:24px}
.au-tile{background:var(--au-tile);border:1px solid var(--au-line);border-radius:16px;padding:14px 16px}
.au-muted{color:var(--au-muted)}
.au-pill{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:600;background:rgba(255,255,255,.07);color:#c9c9d1}
.au-pill.high{background:rgba(255,59,82,.14);color:#ff6477;border:1px solid rgba(255,59,82,.3)}
.au-pill.medium{background:rgba(245,179,1,.12);color:var(--au-amber);border:1px solid rgba(245,179,1,.28)}
.au-pill.low{background:rgba(56,152,255,.12);color:#6cb4ff;border:1px solid rgba(56,152,255,.28)}
.au-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:999px;padding:14px 28px;font-family:var(--font-audit-head),sans-serif;font-weight:700;font-size:16px;color:#fff;cursor:pointer;
  background:linear-gradient(135deg,#f09433,#ff3b52 55%,#c13584);box-shadow:0 8px 28px rgba(255,59,82,.28);text-decoration:none;transition:transform .15s,box-shadow .15s}
.au-btn:hover{transform:translateY(-1px);box-shadow:0 12px 32px rgba(255,59,82,.38)}
.au-btn:disabled{opacity:.6;cursor:default;transform:none}
.au-btn:focus-visible,.au-input:focus-visible{outline:2px solid #fff;outline-offset:2px}
.au-btn.ghost{background:transparent;border:1px solid rgba(255,255,255,.18);box-shadow:none}
.au-btn.ghost:hover{background:rgba(255,255,255,.06);box-shadow:none}
.au-input{width:100%;height:46px;border-radius:14px;border:1px solid var(--au-line);background:rgba(255,255,255,.04);color:var(--au-text);padding:0 14px;font:inherit;font-size:14px}
.au-input::placeholder{color:#6e6e7a}
.au-input option{background:#101016}
.au-bar{height:8px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}
.au-bar>i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#f09433,#ff3b52)}
.au-icon{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:rgba(40,167,69,.16);color:#3ddc6b;flex:none}
.au-icon.red{background:rgba(255,59,82,.14);color:var(--au-red)}
.au-grid2{display:grid;gap:16px}
@media(min-width:720px){.au-grid2{grid-template-columns:1fr 1fr}}
.au-err{color:#ff7a8a;font-size:14px}
@media (prefers-reduced-motion:reduce){.au-btn{transition:none}}
`
