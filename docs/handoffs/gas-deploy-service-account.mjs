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
 *   GAS_SA_KEY_B64=... node gas-deploy-service-account.mjs push   # push local Code.js + manifest
 *   GAS_SA_KEY_B64=... node gas-deploy-service-account.mjs deploy "description"  # new version + update the live deployment
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
  return new google.auth.GoogleAuth({ credentials: key, scopes: SCOPES });
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
