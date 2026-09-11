// LDCookLog Mobile V1.15.0 conflict-detection patch
(() => {
  const BUILD = "2026-09-11I";

  const originalDefaultState = defaultState;
  defaultState = function(){
    return Object.assign(originalDefaultState(), {
      cloudLastSeenUpdatedAt: null,
      cloudConflict: false
    });
  };

  if (!("cloudLastSeenUpdatedAt" in state)) state.cloudLastSeenUpdatedAt = null;
  if (!("cloudConflict" in state)) state.cloudConflict = false;

  const originalEnsureCookId = ensureCookId;
  ensureCookId = function(){
    const hadCookId = Boolean(state.cookId);
    const ok = originalEnsureCookId();
    if (ok && !hadCookId) {
      state.cloudLastSeenUpdatedAt = null;
      state.cloudConflict = false;
      save();
    }
    return ok;
  };

  function conflictMessage(){
    return `CLOUD CONFLICT DETECTED\nCook ${state.cookId || ""} was changed in Supabase after this device last synchronized it.\n\nYour local cook has NOT been overwritten. Pending cloud updates and events are paused until the conflict is resolved.`;
  }

  function setCloudConflict(cloudUpdatedAt){
    state.cloudConflict = {
      detectedAt: new Date().toISOString(),
      cloudUpdatedAt: cloudUpdatedAt || null,
      localBaseline: state.cloudLastSeenUpdatedAt || null
    };
    state.cloudCookStateSynced = false;
    state.cloudSyncMessage = conflictMessage();
    save();
    renderCloudSyncState();
  }

  const originalRenderCloudSyncState = renderCloudSyncState;
  renderCloudSyncState = function(){
    if (state.cloudConflict) {
      const el = $("cloudSyncStatus");
      el.textContent = conflictMessage();
      el.className = "cloud-status bad";
      return;
    }
    originalRenderCloudSyncState();
  };

  async function fetchCloudCookVersion(accessToken){
    if (!state.cloudCookUuid) throw new Error("Cloud cook UUID is missing.");
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cooks?select=id,cook_id,food,weight_value,weight_unit,target_temp,finish_time,phase,updated_at&id=eq.${encodeURIComponent(state.cloudCookUuid)}&limit=1`, {
      headers: {apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, Accept: "application/json"}
    });
    if (response.status === 401) throw Object.assign(new Error("Session expired."), {code:401});
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.hint || data.details || "Cloud version check failed.");
    return data[0] || null;
  }

  function cloudMatchesLocal(row){
    if (!row) return false;
    const cloudWeight = row.weight_value == null ? "" : String(row.weight_value);
    const localWeight = state.weight == null || state.weight === "" ? "" : String(Number(state.weight));
    const cloudTarget = row.target_temp == null ? 0 : Number(row.target_temp);
    const localTarget = Number(state.target) || 0;
    const cloudFinish = row.finish_time || null;
    const localFinish = state.finishTime || null;
    return String(row.food || "") === String(state.cookName || "Cook") &&
      cloudWeight === localWeight &&
      cloudTarget === localTarget &&
      String(row.phase || "") === String(state.phase || "Cooking") &&
      cloudFinish === localFinish;
  }

  findCloudCook = async function(accessToken, cookId){
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cooks?select=id,cook_id,food,phase,target_temp,finish_time,updated_at&cook_id=eq.${encodeURIComponent(cookId)}&limit=1`, {
      headers: {apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, Accept: "application/json"}
    });
    if (response.status === 401) throw Object.assign(new Error("Session expired."), {code:401});
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.hint || data.details || "Cloud lookup failed.");
    return data[0] || null;
  };

  fetchCloudCookRecovery = async function(accessToken, cookUuid){
    const cookResponse = await fetch(`${SUPABASE_URL}/rest/v1/cooks?select=id,cook_id,food,weight_value,weight_unit,target_temp,start_time,finish_time,phase,notes,updated_at&id=eq.${encodeURIComponent(cookUuid)}&limit=1`, {
      headers: {apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, Accept: "application/json"}
    });
    if (cookResponse.status === 401) throw Object.assign(new Error("Session expired."), {code:401});
    const cookData = await cookResponse.json();
    if (!cookResponse.ok) throw new Error(cookData.message || cookData.hint || cookData.details || "Cloud cook recovery failed.");
    const cook = cookData[0];
    if (!cook) throw new Error("Cloud cook was not found.");
    const eventResponse = await fetch(`${SUPABASE_URL}/rest/v1/events?select=id,event_type,event_time,note,target_temp,phase,smoker,setup_context&cook_id=eq.${encodeURIComponent(cookUuid)}&order=event_time.asc`, {
      headers: {apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, Accept: "application/json"}
    });
    if (eventResponse.status === 401) throw Object.assign(new Error("Session expired."), {code:401});
    const events = await eventResponse.json();
    if (!eventResponse.ok) throw new Error(events.message || events.hint || events.details || "Cloud event recovery failed.");
    return {cook, events};
  };

  const originalCloudCookPayload = cloudCookPayload;
  cloudCookPayload = function(){
    const payload = originalCloudCookPayload();
    if (typeof payload.notes === "string") payload.notes = payload.notes.replace("V1.14.0", "V1.15.0");
    return payload;
  };

  patchCloudCook = async function(accessToken){
    if (!state.cloudCookUuid) throw new Error("Cloud cook UUID is missing.");
    if (!state.cloudLastSeenUpdatedAt) throw Object.assign(new Error("Cloud version baseline is missing."), {code:"NO_BASELINE"});
    const baseline = state.cloudLastSeenUpdatedAt;
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cooks?id=eq.${encodeURIComponent(state.cloudCookUuid)}&updated_at=eq.${encodeURIComponent(baseline)}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(cloudCookPayload())
    });
    if (response.status === 401) throw Object.assign(new Error("Session expired."), {code:401});
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error((data && (data.message || data.hint || data.details)) || "Cloud cook update failed.");
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw Object.assign(new Error("Cloud cook changed before this update could be applied."), {code:"CLOUD_CONFLICT"});
    return row;
  };

  const originalSyncCurrentCookToCloud = syncCurrentCookToCloud;
  syncCurrentCookToCloud = async function(){
    const ok = await originalSyncCurrentCookToCloud();
    if (!ok || !state.cloudCookUuid || state.cloudLastSeenUpdatedAt || state.cloudConflict) return ok;
    if (!state.cloudCookStateSynced) return ok;
    let session = loadCloudSession();
    if (!session || !session.access_token) return ok;
    try {
      let row;
      try { row = await fetchCloudCookVersion(session.access_token); }
      catch (err) {
        if (err.code !== 401) throw err;
        session = await refreshCloudSession(session);
        row = await fetchCloudCookVersion(session.access_token);
      }
      if (row && row.updated_at) {
        state.cloudLastSeenUpdatedAt = row.updated_at;
        save();
      }
    } catch (_) {
      // A failed baseline read must not disturb local cooking.
    }
    return ok;
  };

  syncCloudCookState = async function(){
    if (state.cloudConflict) {
      renderCloudSyncState();
      return false;
    }
    const parentOk = await syncCurrentCookToCloud();
    if (!parentOk || !state.cloudCookUuid) return false;
    let session = loadCloudSession();
    if (!session || !session.access_token) return false;
    state.cloudSyncMessage = `Checking ${state.cookId} for cloud conflicts…`;
    save();
    renderCloudSyncState();
    try {
      let access = session.access_token;
      let current;
      try { current = await fetchCloudCookVersion(access); }
      catch (err) {
        if (err.code !== 401) throw err;
        session = await refreshCloudSession(session);
        access = session.access_token;
        current = await fetchCloudCookVersion(access);
      }
      if (!current) throw new Error("Cloud cook could not be found for conflict checking.");

      if (!state.cloudLastSeenUpdatedAt) {
        if (state.cloudCookStateSynced || cloudMatchesLocal(current)) {
          state.cloudLastSeenUpdatedAt = current.updated_at;
          state.cloudConflict = false;
          save();
        } else {
          setCloudConflict(current.updated_at);
          return false;
        }
      }

      if (current.updated_at !== state.cloudLastSeenUpdatedAt) {
        setCloudConflict(current.updated_at);
        return false;
      }

      state.cloudSyncMessage = `Updating ${state.cookId} cloud cook state…`;
      save();
      renderCloudSyncState();
      let row;
      try { row = await patchCloudCook(access); }
      catch (err) {
        if (err.code === "CLOUD_CONFLICT") {
          let latest = current;
          try { latest = await fetchCloudCookVersion(access) || current; } catch (_) {}
          setCloudConflict(latest && latest.updated_at);
          return false;
        }
        if (err.code !== 401) throw err;
        session = await refreshCloudSession(session);
        access = session.access_token;
        row = await patchCloudCook(access);
      }
      state.cloudLastSeenUpdatedAt = row.updated_at || state.cloudLastSeenUpdatedAt;
      state.cloudCookStateSynced = true;
      state.cloudConflict = false;
      state.cloudSyncMessage = "";
      save();
      renderCloudSyncState();
      return true;
    } catch (err) {
      state.cloudCookStateSynced = false;
      state.cloudSyncMessage = `Cloud cook update warning: ${err.message}\nLocal cook data is safe and can be retried.`;
      save();
      renderCloudSyncState();
      return false;
    }
  };

  const originalRestoreViewedCloudCook = restoreViewedCloudCook;
  restoreViewedCloudCook = function(){
    const recovery = viewedCloudRecovery;
    originalRestoreViewedCloudCook();
    if (recovery && recovery.cook && state.cookId === recovery.cook.cook_id && state.cloudCookUuid === recovery.cook.id) {
      state.cloudLastSeenUpdatedAt = recovery.cook.updated_at || null;
      state.cloudConflict = false;
      save();
      render();
    }
  };

  async function bootstrapCloudVersionBaseline(){
    if (!state.start || !state.cloudCookUuid || state.cloudLastSeenUpdatedAt || state.cloudConflict || !state.cloudCookStateSynced) return;
    let session = loadCloudSession();
    if (!session || !session.access_token) return;
    try {
      let row;
      try { row = await fetchCloudCookVersion(session.access_token); }
      catch (err) {
        if (err.code !== 401) throw err;
        session = await refreshCloudSession(session);
        row = await fetchCloudCookVersion(session.access_token);
      }
      if (row && row.updated_at) {
        state.cloudLastSeenUpdatedAt = row.updated_at;
        save();
        renderCloudSyncState();
      }
    } catch (_) {
      // Local cooking remains independent if baseline bootstrapping cannot reach the cloud.
    }
  }

  document.title = "LDCookLog Mobile V1.15.0";
  const headerSub = document.querySelector("header .sub");
  if (headerSub) headerSub.textContent = "V1.15.0 Stateful BBQ Control Panel";
  document.querySelectorAll(".sub").forEach(el => {
    if (el.textContent.includes("V1.14.0 preserves")) {
      el.textContent = "V1.15.0 adds cloud conflict detection. If the cloud cook changed after this device last synchronized it, LDCookLog stops before overwriting either copy. Recovery remains explicit and local-first.";
    }
  });
  const footer = document.querySelector(".footer-note");
  if (footer) footer.innerHTML = `V1.15.0 adds cloud conflict detection while preserving V1.14 complete event snapshots, active-cook resume, local-first operation, and retry-safe event sync.<br><strong>Build ${BUILD}</strong>`;

  save();
  render();
  setTimeout(bootstrapCloudVersionBaseline, 250);
})();
