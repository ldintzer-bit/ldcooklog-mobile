from pathlib import Path

p = Path('index.html')
text = p.read_text()

old = "  async function readFireboardProbeRoles(accessToken) {\n"
new = "  let fireboardProbeRoleCache = new Map();\n\n  async function readFireboardProbeRoles(accessToken) {\n"
if text.count(old) != 1:
    raise SystemExit(f'Expected one probe role reader, found {text.count(old)}')
text = text.replace(old, new, 1)

old = "    return new Map((Array.isArray(data)?data:[]).map(x=>[`${x.device_uuid}::${Number(x.channel_id)}`,x]));\n"
new = "    fireboardProbeRoleCache = new Map((Array.isArray(data)?data:[]).map(x=>[`${x.device_uuid}::${Number(x.channel_id)}`,x]));\n    return fireboardProbeRoleCache;\n"
if text.count(old) != 1:
    raise SystemExit('Probe role cache anchor not found')
text = text.replace(old, new, 1)

old = "  async function renderFireboardProbeAssignments(host, rows) {\n"
new = "  async function renderFireboardProbeAssignments(host, rows, fbSession = null) {\n"
if text.count(old) != 1:
    raise SystemExit('Probe assignment signature anchor not found')
text = text.replace(old, new, 1)

old = "    let roles; try { roles=await readFireboardProbeRoles(auth.access_token); } catch(e) { return; }\n"
new = "    let roles; try { roles=await readFireboardProbeRoles(auth.access_token); } catch(e) { return; }\n    if (fbSession) renderFireboardTemperatureGraph(host, fbSession, rows, roles);\n"
if text.count(old) != 1:
    raise SystemExit('Probe role read anchor not found')
text = text.replace(old, new, 1)

old = "      btn.addEventListener('click',async()=>{const role=input.value.trim(); if(!role){alert('Enter a probe role first.');return;} btn.disabled=true; btn.textContent='Saving…'; try{auth=loadCloudSession(); await saveFireboardProbeRole(auth.access_token,sensor.device_uuid,sensor.channel_id,sensor.label,role); roles.set(key,{cook_role:role}); btn.textContent='Saved'; setTimeout(()=>{btn.textContent='Save';btn.disabled=false},1200);}catch(e){btn.textContent='Save';btn.disabled=false;alert(`Could not save probe role: ${e.message}`);}});\n"
new = "      btn.addEventListener('click',async()=>{const role=input.value.trim(); if(!role){alert('Enter a probe role first.');return;} btn.disabled=true; btn.textContent='Saving…'; try{auth=loadCloudSession(); await saveFireboardProbeRole(auth.access_token,sensor.device_uuid,sensor.channel_id,sensor.label,role); roles.set(key,{cook_role:role,source_label:sensor.label}); fireboardProbeRoleCache=roles; if(fbSession){renderFireboardTemperatureGraph(host,fbSession,rows,roles);host.appendChild(wrap);} btn.textContent='Saved'; setTimeout(()=>{btn.textContent='Save';btn.disabled=false},1200);}catch(e){btn.textContent='Save';btn.disabled=false;alert(`Could not save probe role: ${e.message}`);}});\n"
if text.count(old) != 1:
    raise SystemExit('Probe save handler anchor not found')
text = text.replace(old, new, 1)

old = "  function renderFireboardTemperatureGraph(container, fbSession, rows) {\n"
new = "  function renderFireboardTemperatureGraph(container, fbSession, rows, probeRoles = fireboardProbeRoleCache) {\n"
if text.count(old) != 1:
    raise SystemExit('Graph signature anchor not found')
text = text.replace(old, new, 1)

old = "      item.textContent = `● ${group.label}: ${Math.min(...temps).toFixed(1)}–${Math.max(...temps).toFixed(1)} °${unit}`;\n"
new = "      const assignedRole = probeRoles?.get(sensorKey)?.cook_role?.trim();\n      const displayLabel = assignedRole ? `${assignedRole} (${group.label})` : group.label;\n      item.textContent = `● ${displayLabel}: ${Math.min(...temps).toFixed(1)}–${Math.max(...temps).toFixed(1)} °${unit}`;\n"
if text.count(old) != 1:
    raise SystemExit('Legend label anchor not found')
