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
  return {remove:p=>fs.unlinkSync(p),documentsDirectory:()=>root,joinPath:path.join,
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
    let announcePresentation, presented=false;
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
          // Force asynchronous startup checksum work to outlive read delivery.
          // The prior status check raced this delay and refused presentation.
          const digest=crypto.subtle.digest.bind(crypto.subtle);
          crypto.subtle.digest=async (...args)=>{await new Promise(resolve=>setTimeout(resolve,100));return digest(...args)};
        });
      }
      present(){presented=true;assert.equal(this.shouldAllowRequest({url:'https://ldcooklog.invalid/'}),true);return new Promise(resolve=>{closeView=resolve;announcePresentation()})}
      evaluateJavaScript(code,callback) {
        if(code.includes('window.__ldcDeliver') && code.includes('\"pending\"')) assert.equal(presented,true,'Backup results arrive after presentation');
        return page.evaluate(callback ? `(() => new Promise(resolve => { window.completion = resolve; ${code} }))()` : code);
      }
    }
    const Timer={schedule:(ms,repeats,callback)=>{assert.equal(repeats,false);const timer=setTimeout(callback,ms);return {invalidate:()=>clearTimeout(timer)}}};
    class Alert { addAction(){} async presentAlert(){if(this.title!=='LDCookLog development check')throw Error(this.message);assert.match(this.message,/visible-journal-1/);return 0} }
    running=new AsyncFunction('WebView','FileManager','UUID','Script','Timer','Alert',source)(WebView,{local:()=>local,iCloud:()=>cloud},{string:randomUUID},{complete:()=>{}},Timer,Alert);
    running.catch(error=>errors.push('Host: '+error.message));
    page.on('console',message=>{if(message.type()==='error') errors.push(message.text())});
    try { await page.locator('#status').filter({hasText:damaged?'no data was reset':'Journal ready'}).waitFor(); }
    catch(error) { console.error({errors,status:await page.locator('#status').innerText()});throw error; }
    await presentationReady;
    if(damaged) assert.equal(await page.locator('#new button').isDisabled(),true);
    assert.deepEqual(errors,[]);
  }
  async function expand(id){if(!await page.locator('#'+id).evaluate(e=>e.open))await page.locator('#'+id+' > summary').click();}
  async function showHistory(){await page.locator('#navHistory').click();}
  async function showBackups(){await page.locator('#navBackups').click();await expand('backupDetails');await expand('recoveryTools');}
  async function close(){assert.equal(typeof closeView,'function','Wait for native presentation before dismissal');closeView();await running;await page.close()}
  try {
    await open();
    await context.setOffline(true);
    await page.locator('#food').fill('Synthetic Scriptable ribs');
    progress('save initial cook');
    await page.locator('#new button').click();
    await page.locator('#title').filter({hasText:'Synthetic Scriptable ribs'}).waitFor();
    assert.equal(await page.locator('#cookView').isVisible(),true);
    await page.locator('#count').filter({hasText:'1 of 1'}).waitFor({state:'attached'});
    await showHistory();await page.locator('#history button').click();await expand('setupPanel');
    await expand('fireboardPanel');await page.locator('#fbModel').selectOption('FireBoard 2');await expand('fbChannel1');
    await page.locator('#fbRole1').selectOption('Pit / ambient');await page.locator('#fbProbe1').selectOption('Wired');await page.locator('#fbPlacement1').fill('Synthetic grate');
    await page.locator('#type').selectOption('Meat On');
    progress('save Meat On');
    await page.locator('#event button').click();
    await page.locator('#phase').filter({hasText:'Cooking'}).waitFor();
    await page.locator('#protection').filter({hasText:'2 pending'}).waitFor({state:'attached'});
    assert.equal(await page.locator('#fbPlacement1').inputValue(),'Synthetic grate','Event save preserves an unsaved setup');
    await close();await open();
    await page.locator('#title').filter({hasText:'Synthetic Scriptable ribs'}).waitFor();
    assert.equal(await page.locator('#cookView').isVisible(),true,'Resume unfinished real cook on reopening');
    assert.match(await page.locator('#timers').innerText(),/Total elapsed.*Cooking/);
    await showHistory();await page.locator('#history').filter({hasText:'Synthetic Scriptable ribs'}).waitFor();
    progress('stage original cloud copies');
    cloudAvailable=true;await showBackups();await page.locator('#retry').click();
    await page.locator('#protection').filter({hasText:'2 copies staged'}).waitFor({state:'attached'});
    assert.match(await page.locator('#protection').innerText(),/0 confirmed uploaded/);
    // Restore into a physically separate local folder, using only staged
    // cloud source copies. Preserve the working journal and all source bytes.
    const originalJournal=path.join(root,'local/LDCookLog-2-Development/journal');
    const originalBytes=fs.readdirSync(originalJournal).sort().map(n=>fs.readFileSync(path.join(originalJournal,n),'utf8'));
    // Run the actual independent-copy worker and publisher on synthetic data.
    progress('copy on Mac and display independently verified metadata');
    const reportRoot=path.join(root,'cloud/LDCookLog-2-Development-Recovery');
    require('node:child_process').execFileSync('python3',['-c',"import sys;from pathlib import Path;from maintain_verified_recovery import protect;assert protect(Path(sys.argv[1]),Path(sys.argv[2]),scheduled=True)['reportPublished']",reportRoot,path.join(root,'independentMac')],{cwd:path.resolve(__dirname,'../mac')});
    await showBackups();await page.locator('#retry').click();
    await page.locator('#protection').filter({hasText:'Mac independent copy verified for this revision (2)'}).waitFor({state:'attached'});
    assert.match(await page.locator('#protection').innerText(),/0 confirmed uploaded/);
    assert.equal(await page.locator('#backupBrief').innerText(),'Mac copy verified · revision 2');
    await close();await open(false,true);
    await page.locator('#count').filter({hasText:'0 of 0'}).waitFor({state:'attached'});
    await showBackups();await page.locator('#browse').click();
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
    await showHistory();await page.locator('#history button').click();await expand('setupPanel');
    await page.locator('#phase').filter({hasText:'Cooking'}).waitFor();
    await page.locator('#timeline').filter({hasText:'Meat On'}).waitFor();
    assert.deepEqual(fs.readdirSync(originalJournal).sort().map(n=>fs.readFileSync(path.join(originalJournal,n),'utf8')),originalBytes);
    await close();await open(false,true);
    await showHistory();await page.locator('#history').filter({hasText:'Synthetic Scriptable ribs'}).waitFor();
    await close();await open();
    await showHistory();await page.locator('#history').filter({hasText:'Synthetic Scriptable ribs'}).waitFor();
    const journal=path.join(root,'local/LDCookLog-2-Development/journal');
    fs.writeFileSync(path.join(journal,fs.readdirSync(journal).sort().at(-1)),'broken');
    await close();await open(true);
    await showBackups();await page.locator('#browse').click();
    await page.locator('#snapshots button').filter({hasText:'This iPhone · revision 1'}).click();
    progress('accept restore');
    await page.locator('#ldc-confirm-yes').click();
    await page.locator('#status').filter({hasText:'Saved on this device'}).waitFor();
    assert.equal(fs.readdirSync(journal).length,3);
    await close();
    progress('seed full synthetic relational history');
    const migration=await import(pathToFileURL(path.resolve(__dirname,'../../native/Web/migration.js')).href);
    const recovery=await import(pathToFileURL(path.resolve(__dirname,'../../native/Web/recovery.js')).href);
    const tables=Object.fromEntries([...migration.REQUIRED_TABLES].sort().map(name=>[name,{columns:['id'],rows:[]}]));
    tables.cooks={columns:['id','food','start_time'],rows:[]};
    tables.events={columns:['id','cook_id','event_type','event_time','note'],rows:[]};
    tables.cook_fireboard_sessions={columns:['id','cook_id'],rows:[]};
    tables.fireboard_temperature_samples={columns:['id','cook_fireboard_session_id','temperature_value','observed_at','degree_type','channel_label','channel_index'],rows:[]};
    for(let i=0;i<30;i++){
      const id='synthetic-large-'+i,session='synthetic-session-'+i;
      tables.cooks.rows.push({id,food:'Synthetic large history '+i,start_time:'2026-10-11T00:00:00Z'});
      tables.events.rows.push({id:'synthetic-event-'+i,cook_id:id,event_type:'Meat On',event_time:'2026-10-11T00:00:00Z',note:''});
      tables.cook_fireboard_sessions.rows.push({id:session,cook_id:id});
      for(let n=0;n<600;n++)tables.fireboard_temperature_samples.rows.push({id:id+'-'+n,cook_fireboard_session_id:session,temperature_value:'225',observed_at:new Date(Date.UTC(2026,9,11,0,n)).toISOString(),degree_type:'2',channel_label:'Pit',channel_index:'1'});
    }
    const body={format:migration.RELATIONAL_FORMAT,version:1,createdAt:'2026-10-11T00:00:00Z',tables};
    const archive={...body,sha256:require('node:crypto').createHash('sha256').update(JSON.stringify(body)).digest('hex')};
    const migrated=await recovery.importArchive(recovery.emptyState(),archive);
    const envelope=await recovery.seal(migrated.state,4);
    const snapshot=path.join(journal,'0000000000000004-'+randomUUID()+'.recovery.json');
    const originalLarge=JSON.stringify(envelope);fs.writeFileSync(snapshot,originalLarge);
    await open();
    await page.locator('#count').filter({hasText:'30 of 30 cooks · 1 preserved database exports'}).waitFor({state:'attached'});
    await showHistory();await page.locator('#history button').first().click();
    await page.locator('#temperatures').filter({hasText:'600 retained readings'}).waitFor();
    await page.locator('#timeline').filter({hasText:'Meat On'}).waitFor();
    progress('compare four full-history cooks and preserve choices through filtering');
    await expand('comparisonPanel');await page.locator('#compareCook').selectOption('synthetic-large-1');
    await page.locator('#compareCook2').selectOption('synthetic-large-2');
    await page.locator('#compareCook3').selectOption('synthetic-large-3');
    assert.equal(await page.locator('#chart polyline').count(),4);
    assert.equal(await page.locator('#chartLegend p').count(),4);
    assert.match(await page.locator('#chartSummary').innerText(),/Synthetic large history 3 \(lavender\): 600 readings/);
    const duplicateOption=await page.locator('#compareCook2 option[value="synthetic-large-1"]').evaluate(option=>({disabled:option.disabled,html:option.outerHTML}));
    assert.equal(duplicateOption.disabled,true,JSON.stringify(duplicateOption));
    const selectedProbe=await page.locator('#compareProbe2').inputValue();
    await showHistory();await page.locator('#search').fill('Synthetic large history 29');
    await page.locator('#count').filter({hasText:'1 of 30'}).waitFor({state:'attached'});
    assert.equal(await page.locator('#compareCook').inputValue(),'synthetic-large-1');
    assert.equal(await page.locator('#compareCook2').inputValue(),'synthetic-large-2');
    assert.equal(await page.locator('#compareCook3').inputValue(),'synthetic-large-3');
    assert.equal(await page.locator('#compareProbe2').inputValue(),selectedProbe);
    assert.equal(await page.locator('#chart polyline').count(),4);
    assert.equal(fs.readFileSync(snapshot,'utf8'),originalLarge,'Comparisons never mutate cooking data');
    await showHistory();await page.locator('#search').fill('');
    await page.locator('#count').filter({hasText:'30 of 30'}).waitFor({state:'attached'});
    await page.locator('#navCook').click();await expand('setupPanel');await expand('fireboardPanel');
    await page.locator('#fbModel').selectOption('FireBoard 2');await expand('fbChannel1');
    await page.locator('#fbRole1').selectOption('Pit / ambient');await page.locator('#fbProbe1').selectOption('Wired');await page.locator('#fbPort1').selectOption('6');await page.locator('#fbLabel1').fill('Named synthetic pit');
    const link=await page.locator('#fbSeries1 option').nth(1).getAttribute('value');await page.locator('#fbSeries1').selectOption(link);
    await page.locator('#profileForm button[type=submit]').click();await page.locator('#profileFormFeedback').filter({hasText:'Saved on this device'}).waitFor();
    assert.match(await page.locator('#probe option:checked').innerText(),/Named synthetic pit/);assert.match(await page.locator('#chartLegend').innerText(),/Named synthetic pit/);
    await expand('targetsPanel');await page.locator('#pitTarget').fill('250');await page.locator('#meatTarget').fill('203');await page.locator('#targetsForm button').click();
    await page.locator('#targetsFormFeedback').filter({hasText:'Saved on this device'}).waitFor();
    assert.match(await page.locator('#timeline').innerText(),/Target Change.*250°F/);
    assert.equal(fs.readFileSync(snapshot,'utf8'),originalLarge,'Original recovery snapshot remains byte-identical after target/link saves');
    await close();await open();
    await page.locator('#count').filter({hasText:'30 of 30 cooks · 1 preserved database exports'}).waitFor({state:'attached'});
    assert.equal(fs.readFileSync(snapshot,'utf8'),originalLarge,'Opening large history never rewrites the journal');
    await showHistory();await page.locator('#history button').first().click();
    await page.locator('#targetSummary').filter({hasText:'Pit 250°F · Meat 203°F'}).waitFor();
    assert.match(await page.locator('#targetSummary').innerText(),/250°F.*203°F/);
    assert.match(await page.locator('#probe option:checked').innerText(),/Named synthetic pit/);
    const latest=JSON.parse(JSON.parse(fs.readFileSync(path.join(journal,fs.readdirSync(journal).sort().at(-1)),'utf8')).payload);
    const previous=JSON.parse(JSON.parse(originalLarge).payload);assert.deepEqual(latest.state.records.map(c=>c.temperatures),previous.state.records.map(c=>c.temperatures),'Links/targets leave every original reading unchanged');
    console.log('PASS: saved clock-based timers/active cook reopening, numeric target history and exact probe links/chart labels survive offline reopen without changing original readings.');
    console.log('PASS: generated Scriptable launcher, event-driven WebView bridge, local files, offline save/reopen, cloud retry/unconfirmed status, isolated fresh-journal cloud restoration/reopen with original bytes preserved, explicit damaged-journal restoration, delayed startup checksum and 30-cook/18,000-reading relational-history reopening. Host APIs simulated.');
    await close();
  } finally {clearTimeout(watchdog);await browser.close();fs.rmSync(root,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
