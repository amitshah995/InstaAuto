import type { ReactNode } from "react"
import { PageShell } from "@/components/marketing/page-shell"

/**
 * Celra look for the public tool / audit / template pages: the shared marketing header and footer around a
 * content area that reads the Celra tokens (--c-*), so light and dark mode both work.
 * Use the .au-* classes below inside the wrapper.
 */
export function AuditShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <PageShell strip={false}>
      <div className={`au-root ${className}`}>
        <style>{CSS}</style>
        {children}
      </div>
    </PageShell>
  )
}

const CSS = `
.au-root{--au-bg:var(--c-bg);--au-card:var(--c-surface);--au-tile:var(--c-soft);--au-line:var(--c-line);--au-text:var(--c-ink);--au-muted:var(--c-muted);--au-red:#B93A26;--au-green:#1F7A4D;--au-amber:#8A5A00;--au-brand:var(--c-brand);--au-coral:#E2593A;--au-blue:#4B9CAB;--au-k1:#F0735A;--au-k2:#6FB6C3;--au-k3:#F2C265;--au-k4:#A8D5BA;--au-k5:#D9D2C0;--au-onk:#0E2A33;--au-gold:#F2C265;--au-ink:var(--c-ink);
  color:var(--au-text);font-family:var(--font-geist-sans),system-ui,sans-serif;padding-bottom:24px}
.dark .au-root{--au-red:#FF8A7A;--au-green:#5FD39A;--au-amber:#F2C265;--au-coral:#FF8466;--au-blue:#7FD6DC}
.au-root *{box-sizing:border-box}
.au-head{font-family:var(--font-display);font-weight:600;letter-spacing:-.01em}
.au-wrap{max-width:1080px;margin:0 auto;padding:0 16px}
.au-card{background:var(--au-card);border:1px solid var(--au-line);border-radius:14px;padding:24px}
.au-tile{background:var(--au-tile);border:1px solid var(--au-line);border-radius:12px;padding:14px 16px}
.au-muted{color:var(--au-muted)}
.au-pill{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:600;background:var(--au-tile);color:var(--au-muted);border:1px solid var(--au-line)}
.au-pill.high{background:color-mix(in srgb,var(--au-red) 12%,transparent);color:var(--au-red);border-color:color-mix(in srgb,var(--au-red) 35%,transparent)}
.au-pill.medium{background:color-mix(in srgb,var(--au-amber) 12%,transparent);color:var(--au-amber);border-color:color-mix(in srgb,var(--au-amber) 35%,transparent)}
.au-pill.low{background:var(--c-brand-soft);color:var(--au-brand);border-color:color-mix(in srgb,var(--au-brand) 35%,transparent)}
.au-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:2px solid var(--c-accent);border-radius:5px;min-height:44px;padding:10px 24px;font-family:var(--font-display);font-weight:600;font-size:16px;color:var(--c-accent-ink);cursor:pointer;
  background:var(--c-accent);text-decoration:none;transition:filter .15s}
.au-btn:hover{filter:brightness(.95)}
.au-btn:disabled{opacity:.6;cursor:default}
.au-btn:focus-visible,.au-input:focus-visible,.au-tab:focus-visible,.au-toolcard:focus-visible{outline:2px solid var(--au-brand);outline-offset:2px}
.au-btn.ghost{background:transparent;border-color:var(--au-text);color:var(--au-text)}
.au-btn.ghost:hover{background:var(--au-tile);filter:none}
.au-input{width:100%;height:46px;border-radius:8px;border:1px solid var(--c-line);background:var(--au-card);color:var(--au-text);padding:0 14px;font:inherit;font-size:14px}
.au-input::placeholder{color:var(--au-muted);opacity:.8}
.au-input option{background:var(--au-card);color:var(--au-text)}
.au-bar{height:8px;border-radius:99px;background:var(--au-tile);overflow:hidden;border:1px solid var(--au-line)}
.au-bar>i{display:block;height:100%;border-radius:99px;background:var(--au-brand)}
.au-icon{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:color-mix(in srgb,var(--au-green) 16%,transparent);color:var(--au-green);flex:none}
.au-icon.red{background:color-mix(in srgb,var(--au-red) 14%,transparent);color:var(--au-red)}
.au-grid2{display:grid;gap:16px}
@media(min-width:720px){.au-grid2{grid-template-columns:1fr 1fr}}
.au-stats{display:grid;gap:12px;grid-template-columns:repeat(2,1fr)}
@media(min-width:720px){.au-stats{grid-template-columns:repeat(4,1fr)}}
.au-stat{background:var(--au-card);border:1px solid var(--au-line);border-radius:12px;padding:16px 12px;text-align:center}
.au-stat b{display:block;font-family:var(--font-display);font-size:26px;font-weight:600;line-height:1.1}
.au-stat span{display:block;margin-top:6px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--au-muted)}
.au-grid3{display:grid;gap:16px}
@media(min-width:900px){.au-grid3{grid-template-columns:repeat(3,1fr)}}
.au-chip{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:5px 12px;font-size:13px;font-weight:600;background:var(--c-brand-soft);color:var(--au-brand);border:1px solid color-mix(in srgb,var(--au-brand) 30%,transparent)}
.au-chip i{font-style:normal;background:var(--au-brand);border-radius:99px;padding:1px 7px;font-size:11px;color:var(--c-bg)}
.au-tabs{display:inline-flex;gap:8px;flex-wrap:wrap}
.au-tab{border:1px solid var(--au-line);background:var(--au-card);color:var(--au-muted);border-radius:999px;padding:6px 14px;font-size:13px;font-weight:600;cursor:pointer}
.au-tab[aria-pressed=true]{background:var(--au-brand);color:var(--c-bg);border-color:transparent}
.au-media{display:grid;gap:14px;grid-template-columns:repeat(2,1fr)}
@media(min-width:720px){.au-media{grid-template-columns:repeat(4,1fr)}}
.au-post{position:relative;display:block;border-radius:12px;overflow:hidden;border:1px solid var(--au-line);background:var(--au-card);color:inherit;text-decoration:none}
.au-post .img{aspect-ratio:4/5;background:var(--au-tile);display:flex;align-items:center;justify-content:center;color:var(--au-muted);font-size:12px}
.au-post img{width:100%;height:100%;object-fit:cover;display:block}
.au-post .tag{position:absolute;top:8px;right:8px;background:var(--c-ink);color:var(--c-bg);border-radius:99px;padding:3px 10px;font-size:11px;font-weight:600}
.au-post .meta{padding:10px 12px;font-size:12px;display:flex;justify-content:space-between;gap:8px}
.au-label{display:block;font-size:13px;font-weight:500;color:var(--au-muted);margin-bottom:6px}
.au-input.ta{height:auto;min-height:140px;padding:12px 14px;line-height:1.55;resize:vertical}
.au-aff{position:relative}
.au-aff>span{position:absolute;top:50%;transform:translateY(-50%);font-size:13px;color:var(--au-muted);pointer-events:none}
.au-aff>span.pre{left:14px}.au-aff>span.suf{right:14px}
.au-aff>.au-input.hasp{padding-left:30px}.au-aff>.au-input.hass{padding-right:34px}
.au-row{display:flex;justify-content:space-between;align-items:center;gap:12px}
.au-link{color:var(--au-brand);text-decoration:underline;text-underline-offset:3px}
.au-toolcard{display:flex;flex-direction:column;gap:10px;background:var(--au-card);border:1px solid var(--au-line);border-radius:14px;padding:20px;text-decoration:none;color:inherit;transition:border-color .15s}
.au-toolcard:hover{border-color:var(--au-brand)}
.au-faq summary{cursor:pointer;font-weight:600;padding:14px 0;list-style:none}
.au-faq summary::-webkit-details-marker{display:none}
.au-faq details{border-top:1px solid var(--au-line)}
.au-bubble{background:var(--au-tile);border:1px solid var(--au-line);border-radius:18px 18px 18px 4px;padding:12px 14px;font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere}
.au-err{color:var(--au-red);font-size:14px}
@media (prefers-reduced-motion:reduce){.au-toolcard,.au-btn{transition:none}}
`
