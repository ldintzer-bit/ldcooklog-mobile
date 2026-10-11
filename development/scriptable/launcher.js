// Generated release candidate runs entirely in the Scriptable app, not a widget.
const web = new WebView();
web.shouldAllowRequest = () => false;
await web.loadHTML(LDC_HTML, 'https://ldcooklog.invalid/');
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
  while (!dismissed) {
    const request = await web.evaluateJavaScript('window.__ldcTake(completion);', true);
    if (dismissed) return;
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
  }
}
// Dismissal ends the script; no timer or indefinite background job is promised.
await Promise.race([presentation, pump().catch(error => { if (!dismissed) throw error; })]);
Script.complete();
