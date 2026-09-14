from pathlib import Path

p=Path('index.html')
text=p.read_text()

old="""      await renderFireboardProbeAssignments(graphHost, rows, fbSession);\n      graphHost.querySelector('.fireboard-analysis')?.remove();\n      setFireboardStatus(forceFinal"""
new="""      await renderFireboardProbeAssignments(graphHost, rows, fbSession);\n      setFireboardStatus(forceFinal"""
if text.count(old)!=1: raise SystemExit('live analysis removal anchor not found')
text=text.replace(old,new,1)

for old,new in [
("  document.title = 'LDCookLog Mobile V1.26.0';","  document.title = 'LDCookLog Mobile V1.26.1';"),
("  if (headerSub) headerSub.textContent = 'V1.26.0 Stateful BBQ Control Panel';","  if (headerSub) headerSub.textContent = 'V1.26.1 Stateful BBQ Control Panel';"),
("  if (footer) footer.innerHTML = 'V1.26.0 makes FireBoard analysis purpose-aware: Food and Smoker / chamber streams are analyzed separately using the user-selected purpose, with no label or temperature guessing. Other / reference streams remain stored but are excluded from cook metrics.<br><strong>Build 2026-09-14H</strong>';","  if (footer) footer.innerHTML = 'V1.26.1 displays the purpose-aware FireBoard analysis during live cooks instead of removing it after each live refresh. Food and Smoker / chamber streams remain separated using the saved user-selected purpose.<br><strong>Build 2026-09-14I</strong>';"),
]:
    if text.count(old)!=1: raise SystemExit('version anchor not found')
    text=text.replace(old,new,1)

p.write_text(text)

swp=Path('service-worker.js'); sw=swp.read_text(); old="const CACHE_NAME = 'ldcooklog-v1-26-0';"; new="const CACHE_NAME = 'ldcooklog-v1-26-1';"
if sw.count(old)!=1: raise SystemExit('cache anchor not found')
swp.write_text(sw.replace(old,new,1))
print('V1.26.1 live analysis rendering fix applied successfully.')
