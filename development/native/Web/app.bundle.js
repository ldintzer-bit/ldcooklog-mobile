'use strict';
(() => {

/* Pure, independently testable backup and restore planning. */
const BACKUP_FORMAT = 'ldcooklog-local-backup';
const BACKUP_VERSION = 1;

function validateWrap(value){
  if(!value || !['Foil','Butcher Paper','Foil Boat','Other'].includes(value.wrapMethod) || typeof value.wrapDetail!=='string' || value.wrapDetail.length>300 || (value.wrapMethod==='Other' && !value.wrapDetail.trim()))throw Error('Select a wrap method; describe Other in 300 characters or fewer');
  return value;
}
function validateTargets(value){
  if(!value || typeof value!=='object' || value.unit!=='F')throw Error('Invalid temperature targets');
  for(const key of ['pitF','meatF'])if(value[key]!==null && (!Number.isFinite(value[key]) || value[key]<0 || value[key]>1000))throw Error('Targets must be between 0 and 1000°F, or blank');
  return value;
}
function validateFireboardSetup(value) {
  if(value===null)return value;
  if(!value || typeof value!=='object' || Array.isArray(value) || ![1,2].includes(value.version) || value.model!=='FireBoard 2')throw Error('Invalid FireBoard setup');
  for(const [key,limit] of [['deviceName',160],['accessories',1000]])if(typeof value[key]!=='string' || value[key].length>limit)throw Error('Invalid FireBoard '+key);
  if(!Array.isArray(value.channels) || (value.version===1?value.channels.length!==6:value.channels.length>32))throw Error('Invalid FireBoard setup entry count');
  const seen=new Set();
  for(const probe of value.channels){
    if(!probe || !Number.isInteger(probe.channel) || probe.channel<1 || probe.channel>(value.version===1?6:32) || seen.has(probe.channel))throw Error('Invalid or duplicate FireBoard channel');
    seen.add(probe.channel);
    if(!['Not used','Pit / ambient','Meat','Other'].includes(probe.role) || !['Not recorded','Wired','Wireless','Other','Wired ambient probe','Wired food probe'].includes(probe.probeType))throw Error('Invalid FireBoard probe choice');
    if(probe.seriesKey!==undefined && (typeof probe.seriesKey!=='string' || probe.seriesKey.length>2000))throw Error('Invalid FireBoard reading link');
    if(probe.wiredPort!==undefined && probe.wiredPort!==null && (!Number.isInteger(probe.wiredPort) || probe.wiredPort<1 || probe.wiredPort>6))throw Error('Invalid FireBoard wired port');
    if(probe.color!==undefined && !['Not recorded','Orange','Silver','Other'].includes(probe.color))throw Error('Invalid FireBoard probe color');
    if(probe.customColor!==undefined && (typeof probe.customColor!=='string' || probe.customColor.length>100))throw Error('Invalid FireBoard custom color');
    if(probe.measurement!==undefined && !['Not recorded','Internal / meat','External / ambient'].includes(probe.measurement))throw Error('Invalid FireBoard wireless reading');
    for(const [key,limit] of [['label',250],['placement',500]])if(typeof probe[key]!=='string' || probe[key].length>limit)throw Error('Invalid FireBoard probe '+key);
  }
  return value;
}

function validateCook(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c) || typeof c.id !== 'string' || !c.id.trim() || c.id.length > 160) throw Error('Invalid cook identifier');
  if (typeof c.food !== 'string' || c.food.length > 300 || typeof c.cooker !== 'string' || c.cooker.length > 300) throw Error('Invalid cook labels');
  if (typeof c.startedAt !== 'string' || !Number.isFinite(Date.parse(c.startedAt))) throw Error('Invalid cook start time');
  if (c.finishedAt !== null && c.finishedAt !== undefined && (typeof c.finishedAt !== 'string' || !Number.isFinite(Date.parse(c.finishedAt)))) throw Error('Invalid finish time');
  if (!Array.isArray(c.events) || c.events.length > 200000 || !Array.isArray(c.temperatures) || c.temperatures.length > 500000) throw Error('Invalid cook series');
  if (!c.events.every(e => e && typeof e.type === 'string' && typeof e.at === 'string' && Number.isFinite(Date.parse(e.at)) && typeof e.note === 'string')) throw Error('Invalid cook events');
  if (!c.temperatures.every(t => t && typeof t.at === 'string' && Number.isFinite(Date.parse(t.at)) && Number.isFinite(t.value) && typeof t.channel === 'string')) throw Error('Invalid temperature samples');
  if(c.cookingDetails?.fireboardSetup!==undefined)validateFireboardSetup(c.cookingDetails.fireboardSetup);
  if(c.targets!==undefined)validateTargets(c.targets);
  for(const event of c.events){if(event.wrapMethod!==undefined)validateWrap(event);if(event.targets!==undefined)validateTargets(event.targets);if(event.previousTargets!==undefined)validateTargets(event.previousTargets);}
  const bindings=(c.cookingDetails?.fireboardSetup?.channels || []).filter(p=>p.seriesKey);
  const readings=bindings.length?new Set(c.temperatures.map(t=>seriesKey(t))):new Set(),linked=new Set();
  for(const probe of bindings){
    if(probe.seriesKey){if(!readings.has(probe.seriesKey))throw Error('FireBoard link does not match an imported reading');
      if(probe.role!=='Not used'){if(linked.has(probe.seriesKey))throw Error('An imported reading is assigned to more than one active probe');linked.add(probe.seriesKey);}}
  }
  return c;
}
async function sha256(s) {
  const bytes = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
}
function backupBody(records, createdAt) {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt, count: records.length, records };
}
async function createBackupForRecords(records, createdAt = new Date().toISOString()) {
  const sorted = [...records].sort((a, b) => a.id.localeCompare(b.id));
  for (const record of sorted) validateCook(record);
  const body = backupBody(sorted, createdAt);
  return { ...body, sha256: await sha256(JSON.stringify(body)) };
}
async function verifyBackup(backup) {
  if (!backup || backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION || !Array.isArray(backup.records) || !Number.isSafeInteger(backup.count) || backup.count !== backup.records.length || typeof backup.createdAt !== 'string' || !Number.isFinite(Date.parse(backup.createdAt)) || typeof backup.sha256 !== 'string') throw Error('Unrecognized or damaged backup format');
  if (backup.records.length > 100000) throw Error('Backup contains too many records');
  const seen = new Set();
  for (const row of backup.records) {
    validateCook(row);
    if (seen.has(row.id)) throw Error('Backup contains duplicate cook IDs');
    seen.add(row.id);
  }
  if (await sha256(JSON.stringify(backupBody(backup.records, backup.createdAt))) !== backup.sha256) throw Error('Backup checksum does not match; file may be altered or incomplete');
  return backup.records;
}
function planRestore(existing, incoming) {
  const present = new Map(existing.map(c => [c.id, c]));
  const conflicts = incoming.filter(c => present.has(c.id) && JSON.stringify(present.get(c.id)) !== JSON.stringify(c));
  if (conflicts.length) throw Error(`${conflicts.length} cook ID conflict(s). No records imported. Preserve both copies and investigate.`);
  const additions = incoming.filter(c => !present.has(c.id));
  return { additions, added: additions.length, unchanged: incoming.length - additions.length };
}

/* One-time, local-only Supabase public-table import. Never sends rows to a server. */

const RELATIONAL_FORMAT = 'ldcooklog-supabase-relational-export';
const RELATIONAL_VERSION = 1;
const REQUIRED_TABLES = Object.freeze('cooks events cook_equipment cook_evaluations cook_fireboard_sessions cook_meat_pieces cook_methods cook_preparation cook_rubs cook_sauces equipment fireboard_account_access fireboard_probe_roles fireboard_temperature_samples locations rubs sauces weather'.split(' '));

