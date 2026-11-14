/**
 * CSV cell escaping for the contacts export. Pure.
 * Who calls this: app/api/contacts/export/route.ts.
 * Why the formula guard: names and custom fields come from Instagram users, and a cell that starts with = + - @ is run as a
 * formula by Excel / Sheets when the owner opens the file. Such cells get a leading apostrophe. Plain numbers and phone numbers
 * (+919876501234, -5) are left alone so the export stays usable.
 */
export function csvEscape(value: unknown): string {
  let str = value === null || value === undefined ? "" : String(value)
  if (/^[=+\-@\t\r]/.test(str) && !/^[+-]?[\d][\d\s().-]*$/.test(str)) str = `'${str}`
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}
