from pathlib import Path
INDEX=Path('index.html'); SW=Path('service-worker.js')
html=INDEX.read_text(encoding='utf-8')
MARK='LDCookLog Mobile V1.30.9.5 active cook selection'
if MARK not in html:
    script=r'''
<script>
// LDCookLog Mobile V1.30.9.5 active cook selection
(() => {
 const BUILD='2026-09-16N';
 document.title='LDCookLog Mobile V1.30.9.5';
 const h=document.querySelector('header .sub'); if(h)h.textContent='V1.30.9.5 Stateful BBQ Control Panel';
 const f=document.querySelector('.footer-note'); if(f)f.innerHTML=`V1.30.9.5 selects the newest unfinished cloud cook by actual start time and restores it through the full recovery path.<br><strong>Build ${BUILD}</strong>`;
 function clean(){return state&&state.cloudCookStateSynced!==false&&!(state.events||[]).some(e=>e&&e.cloudSynced===false)}
 async function run(){
  try{
   let s=loadCloudSession(); if(!s||!s.access_token||!state||!state.cookId||!clean())return false;
   let r=await fetch(`${SUPABASE_URL}/rest/v1/cooks?select=id,cook_id,start_time,finish_time,phase,updated_at&finish_time=is.null&order=start_time.desc&limit=10`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${s.access_token}`,Accept:'application/json'}});
   if(r.status===401){s=await refreshCloudSession(s);r=await fetch(`${SUPABASE_URL}/rest/v1/cooks?select=id,cook_id,start_time,finish_time,phase,updated_at&finish_time=is.null&order=start_time.desc&limit=10`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${s.access_token}`,Accept:'application/json'}})}
   const rows=await r.json(); if(!r.ok||!Array.isArray(rows)||!rows.length)return false;
   const newest=rows.find(x=>x&&x.id&&x.cook_id&&x.start_time&&x.phase!=='Finished');
   if(!newest||newest.cook_id===state.cookId)return false;
   const localStart=state.start?Date.parse(state.start):0, cloudStart=Date.parse(newest.start_time)||0;
   if(cloudStart<=localStart)return false;
   let recovery=await fetchCloudCookRecovery(s.access_token,newest.id);
   if(typeof applyCloudRecovery!=='function')return false;
   applyCloudRecovery(recovery);
   state.cloudSyncMessage=`Adopted newest active cloud cook ${state.cookId}.`;
   state.cloudConflict=false; save(); render();
   if(typeof mergeCloudEventsForCurrentCookV1303==='function')await mergeCloudEventsForCurrentCookV1303();
   return true;
  }catch(e){console.warn('V1.30.9.5 active-cook selection:',e);return false}
 }
 window.adoptNewestActiveCloudCookV13095=run;
 setTimeout(run,2600);
})();
</script>
'''
    html=html.replace('</body>',script+'\n</body>',1)
    INDEX.write_text(html,encoding='utf-8')
sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-9-4' in sw: sw=sw.replace('ldcooklog-v1-30-9-4','ldcooklog-v1-30-9-5',1)
elif 'ldcooklog-v1-30-9-5' not in sw: raise SystemExit('Unexpected cache version')
SW.write_text(sw,encoding='utf-8')
print('Patched V1.30.9.5')
