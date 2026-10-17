"use client"

export default function ShopError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
      <div className="max-w-sm space-y-3">
        <h1 className="text-xl font-bold">This page could not be loaded</h1>
        <p className="text-sm text-muted-foreground">Please try again in a moment.</p>
        <button onClick={reset} className="rounded-full bg-foreground px-5 py-2 text-sm font-bold text-background">Try again</button>
        {error.digest && <p className="text-[11px] text-muted-foreground">Reference: {error.digest}</p>}
      </div>
    </main>
  )
}
