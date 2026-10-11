// Development diagnostic only. No file access, cooking data or network fetches.
const BUILD = '2026-10-11-display-check-1';
async function bounded(work, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = Timer.schedule(15000, false, () => reject(Error(label + ' timed out')));
  });
  try { return await Promise.race([Promise.resolve().then(work), timeout]); }
  finally { timer.invalidate(); }
}
async function explain(message) {
  const alert = new Alert();
  alert.title = 'LDCookLog display check';
  alert.message = message;
  alert.addAction('Continue');
  await alert.presentAlert();
}
await explain('This checks three test pages, A, B and C. Each should show large text on a green background. After looking, tap Close and answer whether you saw the text. Your cooking files are not opened or changed.');
const results = [];
for (const mode of ['A', 'B', 'C']) {
  const web = new WebView();
  const base = 'https://ldcooklog.invalid/';
  const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#173d2a;color:white;font:24px system-ui;padding:30px"><h1 id="test">LDCookLog test ' + mode + '</h1><p>If you can read this green test page, tap Close and choose “I saw the test text”.</p></body></html>';
  let detail = '';
  try {
    if (mode !== 'A') web.shouldAllowRequest = request => request.url === base || request.url === 'about:blank';
    await bounded(() => mode === 'A' ? web.loadHTML(html) : web.loadHTML(html, base), 'Loading test ' + mode);
    if (mode === 'B') web.shouldAllowRequest = () => false;
    if (mode !== 'A') {
      const inspected = await bounded(() => web.evaluateJavaScript(`completion({heading:document.getElementById('test')?.textContent || 'missing', bodyHeight:document.body?.getBoundingClientRect().height || 0});`, true), 'Inspecting test ' + mode);
      if (!inspected || inspected.heading !== 'LDCookLog test ' + mode) throw Error('Test text missing before presentation');
      detail = '; DOM height ' + inspected.bodyHeight;
    }
    await web.present(true);
    const answer = new Alert();
    answer.title = 'Test ' + mode + ': what did you see?';
    answer.message = 'Was the green page with “LDCookLog test ' + mode + '” visible?';
    answer.addAction('I saw the test text');
    answer.addAction('The page was blank');
    const choice = await answer.presentAlert();
    results.push(mode + ': ' + (choice === 0 ? 'visible' : 'blank') + detail);
  } catch(error) {
    results.push(mode + ': error — ' + (error.message || 'Unknown error'));
  }
}
const summary = new Alert();
summary.title = 'LDCookLog display results';
summary.message = BUILD + '\n' + results.join('\n') + '\nPlease report these three results. This test did not access cooking files.';
summary.addAction('Done');
await summary.presentAlert();
Script.complete();