async function hash(body) {
  const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body)));
  return [...new Uint8Array(hashBytes)].map(n => n.toString(16).padStart(2, '0')).join('');
}
async function verifyRelationalExport(value) {
  if (!value || value.format !== RELATIONAL_FORMAT || value.version !== RELATIONAL_VERSION || !value.tables || Array.isArray(value.tables) || typeof value.createdAt !== 'string' || typeof value.sha256 !== 'string') throw Error('Not a supported relational archive');
  const tables = value.tables;
  for (const required of REQUIRED_TABLES) if (!Object.hasOwn(tables, required)) throw Error(`Missing ${required} table`);
  const orderedTables = {};
  let total = 0;
  for (const table of Object.keys(tables).sort()) {
    if (!/^[a-z][a-z0-9_]*$/.test(table)) throw Error('Unsafe table name');
    const {columns, rows} = tables[table] || {};
    if (!Array.isArray(columns) || !columns.length || !columns.every(col => typeof col === 'string' && /^[a-z][a-z0-9_]*$/.test(col)) || new Set(columns).size !== columns.length || !Array.isArray(rows)) throw Error(`Invalid ${table} table`);
    total += rows.length;
    if (total > 1200000) throw Error('Archive exceeds safe record limit');
    for (const row of rows) {
      if (!row || Array.isArray(row) || typeof row !== 'object' || Object.keys(row).length !== columns.length || !columns.every(col => Object.hasOwn(row,col) && (row[col] === null || typeof row[col] === 'string'))) throw Error(`Invalid row in ${table}`);
    }
    orderedTables[table] = tables[table];
  }
  const body = {format: RELATIONAL_FORMAT, version: RELATIONAL_VERSION, createdAt: value.createdAt, tables: orderedTables};
  if ((await hash(body)) !== value.sha256) throw Error('Relational archive checksum mismatch');
  return tables;
}
function asISO(input, label) {
  if (typeof input !== 'string' || !input.trim()) throw Error(`Missing ${label}`);
  const normalized = input.trim().replace(/^(\d{4}-\d\d-\d\d) /, '$1T').replace(/([+-]\d\d)$/, '$1:00');
  const ms = Date.parse(normalized);
  if (!Number.isFinite(ms)) throw Error(`Invalid ${label}: ${input.slice(0, 40)}`);
  return new Date(ms).toISOString();
}
/**
 * Check referential completeness BEFORE constructing individual cook records.
 * Never silently omit an orphan event, meat piece, linked FireBoard session,
 * or temperature sample. The source .dump remains intact if a check fails.
 * Some legacy tables are global lookup/configuration tables, not cook children.
 */
function auditRelationalLinks(tables) {
  const cookIds = new Set(tables.cooks.rows.map(row => row.id));
  if (cookIds.size !== tables.cooks.rows.length || cookIds.has(null) || cookIds.has('') || cookIds.has(undefined))
    throw Error('Duplicate or missing cook UUID in source archive');
  const childNames = [
    'events', 'cook_equipment', 'cook_evaluations', 'cook_fireboard_sessions',
    'cook_meat_pieces', 'cook_preparation', 'cook_rubs', 'cook_sauces',
    'fireboard_probe_roles'
  ];
  const orphanCounts = [];
  for (const name of childNames) {
    const table = tables[name];
    // Some installations contain non-per-cook weather records. Check only
    // tables that actually declare the cook_id relationship.
    if (!table.columns.includes('cook_id')) continue;
    const orphans = table.rows.filter(row => !row.cook_id || !cookIds.has(row.cook_id));
    if (orphans.length) orphanCounts.push(`${name}: ${orphans.length}`);
  }
  const sessionIds = new Set(tables.cook_fireboard_sessions.rows.map(row => row.id));
  const sampleTable = tables.fireboard_temperature_samples;
  if (sampleTable.rows.length && !sampleTable.columns.includes('cook_fireboard_session_id'))
    throw Error('FireBoard temperature samples lack their session link column');
  const lostSamples = sampleTable.rows.filter(row => !row.cook_fireboard_session_id || !sessionIds.has(row.cook_fireboard_session_id));
  if (lostSamples.length) orphanCounts.push(`fireboard_temperature_samples: ${lostSamples.length}`);
  if (orphanCounts.length)
    throw Error(`Migration stopped: orphaned source records would be omitted (${orphanCounts.join(', ')}). Keep the original dump; inspect the relationships.`);
  return {
    cooks: tables.cooks.rows.length,
    events: tables.events.rows.length,
    linkedFireboardSessions: tables.cook_fireboard_sessions.rows.length,
    temperatureSamples: sampleTable.rows.length,
    checkedCookTables: childNames.filter(name => tables[name].columns.includes('cook_id'))
  };
}

