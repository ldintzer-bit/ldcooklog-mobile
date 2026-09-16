from pathlib import Path

INDEX = Path('index.html')
SW = Path('service-worker.js')
MARKER = 'LDCookLog Mobile V1.30.1 sync hotfix'

html = INDEX.read_text(encoding='utf-8')
if MARKER in html:
    print('V1.30.1 sync hotfix already present')
else:
    hotfix = r'''
<script>
// LDCookLog Mobile V1.30.1 sync hotfix
// Clean startup/refresh checks the cloud version without writing the parent cook.
// Dirty local state still uses the existing optimistic-concurrency PATCH path.
(() => {
  const BUILD = "2026-09-16A";
  const previousSyncCloudCookState = syncCloudCookState;

  async function readCloudVersionV1301(accessToken){
    if(!state.cloudCookUuid) throw new Error("Cloud cook UUID is missing.");
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cooks?select=id,updated_at&id=eq.${encodeURIComponent(state.cloudCookUuid)}&limit=1`, {
      headers:{apikey:SUPABASE_PUBLISHABLE_KEY, Authorization:`Bearer ${accessToken}`, Accept:"application/json"}
    });
    if(response.status===401) throw Object.assign(new Error("Session expired."),{code:401});
    const data = await response.json();
    if(!response.ok) throw new Error(data.message||data.hint||data.details||"Cloud version check failed.");
    return data[0]||null;
  }

  function flagConflictV1301(cloudUpdatedAt){
    state.cloudConflict = {
      detectedAt:new Date().toISOString(),
      cloudUpdatedAt:cloudUpdatedAt||null,
      localBaseline:state.cloudLastSeenUpdatedAt||null
    };
    state.cloudCookStateSynced=false;
    state.cloudSyncMessage=`CLOUD CONFLICT DETECTED\nCook ${state.cookId||""} was changed in Supabase after this device last synchronized it.\n\nYour local cook has NOT been overwritten. Pending cloud updates and events are paused until you choose which version to keep.`;
    save();
    renderCloudSyncState();
  }

  syncCloudCookState = async function(){
    if(state.cloudConflict){ renderCloudSyncState(); return false; }

    // A clean parent cook needs only a version check. Do not PATCH an unchanged
    // cook merely because the app started, reopened, or Safari refreshed.
    if(state.start && state.cookId && state.cloudCookSynced && state.cloudCookUuid && state.cloudCookStateSynced){
      let session = loadCloudSession();
      if(!session || !session.access_token) return false;
      state.cloudSyncMessage=`Checking ${state.cookId} cloud version…`;
      save(); renderCloudSyncState();
      try{
        let row;
        try{
          row=await readCloudVersionV1301(session.access_token);
        }catch(err){
          if(err.code!==401) throw err;
          session=await refreshCloudSession(session);
          row=await readCloudVersionV1301(session.access_token);
        }
        if(!row) throw new Error("Cloud cook could not be found for conflict checking.");
        if(!state.cloudLastSeenUpdatedAt){
          state.cloudLastSeenUpdatedAt=row.updated_at||null;
          state.cloudSyncMessage="";
          save(); renderCloudSyncState();
          return true;
        }
        if(row.updated_at!==state.cloudLastSeenUpdatedAt){
          flagConflictV1301(row.updated_at);
          return false;
        }
        state.cloudSyncMessage="";
        save(); renderCloudSyncState();
        return true;
      }catch(err){
        state.cloudSyncMessage=`Cloud version check warning: ${err.message}\nLocal cook data is safe and can be retried.`;
        save(); renderCloudSyncState();
        return false;
      }
    }

    // Local cook is dirty/new: preserve V1.16 optimistic-concurrency behavior.
    return previousSyncCloudCookState.apply(this, arguments);
  };

  document.title="LDCookLog Mobile V1.30.1";
  const headerSub=document.querySelector("header .sub");
  if(headerSub) headerSub.textContent="V1.30.1 Stateful BBQ Control Panel";
  const footer=document.querySelector(".footer-note");
  if(footer) footer.innerHTML=`V1.30.1 sync hotfix: unchanged cooks are version-checked without rewriting Supabase; genuine cross-device conflict protection remains active.<br><strong>Build ${BUILD}</strong>`;
  save(); render();
})();
</script>
'''
    if '</body>' not in html:
        raise SystemExit('Could not find </body> insertion point')
    html = html.replace('</body>', hotfix + '\n</body>', 1)
    INDEX.write_text(html, encoding='utf-8')
    print('Patched index.html for V1.30.1')

sw = SW.read_text(encoding='utf-8')
if "ldcooklog-v1-30-0" in sw:
    sw = sw.replace("ldcooklog-v1-30-0", "ldcooklog-v1-30-1", 1)
elif "ldcooklog-v1-30-1" not in sw:
    raise SystemExit('Unexpected service-worker cache version')
SW.write_text(sw, encoding='utf-8')
print('Updated service worker cache to V1.30.1')
