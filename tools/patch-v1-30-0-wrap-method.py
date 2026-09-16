from pathlib import Path

p=Path('index.html')
text=p.read_text()
old='$("wrapToggle").addEventListener("click",()=>withActionLock("wrap",()=>{if(state.finishTime)return;state.wrapped=!state.wrapped;logEvent(state.wrapped?"Wrapped":"Unwrapped")}));'
new='''$("wrapToggle").addEventListener("click",()=>withActionLock("wrap",()=>{if(state.finishTime)return;if(!state.wrapped){const answer=prompt("Wrap method: Foil, Butcher Paper, Foil Boat, or Other:",state.wrapMethod||"Foil");if(answer===null)return;const raw=answer.trim();if(!raw)return;const canonical={"foil":"Foil","butcher paper":"Butcher Paper","foil boat":"Foil Boat","other":"Other"}[raw.toLowerCase()];if(!canonical){alert("Please enter Foil, Butcher Paper, Foil Boat, or Other.");return;}state.wrapMethod=canonical;state.wrapped=true;logEvent("Wrapped",`Wrap method: ${canonical}`);}else{state.wrapped=false;logEvent("Unwrapped",state.wrapMethod?`Previous wrap method: ${state.wrapMethod}`:"");}}));'''
if text.count(old)!=1: raise SystemExit('wrap handler anchor not found')
text=text.replace(old,new,1)
old_state='wrapped:false,phase:"Setup"'
if text.count(old_state)!=1: raise SystemExit('default state anchor not found')
text=text.replace(old_state,'wrapped:false,wrapMethod:null,phase:"Setup"',1)
old_reconstruct='function reconstructEventStates(events){let lidOpen=false,wrapped=false,meatOn=false;for(const ev of events){if(ev.event_type==="Lid Open")lidOpen=true;else if(ev.event_type==="Lid Closed")lidOpen=false;else if(ev.event_type==="Wrapped")wrapped=true;else if(ev.event_type==="Unwrapped")wrapped=false;else if(ev.event_type==="Meat On")meatOn=true;else if(ev.event_type==="Meat Off"||ev.event_type==="Cook Finished")meatOn=false}return {lidOpen,wrapped,meatOn}}'
new_reconstruct='function reconstructEventStates(events){let lidOpen=false,wrapped=false,meatOn=false,wrapMethod=null;for(const ev of events){if(ev.event_type==="Lid Open")lidOpen=true;else if(ev.event_type==="Lid Closed")lidOpen=false;else if(ev.event_type==="Wrapped"){wrapped=true;const m=String(ev.note||"").match(/^Wrap method: (Foil|Butcher Paper|Foil Boat|Other)$/);if(m)wrapMethod=m[1];}else if(ev.event_type==="Unwrapped")wrapped=false;else if(ev.event_type==="Meat On")meatOn=true;else if(ev.event_type==="Meat Off"||ev.event_type==="Cook Finished")meatOn=false}return {lidOpen,wrapped,meatOn,wrapMethod}}'
if text.count(old_reconstruct)!=1: raise SystemExit('reconstruct anchor not found')
text=text.replace(old_reconstruct,new_reconstruct,1)
# Existing restore already calls reconstructEventStates. After its state assignment, restore the method onto state before render/save.
old_tail='});render();if(!save()){alert("The cloud cook was displayed but could not be safely saved locally.'
new_tail='});state.wrapMethod=recovered.wrapMethod||null;render();if(!save()){alert("The cloud cook was displayed but could not be safely saved locally.'
if text.count(old_tail)!=1: raise SystemExit('restore tail anchor not found')
text=text.replace(old_tail,new_tail,1)
text=text.replace("document.title='LDCookLog Mobile V1.29.2';","document.title='LDCookLog Mobile V1.30.0';",1)
text=text.replace("h.textContent='V1.29.2 Stateful BBQ Control Panel'","h.textContent='V1.30.0 Stateful BBQ Control Panel'",1)
text=text.replace("V1.29.2 resets Pre-Cook Preparation with Reset Cook while retaining local and Supabase persistence.<br><strong>Build 2026-09-15E</strong>","V1.30.0 records Wrap Method when Wrap is pressed: Foil, Butcher Paper, Foil Boat, or Other. The method is stored in the Wrapped event and recovers from Supabase.<br><strong>Build 2026-09-15F</strong>",1)
p.write_text(text)

swp=Path('service-worker.js')
sw=swp.read_text()
old_cache="const CACHE_NAME = 'ldcooklog-v1-29-2';"
if sw.count(old_cache)!=1: raise SystemExit('V1.29.2 cache anchor not found')
swp.write_text(sw.replace(old_cache,"const CACHE_NAME = 'ldcooklog-v1-30-0';",1))
print('V1.30.0 wrap method applied successfully.')
