// Same Instagram Login URL the rest of the app uses. NEXT_PUBLIC_* values are inlined at build time.
export const instagramAuthUrl = `https://api.instagram.com/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID}&redirect_uri=${process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI}&response_type=code&scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments#weblink`

/** localStorage flag: after Instagram login, the session hook sends the user back to run the audit. */
export const PENDING_AUDIT_FLAG = "pending_audit_run"
