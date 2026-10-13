import { validateMeatPieces, validateRubApplications } from './setup-details.js';
import { seriesKey } from './fireboard.js';
/* Pure, independently testable backup and restore planning. */
export const BACKUP_FORMAT = 'ldcooklog-local-backup';
export const BACKUP_VERSION = 1;

export function validateWrap(value){
  if(!value || !['Foil','Butcher Paper','Foil Boat','Other'].includes(value.wrapMethod) || typeof value.wrapDetail!=='string' || value.wrapDetail.length>300 || (value.wrapMethod==='Other' && !value.wrapDetail.trim()))throw Error('Select a wrap method; describe Other in 300 characters or fewer');
  return value;
}
export function validateTargets(value){
  if(!value || typeof value!=='object' || value.unit!=='F')throw Error('Invalid temperature targets');
  for(const key of ['pitF','meatF'])if(value[key]!==null && (!Number.isFinite(value[key]) || value[key]<0 || value[key]>1000))throw Error('Targets must be between 0 and 1000°F, or blank');
  return value;
}
export function validateFireboardSetup(value) {
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

export function validateCook(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c) || typeof c.id !== 'string' || !c.id.trim() || c.id.length > 160) throw Error('Invalid cook identifier');
  if (typeof c.food !== 'string' || c.food.length > 300 || typeof c.cooker !== 'string' || c.cooker.length > 300) throw Error('Invalid cook labels');
  if (typeof c.startedAt !== 'string' || !Number.isFinite(Date.parse(c.startedAt))) throw Error('Invalid cook start time');
  if (c.finishedAt !== null && c.finishedAt !== undefined && (typeof c.finishedAt !== 'string' || !Number.isFinite(Date.parse(c.finishedAt)))) throw Error('Invalid finish time');
  if (!Array.isArray(c.events) || c.events.length > 200000 || !Array.isArray(c.temperatures) || c.temperatures.length > 500000) throw Error('Invalid cook series');
  if (!c.events.every(e => e && typeof e.type === 'string' && typeof e.at === 'string' && Number.isFinite(Date.parse(e.at)) && typeof e.note === 'string')) throw Error('Invalid cook events');
  if (!c.temperatures.every(t => t && typeof t.at === 'string' && Number.isFinite(Date.parse(t.at)) && Number.isFinite(t.value) && typeof t.channel === 'string')) throw Error('Invalid temperature samples');
  if(c.cookingDetails?.fireboardSetup!==undefined)validateFireboardSetup(c.cookingDetails.fireboardSetup);
  if(c.cookingDetails?.meatPieces!==undefined)validateMeatPieces(c.cookingDetails.meatPieces);
  if(c.cookingDetails?.rubApplications!==undefined)validateRubApplications(c.cookingDetails.rubApplications);
  for(const [key,limit] of [['location',300],['recipeReference',2000]])if(c.cookingDetails?.[key]!==undefined && (typeof c.cookingDetails[key]!=='string' || c.cookingDetails[key].length>limit))throw Error('Invalid '+key);
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
export function backupBody(records, createdAt) {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt, count: records.length, records };
}
export async function createBackupForRecords(records, createdAt = new Date().toISOString()) {
  const sorted = [...records].sort((a, b) => a.id.localeCompare(b.id));
  for (const record of sorted) validateCook(record);
  const body = backupBody(sorted, createdAt);
  return { ...body, sha256: await sha256(JSON.stringify(body)) };
}
export async function verifyBackup(backup) {
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
export function planRestore(existing, incoming) {
  const present = new Map(existing.map(c => [c.id, c]));
  const conflicts = incoming.filter(c => present.has(c.id) && JSON.stringify(present.get(c.id)) !== JSON.stringify(c));
  if (conflicts.length) throw Error(`${conflicts.length} cook ID conflict(s). No records imported. Preserve both copies and investigate.`);
  const additions = incoming.filter(c => !present.has(c.id));
  return { additions, added: additions.length, unchanged: incoming.length - additions.length };
}
