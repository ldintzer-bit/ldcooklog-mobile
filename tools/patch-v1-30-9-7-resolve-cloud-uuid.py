from pathlib import Path
INDEX=Path('index.html'); SW=Path('service-worker.js')
html=INDEX.read_text(encoding='utf-8')
MARK='LDCookLog Mobile V1.30.9.7 resolve cloud UUID'
if MARK not in html:
    script=r'''
<script>
// LDCookLog Mobile V1.30.9.7 resolve cloud UUID
(() => {
 const BUILD='2026-09-16P';
 document.title='LDCookLog Mobile V1.30.9.7';
 const h=document.querySelector('header .sub');if(h)h.textContent='V1.30.9.7 Stateful BBQ Control Panel';
 const f=document.querySelector('.footer-note');if(f)f.innerHTML=`V1.30.9.7 resolves the current Cook ID to its authoritative Supabase cook UUID before event recovery, preventing a stale UUID from pulling the wrong event history.<br><strong>Build ${BUILD}</strong>`;
 let busy=false;
 async function run(){
  if(busy||!state||state.cloudConflict||!state.cookId)return false;
  let s=loadCloudSession();if(!s||!s.access_token)return false;busy=true;
  try{
   async function resolve(){const r=await fetch(`${SUPABASE_URL}/rest/v1/cooks?select=id,cook_id,start_time,finish_time,phase,updated_at&cook_id=eq.${encodeURIComponent(state.cookId)}&order=updated_at.desc&limit=1`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${s.access_token}`,Accept:'application/json'}});if(r.status===401)throw Object.assign(new Error('Session expired.'),{code:401});const x=await r.json();if(!r.ok)throw new Error(x.message||x.hint||x.details||'Cloud cook could not be resolved.');return Array.isArray(x)&&x.length?x[0]:null}
   let cook;try{cook=await resolve()}catch(e){if(e.code!==401)throw e;s=await refreshCloudSession(s);cook=await resolve()}
   if(!cook||!cook.id)return false;
   // Cook ID is the human identity; always repair the backing UUID from Supabase.
   state.cloudCookUuid=cook.id;state.cloudCookSynced=true;state.cloudCookStateSynced=true;state.cloudLastSeenUpdatedAt=cook.updated_at||state.cloudLastSeenUpdatedAt;state.cloudConflict=false;save();
   // Fetch the complete recovery using the authoritative UUID, then merge only cloud events
   // into the current local cook so local-only unsynced events remain protected.
   let recovery=await fetchCloudCookRecovery(s.access_token,cook.id);
   const rows=recovery&&Array.isArray(recovery.events)?recovery.events:[];
   const local=Array.isArray(state.events)?state.events:[];const ids=new Map();
   for(const e of local){ensureEventId(e);ids.set(e.eventId,e)}
   let added=0;
   for(const e of rows){const id=e.id;if(!id)continue;if(ids.has(id)){ids.get(id).cloudSynced=true;continue}const x={eventId:id,cloudSynced:true,cookId:state.cookId,ts:e.event_time,type:e.event_type,note:e.note||'',target:e.target_temp==null?'':e.target_temp,phase:e.phase||state.phase,smoker:e.smoker||state.smoker,cookName:state.cookName||'Cook',weight:state.weight||'',setup:e.setup_context||'Recovered from Supabase'};local.push(x);ids.set(id,x);added++}
   local.sort((a,b)=>String(a.ts||'').localeCompare(String(b.ts||'')));state.events=local;
   if(added){const r=reconstructEventStates(local.map(e=>({event_type:e.type,event_time:e.ts,note:e.note||''})));state.lidOpen=r.lidOpen;state.wrapped=r.wrapped;state.meatOn=state.finishTime?false:r.meatOn;if(r.wrapMethod)state.wrapMethod=r.wrapMethod}
   state.cloudSyncMessage='';save();render();renderCloudSyncState();return true;
  }catch(e){state.cloudSyncMessage=`Cloud identity/event recovery warning: ${e.message}\nLocal events are safe and can be retried.`;save();renderCloudSyncState();return false}finally{busy=false}
 }
 window.resolveCurrentCookCloudUuidV13097=run;
 setTimeout(run,5000);
})();
</script>
'''
    html=html.replace('</body>',script+'\n</body>',1);INDEX.write_text(html,encoding='utf-8')
sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-9-6' in sw:sw=sw.replace('ldcooklog-v1-30-9-6','ldcooklog-v1-30-9-7',1)
elif 'ldcooklog-v1-30-9-7' not in sw:raise SystemExit('Unexpected cache version')
SW.write_text(sw,encoding='utf-8');print('Patched V1.30.9.7')
