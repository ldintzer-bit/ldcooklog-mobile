from pathlib import Path

INDEX=Path('index.html')
SW=Path('service-worker.js')
MARKER='LDCookLog Mobile V1.30.4 event-only parent dirty fix'
html=INDEX.read_text(encoding='utf-8')
if MARKER in html:
    print('V1.30.4 already present')
else:
    hotfix=r'''
<script>
// LDCookLog Mobile V1.30.4 event-only parent dirty fix
// Append-only events that do not change the parent cook row must not mark that row dirty.
(() => {
  const BUILD="2026-09-16D";
  let suppressParentDirtyV1304=false;
  const previousMarkCloudCookDirtyV1304=markCloudCookDirty;
  markCloudCookDirty=function(){
    if(suppressParentDirtyV1304) return;
    return previousMarkCloudCookDirtyV1304.apply(this,arguments);
  };

  const previousLogEventV1304=logEvent;
  logEvent=function(type,note=""){
    // These events are append-only history. They do not alter fields stored on
    // the cooks parent row, so syncing them must not force a parent PATCH.
    const eventOnly=(type==="Note" || type==="Spritz" || type==="Lid Open" || type==="Lid Closed");
    if(!eventOnly) return previousLogEventV1304.apply(this,arguments);
    suppressParentDirtyV1304=true;
    try{return previousLogEventV1304.apply(this,arguments);}
    finally{suppressParentDirtyV1304=false;}
  };

  document.title="LDCookLog Mobile V1.30.4";
  const headerSub=document.querySelector("header .sub");
  if(headerSub) headerSub.textContent="V1.30.4 Stateful BBQ Control Panel";
  const footer=document.querySelector(".footer-note");
  if(footer) footer.innerHTML=`V1.30.4 event-only sync: notes, spritzes, and lid events sync without falsely marking the parent cook record dirty.<br><strong>Build ${BUILD}</strong>`;
  save();render();
})();
</script>
'''
    if '</body>' not in html: raise SystemExit('Could not find </body>')
    INDEX.write_text(html.replace('</body>',hotfix+'\n</body>',1),encoding='utf-8')
    print('Patched index.html for V1.30.4')

sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-3' in sw:
    sw=sw.replace('ldcooklog-v1-30-3','ldcooklog-v1-30-4',1)
elif 'ldcooklog-v1-30-4' not in sw:
    raise SystemExit('Unexpected service-worker cache version')
SW.write_text(sw,encoding='utf-8')
print('Updated service worker cache to V1.30.4')
