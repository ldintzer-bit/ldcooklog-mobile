/* One-time, local-only Supabase public-table import. Never sends rows to a server. */
import { validateCook } from './backup.js';
export const RELATIONAL_FORMAT = 'ldcooklog-supabase-relational-export';
export const RELATIONAL_VERSION = 1;
export const REQUIRED_TABLES = Object.freeze('cooks events cook_equipment cook_evaluations cook_fireboard_sessions cook_meat_pieces cook_methods cook_preparation cook_rubs cook_sauces equipment fireboard_account_access fireboard_probe_roles fireboard_temperature_samples locations rubs sauces weather'.split(' '));

async function hash(body) {
  const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body)));
  return [...new Uint8Array(hashBytes)].map(n => n.toString(16).padStart(2, '0')).join('');
}
export async function verifyRelationalExport(value) {
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
export function auditRelationalLinks(tables) {
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
export function buildLocalCooks(tables) {
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
export async function migrateRelationalExport(exported) {
  const tables = await verifyRelationalExport(exported);
  const audit = auditRelationalLinks(tables);
  const cooks = buildLocalCooks(tables);
  if (cooks.reduce((sum, cook) => sum + cook.events.length, 0) !== audit.events ||
      cooks.reduce((sum, cook) => sum + cook.temperatures.length, 0) !== audit.temperatureSamples)
    throw Error('Migration stopped: event or FireBoard sample count changed during conversion.');
  return { cooks, audit, tables: Object.fromEntries(Object.entries(tables).map(([name,value])=>[name,value.rows.length])) };
}
