/** Shop / Studio switcher. Sticks to the top while scrolling so visitors can always switch. */
export default function ShopTabs({ handle, active }: { handle: string; active: "shop" | "studio" }) {
  const item = "flex-1 rounded-full px-5 py-2 text-center text-sm font-bold transition-colors motion-reduce:transition-none"
  const on = "bg-foreground text-background"
  const off = "text-muted-foreground hover:text-foreground"
  return (
    <div className="sticky top-0 z-20 -mx-4 bg-background/80 px-4 py-3 backdrop-blur-md">
      <nav className="mx-auto flex w-full max-w-xs gap-1 rounded-full bg-muted p-1" aria-label="Sections">
        <a href={`/@${handle}`} aria-current={active === "shop" ? "page" : undefined} className={`${item} ${active === "shop" ? on : off}`}>Shop</a>
        <a href={`/@${handle}/studio`} aria-current={active === "studio" ? "page" : undefined} className={`${item} ${active === "studio" ? on : off}`}>Studio</a>
      </nav>
    </div>
  )
}
