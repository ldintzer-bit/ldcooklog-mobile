from pathlib import Path

INDEX=Path('index.html')
SW=Path('service-worker.js')
MARKER='LDCookLog Mobile V1.30.9.1 corrected New Cook implementation'
html=INDEX.read_text(encoding='utf-8')

if MARKER in html:
    print('V1.30.9.1 already present')
else:
    # Replace the V1.30.9 New Cook button with a clearly separated control.
    old='<button class="secondary" id="newCookV1309">New Cook</button><button class="danger" id="resetCook">Reset Cook</button>'
    new='<button class="blue" id="newCookV13091" type="button" style="flex-basis:100%">Start a New Cook</button><button class="danger" id="resetCook">Reset Cook</button>'
    if old not in html:
        raise SystemExit('Could not find V1.30.9 New Cook / Reset Cook controls')
    html=html.replace(old,new,1)

    script=r'''
<script>
// LDCookLog Mobile V1.30.9.1 corrected New Cook implementation
(() => {
  const BUILD="2026-09-16J";

  function beginFreshCookV13091(){
    // Preserve cooker/equipment preferences only. Meat-specific information,
    // cook identity, events, timers, cloud baselines and FireBoard boundaries
    // belong to the old cook and must not cross this boundary.
    const setup={
      smoker:state.smoker,
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
    state.cookName='';
    state.weight='';
    state.cookId=null;
    state.start=null;
    state.finishTime=null;
    state.meatOn=false;
    state.lidOpen=false;
    state.wrapped=false;
    state.wrapMethod=null;
    state.phase='Setup';
    state.phaseStart=null;
    state.phaseTarget=null;
    state.events=[];
    state.cloudCookSynced=false;
    state.cloudCookUuid=null;
    state.cloudCookStateSynced=false;
    state.cloudSyncMessage='New cook ready. Cook ID will be assigned when Meat On starts.';
    state.cloudLastSeenUpdatedAt=null;
    state.cloudLastKnownUpdatedAt=null;
    state.cloudConflict=null;
    state.fireboardCookStartAt=null;
    viewedCloudRecovery=null;
    save();
    render();
    if(typeof renderCloudSyncStatus==='function') renderCloudSyncStatus();
  }

  const newCook=document.getElementById('newCookV13091');
  if(newCook){
    // Capture phase + stopImmediatePropagation makes this control independent
    // of every older layered click handler in the app.
    newCook.addEventListener('click',(event)=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      const hasCurrent=!!(state.cookId||state.start||(state.events&&state.events.length));
      const message=hasCurrent
        ? 'Start a new cook? The current cook will remain in cloud history. This device will start with a clean local cook, and a new Cook ID will be assigned when you tap Meat On.'
        : 'Prepare a fresh cook? A new Cook ID will be assigned when you tap Meat On.';
      if(!confirm(message)) return;
      beginFreshCookV13091();
    },true);
  }

  // Disable the obsolete V1.30.9 button/listener if an unusual cached DOM ever
  // contains it. It must never be a valid control in this build.
  const obsolete=document.getElementById('newCookV1309');
  if(obsolete){ obsolete.disabled=true; obsolete.style.display='none'; }

  document.title='LDCookLog Mobile V1.30.9.1';
  const headerSub=document.querySelector('header .sub');
  if(headerSub) headerSub.textContent='V1.30.9.1 Stateful BBQ Control Panel';
  const footer=document.querySelector('.footer-note');
  if(footer) footer.innerHTML=`V1.30.9.1 corrects the New Cook boundary and isolates it from the destructive Reset Cook control.<br><strong>Build ${BUILD}</strong>`;
  save();render();
})();
</script>
'''
    if '</body>' not in html:
        raise SystemExit('Could not find </body>')
    html=html.replace('</body>',script+'\n</body>',1)
    INDEX.write_text(html,encoding='utf-8')
    print('Patched index.html for V1.30.9.1')

sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-9' in sw:
    sw=sw.replace('ldcooklog-v1-30-9','ldcooklog-v1-30-9-1',1)
elif 'ldcooklog-v1-30-9-1' not in sw:
    raise SystemExit('Unexpected service-worker cache version')
SW.write_text(sw,encoding='utf-8')
print('Updated service worker cache to V1.30.9.1')
