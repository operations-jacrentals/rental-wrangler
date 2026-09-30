// rail-guard.mjs — the CI source guard for rail.json, the router's kill switch (rw-api CONTRACT §3.5, RC-92 S3-A, S3-4 A).
//
// rail.json at the site root may be EXACTLY one of two files:
//   {"on":false}                              routing off (every call to Apps Script)
//   {"on":true,"url":"<RAIL_URL>"}            routing allowed, for the host this build was built with
// where <RAIL_URL> is app.js's `const RAIL_URL = '…';` literal, byte for byte (so the on form can only be published for a
// build that names that host; a build whose RAIL_URL is '' has no on form at all). One final newline (LF or CRLF) is
// tolerated, as before; anything else — another key order, whitespace, a BOM, a trailing slash, another host, a missing
// file — fails CI instead of silently reading as OFF (or, worse, as another host's on) on devices.
//
// Pure: no I/O. ci/logic-test.mjs reads the files and tests these functions; ci/rail-mutants.mjs mutates them.

/** The RAIL_URL literal declared in app.js's source, or null when there is no single-quoted declaration. */
export function railUrlFromSource(src) {
  const m = String(src || '').match(/\nconst RAIL_URL = '([^'\n\\]*)';/);
  return m ? m[1] : null;
}

/** The exact files rail.json may be, for a build whose RAIL_URL is `railUrl`. */
export function railFileForms(railUrl) {
  const forms = ['{"on":false}'];
  if (typeof railUrl === 'string' && railUrl !== '') forms.push('{"on":true,"url":' + JSON.stringify(railUrl) + '}');
  return forms;
}

/** true when `text` (rail.json's bytes as a string) is one of railFileForms(railUrl), plus at most one final newline. */
export function railFileOk(text, railUrl) {
  if (typeof text !== 'string') return false;
  const body = text.endsWith('\r\n') ? text.slice(0, -2) : text.endsWith('\n') ? text.slice(0, -1) : text;
  return railFileForms(railUrl).includes(body);
}
