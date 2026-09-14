from pathlib import Path

p=Path('index.html')
text=p.read_text()

old="""  const liveFireboardWrap = document.getElementById('liveFireboardWrap');
  let liveFireboardPollTimer = null;"""
new="""  const liveFireboardWrap = document.getElementById('liveFireboardWrap');
  const storedFireboardWrap = document.createElement('div');
  storedFireboardWrap.className = 'cloud-cook';
  storedFireboardWrap.style.cssText = 'margin-top:10px';
  const storedFireboardButton = document.createElement('button');
  storedFireboardButton.className = 'blue';
  storedFireboardButton.style.width = '100%';
  storedFireboardButton.textContent = 'View Stored FireBoard Analysis';
  const storedFireboardContent = document.createElement('div');
  storedFireboardContent.className = 'stored-fireboard-content';
  storedFireboardWrap.appendChild(storedFireboardButton);
  storedFireboardWrap.appendChild(storedFireboardContent);
  liveFireboardWrap.insertAdjacentElement('afterend', storedFireboardWrap);
  let liveFireboardPollTimer = null;"""
if text.count(old)!=1: raise SystemExit('stored analysis UI anchor not found')
text=text.replace(old,new,1)

anchor="  async function requestFireboardSessions(accessToken) {"
insert=r'''  async function readStoredFireboardAssociations(accessToken) {
    if (!state.cloudCookUuid) return [];
    const q = new URLSearchParams({
      select: '*',
      cook_id: `eq.${state.cloudCookUuid}`,
      order: 'created_at.asc'
    });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/cook_fireboard_sessions?${q}`, {headers:fireboardCloudHeaders(accessToken)});
    const data = await r.json().catch(() => []);
    if (r.status === 401) throw Object.assign(new Error('Session expired.'), {code:401});
    if (!r.ok) throw new Error(data?.message || `Could not read stored FireBoard associations (${r.status}).`);
    return Array.isArray(data) ? data : [];
  }

  async function showStoredFireboardAnalysis() {
    const originalText = storedFireboardButton.textContent;
    storedFireboardButton.disabled = true;
    storedFireboardButton.textContent = 'Loading Stored Analysis…';
    storedFireboardContent.innerHTML = '';
    try {
      if (!state.cloudCookUuid) throw new Error('Load or sync a cook first.');
      let auth = loadCloudSession();
      if (!auth?.access_token) throw new Error('Sign in to LDCookLog Cloud first.');
      let associations;
      try {
        associations = await readStoredFireboardAssociations(auth.access_token);
      } catch (err) {
        if (err.code !== 401) throw err;
        auth = await refreshCloudSession(auth);
        associations = await readStoredFireboardAssociations(auth.access_token);
      }
      if (!associations.length) throw new Error('No stored FireBoard data is attached to this cook.');

      let totalSamples = 0;
      for (const association of associations) {
        const rows = await readFireboardTemperatureSamples(auth.access_token, association.id);
        if (!rows.length) continue;
        totalSamples += rows.length;
        const sessionId = association.fireboard_session_id || association.session_id || association.fireboard_id || association.id;
        const sessionTitle = association.fireboard_session_title || association.session_title || association.title || `Stored FireBoard Session ${sessionId}`;
        const host = document.createElement('div');
        host.className = 'stored-fireboard-session';
        host.style.marginTop = '10px';
        storedFireboardContent.appendChild(host);
        const fbSession = {id:sessionId,title:sessionTitle};
        renderFireboardTemperatureGraph(host, fbSession, rows);
        await renderFireboardProbeAssignments(host, rows, fbSession);
      }
      if (!totalSamples) throw new Error('The attached FireBoard session has no stored temperature samples.');
      storedFireboardButton.textContent = `Refresh Stored FireBoard Analysis — ${totalSamples} samples`;
      setFireboardStatus(`Stored FireBoard analysis loaded for cook ${state.cookId || ''} from ${totalSamples} cloud samples. The FireBoard does not need to be powered on.`, 'good');
    } catch (err) {
      storedFireboardButton.textContent = originalText;
      setFireboardStatus(`Stored FireBoard analysis failed: ${err.message}`, 'bad');
    } finally {
      storedFireboardButton.disabled = false;
    }
  }

  storedFireboardButton.addEventListener('click', showStoredFireboardAnalysis);

'''
if text.count(anchor)!=1: raise SystemExit('stored analysis function anchor not found')
text=text.replace(anchor,insert+anchor,1)

# Small grammar cleanup found during V1.26.1 validation.
old="""      row.textContent = `Food — ${stat.cookRole}: current ${latest.toFixed(1)}°${unit}; peak ${peak.toFixed(1)}°; change ${rise>=0?'+':''}${rise.toFixed(1)}°; ${stat.points.length} samples`;"""
new="""      row.textContent = `Food — ${stat.cookRole}: current ${latest.toFixed(1)}°${unit}; peak ${peak.toFixed(1)}°; change ${rise>=0?'+':''}${rise.toFixed(1)}°; ${stat.points.length} sample${stat.points.length===1?'':'s'}`;"""
if text.count(old)!=1: raise SystemExit('food sample grammar anchor not found')
text=text.replace(old,new,1)

old="""      row.textContent = `Smoker / chamber — ${stat.cookRole}: current ${latest.toFixed(1)}°${unit}; avg ${stat.avg.toFixed(1)}°; range ${min.toFixed(1)}–${max.toFixed(1)}°; ${stat.points.length} samples`;"""
new="""      row.textContent = `Smoker / chamber — ${stat.cookRole}: current ${latest.toFixed(1)}°${unit}; avg ${stat.avg.toFixed(1)}°; range ${min.toFixed(1)}–${max.toFixed(1)}°; ${stat.points.length} sample${stat.points.length===1?'':'s'}`;"""
if text.count(old)!=1: raise SystemExit('chamber sample grammar anchor not found')
text=text.replace(old,new,1)

for old,new in [
("  document.title = 'LDCookLog Mobile V1.26.1';","  document.title = 'LDCookLog Mobile V1.27.0';"),
("  if (headerSub) headerSub.textContent = 'V1.26.1 Stateful BBQ Control Panel';","  if (headerSub) headerSub.textContent = 'V1.27.0 Stateful BBQ Control Panel';"),
("  if (footer) footer.innerHTML = 'V1.26.1 displays the purpose-aware FireBoard analysis during live cooks instead of removing it after each live refresh. Food and Smoker / chamber streams remain separated using the saved user-selected purpose.<br><strong>Build 2026-09-14I</strong>';","  if (footer) footer.innerHTML = 'V1.27.0 adds stored FireBoard analysis for the current or restored cook using cloud temperature samples, so the graph and purpose-aware analysis remain available after the FireBoard is turned off. Live analysis remains unchanged.<br><strong>Build 2026-09-14J</strong>';"),
]:
    if text.count(old)!=1: raise SystemExit('version anchor not found')
    text=text.replace(old,new,1)

p.write_text(text)

swp=Path('service-worker.js'); sw=swp.read_text(); old="const CACHE_NAME = 'ldcooklog-v1-26-1';"; new="const CACHE_NAME = 'ldcooklog-v1-27-0';"
if sw.count(old)!=1: raise SystemExit('cache anchor not found')
swp.write_text(sw.replace(old,new,1))
print('V1.27.0 stored FireBoard analysis patch applied successfully.')
