"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useInstagramSession } from "@/hooks/use-instagram-session"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Users, Search, Download, Mail, Phone, User, Tag, X } from "lucide-react"
import { BroadcastPanel } from "@/components/contacts/broadcast-panel"
import { allTags, cleanTag, cleanTags, matchesSegment, type Segment } from "@/lib/contacts/segments"

interface Contact {
  id: string
  igsid: string
  name: string | null
  email: string | null
  phone: string | null
  tags?: string[]
  custom_fields: Record<string, any>
  created_at: string
}

type Quick = "all" | "email" | "phone" | "week"

export default function ContactsPage() {
  const { userId, isLoading: isSessionLoading } = useInstagramSession()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [quick, setQuick] = useState<Quick>("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkTag, setBulkTag] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts")
      const data = await res.json()
      if (Array.isArray(data)) setContacts(data)
    } catch (err) {
      console.error("Failed to load contacts:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (userId) load()
  }, [userId, load])

  const segment: Segment = useMemo(
    () => ({
      text: search,
      tagsAny: tagFilter ? [tagFilter] : undefined,
      hasEmail: quick === "email" ? true : undefined,
      hasPhone: quick === "phone" ? true : undefined,
      addedWithinDays: quick === "week" ? 7 : undefined,
    }),
    [search, tagFilter, quick],
  )

  const filtered = useMemo(() => contacts.filter((c) => matchesSegment(c, segment)), [contacts, segment])
  const tagList = useMemo(() => allTags(contacts), [contacts])

  const customKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const c of contacts) for (const k of Object.keys(c.custom_fields || {})) keys.add(k)
    return Array.from(keys)
  }, [contacts])

  const patch = async (ids: string[], body: { addTags?: string[]; removeTags?: string[] }) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, ...body }),
      })
      if (!res.ok) throw new Error(res.status === 500 ? "Tags need the contacts migration (13) to be run." : "Update failed")
      await load()
    } catch (e: any) {
      setError(e.message || "Update failed")
    } finally {
      setBusy(false)
    }
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id))
  const toggleAll = () => setSelected(allVisibleSelected ? new Set() : new Set(filtered.map((c) => c.id)))
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const applyBulkTag = async () => {
    const t = cleanTag(bulkTag)
    if (!t || selected.size === 0) return
    await patch([...selected], { addTags: [t] })
    setBulkTag("")
  }

  if (isSessionLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-semibold">Loading contacts...</p>
      </div>
    )
  }

  const quickBtn = (id: Quick, label: string) => (
    <button
      key={id}
      onClick={() => setQuick(id)}
      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
        quick === id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-5 max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-primary" /> Contacts
          </h1>
          <p className="text-sm text-muted-foreground">
            Leads from your DM flows — {contacts.length} total{filtered.length !== contacts.length ? `, ${filtered.length} shown` : ""}.
          </p>
        </div>
        <a href="/api/contacts/export">
          <Button className="rounded-xl font-bold gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="pl-9 rounded-xl bg-secondary/30 border-border"
          />
        </div>
        {quickBtn("all", "All")}
        {quickBtn("email", "Has email")}
        {quickBtn("phone", "Has phone")}
        {quickBtn("week", "Added this week")}
      </div>

      <BroadcastPanel segment={segment} />

      {tagList.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Tag className="w-4 h-4 text-muted-foreground" />
          {tagList.map(({ tag, count }) => (
            <button
              key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                tagFilter === tag ? "bg-primary/15 border-primary text-primary" : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              #{tag} <span className="opacity-60">{count}</span>
            </button>
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <span className="text-sm font-bold">{selected.size} selected</span>
          <Input
            value={bulkTag}
            onChange={(e) => setBulkTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyBulkTag()}
            placeholder="Tag to add, e.g. hot-lead"
            className="h-9 w-56 rounded-lg"
            maxLength={30}
          />
          <Button size="sm" disabled={busy || !cleanTag(bulkTag)} onClick={applyBulkTag} className="rounded-lg font-bold">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add tag"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive font-semibold">{error}</p>}

      {filtered.length === 0 ? (
        <Card className="border-dashed border-border bg-card/40 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-secondary rounded-2xl flex items-center justify-center border border-border">
            <Users className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1">{contacts.length === 0 ? "No contacts yet" : "No matches"}</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {contacts.length === 0 ? 'Create a "Lead Qual" DM automation to start collecting leads here.' : "Try a different filter or search term."}
          </p>
        </Card>
      ) : (
        <Card className="border-border bg-card/90 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30 text-left">
                  <th className="p-3 w-8">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all" />
                  </th>
                  {["Name", "Email", "Phone", "Tags"].map((h) => (
                    <th key={h} className="p-3 font-bold text-xs text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                  {customKeys.map((k) => (
                    <th key={k} className="p-3 font-bold text-xs text-muted-foreground uppercase tracking-wider">{k}</th>
                  ))}
                  <th className="p-3 font-bold text-xs text-muted-foreground uppercase tracking-wider">Added</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 hover:bg-secondary/20 transition-colors">
                    <td className="p-3">
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} aria-label="Select contact" />
                    </td>
                    <td className="p-3 font-semibold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        {c.name || <span className="text-muted-foreground font-normal">—</span>}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {c.email ? <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 shrink-0" />{c.email}</span> : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {c.phone ? <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 shrink-0" />{c.phone}</span> : "—"}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {cleanTags(c.tags).map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold px-2 py-0.5">
                            #{t}
                            <button aria-label={`Remove ${t}`} onClick={() => patch([c.id], { removeTags: [t] })} disabled={busy}>
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </td>
                    {customKeys.map((k) => (
                      <td key={k} className="p-3 text-muted-foreground">{c.custom_fields?.[k] ?? "—"}</td>
                    ))}
                    <td className="p-3 text-muted-foreground text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
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
