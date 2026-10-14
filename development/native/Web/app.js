import { draftBase, sealDrafts, readDrafts } from './drafts.js';
import { blankMeatPiece, meatPiecesFor, rubApplicationsFor, recipeChoices } from './setup-details.js';
import { CookStore, unseal, availableActions, lidIsOpen } from './recovery.js';
import { RELATIONAL_FORMAT } from './migration.js';
import { seriesKey, comparisonSeries } from './fireboard.js';
import { originalCookingDetails, reviewValues, setupChoices } from './history-details.js';
import { cookTargets, targetText, cookTimers, elapsedText, assignedProbeLabel } from './cook-tools.js';
const $ = id => document.getElementById(id);
const call = (operation, args = {}) => (window.ldcooklogHost || window.webkit.messageHandlers.recovery).postMessage({operation, ...args});
let requestedDrafts=false;
const store = new CookStore({ read: async () => {const includeDrafts=!requestedDrafts,response=await call('read',{includeDrafts});if(includeDrafts){requestedDrafts=true;if(response && typeof response==='object'){await initialDrafts(response);return response.journal;}draftError='This host cannot protect private drafts yet';draftCacheBlocked=true;}return response;}, commit: (text, expectedRevision) => call('commit', {text, expectedRevision}) });
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
const structuredFields={piece:[['meatCut','Meat / cut','text',300],['packageWeight','Package weight','number'],['cookWeight','Cook / start weight','number'],['weightUnit','Weight unit',['','lb','kg','g','oz']],['boneStatus','Bone',['','bone-in','boneless']],['brandProducer','Brand / producer','text',300],['storeSource','Store / source','text',300],['totalPrice','Total price ($)','number'],['pricePerLb','Price per lb ($)','number'],['gradeType','Grade / type','text',300],['meatNote','Meat notes','text',2000]],rub:[['name','Rub name','text',300],['level','Application',['Not recorded','Light','Normal','Heavy']],['notes','Application notes','text',2000]]};
const rowContainer={piece:'meatPieceRows',rub:'rubApplicationRows'};
function structuredRows(kind,numeric=true){return [...$(rowContainer[kind]).children].map((row,index)=>Object.fromEntries(structuredFields[kind].map(([key,label,type])=>{const value=$(kind+key+(index+1)).value;return [key,type==='number' && numeric?(value===''?null:Number(value)):value]})));}
function rebuildStructuredRows(kind,values){
 const container=$(rowContainer[kind]);container.replaceChildren();
 values.forEach((value,index)=>{
  const row=document.createElement('details');row.id=kind+'Row'+(index+1);const summary=document.createElement('summary');summary.textContent=(kind==='piece'?'Piece ':'Rub ')+(index+1)+(value[kind==='piece'?'meatCut':'name']?' · '+value[kind==='piece'?'meatCut':'name']:'');row.append(summary);
  for(const [key,label,type,limit] of structuredFields[kind]){const wrapper=document.createElement('label');wrapper.append(label);const input=document.createElement(Array.isArray(type)?'select':key.endsWith('Note') || key==='notes'?'textarea':'input');input.id=kind+key+(index+1);
   if(Array.isArray(type))for(const choice of type)input.append(new Option(choice || 'Not recorded',choice));else if(type==='number'){input.type='number';input.min='0';input.max='10000000';input.step='any';}else input.maxLength=limit;
   input.value=value[key] ?? (kind==='piece' && key==='weightUnit'?'lb':kind==='rub' && key==='level'?'Not recorded':'');wrapper.append(input);row.append(wrapper);
  }
  const remove=document.createElement('button');remove.type='button';remove.id=kind+'Remove'+(index+1);remove.textContent=kind==='piece'?'Remove piece':'Remove rub detail';remove.onclick=()=>{const rows=structuredRows(kind,false);rows.splice(index,1);rebuildStructuredRows(kind,rows);$('profileForm').dispatchEvent(new Event('input',{bubbles:true}));};row.append(remove);container.append(row);
 });
}
function addStructuredRow(kind){const rows=structuredRows(kind,false);if(rows.length>=(kind==='piece'?32:64)){feedback('profileForm','Maximum '+(kind==='piece'?'32 pieces':'64 rub details')+' reached.',true);return;}rows.push(kind==='piece'?blankMeatPiece():{name:'',level:'Not recorded',notes:''});rebuildStructuredRows(kind,rows);$(kind+'Row'+rows.length).open=true;$('profileForm').dispatchEvent(new Event('input',{bubbles:true}));}
$('addMeatPiece').onclick=()=>addStructuredRow('piece');$('addRubApplication').onclick=()=>addStructuredRow('rub');
let savedRecipeChoices=[];
$('locationLibrary').onchange=e=>{const name=e.target.value;e.target.value='';if(!name)return;$('editLocation').value=name;$('editLocation').dispatchEvent(new Event('input',{bubbles:true}));};
$('recipeLibrary').onchange=e=>{const recipe=savedRecipeChoices.find(r=>r.name===e.target.value);e.target.value='';if(!recipe)return;$('editMethod').value=recipe.name;$('methodChoice').value='__custom__';$('methodCustom').hidden=false;$('editRecipeReference').value=recipe.reference;$('editMethod').dispatchEvent(new Event('input',{bubbles:true}));};

