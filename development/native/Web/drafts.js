// Private device-local drafts are separate from committed cooking backups.
export const DRAFT_FORMAT='ldcooklog-private-drafts';
export function draftBase(cook,form){
 if(form==='new')return 'new';if(!cook)return null;
 const values={profileForm:{food:cook.food,cooker:cook.cooker,startedAt:cook.startedAt,finishedAt:cook.finishedAt,isTestCook:cook.isTestCook,cookingDetails:cook.cookingDetails},reviewForm:{notes:cook.notes,evaluation:cook.evaluation,evaluationDetails:cook.evaluationDetails},targetsForm:cook.targets || null,wrapForm:cook.events.filter(e=>e.wrapMethod).at(-1) || null,event:{phase:cook.phase,finishedAt:cook.finishedAt,lastEvent:cook.events.at(-1)?.id,eventCount:cook.events.length}};
 return JSON.stringify(values[form] ?? null);
}
function validateDraftEntries(entries){
 if(!Array.isArray(entries) || entries.length>200)throw Error('Private draft cache exceeds its limit');const keys=new Set();
 for(const entry of entries){if(!entry || typeof entry.key!=='string' || !/^(new:new|.{1,160}:(event|profileForm|reviewForm|targetsForm|wrapForm))$/.test(entry.key) || keys.has(entry.key) || typeof entry.base!=='string' || entry.base.length>1048576 || !entry.fields || Array.isArray(entry.fields) || typeof entry.fields!=='object' || Object.keys(entry.fields).length>2000)throw Error('Invalid private draft cache');keys.add(entry.key);
  for(const [key,value] of Object.entries(entry.fields))if(!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key) || !(typeof value==='boolean' || typeof value==='string' && value.length<=20000))throw Error('Invalid private draft field');
 }
 return entries;
}
async function draftDigest(text){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');}
export async function sealDrafts(entries){validateDraftEntries(entries);const payload=JSON.stringify({format:DRAFT_FORMAT,version:1,entries});const text=JSON.stringify({format:DRAFT_FORMAT,payload,sha256:await draftDigest(payload)});if(new TextEncoder().encode(text).length>2097152)throw Error('Private draft cache exceeds 2 MiB; save some edits to the journal');return text;}
export async function readDrafts(candidates){
 if(!Array.isArray(candidates))throw Error('Private drafts could not be read');
 for(let index=0;index<candidates.length;index++){try{const text=candidates[index];if(typeof text!=='string' || new TextEncoder().encode(text).length>2097152)continue;const envelope=JSON.parse(text);if(envelope.format!==DRAFT_FORMAT || typeof envelope.payload!=='string' || await draftDigest(envelope.payload)!==envelope.sha256)continue;const body=JSON.parse(envelope.payload);if(body.format!==DRAFT_FORMAT || body.version!==1)continue;return {entries:validateDraftEntries(body.entries),recovered:index>0};}catch{}}
 if(candidates.length)throw Error('Private draft copies are damaged; saved cooking history is unchanged');return {entries:[],recovered:false};
}
