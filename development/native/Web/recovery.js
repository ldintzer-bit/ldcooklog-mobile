import { validateCook, planRestore } from './backup.js';
import { migrateRelationalExport, RELATIONAL_FORMAT, verifyRelationalExport } from './migration.js';
import { attachSession } from './fireboard.js';

export const FORMAT = 'ldcooklog-recovery';
export const emptyState = () => ({ records: [], relationalArchives: [] });
async function digest(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function validateState(state) {
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
export async function seal(state, revision) {
  await validateState(state);
  if (!Number.isSafeInteger(revision) || revision < 1) throw Error('Invalid revision');
  const payload = JSON.stringify({ version: 1, revision, createdAt: new Date().toISOString(), state });
  return { format: FORMAT, version: 1, payload, sha256: await digest(payload) };
}
export async function unseal(envelope) {
  if (!envelope || envelope.format !== FORMAT || envelope.version !== 1 || typeof envelope.payload !== 'string' || await digest(envelope.payload) !== envelope.sha256) throw Error('Damaged recovery snapshot');
  const body = JSON.parse(envelope.payload);
  if (body.version !== 1 || !Number.isSafeInteger(body.revision) || body.revision < 1 || !Number.isFinite(Date.parse(body.createdAt))) throw Error('Unsupported snapshot');
  await validateState(body.state);
  return body;
}
export async function importArchive(state, archive) {
  if (archive.format !== RELATIONAL_FORMAT) throw Error('Choose the .relational.json migration file');
  const migration = await migrateRelationalExport(archive);
  const plan = planRestore(state.records, migration.cooks);
  return { state: { records: [...state.records, ...plan.additions], relationalArchives: state.relationalArchives.some(x => x.sha256 === archive.sha256) ? state.relationalArchives : [...state.relationalArchives, archive] }, audit: migration.audit, counts: migration.tables };
}
export class CookStore {
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
  details(id, notes, evaluation) {
    return this.mutate(state => {
      const cook = state.records.find(c => c.id === id);
      if (!cook) throw Error('Cook not found');
      if (typeof notes !== 'string' || notes.length > 20000 || typeof evaluation !== 'string' || evaluation.length > 20000) throw Error('Notes are too long');
      cook.notes = notes;
      cook.evaluation = evaluation;
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