let view = 'cook';
const drafts = new Map();
let draftWriteQueue=Promise.resolve(),draftBases=new Map(),pendingDraftEntries=null,draftCacheBlocked=false,draftError='',draftGeneration=0;
function draftFeedback(text,error=false){$('draftPersistence').hidden=!text;$('draftPersistence').textContent=text;$('draftPersistence').dataset.error=String(error);$('discardDrafts').hidden=!drafts.size && !draftCacheBlocked;}
async function initialDrafts(response){
 window.__ldcNavigation?.load(response.navigation);
 if(response.draftError){draftError=response.draftError;draftCacheBlocked=true;return;}
 try{const loaded=await readDrafts(response.drafts);pendingDraftEntries=loaded.entries;if(loaded.recovered)draftError='Recovered an earlier private draft copy. Review edits before saving.';}catch(error){draftError=error.message;draftCacheBlocked=true;}
}
function currentDraftBase(id,form){return form==='new'?'new:'+JSON.stringify(journal.map(c=>c.id).sort()):draftBase(journal.find(c=>c.id===id),form);}
function hydrateDrafts(){
 if(pendingDraftEntries===null)return;
 for(const entry of pendingDraftEntries){const split=entry.key.lastIndexOf(':'),id=entry.key.slice(0,split),form=entry.key.slice(split+1),cook=journal.find(c=>c.id===id);if(entry.base===currentDraftBase(id,form)){drafts.set(entry.key,entry.fields);draftBases.set(entry.key,entry.base);}}
 pendingDraftEntries=null;
 const newDraft=drafts.get('new:new');if(newDraft)for(const e of fields('new'))if(Object.hasOwn(newDraft,e.id)){if(e.type==='checkbox')e.checked=newDraft[e.id];else e.value=newDraft[e.id];}
 updateDraftNotice();draftFeedback(draftError || (drafts.size?'Private drafts restored on this phone. Tap Save to add edits to cooking backups.':''),!!draftError);
}
function persistDrafts(force=false){
 if(draftCacheBlocked && !force){draftFeedback(draftError+' Save edits to the journal, or explicitly discard private drafts.',true);return Promise.resolve(false);}
 const generation=++draftGeneration,entries=[...drafts].map(([key,fields])=>({key,base:draftBases.get(key) ?? 'new',fields:structuredClone(fields)}));
 if(entries.length)draftFeedback('Saving private drafts on this phone…');
 const task=draftWriteQueue.then(async()=>{const text=await sealDrafts(entries);await call('writeDrafts',{text});if(generation===draftGeneration){draftError='';draftCacheBlocked=false;draftFeedback(drafts.size?'Drafts saved on this phone. Tap Save to include them in cooking backups.':'');}return true;});
 draftWriteQueue=task.catch(error=>{draftError='Draft protection unavailable: '+error.message;if(generation===draftGeneration)draftFeedback(draftError+' Keep this screen open and save your edits.',true);return false;});
 return draftWriteQueue;
}
$('discardDrafts').onclick=async()=>{let discarded=false;await action(async()=>{if (!confirm('Discard all unsaved drafts on this phone? Saved cooking records and recovery snapshots are kept.'))return false;const previous=new Map(drafts),previousBases=new Map(draftBases);drafts.clear();draftBases.clear();discarded=await persistDrafts(true);if(discarded)$('new').reset();if(!discarded){for(const [key,value] of previous)drafts.set(key,value);draftBases=previousBases;}return false;});if(discarded)status('Unsaved drafts discarded. Saved cooking records and recovery snapshots are unchanged.');};

