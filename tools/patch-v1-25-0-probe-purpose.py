from pathlib import Path

p=Path('index.html')
text=p.read_text()

old="    const q = new URLSearchParams({select:'device_uuid,channel_id,source_label,cook_role',cook_id:`eq.${state.cloudCookUuid}`});"
new="    const q = new URLSearchParams({select:'device_uuid,channel_id,source_label,cook_role,role_type',cook_id:`eq.${state.cloudCookUuid}`});"
if text.count(old)!=1: raise SystemExit('probe role select anchor not found')
text=text.replace(old,new,1)

old="  async function saveFireboardProbeRole(accessToken, deviceUuid, channelId, sourceLabel, cookRole) {\n    const payload={cook_id:state.cloudCookUuid,device_uuid:deviceUuid,channel_id:Number(channelId),source_label:sourceLabel||null,cook_role:cookRole.trim()};"
new="  async function saveFireboardProbeRole(accessToken, deviceUuid, channelId, sourceLabel, cookRole, roleType) {\n    const payload={cook_id:state.cloudCookUuid,device_uuid:deviceUuid,channel_id:Number(channelId),source_label:sourceLabel||null,cook_role:cookRole.trim(),role_type:roleType};"
if text.count(old)!=1: raise SystemExit('probe role save anchor not found')
text=text.replace(old,new,1)

old="      const lab=document.createElement('label'); lab.textContent=`${sensor.label} • channel ${sensor.channel_id}`; row.appendChild(lab);\n      const line=document.createElement('div'); line.style.cssText='display:grid;grid-template-columns:1fr auto;gap:8px';\n      const input=document.createElement('input'); input.placeholder='e.g. Pork Butt #1 or Smoker Chamber'; input.value=roles.get(key)?.cook_role||''; line.appendChild(input);\n      const btn=document.createElement('button'); btn.className='secondary'; btn.style.cssText='min-height:44px;padding:8px 12px'; btn.textContent='Save';"
new="      const lab=document.createElement('label'); lab.textContent=`${sensor.label} • channel ${sensor.channel_id}`; row.appendChild(lab);\n      const purpose=document.createElement('select'); purpose.style.marginBottom='8px';\n      [['','Choose sensor purpose…'],['food','Food'],['chamber','Smoker / chamber'],['other','Other / reference']].forEach(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;purpose.appendChild(option);});\n      purpose.value=roles.get(key)?.role_type||''; row.appendChild(purpose);\n      const line=document.createElement('div'); line.style.cssText='display:grid;grid-template-columns:1fr auto;gap:8px';\n      const input=document.createElement('input'); input.placeholder='e.g. Pork Butt #1 or Smoker Chamber'; input.value=roles.get(key)?.cook_role||''; line.appendChild(input);\n      const btn=document.createElement('button'); btn.className='secondary'; btn.style.cssText='min-height:44px;padding:8px 12px'; btn.textContent='Save';"
if text.count(old)!=1: raise SystemExit('assignment UI anchor not found')
text=text.replace(old,new,1)

old="      btn.addEventListener('click',async()=>{const role=input.value.trim(); if(!role){alert('Enter a probe role first.');return;} btn.disabled=true; btn.textContent='Saving…'; try{auth=loadCloudSession(); await saveFireboardProbeRole(auth.access_token,sensor.device_uuid,sensor.channel_id,sensor.label,role); roles.set(key,{cook_role:role,source_label:sensor.label}); fireboardProbeRoleCache=roles; if(fbSession){renderFireboardTemperatureGraph(host,fbSession,rows,roles);host.appendChild(wrap);} btn.textContent='Saved'; setTimeout(()=>{btn.textContent='Save';btn.disabled=false},1200);}catch(e){btn.textContent='Save';btn.disabled=false;alert(`Could not save probe role: ${e.message}`);}});"
new="      btn.addEventListener('click',async()=>{const role=input.value.trim(), roleType=purpose.value; if(!role){alert('Enter a probe role first.');return;} if(!roleType){alert('Choose whether this sensor is Food, Smoker / chamber, or Other / reference.');return;} btn.disabled=true; btn.textContent='Saving…'; try{auth=loadCloudSession(); await saveFireboardProbeRole(auth.access_token,sensor.device_uuid,sensor.channel_id,sensor.label,role,roleType); roles.set(key,{cook_role:role,source_label:sensor.label,role_type:roleType}); fireboardProbeRoleCache=roles; if(fbSession){renderFireboardTemperatureGraph(host,fbSession,rows,roles);host.appendChild(wrap);} btn.textContent='Saved'; setTimeout(()=>{btn.textContent='Save';btn.disabled=false},1200);}catch(e){btn.textContent='Save';btn.disabled=false;alert(`Could not save probe role: ${e.message}`);}});"
if text.count(old)!=1: raise SystemExit('assignment save handler anchor not found')
text=text.replace(old,new,1)

old="      const assignedRole = probeRoles?.get(sensorKey)?.cook_role?.trim();\n      row.textContent = `Device UUID: ${group.deviceUuid || 'not reported'} • FireBoard channel ID: ${group.channel} • FireBoard label: ${group.label}${assignedRole ? ` • LDCookLog role: ${assignedRole}` : ''}`;"
new="      const assigned = probeRoles?.get(sensorKey);\n      const assignedRole = assigned?.cook_role?.trim();\n      const purposeLabel = assigned?.role_type === 'food' ? 'Food' : assigned?.role_type === 'chamber' ? 'Smoker / chamber' : assigned?.role_type === 'other' ? 'Other / reference' : '';\n      row.textContent = `Device UUID: ${group.deviceUuid || 'not reported'} • FireBoard channel ID: ${group.channel} • FireBoard label: ${group.label}${assignedRole ? ` • LDCookLog role: ${assignedRole}` : ''}${purposeLabel ? ` • Purpose: ${purposeLabel}` : ''}`;"
if text.count(old)!=1: raise SystemExit('diagnostic purpose anchor not found')
text=text.replace(old,new,1)

for old,new in [
("  document.title = 'LDCookLog Mobile V1.24.1';","  document.title = 'LDCookLog Mobile V1.25.0';"),
("  if (headerSub) headerSub.textContent = 'V1.24.1 Stateful BBQ Control Panel';","  if (headerSub) headerSub.textContent = 'V1.25.0 Stateful BBQ Control Panel';"),
("  if (footer) footer.innerHTML = 'V1.24.1 displays saved cook-specific FireBoard probe roles in the temperature graph and sensor identity diagnostics while preserving permanent device UUID + channel ID identity.<br><strong>Build 2026-09-14F</strong>';","  if (footer) footer.innerHTML = 'V1.25.0 adds a user-selected sensor purpose (Food, Smoker / chamber, or Other / reference) to each cook-specific FireBoard probe assignment so later analysis can distinguish food temperatures from pit temperatures without guessing.<br><strong>Build 2026-09-14G</strong>';"),
]:
    if text.count(old)!=1: raise SystemExit('version anchor not found')
    text=text.replace(old,new,1)

p.write_text(text)

swp=Path('service-worker.js'); sw=swp.read_text(); old="const CACHE_NAME = 'ldcooklog-v1-24-1';"; new="const CACHE_NAME = 'ldcooklog-v1-25-0';"
if sw.count(old)!=1: raise SystemExit('cache anchor not found')
swp.write_text(sw.replace(old,new,1))
print('V1.25.0 probe purpose patch applied successfully.')
