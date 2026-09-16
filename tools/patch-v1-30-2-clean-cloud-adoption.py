from pathlib import Path

INDEX=Path('index.html')
SW=Path('service-worker.js')
MARKER='LDCookLog Mobile V1.30.2 clean cloud adoption'

html=INDEX.read_text(encoding='utf-8')
if MARKER in html:
    print('V1.30.2 already present')
else:
    hotfix=r'''
<script>
// LDCookLog Mobile V1.30.2 clean cloud adoption
// A clean device with an older baseline adopts the newer cloud cook instead of
// raising a conflict. Dirty-local + changed-cloud remains a genuine conflict.
(() => {
  const BUILD="2026-09-16B";
  const previousSyncCloudCookStateV1302=syncCloudCookState;

  async function fetchCloudCookV1302(accessToken){
    if(!state.cloudCookUuid) throw new Error("Cloud cook UUID is missing.");
    const response=await fetch(`${SUPABASE_URL}/rest/v1/cooks?select=*&id=eq.${encodeURIComponent(state.cloudCookUuid)}&limit=1`,{
      headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,Accept:"application/json"}
    });
    if(response.status===401) throw Object.assign(new Error("Session expired."),{code:401});
    const data=await response.json();
    if(!response.ok) throw new Error(data.message||data.hint||data.details||"Cloud cook read failed.");
    return data[0]||null;
  }

  async function getCloudCookV1302(){
    let session=loadCloudSession();
    if(!session||!session.access_token) return null;
    try{return await fetchCloudCookV1302(session.access_token);}
    catch(err){
      if(err.code!==401) throw err;
      session=await refreshCloudSession(session);
      return await fetchCloudCookV1302(session.access_token);
    }
  }

  async function adoptCleanCloudV1302(row){
    // Reuse the established recovery path so fields and event-derived states are
    // reconstructed consistently, but do not create a Conflict Resolved event.
    if(typeof applyCloudRecovery!=="function") throw new Error("Cloud recovery function is unavailable.");
    await applyCloudRecovery(row);
    state.cloudConflict=false;
    state.cloudCookSynced=true;
    state.cloudCookStateSynced=true;
    state.cloudLastSeenUpdatedAt=row.updated_at||null;
    state.cloudSyncMessage="";
    save(); render(); renderCloudSyncState();
    return true;
  }

  syncCloudCookState=async function(){
    if(state.cloudConflict){renderCloudSyncState();return false;}

    // Only clean local state is eligible for automatic cloud adoption.
    if(state.start&&state.cookId&&state.cloudCookSynced&&state.cloudCookUuid&&state.cloudCookStateSynced){
      state.cloudSyncMessage=`Checking ${state.cookId} cloud version…`;
      save();renderCloudSyncState();
      try{
        const row=await getCloudCookV1302();
        if(!row) throw new Error("Cloud cook could not be found for synchronization.");
        if(!state.cloudLastSeenUpdatedAt){
          state.cloudLastSeenUpdatedAt=row.updated_at||null;
          state.cloudSyncMessage="";
          save();renderCloudSyncState();
          return true;
        }
        if(row.updated_at!==state.cloudLastSeenUpdatedAt){
          // The device is clean, so it has nothing unique to protect. The cloud
          // is authoritative here; adopt it instead of manufacturing a conflict.
          return await adoptCleanCloudV1302(row);
        }
        state.cloudSyncMessage="";
        save();renderCloudSyncState();
        return true;
      }catch(err){
        state.cloudSyncMessage=`Cloud synchronization warning: ${err.message}\nLocal cook data is safe and can be retried.`;
        save();renderCloudSyncState();
        return false;
      }
    }

    // Dirty/new local state still goes through the existing optimistic
    // concurrency path, which detects a genuine cloud-vs-local edit conflict.
    return previousSyncCloudCookStateV1302.apply(this,arguments);
  };

  document.title="LDCookLog Mobile V1.30.2";
  const headerSub=document.querySelector("header .sub");
  if(headerSub) headerSub.textContent="V1.30.2 Stateful BBQ Control Panel";
  const footer=document.querySelector(".footer-note");
  if(footer) footer.innerHTML=`V1.30.2 multi-device sync: a clean device automatically adopts a newer cloud cook; dirty-local plus changed-cloud still requires conflict resolution.<br><strong>Build ${BUILD}</strong>`;
  save();render();
})();
</script>
'''
    if '</body>' not in html: raise SystemExit('Could not find </body>')
    INDEX.write_text(html.replace('</body>',hotfix+'\n</body>',1),encoding='utf-8')
    print('Patched index.html for V1.30.2')

sw=SW.read_text(encoding='utf-8')
if "ldcooklog-v1-30-1" in sw:
    sw=sw.replace("ldcooklog-v1-30-1","ldcooklog-v1-30-2",1)
elif "ldcooklog-v1-30-2" not in sw:
    raise SystemExit('Unexpected service-worker cache version')
SW.write_text(sw,encoding='utf-8')
print('Updated service worker cache to V1.30.2')
