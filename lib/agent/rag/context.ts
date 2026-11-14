/**
 * Decides HOW the knowledge is shown to the model this turn. Pure.
 *
 * Who calls this: lib/agent/engine.ts after retrieval, lib/agent/prompt.ts (renders the result).
 * Rules (no regression for existing setups):
 *  - nothing indexed yet (migration 32 not run, or the Reel was saved before RAG), or retrieval failed -> "stuffing": the whole
 *    knowledge goes in the prompt exactly as before;
 *  - retrieval found passages -> "rag": only those passages plus the essentials (Reel title, offer headline);
 *  - indexed but nothing relevant: a SMALL knowledge still goes in whole (so nothing regresses); a LARGE one gets the
 *    essentials only and the prompt says no passage was found, so the agent says it will connect a human.
 */
import type { Knowledge } from "../types.ts"
import type { Retrieval } from "./retrieve.ts"
import type { SourceKind } from "./store.ts"

/** Knowledge up to this many characters (caption + offer + FAQs) counts as small. */
export const SMALL_KNOWLEDGE_CHARS = 3500

export function knowledgeSize(k: Knowledge | null): number {
  if (!k) return 0
  return k.caption.length + k.offer.length + k.title.length + k.faqs.reduce((n, f) => n + f.q.length + f.a.length, 0)
}

export type KnowledgeView =
  | { mode: "stuffing" }
  | { mode: "rag"; passages: { title: string; content: string; kind?: SourceKind }[]; noneFound: boolean }

export function chooseKnowledgeView(k: Knowledge | null, r: Retrieval | null | undefined): KnowledgeView {
  if (!k || !r || !r.indexed) return { mode: "stuffing" }
  if (r.chunks.length > 0) return { mode: "rag", passages: r.chunks.map((c) => ({ title: c.title, content: c.content, kind: c.sourceKind })), noneFound: false }
  if (knowledgeSize(k) <= SMALL_KNOWLEDGE_CHARS) return { mode: "stuffing" }
  return { mode: "rag", passages: [], noneFound: true }
}

/** First line or sentence of the offer, capped: the "headline" kept in every prompt. */
export function offerHeadline(offer: string, max = 160): string {
  const first = String(offer ?? "").trim().split(/\n|(?<=[.!?।])\s/)[0] ?? ""
  return Array.from(first).slice(0, max).join("").trim()
}
