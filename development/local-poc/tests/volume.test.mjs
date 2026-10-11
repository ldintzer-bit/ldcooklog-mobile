import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, createHash } from 'node:crypto';
import { REQUIRED_TABLES, RELATIONAL_FORMAT, RELATIONAL_VERSION, migrateRelationalExport } from '../migration.js';
globalThis.crypto ||= webcrypto;

// Entirely artificial data: protects the user's private backup from test exposure.
test('30 linked cooks and 18,000 temperature readings survive migration with exact counts', async () => {
  const tables = Object.fromEntries(REQUIRED_TABLES.map(name => [name, { columns:['id','cook_id'], rows:[] }]));
  tables.cooks = { columns:['id','cook_id','food','start_time','finish_time','notes'], rows:[] };
  tables.events = { columns:['id','cook_id','event_type','event_time','note'], rows:[] };
  tables.cook_fireboard_sessions = { columns:['id','cook_id'], rows:[] };
  tables.fireboard_temperature_samples = {
    columns:['id','cook_fireboard_session_id','temperature_value','observed_at','degree_type','channel_index','channel_label'], rows:[]
  };
  for (let c = 0; c < 30; c++) {
    const id = `cook-${c}`;
    tables.cooks.rows.push({ id, cook_id:`20261011-${String(c+1).padStart(3,'0')}`, food:'Synthetic test cook', start_time:'2026-10-11 00:00:00+00', finish_time:null, notes: c===0 ? '[TEST COOK: EXCLUDE FROM ANALYSIS]' : '' });
    tables.events.rows.push({ id:`event-${c}`, cook_id:id, event_type:'Meat On', event_time:'2026-10-11 00:00:00+00', note:'' });
    tables.cook_fireboard_sessions.rows.push({id:`session-${c}`, cook_id:id});
    for (let t=0;t<600;t++) tables.fireboard_temperature_samples.rows.push({
      id:`sample-${c}-${t}`, cook_fireboard_session_id:`session-${c}`, temperature_value:'225.5',
      observed_at: new Date(Date.UTC(2026,9,11,0,0,t)).toISOString(), degree_type:'2', channel_index:'1', channel_label:'Pit'
    });
  }
  const body = { format:RELATIONAL_FORMAT, version:RELATIONAL_VERSION, createdAt:'2026-10-11T12:00:00Z', tables:Object.fromEntries(Object.keys(tables).sort().map(name=>[name,tables[name]])) };
  const payload = {...body,sha256:createHash('sha256').update(JSON.stringify(body)).digest('hex')};
  const result = await migrateRelationalExport(payload);
  assert.equal(result.cooks.length,30);
  assert.equal(result.audit.cooks,30);
  assert.equal(result.audit.events,30);
  assert.equal(result.audit.linkedFireboardSessions,30);
  assert.equal(result.audit.temperatureSamples,18000);
  assert.equal(result.cooks.reduce((sum,cook)=>sum+cook.temperatures.length,0),18000);
  assert.equal(result.cooks.filter(cook=>cook.isTestCook).length,1);
  assert.equal(Object.keys(result.tables).length,18);
});
