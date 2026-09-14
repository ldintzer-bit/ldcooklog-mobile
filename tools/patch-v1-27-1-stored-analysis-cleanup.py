from pathlib import Path

p=Path('index.html')
text=p.read_text()

old="""        renderFireboardTemperatureGraph(host, fbSession, rows);\n        await renderFireboardProbeAssignments(host, rows, fbSession);"""
new="""        renderFireboardTemperatureGraph(host, fbSession, rows);"""
if text.count(old)!=1: raise SystemExit('stored analysis assignment anchor not found')
text=text.replace(old,new,1)

for old,new in [
("  document.title = 'LDCookLog Mobile V1.27.0';","  document.title = 'LDCookLog Mobile V1.27.1';"),
("  if (headerSub) headerSub.textContent = 'V1.27.0 Stateful BBQ Control Panel';","  if (headerSub) headerSub.textContent = 'V1.27.1 Stateful BBQ Control Panel';"),
("  if (footer) footer.innerHTML = 'V1.27.0 adds stored FireBoard analysis for the current or restored cook using cloud temperature samples, so the graph and purpose-aware analysis remain available after the FireBoard is turned off. Live analysis remains unchanged.<br><strong>Build 2026-09-14J</strong>';","  if (footer) footer.innerHTML = 'V1.27.1 keeps stored FireBoard review read-only: saved probe identities, purposes, graph, and analysis are shown without reopening editable probe-assignment controls. Live probe assignment remains unchanged.<br><strong>Build 2026-09-14K</strong>';"),
]:
    if text.count(old)!=1: raise SystemExit('version anchor not found')
    text=text.replace(old,new,1)

p.write_text(text)

swp=Path('service-worker.js')
sw=swp.read_text()
old="const CACHE_NAME = 'ldcooklog-v1-27-0';"
new="const CACHE_NAME = 'ldcooklog-v1-27-1';"
if sw.count(old)!=1: raise SystemExit('cache anchor not found')
swp.write_text(sw.replace(old,new,1))
print('V1.27.1 stored analysis cleanup applied successfully.')
