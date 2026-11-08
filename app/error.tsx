"use client"

import { CelraLogo } from "@/components/ui/celra-logo"
import { BRAND_NAME } from "@/lib/site"

export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <CelraLogo variant="mark" size={52} />
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">{BRAND_NAME} hit an unexpected problem. Please try again in a moment.</p>
        <button
          onClick={reset}
          className="min-h-11 cursor-pointer rounded-[5px] border-2 border-primary bg-primary px-6 text-sm font-semibold text-primary-foreground hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Try again
        </button>
        {error.digest && <p className="text-[11px] text-muted-foreground">Reference: {error.digest}</p>}
      </div>
    </main>
  )
}