function matchRows(tables, table, field, id) { return tables[table].rows.filter(row => row[field] === id); }
function relationLookups(tables, cook, byTable) {
  const matchId = (name, id) => id ? tables[name].rows.filter(row => row.id === id) : [];
  const links = byTable;
  return {
    locations: matchId('locations', cook.location_id),
    cook_methods: matchId('cook_methods', cook.cook_method_id),
    equipment: [...new Set(links.cook_equipment.map(x => x.equipment_id).filter(Boolean))].flatMap(id => matchId('equipment', id)),
    rubs: [...new Set(links.cook_rubs.map(x => x.rub_id).filter(Boolean))].flatMap(id => matchId('rubs', id)),
    sauces: [...new Set(links.cook_sauces.map(x => x.sauce_id).filter(Boolean))].flatMap(id => matchId('sauces', id)),
  };
}
function buildLocalCooks(tables) {
  // Do not silently hide/delete test cooks; preserve all 30, including testing history.
  const collection = [];
  const seen = new Set();
  for (const row of tables.cooks.rows) {
    const uuid = row.id;
    if (!uuid || seen.has(uuid)) throw Error('Missing or duplicate database cook UUID');
    seen.add(uuid);
    const related = {};
    for (const table of ['events','cook_equipment','cook_evaluations','cook_fireboard_sessions','cook_meat_pieces','cook_preparation','cook_rubs','cook_sauces','fireboard_probe_roles','weather']) {
      related[table] = matchRows(tables, table, 'cook_id', uuid);
    }
    const sessions = new Set(related.cook_fireboard_sessions.map(x => x.id));
    related.fireboard_temperature_samples = tables.fireboard_temperature_samples.rows.filter(x => sessions.has(x.cook_fireboard_session_id));
    const events = related.events.map(e => ({
      at: asISO(e.event_time, 'event time'),
      type: e.event_type || 'Event', note: e.note || '',
      legacyId: e.id || null,
    })).sort((a,b)=>a.at.localeCompare(b.at));
    const temperatures = related.fireboard_temperature_samples.map(t => {
      const value = Number(t.temperature_value);
      if (!Number.isFinite(value) || t.temperature_value === null) throw Error(`Invalid temperature in sample ${t.id || '(unknown)'}`);
      return {at:asISO(t.observed_at, 'sample time'), value, channel:t.channel_label || `Channel ${t.channel_index || '?'}`,
        unit: t.degree_type === '1' || t.degree_type === 'C' ? 'C' : t.degree_type === '2' || t.degree_type === 'F' ? 'F' : 'unknown',
        legacyId: t.id || null, sessionId:t.cook_fireboard_session_id,
        deviceUUID:t.device_uuid || null, channelId:String(t.channel_index || t.channel_id || '?')};
    }).sort((a,b)=>a.at.localeCompare(b.at));
    const cookerFromNotes = String(row.notes || '').match(/Smoker: (Traeger Ironwood 885|Traeger Pro|Weber 22" Kettle)/);
    const cook = {
      id: uuid,
      food: row.food || row.cook_id || 'Unnamed cook',
      cooker: row.smoker || row.cooker || cookerFromNotes?.[1] || 'Not recorded',
      startedAt: asISO(row.start_time || row.created_at, 'cook start time'),
      finishedAt: row.finish_time ? asISO(row.finish_time, 'finish time') : null,
      phase: row.finish_time || row.phase === 'Finished' ? 'Finished' : ({Setup:'Preparation',Cooking:'Cooking',Rest:'Resting','Keep Warm':'Keeping Warm'}[row.phase] || 'Cooking'),
      events,
      temperatures,
      notes: row.notes || '',
      source: 'Supabase historical migration',
      isTestCook: /\[TEST COOK: EXCLUDE FROM ANALYSIS\]/.test(row.notes || ''),
      legacy: { cook: row, related, lookups: relationLookups(tables,row,related) }
    };
    validateCook(cook);
    collection.push(cook);
  }
  return collection;
}
async function migrateRelationalExport(exported) {
  const tables = await verifyRelationalExport(exported);
  const audit = auditRelationalLinks(tables);
  const cooks = buildLocalCooks(tables);
  if (cooks.reduce((sum, cook) => sum + cook.events.length, 0) !== audit.events ||
      cooks.reduce((sum, cook) => sum + cook.temperatures.length, 0) !== audit.temperatureSamples)
    throw Error('Migration stopped: event or FireBoard sample count changed during conversion.');
  return { cooks, audit, tables: Object.fromEntries(Object.entries(tables).map(([name,value])=>[name,value.rows.length])) };
}

// Offline import of completed sessions exported by the local Mac helper.
// Keep original session and complete chart beside normalized samples.
function completedSession(value, now = Date.now()) {
  if (value?.format !== 'ldcooklog-fireboard-completed' || value.version !== 1) throw Error('Not a completed FireBoard export');
  const session = value.session;
  if (!session || !/^\d+$/.test(String(session.id)) || !Array.isArray(value.chart)) throw Error('Invalid FireBoard session');
  const start = Date.parse(session.start_time), end = Date.parse(session.end_time);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end > now) throw Error('Choose a completed session with valid start and end times');
  let temperatures = [];
  for (let index=0;index<value.chart.length;index++) {
    const series = value.chart[index];
    if (!Array.isArray(series.x) || !Array.isArray(series.y) || series.x.length !== series.y.length) throw Error('FireBoard series has unmatched times and values');
    const unit = Number(series.degreetype) === 1 ? 'C' : Number(series.degreetype) === 2 ? 'F' : null;
    if (!unit) throw Error('Unknown series units. Export temperature data without Drive percentage data');
    for (let i=0;i<series.x.length;i++) {
      const raw = series.x[i], ms = typeof raw === 'number' ? raw * (Math.abs(raw)<1e12 ? 1000 : 1) : Date.parse(raw);
      const temp = series.y[i];
      if (!Number.isFinite(ms) || typeof temp !== 'number' || !Number.isFinite(temp)) throw Error('Invalid temperature or time; entire session import stopped');
      temperatures.push({at:new Date(ms).toISOString(),value:temp,unit,channel:String(series.label || `Channel ${index+1}`),channelId:String(series.channel_id ?? index),deviceUUID:series.device || null,sessionId:String(session.id)});
      if (temperatures.length>500000) throw Error('Session exceeds supported sample limit');
    }
  }
  temperatures.sort((a,b)=>a.at.localeCompare(b.at));
  return { session, chart:value.chart, temperatures };
}
function attachSession(state, cookId, exported) {
  const cook = state.records.find(c=>c.id===cookId);
  if (!cook) throw Error('Open the cook to receive this session');
  const imported = completedSession(exported);
  const id = String(imported.session.id);
  const prior = (cook.completedSessions || []).find(s=>String(s.session.id)===id);
  if (prior) {
    if (JSON.stringify(prior) !== JSON.stringify({session:imported.session,chart:imported.chart})) throw Error('Conflicting FireBoard session. Original import retained');
    return state;
  }
  if ((cook.legacy?.related?.cook_fireboard_sessions || []).some(s=>String(s.fireboard_session_id)===id)) throw Error('Session already exists in the migrated cook. Inspect before importing again');
  cook.completedSessions ||= [];
  cook.completedSessions.push({session:imported.session,chart:imported.chart});
  cook.temperatures.push(...imported.temperatures);
  return state;
}
// Distinguish devices/sessions and probe identities even if labels repeat.
const seriesKey = sample => JSON.stringify([sample.sessionId || '',sample.deviceUUID || '',sample.channelId || sample.channel,sample.channel]);
function comparisonSeries(cook, key) {
  const samples = cook.temperatures.filter(t=>seriesKey(t)===key);
  if (samples.some(t=>t.unit !== 'C' && t.unit !== 'F')) throw Error('Unknown temperature units; comparison stopped');
  return samples.map(t=>({minutes:(Date.parse(t.at)-Date.parse(cook.startedAt))/60000, fahrenheit:t.unit==='C'?t.value*9/5+32:t.value})).sort((a,b)=>a.minutes-b.minutes);
}





const cookTransitions = { 'Meat On': [['Preparation'], 'Cooking'], 'Rest Start': [['Cooking','Keeping Warm'], 'Resting'], 'Keep Warm': [['Cooking','Resting'], 'Keeping Warm'], 'Cook Finished': [['Cooking','Resting','Keeping Warm'], 'Finished'] };
function lidIsOpen(cook){return (cook.events || []).filter(e=>e.type==='Lid Open' || e.type==='Lid Closed').at(-1)?.type==='Lid Open';}
function availableActions(cook) {
  const phase=cook.phase || (cook.finishedAt?'Finished':'Cooking');
  if(phase==='Finished')return [];
  const steps=Object.keys(cookTransitions).filter(type=>cookTransitions[type][0].includes(phase));
  const allowed=new Set([...steps,...(phase==='Cooking'?['Wrapped','Target Change']:[]),lidIsOpen(cook)?'Lid Closed':'Lid Open','Note']);
  return ['Meat On','Wrapped','Rest Start','Keep Warm','Cook Finished','Lid Open','Lid Closed','Target Change','Note'].filter(type=>allowed.has(type));
}
const FORMAT = 'ldcooklog-recovery';
const emptyState = () => ({ records: [], relationalArchives: [] });
async function digest(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function validateState(state) {
  if (!state || !Array.isArray(state.records) || !Array.isArray(state.relationalArchives)) throw Error('Invalid recovery contents');
  const ids = new Set();
  for (const cook of state.records) {
    validateCook(cook);
    if (ids.has(cook.id)) throw Error('Duplicate cook ID');
    ids.add(cook.id);
  }
  const hashes = new Set();
  for (const archive of state.relationalArchives) {
    await verifyRelationalExport(archive);
    if (hashes.has(archive.sha256)) throw Error('Duplicate source archive');
    hashes.add(archive.sha256);
    if (!archive.tables.cooks.rows.every(row => ids.has(row.id))) throw Error('Recovery omits a migrated cook');
  }
  return state;
}
// Hash the exact UTF-8 payload string; Swift and JavaScript never need to agree
// on JSON object key ordering, number formatting, or Unicode escaping.
async function seal(state, revision) {
  await validateState(state);
  if (!Number.isSafeInteger(revision) || revision < 1) throw Error('Invalid revision');
  const payload = JSON.stringify({ version: 1, revision, createdAt: new Date().toISOString(), state });
  return { format: FORMAT, version: 1, payload, sha256: await digest(payload) };
}
async function unseal(envelope) {
  if (!envelope || envelope.format !== FORMAT || envelope.version !== 1 || typeof envelope.payload !== 'string' || await digest(envelope.payload) !== envelope.sha256) throw Error('Damaged recovery snapshot');
  const body = JSON.parse(envelope.payload);
  if (body.version !== 1 || !Number.isSafeInteger(body.revision) || body.revision < 1 || !Number.isFinite(Date.parse(body.createdAt))) throw Error('Unsupported snapshot');
  await validateState(body.state);
  return body;
}
async function importArchive(state, archive) {
  if (archive.format !== RELATIONAL_FORMAT) throw Error('Choose the .relational.json migration file');
  const migration = await migrateRelationalExport(archive);
  const plan = planRestore(state.records, migration.cooks);
  return { state: { records: [...state.records, ...plan.additions], relationalArchives: state.relationalArchives.some(x => x.sha256 === archive.sha256) ? state.relationalArchives : [...state.relationalArchives, archive] }, audit: migration.audit, counts: migration.tables };
}
class CookStore {
  constructor(adapter) { this.adapter = adapter; this.queue = Promise.resolve(); }
  async read() {
    const text = await this.adapter.read();
    return text ? await unseal(JSON.parse(text)) : { revision: 0, state: emptyState() };
  }
  mutate(change) {
    const next = this.queue.then(async () => {
      const before = await this.read();
      const state = await change(structuredClone(before.state));
      const envelope = await seal(state, before.revision + 1);
      await this.adapter.commit(JSON.stringify(envelope), before.revision);
      return state;
    });
    this.queue = next.catch(() => {});
    return next;
  }
  async migrate(archive) {
    let report;
    await this.mutate(async state => { report = await importArchive(state, archive); return report.state; });
    return report;
  }
  restore(envelope) {
    return this.mutate(async () => structuredClone((await unseal(envelope)).state));
  }
  add(food, cooker) {
    if (!food.trim() || !cooker.trim()) return Promise.reject(Error('Enter food and cooker'));
    return this.mutate(state => {
      state.records.push({ id: crypto.randomUUID(), food: food.trim(), cooker: cooker.trim(), startedAt: new Date().toISOString(), finishedAt: null, phase: 'Preparation', events: [], temperatures: [], notes: '', source: 'LDCookLog 2.0' });
      return state;
    });
  }
  importSession(id, value) { return this.mutate(state => attachSession(state, id, value)); }
  profile(id, value) {
    return this.mutate(state => {
      const cook = state.records.find(c => c.id === id);
      if (!cook) throw Error('Cook not found');
      const limits = {food:300,cooker:300,method:300,weight:100,equipment:1000,preparation:4000,rubs:1000,sauces:1000};
      for (const [key,limit] of Object.entries(limits)) if (typeof value[key] !== 'string' || value[key].length>limit) throw Error('Invalid '+key);
      if (!value.food.trim() || !value.cooker.trim() || typeof value.isTestCook !== 'boolean') throw Error('Enter food, cooker and test status');
      const start = Date.parse(value.startedAt), end = value.finishedAt ? Date.parse(value.finishedAt) : null;
      if (!Number.isFinite(start) || (end!==null && (!Number.isFinite(end) || end<start))) throw Error('Finish must be on or after a valid start time');
      if (value.rating!==null && (!Number.isInteger(value.rating) || value.rating<1 || value.rating>5)) throw Error('Rating must be 1 to 5');
      cook.food=value.food.trim();cook.cooker=value.cooker.trim();cook.startedAt=new Date(start).toISOString();
      cook.finishedAt=end===null?null:new Date(end).toISOString();
      if (end!==null) cook.phase='Finished';
      else if (cook.phase==='Finished') cook.phase='Cooking';
      cook.isTestCook=value.isTestCook;
      cook.cookingDetails={...cook.cookingDetails,...Object.fromEntries(Object.keys(limits).filter(key=>!['food','cooker'].includes(key)).map(key=>[key,value[key]]))};
      cook.cookingDetails.rating=value.rating;
      for(const [key,options] of Object.entries({trim:['','None','Light','Moderate','Heavy'],brineMarinade:['','None','Dry brine','Wet brine','Marinade'],injection:['','No','Yes']})){
        if(value[key]!==undefined){if(!options.includes(value[key]))throw Error('Invalid preparation choice');cook.cookingDetails[key]=value[key]}
      }
      if(value.binder!==undefined){if(typeof value.binder!=='string' || value.binder.length>500)throw Error('Binder is too long');cook.cookingDetails.binder=value.binder}
      if(value.fireboardSetup!==undefined)cook.cookingDetails.fireboardSetup=structuredClone(validateFireboardSetup(value.fireboardSetup));
      // Legacy relational rows and original archives are immutable evidence.
      return state;
    });
  }
  details(id, notes, evaluation, review) {
    return this.mutate(state => {
      const cook = state.records.find(c => c.id === id);
      if (!cook) throw Error('Cook not found');
      if (typeof notes !== 'string' || notes.length > 20000 || typeof evaluation !== 'string' || evaluation.length > 20000) throw Error('Notes are too long');
      cook.notes = notes;
      cook.evaluation = evaluation;
      if(review!==undefined){
        if(!review || typeof review!=='object' || Array.isArray(review))throw Error('Invalid evaluation');
        for(const key of ['overallResult','bark'])if(!['','Excellent','Good','Fair','Poor'].includes(review[key]))throw Error('Invalid evaluation choice');
        if(!['','Tough','Slightly Tough','Just Right','Too Tender'].includes(review.tenderness))throw Error('Invalid tenderness choice');
        for(const key of ['observations','changesNextTime'])if(typeof review[key]!=='string' || review[key].length>20000)throw Error('Evaluation notes are too long');
        cook.evaluationDetails={overallResult:review.overallResult,bark:review.bark,tenderness:review.tenderness,observations:review.observations,changesNextTime:review.changesNextTime};
      }
      return state;
    });
  }
  targets(id,value,note=''){
    validateTargets(value);
    if(typeof note!=='string' || note.length>2000)return Promise.reject(Error('Target note is too long'));
    return this.mutate(state=>{
      const cook=state.records.find(c=>c.id===id);if(!cook)throw Error('Cook not found');
      if(cook.phase==='Finished' || cook.finishedAt)throw Error('This cook is finished');
      const previousTargets=structuredClone(cookTargets(cook));cook.targets=structuredClone(value);
      cook.events.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'Target Change',note,previousTargets,targets:structuredClone(value)});
      return state;
    });
  }
  event(id, type, note = '', detail = null) {
    return this.mutate(state => {
      const cook = state.records.find(c => c.id === id);
      if (!cook) throw Error('Cook not found');
      const phase = cook.phase || (cook.finishedAt ? 'Finished' : 'Cooking');
      if (phase === 'Finished') throw Error('This cook is finished');
      if(type==='Lid Open' && lidIsOpen(cook))throw Error('Lid is already open');
      if(type==='Lid Closed' && !lidIsOpen(cook))throw Error('Lid is already closed');
      if(type==='Wrapped' && phase!=='Cooking')throw Error('Wrapping is available during cooking');
      if(detail!==null){if(type!=='Wrapped')throw Error('Wrap details require a Wrapped event');validateWrap(detail);}
      const transition = cookTransitions[type];
      if (transition && !transition[0].includes(phase)) throw Error(`Cannot ${type.toLowerCase()} during ${phase.toLowerCase()}`);
      const at = new Date().toISOString();
      cook.events.push({ id: crypto.randomUUID(), at, type, note,...(detail?{wrapMethod:detail.wrapMethod,wrapDetail:detail.wrapDetail}: {}) });
      if (transition) cook.phase = transition[1];
      if (type === 'Meat On') cook.startedAt = at;
      if (type === 'Cook Finished') cook.finishedAt = at;
      return state;
    });
  }
}

