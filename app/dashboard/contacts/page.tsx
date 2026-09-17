"use client"

import { useEffect, useMemo, useState } from "react"
import { useInstagramSession } from "@/hooks/use-instagram-session"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Users, Search, Download, Mail, Phone, User } from "lucide-react"

interface Contact {
  id: string
  igsid: string
  name: string | null
  email: string | null
  phone: string | null
  custom_fields: Record<string, any>
  created_at: string
}

export default function ContactsPage() {
  const { userId, isLoading: isSessionLoading } = useInstagramSession()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!userId) return
    const load = async () => {
      try {
        const res = await fetch("/api/contacts")
        const data = await res.json()
        if (Array.isArray(data)) setContacts(data)
      } catch (err) {
        console.error("Failed to load contacts:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter((c) =>
      [c.name, c.email, c.phone, c.igsid, ...Object.values(c.custom_fields || {})]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    )
  }, [contacts, search])

  // Custom-field keys across all contacts, shown as extra columns
  const customKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const c of contacts) for (const k of Object.keys(c.custom_fields || {})) keys.add(k)
    return Array.from(keys)
  }, [contacts])

  if (isSessionLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-semibold">Loading contacts...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-primary" /> Contacts
          </h1>
          <p className="text-sm text-muted-foreground">
            Leads collected from your Lead Qualification DM flows — {contacts.length} total.
          </p>
        </div>
        <a href="/api/contacts/export">
          <Button className="rounded-xl font-bold gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </a>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts..."
          className="pl-9 rounded-xl bg-secondary/30 border-border"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed border-border bg-card/40 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-secondary rounded-2xl flex items-center justify-center border border-border">
            <Users className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1">
            {contacts.length === 0 ? "No contacts yet" : "No matches"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {contacts.length === 0
              ? "Create a \"Lead Qual\" DM automation to start collecting leads here."
              : "Try a different search term."}
          </p>
        </Card>
      ) : (
        <Card className="border-border bg-card/90 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30 text-left">
                  <th className="p-3 font-bold text-xs text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="p-3 font-bold text-xs text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="p-3 font-bold text-xs text-muted-foreground uppercase tracking-wider">Phone</th>
                  {customKeys.map((k) => (
                    <th key={k} className="p-3 font-bold text-xs text-muted-foreground uppercase tracking-wider">{k}</th>
                  ))}
                  <th className="p-3 font-bold text-xs text-muted-foreground uppercase tracking-wider">Added</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 hover:bg-secondary/20 transition-colors">
                    <td className="p-3 font-semibold text-foreground flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      {c.name || <span className="text-muted-foreground font-normal">—</span>}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {c.email ? (
                        <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 shrink-0" />{c.email}</span>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {c.phone ? (
                        <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 shrink-0" />{c.phone}</span>
                      ) : "—"}
                    </td>
                    {customKeys.map((k) => (
                      <td key={k} className="p-3 text-muted-foreground">{c.custom_fields?.[k] ?? "—"}</td>
                    ))}
                    <td className="p-3 text-muted-foreground text-xs">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
