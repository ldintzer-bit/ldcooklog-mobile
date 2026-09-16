from pathlib import Path

INDEX=Path('index.html')
SW=Path('service-worker.js')
MARKER='LDCookLog Mobile V1.30.6 double-tap fix'
html=INDEX.read_text(encoding='utf-8')
if MARKER in html:
    print('V1.30.6 already present')
else:
    hotfix=r'''
<script>
// LDCookLog Mobile V1.30.6 double-tap fix
(() => {
  const BUILD="2026-09-16F";

  // V1.30.5 installed its capture listener after the original bubble listener
  // had already been registered. stopImmediatePropagation in capture therefore
  // could also prevent the first tap from reaching the original handler.
  // V1.30.6 instead installs a small capture-phase gate that lets the first tap
  // pass through normally and suppresses only a second tap inside 1000 ms.
  const phaseTapTimesV1306=new WeakMap();
  function installPhaseTapGateV1306(id){
    const el=document.getElementById(id);
    if(!el) return;
    el.addEventListener('click',function(ev){
      const now=Date.now();
      const previous=phaseTapTimesV1306.get(el)||0;
      if(previous && now-previous<1000){
        ev.preventDefault();
        ev.stopImmediatePropagation();
        return;
      }
      phaseTapTimesV1306.set(el,now);
    },true);
  }

  // Neutralize the V1.30.5 gate by replacing the two buttons with clones.
  // Cloning removes all old listeners on those elements; then reattach the
  // original phase behavior explicitly and put the corrected gate in front.
  function replacePhaseButtonV1306(id,handler){
    const old=document.getElementById(id);
    if(!old) return;
    const fresh=old.cloneNode(true);
    old.replaceWith(fresh);
    fresh.addEventListener('click',handler);
    installPhaseTapGateV1306(id);
  }

  replacePhaseButtonV1306('restToggle',()=>withActionLock('rest',()=>{
    if(state.finishTime)return;
    if(state.phase==='Rest'){
      state.phase='Cooking';state.phaseStart=null;state.phaseTarget=null;logEvent('Rest End');
    }else{
      state.phase='Rest';state.phaseStart=new Date().toISOString();state.phaseTarget=null;logEvent('Rest Start');
    }
  }));

  replacePhaseButtonV1306('holdToggle',()=>withActionLock('hold',()=>{
    if(state.finishTime)return;
    if(state.phase==='Keep Warm'){
      state.phase='Cooking';state.phaseStart=null;state.phaseTarget=null;logEvent('Keep Warm End');
    }else{
      state.phase='Keep Warm';state.phaseStart=new Date().toISOString();state.phaseTarget=165;logEvent('Keep Warm Start','165°F');
    }
  }));

  document.title='LDCookLog Mobile V1.30.6';
  const headerSub=document.querySelector('header .sub');
  if(headerSub) headerSub.textContent='V1.30.6 Stateful BBQ Control Panel';
  const footer=document.querySelector('.footer-note');
  if(footer) footer.innerHTML=`V1.30.6 corrects Rest and Keep Warm double-tap protection while retaining V1.30.5 Wrap Method buttons.<br><strong>Build ${BUILD}</strong>`;
  save();render();
})();
</script>
'''
    if '</body>' not in html: raise SystemExit('Could not find </body>')
    INDEX.write_text(html.replace('</body>',hotfix+'\n</body>',1),encoding='utf-8')
    print('Patched index.html for V1.30.6')

sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-5' in sw:
    sw=sw.replace('ldcooklog-v1-30-5','ldcooklog-v1-30-6',1)
elif 'ldcooklog-v1-30-6' not in sw:
    raise SystemExit('Unexpected service-worker cache version')
SW.write_text(sw,encoding='utf-8')
print('Updated service worker cache to V1.30.6')
