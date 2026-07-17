/**
 * Invoice email — attach the client-rendered sheet PNG (Jac, 2026-07-17)
 * ─────────────────────────────────────────────────────────────────────────
 * ADDITIVE. Client change already shipped (app.js): emailQuoteSend renders the
 * invoice sheet to a PNG (invoiceSheetPng → renderInvoicePng) and passes it as
 *   body.attachment = { name, mimeType: 'image/png', dataB64 }
 * to sendCustomerMessage. This patch makes the backend attach it to the email.
 *
 * WHERE: sendCustomerMessage_() in Code.js (the live copy of customer-sms-backend.gs),
 * the `channel === 'email'` branch — right BEFORE `GmailApp.sendEmail(to, subject, text, mailOpts)`.
 *
 * SAFETY (all preserved / added):
 *  - Recipient is still server-resolved from the invoice's own customer (the isolation
 *    gate above, ~line 118-120). The attachment can ONLY reach that customer — the client
 *    never picks the recipient. So a client-supplied image is no broader than the invoice
 *    the sender already has access to.
 *  - Gated to entity === 'invoice' (an image attachment only makes sense there).
 *  - MIME whitelist (png/jpeg only) + a ~3MB size cap (base64 length) to bound abuse.
 *  - A bad/oversized blob is dropped silently → the email still sends WITHOUT the
 *    attachment. Attaching NEVER fails the send.
 *
 * Nothing else changes: consent (opted-out hard block), quiet-hours, the shared daily
 * cap, and the dedup ledger all still run before this point, unchanged.
 *
 * ── DROP-IN: replace the two lines that build mailOpts + call sendEmail ──
 * BEFORE:
 *     var mailOpts = { name: company };
 *     if (fromUsed && aliases[0] && fromUsed.toLowerCase() !== String(aliases[0]).toLowerCase()) mailOpts.from = fromUsed;
 *     GmailApp.sendEmail(to, subject, text, mailOpts);
 * AFTER:
 */
var mailOpts = { name: company };
if (fromUsed && aliases[0] && fromUsed.toLowerCase() !== String(aliases[0]).toLowerCase()) mailOpts.from = fromUsed;
// Optional client-rendered invoice image → email attachment. Recipient is already
// server-resolved to THIS invoice's own customer (isolation gate above), so the image
// can only reach that customer. Whitelist image types + cap the size; a bad blob is
// dropped, never fatal to the send.
var att = body.attachment;
if (att && entity === 'invoice' && att.dataB64 &&
    (att.mimeType === 'image/png' || att.mimeType === 'image/jpeg') &&
    String(att.dataB64).length < 4000000) {
  try {
    var attName = String(att.name || 'invoice.png').replace(/[^\w.\-]/g, '').slice(0, 80) || 'invoice.png';
    var attBlob = Utilities.newBlob(Utilities.base64Decode(att.dataB64), att.mimeType, attName);
    mailOpts.attachments = [attBlob];
  } catch (e) { /* bad blob → send without the attachment */ }
}
GmailApp.sendEmail(to, subject, text, mailOpts);
