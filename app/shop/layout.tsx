import { PageShell } from "@/components/marketing/page-shell"

// Public creator pages use the shared Celra header and footer. The .shop-theme block maps the shop
// helper classes to flat Celra colours (light and dark). No gradients, no animation.
const css = `
.shop-theme{--background:var(--c-bg);--foreground:var(--c-ink);--card:var(--c-surface);--card-foreground:var(--c-ink);--muted:var(--c-soft);--muted-foreground:var(--c-muted);--border:var(--c-line);--primary:var(--c-accent);--primary-foreground:var(--c-accent-ink);
  color:var(--c-ink)}
.shop-story{background:var(--c-brand);padding:3px;border-radius:9999px}
.shop-name{color:var(--c-ink)}
.shop-ring{background:var(--c-line);padding:1px}
.shop-pill{background:var(--c-brand);color:var(--c-bg)}
.shop-btn{background:var(--c-accent);color:var(--c-accent-ink)}
.shop-price{color:var(--c-ink)}
.shop-tag{color:var(--c-brand);font-weight:600}
`

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell strip={false}>
      <div className="shop-theme">
        <style>{css}</style>
        {children}
      </div>
    </PageShell>
  )
}
