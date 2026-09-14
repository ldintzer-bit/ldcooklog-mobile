from pathlib import Path

p=Path('index.html'); text=p.read_text()

anchor="  function renderFireboardTemperatureGraph(container, fbSession, rows) {"
insert=r'''  async function readFireboardProbeRoles(accessToken) {
    if (!state.cloudCookUuid) return new Map();
    const q = new URLSearchParams({select:'device_uuid,channel_id,source_label,cook_role',cook_id:`eq.${state.cloudCookUuid}`});
    const r = await fetch(`${SUPABASE_URL}/rest/v1/fireboard_probe_roles?${q}`, {headers:fireboardCloudHeaders(accessToken)});
    const data=await r.json().catch(()=>[]);
    if (!r.ok) throw new Error(data?.message || `Could not read probe roles (${r.status}).`);
    return new Map((Array.isArray(data)?data:[]).map(x=>[`${x.device_uuid}::${Number(x.channel_id)}`,x]));
  }

  async function saveFireboardProbeRole(accessToken, deviceUuid, channelId, sourceLabel, cookRole) {
    const payload={cook_id:state.cloudCookUuid,device_uuid:deviceUuid,channel_id:Number(channelId),source_label:sourceLabel||null,cook_role:cookRole.trim()};
    const r=await fetch(`${SUPABASE_URL}/rest/v1/fireboard_probe_roles?on_conflict=cook_id,device_uuid,channel_id`,{method:'POST',headers:{...fireboardCloudHeaders(accessToken),'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(payload)});
    if (!r.ok) { const data=await r.json().catch(()=>null); throw new Error(data?.message || `Could not save probe role (${r.status}).`); }
  }

  async function renderFireboardProbeAssignments(host, rows) {
    if (!host || !state.cloudCookUuid || !Array.isArray(rows) || !rows.length) return;
    host.querySelector('.fireboard-probe-assignments')?.remove();
    let auth=loadCloudSession(); if(!auth?.access_token) return;
    let roles; try { roles=await readFireboardProbeRoles(auth.access_token); } catch(e) { return; }
    const sensors=new Map();
    rows.forEach(row=>{const d=row.device_uuid||'unknown-device', c=Number(row.channel_index); if(!Number.isFinite(c))return; const k=`${d}::${c}`; if(!sensors.has(k)) sensors.set(k,{device_uuid:d,channel_id:c,label:row.channel_label||`Channel ${c}`});});
    const wrap=document.createElement('div'); wrap.className='fireboard-probe-assignments'; wrap.style.cssText='margin-top:12px;padding:10px;border:1px solid #343434;border-radius:12px';
    const title=document.createElement('strong'); title.textContent='Probe assignments'; wrap.appendChild(title);
    const help=document.createElement('div'); help.className='sub'; help.textContent='Assign a cook-specific role. FireBoard device and channel identity remain unchanged.'; wrap.appendChild(help);
    sensors.forEach(sensor=>{
      const key=`${sensor.device_uuid}::${sensor.channel_id}`; const row=document.createElement('div'); row.style.cssText='margin-top:10px';
      const lab=document.createElement('label'); lab.textContent=`${sensor.label} • channel ${sensor.channel_id}`; row.appendChild(lab);
      const line=document.createElement('div'); line.style.cssText='display:grid;grid-template-columns:1fr auto;gap:8px';
      const input=document.createElement('input'); input.placeholder='e.g. Pork Butt #1 or Smoker Chamber'; input.value=roles.get(key)?.cook_role||''; line.appendChild(input);
      const btn=document.createElement('button'); btn.className='secondary'; btn.style.cssText='min-height:44px;padding:8px 12px'; btn.textContent='Save';
      btn.addEventListener('click',async()=>{const role=input.value.trim(); if(!role){alert('Enter a probe role first.');return;} btn.disabled=true; btn.textContent='Saving…'; try{auth=loadCloudSession(); await saveFireboardProbeRole(auth.access_token,sensor.device_uuid,sensor.channel_id,sensor.label,role); roles.set(key,{cook_role:role}); btn.textContent='Saved'; setTimeout(()=>{btn.textContent='Save';btn.disabled=false},1200);}catch(e){btn.textContent='Save';btn.disabled=false;alert(`Could not save probe role: ${e.message}`);}});
      line.appendChild(btn); row.appendChild(line); wrap.appendChild(row);
    });
    host.appendChild(wrap);
  }

'''
if text.count(anchor)!=1: raise SystemExit('graph anchor not found')
text=text.replace(anchor,insert+anchor,1)

needle="      renderFireboardTemperatureGraph(graphHost, fbSession, rows);"
replacement="      renderFireboardTemperatureGraph(graphHost, fbSession, rows);\n      await renderFireboardProbeAssignments(graphHost, rows);"
if text.count(needle)!=1: raise SystemExit(f'Expected one live graph render call, found {text.count(needle)}')
text=text.replace(needle,replacement,1)

needle="      renderFireboardTemperatureGraph(container, fbSession, rows);"
replacement="      renderFireboardTemperatureGraph(container, fbSession, rows);\n      await renderFireboardProbeAssignments(container, rows);"
if text.count(needle)!=1: raise SystemExit(f'Expected one manual graph render call, found {text.count(needle)}')
text=text.replace(needle,replacement,1)

for old,new in [
("  document.title = 'LDCookLog Mobile V1.23.7';","  document.title = 'LDCookLog Mobile V1.24.0';"),
("  if (headerSub) headerSub.textContent = 'V1.23.7 Stateful BBQ Control Panel';","  if (headerSub) headerSub.textContent = 'V1.24.0 Stateful BBQ Control Panel';"),
("  if (footer) footer.innerHTML = 'V1.23.7 adds a FireBoard cook-start guard: only readings from the current LDCookLog cook window are retained, with a two-minute grace period for polling and clock timing. Older readings from a still-running FireBoard session are automatically removed from this cook.<br><strong>Build 2026-09-14D</strong>';","  if (footer) footer.innerHTML = 'V1.24.0 adds cook-specific FireBoard probe assignments while preserving permanent device UUID + channel ID identity and the V1.23.7 cook-start guard. Automatic role guessing is intentionally not included.<br><strong>Build 2026-09-14E</strong>';"),
]:
    if text.count(old)!=1: raise SystemExit('version anchor not found')
    text=text.replace(old,new,1)
p.write_text(text)

swp=Path('service-worker.js'); sw=swp.read_text(); old="const CACHE_NAME = 'ldcooklog-v1-23-7';"; new="const CACHE_NAME = 'ldcooklog-v1-24-0';"
if sw.count(old)!=1: raise SystemExit('cache anchor not found')
swp.write_text(sw.replace(old,new,1))
print('V1.24.0 probe assignment patch applied successfully.')
