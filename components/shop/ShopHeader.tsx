import { initialOf } from "@/lib/shop/core"

/**
 * Creator identity at the top of every public page: banner (or a flat teal pattern when none), round
 * avatar (or initials), name, handle, bio. Sizes use container queries (@md) instead of viewport
 * breakpoints so the same component also renders correctly inside the phone preview in the dashboard.
 */
export default function ShopHeader({ handle, displayName, bio, avatarUrl, bannerUrl }: { handle: string; displayName: string | null; bio: string | null; avatarUrl?: string | null; bannerUrl?: string | null }) {
  const name = displayName || `@${handle}`
  return (
    <header className="text-center">
      {bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bannerUrl} alt="" referrerPolicy="no-referrer" className="block aspect-[4.5/1] max-h-80 w-full object-cover" />
      ) : (
        // Flat fallback so the avatar overlap still looks designed with no banner uploaded.
        <div aria-hidden className="shop-banner-fallback aspect-[4.5/1] max-h-80 w-full" />
      )}
      <div className="-mt-9 px-4 @md:-mt-14 @3xl:-mt-16">
        <div className="shop-story mx-auto h-20 w-20 @md:h-28 @md:w-28 @3xl:h-32 @3xl:w-32">
          <div className="h-full w-full overflow-hidden rounded-full bg-c-surface p-[3px]">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={`${name} profile picture`} referrerPolicy="no-referrer" className="h-full w-full rounded-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center rounded-full bg-c-brand-soft text-3xl font-black text-c-brand font-display @md:text-5xl">
                {initialOf(name)}
              </div>
            )}
          </div>
        </div>
        <h1 className="shop-name mt-3 text-2xl font-extrabold tracking-tight font-display @md:text-3xl @3xl:text-4xl">{name}</h1>
        <p className="mt-0.5 text-sm font-medium text-muted-foreground">@{handle}</p>
        {bio && <p className="mx-auto mt-3 max-w-md whitespace-pre-line text-[15px] leading-relaxed text-foreground/80">{bio}</p>}
      </div>
    </header>
  )
}
