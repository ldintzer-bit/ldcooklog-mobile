import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto, createHash} from 'node:crypto';
import {RELATIONAL_FORMAT, RELATIONAL_VERSION, REQUIRED_TABLES, migrateRelationalExport, verifyRelationalExport, buildLocalCooks, auditRelationalLinks} from '../migration.js';
globalThis.crypto ||= webcrypto;

const emptyTables = () => Object.fromEntries([...REQUIRED_TABLES].sort().map(name => [name, { columns:['id','cook_id'], rows:[] }]));
async function archive(tables) {
  const body = {format:RELATIONAL_FORMAT,version:RELATIONAL_VERSION,createdAt:'2026-10-11T16:00:00Z',tables:Object.fromEntries(Object.keys(tables).sort().map(name=>[name,tables[name]]))};
  return {...body,sha256:createHash('sha256').update(JSON.stringify(body)).digest('hex')};
}
const row = (columns, record) => Object.fromEntries(columns.map(c=>[c,record[c]??null]));
function fullFixture() {
  const t=emptyTables();
  t.cooks={columns:['id','cook_id','food','start_time','finish_time','notes','created_at','location_id','cook_method_id'], rows:[
    row(['id','cook_id','food','start_time','finish_time','notes','created_at','location_id','cook_method_id'],{id:'uuid-real',cook_id:'20260902-001',food:'Brisket',start_time:'2026-09-02 04:00:00+00',notes:'Smoker: Traeger Ironwood 885',created_at:'2026-09-02 04:00:00+00'}),
    row(['id','cook_id','food','start_time','finish_time','notes','created_at','location_id','cook_method_id'],{id:'uuid-test',cook_id:'20260903-001',food:'Test',start_time:'2026-09-03 05:00:00+00',notes:'[TEST COOK: EXCLUDE FROM ANALYSIS]',created_at:'2026-09-03 05:00:00+00'})
  ]};
  t.events={columns:['id','cook_id','event_type','event_time','note'],rows:[{id:'event-a',cook_id:'uuid-real',event_type:'Meat On',event_time:'2026-09-02 04:03:00+00',note:'Initial'}]};
  t.cook_fireboard_sessions={columns:['id','cook_id'],rows:[{id:'linked-session',cook_id:'uuid-real'}]};
  t.fireboard_temperature_samples={columns:['id','cook_fireboard_session_id','temperature_value','observed_at','degree_type','channel_index','channel_label'],rows:[{id:'sample1',cook_fireboard_session_id:'linked-session',temperature_value:'220.5',observed_at:'2026-09-02 04:04:00+00',degree_type:'2',channel_index:'1',channel_label:'Pit'}]};
  return t;
}

test('relational migration preserves real AND test cooks, events and probe readings', async()=>{
  const payload=await archive(fullFixture());
  const {cooks,tables}=await migrateRelationalExport(payload);
  assert.equal(cooks.length,2);
  assert.equal(tables.cooks,2);
  assert.equal(cooks[0].food,'Brisket');
  assert.equal(cooks[0].cooker,'Traeger Ironwood 885');
  assert.equal(cooks[0].events[0].type,'Meat On');
  assert.deepEqual(cooks[0].temperatures.map(t=>[t.value,t.unit,t.channel]),[[220.5,'F','Pit']]);
  assert.equal(cooks[0].legacy.related.fireboard_temperature_samples.length,1);
  assert.equal(cooks[1].isTestCook,true);
  assert.equal(cooks[1].events.length,0);
});
test('checksum mismatch or a missing table blocks migration',async()=>{
  const payload=await archive(fullFixture());
  payload.tables.cooks.rows[0].food='Forged';
  await assert.rejects(()=>verifyRelationalExport(payload),/checksum/);
  const invalid=fullFixture(); delete invalid.events;
  const missingArchive = await archive(invalid);
  await assert.rejects(()=>verifyRelationalExport(missingArchive),/Missing events/);
});
test('invalid raw event timestamp aborts migration rather than dropping data',async()=>{
  const t=fullFixture();t.events.rows[0].event_time='NOT A DATE';
  assert.throws(()=>buildLocalCooks(t),/event time/);
});


test('rejects orphaned events instead of silently losing them', async () => {
  const tables = fullFixture();
  tables.events.rows.push({ id:'orphan-event', cook_id:'deleted-cook', event_type:'Meat On', event_time:'2026-09-02 05:00:00+00', note:'' });
  await assert.rejects(async () => migrateRelationalExport(await archive(tables)), /orphaned source records/);
});

test('rejects FireBoard samples with no matching linked session', async () => {
  const tables = fullFixture();
  tables.fireboard_temperature_samples.rows.push({
    id:'orphan-sample', cook_fireboard_session_id:'missing-session', temperature_value:'220',
    observed_at:'2026-09-02 05:00:00+00', degree_type:'2', channel_index:'1', channel_label:'Pit'
  });
  await assert.rejects(async () => migrateRelationalExport(await archive(tables)), /fireboard_temperature_samples: 1/);
});

test('accepts valid relational relationships with full row accounting', async () => {
  const tables = fullFixture();
  const summary = auditRelationalLinks(tables);
  assert.equal(summary.cooks, 2);
  assert.equal(summary.events, 1);
  assert.equal(summary.temperatureSamples, 1);
  const output = await migrateRelationalExport(await archive(tables));
  assert.deepEqual(output.audit, summary);
});

test('rejects duplicate source cook identifiers', async () => {
  const tables = fullFixture();
  tables.cooks.rows[1].id = 'uuid-real';
  await assert.rejects(async () => migrateRelationalExport(await archive(tables)), /Duplicate or missing cook UUID/);
});
