import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { CookStore, availableActions, lidIsOpen } from '../Web/recovery.js';
import { setupChoices } from '../Web/history-details.js';
globalThis.crypto ||= webcrypto;
async function fixture(){const disk={current:null,read:async()=>disk.current,commit:async text=>{disk.current=text}};const store=new CookStore(disk);const state=await store.add('Synthetic ribs','Weber');return {disk,store,id:state.records[0].id};}
test('catalog choices preserve archived names, exclude test additions and deduplicate without mutating source',()=>{
 const state={relationalArchives:[{tables:{rubs:{rows:[{name:'Paprika'},{name:' Salt '},{name:null}]},equipment:{rows:[{name:'Kettle'}]},fireboard_account_access:{rows:[{name:'Private account'}]}}}],records:[{cookingDetails:{rubs:'paprika; Pepper'}},{isTestCook:true,cookingDetails:{rubs:'Synthetic rub'}},{cookingDetails:{rubs:42}}]};
 const before=JSON.stringify(state);assert.deepEqual(setupChoices(state,'rubs'),['Paprika','Pepper','Salt']);assert.deepEqual(setupChoices(state,'equipment'),['Kettle']);assert.equal(JSON.stringify(state),before);assert.throws(()=>setupChoices(state,'fireboard_account_access'));
});
test('lid transitions reject duplicate saves, retain phase and restore exactly',async()=>{
 const f=await fixture();const results=await Promise.allSettled([f.store.event(f.id,'Lid Open'),f.store.event(f.id,'Lid Open')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 let cook=(await f.store.read()).state.records[0];assert.equal(lidIsOpen(cook),true);assert.equal(cook.phase,'Preparation');assert.ok(availableActions(cook).includes('Lid Closed'));assert.ok(!availableActions(cook).includes('Lid Open'));
 await f.store.event(f.id,'Lid Closed');const before=f.disk.current;await assert.rejects(f.store.event(f.id,'Lid Closed'),/already closed/);assert.equal(f.disk.current,before);
 const fresh=await fixture();await fresh.store.restore(JSON.parse(before));assert.deepEqual((await fresh.store.read()).state,(await f.store.read()).state);
});
test('wrap methods validate before writing and recover original details without changing planned setup',async()=>{
 const f=await fixture();await assert.rejects(f.store.event(f.id,'Wrapped','',{wrapMethod:'Foil',wrapDetail:''}));await f.store.event(f.id,'Meat On');
 for(const detail of [{wrapMethod:'Other',wrapDetail:''},{wrapMethod:'Plastic',wrapDetail:''},{wrapMethod:'Foil',wrapDetail:'x'.repeat(301)}]){const before=f.disk.current;await assert.rejects(f.store.event(f.id,'Wrapped','',detail));assert.equal(f.disk.current,before);}
 await f.store.event(f.id,'Wrapped','Preserve juices',{wrapMethod:'Other',wrapDetail:'Covered pan'});const cook=(await f.store.read()).state.records[0];assert.equal(cook.phase,'Cooking');assert.equal(cook.events.at(-1).wrapDetail,'Covered pan');assert.equal(cook.events.at(-1).note,'Preserve juices');
 const fresh=await fixture();await fresh.store.restore(JSON.parse(f.disk.current));assert.deepEqual((await fresh.store.read()).state,(await f.store.read()).state);
 await f.store.event(f.id,'Cook Finished');const before=f.disk.current;await assert.rejects(f.store.event(f.id,'Lid Open'),/finished/);assert.equal(f.disk.current,before);
});
