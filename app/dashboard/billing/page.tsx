"use client"

/**
 * Billing page: current plan, usage meters, plan picker, invoices, cancel button.
 * Data: GET /api/billing/status. Actions: /api/billing/subscribe, /verify, /cancel.
 * Degrades: "Billing not configured" when Razorpay env is missing, "free beta" when billing is
 * not switched on, so nobody is blocked or asked to pay before the operator decides.
 */
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UsageMeter } from "@/components/billing/UsageMeter"
import { formatInr } from "@/lib/billing/plans"

type Plan = { id: string; name: string; priceInrMonthly: number; dmsPerMonth: number; aiRunsPerDay: number; seats: number; highlights: string[] }
type Status = {
  configured: boolean
  enabled: boolean
  plan: Plan
  usage: { dms: any; ai: any; resets: { dmsAt: string; aiAt: string }; enforced: boolean }
  subscription: { status: string; cancelAtCycleEnd: boolean; currentPeriodEnd: string | null } | null
  plans: Plan[]
  invoices: Array<{ id: string; amount: number; currency: string; status: string; url?: string; issuedAt?: number }>
}

const dateFmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })

/** Loads Razorpay Checkout on demand so the script is only fetched when someone actually pays. */
function loadCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true)
    const s = document.createElement("script")
    s.src = "https://checkout.razorpay.com/v1/checkout.js"
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

export default function BillingPage() {
  const [st, setSt] = useState<Status | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch("/api/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSt(d))
      .catch(() => {})
  }, [])
  useEffect(load, [load])

  async function subscribe(planId: string) {
    setBusy(planId)
    try {
      const res = await fetch("/api/billing/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || "Could not start checkout")
      if (!(await loadCheckout())) throw new Error("Could not load the payment window")
      const rzp = new (window as any).Razorpay({
        key: d.keyId,
        subscription_id: d.subscriptionId,
        name: "Celra",
        description: `${planId} plan`,
        handler: async (r: any) => {
          const v = await fetch("/api/billing/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) })
          if (v.ok) toast.success("Payment received. Your plan is being activated.")
          else toast.error("We could not confirm the payment yet. If you were charged, your plan will switch on shortly.")
          load()
        },
        modal: { ondismiss: () => setBusy(null) },
      })
      rzp.open()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function cancel() {
    if (!confirm("Cancel at the end of the current billing period? You keep your plan until then.")) return
    setBusy("cancel")
    const res = await fetch("/api/billing/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
    const d = await res.json().catch(() => ({}))
    if (res.ok) toast.success("Cancellation scheduled for the end of this period.")
    else toast.error(d.error || "Could not cancel")
    setBusy(null)
    load()
  }

  if (!st) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  const paid = st.plan.id !== "free"
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">Flat monthly plans. You pay for DMs sent, never per contact.</p>
      </div>

      {!st.configured && (
        <Card><CardContent className="py-5 text-sm">
          <strong>Billing not configured.</strong> Everyone is on the free beta plan, with no limits blocking your automations.
        </CardContent></Card>
      )}
      {st.configured && !st.enabled && (
        <Card><CardContent className="py-5 text-sm">
          Billing is not open yet. Everyone is on the free beta, so nothing is charged and nothing is blocked. Usage is still counted below.
        </CardContent></Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{st.enabled ? `${st.plan.name} plan` : "Free beta"}</CardTitle>
          <CardDescription>
            {st.enabled && paid && st.subscription?.currentPeriodEnd
              ? st.subscription.cancelAtCycleEnd
                ? `Cancels on ${dateFmt(st.subscription.currentPeriodEnd)}. You keep your plan until then.`
                : `Renews around ${dateFmt(st.subscription.currentPeriodEnd)}.`
              : "Usage this period"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <UsageMeter label="DMs sent this month" quota={st.usage.dms} resetNote={`Resets ${dateFmt(st.usage.resets.dmsAt)} (UTC)`} />
          <UsageMeter label="AI runs today" quota={st.usage.ai} resetNote="Resets at midnight UTC" />
          {st.enabled && paid && !st.subscription?.cancelAtCycleEnd && (
            <Button variant="outline" onClick={cancel} disabled={busy === "cancel"}>Cancel plan at period end</Button>
          )}
          <p className="text-xs text-muted-foreground">
            See the <Link href="/refund-policy" className="underline">refund and cancellation policy</Link>.
          </p>
        </CardContent>
      </Card>

      {st.enabled && (
        <div className="grid gap-4 md:grid-cols-3">
          {st.plans.map((p) => (
            <Card key={p.id} className={p.id === st.plan.id ? "border-2 border-primary" : ""}>
              <CardHeader>
                <CardTitle>{p.name}</CardTitle>
                <CardDescription>{p.priceInrMonthly === 0 ? "Free" : `${formatInr(p.priceInrMonthly)} / month`}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <ul className="space-y-1">
                  <li>{p.dmsPerMonth.toLocaleString("en-IN")} DMs / month</li>
                  <li>{p.aiRunsPerDay} AI runs / day</li>
                  <li>{p.seats} seat{p.seats === 1 ? "" : "s"}</li>
                </ul>
                {p.id === "free" ? null : p.id === st.plan.id ? (
                  <p className="text-muted-foreground">Your current plan</p>
                ) : (
                  <Button className="w-full" onClick={() => subscribe(p.id)} disabled={!!busy || (paid && !st.subscription?.cancelAtCycleEnd)}>
                    {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : `Choose ${p.name}`}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {st.enabled && st.invoices.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {st.invoices.map((i) => (
              <div key={i.id} className="flex items-center justify-between">
                <span>{i.issuedAt ? dateFmt(new Date(i.issuedAt * 1000).toISOString()) : i.id} · {formatInr(i.amount / 100)} · {i.status}</span>
                {i.url && <a href={i.url} target="_blank" rel="noopener noreferrer" className="underline">View invoice</a>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