text = text.replace(old, new, 1)

old = "    diagnosticsNote.textContent = 'Permanent sensor identity uses FireBoard device UUID + actual FireBoard channel ID. LDCookLog cook roles have not been assigned yet.';\n"
new = "    diagnosticsNote.textContent = 'Permanent sensor identity uses FireBoard device UUID + actual FireBoard channel ID. Cook-specific LDCookLog roles are shown when assigned.';\n"
if text.count(old) != 1:
    raise SystemExit('Diagnostic note anchor not found')
text = text.replace(old, new, 1)

old = "    [...groups.values()].sort((a, b) => (a.channel - b.channel) || String(a.deviceUuid || '').localeCompare(String(b.deviceUuid || ''))).forEach(group => {\n      const row = document.createElement('div');\n      row.style.cssText = 'margin-top:7px;padding-top:7px;border-top:1px solid #2b2b2b;overflow-wrap:anywhere';\n      row.textContent = `Device UUID: ${group.deviceUuid || 'not reported'} • FireBoard channel ID: ${group.channel} • FireBoard label: ${group.label}`;\n      diagnostics.appendChild(row);\n    });\n"
new = "    [...groups.entries()].sort((a, b) => (a[1].channel - b[1].channel) || String(a[1].deviceUuid || '').localeCompare(String(b[1].deviceUuid || ''))).forEach(([sensorKey, group]) => {\n      const row = document.createElement('div');\n      row.style.cssText = 'margin-top:7px;padding-top:7px;border-top:1px solid #2b2b2b;overflow-wrap:anywhere';\n      const assignedRole = probeRoles?.get(sensorKey)?.cook_role?.trim();\n      row.textContent = `Device UUID: ${group.deviceUuid || 'not reported'} • FireBoard channel ID: ${group.channel} • FireBoard label: ${group.label}${assignedRole ? ` • LDCookLog role: ${assignedRole}` : ''}`;\n      diagnostics.appendChild(row);\n    });\n"
if text.count(old) != 1:
    raise SystemExit('Diagnostic row anchor not found')
text = text.replace(old, new, 1)

text = text.replace("      await renderFireboardProbeAssignments(container, rows);", "      await renderFireboardProbeAssignments(container, rows, fbSession);")
text = text.replace("      await renderFireboardProbeAssignments(graphHost, rows);", "      await renderFireboardProbeAssignments(graphHost, rows, fbSession);")

for old, new in [
    ("  document.title = 'LDCookLog Mobile V1.24.0';", "  document.title = 'LDCookLog Mobile V1.24.1';"),
    ("  if (headerSub) headerSub.textContent = 'V1.24.0 Stateful BBQ Control Panel';", "  if (headerSub) headerSub.textContent = 'V1.24.1 Stateful BBQ Control Panel';"),
    ("  if (footer) footer.innerHTML = 'V1.24.0 adds cook-specific FireBoard probe assignments while preserving permanent device UUID + channel ID identity and the V1.23.7 cook-start guard. Automatic role guessing is intentionally not included.<br><strong>Build 2026-09-14E</strong>';", "  if (footer) footer.innerHTML = 'V1.24.1 displays saved cook-specific FireBoard probe roles in the temperature graph and sensor identity diagnostics while preserving permanent device UUID + channel ID identity.<br><strong>Build 2026-09-14F</strong>';"),
]:
    if text.count(old) != 1:
        raise SystemExit(f'Version anchor not found: {old[:40]}')
    text = text.replace(old, new, 1)

p.write_text(text)

swp = Path('service-worker.js')
sw = swp.read_text()
old = "const CACHE_NAME = 'ldcooklog-v1-24-0';"
new = "const CACHE_NAME = 'ldcooklog-v1-24-1';"
if sw.count(old) != 1:
    raise SystemExit('Cache anchor not found')
swp.write_text(sw.replace(old, new, 1))

print('V1.24.1 probe role display patch applied successfully.')
