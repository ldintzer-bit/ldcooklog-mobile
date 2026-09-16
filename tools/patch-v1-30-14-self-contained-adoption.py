from pathlib import Path
INDEX=Path('index.html'); SW=Path('service-worker.js')
html=INDEX.read_text(encoding='utf-8')
MARK='LDCookLog Mobile V1.30.14 self-contained cloud adoption'
if MARK not in html:
    # Replace the unavailable private recovery call inside V1.30.12 with an
    # inline adoption routine using the already-returned recovery object.
    old="const recovery=await fetchCloudCookRecovery(s.access_token,newest.id);applyCloudRecovery(recovery)"
    new="""const recovery=await fetchCloudCookRecovery(s.access_token,newest.id);const c=recovery&&recovery.cook;if(!c)throw new Error('Cloud recovery returned no cook');const keep=defaultState();state=Object.assign(keep,{cookId:c.cook_id||null,cookName:c.food||'',weight:c.weight_value==null?'':String(c.weight_value),target:c.target_temp==null?225:Number(c.target_temp),start:c.start_time||null,finishTime:c.finish_time||null,phase:c.phase||'Cooking',phaseStart:null,phaseTarget:null,events:[],cloudCookSynced:true,cloudCookUuid:c.id,cloudCookStateSynced:true,cloudLastSeenUpdatedAt:c.updated_at||null,cloudConflict:false,cloudSyncMessage:''});const recoveredEvents=Array.isArray(recovery.events)?recovery.events:[];state.events=recoveredEvents.map(e=>({eventId:e.id,cloudSynced:true,cookId:state.cookId,ts:e.event_time,type:e.event_type,note:e.note||'',target:e.target_temp==null?'':e.target_temp,phase:e.phase||state.phase,smoker:e.smoker||state.smoker,cookName:state.cookName||'Cook',weight:state.weight||'',setup:e.setup_context||'Recovered from Supabase'}));if(state.events.length){const rr=reconstructEventStates(state.events.map(e=>({event_type:e.type,event_time:e.ts,note:e.note||''})));state.lidOpen=rr.lidOpen;state.wrapped=rr.wrapped;state.meatOn=state.finishTime?false:rr.meatOn;if(rr.wrapMethod)state.wrapMethod=rr.wrapMethod}save();render()"""
    if old not in html: raise SystemExit('V1.30.12 applyCloudRecovery call not found')
    html=html.replace(old,new,1)
    script=r'''
<script>
// LDCookLog Mobile V1.30.14 self-contained cloud adoption
(() => {
 const BUILD='2026-09-16W';
 document.title='LDCookLog Mobile V1.30.14';
 const h=document.querySelector('header .sub');if(h)h.textContent='V1.30.14 Stateful BBQ Control Panel';
 const f=document.querySelector('.footer-note');if(f)f.innerHTML=`V1.30.14 makes newer-cook startup adoption self-contained and removes the unavailable applyCloudRecovery dependency.<br><strong>Build ${BUILD}</strong>`;
 let el=document.getElementById('runtimeProofV13013');if(el)el.textContent=`RUNTIME CHECK: Build ${BUILD} JavaScript executed. Waiting for startup reconciliation…`;
 setTimeout(async()=>{try{if(typeof window.reconcileCloudStartupV13012!=='function')throw new Error('Startup reconciliation function missing');const ok=await window.reconcileCloudStartupV13012();el=document.getElementById('runtimeProofV13013');if(el)el.textContent=`RUNTIME CHECK: Build ${BUILD} JavaScript executed.\nStartup reconciliation returned ${String(ok)}.\n${state&&state.cloudSyncMessage?state.cloudSyncMessage:'No diagnostic produced.'}`;}catch(e){el=document.getElementById('runtimeProofV13013');if(el)el.textContent=`RUNTIME CHECK: Build ${BUILD} JavaScript executed.\nSTARTUP ERROR: ${e&&e.message?e.message:String(e)}`;}},2500);
})();
</script>
'''
    html=html.replace('</body>',script+'\n</body>',1)
    INDEX.write_text(html,encoding='utf-8')
sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-13' in sw: sw=sw.replace('ldcooklog-v1-30-13','ldcooklog-v1-30-14',1)
elif 'ldcooklog-v1-30-14' not in sw: raise SystemExit('Unexpected cache version')
SW.write_text(sw,encoding='utf-8')
print('Patched V1.30.14 self-contained cloud adoption')
