import { PageShell } from "@/components/marketing/page-shell"
import { SHOP_THEME_CSS } from "@/lib/shop/theme-css"

// Public creator pages use the shared Celra header and footer. The .shop-theme block maps the shop
// helper classes to flat Celra colours (light and dark). No gradients, no animation.
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell strip={false}>
      <div className="shop-theme">
        <style>{SHOP_THEME_CSS}</style>
        {children}
      </div>
    </PageShell>
  )
}
