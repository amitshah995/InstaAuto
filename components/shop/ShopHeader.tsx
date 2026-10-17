import { initialOf } from "@/lib/shop/core"

/** Creator identity at the top of every public page: colourful band, story-ring avatar (or brand logo), name, handle, bio. */
export default function ShopHeader({ handle, displayName, bio, avatarUrl }: { handle: string; displayName: string | null; bio: string | null; avatarUrl?: string | null }) {
  const name = displayName || `@${handle}`
  return (
    <header className="text-center">
      <div className="shop-band h-28 md:h-36" aria-hidden />
      <div className="-mt-14 px-4 md:-mt-16">
        <div className="shop-story mx-auto h-28 w-28 md:h-32 md:w-32">
          <div className="h-full w-full overflow-hidden rounded-full bg-white p-[3px]">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={`${name} profile picture`} referrerPolicy="no-referrer" className="h-full w-full rounded-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-pink-100 to-violet-100 text-5xl font-black text-fuchsia-600 [font-family:var(--font-shop-display),ui-sans-serif]">
                {initialOf(name)}
              </div>
            )}
          </div>
        </div>
        <h1 className="shop-name mt-3 text-3xl font-extrabold tracking-tight md:text-4xl [font-family:var(--font-shop-display),ui-sans-serif]">{name}</h1>
        <p className="mt-0.5 text-sm font-medium text-muted-foreground">@{handle}</p>
        {bio && <p className="mx-auto mt-3 max-w-md whitespace-pre-line text-[15px] leading-relaxed text-foreground/80">{bio}</p>}
      </div>
    </header>
  )
}
