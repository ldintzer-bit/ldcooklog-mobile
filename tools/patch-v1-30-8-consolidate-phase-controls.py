from pathlib import Path
import re

INDEX=Path('index.html')
SW=Path('service-worker.js')
MARKER='LDCookLog Mobile V1.30.8 consolidated phase controls'
html=INDEX.read_text(encoding='utf-8')
if MARKER in html:
    print('V1.30.8 already present')
else:
    # Remove the obsolete V1.30.5 Rest/Keep Warm capture gates while retaining
    # the V1.30.5 Wrap Method UI.
    old_gate=re.compile(r'''\n  // Ignore an immediate second tap on phase toggles\. A later deliberate tap\n  // still ends the phase normally\.\n  const lastPhaseTapV1305=\{rest:0,hold:0\};\n  function protectDoubleTapV1305\(id,key\)\{.*?\n  protectDoubleTapV1305\('holdToggle','hold'\);\n''',re.S)
    html,n=old_gate.subn('\n  // V1.30.8: obsolete phase double-tap gate removed; Wrap Method UI retained.\n',html,count=1)
    if n!=1: raise SystemExit('Could not remove V1.30.5 phase gate')

    # Remove V1.30.6 and V1.30.7 phase-control scripts entirely. They both
    # cloned/replaced the buttons and created competing generations of handlers.
    for marker in ['LDCookLog Mobile V1.30.6 double-tap fix','LDCookLog Mobile V1.30.7 phase stop guard']:
        pattern=re.compile(r'\n<script>\n// '+re.escape(marker)+r'.*?</script>\n',re.S)
        html,n=pattern.subn('\n',html,count=1)
        if n!=1: raise SystemExit(f'Could not remove obsolete script: {marker}')

    # Replace the original Rest and Keep Warm handlers in the base application.
    old_hold=re.compile(r'''\$\("holdToggle"\)\.addEventListener\("click",\(\)=>withActionLock\("hold",\(\)=>\{.*?\}\)\);''',re.S)
    new_hold='''$("holdToggle").addEventListener("click",()=>withActionLock("hold",()=>{if(state.finishTime)return;if(state.phase!=="Keep Warm"){const previousTarget=state.target,n=165;state.phase="Keep Warm";state.phaseStart=new Date().toISOString();state.phaseTarget=n;state.target=n;$("target").value=n;save();render();logEvent("Keep Warm Start",`Target changed from ${previousTarget}°F to 165°F; hold timer started`)}else{if(state.phaseStart&&Date.now()-new Date(state.phaseStart).getTime()<2000)return;const duration=durString(state.phaseStart);logEvent("Keep Warm End",`Hold duration ${duration}`);state.phase="Post Hold";state.phaseStart=null;state.phaseTarget=null;markCloudCookDirty();save();render();if(loadCloudSession())syncCurrentCookAndEvents()}},2000));'''
    html,n=old_hold.subn(new_hold,html,count=1)
    if n!=1: raise SystemExit('Could not replace original Keep Warm handler')

    old_rest=re.compile(r'''\$\("restToggle"\)\.addEventListener\("click",\(\)=>withActionLock\("rest",\(\)=>\{.*?\}\)\);''',re.S)
    new_rest='''$("restToggle").addEventListener("click",()=>withActionLock("rest",()=>{if(state.finishTime)return;if(state.phase!=="Rest"){state.phase="Rest";state.phaseStart=new Date().toISOString();state.phaseTarget=null;save();render();logEvent("Rest Start","Rest timer started")}else{if(state.phaseStart&&Date.now()-new Date(state.phaseStart).getTime()<2000)return;const duration=durString(state.phaseStart);logEvent("Rest End",`Rest duration ${duration}`);state.phase="Post Rest";state.phaseStart=null;state.phaseTarget=null;markCloudCookDirty();save();render();if(loadCloudSession())syncCurrentCookAndEvents()}},2000));'''
    html,n=old_rest.subn(new_rest,html,count=1)
    if n!=1: raise SystemExit('Could not replace original Rest handler')

    # Version marker only. No additional phase listeners are added here.
    marker_script=r'''
<script>
// LDCookLog Mobile V1.30.8 consolidated phase controls
(() => {
  const BUILD="2026-09-16H";
  document.title='LDCookLog Mobile V1.30.8';
  const headerSub=document.querySelector('header .sub');
  if(headerSub) headerSub.textContent='V1.30.8 Stateful BBQ Control Panel';
  const footer=document.querySelector('.footer-note');
  if(footer) footer.innerHTML=`V1.30.8 consolidates Rest and Keep Warm into one authoritative handler each, with a 2-second stop guard.<br><strong>Build ${BUILD}</strong>`;
  save();render();
})();
</script>
'''
    if '</body>' not in html: raise SystemExit('Could not find </body>')
    html=html.replace('</body>',marker_script+'\n</body>',1)
    INDEX.write_text(html,encoding='utf-8')
    print('Patched index.html for V1.30.8')

sw=SW.read_text(encoding='utf-8')
if 'ldcooklog-v1-30-7' in sw:
    sw=sw.replace('ldcooklog-v1-30-7','ldcooklog-v1-30-8',1)
elif 'ldcooklog-v1-30-8' not in sw:
    raise SystemExit('Unexpected service-worker cache version')
SW.write_text(sw,encoding='utf-8')
print('Updated service worker cache to V1.30.8')
