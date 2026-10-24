"use client"

import { useRef, useState } from "react"
import { Download, Upload, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Automation } from "@/lib/types"

const FORMAT = "dmspark-automations"
const MAX_IMPORT = 50

/** Export all rules to a JSON file, or import such a file (also works to copy rules to another account). */
export function AutomationTransfer({
  userId,
  automations,
  onImported,
}: {
  userId: string | number | null
  automations: Automation[]
  onImported: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const exportAll = () => {
    if (!automations.length) return toast.error("Nothing to export yet")
    const payload = {
      format: FORMAT,
      version: 1,
      exported_at: new Date().toISOString(),
      automations: automations.map((a: any) => ({
        name: a.name,
        trigger_source: a.trigger_source,
        trigger_type: a.trigger_type,
        // postback rules get a fresh internal payload on import
        trigger_value: a.trigger_type === "postback" ? "" : a.trigger_value,
        content: a.response_content,
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `dmspark-automations-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importFile = async (file: File) => {
    if (!userId) return
    setBusy(true)
    try {
      const data = JSON.parse(await file.text())
      if (data?.format !== FORMAT || !Array.isArray(data.automations)) throw new Error("This is not a DMSpark automations file.")
      const list = data.automations.slice(0, MAX_IMPORT)
      let ok = 0
      let linkRules = 0
      for (const r of list) {
        if (!r?.name || !r?.trigger_source || !r?.content) continue
        if (JSON.stringify(r.content).includes("{link:")) linkRules++
        const res = await fetch("/api/automations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            name: String(r.name).slice(0, 120),
            trigger_source: r.trigger_source,
            trigger_type: r.trigger_type || "keyword",
            trigger_value: r.trigger_value || "x",
            content: r.content,
          }),
        })
        if (res.ok) ok++
      }
      toast.success(`Imported ${ok} of ${list.length} automations`, {
        description:
          linkRules > 0
            ? `${linkRules} use tracked links ({link:...}) from the old account — re-pick them under Links. Rules were imported without a specific post.`
            : "Rules were imported without a specific post — pick the post on each rule.",
      })
      onImported()
    } catch (e: any) {
      toast.error("Import failed", { description: e?.message || "Invalid file" })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const btn =
    "flex items-center gap-2 px-3.5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer justify-center shadow-xs bg-secondary text-foreground hover:bg-muted border border-border disabled:opacity-60"

  return (
    <>
      <button onClick={exportAll} className={btn} title="Download all rules as a file">
        <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export</span>
      </button>
      <button onClick={() => fileRef.current?.click()} disabled={busy} className={btn} title="Import rules from a file">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} <span className="hidden sm:inline">Import</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
      />
    </>
  )
}