// Read-only, explicitly selected cooking fields. Account-access rows and raw
// database identifiers are never part of this presentation.
function originalCookingDetails(cook) {
  const legacy=cook.legacy || {}, related=legacy.related || {}, lookups=legacy.lookups || {}, groups=[];
  const fields=(row,labels)=>labels.filter(([key])=>row?.[key]!==null && row?.[key]!==undefined && row?.[key]!=='').map(([key,label])=>({label,value:String(row[key])}));
  function group(title,items){if(items.length)groups.push({title,items})}
  group('Original setup',[
    ...fields(legacy.cook,[['binder','Binder']]),
    ...['locations','cook_methods','equipment'].flatMap(key=>(lookups[key] || []).flatMap(row=>fields(row,[['name',{locations:'Location',cook_methods:'Method / recipe',equipment:'Equipment'}[key]],...(key==='cook_methods'?[['source_reference','Recipe / reference']]:[])])))
  ]);
  for(const row of related.cook_preparation || [])group('Original preparation',fields(row,[['trim_level','Trim'],['brine_marinade','Brine / marinade'],['injection','Injection'],['prep_notes','Preparation notes']]));
  for(const row of [...(related.cook_meat_pieces || [])].sort((a,b)=>a.piece_number-b.piece_number)){
    const items=fields(row,[['meat_cut','Cut'],['bone_status','Bone'],['brand_producer','Brand / producer'],['store_source','Store / source'],['grade_type','Grade'],['meat_note','Notes']]);
    for(const [key,label] of [['package_weight','Package weight'],['cook_weight','Cook weight']])if(row[key]!==null && row[key]!==undefined)items.push({label,value:`${row[key]} ${row.weight_unit || ''}`.trim()});
    for(const [key,label] of [['total_price','Total price'],['price_per_lb','Price per lb']])if(row[key]!==null && row[key]!==undefined)items.push({label,value:String(row[key])});
    group(`Original meat piece ${row.piece_number || ''}`.trim(),items);
  }
  for(const [table,lookup,key,title] of [['cook_rubs','rubs','rub_id','Original rub'],['cook_sauces','sauces','sauce_id','Original sauce']])for(const row of related[table] || []){
    const ref=(lookups[lookup] || []).find(value=>value.id===row[key]);
    group(title,[...fields(ref,[['name','Name']]),...fields(row,[['application_level','Application'],['notes','Notes']])]);
  }
  for(const row of related.cook_evaluations || [])group('Original evaluation',fields(row,[['overall_result','Overall result'],['bark','Bark'],['tenderness','Tenderness'],['observations','Observations'],['changes_next_time','Changes next time']]));
  for(const row of related.weather || [])group('Original weather',fields(row,[['temperature','Temperature'],['temperature_f','Temperature °F'],['conditions','Conditions'],['wind_speed','Wind speed'],['humidity','Humidity'],['notes','Notes']]));
  return groups;
}
function reviewValues(cook) {
  if(cook.evaluationDetails)return cook.evaluationDetails;
  const row=cook.legacy?.related?.cook_evaluations?.[0] || {};
  return {overallResult:row.overall_result || '',bark:row.bark || '',tenderness:row.tenderness || '',observations:row.observations || '',changesNextTime:row.changes_next_time || ''};
}

function setupChoices(state,kind){
  if(!['equipment','rubs','sauces'].includes(kind))throw Error('Unsupported setup library');
  const names=new Map();
  const add=value=>{if(typeof value!=='string')return;const name=value.trim();if(name && name.length<=1000 && !names.has(name.toLocaleLowerCase()))names.set(name.toLocaleLowerCase(),name);};
  for(const archive of state.relationalArchives || [])for(const row of archive.tables?.[kind]?.rows || [])add(row.name);
  for(const cook of state.records || [])if(!cook.isTestCook)for(const name of (typeof cook.cookingDetails?.[kind]==='string'?cook.cookingDetails[kind]:'').split(';'))add(name);
  return [...names.values()].sort((a,b)=>a.localeCompare(b));
}


