// LDCookLog Mobile V1.18.0 Saved Equipment
(() => {
  const BUILD = "2026-09-12E";
  const EQUIPMENT_ROLE = "Used";
  let savedEquipment = [];
  let equipmentLoadMessage = "Sign in to load saved equipment.";
  let equipmentSyncMessage = "";
  let lastRecoveryEquipment = null;
  let equipmentSyncInProgress = false;

  const originalDefaultStateV118 = defaultState;
  defaultState = function(){
    return Object.assign(originalDefaultStateV118(), {equipmentIds:[], equipmentNames:{}});
  };
  if(!Array.isArray(state.equipmentIds)) state.equipmentIds=[];
  if(!state.equipmentNames || typeof state.equipmentNames !== "object" || Array.isArray(state.equipmentNames)) state.equipmentNames={};

  function equipmentNameForId(id){
    if(!id) return "";
    const row=savedEquipment.find(item=>item.id===id);
    return row ? row.name : (state.equipmentNames[id] || "Saved equipment");
  }

  function ensureEquipmentUI(){
    let box=$("savedEquipmentList");
    if(box) return box;
    const setupCard=[...document.querySelectorAll("section.card")].find(card=>card.querySelector("h2")&&card.querySelector("h2").textContent.trim()==="Cook Setup");
    if(!setupCard) return null;
    const wrap=document.createElement("div");
    wrap.id="savedEquipmentWrap";
    wrap.style.marginTop="12px";
    wrap.innerHTML='<label>Equipment</label><div id="savedEquipmentList" style="display:grid;gap:7px"></div><div id="savedEquipmentStatus" class="sub" style="margin-top:6px">Sign in to load saved equipment.</div>';
    const locationWrap=$("savedLocationWrap");
    if(locationWrap&&locationWrap.parentNode===setupCard){
      if(locationWrap.nextSibling) setupCard.insertBefore(wrap, locationWrap.nextSibling); else setupCard.appendChild(wrap);
    }else{
      const traeger=$("traegerFields");
      if(traeger&&traeger.parentNode===setupCard) setupCard.insertBefore(wrap,traeger); else setupCard.appendChild(wrap);
    }
    return $("savedEquipmentList");
  }

  function equipmentLabel(row){
    if(!row) return "Saved equipment";
    const extras=[];
    if(row.manufacturer && !String(row.name||"").toLowerCase().includes(String(row.manufacturer).toLowerCase())) extras.push(row.manufacturer);
    if(row.model && !String(row.name||"").toLowerCase().includes(String(row.model).toLowerCase())) extras.push(row.model);
    return extras.length ? `${row.name} — ${extras.join(" ")}` : row.name;
  }

  function renderEquipmentOptions(){
    const box=ensureEquipmentUI();
    if(!box) return;
    const selected=new Set(state.equipmentIds||[]);
    const rows=[...savedEquipment];
    for(const id of selected){
      if(!rows.some(row=>row.id===id)) rows.push({id,name:state.equipmentNames[id]||"Saved equipment",is_active:false,cached:true});
    }
    rows.sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
    box.innerHTML="";
    if(!rows.length){
      const empty=document.createElement("div");
      empty.style.cssText="color:#777;font-size:13px";
      empty.textContent=loadCloudSession()?"No active saved equipment was returned by Supabase.":"Sign in to load saved equipment.";
      box.appendChild(empty);
    }else{
      rows.forEach(row=>{
        const label=document.createElement("label");
        label.style.cssText="display:flex;align-items:center;gap:9px;margin:0;padding:9px 10px;background:#141414;border:1px solid #333;border-radius:10px;color:#eee;font-size:14px";
        const input=document.createElement("input");
        input.type="checkbox";
        input.value=row.id;
        input.checked=selected.has(row.id);
        input.style.cssText="width:20px;height:20px;margin:0;flex:0 0 auto";
        const text=document.createElement("span");
        text.textContent=equipmentLabel(row)+(row.cached?" (not active)":"");
        label.appendChild(input);label.appendChild(text);box.appendChild(label);
        input.addEventListener("change",()=>{
          const ids=new Set(state.equipmentIds||[]);
          if(input.checked){ids.add(row.id);state.equipmentNames[row.id]=row.name||"Saved equipment";}
          else ids.delete(row.id);
          state.equipmentIds=[...ids];
          save();
          renderEquipmentOptions();
          if(state.start&&loadCloudSession()) syncCurrentCookAndEvents();
        });
      });
    }
    const status=$("savedEquipmentStatus");
    if(status){
      const parts=[equipmentLoadMessage];
      if(equipmentSyncMessage) parts.push(equipmentSyncMessage);
      status.textContent=parts.filter(Boolean).join(" ");
    }
  }

  const originalRenderV118=render;
  render=function(){
    if(lastRecoveryEquipment && state.cloudSyncMessage==="Conflict resolved using the cloud version." && state.cloudCookUuid===lastRecoveryEquipment.cookUuid){
      state.equipmentIds=[...lastRecoveryEquipment.ids];
      state.equipmentNames=Object.assign({},state.equipmentNames||{},lastRecoveryEquipment.names||{});
      lastRecoveryEquipment=null;
    }
    originalRenderV118();
    renderEquipmentOptions();
  };

  async function fetchActiveEquipment(accessToken){
    const response=await fetch(`${SUPABASE_URL}/rest/v1/equipment?select=id,name,category,manufacturer,model,is_active&is_active=eq.true&order=name.asc`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,Accept:"application/json"}});
    if(response.status===401) throw Object.assign(new Error("Session expired."),{code:401});
    const data=await response.json();
    if(!response.ok) throw new Error(data.message||data.hint||data.details||"Saved equipment could not be read.");
    return data;
  }

  async function loadSavedEquipment(){
    let session=loadCloudSession();
    if(!session||!session.access_token){
      savedEquipment=[];
      equipmentLoadMessage=state.equipmentIds.length?"Cloud is signed out. Selected equipment remains saved on this device.":"Sign in to load saved equipment.";
      renderEquipmentOptions();
      return false;
    }
    equipmentLoadMessage="Loading saved equipment…";renderEquipmentOptions();
    try{
      let rows;
      try{rows=await fetchActiveEquipment(session.access_token);}catch(err){if(err.code!==401)throw err;session=await refreshCloudSession(session);rows=await fetchActiveEquipment(session.access_token);}
      savedEquipment=rows;
      rows.forEach(row=>{if(row&&row.id&&row.name)state.equipmentNames[row.id]=row.name;});
      equipmentLoadMessage=rows.length?`${rows.length} active equipment item${rows.length===1?"":"s"} loaded from Supabase.`:"No active saved equipment was returned by Supabase.";
      save();renderEquipmentOptions();
      return true;
    }catch(err){
      equipmentLoadMessage=`Saved equipment could not be refreshed: ${err.message} Local cooking is unaffected.`;
      renderEquipmentOptions();
      return false;
    }
  }

  async function fetchCookEquipmentRows(accessToken,cookUuid){
    const response=await fetch(`${SUPABASE_URL}/rest/v1/cook_equipment?select=equipment_id,role&cook_id=eq.${encodeURIComponent(cookUuid)}`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,Accept:"application/json"}});
    if(response.status===401) throw Object.assign(new Error("Session expired."),{code:401});
    const data=await response.json();
    if(!response.ok) throw new Error(data.message||data.hint||data.details||"Cook equipment could not be read.");
    return data;
  }

  async function fetchEquipmentByIds(accessToken,ids){
    if(!ids.length) return [];
    const filter=`in.(${ids.join(",")})`;
    const response=await fetch(`${SUPABASE_URL}/rest/v1/equipment?select=id,name,category,manufacturer,model,is_active&id=${encodeURIComponent(filter)}`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,Accept:"application/json"}});
    if(response.status===401) throw Object.assign(new Error("Session expired."),{code:401});
    const data=await response.json();
    if(!response.ok) throw new Error(data.message||data.hint||data.details||"Equipment details could not be read.");
    return data;
  }

  async function insertCookEquipment(accessToken,equipmentId){
    const response=await fetch(`${SUPABASE_URL}/rest/v1/cook_equipment`,{method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({cook_id:state.cloudCookUuid,equipment_id:equipmentId,role:EQUIPMENT_ROLE})});
    if(response.status===401) throw Object.assign(new Error("Session expired."),{code:401});
    if(response.status===409) return true;
    if(!response.ok){const data=await response.json().catch(()=>null);throw new Error((data&&(data.message||data.hint||data.details))||"Equipment link could not be created.");}
    return true;
  }

  async function deleteCookEquipment(accessToken,equipmentId){
    const response=await fetch(`${SUPABASE_URL}/rest/v1/cook_equipment?cook_id=eq.${encodeURIComponent(state.cloudCookUuid)}&equipment_id=eq.${encodeURIComponent(equipmentId)}&role=eq.${encodeURIComponent(EQUIPMENT_ROLE)}`,{method:"DELETE",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,Prefer:"return=minimal"}});
    if(response.status===401) throw Object.assign(new Error("Session expired."),{code:401});
    if(!response.ok){const data=await response.json().catch(()=>null);throw new Error((data&&(data.message||data.hint||data.details))||"Equipment link could not be removed.");}
    return true;
  }

  async function syncEquipmentWithToken(accessToken){
    const current=await fetchCookEquipmentRows(accessToken,state.cloudCookUuid);
    const existingUsed=new Set(current.filter(row=>row.role===EQUIPMENT_ROLE).map(row=>row.equipment_id));
    const desired=new Set(state.equipmentIds||[]);
    for(const id of desired) if(!existingUsed.has(id)) await insertCookEquipment(accessToken,id);
    for(const id of existingUsed) if(!desired.has(id)) await deleteCookEquipment(accessToken,id);
    return true;
  }

  async function syncEquipmentToCloud(){
    if(equipmentSyncInProgress) return false;
    if(!state.start||!state.cookId||!state.cloudCookUuid) return true;
    if(state.cloudConflict){equipmentSyncMessage="Equipment sync paused because the cook has a cloud conflict.";renderEquipmentOptions();return false;}
    let session=loadCloudSession();
    if(!session||!session.access_token) return false;
    equipmentSyncInProgress=true;
    equipmentSyncMessage="Syncing equipment…";renderEquipmentOptions();
    try{
      try{await syncEquipmentWithToken(session.access_token);}catch(err){if(err.code!==401)throw err;session=await refreshCloudSession(session);await syncEquipmentWithToken(session.access_token);}
      equipmentSyncMessage=`Equipment synced (${(state.equipmentIds||[]).length} selected).`;
      renderEquipmentOptions();
      return true;
    }catch(err){
      equipmentSyncMessage=`Equipment sync warning: ${err.message} Local selections are safe and cooking can continue.`;
      renderEquipmentOptions();
      return false;
    }finally{equipmentSyncInProgress=false;}
  }

  const originalSyncPendingEventsToCloudV118=syncPendingEventsToCloud;
  syncPendingEventsToCloud=async function(){
    const eventsOk=await originalSyncPendingEventsToCloudV118();
    if(state.cloudCookUuid&&!state.cloudConflict) await syncEquipmentToCloud();
    return eventsOk;
  };

  const originalFetchCloudCookRecoveryV118=fetchCloudCookRecovery;
  fetchCloudCookRecovery=async function(accessToken,cookUuid){
    const recovery=await originalFetchCloudCookRecoveryV118(accessToken,cookUuid);
    try{
      const links=await fetchCookEquipmentRows(accessToken,cookUuid);
      const ids=[...new Set(links.map(row=>row.equipment_id).filter(Boolean))];
      const details=await fetchEquipmentByIds(accessToken,ids);
      const names={};details.forEach(row=>{if(row.id)names[row.id]=row.name||"Saved equipment";});
      recovery.cook.equipment_ids=ids;
      recovery.cook.equipment_names=names;
      recovery.cook.equipment_details=details;
      lastRecoveryEquipment={cookUuid:recovery.cook.id,ids:[...ids],names:Object.assign({},names)};
    }catch(err){
      recovery.cook.equipment_ids=null;
      recovery.cook.equipment_names={};
      recovery.cook.equipment_details=[];
      recovery.cook.equipment_error=err.message;
      lastRecoveryEquipment=null;
    }
    return recovery;
  };

  const originalRenderCloudRecoveryV118=renderCloudRecovery;
  renderCloudRecovery=function(cook,events){
    originalRenderCloudRecoveryV118(cook,events);
    const box=$("cloudRecovery");if(!box||!cook)return;
    const lines=box.textContent.split("\n");
    let equipmentText="None";
    if(cook.equipment_error) equipmentText=`Unavailable (${cook.equipment_error})`;
    else if(Array.isArray(cook.equipment_ids)&&cook.equipment_ids.length){
      equipmentText=cook.equipment_ids.map(id=>(cook.equipment_names&&cook.equipment_names[id])||"Saved equipment").join(", ");
    }
    const locationIndex=lines.findIndex(line=>line.startsWith("Location:"));
    const insertAt=locationIndex>=0?locationIndex+1:Math.min(4,lines.length);
    lines.splice(insertAt,0,`Equipment: ${equipmentText}`);
    box.textContent=lines.join("\n");
  };

  const originalRestoreViewedCloudCookV118=restoreViewedCloudCook;
  restoreViewedCloudCook=function(){
    const recovery=viewedCloudRecovery;
    const beforeState=state;
    originalRestoreViewedCloudCookV118();
    if(state!==beforeState&&recovery&&recovery.cook&&state.cookId===recovery.cook.cook_id&&state.cloudCookUuid===recovery.cook.id&&Array.isArray(recovery.cook.equipment_ids)){
      state.equipmentIds=[...recovery.cook.equipment_ids];
      state.equipmentNames=Object.assign({},recovery.cook.equipment_names||{});
      render();save();render();
    }
  };

  const originalCloudSignInV118=cloudSignIn;
  cloudSignIn=async function(){await originalCloudSignInV118();if(loadCloudSession())await loadSavedEquipment();};
  $("cloudRead").addEventListener("click",()=>setTimeout(loadSavedEquipment,0));
  $("cloudSignOut").addEventListener("click",()=>setTimeout(()=>{savedEquipment=[];equipmentLoadMessage=state.equipmentIds.length?"Cloud is signed out. Selected equipment remains saved on this device.":"Sign in to load saved equipment.";renderEquipmentOptions();},0));

  document.title="LDCookLog Mobile V1.18.0";
  const headerSub=document.querySelector("header .sub");if(headerSub)headerSub.textContent="V1.18.0 Stateful BBQ Control Panel";
  const footer=document.querySelector(".footer-note");if(footer)footer.innerHTML=`V1.18.0 Saved Equipment: select multiple active equipment items, sync them to cook_equipment, and restore them with cloud recovery.<br><strong>Build ${BUILD}</strong>`;

  ensureEquipmentUI();
  renderEquipmentOptions();
  save();render();
  if(loadCloudSession()) setTimeout(loadSavedEquipment,450);
})();
