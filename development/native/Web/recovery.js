import { validateCook, planRestore } from './backup.js';
import { migrateRelationalExport, RELATIONAL_FORMAT, verifyRelationalExport } from './migration.js';
import { attachSession } from './fireboard.js';

const cookTransitions = { 'Meat On': [['Preparation'], 'Cooking'], 'Rest Start': [['Cooking','Keeping Warm'], 'Resting'], 'Keep Warm': [['Cooking','Resting'], 'Keeping Warm'], 'Cook Finished': [['Cooking','Resting','Keeping Warm'], 'Finished'] };
export function availableActions(cook) {
  const phase=cook.phase || (cook.finishedAt?'Finished':'Cooking');
  if(phase==='Finished')return [];
  const steps=Object.keys(cookTransitions).filter(type=>cookTransitions[type][0].includes(phase));
  const allowed=new Set([...steps,...(phase==='Cooking'?['Wrapped','Target Change']:[]),'Note']);
  return ['Meat On','Wrapped','Rest Start','Keep Warm','Cook Finished','Target Change','Note'].filter(type=>allowed.has(type));
}
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
  event(id, type, note = '') {
    return this.mutate(state => {
      const cook = state.records.find(c => c.id === id);
      if (!cook) throw Error('Cook not found');
      const phase = cook.phase || (cook.finishedAt ? 'Finished' : 'Cooking');
      if (phase === 'Finished') throw Error('This cook is finished');
      const transition = cookTransitions[type];
      if (transition && !transition[0].includes(phase)) throw Error(`Cannot ${type.toLowerCase()} during ${phase.toLowerCase()}`);
      const at = new Date().toISOString();
      cook.events.push({ id: crypto.randomUUID(), at, type, note });
      if (transition) cook.phase = transition[1];
      if (type === 'Meat On') cook.startedAt = at;
      if (type === 'Cook Finished') cook.finishedAt = at;
      return state;
    });
  }
}
