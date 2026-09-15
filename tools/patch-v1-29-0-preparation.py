from pathlib import Path

p=Path('index.html')
text=p.read_text()
if 'V1.29.0 Complete Cook Record — pre-cook preparation' in text:
    raise SystemExit('V1.29.0 already applied')

anchor='<section class="card" id="meatPiecesCard">'
card='''<section class="card" id="prepCard"><h2>Pre-Cook Preparation</h2><div class="sub" style="margin-bottom:10px">Cook-level preparation details. Rubs and binder remain in their existing sections.</div><div class="formrow"><div><label for="prepTrim">Trim</label><select id="prepTrim"><option>None</option><option>Light</option><option>Moderate</option><option>Heavy</option></select></div><div><label for="prepBrine">Brine / Marinade</label><select id="prepBrine"><option>None</option><option>Dry brine</option><option>Wet brine</option><option>Marinade</option></select></div></div><div style="margin-top:10px"><label for="prepInjection">Injection</label><select id="prepInjection"><option>No</option><option>Yes</option></select></div><div style="margin-top:10px"><label for="prepNotes">Prep Notes (optional)</label><textarea id="prepNotes" placeholder="Any preparation detail worth remembering…"></textarea></div></section>\n'''
if text.count(anchor)!=1: raise SystemExit('meat pieces anchor not found')
text=text.replace(anchor,card+anchor,1)

script=r'''
<script>
// V1.29.0 Complete Cook Record — pre-cook preparation.
(function(){
  const prepDefaults=()=>({trimLevel:'None',brineMarinade:'None',injection:'No',prepNotes:''});
  state.preparation=Object.assign(prepDefaults(),state.preparation||{});
  let lastRecoveryPreparation=null;
  let prepSyncInProgress=false;
  function readPrepUI(){
    state.preparation={trimLevel:document.getElementById('prepTrim').value,brineMarinade:document.getElementById('prepBrine').value,injection:document.getElementById('prepInjection').value,prepNotes:document.getElementById('prepNotes').value};
  }
  function writePrepUI(){
    const p=Object.assign(prepDefaults(),state.preparation||{});
    document.getElementById('prepTrim').value=p.trimLevel;
    document.getElementById('prepBrine').value=p.brineMarinade;
    document.getElementById('prepInjection').value=p.injection;
    document.getElementById('prepNotes').value=p.prepNotes;
  }
  ['prepTrim','prepBrine','prepInjection','prepNotes'].forEach(id=>document.getElementById(id).addEventListener('change',()=>{readPrepUI();save();if(state.cloudCookUuid)syncPendingEventsToCloud();}));
  const priorSave=save;
  save=function(){readPrepUI();return priorSave();};
  const priorRender=render;
  render=function(){
    if(lastRecoveryPreparation&&state.cloudCookUuid===lastRecoveryPreparation.cookUuid){state.preparation=lastRecoveryPreparation.preparation;lastRecoveryPreparation=null;}
    priorRender();writePrepUI();
  };
  async function requestPreparation(token,cookUuid){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/cook_preparation?select=trim_level,brine_marinade,injection,prep_notes&cook_id=eq.${encodeURIComponent(cookUuid)}&limit=1`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`,Accept:'application/json'}});
    if(r.status===401)throw Object.assign(new Error('Session expired.'),{code:401});
    const d=await r.json();if(!r.ok)throw new Error(d.message||d.hint||d.details||'Preparation could not be read.');return d[0]||null;
  }
  async function upsertPreparation(token){
    if(!state.cloudCookUuid)return true;
    const p=Object.assign(prepDefaults(),state.preparation||{});
    const row={cook_id:state.cloudCookUuid,trim_level:p.trimLevel,brine_marinade:p.brineMarinade,injection:p.injection,prep_notes:p.prepNotes||null,updated_at:new Date().toISOString()};
    const r=await fetch(`${SUPABASE_URL}/rest/v1/cook_preparation?on_conflict=cook_id`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row)});
    if(r.status===401)throw Object.assign(new Error('Session expired.'),{code:401});
    if(!r.ok){const d=await r.json().catch(()=>null);throw new Error((d&&(d.message||d.hint||d.details))||'Preparation could not be saved.');}return true;
  }
  async function syncPreparation(){
    if(prepSyncInProgress||!state.start||!state.cloudCookUuid||state.cloudConflict)return false;
    let s=loadCloudSession();if(!s||!s.access_token)return false;prepSyncInProgress=true;
    try{try{await upsertPreparation(s.access_token);}catch(e){if(e.code!==401)throw e;s=await refreshCloudSession(s);await upsertPreparation(s.access_token);}return true;}catch(e){console.warn('Preparation cloud sync warning:',e);return false;}finally{prepSyncInProgress=false;}
  }
  const priorSync=syncPendingEventsToCloud;
  syncPendingEventsToCloud=async function(){const ok=await priorSync();if(state.cloudCookUuid&&!state.cloudConflict)await syncPreparation();return ok;};
  const priorRecovery=fetchCloudCookRecovery;
  fetchCloudCookRecovery=async function(token,cookUuid){
    const recovery=await priorRecovery(token,cookUuid);
    try{const row=await requestPreparation(token,cookUuid);if(row)lastRecoveryPreparation={cookUuid,preparation:{trimLevel:row.trim_level||'None',brineMarinade:row.brine_marinade||'None',injection:row.injection||'No',prepNotes:row.prep_notes||''}};}catch(e){recovery.cook.preparation_error=e.message;}
    return recovery;
  };
  writePrepUI();
  document.title='LDCookLog Mobile V1.29.0';
  const h=document.querySelector('header .sub');if(h)h.textContent='V1.29.0 Stateful BBQ Control Panel';
  const f=document.querySelector('.footer-note');if(f)f.innerHTML='V1.29.0 adds cook-level pre-cook preparation with local and Supabase persistence: trim, brine/marinade, injection, and optional prep notes.<br><strong>Build 2026-09-15C</strong>';
})();
</script>
'''
if '</body>' not in text: raise SystemExit('body anchor not found')
text=text.replace('</body>',script+'\n</body>',1)
p.write_text(text)

swp=Path('service-worker.js');sw=swp.read_text()
old="const CACHE_NAME = 'ldcooklog-v1-28-1';";new="const CACHE_NAME = 'ldcooklog-v1-29-0';"
if sw.count(old)!=1: raise SystemExit('cache anchor not found')
swp.write_text(sw.replace(old,new,1))
print('V1.29.0 pre-cook preparation applied successfully.')
