'use strict';
(() => {
/* Pure, independently testable backup and restore planning. */
const BACKUP_FORMAT = 'ldcooklog-local-backup';
const BACKUP_VERSION = 1;

function validateCook(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c) || typeof c.id !== 'string' || !c.id.trim() || c.id.length > 160) throw Error('Invalid cook identifier');
  if (typeof c.food !== 'string' || c.food.length > 300 || typeof c.cooker !== 'string' || c.cooker.length > 300) throw Error('Invalid cook labels');
  if (typeof c.startedAt !== 'string' || !Number.isFinite(Date.parse(c.startedAt))) throw Error('Invalid cook start time');
  if (c.finishedAt !== null && c.finishedAt !== undefined && (typeof c.finishedAt !== 'string' || !Number.isFinite(Date.parse(c.finishedAt)))) throw Error('Invalid finish time');
  if (!Array.isArray(c.events) || c.events.length > 200000 || !Array.isArray(c.temperatures) || c.temperatures.length > 500000) throw Error('Invalid cook series');
  if (!c.events.every(e => e && typeof e.type === 'string' && typeof e.at === 'string' && Number.isFinite(Date.parse(e.at)) && typeof e.note === 'string')) throw Error('Invalid cook events');
  if (!c.temperatures.every(t => t && typeof t.at === 'string' && Number.isFinite(Date.parse(t.at)) && Number.isFinite(t.value) && typeof t.channel === 'string')) throw Error('Invalid temperature samples');
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
        legacyId: t.id || null, sessionId:t.cook_fireboard_session_id};
    }).sort((a,b)=>a.at.localeCompare(b.at));
    const cookerFromNotes = String(row.notes || '').match(/Smoker: (Traeger Ironwood 885|Traeger Pro|Weber 22" Kettle)/);
    const cook = {
      id: uuid,
      food: row.food || row.cook_id || 'Unnamed cook',
      cooker: row.smoker || row.cooker || cookerFromNotes?.[1] || 'Not recorded',
      startedAt: asISO(row.start_time || row.created_at, 'cook start time'),
      finishedAt: row.finish_time ? asISO(row.finish_time, 'finish time') : null,
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
  event(id, type, note = '') {
    const transitions = { 'Meat On': ['Preparation', 'Cooking'], 'Rest Start': ['Cooking', 'Resting'], 'Keep Warm': ['Resting', 'Keeping Warm'], 'Cook Finished': [null, 'Finished'] };
    return this.mutate(state => {
      const cook = state.records.find(c => c.id === id);
      if (!cook) throw Error('Cook not found');
      const phase = cook.phase || (cook.finishedAt ? 'Finished' : 'Cooking');
      if (phase === 'Finished') throw Error('This cook is finished');
      const transition = transitions[type];
      if (transition && transition[0] && phase !== transition[0]) throw Error(`Cannot ${type.toLowerCase()} during ${phase.toLowerCase()}`);
      const at = new Date().toISOString();
      cook.events.push({ id: crypto.randomUUID(), at, type, note });
      if (transition) cook.phase = transition[1];
      if (type === 'Cook Finished') cook.finishedAt = at;
      return state;
    });
  }
}



const $ = id => document.getElementById(id);
const call = (operation, args = {}) => window.webkit.messageHandlers.recovery.postMessage({operation, ...args});
const store = new CookStore({ read: () => call('read'), commit: (text, expectedRevision) => call('commit', {text, expectedRevision}) });
let current = null, busy = false, damaged = false;
const status = (text, error = false) => { $('status').textContent = text; $('status').dataset.error = String(error); };
const fmt = at => new Date(at).toLocaleString();
async function protection() {
  try { const result = await call('backupStatus'); $('protection').textContent = `${result.message} ${result.local} local snapshots; ${result.uploaded} confirmed uploaded; ${result.pending} pending.`; }
  catch { $('protection').textContent = 'iCloud backup could not complete. Your local saves remain available. Retry when connected.'; }
}
async function render() {
  const {state} = await store.read(), query = $('search').value.toLowerCase();
  const cooks = state.records.filter(c => `${c.food} ${c.cooker}`.toLowerCase().includes(query)).sort((a,b) => b.startedAt.localeCompare(a.startedAt));
  $('count').textContent = `${cooks.length} of ${state.records.length} cooks · ${state.relationalArchives.length} preserved database exports`;
  $('history').replaceChildren();
  for (const cook of cooks) {
    const article = document.createElement('article'), title = document.createElement('strong'), text = document.createElement('p'), open = document.createElement('button');
    title.textContent = `${cook.food}${cook.isTestCook ? ' · Test cook' : ''}`;
    text.textContent = `${cook.cooker} · ${fmt(cook.startedAt)} · ${cook.events.length} events · ${cook.temperatures.length} readings`;
    open.textContent = 'Open cook'; open.onclick = () => { current = cook.id; render().catch(e => status(e.message, true)); $('active').scrollIntoView({behavior:'smooth'}); };
    article.append(title,text,open); $('history').append(article);
  }
  const cook = state.records.find(c => c.id === current);
  $('active').hidden = !cook;
  if (cook) {
    $('title').textContent = `${cook.food} · ${cook.cooker}`;
    const phase = cook.phase || (cook.finishedAt ? 'Finished' : 'Cooking');
    $('phase').textContent = `${phase} · started ${fmt(cook.startedAt)}${cook.finishedAt ? ' · finished '+fmt(cook.finishedAt) : ''}`;
    $('event').querySelector('button').disabled = phase === 'Finished';
    $('timeline').replaceChildren();
    for (const event of cook.events) { const li = document.createElement('li'); li.textContent = `${fmt(event.at)} — ${event.type}${event.note ? ': '+event.note : ''}`; $('timeline').append(li); }
    const channels = [...new Set(cook.temperatures.map(t => `${t.channel} (${t.unit || 'unknown unit'})`))];
    $('temperatures').textContent = `${cook.temperatures.length} retained readings. ${channels.join(', ')}${channels.length ? '. Charts are still under development.' : ''}`;
    const related = cook.legacy?.related || {};
    $('details').textContent = `${cook.notes || 'No notes recorded.'} ${Object.entries(related).filter(([,rows]) => rows.length).map(([name,rows]) => `${name.replaceAll('_',' ')}: ${rows.length}`).join(' · ')}`;
  }
}
async function action(work) {
  if (busy) return;
  busy = true; document.querySelectorAll('button').forEach(b => b.disabled = true);
  try { await work(); damaged = false; await render(); status('Saved on this device. A recovery snapshot was created automatically.'); }
  catch (e) { status(e.message, true); }
  finally { busy = false; document.querySelectorAll('button').forEach(b => b.disabled = false); if (damaged) $('new').querySelector('button').disabled = true; await protection(); }
}
async function restore(envelope) {
  const body = await unseal(envelope);
  if (!confirm(`Restore ${body.state.records.length} cooks from ${fmt(body.createdAt)}? This replaces the current journal. Existing recovery snapshots are kept. Use only synthetic data until iPhone acceptance testing is complete.`)) return;
  if (damaged) await call('repair', {text:JSON.stringify(envelope)}); else await store.restore(envelope);
  current = null;
}
$('new').onsubmit = e => { e.preventDefault(); if (!damaged) action(async () => { await store.add($('food').value,$('cooker').value); $('food').value = ''; }); };
$('event').onsubmit = e => { e.preventDefault(); if (current) action(async () => { await store.event(current,$('type').value,$('note').value); $('note').value = ''; }); };
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
        if (!confirm('Import the complete database export? Conflicting cook IDs stop the import. Keep the original PostgreSQL backup.')) return;
        const report = await store.migrate(value);
        alert(`Migration preserved ${report.audit.cooks} cooks, ${report.audit.events} events, ${report.audit.temperatureSamples} readings and all ${Object.keys(report.counts).length} source tables.`);
      } else await restore(value);
    } finally { e.target.value = ''; }
  });
};
(async () => {
  if (!window.webkit?.messageHandlers?.recovery) { status('Open this development app through its native iPhone build. Browser storage cannot provide automatic iCloud backups.',true); document.querySelectorAll('button,input,select').forEach(e => e.disabled = true); return; }
  try { await render(); status('Journal ready. Development build — use synthetic test cooks.'); }
  catch (e) { damaged = true; $('new').querySelector('button').disabled = true; status('Journal could not open. Choose a recovery snapshot; no data was reset. '+e.message,true); }
  await protection();
  setInterval(() => { if (!busy && !document.hidden) protection(); },30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !busy) protection(); });
})();

})();
