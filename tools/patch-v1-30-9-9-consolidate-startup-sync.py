from pathlib import Path
INDEX=Path('index.html');SW=Path('service-worker.js')
html=INDEX.read_text(encoding='utf-8')
MARK='LDCookLog Mobile V1.30.9.9 consolidated startup sync'
if MARK not in html:
    # Remove obsolete competing startup sync layers. Their timers were all still
    # live and could mutate state in sequence (2.2s, 2.6s, 4.2s, 5s, 6s).
    markers=[
      'LDCookLog Mobile V1.30.9.4 newer cloud cook adoption',
      'LDCookLog Mobile V1.30.9.5 active cook selection',
      'LDCookLog Mobile V1.30.9.6 event down-sync',
      'LDCookLog Mobile V1.30.9.7 resolve cloud UUID',
      'LDCookLog Mobile V1.30.9.8 Cook ID event recovery'
    ]
    for marker in markers:
        pos=html.find('// '+marker)
        if pos<0: continue
        start=html.rfind('<script>',0,pos)
        end=html.find('</script>',pos)
        if start>=0 and end>=0: html=html[:start]+html[end+9:]
    script=r'''
<script>
// LDCookLog Mobile V1.30.9.9 consolidated startup sync
(() => {
 const BUILD='2026-09-16R'; let busy=false;
 document.title='LDCookLog Mobile V1.30.9.9';
 const h=document.querySelector('header .sub');if(h)h.textContent='V1.30.9.9 Stateful BBQ Control Panel';
 const f=document.querySelector('.footer-note');if(f)f.innerHTML=`V1.30.9.9 replaces the competing V1.30.9.4–.8 startup timers with one authoritative cloud startup reconciliation.<br><strong>Build ${BUILD}</strong>`;
 function clean(){return state&&state.cloudCookStateSynced!==false&&!(state.events||[]).some(e=>e&&e.cloudSynced===false)}
 async function req(s,path){let r=await fetch(`${SUPABASE_URL}${path}`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${s.access_token}`,Accept:'application/json'}});if(r.status===401){s=await refreshCloudSession(s);r=await fetch(`${SUPABASE_URL}${path}`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${s.access_token}`,Accept:'application/json'}})}const x=await r.json();if(!r.ok)throw new Error(x.message||x.hint||x.details||'Cloud read failed.');return {rows:Array.isArray(x)?x:[],session:s}}
 async function run(){
  if(busy||!state||state.cloudConflict||!clean())return false;let s=loadCloudSession();if(!s||!s.access_token)return false;busy=true;
  try{
   // One decision only: newest unfinished cloud cook by real start_time.
   let q=await req(s,'/rest/v1/cooks?select=id,cook_id,start_time,finish_time,phase,updated_at&finish_time=is.null&order=start_time.desc&limit=20');s=q.session;
   const newest=q.rows.find(c=>c&&c.id&&c.cook_id&&c.start_time&&c.phase!=='Finished');if(!newest)return false;
   const localStart=state.start?(Number.isFinite(Number(state.start))?Number(state.start):Date.parse(String(state.start))):0;
   const cloudStart=Date.parse(newest.start_time)||0;
   if(!state.cookId||newest.cook_id!==state.cookId){if(state.cookId&&cloudStart<=localStart)return false;const recovery=await fetchCloudCookRecovery(s.access_token,newest.id);applyCloudRecovery(recovery);state.cloudConflict=false;save();render()}
   // Resolve every parent row for the selected human Cook ID and merge all events.
   q=await req(s,`/rest/v1/cooks?select=id,cook_id,start_time,finish_time,phase,updated_at&cook_id=eq.${encodeURIComponent(state.cookId)}&order=start_time.asc`);s=q.session;const parents=q.rows;if(!parents.length)return false;
   const canonical=parents.slice().sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')))[0];state.cloudCookUuid=canonical.id;state.cloudCookSynced=true;state.cloudCookStateSynced=true;state.cloudLastSeenUpdatedAt=canonical.updated_at||state.cloudLastSeenUpdatedAt;
   let rows=[];for(const p of parents){q=await req(s,`/rest/v1/events?select=id,event_type,event_time,note,target_temp,phase,smoker,setup_context&cook_id=eq.${encodeURIComponent(p.id)}&order=event_time.asc`);s=q.session;rows.push(...q.rows)}
   const unique=new Map();for(const e of rows)if(e&&e.id)unique.set(e.id,e);rows=[...unique.values()].sort((a,b)=>String(a.event_time||'').localeCompare(String(b.event_time||'')));
   const local=Array.isArray(state.events)?state.events:[];const ids=new Map();for(const e of local){ensureEventId(e);ids.set(e.eventId,e)}let added=0;
   for(const e of rows){if(ids.has(e.id)){ids.get(e.id).cloudSynced=true;continue}const x={eventId:e.id,cloudSynced:true,cookId:state.cookId,ts:e.event_time,type:e.event_type,note:e.note||'',target:e.target_temp==null?'':e.target_temp,phase:e.phase||state.phase,smoker:e.smoker||state.smoker,cookName:state.cookName||'Cook',weight:state.weight||'',setup:e.setup_context||'Recovered from Supabase'};local.push(x);ids.set(x.eventId,x);added++}
   local.sort((a,b)=>String(a.ts||'').localeCompare(String(b.ts||'')));state.events=local;if(added){const r=reconstructEventStates(local.map(e=>({event_type:e.type,event_time:e.ts,note:e.note||''})));state.lidOpen=r.lidOpen;state.wrapped=r.wrapped;state.meatOn=state.finishTime?false:r.meatOn;if(r.wrapMethod)state.wrapMethod=r.wrapMethod}
   state.cloudSyncMessage=`Startup sync: ${state.cookId}; ${parents.length} cloud parent row${parents.length===1?'':'s'}; ${rows.length} unique cloud event${rows.length===1?'':'s'}.`;save();render();renderCloudSyncState();return true;
  }catch(e){state.cloudSyncMessage=`Startup cloud sync warning: ${e.message}\nLocal events are safe.`;save();renderCloudSyncState();return false}finally{busy=false}
 }
 window.reconcileCloudStartupV13099=run;setTimeout(run,3000);
})();
</script>
'''
    html=html.replace('</body>',script+'\n</body>',1);INDEX.write_text(html,encoding='utf-8')
sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-9-8' in sw:sw=sw.replace('ldcooklog-v1-30-9-8','ldcooklog-v1-30-9-9',1)
elif 'ldcooklog-v1-30-9-9' not in sw:raise SystemExit('Unexpected cache version')
SW.write_text(sw,encoding='utf-8');print('Patched V1.30.9.9 consolidated startup sync')
