import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto, createHash} from 'node:crypto';
import {REQUIRED_TABLES, RELATIONAL_FORMAT} from '../Web/migration.js';
import {importArchive, emptyState, seal, unseal} from '../Web/recovery.js';
import {seriesKey,comparisonSeries} from '../Web/fireboard.js';
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
test('migrated probes with the same label preserve distinct device identities', async () => {
  const source=archive();
  source.tables.cook_fireboard_sessions={columns:['id','cook_id'],rows:[{id:'session',cook_id:'synthetic'}]};
  source.tables.fireboard_temperature_samples={columns:['id','cook_fireboard_session_id','temperature_value','observed_at','degree_type','channel_label','channel_index','device_uuid'],rows:['a','b'].map(device=>({id:device,cook_fireboard_session_id:'session',temperature_value:'225',observed_at:'2026-10-11T00:00:00Z',degree_type:'2',channel_label:'Pit',channel_index:'1',device_uuid:device}))};
  const body={format:source.format,version:source.version,createdAt:source.createdAt,tables:source.tables};
  source.sha256=createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const result=await importArchive(emptyState(),source),cook=result.state.records[0];
  assert.notEqual(seriesKey(cook.temperatures[0]),seriesKey(cook.temperatures[1]));
  assert.equal(comparisonSeries(cook,seriesKey(cook.temperatures[0])).length,1);
});