function cookTargets(cook) {
  if(cook.targets)return cook.targets;
  const old=cook.legacy?.cook?.target_temp;
  const pit=old!==null && old!==undefined && old!==''?Number(old):null;
  return {unit:'F',pitF:Number.isFinite(pit) && pit>=0 && pit<=1000?pit:null,meatF:null};
}
function targetText(value){return `Pit ${value.pitF===null?'not set':value.pitF+'°F'} · Meat ${value.meatF===null?'not set':value.meatF+'°F'}`;}
function elapsedText(ms){if(ms===null)return 'Not recorded';const minutes=Math.floor(Math.max(0,ms)/60000);return `${Math.floor(minutes/60)}h ${minutes%60}m`;}
function cookTimers(cook,now=Date.now()){
  const start=Date.parse(cook.startedAt),finish=cook.finishedAt || (cook.phase==='Finished'?cook.events.filter(e=>e.type==='Cook Finished').map(e=>e.at).sort().at(-1):null);
  if(cook.phase==='Finished' && !finish)return {waiting:false,totalMs:null,phaseMs:null,restMs:null,holdMs:null};
  const end=finish?Date.parse(finish):now;
  if(!Number.isFinite(start) || !Number.isFinite(end) || end<start)return {waiting:true,totalMs:0,phaseMs:null,restMs:0,holdMs:0};
  const phases={'Meat On':'Cooking','Rest Start':'Resting','Keep Warm':'Keeping Warm','Cook Finished':'Finished'};
  let phase=cook.phase==='Preparation'?'Preparation':'Cooking',at=start,rest=0,hold=0,lastTransition=null;
  const events=cook.events.map((event,index)=>({...event,index,time:Date.parse(event.at)})).filter(e=>phases[e.type] && e.time>=start && e.time<=end).sort((a,b)=>a.time-b.time || a.index-b.index);
  const accumulate=to=>{if(phase==='Resting')rest+=to-at;if(phase==='Keeping Warm')hold+=to-at;};
  for(const event of events){accumulate(event.time);phase=phases[event.type];at=event.time;lastTransition=event;}
  accumulate(end);
  const current=cook.phase || (cook.finishedAt?'Finished':'Cooking');
  const known=current===phase && (lastTransition || current==='Cooking' || current==='Preparation');
  return {waiting:false,totalMs:end-start,phaseMs:current==='Finished' || !known?null:end-at,restMs:rest,holdMs:hold};
}
function assignedProbeLabel(cook,sample){
  const key=seriesKey(sample);
  const assignment=cook.cookingDetails?.fireboardSetup?.channels.find(p=>p.role!=='Not used' && p.seriesKey===key);
  if(!assignment)return sample.channel;
  const parts=[assignment.label || sample.channel];
  if(assignment.probeType==='Wireless' && assignment.color && assignment.color!=='Not recorded')parts.push(assignment.color==='Other'?assignment.customColor || 'Other':assignment.color);
  if(assignment.measurement && assignment.measurement!=='Not recorded')parts.push(assignment.measurement);
  return parts.join(' · ');
}






