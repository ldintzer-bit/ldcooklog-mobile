import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { CookStore,availableActions } from '../Web/recovery.js';
import { blankMeatPiece,meatPiecesFor,rubApplicationsFor,recipeChoices } from '../Web/setup-details.js';
import { cookTimers } from '../Web/cook-tools.js';
globalThis.crypto ||= webcrypto;
async function fixture(){const disk={current:null,read:async()=>disk.current,commit:async value=>{disk.current=value}};const store=new CookStore(disk);const state=await store.add('Synthetic','Weber');const c=state.records[0];return {store,disk,id:c.id,profile:{food:c.food,cooker:c.cooker,startedAt:c.startedAt,finishedAt:null,isTestCook:true,method:'',weight:'',equipment:'',preparation:'',rubs:'',sauces:'',rating:null}};}
test('legacy meat pieces and rub applications retain zero values, units, ordering and untouched rows',()=>{
 const cook={legacy:{lookups:{rubs:[{id:'r',name:'Synthetic rub'}]},related:{cook_meat_pieces:[{piece_number:2,meat_cut:'Second',cook_weight:'3.2',weight_unit:'kg'},{piece_number:1,meat_cut:'First',package_weight:'8',total_price:0,weight_unit:'lb'}],cook_rubs:[{rub_id:'r',application_level:'Heavy',notes:'One side'}]}}};const before=JSON.stringify(cook);const pieces=meatPiecesFor(cook);assert.equal(pieces[0].totalPrice,0);assert.equal(pieces[0].cookWeight,null);assert.equal(pieces[1].weightUnit,'kg');assert.equal(pieces[1].cookWeight,3.2);assert.deepEqual(rubApplicationsFor(cook),[{name:'Synthetic rub',level:'Heavy',notes:'One side'}]);pieces[0].meatCut='Changed';assert.equal(JSON.stringify(cook),before);
 assert.equal(meatPiecesFor({legacy:{related:{cook_meat_pieces:[{piece_number:1,meat_cut:'Unknown unit',cook_weight:0}]}}})[0].weightUnit,'');
 assert.deepEqual(meatPiecesFor({...cook,cookingDetails:{meatPieces:[]}}),[]);assert.deepEqual(rubApplicationsFor({...cook,cookingDetails:{rubApplications:[]}}),[]);
});
test('structured setup saves and fresh-journal restoration preserve original source and all optional metadata',async()=>{
 const f=await fixture();const original={related:{cook_meat_pieces:[{piece_number:1,meat_cut:'Archived',cook_weight:0}]}};await f.store.mutate(s=>{s.records[0].legacy=structuredClone(original);return s});
 const value={...f.profile,cooker:'Traeger Pro 780',location:'Synthetic cottage',recipeReference:'Book chapter 3',meatPieces:[{...blankMeatPiece(),meatCut:'First',totalPrice:0,cookWeight:8},{...blankMeatPiece(),meatCut:'Second',weightUnit:'kg',cookWeight:3.2}],rubApplications:[{name:'Paprika',level:'Light',notes:'First piece'}]};await f.store.profile(f.id,value);const saved=(await f.store.read()).state;assert.deepEqual(saved.records[0].legacy,original);
 const fresh=await fixture();await fresh.store.restore(JSON.parse(f.disk.current));assert.deepEqual((await fresh.store.read()).state,saved);
 await f.store.profile(f.id,{...value,meatPieces:[],rubApplications:[]});assert.deepEqual((await f.store.read()).state.records[0].cookingDetails.meatPieces,[]);assert.deepEqual((await f.store.read()).state.records[0].legacy,original);
});
test('invalid structured setup is rejected before disk writes, including corrupted recovery metadata',async()=>{
 const f=await fixture();for(const fields of [{meatPieces:[{...blankMeatPiece(),cookWeight:-1}]},{meatPieces:[{...blankMeatPiece(),packageWeight:Infinity}]},{meatPieces:Array(33).fill(blankMeatPiece())},{rubApplications:[{name:'',level:'Light',notes:''}]},{rubApplications:[{name:'Rub',level:'Guess',notes:''}]},{location:'x'.repeat(301)},{recipeReference:'x'.repeat(2001)}]){const before=f.disk.current;await assert.rejects(f.store.profile(f.id,{...f.profile,...fields}));assert.equal(f.disk.current,before);}
});
test('saved recipes retain references, exclude test additions and do not expose account rows',()=>{
 const state={relationalArchives:[{tables:{cook_methods:{rows:[{name:'Recipe',source_reference:'Book page 3'}]},fireboard_account_access:{rows:[{name:'Secret'}]}}}],records:[{cookingDetails:{method:'Recipe'}},{cookingDetails:{method:'Custom',recipeReference:'Personal note'}},{isTestCook:true,cookingDetails:{method:'Test'}}]};const before=JSON.stringify(state);assert.deepEqual(recipeChoices(state),[{name:'Custom',reference:'Personal note'},{name:'Recipe',reference:'Book page 3'}]);assert.equal(JSON.stringify(state),before);
});
test('Spritz logs without phase change; serving ends rest timer and remains finishable and recoverable',async()=>{
 const f=await fixture();await f.store.event(f.id,'Meat On');await f.store.event(f.id,'Spritz','Apple juice');assert.equal((await f.store.read()).state.records[0].phase,'Cooking');await f.store.event(f.id,'Rest Start');await f.store.event(f.id,'Serve / Slice / Pull','Pulled');const c=(await f.store.read()).state.records[0];assert.equal(c.phase,'Serving');assert.ok(!availableActions(c).includes('Serve / Slice / Pull'));assert.ok(availableActions(c).includes('Cook Finished'));const before=f.disk.current;await assert.rejects(f.store.event(f.id,'Serve / Slice / Pull'));assert.equal(f.disk.current,before);await f.store.event(f.id,'Cook Finished');assert.deepEqual(availableActions((await f.store.read()).state.records[0]),[]);
 const at=h=>`2026-10-13T${h}:00:00Z`;const timed={startedAt:at('10'),phase:'Serving',events:[{type:'Meat On',at:at('10')},{type:'Rest Start',at:at('12')},{type:'Serve / Slice / Pull',at:at('13')}]};const time=cookTimers(timed,Date.parse(at('14')));assert.equal(time.restMs,3600000);assert.equal(time.phaseMs,3600000);
 const fresh=await fixture();await fresh.store.restore(JSON.parse(f.disk.current));assert.deepEqual((await fresh.store.read()).state,(await f.store.read()).state);
});
