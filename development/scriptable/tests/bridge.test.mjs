import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../bridge.js',import.meta.url),'utf8');
test('idle queue returns synchronously; UI replies preserve order and reject failures',async()=>{
  const window={};vm.runInNewContext(source,{window});
  assert.equal(window.__ldcTakeNow(),null);
  const first=window.ldcooklogHost.postMessage({operation:'read'});
  const second=window.ldcooklogHost.postMessage({operation:'commit'});
  const a=window.__ldcTakeNow(),b=window.__ldcTakeNow();
  assert.equal(a.body.operation,'read');assert.equal(b.body.operation,'commit');
  assert.equal(window.__ldcTakeNow(),null);
  window.__ldcDeliver({id:a.id,result:'saved'});
  window.__ldcDeliver({id:b.id,error:'Disk failed'});
  assert.equal(await first,'saved');await assert.rejects(second,/Disk failed/);
  assert.throws(()=>window.__ldcDeliver({id:a.id,result:'duplicate'}),/Unknown/);
});
test('bridge bounds pending requests and recovers capacity after replies',async()=>{
  const window={};vm.runInNewContext(source,{window});
  const pending=Array.from({length:64},()=>window.ldcooklogHost.postMessage({operation:'read'}));
  await assert.rejects(window.ldcooklogHost.postMessage({operation:'read'}),/Too many/);
  for(let i=0;i<64;i++){const request=window.__ldcTakeNow();window.__ldcDeliver({id:request.id,result:null})}
  await Promise.all(pending);
  const next=window.ldcooklogHost.postMessage({operation:'read'}),request=window.__ldcTakeNow();
  window.__ldcDeliver({id:request.id,result:'ready'});assert.equal(await next,'ready');
});
