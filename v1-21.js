(() => {
  const OVERALL_OPTIONS = ["", "Excellent", "Good", "Fair", "Poor"];
  const BARK_OPTIONS = ["", "Excellent", "Good", "Fair", "Poor"];
  const TENDERNESS_OPTIONS = ["", "Tough", "Slightly Tough", "Just Right", "Too Tender"];
  let evaluationSyncTimer = null;
  let evaluationSyncInProgress = false;

  function normalizeEvaluation(value) {
    const src = value && typeof value === "object" ? value : {};
    return {
      overallResult: OVERALL_OPTIONS.includes(src.overallResult) ? src.overallResult : "",
      bark: BARK_OPTIONS.includes(src.bark) ? src.bark : "",
      tenderness: TENDERNESS_OPTIONS.includes(src.tenderness) ? src.tenderness : "",
      observations: typeof src.observations === "string" ? src.observations : "",
      changesNextTime: typeof src.changesNextTime === "string" ? src.changesNextTime : ""
    };
  }
  function hasEvaluation(ev) { return Boolean(ev.overallResult || ev.bark || ev.tenderness || ev.observations.trim() || ev.changesNextTime.trim()); }
  function selectOptions(values, selected) { return values.map(value => `<option value="${value.replaceAll('"','&quot;')}"${value===selected?' selected':''}>${value||'N/A'}</option>`).join(''); }
  function getEvaluation() { state.evaluation = normalizeEvaluation(state.evaluation); return state.evaluation; }
  function headers(token, extra={}) { return {apikey:SUPABASE_PUBLISHABLE_KEY, Authorization:`Bearer ${token}`, Accept:'application/json', ...extra}; }
  function cloudPayload() { const ev=getEvaluation(); return {cook_id:state.cloudCookUuid,overall_result:ev.overallResult||null,bark:ev.bark||null,tenderness:ev.tenderness||null,observations:ev.observations.trim()||null,changes_next_time:ev.changesNextTime.trim()||null}; }

  const originalDefaultState=defaultState;
  defaultState=function(){const next=originalDefaultState();next.evaluation=normalizeEvaluation(next.evaluation);next.evaluationCloudSynced=false;return next;};
  const originalSave=save;
  save=function(){state.evaluation=normalizeEvaluation(state.evaluation);return originalSave.apply(this,arguments);};

  const host=document.createElement('section'); host.id='cookEvaluationSection'; host.className='card'; host.style.display='none';
  host.innerHTML=`<h2>Cook Evaluation</h2><p class="small">Optional. Complete this after you have tasted the finished cook. You can change it later.</p><div id="cookEvaluationSummary"></div><button type="button" id="toggleCookEvaluation">Evaluate Cook</button><div id="cookEvaluationForm" style="display:none;margin-top:12px"><label>Overall Result<select id="evaluationOverall"></select></label><label>Bark<select id="evaluationBark"></select></label><label>Tenderness<select id="evaluationTenderness"></select></label><label>Observations<textarea id="evaluationObservations" rows="4" placeholder="Great bark, but a little dry at the edges..."></textarea></label><label>Changes Next Time<textarea id="evaluationChanges" rows="4" placeholder="Pull earlier, extend the hold, use less binder..."></textarea></label><p id="evaluationSavedMessage" class="small"></p></div>`;
  const eventCard=document.getElementById('eventList')?.closest('.card'); if(eventCard?.parentNode) eventCard.parentNode.insertBefore(host,eventCard.nextSibling); else document.querySelector('.app')?.appendChild(host);
  const summary=document.getElementById('cookEvaluationSummary'),toggle=document.getElementById('toggleCookEvaluation'),form=document.getElementById('cookEvaluationForm'),overall=document.getElementById('evaluationOverall'),bark=document.getElementById('evaluationBark'),tenderness=document.getElementById('evaluationTenderness'),observations=document.getElementById('evaluationObservations'),changes=document.getElementById('evaluationChanges'),savedMessage=document.getElementById('evaluationSavedMessage');

  async function requestEvaluation(token, method, url, body) {
    const response=await fetch(url,{method,headers:headers(token,body?{'Content-Type':'application/json',Prefer:'return=representation'}:{}),body:body?JSON.stringify(body):undefined});
    if(response.status===401) throw Object.assign(new Error('Session expired.'),{code:401});
    const data=await response.json().catch(()=>null); if(!response.ok) throw new Error((data&&(data.message||data.hint||data.details))||'Evaluation cloud request failed.'); return data;
  }
  async function fetchEvaluation(token,cookUuid){const data=await requestEvaluation(token,'GET',`${SUPABASE_URL}/rest/v1/cook_evaluations?select=overall_result,bark,tenderness,observations,changes_next_time&cook_id=eq.${encodeURIComponent(cookUuid)}&limit=1`);return data?.[0]||null;}
  async function syncEvaluationToCloud(){
    if(evaluationSyncInProgress||!state.finishTime||!state.cloudCookUuid||!hasEvaluation(getEvaluation())) return false;
    let session=loadCloudSession(); if(!session?.access_token){savedMessage.textContent='Evaluation saved on this device. Cloud sync will retry after sign-in.';return false;}
    evaluationSyncInProgress=true;
    try{
      let access=session.access_token;
      const run=async()=>{const existing=await fetchEvaluation(access,state.cloudCookUuid);if(existing){return requestEvaluation(access,'PATCH',`${SUPABASE_URL}/rest/v1/cook_evaluations?cook_id=eq.${encodeURIComponent(state.cloudCookUuid)}`,cloudPayload());}return requestEvaluation(access,'POST',`${SUPABASE_URL}/rest/v1/cook_evaluations`,cloudPayload());};
      try{await run();}catch(err){if(err.code!==401)throw err;session=await refreshCloudSession(session);access=session.access_token;await run();}
      state.evaluationCloudSynced=true; save(); savedMessage.textContent='Evaluation saved locally and to cloud.'; return true;
    }catch(err){state.evaluationCloudSynced=false;save();savedMessage.textContent=`Evaluation is safe on this device. Cloud sync warning: ${err.message}`;return false;}finally{evaluationSyncInProgress=false;}
  }
  function scheduleEvaluationSync(){clearTimeout(evaluationSyncTimer);evaluationSyncTimer=setTimeout(syncEvaluationToCloud,700);}
  function saveField(field,value){const ev=getEvaluation();ev[field]=value;state.evaluation=normalizeEvaluation(ev);state.evaluationCloudSynced=false;save();savedMessage.textContent='Evaluation saved on this device.';renderEvaluation();scheduleEvaluationSync();}
  function renderEvaluation(){
    const finished=state.phase==='Finished'||Boolean(state.finishTime);host.style.display=finished?'block':'none';if(!finished)return;
    const ev=getEvaluation();overall.innerHTML=selectOptions(OVERALL_OPTIONS,ev.overallResult);bark.innerHTML=selectOptions(BARK_OPTIONS,ev.bark);tenderness.innerHTML=selectOptions(TENDERNESS_OPTIONS,ev.tenderness);observations.value=ev.observations;changes.value=ev.changesNextTime;
    if(hasEvaluation(ev)){const lines=[];if(ev.overallResult)lines.push(`<strong>Overall:</strong> ${escapeHtml(ev.overallResult)}`);if(ev.bark)lines.push(`<strong>Bark:</strong> ${escapeHtml(ev.bark)}`);if(ev.tenderness)lines.push(`<strong>Tenderness:</strong> ${escapeHtml(ev.tenderness)}`);if(ev.observations.trim())lines.push(`<strong>Observations:</strong> ${escapeHtml(ev.observations)}`);if(ev.changesNextTime.trim())lines.push(`<strong>Changes Next Time:</strong> ${escapeHtml(ev.changesNextTime)}`);summary.innerHTML=`<div class="small">${lines.join('<br>')}</div>`;toggle.textContent=form.style.display==='none'?'Edit Evaluation':'Hide Evaluation';}else{summary.innerHTML='<p class="small">No evaluation recorded yet.</p>';toggle.textContent=form.style.display==='none'?'Evaluate Cook':'Hide Evaluation';}
  }
  toggle.addEventListener('click',()=>{form.style.display=form.style.display==='none'?'block':'none';renderEvaluation();}); overall.addEventListener('change',()=>saveField('overallResult',overall.value));bark.addEventListener('change',()=>saveField('bark',bark.value));tenderness.addEventListener('change',()=>saveField('tenderness',tenderness.value));observations.addEventListener('input',()=>saveField('observations',observations.value));changes.addEventListener('input',()=>saveField('changesNextTime',changes.value));

  const originalRender=render;render=function(){const result=originalRender.apply(this,arguments);renderEvaluation();return result;};
  const originalSyncCurrentCookAndEvents=syncCurrentCookAndEvents;syncCurrentCookAndEvents=async function(){const result=await originalSyncCurrentCookAndEvents.apply(this,arguments);if(state.finishTime)await syncEvaluationToCloud();return result;};

  const originalFetchCloudCookRecovery=fetchCloudCookRecovery;fetchCloudCookRecovery=async function(accessToken,cookUuid){const result=await originalFetchCloudCookRecovery(accessToken,cookUuid);try{const row=await fetchEvaluation(accessToken,cookUuid);result.cook.evaluation=row?{overallResult:row.overall_result||'',bark:row.bark||'',tenderness:row.tenderness||'',observations:row.observations||'',changesNextTime:row.changes_next_time||''}:normalizeEvaluation(null);}catch(_){result.cook.evaluation=normalizeEvaluation(null);}return result;};
  const originalRenderCloudRecovery=renderCloudRecovery;renderCloudRecovery=function(cook,events){originalRenderCloudRecovery.apply(this,arguments);const box=document.getElementById('cloudRecovery');const ev=normalizeEvaluation(cook.evaluation);if(box&&hasEvaluation(ev)){box.textContent += `\n\nEVALUATION\nOverall: ${ev.overallResult||'N/A'}\nBark: ${ev.bark||'N/A'}\nTenderness: ${ev.tenderness||'N/A'}\nObservations: ${ev.observations||'—'}\nChanges Next Time: ${ev.changesNextTime||'—'}`;}};
  const originalRestoreViewedCloudCook=restoreViewedCloudCook;restoreViewedCloudCook=function(){const ev=viewedCloudRecovery?.cook?.evaluation?normalizeEvaluation(viewedCloudRecovery.cook.evaluation):null;const result=originalRestoreViewedCloudCook.apply(this,arguments);if(ev&&state.finishTime){state.evaluation=ev;state.evaluationCloudSynced=true;save();renderEvaluation();}return result;};

  document.title='LDCookLog Mobile V1.21.1';const headerSub=document.querySelector('header .sub');if(headerSub)headerSub.textContent='V1.21.1 Stateful BBQ Control Panel';const footer=document.querySelector('.footer-note');if(footer)footer.innerHTML='V1.21.1 adds retry-safe Cook Evaluation cloud save and recovery while keeping evaluation optional and local-first.<br><strong>Build 2026-09-13E</strong>';
  renderEvaluation(); if(state.finishTime&&hasEvaluation(getEvaluation())) scheduleEvaluationSync();
})();
