// Executes the generated Scriptable rehearsal against the actual shared WebView
// validator in Chromium. FileManager APIs are mocked; all data is synthetic.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {randomUUID}=require('node:crypto');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ldc-retention-browser-'));
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();const accesses=[];
  function manager(folder){
   fs.mkdirSync(folder,{recursive:true});
   function checked(p){assert.ok(p.startsWith(path.join(folder,'LDCookLog-2-Synthetic-Rehearsals')+path.sep),'Outside rehearsal roots: '+p);accesses.push(p);return p}
   return {documentsDirectory:()=>folder,joinPath:path.join,createDirectory:p=>fs.mkdirSync(checked(p),{recursive:true}),fileExists:p=>fs.existsSync(checked(p)),readString:p=>fs.readFileSync(checked(p),'utf8'),writeString:(p,s)=>fs.writeFileSync(checked(p),s),listContents:p=>fs.readdirSync(checked(p)),isDirectory:p=>fs.statSync(checked(p)).isDirectory(),isFileDownloaded:p=>fs.existsSync(checked(p)),downloadFileFromiCloud:async()=>{},remove:p=>fs.rmSync(checked(p),{recursive:true})};
  }
  const local=manager(path.join(root,'local')),cloud=manager(path.join(root,'cloud'));
  class WebView{
   async loadHTML(html,base){assert.equal(this.shouldAllowRequest({url:base}),true);assert.equal(this.shouldAllowRequest({url:'https://untrusted.invalid/'}),false);assert.equal(html,fs.readFileSync(path.join(__dirname,'../retention-check.html'),'utf8'));await page.goto(pathToFileURL(path.resolve(__dirname,'../retention-check.html')).href)}
   evaluateJavaScript(code,callback){assert.equal(callback,true);return page.evaluate(`(() => new Promise(resolve => {window.completion=resolve;${code}}))()`)}
  }
  let message,title;
  class Alert{addAction(){}async presentAlert(){message=this.message;title=this.title;return 0}}
  const Timer={schedule:(ms,repeats,callback)=>{assert.equal(repeats,false);const timer=setTimeout(callback,ms);return {invalidate:()=>clearTimeout(timer)}}};
  const source=fs.readFileSync(path.join(__dirname,'../LDCookLog-2-Retention-Rehearsal.js'),'utf8');
  await new AsyncFunction('WebView','FileManager','UUID','Timer','Alert','Script',source)(WebView,{local:()=>local,iCloud:()=>cloud},{string:randomUUID},Timer,Alert,{complete:()=>{}});
  assert.equal(title,'LDCookLog synthetic retention rehearsal');assert.match(message,/IPHONE RETENTION PASS: 26 synthetic saves; 21 snapshots retained/);assert.match(message,/FRESH-JOURNAL RECOVERY PASS/);assert.match(message,/receipt was simulated/);assert.match(message,/folders removed/);
  assert.ok(accesses.length>100);assert.deepEqual(fs.readdirSync(path.join(root,'local/LDCookLog-2-Synthetic-Rehearsals')),[]);assert.deepEqual(fs.readdirSync(path.join(root,'cloud/LDCookLog-2-Synthetic-Rehearsals')),[]);
  console.log('PASS: generated Scriptable rehearsal, proof-gated pruning, exact recovery/reopen and isolated temporary roots; Mac receipt simulated.');
 }finally{await browser.close();fs.rmSync(root,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exit(1)});
