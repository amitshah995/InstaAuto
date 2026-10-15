"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Search } from "lucide-react"

export function AuditForm() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.")
        return
      }
      router.push(`/audit/${data.id}`)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-xl mx-auto" noValidate>
      <label htmlFor="ig-username" className="sr-only">
        Instagram username
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
          <Input
            id="ig-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="yourbrand"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={loading}
            aria-invalid={!!error}
            aria-describedby={error ? "audit-error" : undefined}
            className="h-12 pl-7 text-base"
          />
        </div>
        <Button type="submit" size="lg" disabled={loading || username.trim().length === 0} className="h-12 px-6">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? "Auditing..." : "Audit my account"}
        </Button>
      </div>
      {error && (
        <p id="audit-error" role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
