from pathlib import Path
INDEX=Path('index.html'); SW=Path('service-worker.js')
html=INDEX.read_text(encoding='utf-8')
MARK='LDCookLog Mobile V1.30.13 runtime proof'
if MARK not in html:
    script=r'''
<script>
// LDCookLog Mobile V1.30.13 runtime proof
(() => {
 const BUILD='2026-09-16V';
 function proof(text){
   let el=document.getElementById('runtimeProofV13013');
   if(!el){el=document.createElement('div');el.id='runtimeProofV13013';el.style.cssText='margin:8px 0;padding:8px;border:2px solid currentColor;border-radius:8px;font-weight:700;white-space:pre-wrap';const footer=document.querySelector('.footer-note');if(footer&&footer.parentNode)footer.parentNode.insertBefore(el,footer);else document.body.appendChild(el)}
   el.textContent=text;
 }
 window.__LDC_RUNTIME_BUILD__=BUILD;
 proof(`RUNTIME CHECK: Build ${BUILD} JavaScript executed.`);
 setTimeout(async()=>{
   try{
     proof(`RUNTIME CHECK: Build ${BUILD} JavaScript executed.\nStartup reconciliation is running…`);
     if(typeof window.reconcileCloudStartupV13012!=='function') throw new Error('V1.30.12 reconciliation function is missing');
     const ok=await window.reconcileCloudStartupV13012();
     const msg=(state&&state.cloudSyncMessage)?state.cloudSyncMessage:'No Cloud Sync diagnostic was produced.';
     proof(`RUNTIME CHECK: Build ${BUILD} JavaScript executed.\nStartup reconciliation returned ${String(ok)}.\n${msg}`);
   }catch(e){proof(`RUNTIME CHECK: Build ${BUILD} JavaScript executed.\nSTARTUP ERROR: ${e&&e.message?e.message:String(e)}`)}
 },2500);
})();
</script>
'''
    html=html.replace('</body>',script+'\n</body>',1)
    html=html.replace('V1.30.12 Stateful BBQ Control Panel','V1.30.13 Stateful BBQ Control Panel')
    html=html.replace('<strong>Build 2026-09-16U</strong>','<strong>Build 2026-09-16V</strong>')
    INDEX.write_text(html,encoding='utf-8')
sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-12' in sw: sw=sw.replace('ldcooklog-v1-30-12','ldcooklog-v1-30-13',1)
elif 'ldcooklog-v1-30-13' not in sw: raise SystemExit('Unexpected cache version')
SW.write_text(sw,encoding='utf-8')
print('Patched V1.30.13 runtime proof')
