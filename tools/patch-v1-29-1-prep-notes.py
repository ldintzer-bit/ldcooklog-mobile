from pathlib import Path

p=Path('index.html')
text=p.read_text()
old="['prepTrim','prepBrine','prepInjection','prepNotes'].forEach(id=>document.getElementById(id).addEventListener('change',()=>{readPrepUI();save();if(state.cloudCookUuid)syncPendingEventsToCloud();}));"
new="['prepTrim','prepBrine','prepInjection'].forEach(id=>document.getElementById(id).addEventListener('change',()=>{readPrepUI();save();if(state.cloudCookUuid)syncPendingEventsToCloud();}));\n  document.getElementById('prepNotes').addEventListener('input',()=>{readPrepUI();save();});\n  document.getElementById('prepNotes').addEventListener('change',()=>{readPrepUI();save();if(state.cloudCookUuid)syncPendingEventsToCloud();});"
if text.count(old)!=1: raise SystemExit('V1.29.0 prep listener anchor not found')
text=text.replace(old,new,1)
text=text.replace("document.title='LDCookLog Mobile V1.29.0';","document.title='LDCookLog Mobile V1.29.1';",1)
text=text.replace("h.textContent='V1.29.0 Stateful BBQ Control Panel'","h.textContent='V1.29.1 Stateful BBQ Control Panel'",1)
text=text.replace("V1.29.0 adds cook-level pre-cook preparation with local and Supabase persistence: trim, brine/marinade, injection, and optional prep notes.<br><strong>Build 2026-09-15C</strong>","V1.29.1 saves Prep Notes locally while typing and retains cook-level preparation cloud persistence.<br><strong>Build 2026-09-15D</strong>",1)
p.write_text(text)

swp=Path('service-worker.js')
sw=swp.read_text()
old_cache="const CACHE_NAME = 'ldcooklog-v1-29-0';"
new_cache="const CACHE_NAME = 'ldcooklog-v1-29-1';"
if sw.count(old_cache)!=1: raise SystemExit('V1.29.0 cache anchor not found')
swp.write_text(sw.replace(old_cache,new_cache,1))
print('V1.29.1 prep notes persistence fix applied successfully.')
