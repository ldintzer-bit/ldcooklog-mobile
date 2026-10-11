// Executes the actual generated launcher; Scriptable APIs are simulated.
const {chromium}=require('playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {randomUUID}=require('node:crypto');
const assert=require('node:assert/strict');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
let stage='initialization';
const watchdog=setTimeout(()=>{console.error('FAIL: Scriptable browser integration timed out at '+stage);process.exit(1)},120000);
watchdog.unref();
function progress(value){stage=value;console.log('CHECK: '+stage)}
function manager(root) {
  fs.mkdirSync(root,{recursive:true});
  return {documentsDirectory:()=>root,joinPath:path.join,
    createDirectory:p=>fs.mkdirSync(p,{recursive:true}),fileExists:fs.existsSync,
    readString:p=>fs.readFileSync(p,'utf8'),writeString:(p,s)=>fs.writeFileSync(p,s),
    listContents:fs.readdirSync,isDirectory:p=>fs.statSync(p).isDirectory(),
    isFileDownloaded:fs.existsSync,downloadFileFromiCloud:async()=>{}};
}
(async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'ldcooklog-ui-synthetic-'));
  const local=manager(path.join(root,'local')),cloud=manager(path.join(root,'cloud'));
  const sources={working:fs.readFileSync(path.join(__dirname,'../LDCookLog-2-Development.js'),'utf8'),trial:fs.readFileSync(path.join(__dirname,'../LDCookLog-2-Restore-Check.js'),'utf8')};
  progress('launch browser');
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  let page,closeView,running;
  let cloudAvailable=false;
  const createCloud=cloud.createDirectory;
  cloud.createDirectory=p=>{if(!cloudAvailable)throw Error('synthetic offline');return createCloud(p)};
  async function open(damaged=false,trial=false) {
    progress('open '+(trial?'restore trial':'working journal')+(damaged?' damaged':''));
    const document=trial?'restore-check.html':'page.html',source=trial?sources.trial:sources.working;
    closeView=null;
    let announcePresentation;
    const presentationReady=new Promise(resolve=>{announcePresentation=resolve});
    page=await context.newPage();
    page.on('dialog',d=>{d.dismiss();throw Error('Scriptable restoration must use an in-page confirmation')});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    class WebView {
      async loadHTML(html,baseURL) {
        assert.equal(this.shouldAllowRequest({url:baseURL}),true,'Initial offline navigation must be allowed');
        assert.equal(this.shouldAllowRequest({url:'https://untrusted.invalid/'}),false);
        assert.equal(html,fs.readFileSync(path.join(__dirname,'../'+document),'utf8'));
        await page.exposeFunction('__testWake', () => this.shouldAllowRequest({url:'ldcooklog-bridge://wake'}));
        await page.goto(pathToFileURL(path.resolve(__dirname,'../'+document)).href);
        await page.evaluate(() => {
          // Native request interception is simulated; no custom-scheme network
          // navigation is attempted by Chromium in this integration test.
          window.__ldcWake = () => { window.__testWake(); };
        });
      }
      present(){assert.equal(this.shouldAllowRequest({url:'https://ldcooklog.invalid/'}),true);return new Promise(resolve=>{closeView=resolve;announcePresentation()})}
      evaluateJavaScript(code,callback) {
        return page.evaluate(callback ? `(() => new Promise(resolve => { window.completion = resolve; ${code} }))()` : code);
      }
    }
    const Timer={schedule:(ms,repeats,callback)=>{assert.equal(repeats,false);const timer=setTimeout(callback,ms);return {invalidate:()=>clearTimeout(timer)}}};
    class Alert { addAction(){} async presentAlert(){if(this.title!=='LDCookLog development check')throw Error(this.message);assert.match(this.message,/restore-confirm-1/);return 0} }
    running=new AsyncFunction('WebView','FileManager','UUID','Script','Timer','Alert',source)(WebView,{local:()=>local,iCloud:()=>cloud},{string:randomUUID},{complete:()=>{}},Timer,Alert);
    running.catch(error=>errors.push('Host: '+error.message));
    page.on('console',message=>{if(message.type()==='error') errors.push(message.text())});
    try { await page.locator('#status').filter({hasText:damaged?'no data was reset':'Journal ready'}).waitFor(); }
    catch(error) { console.error({errors,status:await page.locator('#status').innerText()});throw error; }
    await presentationReady;
    if(damaged) assert.equal(await page.locator('#new button').isDisabled(),true);
    assert.deepEqual(errors,[]);
  }
  async function close(){assert.equal(typeof closeView,'function','Wait for native presentation before dismissal');closeView();await running;await page.close()}
  try {
    await open();
    await context.setOffline(true);
    await page.locator('#food').fill('Synthetic Scriptable ribs');
    progress('save initial cook');
    await page.locator('#new button').click();
    await page.locator('#count').filter({hasText:'1 of 1'}).waitFor();
    await page.locator('#history button').click();
    await page.locator('#type').selectOption('Meat On');
    progress('save Meat On');
    await page.locator('#event button').click();
    await page.locator('#phase').filter({hasText:'Cooking'}).waitFor();
    await page.locator('#protection').filter({hasText:'2 pending'}).waitFor();
    await close();await open();
    await page.locator('#history').filter({hasText:'Synthetic Scriptable ribs'}).waitFor();
    progress('stage original cloud copies');
    cloudAvailable=true;await page.locator('#retry').click();
    await page.locator('#protection').filter({hasText:'2 copies staged'}).waitFor();
    assert.match(await page.locator('#protection').innerText(),/0 confirmed uploaded/);
    // Restore into a physically separate local folder, using only staged
    // cloud source copies. Preserve the working journal and all source bytes.
    const originalJournal=path.join(root,'local/LDCookLog-2-Development/journal');
    const originalBytes=fs.readdirSync(originalJournal).sort().map(n=>fs.readFileSync(path.join(originalJournal,n),'utf8'));
    await close();await open(false,true);
    await page.locator('#count').filter({hasText:'0 of 0'}).waitFor();
    await page.locator('#browse').click();
    await page.locator('#snapshots button').filter({hasText:'iCloud copy (upload unconfirmed) · revision 2'}).click();
    await page.locator('#ldc-confirm-yes').waitFor();
    progress('cancel isolated restore');
    await page.locator('#ldc-confirm-no').click();
    await page.locator('#status').filter({hasText:'Cancelled'}).waitFor();
    assert.equal(fs.readdirSync(path.join(root,'local/LDCookLog-2-Restore-Check/journal')).length,0);
    await page.locator('#snapshots button').filter({hasText:'iCloud copy (upload unconfirmed) · revision 2'}).click();
    progress('accept restore');
    await page.locator('#ldc-confirm-yes').click();
    await page.locator('#status').filter({hasText:'Saved on this device'}).waitFor();
    await page.locator('#history button').click();
    await page.locator('#phase').filter({hasText:'Cooking'}).waitFor();
    await page.locator('#timeline').filter({hasText:'Meat On'}).waitFor();
    assert.deepEqual(fs.readdirSync(originalJournal).sort().map(n=>fs.readFileSync(path.join(originalJournal,n),'utf8')),originalBytes);
    await close();await open(false,true);
    await page.locator('#history').filter({hasText:'Synthetic Scriptable ribs'}).waitFor();
    await close();await open();
    await page.locator('#history').filter({hasText:'Synthetic Scriptable ribs'}).waitFor();
    const journal=path.join(root,'local/LDCookLog-2-Development/journal');
    fs.writeFileSync(path.join(journal,fs.readdirSync(journal).sort().at(-1)),'broken');
    await close();await open(true);
    await page.locator('#browse').click();
    await page.locator('#snapshots button').filter({hasText:'This iPhone · revision 1'}).click();
    progress('accept restore');
    await page.locator('#ldc-confirm-yes').click();
    await page.locator('#status').filter({hasText:'Saved on this device'}).waitFor();
    assert.equal(fs.readdirSync(journal).length,3);
    console.log('PASS: generated Scriptable launcher, event-driven WebView bridge, local files, offline save/reopen, cloud retry/unconfirmed status, isolated fresh-journal cloud restoration/reopen with original bytes preserved, explicit damaged-journal restoration. Host APIs simulated.');
    await close();
  } finally {clearTimeout(watchdog);await browser.close();fs.rmSync(root,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
