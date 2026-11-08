// Unit tests for the Unicode keyword matcher: English, Hinglish (Latin script), Devanagari, emoji, punctuation, aliases.
import test from "node:test"
import assert from "node:assert/strict"
import { matchesAnyKeyword, normalizeForMatch, textMatchesKeyword, tokenize } from "../lib/matching/keywords.ts"
import { pickBranch } from "../lib/flows/engine.ts"

const m = (text: string, kw: string, aliases: boolean | string[][] = false) => textMatchesKeyword(text, kw, { aliases })

test("English: whole words, case-insensitive, punctuation ignored", () => {
  assert.equal(m("What is the PRICE?", "price"), true)
  assert.equal(m("price!!!", "Price"), true)
  assert.equal(m("(price)", "price"), true)
  assert.equal(m("priceless art", "price"), false) // whole-word semantics kept
  assert.equal(m("reprice", "price"), false)
  assert.equal(m("send me the free guide now", "free guide"), true) // phrase
  assert.equal(m("guide free", "free guide"), false) // order matters
  assert.equal(m("10% off today", "10"), true)
  assert.equal(m("regex chars a+b (test)", "a+b"), true) // a, b tokens in sequence; no regex injection
  assert.equal(m("hello", ""), false) // empty keyword matches nothing
})

test("Hinglish in Latin script and the alias hook", () => {
  assert.equal(m("bhai iska rate kya hai", "rate"), true)
  assert.equal(m("Kitna hai ye?", "kitna"), true)
  // aliases off: different words do not match each other
  assert.equal(m("iska daam batao", "price"), false)
  // aliases on: group members trigger each other
  assert.equal(m("iska daam batao", "price", true), true)
  assert.equal(m("Price please", "kitna", true), true)
  assert.equal(m("kitne ka hai", "rate", true), true)
  assert.equal(m("hello there", "price", true), false)
  // custom groups
  assert.equal(m("sasta hai?", "cheap", [["cheap", "sasta"]]), true)
})

test("Devanagari (where ASCII \\b fails)", () => {
  assert.equal(m("इसकी कीमत क्या है?", "कीमत"), true)
  assert.equal(m("कीमत?", "कीमत"), true)
  assert.equal(m("कीमतें बताओ", "कीमत"), false) // different word, still whole-word
  assert.equal(m("मुझे लिंक चाहिए", "लिंक"), true)
  // zero-width joiner/non-joiner inside a word must not break matching
  assert.equal(m("क्‍ष", "क्ष"), true)
  assert.equal(m("price कीमत", "कीमत"), true)
  assert.equal(m("कितना है", "कितना", true), true)
  // The old regex really did fail on this, which is why this matcher exists
  assert.equal(/\bकीमत\b/i.test("इसकी कीमत क्या है?"), false)
})

test("Other scripts: Arabic, Cyrillic, CJK", () => {
  assert.equal(m("كم السعر؟", "السعر"), true)
  assert.equal(m("Какая цена?", "цена"), true)
  assert.equal(m("ЦЕНА", "цена"), true)
  assert.equal(m("这个价格是多少", "价格"), true) // needs Intl.Segmenter to find the word
  assert.equal(m("this has no match", "价格"), false)
})

test("Emoji keywords and normalisation", () => {
  assert.equal(m("🔥🔥🔥", "🔥"), true)
  assert.equal(m("love it ❤️", "❤"), true) // variation selector ignored
  assert.equal(m("nice 👍🏽", "👍"), true) // skin tone ignored
  assert.equal(m("fire🔥price", "price"), true) // emoji is a boundary
  assert.equal(m("🙏", "🔥"), false)
  assert.deepEqual(tokenize("Hi 🔥!"), ["hi", "🔥"])
})

test("Invisible and compatibility characters", () => {
  assert.equal(m("pr​ice", "price"), true) // zero-width space inside the word
  assert.equal(m("ＰＲＩＣＥ", "price"), true) // full-width letters via NFKC
  assert.equal(m("﻿price", "price"), true) // BOM
  assert.equal(normalizeForMatch("  Hello,   WORLD!! "), "hello world")
})

test("matchesAnyKeyword: comma lists", () => {
  assert.equal(matchesAnyKeyword("send link pls", "price, link ,info"), true)
  assert.equal(matchesAnyKeyword("send link pls", "price,info"), false)
  assert.equal(matchesAnyKeyword("anything", "a,,b"), false) // empty piece no longer matches everything
  assert.equal(matchesAnyKeyword("anything", ""), false)
  assert.equal(matchesAnyKeyword("anything", null), false)
  assert.equal(matchesAnyKeyword("कीमत?", "price,कीमत", { aliases: false }), true)
})

test("flow condition branches use the same matcher", () => {
  const node = { branches: [{ keyword: "कीमत", next: "a" }, { keyword: "yes", next: "b" }], default_next: "d" }
  assert.equal(pickBranch(node, "इसकी कीमत?"), "a")
  assert.equal(pickBranch(node, "YES!"), "b")
  assert.equal(pickBranch(node, "maybe"), "d")
})
