// Runs only synthetic data in newly created, uniquely named rehearsal roots.
async function retentionRehearsal() {
  const localManager=FileManager.local(), cloudManager=FileManager.iCloud();
  const identity=UUID.string();
  const localRoot=localManager.joinPath(localManager.documentsDirectory(),'LDCookLog-2-Synthetic-Rehearsals/'+identity);
  const cloudRoot=cloudManager.joinPath(cloudManager.documentsDirectory(),'LDCookLog-2-Synthetic-Rehearsals/'+identity);
  if(localManager.fileExists(localRoot) || cloudManager.fileExists(cloudRoot))throw Error('Rehearsal folder already exists');
  localManager.createDirectory(localRoot,true);cloudManager.createDirectory(cloudRoot,true);
  function manager(original,root) {
    original.createDirectory(root,true);
    const adapter={documentsDirectory:()=>root};
    for(const name of ['joinPath','createDirectory','fileExists','readString','writeString','listContents','isDirectory','isFileDownloaded','downloadFileFromiCloud','remove'])adapter[name]=(...args)=>original[name](...args);
    return adapter;
  }
  const local=manager(localManager,localRoot),cloud=manager(cloudManager,cloudRoot);
  const web=new WebView(),base='https://ldcooklog.invalid/';
  web.shouldAllowRequest=request=>request.url===base || request.url==='about:blank';
  async function bounded(work) {
    let timer;
    const expired=new Promise((_,reject)=>{timer=Timer.schedule(15000,false,()=>reject(Error('Synthetic validation timed out')))});
    try{return await Promise.race([Promise.resolve().then(work),expired])}finally{timer.invalidate()}
  }
  await bounded(()=>web.loadHTML(LDC_RETENTION_HTML,base));
  async function invoke(operation,args) {
    const result=await bounded(()=>web.evaluateJavaScript(`{const done=completion;window.__rehearsal[${JSON.stringify(operation)}](...${JSON.stringify(args)}).then(value=>done(JSON.stringify({value})),()=>done(JSON.stringify({error:true})));} 'synthetic-operation-started';`,true));
    const parsed=JSON.parse(result);if(parsed.error)throw Error('Synthetic checksum/schema validation failed');return parsed.value;
  }
  const config={local,cloud,verify:async text=>invoke('verify',[text]),uuid:()=>UUID.string()};
  const storage=createStorage(config);
  const state={records:[{id:'synthetic-retention-cook',food:'Synthetic ribs',cooker:'Synthetic kettle',startedAt:'2026-01-01T10:00:00Z',finishedAt:'2026-01-01T12:00:00Z',phase:'Finished',events:[{id:'synthetic-on',type:'Meat On',at:'2026-01-01T10:00:00Z',note:'Synthetic event'}],temperatures:[{at:'2026-01-01T11:00:00Z',value:225,unit:'F',channel:'Synthetic pit'}],notes:'Synthetic retention notes',evaluation:'Synthetic evaluation',cookingDetails:{method:'No wrap',equipment:'Synthetic kettle',preparation:'Synthetic dry brine',rating:4},isTestCook:true}],relationalArchives:[]};
  let latest;
  for(let revision=1;revision<=26;revision++){state.records[0].notes='Synthetic revision '+revision;latest=await invoke('seal',[state,revision]);await storage.commit(latest,revision-1)}
  const before=await storage.backupStatus();if(before.local!==26)throw Error('Snapshots changed before independent-proof test');
  // A simulated receipt exercises the proof-gated cleanup branch. This is
  // explicitly not evidence of a real Mac copy or of real data protection.
  const device=local.readString(local.joinPath(localRoot,'LDCookLog-2-Development/device-id'));
  const reportFolder=cloud.joinPath(cloudRoot,'LDCookLog-2-Mac-Verification/development');cloud.createDirectory(reportFolder,true);
  cloud.writeString(cloud.joinPath(reportFolder,device+'.json'),JSON.stringify({format:'ldcooklog-mac-copy-report',version:1,namespace:'development',device,health:'verified',revision:26,sha256:JSON.parse(latest).sha256,checkedAt:new Date().toISOString(),verifiedAt:new Date().toISOString(),trigger:'manual'}));
  const after=await storage.backupStatus();if(!after.mac.verified || after.local!==21)throw Error('Synthetic cleanup did not keep first and newest twenty');
  const reopened=createStorage(config);if(await reopened.read()!==latest)throw Error('Reopening after cleanup changed latest snapshot');
  const journal=local.joinPath(localRoot,'LDCookLog-2-Development/journal');
  const names=local.listContents(journal).sort();if(!names[0].startsWith('0000000000000001-') || !names[1].startsWith('0000000000000007-'))throw Error('Required synthetic recovery points missing');
  const listed=await reopened.listSnapshots(),selected=listed.find(row=>row.label.startsWith('iCloud copy') && row.label.includes('revision 26 '));
  if(!selected)throw Error('Synthetic cloud recovery copy missing');
  const selectedText=await reopened.readSnapshot(selected.token);
  const restoreLocal=manager(localManager,localManager.joinPath(localRoot,'Fresh restore'));
  const restored=createStorage({...config,local:restoreLocal});
  await restored.commit(await invoke('reseal',[selectedText,1]),0);
  const recovered=await invoke('verify',[await createStorage({...config,local:restoreLocal}).read()]);
  if(JSON.stringify(recovered.state)!==JSON.stringify(state))throw Error('Fresh synthetic journal differs after restoration');
  let cleanup=true;
  try{cloudManager.remove(cloudRoot);localManager.remove(localRoot)}catch{cleanup=false}
  return 'IPHONE RETENTION PASS: 26 synthetic saves; 21 snapshots retained; first and newest twenty kept.\nREOPEN / FRESH-JOURNAL RECOVERY PASS: exact synthetic cook, readings, notes and setup recovered.\nMac receipt was simulated for this isolated test; this does not verify a real Mac backup.\n'+(cleanup?'Synthetic rehearsal folders removed.':'Synthetic rehearsal folders kept because cleanup could not finish.')+'\nWorking journal, real recovery copies, original archives and credentials were not accessed.';
}
try {
  const result=await retentionRehearsal();const alert=new Alert();alert.title='LDCookLog synthetic retention rehearsal';alert.message=result;alert.addAction('Done');await alert.presentAlert();
} catch {
  const alert=new Alert();alert.title='Synthetic retention rehearsal did not complete';alert.message='Working cooking data and real backups were not accessed. Keep the synthetic rehearsal folders for diagnosis and report this message.';alert.addAction('Done');await alert.presentAlert();
}
Script.complete();