const $ = id => document.getElementById(id);
const call = (operation, args = {}) => (window.ldcooklogHost || window.webkit.messageHandlers.recovery).postMessage({operation, ...args});
const store = new CookStore({ read: () => call('read'), commit: (text, expectedRevision) => call('commit', {text, expectedRevision}) });
let current = null, busy = false, damaged = false, journal = [];
const comparisonSelections=new Map();
const comparisonSlots=[['compareCook','compareProbe'],['compareCook2','compareProbe2'],['compareCook3','compareProbe3']];
const chartColors=[['gold','#daba7c'],['blue','#91c8e8'],['coral','#f3a28b'],['lavender','#c5a9f0']];
const status = (text, error = false) => { $('status').textContent = text; $('status').dataset.error = String(error); };
const fbRoles=['Not used','Pit / ambient','Meat','Other'];
const fbProbes=['Not recorded','Wired','Wireless','Other'];
const fbConnection=value=>['Wired ambient probe','Wired food probe'].includes(value)?'Wired':value;
let fbEntries=[],fbReadingChoices=[];
function addFireboardRow(channel){
  const row=document.createElement('details');row.id='fbChannel'+channel;
  const summary=document.createElement('summary');summary.id='fbSummary'+channel;summary.textContent='Probe '+channel+' · Not used';row.append(summary);
  for(const [field,label,options,limit,placeholder] of [
    ['Role','Role',fbRoles],['Probe','Connection',fbProbes],
    ['Port','Wired port',['Not recorded','1','2','3','4','5','6']],
    ['Color','Wireless color',['Not recorded','Orange','Silver','Other']],
    ['CustomColor','Other wireless color / name',null,100,'Color or identifier'],
    ['Measurement','Wireless reading',['Not recorded','Internal / meat','External / ambient']],
    ['Label','Probe label',null,250,'Pit, brisket flat, pork butt 1…'],
    ['Placement','Placement',null,500,'Grate position or location in the meat'],
    ['Series','Link to imported reading',[]]
  ]){
    const wrapper=document.createElement('label');wrapper.append('Probe '+channel+' — '+label);wrapper.id='fbField'+field+channel;
    const input=document.createElement(options?'select':'input');input.id='fb'+field+channel;
    if(field==='Series'){
      input.append(new Option('Not linked',''));
      for(const [key,t] of fbReadingChoices)input.append(new Option(`${t.channel} · session ${t.sessionId || 'unrecorded'} · device ${t.deviceUUID || 'unrecorded'} · sensor ${t.channelId ?? t.channel}`,key));
    }else if(options)for(const choice of options)input.append(new Option(choice,choice));
    else{input.maxLength=limit;input.placeholder=placeholder;}
    wrapper.append(input);row.append(wrapper);
  }
  const remove=document.createElement('button');remove.type='button';remove.textContent='Remove entry';remove.id='fbRemove'+channel;
  remove.onclick=()=>{if(busy)return;row.remove();fbEntries=fbEntries.filter(id=>id!==channel);refreshFireboardSetup();$('profileForm').dispatchEvent(new Event('input',{bubbles:true}));};row.append(remove);
  $('fbChannels').append(row);
  for(const field of ['Role','Probe','Color','CustomColor'])$('fb'+field+channel).onchange=refreshFireboardSetup;
  return row;
}
function rebuildFireboardRows(ids){fbEntries=[...ids];$('fbChannels').replaceChildren();for(const id of ids)addFireboardRow(id);}
function refreshFireboardSetup(){
  $('fbSettings').hidden=$('fbModel').value!=='FireBoard 2';
  for(const channel of fbEntries){
    const connection=$('fbProbe'+channel).value;
    $('fbFieldPort'+channel).hidden=connection!=='Wired';
    $('fbFieldColor'+channel).hidden=connection!=='Wireless';$('fbFieldCustomColor'+channel).hidden=connection!=='Wireless' || $('fbColor'+channel).value!=='Other';$('fbFieldMeasurement'+channel).hidden=connection!=='Wireless';
    $('fbSummary'+channel).textContent=['Probe '+channel,$('fbRole'+channel).value,connection==='Wireless'?($('fbColor'+channel).value==='Other'?$('fbCustomColor'+channel).value || 'Other':$('fbColor'+channel).value):connection].join(' · ');
  }
  $('fbAdd').disabled=busy || fbEntries.length>=32;
}
$('fbModel').onchange=refreshFireboardSetup;
$('fbAdd').onclick=()=>{
  if(busy || fbEntries.length>=32)return;
  const channel=Array.from({length:32},(_,i)=>i+1).find(id=>!fbEntries.includes(id));fbEntries.push(channel);
  const row=addFireboardRow(channel);row.open=true;refreshFireboardSetup();$('profileForm').dispatchEvent(new Event('input',{bubbles:true}));row.scrollIntoView({behavior:'smooth'});
};
function loadFireboardSetup(value){
  fbReadingChoices=[...new Map((journal.find(c=>c.id===current)?.temperatures || []).map(t=>[seriesKey(t),t]))];
  $('fbModel').value=value?.model || '';$('fbDeviceName').value=value?.deviceName || '';$('fbAccessories').value=value?.accessories || '';
  rebuildFireboardRows(value?.channels.map(p=>p.channel) || [1,2,3,4,5,6]);
  for(const channel of fbEntries){
    const probe=value?.channels?.find(p=>p.channel===channel);
    for(const [field,key,fallback] of [['Role','role','Not used'],['Probe','probeType','Not recorded'],['Label','label',''],['Placement','placement','']])$('fb'+field+channel).value=field==='Probe'?fbConnection(probe?.[key] ?? fallback):probe?.[key] ?? fallback;
    $('fbPort'+channel).value=String(probe?.wiredPort ?? (['Wired ambient probe','Wired food probe'].includes(probe?.probeType)?channel:'Not recorded'));
    $('fbCustomColor'+channel).value=probe?.customColor || '';
    $('fbColor'+channel).value=probe?.color || 'Not recorded';$('fbMeasurement'+channel).value=probe?.measurement || 'Not recorded';$('fbSeries'+channel).value=probe?.seriesKey || '';
  }
  refreshFireboardSetup();
}
function fireboardSetupValue(){
  if(!$('fbModel').value)return null;
  return {version:2,model:$('fbModel').value,deviceName:$('fbDeviceName').value,accessories:$('fbAccessories').value,
    channels:fbEntries.map(channel=>({channel,seriesKey:$('fbSeries'+channel).value,role:$('fbRole'+channel).value,probeType:$('fbProbe'+channel).value,label:$('fbLabel'+channel).value,placement:$('fbPlacement'+channel).value,
      wiredPort:$('fbProbe'+channel).value==='Wired' && $('fbPort'+channel).value!=='Not recorded'?Number($('fbPort'+channel).value):null,
      color:$('fbProbe'+channel).value==='Wireless'?$('fbColor'+channel).value:'Not recorded',
      customColor:$('fbProbe'+channel).value==='Wireless' && $('fbColor'+channel).value==='Other'?$('fbCustomColor'+channel).value:'',
      measurement:$('fbProbe'+channel).value==='Wireless'?$('fbMeasurement'+channel).value:'Not recorded'}))};
}
function renderProbeGuide(setup){
  $('probeGuideList').replaceChildren();
  const used=setup?.channels.filter(p=>p.role!=='Not used') || [];$('probeGuide').hidden=!used.length;
  for(const probe of used){
    const item=document.createElement('p'),connection=fbConnection(probe.probeType);
    const parts=[probe.label || 'Probe '+probe.channel,probe.role,connection];
    if(connection==='Wired'){const port=probe.wiredPort ?? (['Wired ambient probe','Wired food probe'].includes(probe.probeType)?probe.channel:null);if(port)parts.push('port '+port);}
    if(connection==='Wireless'){if(probe.color && probe.color!=='Not recorded')parts.push(probe.color==='Other'?probe.customColor || 'Other':probe.color);if(probe.measurement && probe.measurement!=='Not recorded')parts.push(probe.measurement);}
    if(probe.seriesKey)parts.push('Linked to imported reading');
    if(probe.placement)parts.push(probe.placement);item.textContent=parts.join(' · ');
    if(connection==='Wireless' && ['Orange','Silver'].includes(probe.color))item.className='probe-'+probe.color.toLowerCase();
    $('probeGuideList').append(item);
  }
}
let view = 'cook';
const drafts = new Map();
const editForms = ['event','profileForm','reviewForm','targetsForm','wrapForm'];
function showView(next, scroll = true) {
  view = next;
  for (const name of ['cook','history','backups']) {
    $(name+'View').hidden = name !== view;
    $('nav'+name[0].toUpperCase()+name.slice(1)).setAttribute('aria-pressed', String(name === view));
  }
  if (scroll) window.scrollTo({top:0,behavior:'smooth'});
}
for (const name of ['Cook','History','Backups']) $('nav'+name).onclick=()=>showView(name.toLowerCase());
$('backupSummary').onclick=()=>showView('backups');
function draftKey(form) { return (form === 'new' ? 'new' : current) + ':' + form; }
function fields(form) { return [...$(form).querySelectorAll('input,select,textarea')].filter(e=>e.id && e.type!=='file'); }
function feedback(form, text, error = false) {
  const output=$(form+'Feedback');output.textContent=text;output.dataset.error=String(error);
}
function updateDraftNotice() { $('draftNotice').hidden = drafts.size === 0; }
for (const form of ['new',...editForms]) {
  const output=document.createElement('p');output.id=form+'Feedback';output.className='form-feedback';output.setAttribute('role','status');$(form).append(output);
  const changed=()=>{
    if(busy || (form!=='new' && !current))return;
    drafts.set(draftKey(form),Object.fromEntries(fields(form).map(e=>[e.id,e.type==='checkbox'?e.checked:e.value])));
    feedback(form,'Unsaved changes. Save before closing the app.');updateDraftNotice();
  };
  $(form).addEventListener('input',changed);$(form).addEventListener('change',changed);
}
function restoreDrafts() {
  for(const form of editForms){
    const draft=drafts.get(draftKey(form));
    if(draft && form==='profileForm')rebuildFireboardRows(Object.keys(draft).filter(id=>/^fbRole\d+$/.test(id)).map(id=>Number(id.slice(6))));
    if(draft)for(const [id,value] of Object.entries(draft)){const e=$(id);if(e.type==='checkbox')e.checked=value;else e.value=value;}
    feedback(form,draft?'Unsaved changes. Save before closing the app.':'');
  }
  for(const kind of ['method','equipment'])$(kind+'Custom').hidden=$(kind+'Choice').value!=='__custom__';
  refreshFireboardSetup();refreshWrap();
  updateDraftNotice();
}
function cookingActions(cook) {
  const options=availableActions(cook),previous=$('type').value;
  $('type').replaceChildren(...options.map(value=>new Option(value,value)));
  if(options.includes(previous))$('type').value=previous;
  $('quickActions').replaceChildren();
  for(const type of options.filter(t=>!['Note','Target Change'].includes(t))){
    const button=document.createElement('button');button.textContent=type;button.dataset.final=String(type==='Cook Finished');
    button.onclick=()=>saveEvent(type);$('quickActions').append(button);
  }
  $('event').querySelector('button').disabled=busy || options.length===0;
  $('lidState').textContent=(cook.events || []).some(e=>['Lid Open','Lid Closed'].includes(e.type))?(lidIsOpen(cook)?'Lid: open':'Lid: closed'):'Lid: not recorded';
  $('wrapForm').querySelector('button').disabled=busy || (cook.phase || (cook.finishedAt?'Finished':'Cooking'))!=='Cooking';
  for(const id of ['wrapMethod','wrapDetail','wrapNote'])$(id).disabled=busy || (cook.phase || (cook.finishedAt?'Finished':'Cooking'))!=='Cooking';
  $('targetsForm').querySelector('button').disabled=busy || options.length===0;
  for(const id of ['pitTarget','meatTarget','targetNote'])$(id).disabled=busy || options.length===0;
  $('type').disabled=options.length===0;
  $('note').disabled=busy || options.length===0;
}
async function openCook(id) {
  if(busy)return;
  const previous=current;current=id;
  try {await render();showView('cook');}
  catch(e){current=previous;status(e.message,true);}
}
const fmt = at => new Date(at).toLocaleString();
const localDate = value => { if (!value) return ''; const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); };
function loadSetupChoice(kind, value) {
  const select=$(kind+'Choice'), input=$('edit'+kind[0].toUpperCase()+kind.slice(1));
  const preset=[...select.options].some(option=>option.value!=='__custom__' && option.value===value);
  select.value=preset?value:'__custom__';
  input.value=value;
  $(kind+'Custom').hidden=select.value!=='__custom__';
}
for (const kind of ['method','equipment']) $(kind+'Choice').onchange=()=>{
  const select=$(kind+'Choice'),input=$('edit'+kind[0].toUpperCase()+kind.slice(1));
  $(kind+'Custom').hidden=select.value!=='__custom__';
  if(select.value!=='__custom__') input.value=select.value;
  else input.focus();
};
async function protection() {
  try {
    const result = await call('backupStatus');
    $('protection').textContent = `${result.message} ${result.local} local snapshots; ${result.uploaded} confirmed uploaded; ${result.pending} pending.`;
    const warning=!!result.failed || !!result.storageWarning || result.mac?.health==='failed';
    $('backupSummary').dataset.warning=String(warning);
    $('backupBrief').textContent = !result.local ? 'No cooking saves yet' : warning ? 'Saved locally · backup needs attention' : result.mac?.verified ? `Mac copy verified · revision ${result.mac.revision}` : result.uploaded===result.local ? 'iCloud reports copies uploaded' : 'Saved locally · independent verification pending';
  }
  catch { $('protection').textContent = 'iCloud backup could not complete. Your local saves remain available. Retry when connected.'; $('backupBrief').textContent='Backup check unavailable · see details';$('backupSummary').dataset.warning='true'; }
}
async function render() {
  const {state} = await store.read(), query = $('search').value.toLowerCase();
  journal = state.records;
  const cooks = state.records.filter(c => ($('showTests').checked || !c.isTestCook) && `${c.food} ${c.cooker}`.toLowerCase().includes(query)).sort((a,b) => b.startedAt.localeCompare(a.startedAt));
  $('count').textContent = `${cooks.length} of ${state.records.length} cooks · ${state.relationalArchives.length} preserved database exports`;
  $('history').replaceChildren();
  for (const cook of cooks) {
    const article = document.createElement('article'), title = document.createElement('strong'), text = document.createElement('p'), open = document.createElement('button');
    title.textContent = `${cook.food}${cook.isTestCook ? ' · Test cook' : ''}`;
    text.textContent = `${cook.cooker} · ${fmt(cook.startedAt)} · ${cook.events.length} events · ${cook.temperatures.length} readings`;
    open.textContent = 'Open cook'; open.onclick = () => openCook(cook.id);
    article.append(title,text,open); $('history').append(article);
  }
  if(!current && !damaged)current=state.records.filter(c=>c.source==='LDCookLog 2.0' && !c.isTestCook && !c.finishedAt && c.phase!=='Finished').sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0]?.id || null;
  const cook = state.records.find(c => c.id === current);
  $('cookEmpty').hidden = !!cook;
  $('active').hidden = !cook;
  $('review').hidden = !cook;
  $('profile').hidden = !cook;
  if (cook) {
    $('title').textContent = `${cook.food} · ${cook.cooker}`;
    const phase = cook.phase || (cook.finishedAt ? 'Finished' : 'Cooking');
    $('phase').textContent = `${phase} · started ${fmt(cook.startedAt)}${cook.finishedAt ? ' · finished '+fmt(cook.finishedAt) : ''}`;
    updateTimers();
    const lastWrap=cook.events.filter(e=>e.wrapMethod).at(-1);$('wrapMethod').value=lastWrap?.wrapMethod || 'Foil';$('wrapDetail').value=lastWrap?.wrapDetail || '';$('wrapNote').value='';refreshWrap();
    const targets=cookTargets(cook);$('targetSummary').textContent=targetText(targets);$('pitTarget').value=targets.pitF ?? '';$('meatTarget').value=targets.meatF ?? '';$('targetNote').value='';
    $('note').value='';
    cookingActions(cook);
    $('timeline').replaceChildren();
    for (const event of cook.events) { const li = document.createElement('li'); li.textContent = `${fmt(event.at)} — ${event.type}${event.note ? ': '+event.note : ''}${event.targets?' · '+targetText(event.targets):''}${event.wrapMethod?' · Wrap: '+(event.wrapMethod==='Other'?event.wrapDetail:event.wrapMethod):''}`; $('timeline').append(li); }
    const channels = [...new Set(cook.temperatures.map(t => `${t.channel} (${t.unit || 'unknown unit'})`))];
    $('temperatures').textContent = `${cook.temperatures.length} retained readings. ${channels.join(', ')}${channels.length ? '.' : ''}`;
    const related = cook.legacy?.related || {};
    $('details').textContent = `${cook.notes || 'No notes recorded.'} ${Object.entries(related).filter(([,rows]) => rows.length).map(([name,rows]) => `${name.replaceAll('_',' ')}: ${rows.length}`).join(' · ')}`;
    for(const kind of ['equipment','rubs','sauces']){const select=$(kind+'Library');select.replaceChildren(new Option('Choose saved '+kind+'…',''));for(const name of setupChoices(state,kind))select.append(new Option(name,name));}
    $('editFood').value=cook.food;$('editCooker').value=cook.cooker;
    $('editStart').value=localDate(cook.startedAt);$('editFinish').value=localDate(cook.finishedAt);$('editTest').checked=!!cook.isTestCook;
    for (const key of ['method','weight','equipment','preparation','rubs','sauces']) $('edit'+key[0].toUpperCase()+key.slice(1)).value=cook.cookingDetails?.[key] || '';
    for(const kind of ['method','equipment']) loadSetupChoice(kind,cook.cookingDetails?.[kind] || '');
    $('editRating').value=cook.cookingDetails?.rating || '';
    loadFireboardSetup(cook.cookingDetails?.fireboardSetup);
    renderProbeGuide(cook.cookingDetails?.fireboardSetup);
    const originalPrep=related.cook_preparation?.[0] || {};
    $('editTrim').value=cook.cookingDetails?.trim ?? originalPrep.trim_level ?? '';
    $('editBrine').value=cook.cookingDetails?.brineMarinade ?? originalPrep.brine_marinade ?? '';
    $('editInjection').value=cook.cookingDetails?.injection ?? originalPrep.injection ?? '';
    $('editBinder').value=cook.cookingDetails?.binder ?? cook.legacy?.cook?.binder ?? '';
    $('legacyDetails').replaceChildren();
    const preserved=originalCookingDetails(cook);
    for(const group of preserved){const heading=document.createElement('h3');heading.textContent=group.title;$('legacyDetails').append(heading);const list=document.createElement('dl');for(const item of group.items){const label=document.createElement('dt'),value=document.createElement('dd');label.textContent=item.label;value.textContent=item.value;list.append(label,value)}$('legacyDetails').append(list)}
    if(!preserved.length)$('legacyDetails').textContent='No original structured cooking details recorded.';
    const review=reviewValues(cook);$('reviewOverall').value=review.overallResult;$('reviewBark').value=review.bark;$('reviewTenderness').value=review.tenderness;$('reviewObservations').value=review.observations;$('reviewChanges').value=review.changesNextTime;
    $('cookNotes').value = cook.notes || '';
    $('evaluation').value = cook.evaluation || '';
    restoreDrafts();
    refreshComparison();
  }
}
function fillProbes(select,cook,previous=select.value) {
  select.replaceChildren();
  const series = new Map((cook?.temperatures || []).map(t=>[seriesKey(t),t]));
  for (const [key,t] of series) select.append(new Option(`${assignedProbeLabel(cook,t)} · ${t.unit || 'unknown'} · session ${t.sessionId || 'unrecorded'} · probe ${t.channelId || t.channel}`,key));
  if (series.has(previous)) select.value = previous;
}
function captureComparison() {
  if(!current)return;
  comparisonSelections.set(current,{probe:$('probe').value,others:comparisonSlots.map(([cook,probe])=>({cook:$(cook).value,probe:$(probe).value}))});
}
function refreshComparison() {
  const saved=comparisonSelections.get(current) || {probe:'',others:[]};
  fillProbes($('probe'),journal.find(c=>c.id===current),saved.probe);
  const choices=journal.filter(c=>c.id!==current && !c.isTestCook && c.temperatures.length).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
  const used=new Set();
  comparisonSlots.forEach(([cookID,probeID],i)=>{
    const select=$(cookID),chosen=saved.others[i];
    select.replaceChildren(new Option('No comparison',''));
    for(const cook of choices)select.append(new Option(`${cook.food} · ${cook.cooker} · ${fmt(cook.startedAt)}`,cook.id));
    if(chosen && choices.some(c=>c.id===chosen.cook) && !used.has(chosen.cook))select.value=chosen.cook;
    if(select.value)used.add(select.value);
    fillProbes($(probeID),journal.find(c=>c.id===select.value),chosen?.probe || '');
    $(probeID).disabled=!select.value;
  });
  comparisonSlots.forEach(([cookID])=>{for(const option of $(cookID).options)option.disabled=!!option.value && option.value!==$(cookID).value && used.has(option.value)});
  captureComparison();drawChart();
}
function updateCompare(){captureComparison();refreshComparison()}
function drawChart() {
  $('chart').replaceChildren();$('chartLegend').replaceChildren();
  try {
    const first = journal.find(c=>c.id===current);
    if (!first || !$('probe').value) { $('chartSummary').textContent = 'No temperature readings attached yet.'; return; }
    const selected=[{cook:first,key:$('probe').value},...comparisonSlots.map(([cook,probe])=>({cook:journal.find(c=>c.id===$(cook).value),key:$(probe).value})).filter(row=>row.cook && row.key)];
    const series=selected.map((row,i)=>({name:row.cook.food,label:chartColors[i][0],color:chartColors[i][1],probe:assignedProbeLabel(row.cook,row.cook.temperatures.find(t=>seriesKey(t)===row.key)),points:comparisonSeries(row.cook,row.key)}));
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for (const row of series) for (const p of row.points) { minX=Math.min(minX,p.minutes);maxX=Math.max(maxX,p.minutes);minY=Math.min(minY,p.fahrenheit);maxY=Math.max(maxY,p.fahrenheit); }
    if (!Number.isFinite(minX)) { $('chartSummary').textContent='No usable readings.';return; }
    maxX=Math.max(maxX,minX+1);minY-=5;maxY+=5;
    const ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 680 320');svg.setAttribute('role','img');svg.setAttribute('aria-label','Temperature in Fahrenheit versus minutes since cook start');
    const add=(tag,attributes,text)=>{const e=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attributes))e.setAttribute(key,String(value));if(text)e.textContent=text;svg.append(e);};
    for(let i=0;i<=4;i++){const y=30+i*55;add('line',{x1:65,x2:655,y1:y,y2:y,stroke:'#566657'});add('text',{x:5,y:y+5},String(Math.round(maxY-i*(maxY-minY)/4)));}
    add('text',{x:70,y:285},`${Math.round(minX)} min`);add('text',{x:570,y:285},`${Math.round(maxX)} min`);add('text',{x:70,y:20},'°F');
    for (const row of series) {
      const stride=Math.max(1,Math.ceil(row.points.length/600));
      const visible=row.points.filter((_,i)=>i%stride===0 || i===row.points.length-1);
      const legend=document.createElement('p');legend.textContent=`${row.label}: ${row.name} · ${row.probe} · ${row.points.length} readings`;legend.className='comparison-legend legend-'+row.label;$('chartLegend').append(legend);
      add('polyline',{fill:'none',stroke:row.color,'stroke-dasharray':['none','8 3','3 3','10 3 2 3'][series.indexOf(row)],'stroke-width':2,points:visible.map(p=>`${65+(p.minutes-minX)/(maxX-minX)*590},${250-(p.fahrenheit-minY)/(maxY-minY)*220}`).join(' ')});
    }
    $('chart').append(svg);
    $('chartSummary').textContent=series.map(s=>`${s.name} (${s.label}): ${s.points.length} readings`).join(' · ')+'. Aligned by cook start; Celsius converted to Fahrenheit for display. Chart samples up to 601 points per series; all original readings are retained. Test cooks excluded from comparison choices.';
  } catch(e) { $('chartSummary').textContent=e.message; }
}
$('probe').onchange=()=>{captureComparison();drawChart()};for(const [cook,probe] of comparisonSlots){$(cook).onchange=updateCompare;$(probe).onchange=()=>{captureComparison();drawChart()}}
for(const kind of ['equipment','rubs','sauces'])$(kind+'Library').onchange=e=>{
  e.stopPropagation();const select=e.target,name=select.value;select.value='';if(!name)return;
  const input=$('edit'+kind[0].toUpperCase()+kind.slice(1)),parts=input.value.split(';').map(s=>s.trim()).filter(Boolean);
  if(!parts.some(s=>s.toLocaleLowerCase()===name.toLocaleLowerCase()))parts.push(name);
  const value=parts.join('; ');if(value.length>input.maxLength){feedback('profileForm','This list is too long. Shorten it before adding another item.',true);return;}
  input.value=value;if(kind==='equipment'){$('equipmentChoice').value='__custom__';$('equipmentCustom').hidden=false;}
  input.dispatchEvent(new Event('input',{bubbles:true}));
};
function refreshWrap(){$('wrapOther').hidden=$('wrapMethod').value!=='Other';$('wrapDetail').required=!$('wrapOther').hidden;}
$('wrapMethod').onchange=refreshWrap;
$('wrapForm').onsubmit=e=>{e.preventDefault();if(current)action(async()=>{
  const note=$('wrapNote').value,fromAction=$('type').value==='Wrapped' && $('note').value===note;
  await store.event(current,'Wrapped',note,{wrapMethod:$('wrapMethod').value,wrapDetail:$('wrapMethod').value==='Other'?$('wrapDetail').value:''});
  if(fromAction){drafts.delete(draftKey('event'));$('note').value='';}
},'wrapForm');};
function updateTimers(){
  const cook=journal.find(c=>c.id===current);if(!cook){$('timers').textContent='';return;}
  const timers=cookTimers(cook),phase=cook.phase || (cook.finishedAt?'Finished':'Cooking');
  const text=timers.waiting?'Timers start at the recorded start time.':`${phase==='Preparation'?'Preparation elapsed':'Total elapsed'} ${elapsedText(timers.totalMs)}${phase!=='Finished'?' · '+phase+' '+elapsedText(timers.phaseMs):''} · Rest total ${elapsedText(timers.restMs)} · Hold total ${elapsedText(timers.holdMs)}`;
  if($('timers').textContent!==text)$('timers').textContent=text;
}
$('targetsForm').onsubmit=e=>{e.preventDefault();if(current)action(async()=>{
  const note=$('targetNote').value,fromAction=$('type').value==='Target Change' && $('note').value===note;
  await store.targets(current,{unit:'F',pitF:$('pitTarget').value===''?null:Number($('pitTarget').value),meatF:$('meatTarget').value===''?null:Number($('meatTarget').value)},note);
  if(fromAction){drafts.delete(draftKey('event'));$('note').value='';}
},'targetsForm');};
$('profileForm').onsubmit=e=>{e.preventDefault();if(!current)return;const value={food:$('editFood').value,cooker:$('editCooker').value,startedAt:$('editStart').value,finishedAt:$('editFinish').value,isTestCook:$('editTest').checked,rating:$('editRating').value?Number($('editRating').value):null,trim:$('editTrim').value,brineMarinade:$('editBrine').value,injection:$('editInjection').value,binder:$('editBinder').value,fireboardSetup:fireboardSetupValue()};for(const key of ['method','weight','equipment','preparation','rubs','sauces'])value[key]=$('edit'+key[0].toUpperCase()+key.slice(1)).value;const original=journal.find(c=>c.id===current);if(value.startedAt===localDate(original.startedAt))value.startedAt=original.startedAt;if(value.finishedAt===localDate(original.finishedAt))value.finishedAt=original.finishedAt;action(()=>store.profile(current,value),'profileForm');};
$('showTests').onchange=()=>render().catch(e=>status(e.message,true));
$('reviewForm').onsubmit=e=>{e.preventDefault();if(current)action(()=>store.details(current,$('cookNotes').value,$('evaluation').value,{overallResult:$('reviewOverall').value,bark:$('reviewBark').value,tenderness:$('reviewTenderness').value,observations:$('reviewObservations').value,changesNextTime:$('reviewChanges').value}),'reviewForm');};
$('sessionFile').onchange=e=>{const file=e.target.files?.[0];if(!file || !current)return;action(async()=>{try{if(file.size>100*1024*1024)throw Error('Session file too large');await store.importSession(current,JSON.parse(await file.text()));}finally{e.target.value='';}});};
async function action(work, form = null) {
  const key=form?draftKey(form):null;
  if (busy) return;
  busy = true; document.querySelectorAll('button').forEach(b => b.disabled = true);
  const lockedFields=[...document.querySelectorAll('input,select,textarea')].map(e=>[e,e.disabled]);
  for(const [e] of lockedFields)e.disabled=true;
  try {
    const changed = await work();
    if(changed!==false){if(key)drafts.delete(key);damaged=false;$('backupBrief').textContent='Saved locally · checking backups';}
    await render();
    const text=changed===false?'Cancelled. Your journal was unchanged.':'Saved on this device. A recovery snapshot was created automatically.';
    status(text);if(form)feedback(form,text);updateDraftNotice();
  }
  catch (e) { status(e.message, true);if(form)feedback(form,e.message,true); }
  finally {
    busy = false; document.querySelectorAll('button').forEach(b => b.disabled = false);
    for(const [e,disabled] of lockedFields)e.disabled=disabled;
    if (damaged) $('new').querySelector('button').disabled = true;
    const selected=journal.find(c=>c.id===current);if(selected){cookingActions(selected);refreshComparison();refreshFireboardSetup();}
    await protection();
  }
}
async function restore(envelope) {
  const body = await unseal(envelope);
  if (!confirm(`Restore ${body.state.records.length} cooks from ${fmt(body.createdAt)}? This replaces the current journal. Existing recovery snapshots are kept. Unsaved edits will be discarded. Keep your original database archive.`)) return false;
  if (damaged) await call('repair', {text:JSON.stringify(envelope)}); else await store.restore(envelope);
  current = null;drafts.clear();showView('history');
}
$('new').onsubmit = e => { e.preventDefault(); if (!damaged) action(async () => {
  const state=await store.add($('food').value,$('cooker').value);
  current=state.records.at(-1).id;$('food').value='';$('setupPanel').open=true;
  showView('cook');
},'new'); };
function saveEvent(type) {
  if(type==='Wrapped'){
    $('type').value='Wrapped';$('event').dispatchEvent(new Event('input',{bubbles:true}));$('wrapPanel').open=true;
    if(!$('wrapNote').value && $('note').value){$('wrapNote').value=$('note').value;$('wrapForm').dispatchEvent(new Event('input',{bubbles:true}));}
    $('wrapMethod').focus();return;
  }
  if(type==='Target Change'){
    $('targetsPanel').open=true;
    if(!$('targetNote').value && $('note').value){$('targetNote').value=$('note').value;$('targetsForm').dispatchEvent(new Event('input',{bubbles:true}));}
    $('pitTarget').focus();return;
  }
  if(current)action(async()=>{await store.event(current,type,$('note').value);$('note').value='';},'event');
}
$('event').onsubmit = e => { e.preventDefault();saveEvent($('type').value); };
$('search').oninput = () => render().catch(e => status(e.message,true));
$('retry').onclick = protection;
$('browse').onclick = async () => {
  try {
    $('snapshots').replaceChildren();
    const snapshots = await call('listSnapshots');
    if (!snapshots.length) { $('snapshots').textContent = 'No snapshots found yet.'; return; }
    for (const snapshot of snapshots) {
      const button = document.createElement('button'); button.textContent = snapshot.label;
      button.onclick = () => action(async () => restore(JSON.parse(await call('readSnapshot',{token:snapshot.token}))));
      $('snapshots').append(button);
    }
  } catch (e) { status('Cannot list snapshots: '+e.message,true); }
};
$('import').onchange = e => {
  const file = e.target.files?.[0]; if (!file) return;
  action(async () => {
    try {
      if (file.size > 100*1024*1024) throw Error('File exceeds 100 MB limit. Keep it; contact development support.');
      const value = JSON.parse(await file.text());
      if (value.format === RELATIONAL_FORMAT) {
        if (damaged) throw Error('Recover the damaged journal before importing a migration.');
        if (!confirm('Import the complete database export? Conflicting cook IDs stop the import. Keep the original PostgreSQL backup.')) return false;
        const report = await store.migrate(value);
        alert(`Migration preserved ${report.audit.cooks} cooks, ${report.audit.events} events, ${report.audit.temperatureSamples} readings and all ${Object.keys(report.counts).length} source tables.`);
      } else return await restore(value);
    } finally { e.target.value = ''; }
  });
};
(async () => {
  if (!window.ldcooklogHost && !window.webkit?.messageHandlers?.recovery) { status('Open this development app through its iPhone host. Browser storage cannot provide automatic iCloud backups.',true); document.querySelectorAll('button,input,select').forEach(e => e.disabled = true); return; }
  try { await render(); status('Journal ready. Offline cooking pilot.'); }
  catch (e) { damaged = true;showView('backups',false);$('recoveryTools').open=true; $('new').querySelector('button').disabled = true; status('Journal could not open. Choose a recovery snapshot; no data was reset. '+e.message,true); }
  setInterval(updateTimers,1000);
  await protection();
  setInterval(() => { if (!busy && !document.hidden) protection(); },30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden){updateTimers();if(!busy)protection();} });
})();

})();
