import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CookStore, unseal } from '../Web/recovery.js';
const setup=()=>({version:1,model:'FireBoard 2',deviceName:'Synthetic unit',accessories:'Grill clip',channels:Array.from({length:6},(_,i)=>({channel:i+1,role:i===0?'Pit / ambient':i===1?'Meat':'Not used',probeType:i===0?'Wired ambient probe':i===1?'Wired food probe':'Not recorded',label:i===0?'Pit':i===1?'Pork butt':'',placement:i===0?'Back of bottom grate':i===1?'Meat center':''}))});
async function fixture(){let text=null;const disk={read:async()=>text,commit:async value=>{text=value}};const store=new CookStore(disk);const state=await store.add('Synthetic ribs','Weber');const cook=state.records[0];return {disk,store,id:cook.id,bytes:()=>text,profile:{food:cook.food,cooker:cook.cooker,startedAt:cook.startedAt,finishedAt:null,isTestCook:true,method:'Smoked',weight:'',equipment:'Weber kettle',preparation:'',rubs:'',sauces:'',rating:null}};}
test('FireBoard setup survives full recovery, preserves source evidence and completed-session readings',async()=>{
 const f=await fixture(),config=setup();
 await f.store.mutate(state=>{state.records[0].legacy={related:{fireboard_probe_roles:[{id:'synthetic-source',probe_role:'Original'}]}};return state});
 await f.store.profile(f.id,{...f.profile,fireboardSetup:config});
 config.channels[0].label='Mutated caller';
 const expected=setup();assert.deepEqual((await f.store.read()).state.records[0].cookingDetails.fireboardSetup,expected);
 const exported={format:'ldcooklog-fireboard-completed',version:1,session:{id:'123',start_time:'2026-01-01T10:00:00Z',end_time:'2026-01-01T11:00:00Z'},chart:[{label:'Original label',channel_id:0,degreetype:2,x:['2026-01-01T10:00:00Z'],y:[225]}]};
 await f.store.importSession(f.id,exported);
 const before=(await f.store.read()).state;
 assert.deepEqual(before.records[0].cookingDetails.fireboardSetup,expected);
 assert.deepEqual(before.records[0].completedSessions[0].chart,exported.chart);
 assert.equal(before.records[0].temperatures[0].channel,'Original label');
 assert.equal(before.records[0].legacy.related.fireboard_probe_roles[0].probe_role,'Original');
 const other=await fixture();await other.store.restore(JSON.parse(f.bytes()));assert.deepEqual((await other.store.read()).state,before);
 await f.store.profile(f.id,f.profile);assert.deepEqual((await f.store.read()).state.records[0].cookingDetails.fireboardSetup,expected,'Omitted setup preserves existing configuration');
 await f.store.profile(f.id,{...f.profile,fireboardSetup:null});assert.equal((await f.store.read()).state.records[0].cookingDetails.fireboardSetup,null);
 assert.deepEqual((await unseal(JSON.parse(f.bytes()))).state.records[0].completedSessions,before.records[0].completedSessions);
});
test('invalid channels and choices cannot write or restore a checksum-valid invalid setup',async()=>{
 const f=await fixture();await f.store.profile(f.id,{...f.profile,fireboardSetup:setup()});const original=f.bytes();
 const invalid=[{...setup(),model:'Unknown'},{...setup(),channels:setup().channels.slice(0,5)},{...setup(),deviceName:'x'.repeat(161)}];
 for(const change of [{channel:0},{channel:7},{role:'Unknown'},{probeType:'Unknown'},{placement:'x'.repeat(501)}]){const value=setup();value.channels[0]={...value.channels[0],...change};invalid.push(value);}
 const duplicate=setup();duplicate.channels[1].channel=1;invalid.push(duplicate);
 for(const value of invalid){await assert.rejects(f.store.profile(f.id,{...f.profile,fireboardSetup:value}),/FireBoard/);assert.equal(f.bytes(),original);}
 const envelope=JSON.parse(original),body=JSON.parse(envelope.payload);body.state.records[0].cookingDetails.fireboardSetup=duplicate;envelope.payload=JSON.stringify(body);envelope.sha256=createHash('sha256').update(envelope.payload).digest('hex');
 await assert.rejects(f.store.restore(envelope),/FireBoard/);assert.equal(f.bytes(),original);
});
test('wired port and wireless color/internal-external settings restore exactly; old probe types remain readable',async()=>{
 const f=await fixture(),config=setup();
 config.channels[0]={...config.channels[0],probeType:'Wired',wiredPort:6,color:'Not recorded',measurement:'Not recorded'};
 config.channels[1]={...config.channels[1],probeType:'Wireless',wiredPort:null,color:'Orange',measurement:'Internal / meat'};
 config.channels[2]={...config.channels[2],role:'Other',probeType:'Wireless',wiredPort:null,color:'Orange',measurement:'External / ambient',label:'Ambient reference'};
 config.channels[3]={...config.channels[3],role:'Meat',probeType:'Wireless',wiredPort:null,color:'Silver',measurement:'Internal / meat'};
 await f.store.profile(f.id,{...f.profile,fireboardSetup:config});
 const other=await fixture();await other.store.restore(JSON.parse(f.bytes()));assert.deepEqual((await other.store.read()).state.records[0].cookingDetails.fireboardSetup,config);
 const before=f.bytes();for(const change of [{color:'Invalid'},{measurement:'Invalid'},{wiredPort:7}]){const bad=structuredClone(config);Object.assign(bad.channels[0],change);await assert.rejects(f.store.profile(f.id,{...f.profile,fireboardSetup:bad}),/FireBoard/);assert.equal(f.bytes(),before);}
 await f.store.profile(f.id,{...f.profile,fireboardSetup:setup()});assert.equal((await f.store.read()).state.records[0].cookingDetails.fireboardSetup.channels[0].probeType,'Wired ambient probe');
});

test('flexible version 2 supports more probes, sparse IDs and custom colors without losing older snapshots',async()=>{
 const f=await fixture(),config={...setup(),version:2};
 for(let i=7;i<=12;i++)config.channels.push({channel:i,role:'Meat',probeType:'Wireless',label:'Extra '+i,placement:'Meat center',wiredPort:null,color:'Other',customColor:'Green '+i,measurement:'Internal / meat'});
 await f.store.profile(f.id,{...f.profile,fireboardSetup:config});const snapshot=JSON.parse(f.bytes());
 const other=await fixture();await other.store.restore(snapshot);assert.deepEqual((await other.store.read()).state.records[0].cookingDetails.fireboardSetup,config);
 const smaller={...config,channels:config.channels.filter(p=>p.channel!==7)};await f.store.profile(f.id,{...f.profile,fireboardSetup:smaller});assert.equal((await f.store.read()).state.records[0].cookingDetails.fireboardSetup.channels.length,11);
 await f.store.restore(snapshot);assert.deepEqual((await f.store.read()).state.records[0].cookingDetails.fireboardSetup,config);
 const before=f.bytes(),tooMany={...config,channels:Array.from({length:33},(_,i)=>({...config.channels[0],channel:i+1}))};await assert.rejects(f.store.profile(f.id,{...f.profile,fireboardSetup:tooMany}),/FireBoard/);assert.equal(f.bytes(),before);
 await f.store.profile(f.id,{...f.profile,fireboardSetup:{...config,channels:[]}});assert.deepEqual((await f.store.read()).state.records[0].cookingDetails.fireboardSetup.channels,[]);
});
