import test from 'node:test';
import assert from 'node:assert/strict';
import { availableActions, CookStore } from '../Web/recovery.js';
test('every offered phase action commits successfully and finished cooks offer no actions', async()=>{
  for(const phase of ['Preparation','Cooking','Resting','Keeping Warm']){
    for(const type of availableActions({phase})){
      let text=null;
      const store=new CookStore({read:async()=>text,commit:async value=>{text=value}});
      const initial=await store.add('Synthetic phase test','Synthetic cooker');
      const id=initial.records[0].id;
      if(phase!=='Preparation')await store.event(id,'Meat On');
      if(phase==='Resting')await store.event(id,'Rest Start');
      if(phase==='Keeping Warm')await store.event(id,'Keep Warm');
      await store.event(id,type,'Synthetic action note');
      assert.equal((await store.read()).state.records[0].events.at(-1).type,type);
    }
  }
  assert.deepEqual(availableActions({phase:'Finished'}),[]);
  assert.deepEqual(availableActions({finishedAt:'2026-10-13T00:00:00Z'}),[]);
  assert.ok(!availableActions({phase:'Resting'}).includes('Meat On'));
  assert.ok(!availableActions({phase:'Preparation'}).includes('Cook Finished'));
});
