from pathlib import Path
INDEX=Path('index.html'); SW=Path('service-worker.js')
html=INDEX.read_text(encoding='utf-8')
MARK='LDCookLog Mobile V1.30.12 startup race fix'
if MARK not in html:
    # Disable the legacy 800ms current-cook sync. On a stale second device it
    # creates a conflict against the old cook before cross-device discovery runs.
    old='if(loadCloudSession()){cloudReadCooks();if(state.start)setTimeout(()=>syncCurrentCookAndEvents(),800)}'
    new='if(loadCloudSession()){cloudReadCooks();/* V1.30.12: startup reconciliation owns automatic startup sync */}'
    if old not in html: raise SystemExit('Legacy 800ms startup sync not found')
    html=html.replace(old,new,1)

    # Disable V1.30.3's old UUID-specific 1500ms startup pull. It can only pull
    # events for the stale local parent and competes with active-cook discovery.
    old2='if(loadCloudSession()&&state.start) setTimeout(()=>mergeCloudEventsV1303(),1500);'
    new2='/* V1.30.12: legacy UUID-specific startup event pull disabled; centralized reconciliation handles startup. */'
    if old2 not in html: raise SystemExit('Legacy V1.30.3 startup pull not found')
    html=html.replace(old2,new2,1)

    # Remove V1.30.11 routine and replace it with one early authoritative routine.
    pos=html.find('// LDCookLog Mobile V1.30.11 startup gate diagnostics')
    if pos<0: raise SystemExit('V1.30.11 script not found')
    start=html.rfind('<script>',0,pos); end=html.find('</script>',pos)
    if start<0 or end<0: raise SystemExit('Could not isolate V1.30.11 script')
    html=html[:start]+html[end+9:]
    script=r'''
<script>
// LDCookLog Mobile V1.30.12 startup race fix
(() => {
 const BUILD='2026-09-16U'; let busy=false;
 document.title='LDCookLog Mobile V1.30.12';
 const h=document.querySelector('header .sub'); if(h)h.textContent='V1.30.12 Stateful BBQ Control Panel';
 const f=document.querySelector('.footer-note'); if(f)f.innerHTML=`V1.30.12 removes legacy startup sync races so active-cook discovery runs before any stale-cook conflict check.<br><strong>Build ${BUILD}</strong>`;
 async function req(s,path){let r=await fetch(`${SUPABASE_URL}${path}`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${s.access_token}`,Accept:'application/json'}});if(r.status===401){s=await refreshCloudSession(s);r=await fetch(`${SUPABASE_URL}${path}`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${s.access_token}`,Accept:'application/json'}})}const x=await r.json();if(!r.ok)throw new Error(x.message||x.hint||x.details||'Cloud read failed.');return {rows:Array.isArray(x)?x:[],session:s}}
 function seq(id){const m=String(id||'').match(/^(\d{8})-(\d+)$/);return m?[Number(m[1]),Number(m[2])]:[0,0]}
 function cmp(a,b){const A=seq(a.cook_id),B=seq(b.cook_id);if(A[0]!==B[0])return B[0]-A[0];if(A[1]!==B[1])return B[1]-A[1];return (Date.parse(b.start_time)||0)-(Date.parse(a.start_time)||0)}
 async function run(){if(busy||!state)return false;let s=loadCloudSession();if(!s||!s.access_token){state.cloudSyncMessage='Startup reconciliation: no cloud session.';save();renderCloudSyncState();return false}
   const pending=(state.events||[]).filter(e=>e&&e.cloudSynced===false);if(pending.length){state.cloudSyncMessage=`Startup reconciliation paused: ${pending.length} unsynced local event(s) are protected.`;save();renderCloudSyncState();return false}
   busy=true;try{
    let q=await req(s,'/rest/v1/cooks?select=id,cook_id,start_time,finish_time,phase,updated_at&cook_id=not.is.null&start_time=not.is.null&order=start_time.desc&limit=100');s=q.session;
    const candidates=q.rows.filter(c=>c&&c.id&&c.cook_id&&c.start_time).sort(cmp);const newest=candidates[0];const seen=candidates.slice(0,5).map(c=>`${c.cook_id} [${c.phase||'—'}, ${c.finish_time?'finished':'open'}]`).join(' | ');
    if(!newest){state.cloudConflict=false;state.cloudSyncMessage='Startup reconciliation reached Supabase but found no cook rows with Cook ID + start time.';save();renderCloudSyncState();return false}
    const A=seq(state.cookId),B=seq(newest.cook_id);const newerId=B[0]>A[0]||(B[0]===A[0]&&B[1]>A[1]);const localStart=state.start?Date.parse(String(state.start)):0,cloudStart=Date.parse(newest.start_time)||0;
    if(!state.cookId||newest.cook_id!==state.cookId){if(state.cookId&&!newerId&&cloudStart<=localStart){state.cloudConflict=false;state.cloudSyncMessage=`Startup reconciliation saw ${seen}; retained ${state.cookId}.`;save();renderCloudSyncState();return false}const recovery=await fetchCloudCookRecovery(s.access_token,newest.id);applyCloudRecovery(recovery)}
    state.cloudConflict=false;
    q=await req(s,`/rest/v1/cooks?select=id,cook_id,start_time,finish_time,phase,updated_at&cook_id=eq.${encodeURIComponent(state.cookId)}&order=start_time.asc`);s=q.session;const parents=q.rows;if(!parents.length)throw new Error(`No parent row for ${state.cookId}`);
    const canonical=parents.slice().sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')))[0];state.cloudCookUuid=canonical.id;state.cloudCookSynced=true;state.cloudCookStateSynced=true;state.cloudLastSeenUpdatedAt=canonical.updated_at||null;
    let rows=[];for(const p of parents){q=await req(s,`/rest/v1/events?select=id,event_type,event_time,note,target_temp,phase,smoker,setup_context&cook_id=eq.${encodeURIComponent(p.id)}&order=event_time.asc`);s=q.session;rows.push(...q.rows)}const u=new Map();for(const e of rows)if(e&&e.id)u.set(e.id,e);rows=[...u.values()].sort((a,b)=>String(a.event_time||'').localeCompare(String(b.event_time||'')));
    const local=Array.isArray(state.events)?state.events:[],ids=new Map();for(const e of local){ensureEventId(e);ids.set(e.eventId,e)}let added=0;for(const e of rows){if(ids.has(e.id)){ids.get(e.id).cloudSynced=true;continue}const x={eventId:e.id,cloudSynced:true,cookId:state.cookId,ts:e.event_time,type:e.event_type,note:e.note||'',target:e.target_temp==null?'':e.target_temp,phase:e.phase||state.phase,smoker:e.smoker||state.smoker,cookName:state.cookName||'Cook',weight:state.weight||'',setup:e.setup_context||'Recovered from Supabase'};local.push(x);ids.set(x.eventId,x);added++}local.sort((a,b)=>String(a.ts||'').localeCompare(String(b.ts||'')));state.events=local;if(added){const r=reconstructEventStates(local.map(e=>({event_type:e.type,event_time:e.ts,note:e.note||''})));state.lidOpen=r.lidOpen;state.wrapped=r.wrapped;state.meatOn=state.finishTime?false:r.meatOn;if(r.wrapMethod)state.wrapMethod=r.wrapMethod}
    state.cloudSyncMessage=`Startup reconciliation saw: ${seen}. Selected ${state.cookId}; ${parents.length} parent row(s); ${rows.length} unique cloud event(s).`;save();render();renderCloudSyncState();return true;
   }catch(e){state.cloudConflict=false;state.cloudSyncMessage=`Startup reconciliation ERROR: ${e.message}`;save();render();renderCloudSyncState();return false}finally{busy=false}}
 window.reconcileCloudStartupV13012=run;setTimeout(run,500);
})();
</script>
'''
    html=html.replace('</body>',script+'\n</body>',1)
    INDEX.write_text(html,encoding='utf-8')
sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-11' in sw: sw=sw.replace('ldcooklog-v1-30-11','ldcooklog-v1-30-12',1)
elif 'ldcooklog-v1-30-12' not in sw: raise SystemExit('Unexpected cache version')
SW.write_text(sw,encoding='utf-8')
print('Patched V1.30.12 startup race fix')
