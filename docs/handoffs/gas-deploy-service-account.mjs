#!/usr/bin/env node
/**
 * gas-deploy-service-account.mjs — deploy Code.js to Apps Script via a SERVICE ACCOUNT,
 * bypassing clasp's user-OAuth login entirely (spec: docs/handoffs/BACKEND-DEPLOY-QUEUE.md,
 * Jac 2026-07-06 — clasp's refresh-token flow hits Google's RAPT re-auth policy on the
 * cloud-platform scope for this Workspace; service-account JWT auth isn't subject to it).
 *
 * SETUP (one-time, needs Jac's Google Cloud Console access — see BACKEND-DEPLOY-QUEUE.md):
 *   1. GCP project with the Apps Script API enabled.
 *   2. A service account + JSON key in that project.
 *   3. The Apps Script project's GCP link pointed at that project (editor → Project Settings).
 *   4. The Apps Script file shared with the service account's email as Editor.
 *   5. The key, base64'd, in the GAS_SA_KEY_B64 env secret.
 *
 * USAGE:
 *   GAS_SA_KEY_B64=... node gas-deploy-service-account.mjs push   # push local Code.js + manifest to HEAD (SAFE — content only)
 *   ...then DEPLOY FROM THE APPS SCRIPT EDITOR (New version, Who has access: Anyone).
 *
 * ⛔ The `deploy` subcommand is GUARDED and should NOT be used for this web app: a REST-API
 * deploy breaks the deployment's anonymous access (the /exec URL 403s for anonymous callers
 * → the live backend goes DOWN), and an API rollback does not fix it. Only an editor redeploy
 * restores anonymous access. Confirmed live 2026-07-06. See the note above deploy().
 *
 * DOMAIN-WIDE DELEGATION (required for the Apps Script REST API): a plain service
 * account can't call script.googleapis.com — the API's per-USER enablement toggle
 * (script.google.com/home/usersettings) can't be set for a service-account identity,
 * so every call 403s with "User has not enabled the Apps Script API" even when the
 * API is enabled at the GCP-project level. The fix is for the SA to impersonate a real
 * Workspace user who HAS that toggle on (and edits the script). Set GAS_IMPERSONATE_SUBJECT
 * to that user (e.g. operations@jacrentals.com), and authorize the SA's client_id for
 * the SCOPES below in Admin Console → Security → API Controls → Domain-wide Delegation.
 *
 * Requires the `googleapis` npm package (installed ephemerally: `npm i --no-save googleapis`).
 * Never logs the key or any token.
 */
import { google } from 'googleapis';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SCRIPT_ID = '1hw9A7Id3YIoiSCBkNFeDaKGRv-VtljFFIuBdQG5QULrgS0DjQhQ_2vyZ';
const DEPLOYMENT_ID = 'AKfycbzHahzgJqOYe9o4GKlRVGh-A7USRn1k4Dvyy4ajLh8EYCqVxofouM28qs8trNlObZw';
const SCOPES = [
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.deployments',
  'https://www.googleapis.com/auth/script.webapp.deploy',
  'https://www.googleapis.com/auth/drive.file',
];

function auth() {
  const b64 = process.env.GAS_SA_KEY_B64;
  if (!b64) throw new Error('GAS_SA_KEY_B64 is not set — see docs/handoffs/BACKEND-DEPLOY-QUEUE.md setup steps.');
  const key = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  const opts = { credentials: key, scopes: SCOPES };
  // Domain-wide delegation: impersonate a real Workspace user (the Apps Script API can't
  // be enabled for a bare service-account identity — see the header note). Without a
  // subject the API 403s "User has not enabled the Apps Script API".
  const subject = process.env.GAS_IMPERSONATE_SUBJECT;
  if (subject) opts.clientOptions = { subject };
  return new google.auth.GoogleAuth(opts);
}

async function scriptClient() {
  const authClient = await auth().getClient();
  return google.script({ version: 'v1', auth: authClient });
}

// Local project layout mirrors clasp's: a flat dir of .gs/.js files + appsscript.json.
// This repo doesn't check the backend in (gitignored); point RW_BACKEND_DIR at wherever
// Code.js + appsscript.json + the spliced-in .gs additions live (default ~/rw-backend).
function loadLocalFiles(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.js') || f.endsWith('.gs') || f === 'appsscript.json');
  return files.map((f) => {
    const raw = readFileSync(join(dir, f), 'utf8');
    if (f === 'appsscript.json') return { name: 'appsscript', type: 'JSON', source: raw };
    return { name: f.replace(/\.(gs|js)$/, ''), type: 'SERVER_JS', source: raw };
  });
}

async function push(dir) {
  const script = await scriptClient();
  const files = loadLocalFiles(dir || (process.env.RW_BACKEND_DIR || `${process.env.HOME}/rw-backend`));
  await script.projects.updateContent({ scriptId: SCRIPT_ID, requestBody: { files } });
  console.log(`Pushed ${files.length} file(s) to script ${SCRIPT_ID}.`);
}

async function deploy(description) {
  // ⛔ DANGER (confirmed live 2026-07-06): updating this web-app deployment via the Apps
  // Script REST API BREAKS its anonymous access. The entryPoint still REPORTS
  // ANYONE_ANONYMOUS, but the /exec URL then 403s ("Access Denied — you need access") for
  // anonymous callers — i.e. the whole app's backend goes DOWN, because the API can't
  // (re)establish the anonymous web-app grant regardless of the manifest's webapp.access.
  // Rolling the version back via the API does NOT fix it either. The ONLY working fix is a
  // redeploy through the Apps Script EDITOR (Deploy → Manage deployments → Edit → New
  // version → Who has access: Anyone). So: `push` HEAD via this tool (safe — content only),
  // then DEPLOY FROM THE EDITOR. This `deploy` command is kept for reference but is guarded.
  if (process.env.GAS_DEPLOY_FORCE_ANON_BREAK_ACK !== 'yes-break-anonymous-access') {
    console.error(
      'REFUSING to deploy: the REST-API deploy breaks this web app\'s anonymous access and\n' +
      'takes the live backend DOWN (see the note above this function). Push HEAD with\n' +
      '`push`, then deploy from the Apps Script editor (New version, Who has access: Anyone).\n' +
      'If you truly know what you are doing, re-run with\n' +
      '  GAS_DEPLOY_FORCE_ANON_BREAK_ACK=yes-break-anonymous-access');
    process.exit(2);
  }
  const script = await scriptClient();
  const ver = await script.projects.versions.create({ scriptId: SCRIPT_ID, requestBody: { description: description || 'deploy' } });
  const versionNumber = ver.data.versionNumber;
  await script.projects.deployments.update({
    scriptId: SCRIPT_ID,
    deploymentId: DEPLOYMENT_ID,
    requestBody: { deploymentConfig: { versionNumber, description: description || 'deploy', manifestFileName: 'appsscript' } },
  });
  console.log(`Deployed version ${versionNumber} to deployment ${DEPLOYMENT_ID} (same exec URL).`);
}

const [, , cmd, arg] = process.argv;
if (cmd === 'push') await push(arg);
else if (cmd === 'deploy') await deploy(arg);
else { console.error('Usage: node gas-deploy-service-account.mjs push|deploy [arg]'); process.exit(1); }
