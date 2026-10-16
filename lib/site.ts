/**
 * The public base URL of this deployment, without a trailing slash.
 * Before the real domain is live, Vercel's production URL is used automatically.
 * When the domain is ready, set NEXT_PUBLIC_SITE_URL=https://yourdomain.com in Vercel and redeploy.
 */
export const FALLBACK_SITE_URL = "https://insta-auto-flax.vercel.app"

export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, "")
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`
  return FALLBACK_SITE_URL
}

export function getSiteHost(): string {
  try {
    return new URL(getSiteUrl()).hostname.toLowerCase()
  } catch {
    return "localhost"
  }
}
