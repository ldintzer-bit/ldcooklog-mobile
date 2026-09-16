from pathlib import Path

INDEX=Path('index.html')
SW=Path('service-worker.js')
MARKER='LDCookLog Mobile V1.30.3 two-way event sync'
html=INDEX.read_text(encoding='utf-8')
if MARKER in html:
    print('V1.30.3 already present')
else:
    hotfix=r'''
<script>
// LDCookLog Mobile V1.30.3 two-way event sync
// Merge cloud events into the active local cook without deleting unsynced local events.
(() => {
  const BUILD="2026-09-16C";
  let eventPullInProgressV1303=false;

  async function fetchCloudEventsV1303(accessToken){
    if(!state.cloudCookUuid) return [];
    const response=await fetch(`${SUPABASE_URL}/rest/v1/events?select=id,event_type,event_time,note,target_temp,phase,smoker,setup_context&cook_id=eq.${encodeURIComponent(state.cloudCookUuid)}&order=event_time.asc`,{
      headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,Accept:"application/json"}
    });
    if(response.status===401) throw Object.assign(new Error("Session expired."),{code:401});
    const rows=await response.json();
    if(!response.ok) throw new Error(rows.message||rows.hint||rows.details||"Cloud events could not be read.");
    return Array.isArray(rows)?rows:[];
  }

  function localEventFromCloudV1303(ev){
    return {
      eventId:ev.id,
      cloudSynced:true,
      cookId:state.cookId,
      ts:ev.event_time,
      type:ev.event_type,
      note:ev.note||"",
      target:ev.target_temp==null?"":ev.target_temp,
      phase:ev.phase||state.phase,
      smoker:ev.smoker||state.smoker,
      cookName:state.cookName||"Cook",
      weight:state.weight||"",
      setup:ev.setup_context||"Recovered from Supabase"
    };
  }

  async function mergeCloudEventsV1303(){
    if(eventPullInProgressV1303||state.cloudConflict||!state.start||!state.cookId||!state.cloudCookUuid) return true;
    let session=loadCloudSession();
    if(!session||!session.access_token) return false;
    eventPullInProgressV1303=true;
    try{
      let rows;
      try{rows=await fetchCloudEventsV1303(session.access_token);}
      catch(err){
        if(err.code!==401) throw err;
        session=await refreshCloudSession(session);
        rows=await fetchCloudEventsV1303(session.access_token);
      }
      const local=Array.isArray(state.events)?state.events:[];
      const byId=new Map();
      for(const ev of local){
        ensureEventId(ev);
        byId.set(ev.eventId,ev);
      }
      let added=0;
      for(const cloudEv of rows){
        if(byId.has(cloudEv.id)){
          byId.get(cloudEv.id).cloudSynced=true;
          continue;
        }
        const recovered=localEventFromCloudV1303(cloudEv);
        local.push(recovered);
        byId.set(recovered.eventId,recovered);
        added++;
      }
      local.sort((a,b)=>String(a.ts||'').localeCompare(String(b.ts||'')));
      state.events=local;
      if(added){
        const reconstructed=reconstructEventStates(state.events.map(ev=>({event_type:ev.type,event_time:ev.ts,note:ev.note||''})));
        state.lidOpen=reconstructed.lidOpen;
        state.wrapped=reconstructed.wrapped;
        state.meatOn=state.finishTime?false:reconstructed.meatOn;
        if(reconstructed.wrapMethod) state.wrapMethod=reconstructed.wrapMethod;
      }
      state.cloudSyncMessage="";
      save();render();renderCloudSyncState();
      return true;
    }catch(err){
      state.cloudSyncMessage=`Cloud event download warning: ${err.message}\nLocal events are safe and can be retried.`;
      save();renderCloudSyncState();
      return false;
    }finally{eventPullInProgressV1303=false;}
  }

  const previousSyncCurrentCookAndEventsV1303=syncCurrentCookAndEvents;
  syncCurrentCookAndEvents=async function(){
    // Preserve existing parent conflict protection and local-event upload first.
    await previousSyncCurrentCookAndEventsV1303.apply(this,arguments);
    if(state.cloudConflict) return false;
    return await mergeCloudEventsV1303();
  };

  // V1.30.2 clean-cloud adoption can replace local state through recovery; after
  // startup synchronization, also merge any cloud events missing on this device.
  if(loadCloudSession()&&state.start) setTimeout(()=>mergeCloudEventsV1303(),1500);

  document.title="LDCookLog Mobile V1.30.3";
  const headerSub=document.querySelector("header .sub");
  if(headerSub) headerSub.textContent="V1.30.3 Stateful BBQ Control Panel";
  const footer=document.querySelector(".footer-note");
  if(footer) footer.innerHTML=`V1.30.3 two-way event sync: cloud events missing from a clean/active device are merged locally without deleting unsynced local events.<br><strong>Build ${BUILD}</strong>`;
  save();render();
})();
</script>
'''
    if '</body>' not in html: raise SystemExit('Could not find </body>')
    INDEX.write_text(html.replace('</body>',hotfix+'\n</body>',1),encoding='utf-8')
    print('Patched index.html for V1.30.3')

sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-2' in sw:
    sw=sw.replace('ldcooklog-v1-30-2','ldcooklog-v1-30-3',1)
elif 'ldcooklog-v1-30-3' not in sw:
    raise SystemExit('Unexpected service-worker cache version')
SW.write_text(sw,encoding='utf-8')
print('Updated service worker cache to V1.30.3')
