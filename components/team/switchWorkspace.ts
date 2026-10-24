/** Ask the server to switch the signed session, then reload the dashboard as that account. */
export async function switchWorkspace(ownerId?: string): Promise<string | null> {
  const res = await fetch("/api/team/switch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerId: ownerId ?? null }),
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok) return d.error || "Could not switch"
  try {
    localStorage.setItem("ig_user_id", String(d.userId))
    localStorage.setItem("ig_username", String(d.username))
    sessionStorage.removeItem("dmspark_welcomed")
    sessionStorage.setItem("dmspark_welcomed", "true")
  } catch {}
  window.location.assign("/dashboard")
  return null
}
