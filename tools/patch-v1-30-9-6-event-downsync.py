from pathlib import Path
INDEX=Path('index.html'); SW=Path('service-worker.js')
html=INDEX.read_text(encoding='utf-8')
MARK='LDCookLog Mobile V1.30.9.6 event down-sync'
if MARK not in html:
    script=r'''
<script>
// LDCookLog Mobile V1.30.9.6 event down-sync
(() => {
 const BUILD='2026-09-16O';
 document.title='LDCookLog Mobile V1.30.9.6';
 const h=document.querySelector('header .sub'); if(h)h.textContent='V1.30.9.6 Stateful BBQ Control Panel';
 const f=document.querySelector('.footer-note'); if(f)f.innerHTML=`V1.30.9.6 makes cloud-event down-sync callable after active-cook adoption and on startup, so every device converges to the complete cloud event history.<br><strong>Build ${BUILD}</strong>`;
 let busy=false;
 async function pull(){
  if(busy||!state||state.cloudConflict||!state.start||!state.cookId||!state.cloudCookUuid)return false;
  let s=loadCloudSession(); if(!s||!s.access_token)return false; busy=true;
  try{
   async function get(){const r=await fetch(`${SUPABASE_URL}/rest/v1/events?select=id,event_type,event_time,note,target_temp,phase,smoker,setup_context&cook_id=eq.${encodeURIComponent(state.cloudCookUuid)}&order=event_time.asc`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${s.access_token}`,Accept:'application/json'}});if(r.status===401)throw Object.assign(new Error('Session expired.'),{code:401});const x=await r.json();if(!r.ok)throw new Error(x.message||x.hint||x.details||'Cloud events could not be read.');return x}
   let rows; try{rows=await get()}catch(e){if(e.code!==401)throw e;s=await refreshCloudSession(s);rows=await get()}
   const local=Array.isArray(state.events)?state.events:[]; const ids=new Map();
   for(const e of local){ensureEventId(e);ids.set(e.eventId,e)}
   let added=0;
   for(const e of rows){if(ids.has(e.id)){ids.get(e.id).cloudSynced=true;continue}const x={eventId:e.id,cloudSynced:true,cookId:state.cookId,ts:e.event_time,type:e.event_type,note:e.note||'',target:e.target_temp==null?'':e.target_temp,phase:e.phase||state.phase,smoker:e.smoker||state.smoker,cookName:state.cookName||'Cook',weight:state.weight||'',setup:e.setup_context||'Recovered from Supabase'};local.push(x);ids.set(x.eventId,x);added++}
   local.sort((a,b)=>String(a.ts||'').localeCompare(String(b.ts||''))); state.events=local;
   if(added){const r=reconstructEventStates(local.map(e=>({event_type:e.type,event_time:e.ts,note:e.note||''})));state.lidOpen=r.lidOpen;state.wrapped=r.wrapped;state.meatOn=state.finishTime?false:r.meatOn;if(r.wrapMethod)state.wrapMethod=r.wrapMethod}
   state.cloudSyncMessage='';save();render();renderCloudSyncState();return true;
  }catch(e){state.cloudSyncMessage=`Cloud event download warning: ${e.message}\nLocal events are safe and can be retried.`;save();renderCloudSyncState();return false}finally{busy=false}
 }
 window.mergeCloudEventsForCurrentCookV1303=pull;
 window.pullCompleteCloudEventsV13096=pull;
 const prior=window.adoptNewestActiveCloudCookV13095;
 if(typeof prior==='function')window.adoptNewestActiveCloudCookV13095=async function(){const adopted=await prior.apply(this,arguments);await pull();return adopted};
 setTimeout(pull,4200);
})();
</script>
'''
    html=html.replace('</body>',script+'\n</body>',1); INDEX.write_text(html,encoding='utf-8')
sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-9-5' in sw:sw=sw.replace('ldcooklog-v1-30-9-5','ldcooklog-v1-30-9-6',1)
elif 'ldcooklog-v1-30-9-6' not in sw:raise SystemExit('Unexpected cache version')
SW.write_text(sw,encoding='utf-8');print('Patched V1.30.9.6')
