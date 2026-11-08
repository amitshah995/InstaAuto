# Send leads and DM events to Google Sheets

No Google sign-in is needed inside Celra. You create a tiny Google Apps Script web app that belongs to YOU, paste its URL into
**Dashboard, Settings, Webhooks and Google Sheets, Google Sheets**, and Celra appends one row per event. Celra never sees your Google account.

## 1. Create the script
1. Open a Google Sheet. Menu: **Extensions, Apps Script**.
2. Replace the code with the snippet below.
3. In the script editor open **Project Settings, Script properties**, add a property named `CELRA_SECRET` with the signing secret Celra showed
   when you added the webhook (it starts with `whsec_`). This lets the script reject anyone who is not Celra.
4. **Deploy, New deployment, type Web app**. Execute as: **Me**. Who has access: **Anyone**. Copy the Web app URL (ends with `/exec`).
5. In Celra paste that URL into the Google Sheets preset, choose the events, then press **Send test**. A test row should appear.

## 2. The script

```javascript
// Celra -> Google Sheets. Appends one row per event. Columns are created from the first row you receive.
var COLUMNS = ['created_at', 'event', 'igsid', 'name', 'email', 'phone', 'trigger_text', 'automation_id', 'error', 'custom_fields', 'event_id'];

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out('bad json'); }

  // Verify the request really came from Celra: signature = HMAC-SHA256(secret, event_id) as hex.
  var secret = PropertiesService.getScriptProperties().getProperty('CELRA_SECRET');
  if (!secret) return out('CELRA_SECRET not set');
  var sig = Utilities.computeHmacSha256Signature(String(body.event_id), secret)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  if (sig !== body.signature) return out('invalid signature');

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(COLUMNS);

  // Skip duplicates: Celra retries failed deliveries with the same event_id.
  var ids = sheet.getRange(2, COLUMNS.length, Math.max(sheet.getLastRow() - 1, 1), 1).getValues().flat();
  if (ids.indexOf(body.event_id) !== -1) return out('duplicate');

  sheet.appendRow(COLUMNS.map(function (c) { return body[c] === undefined ? '' : body[c]; }));
  return out('ok');
}

function out(msg) { return ContentService.createTextOutput(msg); }
```

## Notes
- Google answers an Apps Script POST with a redirect after the script has run. Celra treats that as success for `script.google.com` URLs only.
- Events: `lead_captured` (a lead flow finished: name, email, phone), `dm_sent`, `dm_failed`, `comment_matched`.
  The payload contains the Instagram-scoped id and the person's comment or answers. It is your own data, sent only to the URL you choose; mention it in your privacy notice.
- Failed deliveries are retried after 1 minute, 5 minutes, 30 minutes, 2 hours and 12 hours (needs the scheduler, see docs/SCHEDULER.md).
- If you re-deploy the script, Google may give a new URL: paste the new one in Celra.

## For developers: generic webhooks
Body is JSON `{ id, event, created_at, data }`. Headers: `X-Celra-Event`, `X-Celra-Delivery` (same as `id`, use it to de-duplicate),
`X-Celra-Signature: t=<unix seconds>,v1=<hex>` where `v1 = HMAC_SHA256(secret, "<t>." + rawBody)`. Reject requests whose `t` is more than 5 minutes old.
