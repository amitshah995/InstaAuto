// Unit tests for Phase 4 pure logic: SSRF guard, HMAC signing, retry schedule, payload shaping.
import test from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { checkWebhookUrl, isBlockedIp, resolvePublicAddress } from "../lib/webhooks/ssrf.ts"
import { signPayload, verifySignature } from "../lib/webhooks/signing.ts"
import { MAX_ATTEMPTS, buildEnvelope, isWebhookEvent, maskSecret, newSecret, nextRetryDelaySec, redirectCountsAsSuccess, shapePayload } from "../lib/webhooks/policy.ts"

test("SSRF: blocked IPv4 ranges", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "224.0.0.1", "255.255.255.255", "198.18.0.1"]) {
    assert.equal(isBlockedIp(ip), true, ip)
  }
  for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "172.15.0.1", "93.184.216.34", "100.63.0.1"]) {
    assert.equal(isBlockedIp(ip), false, ip)
  }
})

test("SSRF: blocked IPv6 ranges including mapped and tunnelled IPv4", () => {
  for (const ip of ["::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:169.254.169.254", "::ffff:7f00:1", "64:ff9b::7f00:1", "2002:7f00:1::1", "2001:db8::1"]) {
    assert.equal(isBlockedIp(ip), true, ip)
  }
  for (const ip of ["2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8"]) {
    assert.equal(isBlockedIp(ip), false, ip)
  }
  assert.equal(isBlockedIp("not-an-ip"), true)
})

test("SSRF: URL syntax rules", () => {
  assert.equal(checkWebhookUrl("https://script.google.com/macros/s/abc/exec").ok, true)
  assert.equal(checkWebhookUrl("https://example.com:443/hook").ok, true)
  for (const bad of [
    "http://example.com/hook", // not https
    "ftp://example.com", "javascript:alert(1)", "not a url", "",
    "https://user:pw@example.com/", // credentials
    "https://example.com:8443/", // non-standard port
    "https://localhost/hook", "https://api.localhost/", "https://printer.local/", "https://db.internal/",
    "https://127.0.0.1/", "https://[::1]/", "https://169.254.169.254/latest/meta-data/", "https://10.0.0.5/",
    "https://[::ffff:127.0.0.1]/",
  ]) {
    assert.equal(checkWebhookUrl(bad).ok, false, bad)
  }
})

test("SSRF: DNS results must ALL be public (rebinding / multi-record defence)", async () => {
  const mk = (...addrs: string[]) => async () => addrs.map((a) => ({ address: a, family: a.includes(":") ? 6 : 4 }))
  assert.deepEqual(await resolvePublicAddress("ok.example", mk("93.184.216.34")), { ok: true, address: "93.184.216.34", family: 4 })
  assert.equal((await resolvePublicAddress("evil.example", mk("93.184.216.34", "127.0.0.1"))).ok, false)
  assert.equal((await resolvePublicAddress("meta.example", mk("169.254.169.254"))).ok, false)
  assert.equal((await resolvePublicAddress("v6.example", mk("fe80::1"))).ok, false)
  assert.equal((await resolvePublicAddress("none.example", async () => [])).ok, false)
  assert.equal((await resolvePublicAddress("err.example", async () => { throw new Error("ENOTFOUND") })).ok, false)
  // literal IPs never hit DNS
  assert.equal((await resolvePublicAddress("127.0.0.1", async () => { throw new Error("should not resolve") })).ok, false)
})

test("signing: header format, verification, tamper and replay", () => {
  const body = '{"id":"1","event":"dm_sent"}'
  const header = signPayload("whsec_x", body, 1_700_000_000)
  assert.match(header, /^t=1700000000,v1=[0-9a-f]{64}$/)
  assert.equal(verifySignature("whsec_x", body, header, 1_700_000_100), true)
  assert.equal(verifySignature("whsec_x", body + " ", header, 1_700_000_100), false) // body tampered
  assert.equal(verifySignature("whsec_y", body, header, 1_700_000_100), false) // wrong secret
  assert.equal(verifySignature("whsec_x", body, header, 1_700_001_000), false) // older than 5 minutes: replay
  assert.equal(verifySignature("whsec_x", body, null), false)
  assert.equal(verifySignature("whsec_x", body, "garbage"), false)
})

test("retry schedule: 1m,5m,30m,2h,12h then dead", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(nextRetryDelaySec), [60, 300, 1800, 7200, 43200])
  assert.equal(nextRetryDelaySec(6), null)
  assert.equal(MAX_ATTEMPTS, 6)
})

test("events, secrets and presets", () => {
  assert.equal(isWebhookEvent("lead_captured"), true)
  assert.equal(isWebhookEvent("drop_table"), false)
  const s = newSecret()
  assert.match(s, /^whsec_[A-Za-z0-9_-]{32}$/)
  assert.equal(maskSecret("whsec_abcdefgh"), "whsec_••••efgh")
  assert.equal(redirectCountsAsSuccess("sheets", "script.google.com"), true)
  assert.equal(redirectCountsAsSuccess("sheets", "evil.com"), false)
  assert.equal(redirectCountsAsSuccess("generic", "script.google.com"), false)
})

test("sheets preset is flat and carries an HMAC of the event id, not the secret", () => {
  const env = buildEnvelope("lead_captured", { name: "Asha", custom_fields: { city: "Pune" } }, "evt-1", new Date("2026-11-09T00:00:00Z"))
  const flat = shapePayload("sheets", env, "whsec_s") as Record<string, string>
  assert.equal(flat.event, "lead_captured")
  assert.equal(flat.event_id, "evt-1")
  assert.equal(flat.name, "Asha")
  assert.equal(flat.custom_fields, '{"city":"Pune"}')
  assert.equal(flat.signature, crypto.createHmac("sha256", "whsec_s").update("evt-1").digest("hex"))
  assert.equal(JSON.stringify(flat).includes("whsec_s"), false)
  // generic keeps the envelope
  assert.deepEqual(shapePayload("generic", env, "whsec_s"), env)
})
