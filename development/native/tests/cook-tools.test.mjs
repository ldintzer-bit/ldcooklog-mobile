import test from 'node:test';
import assert from 'node:assert/strict';
import { CookStore } from '../Web/recovery.js';
import { cookTimers, cookTargets, assignedProbeLabel } from '../Web/cook-tools.js';
import { seriesKey } from '../Web/fireboard.js';
const at=h=>`2026-10-13T${String(h).padStart(2,'0')}:00:00Z`;
test('timers rebuild repeated rest/hold phases from timestamps, stop at finish and never mutate history',()=>{
 const cook={startedAt:at(10),finishedAt:null,phase:'Resting',events:[{type:'Meat On',at:at(10)},{type:'Keep Warm',at:at(12)},{type:'Rest Start',at:at(13)},{type:'Keep Warm',at:at(14)},{type:'Rest Start',at:at(15)}]};
 const original=JSON.stringify(cook),time=cookTimers(cook,Date.parse(at(16)));assert.equal(time.totalMs,6*3600000);assert.equal(time.phaseMs,3600000);assert.equal(time.restMs,2*3600000);assert.equal(time.holdMs,2*3600000);assert.equal(JSON.stringify(cook),original);
 const finished={...cook,phase:'Finished',finishedAt:at(16),events:[...cook.events,{type:'Cook Finished',at:at(16)}]};assert.deepEqual(cookTimers(finished,Date.parse(at(20))),cookTimers(finished,Date.parse(at(23))));
 assert.deepEqual(cookTimers({...finished,finishedAt:null},Date.parse(at(23))),cookTimers(finished,Date.parse(at(23))));
 assert.equal(cookTimers({startedAt:at(10),phase:'Finished',events:[]},Date.parse(at(23))).totalMs,null);
 assert.equal(cookTimers({startedAt:at(10),finishedAt:null,phase:'Preparation',events:[]},Date.parse(at(11))).phaseMs,3600000);
 assert.equal(cookTimers({startedAt:at(10),finishedAt:null,phase:'Resting',events:[]},Date.parse(at(11))).phaseMs,null);
});
async function fixture(){let text=null;const disk={read:async()=>text,commit:async value=>{text=value}};const store=new CookStore(disk);const state=await store.add('Synthetic','Weber');const cook=state.records[0];return {store,disk,id:cook.id,bytes:()=>text,profile:{food:cook.food,cooker:cook.cooker,startedAt:cook.startedAt,finishedAt:null,isTestCook:true,method:'',weight:'',equipment:'',preparation:'',rubs:'',sauces:'',rating:null}};}
test('numeric targets have recoverable before/after history; invalid/finished changes cannot write',async()=>{
 const f=await fixture();await f.store.targets(f.id,{unit:'F',pitF:225,meatF:203},'Initial plan');await f.store.targets(f.id,{unit:'F',pitF:250,meatF:203},'Increase pit');
 const saved=(await f.store.read()).state,cook=saved.records[0];assert.equal(cook.events[1].previousTargets.pitF,225);assert.equal(cook.events[1].targets.pitF,250);assert.equal(cookTargets(cook).meatF,203);
 const other=await fixture();await other.store.restore(JSON.parse(f.bytes()));assert.deepEqual((await other.store.read()).state,saved);
 for(const value of [{unit:'C',pitF:225,meatF:203},{unit:'F',pitF:-1,meatF:203},{unit:'F',pitF:225,meatF:1001}]){const before=f.bytes();await assert.rejects(async()=>f.store.targets(f.id,value));assert.equal(f.bytes(),before);}
 await f.store.event(f.id,'Meat On');await f.store.event(f.id,'Cook Finished');const before=f.bytes();await assert.rejects(f.store.targets(f.id,{unit:'F',pitF:200,meatF:null}),/finished/);assert.equal(f.bytes(),before);
});
test('explicit reading links distinguish devices/sessions, restore exactly and never rename raw readings',async()=>{
 const f=await fixture();const samples=[{at:at(10),value:225,unit:'F',channel:'Same label',channelId:'0',deviceUUID:'device-A',sessionId:'session-A'},{at:at(10),value:180,unit:'F',channel:'Same label',channelId:'0',deviceUUID:'device-B',sessionId:'session-A'}];
 await f.store.mutate(state=>{state.records[0].temperatures=structuredClone(samples);return state});
 const setup={version:2,model:'FireBoard 2',deviceName:'Synthetic',accessories:'',channels:[{channel:1,role:'Meat',probeType:'Wireless',color:'Orange',measurement:'Internal / meat',label:'Pork butt 1',placement:'Center',seriesKey:seriesKey(samples[1])}]};
 await f.store.profile(f.id,{...f.profile,fireboardSetup:setup});const cook=(await f.store.read()).state.records[0];assert.equal(assignedProbeLabel(cook,samples[0]),'Same label');assert.match(assignedProbeLabel(cook,samples[1]),/Pork butt 1.*Orange.*Internal/);assert.deepEqual(cook.temperatures,samples);
 const other=await fixture();await other.store.restore(JSON.parse(f.bytes()));assert.deepEqual((await other.store.read()).state,(await f.store.read()).state);
 const before=f.bytes(),duplicate={...setup,channels:[...setup.channels,{...setup.channels[0],channel:2}]};await assert.rejects(f.store.profile(f.id,{...f.profile,fireboardSetup:duplicate}),/more than one/);assert.equal(f.bytes(),before);
 await assert.rejects(f.store.profile(f.id,{...f.profile,fireboardSetup:{...setup,channels:[{...setup.channels[0],seriesKey:'["wrong"]'}]}}),/does not match/);assert.equal(f.bytes(),before);
});
