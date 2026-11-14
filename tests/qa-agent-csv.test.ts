// QA: the leads CSV (contacts export) must not let an Instagram display name run as a spreadsheet formula.
import test from "node:test"
import assert from "node:assert/strict"
import { csvEscape } from "../lib/contacts/csv.ts"

test("csv: formula-looking cells are neutralised, phones, numbers and normal text are not changed", () => {
  for (const evil of ["=HYPERLINK(\"http://evil\")", "+cmd|' /C calc'!A0", "-2+3+cmd", "@SUM(A1)", "\t=1+1", "\r=1+1", "=1+1"]) {
    assert.ok(csvEscape(evil).replace(/^"/, "").startsWith("'"), evil)
  }
  for (const ok of ["+919876501234", "+91 98765 01234", "-5", "Asha", "asha@example.com", "", null, undefined, 42]) {
    assert.ok(!csvEscape(ok).startsWith("'"), String(ok))
  }
  assert.equal(csvEscape('a,"b"'), '"a,""b"""')
  assert.equal(csvEscape("line\nbreak"), '"line\nbreak"')
  assert.equal(csvEscape("+919876501234"), "+919876501234")
})
