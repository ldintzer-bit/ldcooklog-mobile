// Generated release candidate runs entirely in the Scriptable app, not a widget.
const LDC_NAMESPACE = 'development';
const LDC_BUILD = '2026-10-13-visible-journal-1';
async function bounded(work, label, milliseconds = 15000) {
  let timer;
  const expired = new Promise((_, reject) => {
    timer = Timer.schedule(milliseconds, false, () => reject(Error(label + ' timed out.')));
  });
  try { return await Promise.race([Promise.resolve().then(work), expired]); }
  finally { timer.invalidate(); }
}
async function runJournal() {
const web = new WebView();
// loadHTML may issue a navigation request for its base URL. Blocking that
// request can leave its native load promise unresolved before presentation.
const baseURL = 'https://ldcooklog.invalid/';
let acceptingSignals = false, dismissed = false, draining = null, bridgeFailure = null, signals = 0, observed = 0, wakeTimer = null;
web.shouldAllowRequest = request => {
  if (request.url === 'ldcooklog-bridge://wake') {
    if (acceptingSignals && !dismissed) wake();
    return false; // Local wake signal is never loaded or sent to a server.
  }
  return request.url === baseURL || request.url === 'about:blank';
};
await bounded(() => web.loadHTML(LDC_HTML, baseURL), 'Loading the offline interface');
const capabilities = await bounded(() => web.evaluateJavaScript(`completion({bridge:typeof window.__ldcTakeNow === 'function', validator:typeof window.__ldcVerify === 'function', crypto:!!globalThis.crypto?.subtle && typeof globalThis.crypto?.randomUUID === 'function', interface:!!document.querySelector('header h1') && !!document.getElementById('new') && !!document.getElementById('status')}); 'ldcooklog-capabilities';`, true), 'Checking the offline interface');
if (!capabilities?.bridge || !capabilities?.validator) throw Error('The offline interface scripts did not initialize.');
if (!capabilities.crypto) throw Error('This WebView does not provide the required secure checksum and UUID APIs.');
if (!capabilities.interface) throw Error('The full cooking interface is missing from the document.');
async function validated(text) {
  const value = await bounded(() => web.evaluateJavaScript(`{ const done = completion; window.__ldcVerify(${JSON.stringify(text)}).then(body => done({revision:body.revision}), e => done({error:e.message})); } 'ldcooklog-verification-started';`, true), 'Validating recovery data', 30000);
  if (value.error) throw Error(value.error);
  return value;
}
async function reseal(text, revision) {
  const value = await bounded(() => web.evaluateJavaScript(`{ const done = completion; window.__ldcReseal(${JSON.stringify(text)},${JSON.stringify(revision)}).then(text => done({text}), e => done({error:e.message})); } 'ldcooklog-verification-started';`, true), 'Validating recovery data', 30000);
  if (value.error) throw Error(value.error);
  return value.text;
}
const storage = createStorage({local:FileManager.local(), cloud:FileManager.iCloud(), verify:validated, uuid:() => UUID.string(), namespace:LDC_NAMESPACE, waitForDownload:work => bounded(work, 'Downloading selected iCloud recovery copy', 30000), waitForVerification:work => bounded(work, 'Reading independent Mac verification report', 1500)});
async function take() {
  const result = await web.evaluateJavaScript('JSON.stringify(window.__ldcTakeNow());', false);
  if (typeof result !== 'string') throw Error('The interface bridge returned an unsupported value');
  return JSON.parse(result);
}
async function handle(request) {
  if (!request || !Number.isSafeInteger(request.id) || !request.body) throw Error('Invalid interface bridge request');
  const {id,body} = request;
  let result, error;
  try {
    switch(body.operation) {
      case 'read': result = await storage.read(); break;
      case 'commit': result = await storage.commit(body.text, body.expectedRevision); break;
      case 'repair': result = await storage.repair(body.text, reseal); break;
      case 'backupStatus': result = await storage.backupStatus(); break;
      case 'listSnapshots': result = await storage.listSnapshots(); break;
      case 'readSnapshot': result = await storage.readSnapshot(body.token); break;
      default: throw Error('Unsupported operation');
    }
  } catch(e) { error = e.message || 'Operation failed'; }
  if (!dismissed) await web.evaluateJavaScript(`window.__ldcDeliver(${JSON.stringify({id,result,error})}); 'ldcooklog-delivered';`, false);
}
// Finish the first journal read before presenting the native view. A damaged
// journal is displayed in the existing recovery UI and is never reset.
const initial = await bounded(take, 'Reading the startup request');
if (!initial || initial.body?.operation !== 'read') throw Error('The cooking interface did not request its journal');
await bounded(() => handle(initial), 'Opening the journal', 120000);
const initialStatus = await bounded(() => web.evaluateJavaScript(`{ const done = completion; window.__ldcStartupReady.then(text => done(text), e => done('Startup failed: ' + e.message)); } 'ldcooklog-startup-waiting';`, true), 'Validating and rendering the saved journal', 120000);
if (!/^Journal ready|^Journal could not open/.test(initialStatus)) throw Error('The cooking interface did not finish its initial read');
function wake() {
  signals++;
  scheduleDrain();
}
function scheduleDrain() {
  if (draining || dismissed || bridgeFailure || wakeTimer) return;
  // Return the navigation policy decision before calling back into WebView.
  wakeTimer = Timer.schedule(10, false, () => { wakeTimer = null; startDrain(); });
}
function startDrain() {
  if (draining || dismissed || bridgeFailure) return;
  draining = (async () => {
    while (!dismissed) {
      observed = signals;
      const request = await take();
      if (!request || dismissed) return;
      await handle(request);
    }
  })().catch(error => { if (!dismissed) bridgeFailure = error; })
    .finally(() => {
      draining = null;
      if (!dismissed && signals !== observed) scheduleDrain();
    });
}
// Present the validated journal before staging/checking retained backups.
// No callback evaluation is pending when presentation begins. A single delayed
// drain picks up the startup backup request whose wake occurred with signals off;
// subsequent work remains event-driven and serialized.
await bounded(() => web.evaluateJavaScript("window.__ldcEnableSignals(); 'ldcooklog-enabled';", false), 'Enabling interface actions');
acceptingSignals = true;
try {
  const presentation = web.present(true);
  wakeTimer = Timer.schedule(250, false, () => { wakeTimer = null; startDrain(); });
  await presentation;
}
finally {
  dismissed = true;
  acceptingSignals = false;
  if (wakeTimer) { wakeTimer.invalidate(); wakeTimer = null; }
  if (draining) await draining;
}
if (bridgeFailure) throw bridgeFailure;

}
try { await runJournal(); }
catch(error) {
  const alert = new Alert();
  alert.title = 'LDCookLog could not open';
  alert.message = LDC_BUILD + '\n' + (error.message || 'Unknown startup error') + '\nNo cooking data was reset. Please report this message.';
  alert.addAction('OK');
  await alert.presentAlert();
}
Script.complete();
