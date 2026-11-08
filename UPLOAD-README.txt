CELRA ENGINEERING UPDATE - UPLOAD GUIDE (Hinglish)

Is zip me sirf wahi files hain jo commit 7cb43a0 ke baad badli ya nayi bani. Folder structure repo jaisa hi hai.
Kuch delete karne ki zaroorat NAHI hai.

STEP 1 - Files upload karo
  Zip ko extract karo aur sab folders repo ke upar copy karo (same naam wale files replace ho jayenge):
  app/  components/  lib/  migrations/  docs/  tests/  vercel.json  package.json  tsconfig.json  .env.example
  Nayi cheezein: lib/billing, lib/webhooks, lib/matching, lib/payments, lib/security, tests/, docs/.

STEP 2 - Supabase me migrations chalao (SQL editor, isi order me)
  1) migrations/26-failed-sends.sql
  2) migrations/27-billing.sql
  3) migrations/28-outbound-webhooks.sql
  (Teeno safe hain, dobara chalane se nuksan nahi. Pehle se chali hui 10 se 25 dobara mat chalao.)

STEP 3 - Vercel me environment variables add karo (Project > Settings > Environment Variables)
  ZAROORI (security + scheduler):
    CRON_SECRET            = koi lamba random secret (openssl rand -base64 32)
    SESSION_SECRET         = pehle se hoga; agar nahi hai to set karo
  Dhyan do: production me SESSION_SECRET ke saath ab AUTH_ENFORCE apne aap ON ho jata hai.
  Agar purana Android app abhi use ho raha hai to AUTH_ENFORCE=0 daalo (temporary, insecure).
  OPTIONAL:
    WEBHOOK_RETENTION_DAYS = 30
    SCHEDULER_ENABLED      = 1   (sirf tab jab har minute wala pinger chal raha ho, docs/SCHEDULER.md dekho)
    KEYWORD_ALIASES        = 1   (Hinglish synonyms: price/rate/kitna/daam)
  BILLING (jab tak ye sab nahi bharoge, sab log free beta par rahenge, kuch nahi tootega):
    BILLING_ENABLED=1, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET,
    RAZORPAY_PLAN_ID_STARTER, RAZORPAY_PLAN_ID_PRO
    Razorpay dashboard me webhook URL: https://<aapka-domain>/api/billing/webhook (subscription.* events)
  PAYMENT LINK (default band): PAYMENT_LINKS_ENABLED=1  (pehle payout ka faisla lo, report dekho)

STEP 4 - Scheduler
  Vercel Hobby par sirf daily cron chalta hai (vercel.json me daal diya). Har minute ke liye cron-job.org par
  GET https://<domain>/api/cron/process-scheduled  with header  Authorization: Bearer <CRON_SECRET>
  Poori detail: docs/SCHEDULER.md

STEP 5 - Deploy karo, phir check karo
  - /pricing, /refund-policy, /dashboard/billing khulte hain
  - Settings page par "Webhooks and Google Sheets" card dikhta hai (Google Sheets ka script docs/SHEETS.md me hai)
  - Local par tests chalane ke liye: npm test

Note: /refund-policy ka text draft hai, live karne se pehle legal review zaroor karao.

QA UPDATE (commit b9af42e): is zip me QA ke 5 fixes bhi shamil hain (billing webhook overwrite, subscribe guard, send-health dismiss,
Meta data-deletion me naye tables, docs/SHEETS.md me formula-injection fix). Docs/SHEETS.md ka naya script dobara Apps Script me paste karo.
