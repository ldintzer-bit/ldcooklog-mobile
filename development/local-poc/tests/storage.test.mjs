import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
globalThis.crypto ||= webcrypto;
const tables = new Map();
class MemoryTx {
  constructor() { this.pending=0; this.finished=false; this.aborted=false; this.drafts=new Map(tables); this.completionTimer=null; }
  objectStore() { return new MemoryStore(this); }
  request(fn) {
    if (this.aborted || this.finished) throw Error('Inactive transaction');
    const req = {};
    this.pending++;
    queueMicrotask(() => {
      if (this.aborted) return;
      try { req.result=fn(); req.onsuccess?.(); } catch(err) { req.error=err;req.onerror?.();this.abort(err); }
      this.pending--;
      clearTimeout(this.completionTimer);
      this.completionTimer=setTimeout(()=>{
        if(this.pending===0 && !this.aborted && !this.finished){this.finished=true; tables.clear(); for(const [k,v] of this.drafts)tables.set(k,structuredClone(v));this.oncomplete?.();}
      },0);
    });
    return req;
  }
  abort(err=Error('Aborted')) { if(this.aborted)return;this.aborted=true;clearTimeout(this.completionTimer);queueMicrotask(()=>{this.error=err;this.onabort?.();}); }
}
class MemoryStore {
 constructor(tx){this.tx=tx;}
 add(record) {return this.tx.request(()=>{if(this.tx.drafts.has(record.id))throw Error('Duplicate');this.tx.drafts.set(record.id,structuredClone(record));return record.id;});}
 put(record) {return this.tx.request(()=>{this.tx.drafts.set(record.id,structuredClone(record));return record.id;});}
 get(id) {return this.tx.request(()=>structuredClone(this.tx.drafts.get(id)));}
 getAll() {return this.tx.request(()=>[...this.tx.drafts.values()].map(x=>structuredClone(x)));}
}
const database = {objectStoreNames:{contains:()=>true},transaction:()=>new MemoryTx(),close(){}};
globalThis.indexedDB={open:()=>{const req={};queueMicrotask(()=>{req.result=database;req.onsuccess?.();});return req;}};
const {addCook,appendEvent,listCooks,createBackup,restoreBackup,makeCook}=await import('../db.js');
test('IndexedDB adapter round trip, backup, conflict refusal, restore',async()=>{
  const first=makeCook('Brisket','Weber');await addCook(first);
  await appendEvent(first.id,{at:'2026-10-11T09:00:00Z',type:'Meat On',note:'First event'});
  assert.equal((await listCooks())[0].events.length,1);
  const backup=await createBackup();assert.equal(backup.count,1);
  assert.deepEqual(await restoreBackup(backup),{added:0,unchanged:1});
  const other=makeCook('Ribs','Traeger');
  const {createBackupForRecords}=await import('../backup.js');
  const combined=await createBackupForRecords([...(await listCooks()),other]);
  assert.deepEqual(await restoreBackup(combined),{added:1,unchanged:1});
  assert.equal((await listCooks()).length,2);
  const conflict=structuredClone(other);conflict.food='Different';
  const malicious=await createBackupForRecords([conflict]);
  await assert.rejects(()=>restoreBackup(malicious),/conflict/);
  assert.equal((await listCooks()).find(c=>c.id===other.id).food,'Ribs');
  assert.equal((await listCooks()).length,2);
  await assert.rejects(()=>addCook(other),/Duplicate/);
});
