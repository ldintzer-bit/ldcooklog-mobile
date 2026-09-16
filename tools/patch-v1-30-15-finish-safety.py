from pathlib import Path
INDEX=Path('index.html'); SW=Path('service-worker.js')
html=INDEX.read_text(encoding='utf-8')
MARK='LDCookLog Mobile V1.30.15 finish/new-cook safety'
if MARK not in html:
    script=r'''
<script>
// LDCookLog Mobile V1.30.15 finish/new-cook safety
(() => {
  const BUILD='2026-09-16X';

  // Replace the layered Finish Cook control with one authoritative handler.
  const oldFinish=document.getElementById('finishButton');
  if(oldFinish){
    const finish=oldFinish.cloneNode(true);
    oldFinish.replaceWith(finish);
    finish.addEventListener('click', async (event)=>{
      event.preventDefault(); event.stopImmediatePropagation();
      if(state.finishTime) return;
      if(!state.start){ alert('Start the cook with Meat On before finishing it.'); return; }
      if(!ensureCookId()) return;
      if(!confirm('Finish this cook? The cook will be marked Finished and synchronized before you start another cook.')) return;
      finish.disabled=true;
      const now=new Date();
      state.finishTime=now.toISOString();
      state.meatOn=false;
      state.phase='Finished';
      state.phaseStart=null;
      state.phaseTarget=null;
      const ev=makeEvent('Cook Finished',`Total cook time ${durString(state.start,state.finishTime)}`,state.finishTime);
      state.events.push(ev);
      markCloudCookDirty();
      save(); render();
      if(loadCloudSession()){
        state.cloudSyncMessage='Finishing cook — synchronizing completed state and final event…'; save(); renderCloudSyncState();
        try{ await syncCurrentCookAndEvents(); }
        catch(err){ state.cloudSyncMessage=`Cook is finished locally, but cloud sync needs retry: ${err&&err.message?err.message:String(err)}`; save(); renderCloudSyncState(); }
      }
      if(typeof syncActiveFireboard==='function') setTimeout(()=>syncActiveFireboard(true),250);
      render();
    });
  }

  // Replace Start a New Cook so an unfinished or unsynchronized cook cannot
  // be silently abandoned and left marked Cooking in Supabase.
  const oldNew=document.getElementById('newCookV13091');
  if(oldNew){
    const freshBtn=oldNew.cloneNode(true);
    oldNew.replaceWith(freshBtn);
    freshBtn.addEventListener('click',(event)=>{
      event.preventDefault(); event.stopImmediatePropagation();
      if(state.start && !state.finishTime){
        alert(`Cook ${state.cookId||''} is still active. Finish Cook first so its finish time and final event are saved before starting a new cook.`);
        return;
      }
      if(state.finishTime && loadCloudSession()){
        const pending=(state.events||[]).some(e=>e&&e.cloudSynced===false);
        if(state.cloudCookStateSynced===false || pending){
          alert('This finished cook is still waiting for cloud synchronization. Use Sync Current Cook and wait for all events to sync before starting a new cook.');
          return;
        }
      }
      const hasCurrent=!!(state.cookId||state.start||(state.events&&state.events.length));
      const msg=hasCurrent
        ? 'Start a new cook? The finished cook will remain in cloud history. A new Cook ID will be assigned when you tap Meat On.'
        : 'Prepare a fresh cook? A new Cook ID will be assigned when you tap Meat On.';
      if(!confirm(msg)) return;
      const old=state;
      const equipment={smoker:old.smoker,pelletFlavor:old.pelletFlavor,smokeTube:old.smokeTube,superSmoke:old.superSmoke,weberFuel:old.weberFuel,woodForm:old.woodForm,woodFlavor:old.woodFlavor};
      state=defaultState();
      Object.assign(state,equipment);
      state.target=225;
      state.cookName=''; state.weight='';
      state.cloudCookSynced=false; state.cloudCookUuid=null; state.cloudCookStateSynced=false;
      state.cloudSyncMessage='New cook ready. Cook ID will be assigned when Meat On starts.';
      state.cloudLastSeenUpdatedAt=null; state.cloudLastKnownUpdatedAt=null; state.cloudConflict=null;
      state.fireboardCookStartAt=null;
      viewedCloudRecovery=null;
      const target=document.getElementById('target'); if(target) target.value='225';
      save(); render();
    });
  }

  document.title='LDCookLog Mobile V1.30.15';
  const h=document.querySelector('header .sub'); if(h)h.textContent='V1.30.15 Stateful BBQ Control Panel';
  const f=document.querySelector('.footer-note'); if(f)f.innerHTML=`V1.30.15 protects cook completion: Finish Cook preserves the finished cook while synchronizing it, and Start a New Cook cannot abandon an active or pending finished cook.<br><strong>Build ${BUILD}</strong>`;
  let rp=document.getElementById('runtimeProofV13013'); if(rp)rp.textContent=`RUNTIME CHECK: Build ${BUILD} JavaScript executed. Finish/New Cook safety active.`;
})();
</script>
'''
    html=html.replace('</body>',script+'\n</body>',1)
    INDEX.write_text(html,encoding='utf-8')

sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-14' in sw: sw=sw.replace('ldcooklog-v1-30-14','ldcooklog-v1-30-15',1)
elif 'ldcooklog-v1-30-15' not in sw: raise SystemExit('Unexpected cache version')
SW.write_text(sw,encoding='utf-8')
print('Patched V1.30.15 finish/new-cook safety')
