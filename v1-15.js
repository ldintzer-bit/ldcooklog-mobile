// LDCookLog Mobile V1.15.1 conflict detection + resolution patch
(() => {
  const BUILD = "2026-09-11J";

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
    return `CLOUD CONFLICT DETECTED\nCook ${state.cookId || ""} was changed in Supabase after this device last synchronized it.\n\nYour local cook has NOT been overwritten. Pending cloud updates and events are paused until you choose which version to keep.`;
  }

  function ensureConflictActions(){
    let box = document.getElementById("cloudConflictActions");
    if (!box) {
      box = document.createElement("div");
      box.id = "cloudConflictActions";
      box.className = "recovery-actions hidden";
      const status = $("cloudSyncStatus");
      status.parentNode.insertBefore(box, status.nextSibling);
    }
    return box;
  }

  function hideConflictActions(){
    const box = ensureConflictActions();
    box.innerHTML = "";
    box.classList.add("hidden");
  }

  function showConflictActions(){
    const box = ensureConflictActions();
    box.innerHTML = "";

    const useCloud = document.createElement("button");
    useCloud.className = "good";
    useCloud.textContent = "Use Cloud Version";
    useCloud.title = "Replace this device's stale local copy with the newer Supabase copy";
    useCloud.addEventListener("click", resolveConflictWithCloud);

    const useLocal = document.createElement("button");
    useLocal.className = "warn";
    useLocal.textContent = "Use This Device";
    useLocal.title = "Deliberately make this device's current cook state authoritative in Supabase";
    useLocal.addEventListener("click", resolveConflictWithLocal);

    box.appendChild(useCloud);
    box.appendChild(useLocal);
    box.classList.remove("hidden");
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
      showConflictActions();
      return;
    }
    hideConflictActions();
    originalRenderCloudSyncState();
  };

  async function fetchCloudCookVersion(accessToken){
    if (!state.cloudCookUuid) throw new Error("Cloud cook UUID is missing.");
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cooks?select=id,cook_id,food,weight_value,weight_unit,target_temp,start_time,finish_time,phase,notes,updated_at&id=eq.${encodeURIComponent(state.cloudCookUuid)}&limit=1`, {
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
    if (typeof payload.notes === "string") payload.notes = payload.notes.replace("V1.14.0", "V1.15.1").replace("V1.15.0", "V1.15.1");
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

  async function forcePatchCloudCook(accessToken){
    if (!state.cloudCookUuid) throw new Error("Cloud cook UUID is missing.");
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cooks?id=eq.${encodeURIComponent(state.cloudCookUuid)}`, {
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
    if (!response.ok) throw new Error((data && (data.message || data.hint || data.details)) || "Cloud cook override failed.");
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Cloud cook override returned no row to confirm.");
    return row;
  }

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

  const originalSyncPendingEventsToCloud = syncPendingEventsToCloud;
  syncPendingEventsToCloud = async function(){
    if (state.cloudConflict) {
      renderCloudSyncState();
      return false;
    }
    return originalSyncPendingEventsToCloud();
  };

  function applyCloudRecovery(recovery){
    const {cook, events} = recovery;
    const finished = Boolean(cook.finish_time) || cook.phase === "Finished";
    const recovered = reconstructEventStates(events);
    const smoker = inferSmokerFromNotes(cook.notes);
    let phaseStart = null, phaseTarget = null;
    if (!finished && cook.phase === "Keep Warm") {
      phaseStart = latestEventTime(events, "Keep Warm Start");
      phaseTarget = 165;
    } else if (!finished && cook.phase === "Rest") {
      phaseStart = latestEventTime(events, "Rest Start");
    }
    const restoredEvents = events.map(ev => ({
      eventId: ev.id,
      cloudSynced: true,
      cookId: cook.cook_id,
      ts: ev.event_time,
      type: ev.event_type,
      note: ev.note || "",
      target: ev.target_temp ?? cook.target_temp ?? "",
      phase: ev.phase || cook.phase,
      smoker: ev.smoker || smoker,
      cookName: cook.food || "Cook",
      weight: cook.weight_value == null ? "" : String(cook.weight_value),
      setup: ev.setup_context || "Recovered from Supabase"
    }));
    state = Object.assign(defaultState(), {
      smoker,
      cookName: cook.food || "Cook",
      weight: cook.weight_value == null ? "" : String(cook.weight_value),
      target: Number(cook.target_temp) || 0,
      cookId: cook.cook_id,
      start: cook.start_time,
      finishTime: finished ? (cook.finish_time || latestEventTime(events, "Cook Finished")) : null,
      meatOn: finished ? false : recovered.meatOn,
      lidOpen: recovered.lidOpen,
      wrapped: recovered.wrapped,
      phase: finished ? "Finished" : (cook.phase || "Cooking"),
      phaseStart,
      phaseTarget,
      events: restoredEvents,
      cloudCookSynced: true,
      cloudCookUuid: cook.id,
      cloudCookStateSynced: true,
      cloudSyncMessage: "Conflict resolved using the cloud version.",
      cloudLastSeenUpdatedAt: cook.updated_at || null,
      cloudConflict: false
    });
    render();
    if (!save()) throw new Error("The cloud version was read but could not be safely saved locally.");
    render();
  }

  async function getSessionWithRefresh(){
    let session = loadCloudSession();
    if (!session || !session.access_token) throw new Error("Sign in to the cloud before resolving this conflict.");
    return session;
  }

  async function resolveConflictWithCloud(){
    if (!state.cloudConflict || !state.cloudCookUuid) return;
    if (storageBlocked) { alert("Conflict resolution is disabled because local storage is not currently safe to write."); return; }
    if (!confirm(`Use the CLOUD version of cook ${state.cookId}?\n\nThis will replace this device's stale local copy with the newer Supabase copy. The Supabase copy itself will not be changed.`)) return;
    const box = ensureConflictActions();
    [...box.querySelectorAll("button")].forEach(b => b.disabled = true);
    try {
      let session = await getSessionWithRefresh();
      let recovery;
      try { recovery = await fetchCloudCookRecovery(session.access_token, state.cloudCookUuid); }
      catch (err) {
        if (err.code !== 401) throw err;
        session = await refreshCloudSession(session);
        recovery = await fetchCloudCookRecovery(session.access_token, state.cloudCookUuid);
      }
      applyCloudRecovery(recovery);
      alert(`Conflict resolved.\n\nThis device now uses the cloud version of ${state.cookId}.`);
    } catch (err) {
      state.cloudSyncMessage = `Conflict resolution failed: ${err.message}\nNeither copy was overwritten.`;
      save();
      renderCloudSyncState();
      alert(state.cloudSyncMessage);
    } finally {
      [...box.querySelectorAll("button")].forEach(b => b.disabled = false);
    }
  }

  async function resolveConflictWithLocal(){
    if (!state.cloudConflict || !state.cloudCookUuid) return;
    if (storageBlocked) { alert("Conflict resolution is disabled because local storage is not currently safe to write."); return; }
    if (!confirm(`Use THIS DEVICE's version of cook ${state.cookId}?\n\nThis will deliberately replace the current cloud cook state with this device's values. Existing cloud event history will be preserved, and this device's pending events will then be uploaded.`)) return;
    const box = ensureConflictActions();
    [...box.querySelectorAll("button")].forEach(b => b.disabled = true);
    try {
      let session = await getSessionWithRefresh();
      let access = session.access_token;
      let row;
      try { row = await forcePatchCloudCook(access); }
      catch (err) {
        if (err.code !== 401) throw err;
        session = await refreshCloudSession(session);
        access = session.access_token;
        row = await forcePatchCloudCook(access);
      }

      const resolutionEvent = makeEvent("Conflict Resolved", "This device was explicitly chosen over a newer cloud copy.");
      resolutionEvent.cloudSynced = false;
      state.events.push(resolutionEvent);
      state.cloudLastSeenUpdatedAt = row.updated_at || null;
      state.cloudConflict = false;
      state.cloudCookSynced = true;
      state.cloudCookStateSynced = true;
      state.cloudSyncMessage = "Conflict resolved using this device. Uploading pending events…";
      save();
      render();

      const eventsOk = await syncPendingEventsToCloud();
      state.cloudSyncMessage = eventsOk ? "Conflict resolved using this device." : "Conflict resolved using this device. Some events are still waiting to sync.";
      save();
      render();
      alert(eventsOk ? `Conflict resolved.\n\nThis device is now authoritative for ${state.cookId}, and pending events were synchronized.` : `Conflict resolved for the cook state.\n\nThis device is authoritative, but one or more events are still waiting to sync. They remain safe locally.`);
    } catch (err) {
      state.cloudSyncMessage = `Conflict resolution failed: ${err.message}\nNeither copy was intentionally replaced.`;
      save();
      renderCloudSyncState();
      alert(state.cloudSyncMessage);
    } finally {
      [...box.querySelectorAll("button")].forEach(b => b.disabled = false);
    }
  }

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

  document.title = "LDCookLog Mobile V1.15.1";
  const headerSub = document.querySelector("header .sub");
  if (headerSub) headerSub.textContent = "V1.15.1 Stateful BBQ Control Panel";
  document.querySelectorAll(".sub").forEach(el => {
    if (el.textContent.includes("V1.14.0 preserves")) {
      el.textContent = "V1.15.1 adds explicit conflict resolution. When another device changed the cloud cook, choose Use Cloud Version or Use This Device; nothing is overwritten until you decide.";
    }
  });
  const footer = document.querySelector(".footer-note");
  if (footer) footer.innerHTML = `V1.15.1 adds explicit cloud-conflict resolution while preserving V1.15 conflict detection, V1.14 complete event snapshots, local-first operation, and retry-safe event sync.<br><strong>Build ${BUILD}</strong>`;

  save();
  render();
  setTimeout(bootstrapCloudVersionBaseline, 250);
})();
