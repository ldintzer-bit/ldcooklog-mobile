// LDCookLog Mobile V1.19.0 Saved Cook Methods
(() => {
  const BUILD = "2026-09-12H";
  let savedCookMethods = [];
  let methodLoadMessage = "Sign in to load saved cook methods.";
  let methodSyncMessage = "";
  let lastRecoveryMethod = null;

  const originalDefaultStateV119 = defaultState;
  defaultState = function(){
    return Object.assign(originalDefaultStateV119(), {cookMethodId:null, cookMethodName:""});
  };
  if (!("cookMethodId" in state)) state.cookMethodId = null;
  if (!("cookMethodName" in state)) state.cookMethodName = "";

  function ensureCookMethodUI(){
    let select = $("savedCookMethod");
    if (select) return select;
    const setupCard = [...document.querySelectorAll("section.card")].find(card =>
      card.querySelector("h2") && card.querySelector("h2").textContent.trim() === "Cook Setup"
    );
    if (!setupCard) return null;
    const wrap = document.createElement("div");
    wrap.id = "savedCookMethodWrap";
    wrap.style.marginTop = "10px";
    wrap.innerHTML = '<label for="savedCookMethod">Cook Method</label><select id="savedCookMethod"><option value="">No saved cook method</option></select><div id="savedCookMethodStatus" class="sub" style="margin-top:5px">Sign in to load saved cook methods.</div>';
    const equipmentWrap = $("savedEquipmentWrap");
    if (equipmentWrap && equipmentWrap.parentNode === setupCard) {
      if (equipmentWrap.nextSibling) setupCard.insertBefore(wrap, equipmentWrap.nextSibling);
      else setupCard.appendChild(wrap);
    } else {
      const locationWrap = $("savedLocationWrap");
      if (locationWrap && locationWrap.parentNode === setupCard) {
        if (locationWrap.nextSibling) setupCard.insertBefore(wrap, locationWrap.nextSibling);
        else setupCard.appendChild(wrap);
      } else {
        const traeger = $("traegerFields");
        if (traeger && traeger.parentNode === setupCard) setupCard.insertBefore(wrap, traeger);
        else setupCard.appendChild(wrap);
      }
    }
    select = $("savedCookMethod");
    select.addEventListener("change", () => {
      state.cookMethodId = select.value || null;
      const option = select.options[select.selectedIndex];
      state.cookMethodName = state.cookMethodId ? (option && option.dataset.name ? option.dataset.name : option.textContent) : "";
      markCloudCookDirty();
      save();
      renderCookMethodOptions();
      if (state.start && loadCloudSession()) syncCurrentCookAndEvents();
    });
    return select;
  }

  function methodNameForId(id){
    if (!id) return "";
    const row = savedCookMethods.find(method => method.id === id);
    return row ? row.name : (state.cookMethodId === id ? state.cookMethodName : "");
  }

  function renderCookMethodOptions(){
    const select = ensureCookMethodUI();
    if (!select) return;
    const selected = state.cookMethodId || "";
    select.innerHTML = "";
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "No saved cook method";
    select.appendChild(none);
    if (selected && !savedCookMethods.some(method => method.id === selected)) {
      const cached = document.createElement("option");
      cached.value = selected;
      cached.textContent = state.cookMethodName || "Saved cook method";
      cached.dataset.name = state.cookMethodName || "Saved cook method";
      select.appendChild(cached);
    }
    savedCookMethods.forEach(method => {
      const option = document.createElement("option");
      option.value = method.id;
      option.textContent = method.name;
      option.dataset.name = method.name;
      select.appendChild(option);
    });
    if ([...select.options].some(option => option.value === selected)) select.value = selected;
    else select.value = "";
    const status = $("savedCookMethodStatus");
    if (status) {
      const parts = [methodLoadMessage];
      if (methodSyncMessage) parts.push(methodSyncMessage);
      status.textContent = parts.filter(Boolean).join(" ");
    }
  }

  const originalSaveV119 = save;
  save = function(){
    const select = $("savedCookMethod");
    if (select) {
      state.cookMethodId = select.value || null;
      const option = select.options[select.selectedIndex];
      state.cookMethodName = state.cookMethodId
        ? (option && option.dataset.name ? option.dataset.name : (option ? option.textContent : state.cookMethodName))
        : "";
    }
    return originalSaveV119();
  };

  const originalRenderV119 = render;
  render = function(){
    if (
      lastRecoveryMethod &&
      state.cloudSyncMessage === "Conflict resolved using the cloud version." &&
      state.cloudCookUuid === lastRecoveryMethod.cookUuid
    ) {
      state.cookMethodId = lastRecoveryMethod.id;
      state.cookMethodName = lastRecoveryMethod.name;
      lastRecoveryMethod = null;
    }
    originalRenderV119();
    renderCookMethodOptions();
  };

  async function fetchActiveCookMethods(accessToken){
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/cook_methods?select=id,name,source_reference,source_type,is_active&is_active=eq.true&order=name.asc`,
      {headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,Accept:"application/json"}}
    );
    if (response.status === 401) throw Object.assign(new Error("Session expired."), {code:401});
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.hint || data.details || "Saved cook methods could not be read.");
    return data;
  }

  async function loadSavedCookMethods(){
    let session = loadCloudSession();
    if (!session || !session.access_token) {
      savedCookMethods = [];
      methodLoadMessage = state.cookMethodId
        ? "Cloud is signed out. The selected cook method remains saved on this device."
        : "Sign in to load saved cook methods.";
      renderCookMethodOptions();
      return false;
    }
    methodLoadMessage = "Loading saved cook methods…";
    renderCookMethodOptions();
    try {
      let rows;
      try {
        rows = await fetchActiveCookMethods(session.access_token);
      } catch (err) {
        if (err.code !== 401) throw err;
        session = await refreshCloudSession(session);
        rows = await fetchActiveCookMethods(session.access_token);
      }
      savedCookMethods = rows;
      if (state.cookMethodId && !state.cookMethodName) state.cookMethodName = methodNameForId(state.cookMethodId);
      methodLoadMessage = rows.length
        ? `${rows.length} active cook method${rows.length === 1 ? "" : "s"} loaded from Supabase.`
        : "No active saved cook methods were returned by Supabase.";
      save();
      renderCookMethodOptions();
      return true;
    } catch (err) {
      methodLoadMessage = `Saved cook methods could not be refreshed: ${err.message} Local cooking is unaffected.`;
      renderCookMethodOptions();
      return false;
    }
  }

  async function fetchCookMethodName(accessToken, methodId){
    if (!methodId) return "";
    const cached = savedCookMethods.find(method => method.id === methodId);
    if (cached) return cached.name;
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/cook_methods?select=id,name&id=eq.${encodeURIComponent(methodId)}&limit=1`,
        {headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,Accept:"application/json"}}
      );
      if (!response.ok) return "";
      const rows = await response.json();
      return rows[0] && rows[0].name ? rows[0].name : "";
    } catch (_) {
      return "";
    }
  }

  const originalCloudCookPayloadV119 = cloudCookPayload;
  cloudCookPayload = function(){
    const payload = originalCloudCookPayloadV119();
    payload.cook_method_id = state.cookMethodId || null;
    if (typeof payload.notes === "string") payload.notes = payload.notes.replace("V1.17.2","V1.19.0").replace("V1.16.0","V1.19.0");
    return payload;
  };

  const originalFetchCloudCookRecoveryV119 = fetchCloudCookRecovery;
  fetchCloudCookRecovery = async function(accessToken, cookUuid){
    const recovery = await originalFetchCloudCookRecoveryV119(accessToken, cookUuid);
    const cook = recovery.cook;
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/cooks?select=cook_method_id&id=eq.${encodeURIComponent(cookUuid)}&limit=1`,
        {headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,Accept:"application/json"}}
      );
      if (response.status === 401) throw Object.assign(new Error("Session expired."), {code:401});
      const rows = await response.json();
      if (!response.ok) throw new Error(rows.message || rows.hint || rows.details || "Cook method recovery failed.");
      cook.cook_method_id = rows[0] ? (rows[0].cook_method_id || null) : null;
      cook.cook_method_name = await fetchCookMethodName(accessToken, cook.cook_method_id);
      lastRecoveryMethod = {cookUuid:cook.id,id:cook.cook_method_id||null,name:cook.cook_method_name||""};
    } catch (err) {
      cook.cook_method_id = null;
      cook.cook_method_name = "";
      cook.cook_method_error = err.message;
      lastRecoveryMethod = null;
    }
    return recovery;
  };

  const originalRenderCloudRecoveryV119 = renderCloudRecovery;
  renderCloudRecovery = function(cook, events){
    originalRenderCloudRecoveryV119(cook, events);
    const box = $("cloudRecovery");
    if (!box || !cook) return;
    const lines = box.textContent.split("\n");
    let methodText = "None";
    if (cook.cook_method_error) methodText = `Unavailable (${cook.cook_method_error})`;
    else if (cook.cook_method_id) methodText = cook.cook_method_name || "Saved cook method";
    const equipmentIndex = lines.findIndex(line => line.startsWith("Equipment:"));
    const locationIndex = lines.findIndex(line => line.startsWith("Location:"));
    const insertAt = equipmentIndex >= 0 ? equipmentIndex + 1 : (locationIndex >= 0 ? locationIndex + 1 : Math.min(4, lines.length));
    lines.splice(insertAt, 0, `Cook Method: ${methodText}`);
    box.textContent = lines.join("\n");
  };

  const originalRestoreViewedCloudCookV119 = restoreViewedCloudCook;
  restoreViewedCloudCook = function(){
    const recovery = viewedCloudRecovery;
    const beforeState = state;
    originalRestoreViewedCloudCookV119();
    if (
      state !== beforeState &&
      recovery &&
      recovery.cook &&
      state.cookId === recovery.cook.cook_id &&
      state.cloudCookUuid === recovery.cook.id &&
      !recovery.cook.cook_method_error
    ) {
      state.cookMethodId = recovery.cook.cook_method_id || null;
      state.cookMethodName = recovery.cook.cook_method_name || methodNameForId(state.cookMethodId);
      render();
      save();
      render();
    }
  };

  const resetButton = $("resetCook");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      const preservedId = state.cookMethodId || null;
      const preservedName = state.cookMethodName || "";
      const beforeCookId = state.cookId;
      const beforeEventCount = Array.isArray(state.events) ? state.events.length : 0;
      setTimeout(() => {
        const resetCompleted = !state.cookId && Array.isArray(state.events) && state.events.length === 0 &&
          (beforeCookId || beforeEventCount || preservedId);
        if (!resetCompleted) return;
        state.cookMethodId = preservedId;
        state.cookMethodName = preservedName;
        save();
        render();
      }, 70);
    }, true);
  }

  const originalCloudSignInV119 = cloudSignIn;
  cloudSignIn = async function(){
    await originalCloudSignInV119();
    if (loadCloudSession()) await loadSavedCookMethods();
  };
  $("cloudRead").addEventListener("click", () => setTimeout(loadSavedCookMethods, 0));
  $("cloudSignOut").addEventListener("click", () => setTimeout(() => {
    savedCookMethods = [];
    methodLoadMessage = state.cookMethodId
      ? "Cloud is signed out. The selected cook method remains saved on this device."
      : "Sign in to load saved cook methods.";
    renderCookMethodOptions();
  }, 0));

  document.title = "LDCookLog Mobile V1.19.0";
  const headerSub = document.querySelector("header .sub");
  if (headerSub) headerSub.textContent = "V1.19.0 Stateful BBQ Control Panel";
  const footer = document.querySelector(".footer-note");
  if (footer) footer.innerHTML = `V1.19.0 Saved Cook Methods: choose one active saved method, sync it to the cook, and restore it from Supabase.<br><strong>Build ${BUILD}</strong>`;

  ensureCookMethodUI();
  renderCookMethodOptions();
  save();
  render();
  if (loadCloudSession()) setTimeout(loadSavedCookMethods, 550);
})();
