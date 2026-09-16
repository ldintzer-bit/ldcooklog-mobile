from pathlib import Path
INDEX=Path('index.html');SW=Path('service-worker.js')
html=INDEX.read_text(encoding='utf-8')
MARK='LDCookLog Mobile V1.30.9.8 Cook ID event recovery'
if MARK not in html:
 script=r'''
<script>
// LDCookLog Mobile V1.30.9.8 Cook ID event recovery
(() => {
 const BUILD='2026-09-16Q';
 document.title='LDCookLog Mobile V1.30.9.8';
 const h=document.querySelector('header .sub');if(h)h.textContent='V1.30.9.8 Stateful BBQ Control Panel';
 const f=document.querySelector('.footer-note');if(f)f.innerHTML=`V1.30.9.8 traces cloud event membership by Cook ID: it resolves every Supabase cook row for the current Cook ID and merges events from all matching UUIDs, preventing split/duplicate parent rows from hiding part of a cook history.<br><strong>Build ${BUILD}</strong>`;
 let busy=false;
 async function run(){
  if(busy||!state||state.cloudConflict||!state.cookId)return false;
  let s=loadCloudSession();if(!s||!s.access_token)return false;busy=true;
  try{
   async function req(path){let r=await fetch(`${SUPABASE_URL}${path}`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${s.access_token}`,Accept:'application/json'}});if(r.status===401){s=await refreshCloudSession(s);r=await fetch(`${SUPABASE_URL}${path}`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${s.access_token}`,Accept:'application/json'}})}const x=await r.json();if(!r.ok)throw new Error(x.message||x.hint||x.details||'Cloud read failed.');return Array.isArray(x)?x:[]}
   const cooks=await req(`/rest/v1/cooks?select=id,cook_id,start_time,finish_time,phase,updated_at&cook_id=eq.${encodeURIComponent(state.cookId)}&order=start_time.asc`);
   if(!cooks.length)return false;
   // The newest matching parent remains the canonical UUID, but event recovery
   // reads every matching UUID because earlier code could create duplicate rows.
   const canonical=cooks.slice().sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')))[0];
   state.cloudCookUuid=canonical.id;state.cloudCookSynced=true;state.cloudCookStateSynced=true;state.cloudLastSeenUpdatedAt=canonical.updated_at||state.cloudLastSeenUpdatedAt;
   let rows=[];
   for(const c of cooks){const ev=await req(`/rest/v1/events?select=id,event_type,event_time,note,target_temp,phase,smoker,setup_context,cook_id&cook_id=eq.${encodeURIComponent(c.id)}&order=event_time.asc`);rows.push(...ev)}
   const unique=new Map();for(const e of rows)if(e&&e.id)unique.set(e.id,e);rows=[...unique.values()].sort((a,b)=>String(a.event_time||'').localeCompare(String(b.event_time||'')));
   const local=Array.isArray(state.events)?state.events:[];const ids=new Map();for(const e of local){ensureEventId(e);ids.set(e.eventId,e)}
   let added=0;for(const e of rows){if(ids.has(e.id)){ids.get(e.id).cloudSynced=true;continue}const x={eventId:e.id,cloudSynced:true,cookId:state.cookId,ts:e.event_time,type:e.event_type,note:e.note||'',target:e.target_temp==null?'':e.target_temp,phase:e.phase||state.phase,smoker:e.smoker||state.smoker,cookName:state.cookName||'Cook',weight:state.weight||'',setup:e.setup_context||'Recovered from Supabase'};local.push(x);ids.set(x.eventId,x);added++}
   local.sort((a,b)=>String(a.ts||'').localeCompare(String(b.ts||'')));state.events=local;
   if(added){const r=reconstructEventStates(local.map(e=>({event_type:e.type,event_time:e.ts,note:e.note||''})));state.lidOpen=r.lidOpen;state.wrapped=r.wrapped;state.meatOn=state.finishTime?false:r.meatOn;if(r.wrapMethod)state.wrapMethod=r.wrapMethod}
   state.cloudSyncMessage=`Cloud recovery checked ${cooks.length} parent row${cooks.length===1?'':'s'} for ${state.cookId} and found ${rows.length} unique cloud event${rows.length===1?'':'s'}.`;save();render();renderCloudSyncState();return true;
  }catch(e){state.cloudSyncMessage=`Cloud Cook-ID recovery warning: ${e.message}\nLocal events are safe and can be retried.`;save();renderCloudSyncState();return false}finally{busy=false}
 }
 window.recoverEventsByCookIdV13098=run;setTimeout(run,6000);
})();
</script>
'''
 html=html.replace('</body>',script+'\n</body>',1);INDEX.write_text(html,encoding='utf-8')
sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-9-7' in sw:sw=sw.replace('ldcooklog-v1-30-9-7','ldcooklog-v1-30-9-8',1)
elif 'ldcooklog-v1-30-9-8' not in sw:raise SystemExit('Unexpected cache version')
SW.write_text(sw,encoding='utf-8');print('Patched V1.30.9.8')
