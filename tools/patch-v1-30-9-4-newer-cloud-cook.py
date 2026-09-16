from pathlib import Path

INDEX=Path('index.html')
SW=Path('service-worker.js')
MARKER='LDCookLog Mobile V1.30.9.4 newer cloud cook adoption'
html=INDEX.read_text(encoding='utf-8')

if MARKER not in html:
    script=r'''
<script>
// LDCookLog Mobile V1.30.9.4 newer cloud cook adoption
(() => {
  const BUILD='2026-09-16M';
  document.title='LDCookLog Mobile V1.30.9.4';
  const headerSub=document.querySelector('header .sub');
  if(headerSub) headerSub.textContent='V1.30.9.4 Stateful BBQ Control Panel';
  const footer=document.querySelector('.footer-note');
  if(footer) footer.innerHTML=`V1.30.9.4 adds protection for a clean device left on an older Cook ID when a newer active cook exists in cloud history.<br><strong>Build ${BUILD}</strong>`;

  function cookSeq(id){
    const m=String(id||'').match(/^(\d{8})-(\d+)$/);
    return m ? [Number(m[1]),Number(m[2])] : null;
  }
  function isNewerCookId(a,b){
    const A=cookSeq(a), B=cookSeq(b);
    if(!A||!B) return false;
    return A[0]>B[0] || (A[0]===B[0] && A[1]>B[1]);
  }
  function localIsClean(){
    if(!state || !state.cookId) return true;
    if(state.cloudCookStateSynced===false) return false;
    return !(state.events||[]).some(e=>e && e.cloudSynced===false);
  }
  async function adoptNewerActiveCloudCookV13094(){
    try{
      if(!cloudSession || !cloudSession.access_token || !state || !state.cookId || !localIsClean()) return false;
      const rows=await supabaseRequest('/rest/v1/cooks?select=*&order=started_at.desc&limit=20','GET',null,true);
      if(!Array.isArray(rows)) return false;
      const newer=rows.find(r=>r && r.cook_id && !r.finished_at && isNewerCookId(r.cook_id,state.cookId));
      if(!newer) return false;
      viewedCloudRecovery=newer;
      if(typeof applyCloudRecovery==='function'){
        await applyCloudRecovery(newer);
        state.cloudConflict=null;
        state.cloudSyncMessage=`Adopted newer active cloud cook ${newer.cook_id}.`;
        save(); render();
        if(typeof mergeCloudEventsForCurrentCookV1303==='function') await mergeCloudEventsForCurrentCookV1303();
        return true;
      }
    }catch(err){ console.warn('V1.30.9.4 newer-cook check:',err); }
    return false;
  }
  window.adoptNewerActiveCloudCookV13094=adoptNewerActiveCloudCookV13094;
  setTimeout(()=>adoptNewerActiveCloudCookV13094(),2200);
})();
</script>
'''
    if '</body>' not in html: raise SystemExit('Could not find </body>')
    html=html.replace('</body>',script+'\n</body>',1)
    INDEX.write_text(html,encoding='utf-8')

sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-9-3' in sw:
    sw=sw.replace('ldcooklog-v1-30-9-3','ldcooklog-v1-30-9-4',1)
elif 'ldcooklog-v1-30-9-4' not in sw:
    raise SystemExit('Unexpected service-worker cache version')
SW.write_text(sw,encoding='utf-8')
print('Patched V1.30.9.4')
