import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { CookStore, seal, unseal, emptyState } from '../Web/recovery.js';
globalThis.crypto ||= webcrypto;
function disk() {
  return { current: null, snapshots: [], fail: false,
    async read() { return this.current; },
    async commit(text, expected) {
      if (this.fail) throw Error('Disk full');
      await unseal(JSON.parse(text));
      const revision = this.current ? JSON.parse(JSON.parse(this.current).payload).revision : 0;
      if (revision !== expected) throw Error('Concurrent change');
      this.snapshots.push(text); this.current = text;
    } };
}
test('every cook/event save has a recoverable full snapshot; reopening retains lifecycle', async () => {
  const adapter = disk(), store = new CookStore(adapter);
  await store.add('Synthetic ribs', 'Weber');
  const id = (await store.read()).state.records[0].id;
  await store.event(id, 'Meat On'); await store.event(id, 'Rest Start'); await store.event(id, 'Keep Warm'); await store.event(id, 'Cook Finished');
  const reopened = await new CookStore(adapter).read();
  assert.equal(reopened.state.records[0].phase, 'Finished');
  assert.equal(adapter.snapshots.length, 5);
  assert.equal(reopened.state.records[0].events.length, 4);
  await assert.rejects(store.event(id, 'Cook Finished'), /finished/);
});
test('queued double taps do not duplicate phase transitions; failed write can retry', async () => {
  const adapter = disk(), store = new CookStore(adapter); await store.add('Test', 'Weber');
  const id = (await store.read()).state.records[0].id;
  const results = await Promise.allSettled([store.event(id, 'Meat On'), store.event(id, 'Meat On')]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  adapter.fail = true;
  await assert.rejects(store.event(id, 'Wrapped'), /Disk full/);
  assert.equal((await store.read()).state.records[0].events.length, 1);
  adapter.fail = false; await store.event(id, 'Wrapped');
  assert.equal((await store.read()).state.records[0].events.length, 2);
});
test('stale writers cannot overwrite a newer cook', async () => {
  const adapter = disk(), a = new CookStore(adapter), b = new CookStore(adapter);
  const results = await Promise.allSettled([a.add('A', 'Weber'), b.add('B', 'Traeger')]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal((await a.read()).state.records.length, 1);
});
test('corruption rejected before restore and a fresh device recovers exact history', async () => {
  const a = disk(), store = new CookStore(a); await store.add('Synthetic', 'Traeger');
  const original = JSON.parse(a.current), bad = {...original, payload: original.payload+' '};
  const b = disk(), second = new CookStore(b);
  await assert.rejects(second.restore(bad), /Damaged/);
  assert.equal(b.current, null);
  await second.restore(original);
  assert.deepEqual((await second.read()).state, (await store.read()).state);
  await second.add('Another', 'Weber');
  await second.restore(original);
  assert.equal(b.snapshots.length, 3); // pre-restore state remains independently recoverable
  assert.equal((await second.read()).state.records.length, 1);
});
test('payload digest survives Unicode without JSON recanonicalization', async () => {
  const state = emptyState(); state.extra = 'café 🍖 日本語';
  assert.deepEqual((await unseal(await seal(state, 1))).state, state);
});
