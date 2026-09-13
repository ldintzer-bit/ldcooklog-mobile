// LDCookLog Mobile V1.20.0 Saved Rubs
(() => {
  const BUILD = "2026-09-13B";
  const RUB_LEVELS = ["Light", "Normal", "Heavy"];
  const BINDERS = ["None", "Yellow Mustard", "Dijon Mustard", "Worcestershire", "Hot Sauce", "Oil", "Other"];
  let savedRubs = [];
  let rubLoadMessage = "Sign in to load saved rubs.";
  let rubSyncMessage = "";
  let rubSyncInProgress = false;
  let lastRecoveryRubs = null;

  const originalDefaultStateV120 = defaultState;
  defaultState = function(){
    return Object.assign(originalDefaultStateV120(), {rubSelections:[], binder:"None"});
  };
  if (!Array.isArray(state.rubSelections)) state.rubSelections = [];
  if (!("binder" in state) || !state.binder) state.binder = "None";

  function normalizedSelections(){
    const seen = new Set();
    return (Array.isArray(state.rubSelections) ? state.rubSelections : []).filter(row => {
      if (!row || !row.rubId || seen.has(row.rubId)) return false;
      seen.add(row.rubId);
      return true;
    }).map(row => ({
      rubId: row.rubId,
      name: row.name || "Saved rub",
      rubType: row.rubType || "",
      applicationLevel: RUB_LEVELS.includes(row.applicationLevel) ? row.applicationLevel : "Normal"
    }));
  }

  function displayRub(row){
    const type = row.rub_type || row.rubType || "";
    return type ? `${row.name} — ${type}` : row.name;
  }

  function ensureRubUI(){
    let wrap = $("savedRubsWrap");
    if (wrap) return wrap;
    const setupCard = [...document.querySelectorAll("section.card")].find(card =>
      card.querySelector("h2") && card.querySelector("h2").textContent.trim() === "Cook Setup"
    );
    if (!setupCard) return null;
    wrap = document.createElement("div");
    wrap.id = "savedRubsWrap";
    wrap.style.marginTop = "12px";
    wrap.innerHTML = `
      <label>Saved Rubs</label>
      <div id="savedRubsList" style="display:flex;flex-direction:column;gap:8px"></div>
      <div class="sub" id="savedRubsStatus" style="margin-top:5px">Sign in to load saved rubs.</div>
      <div style="margin-top:10px"><label for="binderSelect">Binder</label><select id="binderSelect"></select></div>`;
    const methodWrap = $("savedCookMethodWrap");
    if (methodWrap && methodWrap.parentNode === setupCard) {
      if (methodWrap.nextSibling) setupCard.insertBefore(wrap, methodWrap.nextSibling);
      else setupCard.appendChild(wrap);
    } else setupCard.appendChild(wrap);

    const binder = $("binderSelect");
    BINDERS.forEach(name => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      binder.appendChild(option);
    });
    if (!BINDERS.includes(state.binder)) {
      const option = document.createElement("option");
      option.value = state.binder;
      option.textContent = state.binder;
      binder.appendChild(option);
    }
    binder.value = state.binder || "None";
    binder.addEventListener("change", () => {
      state.binder = binder.value || "None";
      markCloudCookDirty();
      save();
      if (state.start && loadCloudSession()) syncCurrentCookAndEvents();
    });
    return wrap;
  }

  function renderRubOptions(){
    ensureRubUI();
    const list = $("savedRubsList");
    if (!list) return;
    const selections = normalizedSelections();
    state.rubSelections = selections;
    const byId = new Map(selections.map(row => [row.rubId, row]));
    const rows = [...savedRubs];
    selections.forEach(sel => {
      if (!rows.some(row => row.id === sel.rubId)) rows.push({id:sel.rubId,name:sel.name,rub_type:sel.rubType,is_active:false,_cached:true});
    });
    list.innerHTML = "";
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "sub";
      empty.textContent = selections.length ? "Selected rubs remain saved locally." : "No saved rubs loaded.";
      list.appendChild(empty);
    }
    rows.forEach(row => {
      const selected = byId.get(row.id);
      const item = document.createElement("div");
      item.style.cssText = "background:#141414;border:1px solid #333;border-radius:12px;padding:9px 10px";
      const top = document.createElement("div");
      top.style.cssText = "display:flex;align-items:center;gap:9px";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = !!selected;
      check.style.cssText = "width:22px;height:22px;flex:0 0 auto";
      const text = document.createElement("div");
      text.style.cssText = "font-size:14px;flex:1";
      text.textContent = displayRub(row) + (row._cached ? " (saved locally)" : "");
      top.append(check, text);
      item.appendChild(top);
      const levelWrap = document.createElement("div");
      levelWrap.style.cssText = `margin-top:8px;${selected ? "" : "display:none"}`;
      const label = document.createElement("label");
      label.textContent = "Application";
      const select = document.createElement("select");
      RUB_LEVELS.forEach(level => {
        const option = document.createElement("option");option.value=level;option.textContent=level;select.appendChild(option);
      });
      select.value = selected ? selected.applicationLevel : "Normal";
      levelWrap.append(label, select);
      item.appendChild(levelWrap);

      function commit(){
        const current = normalizedSelections().filter(sel => sel.rubId !== row.id);
        if (check.checked) current.push({rubId:row.id,name:row.name,rubType:row.rub_type||"",applicationLevel:select.value||"Normal"});
        state.rubSelections = current;
        markCloudCookDirty();
        save();
        renderRubOptions();
        if (state.start && loadCloudSession()) syncCurrentCookAndEvents();
      }
      check.addEventListener("change", commit);
      select.addEventListener("change", commit);
      list.appendChild(item);
    });
    const binder = $("binderSelect");
    if (binder) {
      if (![...binder.options].some(o => o.value === state.binder)) {
        const option=document.createElement("option");option.value=state.binder;option.textContent=state.binder;binder.appendChild(option);
      }
      binder.value = state.binder || "None";
    }
    const status = $("savedRubsStatus");
    if (status) status.textContent = [rubLoadMessage, rubSyncMessage].filter(Boolean).join(" ");
  }

  const originalSaveV120 = save;
  save = function(){
    const binder = $("binderSelect");
    if (binder) state.binder = binder.value || "None";
    state.rubSelections = normalizedSelections();
    return originalSaveV120();
  };

  const originalRenderV120 = render;
  render = function(){
    if (lastRecoveryRubs && state.cloudCookUuid && state.cloudCookUuid === lastRecoveryRubs.cookUuid) {
      state.rubSelections = lastRecoveryRubs.selections.map(row => Object.assign({}, row));
      state.binder = lastRecoveryRubs.binder || "None";
      lastRecoveryRubs = null;
    }
    originalRenderV120();
    renderRubOptions();
  };

  async function fetchActiveRubs(accessToken){
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rubs?select=id,name,rub_type,source_type,source_reference,is_active&is_active=eq.true&order=name.asc`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,Accept:"application/json"}});
    if (response.status === 401) throw Object.assign(new Error("Session expired."),{code:401});
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.hint || data.details || "Saved rubs could not be read.");
    return data;
  }

  async function loadSavedRubs(){
    let session = loadCloudSession();
    if (!session || !session.access_token) {
      savedRubs = [];
      rubLoadMessage = state.rubSelections.length ? "Cloud is signed out. Selected rubs remain saved on this device." : "Sign in to load saved rubs.";
      renderRubOptions();
      return false;
    }
    rubLoadMessage = "Loading saved rubs…";renderRubOptions();
    try {
      let rows;
      try { rows = await fetchActiveRubs(session.access_token); }
      catch (err) { if (err.code !== 401) throw err; session = await refreshCloudSession(session); rows = await fetchActiveRubs(session.access_token); }
      savedRubs = rows;
      rubLoadMessage = rows.length ? `${rows.length} active saved rub${rows.length===1?"":"s"} loaded from Supabase.` : "No active saved rubs were returned by Supabase.";
      save();renderRubOptions();return true;
    } catch (err) {
      rubLoadMessage = `Saved rubs could not be refreshed: ${err.message} Local cooking is unaffected.`;
      renderRubOptions();return false;
    }
  }

  async function fetchCookRubRows(accessToken,cookUuid){
    const response=await fetch(`${SUPABASE_URL}/rest/v1/cook_rubs?select=rub_id,application_level,notes&cook_id=eq.${encodeURIComponent(cookUuid)}`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,Accept:"application/json"}});
    if(response.status===401) throw Object.assign(new Error("Session expired."),{code:401});
    const data=await response.json();
    if(!response.ok) throw new Error(data.message||data.hint||data.details||"Cook rubs could not be read.");
    return data;
  }

  async function fetchRubsByIds(accessToken,ids){
    if(!ids.length) return [];
    const filter=`in.(${ids.join(",")})`;
    const response=await fetch(`${SUPABASE_URL}/rest/v1/rubs?select=id,name,rub_type,is_active&id=${encodeURIComponent(filter)}`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,Accept:"application/json"}});
    if(response.status===401) throw Object.assign(new Error("Session expired."),{code:401});
    const data=await response.json();
    if(!response.ok) throw new Error(data.message||data.hint||data.details||"Rub details could not be read.");
    return data;
  }

  async function replaceCookRubs(accessToken){
    let response=await fetch(`${SUPABASE_URL}/rest/v1/cook_rubs?cook_id=eq.${encodeURIComponent(state.cloudCookUuid)}`,{method:"DELETE",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,Prefer:"return=minimal"}});
    if(response.status===401) throw Object.assign(new Error("Session expired."),{code:401});
    if(!response.ok){const data=await response.json().catch(()=>null);throw new Error((data&&(data.message||data.hint||data.details))||"Existing cook rubs could not be updated.");}
    const rows=normalizedSelections().map(sel=>({cook_id:state.cloudCookUuid,rub_id:sel.rubId,application_level:sel.applicationLevel||"Normal"}));
    if(!rows.length) return true;
    response=await fetch(`${SUPABASE_URL}/rest/v1/cook_rubs`,{method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify(rows)});
    if(response.status===401) throw Object.assign(new Error("Session expired."),{code:401});
    if(!response.ok){const data=await response.json().catch(()=>null);throw new Error((data&&(data.message||data.hint||data.details))||"Cook rubs could not be saved.");}
    return true;
  }

  async function syncRubsToCloud(){
    if(rubSyncInProgress) return false;
    if(!state.start||!state.cookId||!state.cloudCookUuid) return true;
    if(state.cloudConflict){rubSyncMessage="Rub sync paused because the cook has a cloud conflict.";renderRubOptions();return false;}
    let session=loadCloudSession();if(!session||!session.access_token)return false;
    rubSyncInProgress=true;rubSyncMessage="Syncing rubs…";renderRubOptions();
    try {
      try { await replaceCookRubs(session.access_token); }
      catch(err){ if(err.code!==401)throw err;session=await refreshCloudSession(session);await replaceCookRubs(session.access_token); }
      rubSyncMessage=`Rubs synced (${normalizedSelections().length} selected).`;renderRubOptions();return true;
    } catch(err){rubSyncMessage=`Rub sync warning: ${err.message} Local selections are safe and cooking can continue.`;renderRubOptions();return false;}
    finally{rubSyncInProgress=false;}
  }

  const originalCloudCookPayloadV120=cloudCookPayload;
  cloudCookPayload=function(){
    const payload=originalCloudCookPayloadV120();
    payload.binder=(state.binder && state.binder!=="None") ? state.binder : null;
    if(typeof payload.notes==="string") payload.notes=payload.notes.replace("V1.19.0","V1.20.0").replace("V1.19.1","V1.20.0");
    return payload;
  };

  const originalSyncPendingEventsToCloudV120=syncPendingEventsToCloud;
  syncPendingEventsToCloud=async function(){
    const eventsOk=await originalSyncPendingEventsToCloudV120();
    if(state.cloudCookUuid&&!state.cloudConflict) await syncRubsToCloud();
    return eventsOk;
  };

  const originalFetchCloudCookRecoveryV120=fetchCloudCookRecovery;
  fetchCloudCookRecovery=async function(accessToken,cookUuid){
    const recovery=await originalFetchCloudCookRecoveryV120(accessToken,cookUuid);
    const cook=recovery.cook;
    try {
      const parentResponse=await fetch(`${SUPABASE_URL}/rest/v1/cooks?select=binder&id=eq.${encodeURIComponent(cookUuid)}&limit=1`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,Accept:"application/json"}});
      if(parentResponse.status===401) throw Object.assign(new Error("Session expired."),{code:401});
      const parentRows=await parentResponse.json();
      if(!parentResponse.ok) throw new Error(parentRows.message||parentRows.hint||parentRows.details||"Binder recovery failed.");
      const links=await fetchCookRubRows(accessToken,cookUuid);
      const ids=[...new Set(links.map(row=>row.rub_id).filter(Boolean))];
      const details=await fetchRubsByIds(accessToken,ids);
      const detailMap=new Map(details.map(row=>[row.id,row]));
      const selections=links.map(link=>{
        const detail=detailMap.get(link.rub_id)||{};
        return {rubId:link.rub_id,name:detail.name||"Saved rub",rubType:detail.rub_type||"",applicationLevel:RUB_LEVELS.includes(link.application_level)?link.application_level:"Normal"};
      });
      cook.binder=(parentRows[0]&&parentRows[0].binder)||"None";
      cook.rub_selections=selections;
      lastRecoveryRubs={cookUuid:cook.id,binder:cook.binder,selections:selections.map(row=>Object.assign({},row))};
    } catch(err){
      cook.rub_selections=null;cook.rub_error=err.message;cook.binder_error=err.message;lastRecoveryRubs=null;
    }
    return recovery;
  };

  const originalRenderCloudRecoveryV120=renderCloudRecovery;
  renderCloudRecovery=function(cook,events){
    originalRenderCloudRecoveryV120(cook,events);
    const box=$("cloudRecovery");if(!box||!cook)return;
    const lines=box.textContent.split("\n");
    let rubText="None";
    if(cook.rub_error) rubText=`Unavailable (${cook.rub_error})`;
    else if(Array.isArray(cook.rub_selections)&&cook.rub_selections.length){
      rubText=cook.rub_selections.map(sel=>`${sel.name}${sel.rubType?` — ${sel.rubType}`:""} (${sel.applicationLevel})`).join(", ");
    }
    const binderText=cook.binder_error?`Unavailable (${cook.binder_error})`:(cook.binder||"None");
    const methodIndex=lines.findIndex(line=>line.startsWith("Cook Method:"));
    const equipmentIndex=lines.findIndex(line=>line.startsWith("Equipment:"));
    const insertAt=methodIndex>=0?methodIndex+1:(equipmentIndex>=0?equipmentIndex+1:Math.min(5,lines.length));
    lines.splice(insertAt,0,`Rubs: ${rubText}`,`Binder: ${binderText}`);
    box.textContent=lines.join("\n");
  };

  const originalRestoreViewedCloudCookV120=restoreViewedCloudCook;
  restoreViewedCloudCook=function(){
    const recovery=viewedCloudRecovery;const beforeState=state;
    originalRestoreViewedCloudCookV120();
    if(state!==beforeState&&recovery&&recovery.cook&&state.cookId===recovery.cook.cook_id&&state.cloudCookUuid===recovery.cook.id&&!recovery.cook.rub_error){
      state.rubSelections=(recovery.cook.rub_selections||[]).map(row=>Object.assign({},row));
      state.binder=recovery.cook.binder||"None";
      render();save();render();
    }
  };

  const resetButton=$("resetCook");
  if(resetButton){
    resetButton.addEventListener("click",()=>{
      const preservedRubs=normalizedSelections().map(row=>Object.assign({},row));
      const preservedBinder=state.binder||"None";
      const beforeCookId=state.cookId;
      const beforeEventCount=Array.isArray(state.events)?state.events.length:0;
      setTimeout(()=>{
        const resetCompleted=!state.cookId&&Array.isArray(state.events)&&state.events.length===0&&(beforeCookId||beforeEventCount||preservedRubs.length||preservedBinder!=="None");
        if(!resetCompleted)return;
        state.rubSelections=preservedRubs;state.binder=preservedBinder;save();render();
      },90);
    },true);
  }

  const originalCloudSignInV120=cloudSignIn;
  cloudSignIn=async function(){await originalCloudSignInV120();if(loadCloudSession())await loadSavedRubs();};
  $("cloudRead").addEventListener("click",()=>setTimeout(loadSavedRubs,0));
  $("cloudSignOut").addEventListener("click",()=>setTimeout(()=>{savedRubs=[];rubLoadMessage=state.rubSelections.length?"Cloud is signed out. Selected rubs remain saved on this device.":"Sign in to load saved rubs.";renderRubOptions();},0));

  document.title="LDCookLog Mobile V1.20.0";
  const headerSub=document.querySelector("header .sub");if(headerSub)headerSub.textContent="V1.20.0 Stateful BBQ Control Panel";
  const footer=document.querySelector(".footer-note");if(footer)footer.innerHTML=`V1.20.0 Saved Rubs: select multiple rubs, record Light/Normal/Heavy application and a cook-level binder, sync to Supabase, and restore from cloud recovery.<br><strong>Build ${BUILD}</strong>`;

  ensureRubUI();renderRubOptions();save();render();
  if(loadCloudSession())setTimeout(loadSavedRubs,650);
})();
