import { CookStore, unseal } from './recovery.js';
import { RELATIONAL_FORMAT } from './migration.js';
import { seriesKey, comparisonSeries } from './fireboard.js';
const $ = id => document.getElementById(id);
const call = (operation, args = {}) => (window.ldcooklogHost || window.webkit.messageHandlers.recovery).postMessage({operation, ...args});
const store = new CookStore({ read: () => call('read'), commit: (text, expectedRevision) => call('commit', {text, expectedRevision}) });
let current = null, busy = false, damaged = false, journal = [];
const comparisonSelections=new Map();
const comparisonSlots=[['compareCook','compareProbe'],['compareCook2','compareProbe2'],['compareCook3','compareProbe3']];
const chartColors=[['gold','#daba7c'],['blue','#91c8e8'],['coral','#f3a28b'],['lavender','#c5a9f0']];
const status = (text, error = false) => { $('status').textContent = text; $('status').dataset.error = String(error); };
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
  try { const result = await call('backupStatus'); $('protection').textContent = `${result.message} ${result.local} local snapshots; ${result.uploaded} confirmed uploaded; ${result.pending} pending.`; }
  catch { $('protection').textContent = 'iCloud backup could not complete. Your local saves remain available. Retry when connected.'; }
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
    open.textContent = 'Open cook'; open.onclick = () => { current = cook.id; render().then(() => $('active').scrollIntoView({behavior:'smooth'})).catch(e => status(e.message, true)); };
    article.append(title,text,open); $('history').append(article);
  }
  const cook = state.records.find(c => c.id === current);
  $('active').hidden = !cook;
  $('review').hidden = !cook;
  $('profile').hidden = !cook;
  if (cook) {
    $('title').textContent = `${cook.food} · ${cook.cooker}`;
    const phase = cook.phase || (cook.finishedAt ? 'Finished' : 'Cooking');
    $('phase').textContent = `${phase} · started ${fmt(cook.startedAt)}${cook.finishedAt ? ' · finished '+fmt(cook.finishedAt) : ''}`;
    $('event').querySelector('button').disabled = phase === 'Finished';
    $('timeline').replaceChildren();
    for (const event of cook.events) { const li = document.createElement('li'); li.textContent = `${fmt(event.at)} — ${event.type}${event.note ? ': '+event.note : ''}`; $('timeline').append(li); }
    const channels = [...new Set(cook.temperatures.map(t => `${t.channel} (${t.unit || 'unknown unit'})`))];
    $('temperatures').textContent = `${cook.temperatures.length} retained readings. ${channels.join(', ')}${channels.length ? '.' : ''}`;
    const related = cook.legacy?.related || {};
    $('details').textContent = `${cook.notes || 'No notes recorded.'} ${Object.entries(related).filter(([,rows]) => rows.length).map(([name,rows]) => `${name.replaceAll('_',' ')}: ${rows.length}`).join(' · ')}`;
    $('editFood').value=cook.food;$('editCooker').value=cook.cooker;
    $('editStart').value=localDate(cook.startedAt);$('editFinish').value=localDate(cook.finishedAt);$('editTest').checked=!!cook.isTestCook;
    for (const key of ['method','weight','equipment','preparation','rubs','sauces']) $('edit'+key[0].toUpperCase()+key.slice(1)).value=cook.cookingDetails?.[key] || '';
    for(const kind of ['method','equipment']) loadSetupChoice(kind,cook.cookingDetails?.[kind] || '');
    $('editRating').value=cook.cookingDetails?.rating || '';
    const preserved={};
    for (const key of ['cook_meat_pieces','cook_methods','cook_preparation','cook_equipment','cook_rubs','cook_sauces','cook_evaluations','weather']) if (related[key]?.length) preserved[key]=related[key];
    for (const key of ['equipment','rubs','sauces','locations','cook_methods']) if (cook.legacy?.lookups?.[key]?.length) preserved[key]=cook.legacy.lookups[key];
    $('legacyDetails').textContent=Object.keys(preserved).length ? JSON.stringify(preserved,null,2) : 'No original structured details recorded. New details are saved above.';
    $('cookNotes').value = cook.notes || '';
    $('evaluation').value = cook.evaluation || '';
    refreshComparison();
  }
}
function fillProbes(select,cook,previous=select.value) {
  select.replaceChildren();
  const series = new Map((cook?.temperatures || []).map(t=>[seriesKey(t),t]));
  for (const [key,t] of series) select.append(new Option(`${t.channel} · ${t.unit || 'unknown'} · session ${t.sessionId || 'unrecorded'} · probe ${t.channelId || t.channel}`,key));
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
    const series=selected.map((row,i)=>({name:row.cook.food,label:chartColors[i][0],color:chartColors[i][1],probe:row.cook.temperatures.find(t=>seriesKey(t)===row.key)?.channel || '',points:comparisonSeries(row.cook,row.key)}));
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
$('profileForm').onsubmit=e=>{e.preventDefault();if(!current)return;const value={food:$('editFood').value,cooker:$('editCooker').value,startedAt:$('editStart').value,finishedAt:$('editFinish').value,isTestCook:$('editTest').checked,rating:$('editRating').value?Number($('editRating').value):null};for(const key of ['method','weight','equipment','preparation','rubs','sauces'])value[key]=$('edit'+key[0].toUpperCase()+key.slice(1)).value;const original=journal.find(c=>c.id===current);if(value.startedAt===localDate(original.startedAt))value.startedAt=original.startedAt;if(value.finishedAt===localDate(original.finishedAt))value.finishedAt=original.finishedAt;action(()=>store.profile(current,value));};
$('showTests').onchange=()=>render().catch(e=>status(e.message,true));
$('reviewForm').onsubmit=e=>{e.preventDefault();if(current)action(()=>store.details(current,$('cookNotes').value,$('evaluation').value));};
$('sessionFile').onchange=e=>{const file=e.target.files?.[0];if(!file || !current)return;action(async()=>{try{if(file.size>100*1024*1024)throw Error('Session file too large');await store.importSession(current,JSON.parse(await file.text()));}finally{e.target.value='';}});};
async function action(work) {
  if (busy) return;
  busy = true; document.querySelectorAll('button').forEach(b => b.disabled = true);
  try { const changed = await work(); await render(); damaged = false; status(changed === false ? 'Cancelled. Your journal was unchanged.' : 'Saved on this device. A recovery snapshot was created automatically.'); }
  catch (e) { status(e.message, true); }
  finally { busy = false; document.querySelectorAll('button').forEach(b => b.disabled = false); if (damaged) $('new').querySelector('button').disabled = true; const selected=journal.find(c=>c.id===current); if(selected && (selected.phase==='Finished' || selected.finishedAt)) $('event').querySelector('button').disabled=true; await protection(); }
}
async function restore(envelope) {
  const body = await unseal(envelope);
  if (!confirm(`Restore ${body.state.records.length} cooks from ${fmt(body.createdAt)}? This replaces the current journal. Existing recovery snapshots are kept. Use only synthetic data until iPhone acceptance testing is complete.`)) return false;
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
        if (!confirm('Import the complete database export? Conflicting cook IDs stop the import. Keep the original PostgreSQL backup.')) return false;
        const report = await store.migrate(value);
        alert(`Migration preserved ${report.audit.cooks} cooks, ${report.audit.events} events, ${report.audit.temperatureSamples} readings and all ${Object.keys(report.counts).length} source tables.`);
      } else return await restore(value);
    } finally { e.target.value = ''; }
  });
};
(async () => {
  if (!window.ldcooklogHost && !window.webkit?.messageHandlers?.recovery) { status('Open this development app through its iPhone host. Browser storage cannot provide automatic iCloud backups.',true); document.querySelectorAll('button,input,select').forEach(e => e.disabled = true); return; }
  try { await render(); status('Journal ready. Development build — use synthetic test cooks.'); }
  catch (e) { damaged = true; $('new').querySelector('button').disabled = true; status('Journal could not open. Choose a recovery snapshot; no data was reset. '+e.message,true); }
  await protection();
  setInterval(() => { if (!busy && !document.hidden) protection(); },30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !busy) protection(); });
})();
