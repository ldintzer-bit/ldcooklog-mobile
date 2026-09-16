from pathlib import Path

INDEX=Path('index.html')
SW=Path('service-worker.js')
MARKER='LDCookLog Mobile V1.30.7 phase stop guard'
html=INDEX.read_text(encoding='utf-8')
if MARKER in html:
    print('V1.30.7 already present')
else:
    hotfix=r'''
<script>
// LDCookLog Mobile V1.30.7 phase stop guard
(() => {
  const BUILD="2026-09-16G";
  const MIN_PHASE_RUN_MS=2000;

  // V1.30.7 protects the phase transition itself rather than trying to
  // distinguish browser click events. A newly started Rest or Keep Warm phase
  // cannot be ended during its first two seconds. This makes an accidental
  // double-tap harmless even if iOS delivers the taps through different event
  // paths or with delayed click timing.
  function phaseJustStartedV1307(){
    if(!state.phaseStart) return false;
    const started=new Date(state.phaseStart).getTime();
    return Number.isFinite(started) && Date.now()-started<MIN_PHASE_RUN_MS;
  }

  function replacePhaseButtonV1307(id,handler){
    const old=document.getElementById(id);
    if(!old) return;
    const fresh=old.cloneNode(true);
    old.replaceWith(fresh);
    fresh.addEventListener('click',handler);
  }

  replacePhaseButtonV1307('restToggle',()=>withActionLock('rest-v1307',()=>{
    if(state.finishTime)return;
    if(state.phase==='Rest'){
      if(phaseJustStartedV1307())return;
      const duration=durString(state.phaseStart);
      logEvent('Rest End',`Rest duration ${duration}`);
      state.phase='Post Rest';state.phaseStart=null;state.phaseTarget=null;
      markCloudCookDirty();save();render();if(loadCloudSession())syncCurrentCookAndEvents();
    }else{
      state.phase='Rest';state.phaseStart=new Date().toISOString();state.phaseTarget=null;
      save();render();logEvent('Rest Start','Rest timer started');
    }
  },2000));

  replacePhaseButtonV1307('holdToggle',()=>withActionLock('hold-v1307',()=>{
    if(state.finishTime)return;
    if(state.phase==='Keep Warm'){
      if(phaseJustStartedV1307())return;
      const duration=durString(state.phaseStart);
      logEvent('Keep Warm End',`Hold duration ${duration}`);
      state.phase='Post Hold';state.phaseStart=null;state.phaseTarget=null;
      markCloudCookDirty();save();render();if(loadCloudSession())syncCurrentCookAndEvents();
    }else{
      const previousTarget=state.target,n=165;
      state.phase='Keep Warm';state.phaseStart=new Date().toISOString();state.phaseTarget=n;state.target=n;
      $('target').value=n;save();render();
      logEvent('Keep Warm Start',`Target changed from ${previousTarget}°F to 165°F; hold timer started`);
    }
  },2000));

  document.title='LDCookLog Mobile V1.30.7';
  const headerSub=document.querySelector('header .sub');
  if(headerSub) headerSub.textContent='V1.30.7 Stateful BBQ Control Panel';
  const footer=document.querySelector('.footer-note');
  if(footer) footer.innerHTML=`V1.30.7 protects Rest and Keep Warm phase transitions from accidental immediate stop taps.<br><strong>Build ${BUILD}</strong>`;
  save();render();
})();
</script>
'''
    if '</body>' not in html: raise SystemExit('Could not find </body>')
    INDEX.write_text(html.replace('</body>',hotfix+'\n</body>',1),encoding='utf-8')
    print('Patched index.html for V1.30.7')

sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-6' in sw:
    sw=sw.replace('ldcooklog-v1-30-6','ldcooklog-v1-30-7',1)
elif 'ldcooklog-v1-30-7' not in sw:
    raise SystemExit('Unexpected service-worker cache version')
SW.write_text(sw,encoding='utf-8')
print('Updated service worker cache to V1.30.7')
