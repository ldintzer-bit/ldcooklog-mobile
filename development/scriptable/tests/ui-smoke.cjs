// Executes the actual generated launcher; Scriptable APIs are simulated.
const {chromium}=require('playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {randomUUID}=require('node:crypto');
const assert=require('node:assert/strict');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
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
  const source=fs.readFileSync(path.join(__dirname,'../LDCookLog-2-Development.js'),'utf8');
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  let page,closeView,running;
  let cloudAvailable=false;
  const createCloud=cloud.createDirectory;
  cloud.createDirectory=p=>{if(!cloudAvailable)throw Error('synthetic offline');return createCloud(p)};
  async function open(damaged=false) {
    page=await context.newPage();
    page.on('dialog',d=>d.accept());
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    class WebView {
      async loadHTML(html) {
        assert.equal(html,fs.readFileSync(path.join(__dirname,'../page.html'),'utf8'));
        await page.goto(pathToFileURL(path.resolve(__dirname,'../page.html')).href);
      }
      present(){return new Promise(resolve=>{closeView=resolve})}
      evaluateJavaScript(code,callback) {
        return page.evaluate(callback ? `(() => new Promise(resolve => { window.completion = resolve; ${code} }))()` : `(() => { ${code} })()`);
      }
    }
    running=new AsyncFunction('WebView','FileManager','UUID','Script',source)(WebView,{local:()=>local,iCloud:()=>cloud},{string:randomUUID},{complete:()=>{}});
    running.catch(error=>errors.push('Host: '+error.message));
    page.on('console',message=>{if(message.type()==='error') errors.push(message.text())});
    try { await page.locator('#status').filter({hasText:damaged?'no data was reset':'Journal ready'}).waitFor(); }
    catch(error) { console.error({errors,status:await page.locator('#status').innerText()});throw error; }
    if(damaged) assert.equal(await page.locator('#new button').isDisabled(),true);
    assert.deepEqual(errors,[]);
  }
  async function close(){closeView();await running;await page.close()}
  try {
    await open();
    await context.setOffline(true);
    await page.locator('#food').fill('Synthetic Scriptable ribs');
    await page.locator('#new button').click();
    await page.locator('#count').filter({hasText:'1 of 1'}).waitFor();
    await page.locator('#history button').click();
    await page.locator('#type').selectOption('Meat On');
    await page.locator('#event button').click();
    await page.locator('#phase').filter({hasText:'Cooking'}).waitFor();
    await page.locator('#protection').filter({hasText:'2 pending'}).waitFor();
    await close();await open();
    await page.locator('#history').filter({hasText:'Synthetic Scriptable ribs'}).waitFor();
    cloudAvailable=true;await page.locator('#retry').click();
    await page.locator('#protection').filter({hasText:'2 copies staged'}).waitFor();
    assert.match(await page.locator('#protection').innerText(),/0 confirmed uploaded/);
    const journal=path.join(root,'local/LDCookLog-2-Development/journal');
    fs.writeFileSync(path.join(journal,fs.readdirSync(journal).sort().at(-1)),'broken');
    await close();await open(true);
    await page.locator('#browse').click();
    await page.locator('#snapshots button').filter({hasText:'This iPhone · revision 1'}).click();
    await page.locator('#status').filter({hasText:'Saved on this device'}).waitFor();
    assert.equal(fs.readdirSync(journal).length,3);
    console.log('PASS: generated Scriptable launcher, queued WebView bridge, local files, offline save/reopen, cloud retry/unconfirmed status, explicit damaged-journal restoration. Host APIs simulated.');
    await close();
  } finally {await browser.close();fs.rmSync(root,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
