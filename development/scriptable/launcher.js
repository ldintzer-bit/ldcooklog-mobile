// Generated release candidate runs entirely in the Scriptable app, not a widget.
const LDC_BUILD = '2026-10-11-startup-1';
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
web.shouldAllowRequest = request => request.url === baseURL || request.url === 'about:blank';
await bounded(() => web.loadHTML(LDC_HTML, baseURL), 'Loading the offline interface');
web.shouldAllowRequest = () => false;
const capabilities = await bounded(() => web.evaluateJavaScript(`completion({bridge:typeof window.__ldcTake === 'function', validator:typeof window.__ldcVerify === 'function', crypto:!!globalThis.crypto?.subtle && typeof globalThis.crypto?.randomUUID === 'function'});`, true), 'Checking the offline interface');
if (!capabilities?.bridge || !capabilities?.validator) throw Error('The offline interface scripts did not initialize.');
if (!capabilities.crypto) throw Error('This WebView does not provide the required secure checksum and UUID APIs.');
async function validated(text) {
  const value = await web.evaluateJavaScript(`window.__ldcVerify(${JSON.stringify(text)}).then(body => completion({revision:body.revision}), e => completion({error:e.message}));`, true);
  if (value.error) throw Error(value.error);
  return value;
}
async function reseal(text, revision) {
  const value = await web.evaluateJavaScript(`window.__ldcReseal(${JSON.stringify(text)},${JSON.stringify(revision)}).then(text => completion({text}), e => completion({error:e.message}));`, true);
  if (value.error) throw Error(value.error);
  return value.text;
}
const storage = createStorage({local:FileManager.local(), cloud:FileManager.iCloud(), verify:validated, uuid:() => UUID.string()});
let dismissed = false;
const presentation = web.present(true).then(() => { dismissed = true; });
async function pump() {
  let starting = true;
  while (!dismissed) {
    const take = () => web.evaluateJavaScript('window.__ldcTake(completion);', true);
    const request = await (starting ? bounded(take, 'Opening the journal') : take());
    if (dismissed) return;
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
    if (!dismissed) await web.evaluateJavaScript(`window.__ldcDeliver(${JSON.stringify({id,result,error})});`, false);
    starting = false;
  }
}
// Dismissal ends the script; no timer or indefinite background job is promised.
await Promise.race([presentation, pump().catch(error => { if (!dismissed) throw error; })]);
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
