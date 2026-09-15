from pathlib import Path

p=Path('index.html')
text=p.read_text()
old="document.getElementById('prepNotes').addEventListener('change',()=>{readPrepUI();save();if(state.cloudCookUuid)syncPendingEventsToCloud();});"
new="""document.getElementById('prepNotes').addEventListener('change',()=>{readPrepUI();save();if(state.cloudCookUuid)syncPendingEventsToCloud();});
  // Reset preparation only after the base Reset Cook handler has replaced the cook state.
  document.getElementById('resetCook').addEventListener('click',()=>{
    state.preparation=prepDefaults();
    writePrepUI();
    save();
  });"""
if text.count(old)!=1: raise SystemExit('V1.29.1 prep notes listener anchor not found')
text=text.replace(old,new,1)
text=text.replace("document.title='LDCookLog Mobile V1.29.1';","document.title='LDCookLog Mobile V1.29.2';",1)
text=text.replace("h.textContent='V1.29.1 Stateful BBQ Control Panel'","h.textContent='V1.29.2 Stateful BBQ Control Panel'",1)
text=text.replace("V1.29.1 saves Prep Notes locally while typing and retains cook-level preparation cloud persistence.<br><strong>Build 2026-09-15D</strong>","V1.29.2 resets Pre-Cook Preparation with Reset Cook while retaining local and Supabase persistence.<br><strong>Build 2026-09-15E</strong>",1)
p.write_text(text)

swp=Path('service-worker.js')
sw=swp.read_text()
old_cache="const CACHE_NAME = 'ldcooklog-v1-29-1';"
new_cache="const CACHE_NAME = 'ldcooklog-v1-29-2';"
if sw.count(old_cache)!=1: raise SystemExit('V1.29.1 cache anchor not found')
swp.write_text(sw.replace(old_cache,new_cache,1))
print('V1.29.2 prep reset fix applied successfully.')
