from pathlib import Path
INDEX=Path('index.html');SW=Path('service-worker.js')
html=INDEX.read_text(encoding='utf-8')
MARK='LDCookLog Mobile V1.30.11 startup gate diagnostics'
if MARK not in html:
    pos=html.find('// LDCookLog Mobile V1.30.10 active cook discovery')
    if pos<0: raise SystemExit('V1.30.10 script not found')
    start=html.rfind('<script>',0,pos);end=html.find('</script>',pos)
    if start<0 or end<0: raise SystemExit('Could not isolate V1.30.10 script')
    html=html[:start]+html[end+9:]
    script=r'''
<script>
// LDCookLog Mobile V1.30.11 startup gate diagnostics
(() => {
 const BUILD='2026-09-16T';let busy=false;
 document.title='LDCookLog Mobile V1.30.11';const h=document.querySelector('header .sub');if(h)h.textContent='V1.30.11 Stateful BBQ Control Panel';
 const f=document.querySelector('.footer-note');if(f)f.innerHTML=`V1.30.11 fixes cross-device startup discovery being silently blocked by stale local sync flags and adds direct cloud-query diagnostics.<br><strong>Build ${BUILD}</strong>`;
 async function req(s,path){let r=await fetch(`${SUPABASE_URL}${path}`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${s.access_token}`,Accept:'application/json'}});if(r.status===401){s=await refreshCloudSession(s);r=await fetch(`${SUPABASE_URL}${path}`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${s.access_token}`,Accept:'application/json'}})}const x=await r.json();if(!r.ok)throw new Error(x.message||x.hint||x.details||'Cloud read failed.');return {rows:Array.isArray(x)?x:[],session:s}}
 function seq(id){const m=String(id||'').match(/^(\d{8})-(\d+)$/);return m?[Number(m[1]),Number(m[2])]:[0,0]}
 function cmp(a,b){const A=seq(a.cook_id),B=seq(b.cook_id);if(A[0]!==B[0])return B[0]-A[0];if(A[1]!==B[1])return B[1]-A[1];return (Date.parse(b.start_time)||0)-(Date.parse(a.start_time)||0)}
 function locallyDirty(){return (state.events||[]).some(e=>e&&e.cloudSynced===false)}
 async function run(){
   if(busy||!state)return false;
   let s=loadCloudSession();if(!s||!s.access_token){state.cloudSyncMessage='Startup discovery: no cloud session is available on this device.';save();renderCloudSyncState();return false}
   // Critical correction: cloudCookStateSynced=false is not proof of a local edit.
   // It is also used by older sync/error paths. Only genuinely unsynced local
   // events block automatic adoption. A stale conflict on a clean device is
   // cleared only after the newer cloud cook has been positively identified.
   if(locallyDirty()){state.cloudSyncMessage=`Startup discovery paused: ${state.events.filter(e=>e&&e.cloudSynced===false).length} local event(s) are not yet cloud-synced.`;save();renderCloudSyncState();return false}
   busy=true;try{
     let q=await req(s,'/rest/v1/cooks?select=id,cook_id,start_time,finish_time,phase,updated_at&cook_id=not.is.null&start_time=not.is.null&order=start_time.desc&limit=100');s=q.session;
     const candidates=q.rows.filter(c=>c&&c.id&&c.cook_id&&c.start_time).sort(cmp);const top=candidates.slice(0,5);const newest=top[0];
     if(!newest){state.cloudSyncMessage='Startup discovery queried Supabase successfully but found no cook rows with both Cook ID and start time.';save();renderCloudSyncState();return false}
     const seen=top.map(c=>`${c.cook_id} [${c.phase||'—'}, ${c.finish_time?'finished':'open'}]`).join(' | ');
     const localStart=state.start?(Number.isFinite(Number(state.start))?Number(state.start):Date.parse(String(state.start))):0;const cloudStart=Date.parse(newest.start_time)||0;const A=seq(state.cookId),B=seq(newest.cook_id);const newerId=B[0]>A[0]||(B[0]===A[0]&&B[1]>A[1]);
     if(state.cookId&&newest.cook_id!==state.cookId&&!newerId&&cloudStart<=localStart){state.cloudSyncMessage=`Startup discovery saw: ${seen}. Kept local ${state.cookId} because no newer cloud cook was identified.`;save();renderCloudSyncState();return false}
     if(!state.cookId||newest.cook_id!==state.cookId){const recovery=await fetchCloudCookRecovery(s.access_token,newest.id);applyCloudRecovery(recovery);state.cloudConflict=false;save();render()}
     q=await req(s,`/rest/v1/cooks?select=id,cook_id,start_time,finish_time,phase,updated_at&cook_id=eq.${encodeURIComponent(state.cookId)}&order=start_time.asc`);s=q.session;const parents=q.rows;if(!parents.length)throw new Error(`No parent row found for selected cook ${state.cookId}.`);
     const canonical=parents.slice().sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')))[0];state.cloudCookUuid=canonical.id;state.cloudCookSynced=true;state.cloudCookStateSynced=true;state.cloudLastSeenUpdatedAt=canonical.updated_at||state.cloudLastSeenUpdatedAt;state.cloudConflict=false;
     let rows=[];for(const p of parents){q=await req(s,`/rest/v1/events?select=id,event_type,event_time,note,target_temp,phase,smoker,setup_context&cook_id=eq.${encodeURIComponent(p.id)}&order=event_time.asc`);s=q.session;rows.push(...q.rows)}const unique=new Map();for(const e of rows)if(e&&e.id)unique.set(e.id,e);rows=[...unique.values()].sort((a,b)=>String(a.event_time||'').localeCompare(String(b.event_time||'')));
     const local=Array.isArray(state.events)?state.events:[];const ids=new Map();for(const e of local){ensureEventId(e);ids.set(e.eventId,e)}let added=0;for(const e of rows){if(ids.has(e.id)){ids.get(e.id).cloudSynced=true;continue}const x={eventId:e.id,cloudSynced:true,cookId:state.cookId,ts:e.event_time,type:e.event_type,note:e.note||'',target:e.target_temp==null?'':e.target_temp,phase:e.phase||state.phase,smoker:e.smoker||state.smoker,cookName:state.cookName||'Cook',weight:state.weight||'',setup:e.setup_context||'Recovered from Supabase'};local.push(x);ids.set(x.eventId,x);added++}local.sort((a,b)=>String(a.ts||'').localeCompare(String(b.ts||'')));state.events=local;if(added){const r=reconstructEventStates(local.map(e=>({event_type:e.type,event_time:e.ts,note:e.note||''})));state.lidOpen=r.lidOpen;state.wrapped=r.wrapped;state.meatOn=state.finishTime?false:r.meatOn;if(r.wrapMethod)state.wrapMethod=r.wrapMethod}
     state.cloudSyncMessage=`Startup discovery saw: ${seen}. Selected ${state.cookId}; ${parents.length} parent row(s); ${rows.length} unique cloud event(s).`;save();render();renderCloudSyncState();return true;
   }catch(e){state.cloudSyncMessage=`Startup discovery warning: ${e.message}\nLocal events are safe.`;save();renderCloudSyncState();return false}finally{busy=false}
 }
 window.reconcileCloudStartupV13011=run;setTimeout(run,3000);
})();
</script>
'''
    html=html.replace('</body>',script+'\n</body>',1);INDEX.write_text(html,encoding='utf-8')
sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-10' in sw:sw=sw.replace('ldcooklog-v1-30-10','ldcooklog-v1-30-11',1)
elif 'ldcooklog-v1-30-11' not in sw:raise SystemExit('Unexpected cache version')
SW.write_text(sw,encoding='utf-8');print('Patched V1.30.11 startup gate diagnostics')
