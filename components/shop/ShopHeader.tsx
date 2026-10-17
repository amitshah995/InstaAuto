import { initialOf } from "@/lib/shop/core"

/** Creator identity at the top of every public page: soft band, avatar overlapping its edge, name, handle, bio. */
export default function ShopHeader({ handle, displayName, bio }: { handle: string; displayName: string | null; bio: string | null }) {
  const name = displayName || `@${handle}`
  return (
    <header className="text-center">
      <div className="h-28 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent md:h-36" aria-hidden />
      <div className="-mt-12 px-4 md:-mt-14">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-card text-4xl font-black text-primary shadow-sm ring-4 ring-background md:h-28 md:w-28 md:text-5xl [font-family:var(--font-shop-display),ui-sans-serif]">
          {initialOf(name)}
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl [font-family:var(--font-shop-display),ui-sans-serif]">{name}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">@{handle}</p>
        {bio && <p className="mx-auto mt-3 max-w-md whitespace-pre-line text-[15px] leading-relaxed text-foreground/80">{bio}</p>}
      </div>
    </header>
  )
}
