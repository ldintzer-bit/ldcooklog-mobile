// Read-only physical-device probe; no native cooking storage or live bridge.
const BUILD = '2026-10-11-interface-check-1';
async function bounded(work, label) {
  let timer;
  const timeout = new Promise((_,reject) => {
    timer = Timer.schedule(15000,false,() => reject(Error(label + ' timed out')));
  });
  try { return await Promise.race([Promise.resolve().then(work),timeout]); }
  finally { timer.invalidate(); }
}
const intro = new Alert();
intro.title = 'LDCookLog interface check';
intro.message = 'Four screens: A, B, C and D. Look for the LDCookLog headings, then tap Close or Done and answer visible or blank. Test controls are disabled. No cooking files are accessed.';
intro.addAction('Continue');
await intro.presentAlert();
const results = [];
for (const mode of ['A','B','C','D']) {
  try {
    if (mode === 'D') {
      const table = new UITable();
      table.showSeparators = true;
      const heading = new UITableRow();
      heading.height = 90;
      heading.isHeader = true;
      heading.addText('LDCookLog native screen','Interface test D');
      table.addRow(heading);
      const description = new UITableRow();
      description.height = 100;
      description.addText('Native list is visible','Use Close or Done to report this result.');
      table.addRow(description);
      await table.present(true);
    } else {
      // Disable input controls before display. The browser-side bridge simply
      // queues an initial read; no native reader or mutation handler is attached.
      let html = LDC_HTML.replace(/<(button|input|select|textarea)\b/g,'<$1 disabled');
      if (mode === 'A') html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
      if (mode === 'C') html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/g,'');
      html = html.replace('<body>','<body><h1>Interface test ' + mode + '</h1><p>Look for the cooking journal headings below. Tap Close after viewing.</p>');
      const web = new WebView();
      const base = 'https://ldcooklog.invalid/';
      web.shouldAllowRequest = request => request.url === base || request.url === 'about:blank';
      await bounded(() => web.loadHTML(html,base),'Loading interface test ' + mode);
      // Await presentation directly; no polling, file calls or evaluated JS
      // runs concurrently with the native display operation in these cases.
      await web.present(true);
    }
    const answer = new Alert();
    answer.title = 'Interface test ' + mode;
    answer.message = mode === 'D' ? 'Did you see the native LDCookLog list?' : 'Did you see the LDCookLog journal headings?';
    answer.addAction('Visible');
    answer.addAction('Blank');
    results.push(mode + ': ' + (await answer.presentAlert() === 0 ? 'visible' : 'blank'));
  } catch(error) { results.push(mode + ': error — ' + (error.message || 'Unknown error')); }
}
const summary = new Alert();
summary.title = 'LDCookLog interface results';
summary.message = BUILD + '\n' + results.join('\n') + '\nPlease report these four results. No cooking files were accessed.';
summary.addAction('Done');
await summary.presentAlert();
Script.complete();
