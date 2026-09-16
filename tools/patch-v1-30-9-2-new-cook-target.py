from pathlib import Path

INDEX=Path('index.html')
SW=Path('service-worker.js')
MARKER='LDCookLog Mobile V1.30.9.2 New Cook target reset'
html=INDEX.read_text(encoding='utf-8')

if MARKER in html:
    print('V1.30.9.2 already present')
else:
    # V1.30.9.1 preserved state.target, which can be the temporary 165F
    # Keep Warm target. A fresh cook must start from the normal 225F target.
    old='''const setup={
      smoker:state.smoker,
      target:state.target,
      pelletFlavor:state.pelletFlavor,'''
    new='''const setup={
      smoker:state.smoker,
      target:225,
      pelletFlavor:state.pelletFlavor,'''
    if old not in html:
        raise SystemExit('Could not find V1.30.9.1 New Cook setup block')
    html=html.replace(old,new,1)

    script=r'''
<script>
// LDCookLog Mobile V1.30.9.2 New Cook target reset
(() => {
  const BUILD="2026-09-16K";
  document.title='LDCookLog Mobile V1.30.9.2';
  const headerSub=document.querySelector('header .sub');
  if(headerSub) headerSub.textContent='V1.30.9.2 Stateful BBQ Control Panel';
  const footer=document.querySelector('.footer-note');
  if(footer) footer.innerHTML=`V1.30.9.2 resets a fresh cook's Initial Target to 225&deg;F instead of carrying forward a temporary Keep Warm target.<br><strong>Build ${BUILD}</strong>`;
})();
</script>
'''
    if '</body>' not in html:
        raise SystemExit('Could not find </body>')
    html=html.replace('</body>',script+'\n</body>',1)
    INDEX.write_text(html,encoding='utf-8')
    print('Patched index.html for V1.30.9.2')

sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-9-1' in sw:
    sw=sw.replace('ldcooklog-v1-30-9-1','ldcooklog-v1-30-9-2',1)
elif 'ldcooklog-v1-30-9-2' not in sw:
    raise SystemExit('Unexpected service-worker cache version')
SW.write_text(sw,encoding='utf-8')
print('Updated service worker cache to V1.30.9.2')
