import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {draftBase,sealDrafts,readDrafts} from '../Web/drafts.js';
globalThis.crypto ||= webcrypto;
const entry=note=>({key:'synthetic:reviewForm',base:'{}',fields:{cookNotes:note,editTest:true}});
test('private drafts reopen Unicode, blanks and checkbox values with checksum integrity',async()=>{
 const values=[entry('Draft 🍖'),{key:'new:new',base:'new',fields:{food:'',cooker:'Traeger Pro 780'}}];const bytes=await sealDrafts(values);assert.deepEqual((await readDrafts([bytes])).entries,values);assert.deepEqual((await readDrafts([])).entries,[]);
});
test('damaged latest draft uses a valid earlier copy; all damaged copies are rejected without mutation',async()=>{
 const previous=await sealDrafts([entry('Previous')]),current=JSON.parse(await sealDrafts([entry('Current')]));current.payload+=' ';const bad=JSON.stringify(current);const input=[bad,previous];assert.equal((await readDrafts(input)).recovered,true);assert.equal((await readDrafts(input)).entries[0].fields.cookNotes,'Previous');assert.deepEqual(input,[bad,previous]);await assert.rejects(readDrafts([bad]));
});
test('draft limits and malformed fields cannot be written',async()=>{
 for(const entries of [[entry('x'.repeat(20001))],[{...entry(''),fields:{'../path':'x'}}],[entry(''),entry('')],Array(201).fill(entry(''))])await assert.rejects(sealDrafts(entries));
});
test('draft bases detect saved changes per form without invalidating unrelated notes or storing temperatures',()=>{
 const cook={food:'Ribs',cooker:'Weber',startedAt:'2026-10-13T10:00:00Z',finishedAt:null,phase:'Cooking',events:[],notes:'Saved',temperatures:[{value:200}],cookingDetails:{method:'Smoked'}};
 const changed={...cook,cookingDetails:{method:'Foil boat'},temperatures:[{value:250}]};assert.notEqual(draftBase(cook,'profileForm'),draftBase(changed,'profileForm'));assert.equal(draftBase(cook,'reviewForm'),draftBase(changed,'reviewForm'));assert.equal(draftBase(cook,'new'),'new');assert.equal(draftBase(null,'event'),null);assert.ok(!draftBase(cook,'profileForm').includes('temperatures'));
});
