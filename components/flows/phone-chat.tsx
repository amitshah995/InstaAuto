import type { SimLine } from "@/lib/flows/engine"

/**
 * Presentational Instagram-DM style phone preview. No hooks, so it works in both
 * server pages (public templates) and the interactive builder test panel.
 * Visual approximation only: it is not Instagram's real UI.
 */
export function PhoneChat({
  lines,
  account = "your_brand",
  footer,
  height = 440,
}: {
  lines: SimLine[]
  account?: string
  footer?: React.ReactNode
  height?: number
}) {
  const initial = (account[0] || "D").toUpperCase()
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 340,
        margin: "0 auto",
        borderRadius: 38,
        padding: 10,
        background: "#111",
        boxShadow: "0 18px 50px rgba(0,0,0,.28)",
      }}
    >
      <div style={{ borderRadius: 30, overflow: "hidden", background: "#fff", color: "#111", display: "flex", flexDirection: "column" }}>
        {/* status notch */}
        <div style={{ height: 22, display: "flex", justifyContent: "center", alignItems: "center", background: "#fff" }}>
          <span style={{ width: 70, height: 6, borderRadius: 6, background: "#111" }} />
        </div>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 14px 10px", borderBottom: "1px solid #eee" }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>‹</span>
          <span
            style={{
              width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center",
              color: "#fff", fontWeight: 800, fontSize: 14,
              background: "linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)",
            }}
          >
            {initial}
          </span>
          <span style={{ display: "grid", lineHeight: 1.2 }}>
            <b style={{ fontSize: 13 }}>{account}</b>
            <span style={{ fontSize: 11, color: "#8e8e8e" }}>Active now</span>
          </span>
        </div>
        {/* messages */}
        <div style={{ height, overflowY: "auto", padding: "12px 12px 8px", display: "flex", flexDirection: "column", gap: 6, background: "#fff" }}>
          {lines.map((l, i) =>
            l.from === "system" ? (
              <span key={i} style={{ alignSelf: "center", fontSize: 10.5, color: "#8e8e8e", margin: "2px 0" }}>{l.text}</span>
            ) : l.from === "user" ? (
              <span
                key={i}
                style={{
                  alignSelf: "flex-end", maxWidth: "78%", padding: "8px 13px", borderRadius: 20, borderBottomRightRadius: 6,
                  fontSize: 13.5, color: "#fff", whiteSpace: "pre-wrap", wordBreak: "break-word",
                  background: "linear-gradient(135deg,#7b3ff2,#3d7bf7)",
                }}
              >
                {l.text}
              </span>
            ) : (
              <span key={i} style={{ alignSelf: "flex-start", display: "flex", alignItems: "flex-end", gap: 6, maxWidth: "88%" }}>
                <span
                  style={{
                    width: 20, height: 20, flex: "none", borderRadius: "50%", display: "grid", placeItems: "center",
                    color: "#fff", fontWeight: 800, fontSize: 9,
                    background: "linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)",
                  }}
                >
                  {initial}
                </span>
                <span
                  style={{
                    padding: "8px 13px", borderRadius: 20, borderBottomLeftRadius: 6, fontSize: 13.5,
                    background: "#efefef", color: "#111", whiteSpace: "pre-wrap", wordBreak: "break-word",
                  }}
                >
                  {l.text}
                </span>
              </span>
            ),
          )}
        </div>
        {footer && <div style={{ borderTop: "1px solid #eee", padding: "8px 10px 12px", background: "#fff" }}>{footer}</div>}
      </div>
    </div>
  )
}
