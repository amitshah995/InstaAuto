// Flat Celra styling for the public shop page. Shared by app/shop/layout.tsx and the dashboard's live
// preview, so what the owner sees on the right is built from the very same CSS and components as the
// real page. No gradients: the no-banner fallback is a flat teal band with a tiny SVG dot pattern.
const DOTS = encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'><circle cx='3' cy='3' r='1.4' fill='#FBFAF6' fill-opacity='.22'/><circle cx='14' cy='14' r='1.4' fill='#FF6F4D' fill-opacity='.55'/></svg>",
)
export const SHOP_THEME_CSS = `
.shop-theme{--background:var(--c-bg);--foreground:var(--c-ink);--card:var(--c-surface);--card-foreground:var(--c-ink);--muted:var(--c-soft);--muted-foreground:var(--c-muted);--border:var(--c-line);--primary:var(--c-accent);--primary-foreground:var(--c-accent-ink);
  color:var(--c-ink)}
.shop-story{background:var(--c-brand);padding:3px;border-radius:9999px}
.shop-name{color:var(--c-ink)}
.shop-ring{background:var(--c-line);padding:1px;transition:background-color .15s,transform .15s}
.shop-card:hover .shop-ring,.shop-card:focus-within .shop-ring{background:var(--c-brand)}
.shop-pill{background:var(--c-brand);color:var(--c-bg)}
.shop-btn{background:var(--c-accent);color:var(--c-accent-ink)}
.shop-price{color:var(--c-ink)}
.shop-tag{color:var(--c-brand);font-weight:600}
.shop-banner-fallback{background-color:var(--c-brand);background-image:url("data:image/svg+xml,${DOTS}")}
.shop-made{color:var(--c-muted);transition:color .15s}
.shop-made:hover{color:var(--c-brand)}
@media (prefers-reduced-motion:reduce){.shop-ring{transition:none}}
`
