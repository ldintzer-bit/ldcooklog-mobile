import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createStorage} from '../storage.cjs';
import {seal, unseal, emptyState} from '../../native/Web/recovery.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function fileManager(root) {
  fs.mkdirSync(root,{recursive:true});
  return {
    documentsDirectory:()=>root, joinPath:path.join,
    createDirectory:(p)=>fs.mkdirSync(p,{recursive:true}),
    fileExists:fs.existsSync, readString:p=>fs.readFileSync(p,'utf8'),
    writeString:(p,s)=>fs.writeFileSync(p,s), listContents:p=>fs.readdirSync(p),
    isDirectory:p=>fs.statSync(p).isDirectory(), isFileDownloaded:fs.existsSync,
    downloadFileFromiCloud:async()=>{}
  };
}
function setup(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'ldcooklog-synthetic-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const local=fileManager(path.join(root,'local')), cloud=fileManager(path.join(root,'cloud'));
  const config={local,cloud,verify:async text=>unseal(JSON.parse(text)),uuid:randomUUID};
  return {root,local,cloud,config,store:createStorage(config),journal:path.join(root,'local/LDCookLog-2-Development/journal')};
}
const snapshot=async revision=>JSON.stringify(await seal(emptyState(),revision));

test('immutable snapshots reopen and preserve older saves',async t=>{
  const {store,config,journal}=setup(t);
  const one=await snapshot(1),two=await snapshot(2);
  await store.commit(one,0);await store.commit(two,1);
  assert.equal(await createStorage(config).read(),two);
  assert.equal(fs.readdirSync(journal).length,2);
  assert.equal(fs.readFileSync(path.join(journal,fs.readdirSync(journal).sort()[0]),'utf8'),one);
});
test('stale writer and mismatched next revision cannot create files',async t=>{
  const {store,journal}=setup(t);
  await store.commit(await snapshot(1),0);
  await assert.rejects(store.commit(await snapshot(2),0),/changed/);
  await assert.rejects(store.commit(await snapshot(3),1),/changed/);
  assert.equal(fs.readdirSync(journal).length,1);
});
test('corrupt newest snapshot refuses silent fallback, explicit repair preserves evidence',async t=>{
  const {store,journal}=setup(t),one=await snapshot(1);
  await store.commit(one,0);await store.commit(await snapshot(2),1);
  fs.writeFileSync(path.join(journal,fs.readdirSync(journal).sort().at(-1)),'broken');
  await assert.rejects(store.read());
  await assert.rejects(store.commit(await snapshot(3),2));
  await store.repair(one,async(text,revision)=>JSON.stringify(await seal((await unseal(JSON.parse(text))).state,revision)));
  assert.equal((await unseal(JSON.parse(await store.read()))).revision,3);
  assert.equal(fs.readdirSync(journal).length,3);
});
test('missing journal files refuse empty initialization',async t=>{
  const {store,config,journal}=setup(t);
  await store.commit(await snapshot(1),0);
  for(const name of fs.readdirSync(journal))fs.unlinkSync(path.join(journal,name));
  await assert.rejects(createStorage(config).read(),/missing/);
});
test('partial write never reports success and requires explicit recovery',async t=>{
  const {store,local}=setup(t),original=local.writeString;
  local.writeString=(p,s)=>original(p,p.endsWith('.recovery.json')?s.slice(0,50):s);
  await assert.rejects(store.commit(await snapshot(1),0),/readback/);
  await assert.rejects(store.read());
});
test('tampered payload is rejected before writing',async t=>{
  const {store,journal}=setup(t),value=JSON.parse(await snapshot(1));
  value.payload+=' ';
  await assert.rejects(store.commit(JSON.stringify(value),0),/Damaged/);
  assert.equal(fs.readdirSync(journal).length,0);
});
test('competing same revision snapshots stop opening instead of choosing a winner',async t=>{
  const {store,journal}=setup(t),one=await snapshot(1);
  await store.commit(one,0);
  fs.writeFileSync(path.join(journal,'0000000000000001-'+randomUUID()+'.recovery.json'),one);
  await assert.rejects(store.read(),/conflict/);
});
test('cloud outage cannot prevent offline commits; retry never claims upload confirmed',async t=>{
  const {store,cloud}=setup(t),original=cloud.createDirectory;
  cloud.createDirectory=()=>{throw Error('offline')};
  const one=await snapshot(1);await store.commit(one,0);
  assert.equal(await store.read(),one);
  assert.match((await store.backupStatus()).message,/0 copies staged/);
  cloud.createDirectory=original;
  const status=await store.backupStatus();
  assert.equal(status.uploaded,0);assert.equal(status.pending,1);
  assert.match(status.message,/1 copies staged/);
  const cloudChoice=(await store.listSnapshots()).find(s=>s.label.startsWith('iCloud'));
  assert.equal(await store.readSnapshot(cloudChoice.token),one);
  await assert.rejects(store.readSnapshot('../../secret'),/Unknown/);
});
test('damaged old snapshot does not stop staging newer valid snapshots',async t=>{
  const {store,journal}=setup(t);
  await store.commit(await snapshot(1),0);await store.commit(await snapshot(2),1);
  fs.writeFileSync(path.join(journal,fs.readdirSync(journal).sort()[0]),'broken');
  const status=await store.backupStatus();
  assert.match(status.message,/1 copies staged.*1 could not/);
  assert.equal((await unseal(JSON.parse(await store.read()))).revision,2);
});
test('cloud corruption is reported without overwriting recovery evidence',async t=>{
  const {store,cloud}=setup(t);
  await store.commit(await snapshot(1),0);await store.backupStatus();
  const base=path.join(cloud.documentsDirectory(),'LDCookLog-2-Development-Recovery');
  const dir=path.join(base,fs.readdirSync(base)[0]),file=path.join(dir,fs.readdirSync(dir)[0]);
  fs.writeFileSync(file,'broken');
  assert.match((await store.backupStatus()).message,/1 could not/);
  assert.equal(fs.readFileSync(file,'utf8'),'broken');
  const choice=(await store.listSnapshots()).find(s=>s.label.startsWith('iCloud'));
  await assert.rejects(store.readSnapshot(choice.token));
});
