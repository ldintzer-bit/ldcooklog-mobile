from pathlib import Path

INDEX=Path('index.html')
SW=Path('service-worker.js')
MARKER='LDCookLog Mobile V1.30.5 control safety and wrap choices'
html=INDEX.read_text(encoding='utf-8')
if MARKER in html:
    print('V1.30.5 already present')
else:
    hotfix=r'''
<script>
// LDCookLog Mobile V1.30.5 control safety and wrap choices
(() => {
  const BUILD="2026-09-16E";

  // Ignore an immediate second tap on phase toggles. A later deliberate tap
  // still ends the phase normally.
  const lastPhaseTapV1305={rest:0,hold:0};
  function protectDoubleTapV1305(id,key){
    const el=document.getElementById(id);
    if(!el) return;
    el.addEventListener('click',ev=>{
      const now=Date.now();
      if(now-lastPhaseTapV1305[key]<1000){
        ev.preventDefault();
        ev.stopImmediatePropagation();
        return;
      }
      lastPhaseTapV1305[key]=now;
    },true);
  }
  protectDoubleTapV1305('restToggle','rest');
  protectDoubleTapV1305('holdToggle','hold');

  // Replace typed wrap-choice validation with large tap targets. "Other"
  // intentionally opens a text field so uncommon methods remain recordable.
  const wrapButton=document.getElementById('wrapToggle');
  if(wrapButton){
    const overlay=document.createElement('div');
    overlay.id='wrapChoiceV1305';
    overlay.className='hidden';
    overlay.innerHTML=`<div style="position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9998"></div>
      <div role="dialog" aria-modal="true" aria-labelledby="wrapChoiceTitleV1305" style="position:fixed;z-index:9999;left:14px;right:14px;top:50%;transform:translateY(-50%);max-width:520px;margin:auto;background:#1a1a1a;border:1px solid #444;border-radius:16px;padding:16px">
        <h2 id="wrapChoiceTitleV1305" style="margin:0 0 12px">Choose Wrap Method</h2>
        <div style="display:grid;grid-template-columns:1fr;gap:10px">
          <button type="button" data-wrap="Foil">Foil</button>
          <button type="button" data-wrap="Butcher Paper">Butcher Paper</button>
          <button type="button" data-wrap="Foil Boat">Foil Boat</button>
          <button type="button" class="secondary" data-wrap="Other">Other…</button>
          <button type="button" class="secondary" data-wrap-cancel="1">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close=()=>overlay.classList.add('hidden');
    overlay.querySelector('[data-wrap-cancel]').addEventListener('click',close);
    overlay.firstElementChild.addEventListener('click',close);
    overlay.querySelectorAll('[data-wrap]').forEach(btn=>btn.addEventListener('click',()=>{
      let method=btn.dataset.wrap;
      if(method==='Other'){
        const custom=prompt('Enter wrap method:','');
        if(custom===null) return;
        method=custom.trim();
        if(!method) return;
      }
      close();
      if(state.finishTime || state.wrapped) return;
      state.wrapMethod=method;
      state.wrapped=true;
      logEvent('Wrapped',`Wrap method: ${method}`);
    }));

    wrapButton.addEventListener('click',ev=>{
      if(state.finishTime) return;
      // Preserve the existing Unwrap behavior. Only intercept a new Wrap.
      if(state.wrapped) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      overlay.classList.remove('hidden');
    },true);
  }

  document.title='LDCookLog Mobile V1.30.5';
  const headerSub=document.querySelector('header .sub');
  if(headerSub) headerSub.textContent='V1.30.5 Stateful BBQ Control Panel';
  const footer=document.querySelector('.footer-note');
  if(footer) footer.innerHTML=`V1.30.5 adds accidental double-tap protection for Rest and Keep Warm plus tap-to-select Wrap Method choices with custom Other entry.<br><strong>Build ${BUILD}</strong>`;
  save();render();
})();
</script>
'''
    if '</body>' not in html: raise SystemExit('Could not find </body>')
    INDEX.write_text(html.replace('</body>',hotfix+'\n</body>',1),encoding='utf-8')
    print('Patched index.html for V1.30.5')

sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-4' in sw:
    sw=sw.replace('ldcooklog-v1-30-4','ldcooklog-v1-30-5',1)
elif 'ldcooklog-v1-30-5' not in sw:
    raise SystemExit('Unexpected service-worker cache version')
SW.write_text(sw,encoding='utf-8')
print('Updated service worker cache to V1.30.5')