const editForms = ['event','profileForm','reviewForm','targetsForm','wrapForm'];
function showView(next, scroll = true) {
  window.__ldcNavigation?.beforeView();
  view = next;
  for (const name of ['cook','history','backups']) {
    $(name+'View').hidden = name !== view;
    $('nav'+name[0].toUpperCase()+name.slice(1)).setAttribute('aria-pressed', String(name === view));
  }
  if(window.__ldcNavigation)window.__ldcNavigation.afterView(next,scroll);
  else if (scroll) (document.getElementById('ldc-scroll') || window).scrollTo({top:0,behavior:'instant'});
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
    draftBases.set(draftKey(form),currentDraftBase(current,form));
    feedback(form,'Unsaved changes. Tap Save to include them in cooking backups.');updateDraftNotice();persistDrafts();
  };
  $(form).addEventListener('input',changed);$(form).addEventListener('change',changed);
}
function restoreDrafts() {
  for(const form of editForms){
    const draft=drafts.get(draftKey(form));
    if(draft && form==='profileForm'){try{const base=JSON.parse(draftBases.get(draftKey(form))),cook=journal.find(c=>c.id===current);for(const [field,key] of [['editStart','startedAt'],['editFinish','finishedAt']])if(draft[field]===localDate(base[key]))draft[field]=localDate(cook[key]);}catch{}}
    if(draft && form==='profileForm')rebuildFireboardRows(Object.keys(draft).filter(id=>/^fbRole\d+$/.test(id)).map(id=>Number(id.slice(6))));
    if(draft){for(const kind of ['piece','rub']){const ids=[...new Set(Object.keys(draft).filter(id=>new RegExp('^'+kind+(kind==='piece'?'meatCut':'name')+'\\d+$').test(id)).map(id=>Number(id.match(/\d+$/)[0])))];rebuildStructuredRows(kind,ids.map(()=>kind==='piece'?blankMeatPiece():{name:'',level:'Not recorded',notes:''}));}}
    if(draft)for(const [id,value] of Object.entries(draft)){const e=$(id);if(!e || !$(form).contains(e))continue;if(e.type==='checkbox')e.checked=value;else if(e.tagName!=='SELECT' || [...e.options].some(o=>o.value===value))e.value=value;else if(id==='type')e.value='Note';}
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
  window.__ldcNavigation?.beforeView();
  const previous=current,lockedFields=[...document.querySelectorAll('input,select,textarea')].map(e=>[e,e.disabled]);let locked=true;
  busy=true;document.querySelectorAll('button').forEach(e=>e.disabled=true);for(const [e] of lockedFields)e.disabled=true;
  const unlock=()=>{if(!locked)return;locked=false;document.querySelectorAll('button').forEach(e=>e.disabled=false);for(const [e,disabled] of lockedFields)e.disabled=disabled;};
  try {await draftWriteQueue;await render(()=>{current=id;unlock();});showView('cook');}
  catch(e){current=previous;status(e.message,true);}
  finally{unlock();busy=false;const cook=journal.find(c=>c.id===current);if(cook)cookingActions(cook);window.__ldcNavigation?.refresh();if(damaged)$('new').querySelector('button').disabled=true;}
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
async function render(beforePaint) {
  window.__ldcNavigation?.beforeView();
  const {state} = await store.read(), query = $('search').value.toLowerCase();
  beforePaint?.();
  journal = state.records;hydrateDrafts();if(draftError)draftFeedback(draftError,true);
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
  if(!current && !damaged)current=state.records.filter(c=>c.source==='LDCookLog 2.0' && !c.isTestCook && !c.finishedAt && c.phase!=='Finished').sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0]?.id || window.__ldcNavigation?.lastCook(state.records) || null;
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
    $('editLocation').value=cook.cookingDetails?.location ?? cook.legacy?.lookups?.locations?.[0]?.name ?? '';
    $('editRecipeReference').value=cook.cookingDetails?.recipeReference ?? cook.legacy?.lookups?.cook_methods?.[0]?.source_reference ?? '';
    $('locationLibrary').replaceChildren(new Option('Choose saved location…',''),...setupChoices(state,'locations').map(name=>new Option(name,name)));
    savedRecipeChoices=recipeChoices(state);$('recipeLibrary').replaceChildren(new Option('Choose saved method / recipe…',''),...savedRecipeChoices.map(r=>new Option(r.name,r.name)));
    rebuildStructuredRows('piece',meatPiecesFor(cook));rebuildStructuredRows('rub',rubApplicationsFor(cook));
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
  window.__ldcNavigation?.render({records:journal,cooks,current,view,openCook});
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
  input.value=value;if(kind==='rubs'){const rows=structuredRows('rub',false);if(!rows.some(r=>r.name.trim().toLowerCase()===name.toLowerCase()) && rows.length<64){rows.push({name,level:'Not recorded',notes:''});rebuildStructuredRows('rub',rows);}}if(kind==='equipment'){$('equipmentChoice').value='__custom__';$('equipmentCustom').hidden=false;}
  input.dispatchEvent(new Event('input',{bubbles:true}));
};
function refreshWrap(){$('wrapOther').hidden=$('wrapMethod').value!=='Other';$('wrapDetail').required=!$('wrapOther').hidden;}
$('wrapMethod').onchange=refreshWrap;
$('wrapForm').onsubmit=e=>{e.preventDefault();if(current)action(async()=>{
  const note=$('wrapNote').value,fromAction=$('type').value==='Wrapped' && $('note').value===note;
  await store.event(current,'Wrapped',note,{wrapMethod:$('wrapMethod').value,wrapDetail:$('wrapMethod').value==='Other'?$('wrapDetail').value:''});
  if(fromAction){drafts.delete(draftKey('event'));draftBases.delete(draftKey('event'));$('note').value='';}
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
  if(fromAction){drafts.delete(draftKey('event'));draftBases.delete(draftKey('event'));$('note').value='';}
},'targetsForm');};
$('profileForm').onsubmit=e=>{e.preventDefault();if(!current)return;const value={food:$('editFood').value,cooker:$('editCooker').value,startedAt:$('editStart').value,finishedAt:$('editFinish').value,isTestCook:$('editTest').checked,location:$('editLocation').value,recipeReference:$('editRecipeReference').value,meatPieces:structuredRows('piece'),rubApplications:structuredRows('rub'),rating:$('editRating').value?Number($('editRating').value):null,trim:$('editTrim').value,brineMarinade:$('editBrine').value,injection:$('editInjection').value,binder:$('editBinder').value,fireboardSetup:fireboardSetupValue()};for(const key of ['method','weight','equipment','preparation','rubs','sauces'])value[key]=$('edit'+key[0].toUpperCase()+key.slice(1)).value;const original=journal.find(c=>c.id===current);if(value.startedAt===localDate(original.startedAt))value.startedAt=original.startedAt;if(value.finishedAt===localDate(original.finishedAt))value.finishedAt=original.finishedAt;action(async()=>{if(value.finishedAt && !original.finishedAt){if (!confirm(`Finish ${original.food}? Saving this finish time stops the cook timer and prevents new cooking actions.`))return false;}return store.profile(current,value);},'profileForm');};
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
    await draftWriteQueue;
    const changed = await work();
    if(changed!==false){if(key){drafts.delete(key);draftBases.delete(key);}damaged=false;$('backupBrief').textContent='Saved locally · checking backups';}
    await render();
    if(changed!==false){for(const draftKey of drafts.keys()){const at=draftKey.lastIndexOf(':'),id=draftKey.slice(0,at),name=draftKey.slice(at+1);draftBases.set(draftKey,currentDraftBase(id,name));}await persistDrafts();}
    const text=changed===false?'Cancelled. Your journal was unchanged.':'Saved on this device. A recovery snapshot was created automatically.';
    status(text);if(form)feedback(form,text);updateDraftNotice();
  }
  catch (e) { status(e.message, true);if(form)feedback(form,e.message,true); }
  finally {
    busy = false; document.querySelectorAll('button').forEach(b => b.disabled = false);
    for(const [e,disabled] of lockedFields)e.disabled=disabled;
    if (damaged) $('new').querySelector('button').disabled = true;
    const selected=journal.find(c=>c.id===current);if(selected){cookingActions(selected);refreshComparison();refreshFireboardSetup();}
    window.__ldcNavigation?.refresh();
    await protection();
  }
}
async function restore(envelope) {
  const body = await unseal(envelope);
  if (!confirm(`Restore ${body.state.records.length} cooks from ${fmt(body.createdAt)}? This replaces the current journal. Existing recovery snapshots are kept. Unsaved edits will be discarded. Keep your original database archive.`)) return false;
  if (damaged) await call('repair', {text:JSON.stringify(envelope)}); else await store.restore(envelope);
  current = null;drafts.clear();draftBases.clear();showView('history');
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
  if(current)action(async()=>{if(type==='Cook Finished'){if (!confirm(`Finish ${journal.find(c=>c.id===current)?.food || 'this cook'}? This stops the cook timer and prevents new cooking actions. Choose Cancel to keep cooking.`))return false;}await store.event(current,type,$('note').value);$('note').value='';},'event');
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
  try { await render(); status('Journal ready. Offline cooking pilot.');window.__ldcNavigation?.restorePosition(); }
  catch (e) { damaged = true;showView('backups',false);$('recoveryTools').open=true; $('new').querySelector('button').disabled = true; status('Journal could not open. Choose a recovery snapshot; no data was reset. '+e.message,true); }
  setInterval(updateTimers,1000);
  await protection();
  setInterval(() => { if (!busy && !document.hidden) protection(); },30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden){updateTimers();if(!busy)protection();} });
})();
