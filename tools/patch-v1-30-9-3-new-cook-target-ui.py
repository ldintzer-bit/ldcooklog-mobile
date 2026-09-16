from pathlib import Path

INDEX=Path('index.html')
SW=Path('service-worker.js')
MARKER='LDCookLog Mobile V1.30.9.3 fresh cook target UI reset'
html=INDEX.read_text(encoding='utf-8')

if MARKER in html:
    print('V1.30.9.3 already present')
else:
    # V1.30.9.2 correctly reset state.target to 225, but the Cook Setup
    # input can retain its old DOM value (for example 165 from Keep Warm).
    # Make the New Cook boundary authoritative in both state and the UI.
    old="""    save();
    render();
    if(typeof renderCloudSyncStatus==='function') renderCloudSyncStatus();
  }

  const newCook=document.getElementById('newCookV13091');"""
    new="""    state.target=225;
    save();
    render();
    const targetInput=document.getElementById('target');
    if(targetInput) targetInput.value='225';
    const targetDisplay=document.getElementById('targetDisplay');
    if(targetDisplay) targetDisplay.textContent='225';
    // Persist once more after the UI has been normalized so a stale setup
    // control cannot become the source of truth on the next interaction.
    state.target=225;
    save();
    if(typeof renderCloudSyncStatus==='function') renderCloudSyncStatus();
  }

  const newCook=document.getElementById('newCookV13091');"""
    if old not in html:
        raise SystemExit('Could not find V1.30.9.1 fresh-cook save/render block')
    html=html.replace(old,new,1)

    script=r'''
<script>
// LDCookLog Mobile V1.30.9.3 fresh cook target UI reset
(() => {
  const BUILD="2026-09-16L";
  document.title='LDCookLog Mobile V1.30.9.3';
  const headerSub=document.querySelector('header .sub');
  if(headerSub) headerSub.textContent='V1.30.9.3 Stateful BBQ Control Panel';
  const footer=document.querySelector('.footer-note');
  if(footer) footer.innerHTML=`V1.30.9.3 makes the New Cook 225&deg;F Initial Target authoritative in both saved state and the Cook Setup control.<br><strong>Build ${BUILD}</strong>`;
})();
</script>
'''
    if '</body>' not in html:
        raise SystemExit('Could not find </body>')
    html=html.replace('</body>',script+'\n</body>',1)
    INDEX.write_text(html,encoding='utf-8')
    print('Patched index.html for V1.30.9.3')

sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-9-2' in sw:
    sw=sw.replace('ldcooklog-v1-30-9-2','ldcooklog-v1-30-9-3',1)
elif 'ldcooklog-v1-30-9-3' not in sw:
    raise SystemExit('Unexpected service-worker cache version')
SW.write_text(sw,encoding='utf-8')
print('Updated service worker cache to V1.30.9.3')
