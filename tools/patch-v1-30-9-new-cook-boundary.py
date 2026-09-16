from pathlib import Path

INDEX=Path('index.html')
SW=Path('service-worker.js')
MARKER='LDCookLog Mobile V1.30.9 New Cook boundary protection'
html=INDEX.read_text(encoding='utf-8')

if MARKER in html:
    print('V1.30.9 already present')
else:
    # Give the existing reset area an explicit, safer New Cook action. The old
    # Reset Cook remains available for destructive troubleshooting/reset use.
    old='<button class="danger" id="resetCook">Reset Cook</button>'
    new='<button class="secondary" id="newCookV1309">New Cook</button><button class="danger" id="resetCook">Reset Cook</button>'
    if old not in html:
        raise SystemExit('Could not find Reset Cook button')
    html=html.replace(old,new,1)

    script=r'''
<script>
// LDCookLog Mobile V1.30.9 New Cook boundary protection
(() => {
  const BUILD="2026-09-16I";

  function beginFreshCookV1309(){
    // A new cook must never inherit the previous cook's identity, events,
    // Supabase UUID, sync baseline, phase timer, or FireBoard cook boundary.
    const setup={
      smoker:state.smoker,
      cookName:state.cookName,
      weight:state.weight,
      target:state.target,
      pelletFlavor:state.pelletFlavor,
      smokeTube:state.smokeTube,
      superSmoke:state.superSmoke,
      weberFuel:state.weberFuel,
      woodForm:state.woodForm,
      woodFlavor:state.woodFlavor
    };
    state=defaultState();
    Object.assign(state,setup);
    state.cookId=null;
    state.start=null;
    state.finishTime=null;
    state.events=[];
    state.cloudCookSynced=false;
    state.cloudCookUuid=null;
    state.cloudCookStateSynced=false;
    state.cloudSyncMessage='New cook ready. Cook ID will be assigned when Meat On starts.';
    state.cloudLastKnownUpdatedAt=null;
    state.cloudConflict=null;
    state.fireboardCookStartAt=null;
    viewedCloudRecovery=null;
    save();
    render();
    if(typeof renderCloudSyncStatus==='function') renderCloudSyncStatus();
  }

  const newCook=document.getElementById('newCookV1309');
  if(newCook){
    newCook.addEventListener('click',()=>{
      const hasCurrent=!!(state.cookId||state.start||state.events.length);
      const message=hasCurrent
        ? 'Start a new cook? The current cook will remain in cloud history, and this device will be separated from it. The new Cook ID is assigned when you tap Meat On.'
        : 'Prepare a fresh cook? The Cook ID will be assigned when you tap Meat On.';
      if(!confirm(message)) return;
      beginFreshCookV1309();
    });
  }

  document.title='LDCookLog Mobile V1.30.9';
  const headerSub=document.querySelector('header .sub');
  if(headerSub) headerSub.textContent='V1.30.9 Stateful BBQ Control Panel';
  const footer=document.querySelector('.footer-note');
  if(footer) footer.innerHTML=`V1.30.9 adds an explicit New Cook boundary so a fresh cook cannot inherit the previous cook's cloud identity, events, phase timers, or FireBoard boundary.<br><strong>Build ${BUILD}</strong>`;
  save();render();
})();
</script>
'''
    if '</body>' not in html:
        raise SystemExit('Could not find </body>')
    html=html.replace('</body>',script+'\n</body>',1)
    INDEX.write_text(html,encoding='utf-8')
    print('Patched index.html for V1.30.9')

sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-8' in sw:
    sw=sw.replace('ldcooklog-v1-30-8','ldcooklog-v1-30-9',1)
elif 'ldcooklog-v1-30-9' not in sw:
    raise SystemExit('Unexpected service-worker cache version')
SW.write_text(sw,encoding='utf-8')
print('Updated service worker cache to V1.30.9')
