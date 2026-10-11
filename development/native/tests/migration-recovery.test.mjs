import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto, createHash} from 'node:crypto';
import {REQUIRED_TABLES, RELATIONAL_FORMAT} from '../Web/migration.js';
import {importArchive, emptyState, seal, unseal} from '../Web/recovery.js';
globalThis.crypto ||= webcrypto;
function archive() {
  const tables = Object.fromEntries(REQUIRED_TABLES.map(name => [name, {columns:['id'], rows:[]}]));
  tables.cooks = {columns:['id','food','start_time','finish_time','notes'], rows:[{id:'synthetic',food:'Test',start_time:'2026-10-11T00:00:00Z',finish_time:null,notes:''}]};
  tables.equipment.rows.push({id:'unused-global-equipment'});
  tables.fireboard_account_access.rows.push({id:'synthetic-configuration'});
  tables.weather.rows.push({id:'unlinked-weather'});
  tables.future_table = {columns:['id','value'],rows:[{id:'unknown-but-preserved',value:'café 🍖'}]};
  const body = {format:RELATIONAL_FORMAT,version:1,createdAt:'2026-10-11T00:00:00Z',tables:Object.fromEntries(Object.entries(tables).sort(([a],[b])=>a.localeCompare(b)))};
  return {...body,sha256:createHash('sha256').update(JSON.stringify(body)).digest('hex')};
}
test('every global and unknown source table survives migration, snapshot and second-device recovery', async () => {
  const source = archive(), result = await importArchive(emptyState(),source);
  assert.equal(result.state.records.length,1);
  assert.equal(Object.keys(result.counts).length,19);
  const restored = await unseal(await seal(result.state,1));
  assert.deepEqual(restored.state.relationalArchives[0],source);
  assert.equal(restored.state.relationalArchives[0].tables.equipment.rows[0].id,'unused-global-equipment');
  const again = await importArchive(restored.state, source);
  assert.equal(again.state.records.length,1);
  assert.equal(again.state.relationalArchives.length,1);
});
test('conflicting reimport and missing migrated records are refused', async () => {
  const source = archive(), first = await importArchive(emptyState(),source);
  first.state.records[0].food = 'Edited test';
  await assert.rejects(importArchive(first.state,source), /conflict/);
  await assert.rejects(seal({records:[],relationalArchives:[source]},1),/omits/);
});
