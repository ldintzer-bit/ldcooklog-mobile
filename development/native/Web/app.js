import { CookStore, unseal } from './recovery.js';
import { RELATIONAL_FORMAT } from './migration.js';
import { seriesKey, comparisonSeries } from './fireboard.js';
const $ = id => document.getElementById(id);
const call = (operation, args = {}) => (window.ldcooklogHost || window.webkit.messageHandlers.recovery).postMessage({operation, ...args});
const store = new CookStore({ read: () => call('read'), commit: (text, expectedRevision) => call('commit', {text, expectedRevision}) });
let current = null, busy = false, damaged = false, journal = [];
const status = (text, error = false) => { $('status').textContent = text; $('status').dataset.error = String(error); };
const fmt = at => new Date(at).toLocaleString();
async function protection() {
  try { const result = await call('backupStatus'); $('protection').textContent = `${result.message} ${result.local} local snapshots; ${result.uploaded} confirmed uploaded; ${result.pending} pending.`; }
  catch { $('protection').textContent = 'iCloud backup could not complete. Your local saves remain available. Retry when connected.'; }
}
async function render() {
  const {state} = await store.read(), query = $('search').value.toLowerCase();
  journal = state.records;
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
  $('review').hidden = !cook;
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
    $('cookNotes').value = cook.notes || '';
    $('evaluation').value = cook.evaluation || '';
    fillProbes($('probe'),cook);
    const selected = $('compareCook').value;
    $('compareCook').replaceChildren(new Option('No comparison',''));
    for (const other of journal.filter(c=>c.id!==current && !c.isTestCook && c.temperatures.length)) $('compareCook').append(new Option(`${other.food} · ${fmt(other.startedAt)}`,other.id));
    if (journal.some(c=>c.id===selected)) $('compareCook').value = selected;
    updateCompare();
  }
}
function fillProbes(select,cook) {
  const previous = select.value;
  select.replaceChildren();
  const series = new Map((cook?.temperatures || []).map(t=>[seriesKey(t),t]));
  for (const [key,t] of series) select.append(new Option(`${t.channel} · ${t.unit || 'unknown'} · session ${t.sessionId || 'unrecorded'} · probe ${t.channelId || t.channel}`,key));
  if (series.has(previous)) select.value = previous;
}
function updateCompare() { fillProbes($('compareProbe'),journal.find(c=>c.id===$('compareCook').value)); drawChart(); }
function drawChart() {
  $('chart').replaceChildren();
  try {
    const first = journal.find(c=>c.id===current), second = journal.find(c=>c.id===$('compareCook').value);
    if (!first || !$('probe').value) { $('chartSummary').textContent = 'No temperature readings attached yet.'; return; }
    const series = [{name:first.food,color:'#daba7c',points:comparisonSeries(first,$('probe').value)}];
    if (second && $('compareProbe').value) series.push({name:second.food,color:'#91c8e8',points:comparisonSeries(second,$('compareProbe').value)});
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
      add('polyline',{fill:'none',stroke:row.color,'stroke-width':2,points:visible.map(p=>`${65+(p.minutes-minX)/(maxX-minX)*590},${250-(p.fahrenheit-minY)/(maxY-minY)*220}`).join(' ')});
    }
    $('chart').append(svg);
    $('chartSummary').textContent=series.map(s=>`${s.name} (${s.color==='#daba7c'?'gold':'blue'}): ${s.points.length} readings`).join(' · ')+'. Aligned by cook start; Celsius converted to Fahrenheit for display. Chart samples up to 601 points per series; all original readings are retained. Test cooks excluded from comparison choices.';
  } catch(e) { $('chartSummary').textContent=e.message; }
}
$('probe').onchange=drawChart;$('compareCook').onchange=updateCompare;$('compareProbe').onchange=drawChart;
$('reviewForm').onsubmit=e=>{e.preventDefault();if(current)action(()=>store.details(current,$('cookNotes').value,$('evaluation').value));};
$('sessionFile').onchange=e=>{const file=e.target.files?.[0];if(!file || !current)return;action(async()=>{try{if(file.size>100*1024*1024)throw Error('Session file too large');await store.importSession(current,JSON.parse(await file.text()));}finally{e.target.value='';}});};
async function action(work) {
  if (busy) return;
  busy = true; document.querySelectorAll('button').forEach(b => b.disabled = true);
  try { const changed = await work(); await render(); damaged = false; status(changed === false ? 'Cancelled. Your journal was unchanged.' : 'Saved on this device. A recovery snapshot was created automatically.'); }
  catch (e) { status(e.message, true); }
  finally { busy = false; document.querySelectorAll('button').forEach(b => b.disabled = false); if (damaged) $('new').querySelector('button').disabled = true; await protection(); }
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
