from pathlib import Path

index_path = Path('index.html')
sw_path = Path('service-worker.js')
html = index_path.read_text()

html = html.replace(
"    <div class=\"sub\" style=\"margin-top:10px\">V1.23 automatically compares recent completed FireBoard sessions with the current cook time window, recommends the best match, and offers a single Connect &amp; Import action. Nothing is attached without your confirmation.</div>`;",
"    <div id=\"liveFireboardWrap\" class=\"cloud-cook\" style=\"display:none;margin-top:10px\"></div>\n    <div class=\"sub\" style=\"margin-top:10px\">V1.23.1 links one active FireBoard session directly to one active LDCookLog cook, stores new temperature samples automatically, and refreshes a live graph during the cook. Completed-session tools remain available for recovery and historical work.</div>`;"
)

html = html.replace(
"  const fireboardStatus = document.getElementById('fireboardStatus');\n  const fireboardList = document.getElementById('fireboardSessions');\n  const fireboardLoad = document.getElementById('fireboardLoad');",
"  const fireboardStatus = document.getElementById('fireboardStatus');\n  const fireboardList = document.getElementById('fireboardSessions');\n  const fireboardLoad = document.getElementById('fireboardLoad');\n  const liveFireboardWrap = document.getElementById('liveFireboardWrap');\n  let liveFireboardPollTimer = null;\n  let liveFireboardSyncInProgress = false;\n  let liveFireboardSession = null;"
)

# Remove the V1.23 recommendation block from renderFireboardSessions; completed-session manual tools remain.
start = html.find("\n    const recommended = findRecommendedFireboardSession(sessions);\n", html.find("function renderFireboardSessions"))
end = html.find("\n  }\n\n\n  async function readFireboardAssociationIds", start)
if start != -1 and end != -1:
    html = html[:start] + "\n" + html[end:]

anchor = "  async function requestFireboardSessions(accessToken) {"
live_code = r'''  async function readLatestFireboardSampleTimes(accessToken, associationId) {
    const query = new URLSearchParams({
      select: 'channel_index,observed_at',
      cook_fireboard_session_id: `eq.${associationId}`,
      order: 'observed_at.desc',
      limit: '100'
    });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/fireboard_temperature_samples?${query}`, {
      headers: fireboardCloudHeaders(accessToken)
    });
    const rows = await response.json().catch(() => []);
    if (response.status === 401) throw Object.assign(new Error('Session expired.'), { code: 401 });
    if (!response.ok) throw new Error(rows?.message || `Could not read latest FireBoard samples (${response.status}).`);
    const latest = new Map();
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const key = Number(row.channel_index) || 0;
      const ms = Date.parse(row.observed_at);
      if (Number.isFinite(ms) && (!latest.has(key) || ms > latest.get(key))) latest.set(key, ms);
    });
    return latest;
  }

  async function importLiveFireboardSamples(accessToken, fbSession, associationId) {
    const data = await requestFireboardChartSummary(accessToken, fbSession.id, true);
    const latestByChannel = await readLatestFireboardSampleTimes(accessToken, associationId);
    const rows = [];
    const channels = Array.isArray(data.channels) ? data.channels : [];
    channels.forEach(channel => {
      const channelIndex = Number(channel.index) || 0;
      const latest = latestByChannel.get(channelIndex) ?? -Infinity;
      (Array.isArray(channel.samples) ? channel.samples : []).forEach(sample => {
        const temperature = Number(sample.temperature_value);
        if (!Number.isFinite(temperature)) return;
        const observedIso = fireboardTimestampToIso(sample.observed_at);
        if (Date.parse(observedIso) <= latest) return;
        rows.push({
          cook_fireboard_session_id: associationId,
          channel_index: channelIndex,
          device_uuid: channel.device_uuid || null,
          channel_label: channel.label || null,
          observed_at: observedIso,
          temperature_value: temperature,
          degree_type: channel.degree_type == null ? null : String(channel.degree_type)
        });
      });
    });
    const batchSize = 500;
    for (let start = 0; start < rows.length; start += batchSize) {
      await upsertFireboardSampleBatch(accessToken, rows.slice(start, start + batchSize));
    }
    return rows.length;
  }

  function renderLiveFireboardHeading(fbSession, sampleCount, newCount) {
    liveFireboardWrap.style.display = 'block';
    liveFireboardWrap.innerHTML = '';
    const heading = document.createElement('strong');
    heading.textContent = `Live FireBoard — ${fbSession.title || `Session ${fbSession.id}`}`;
    liveFireboardWrap.appendChild(heading);
    const detail = document.createElement('div');
    detail.className = 'sub';
    detail.style.marginTop = '4px';
    detail.textContent = `${sampleCount} stored samples${newCount ? ` • ${newCount} new this refresh` : ' • up to date'} • automatic refresh every 30 seconds`;
    liveFireboardWrap.appendChild(detail);
    const graphHost = document.createElement('div');
    graphHost.className = 'live-fireboard-graph-host';
    liveFireboardWrap.appendChild(graphHost);
    return graphHost;
  }

  async function syncActiveFireboard(forceFinal = false) {
    if (liveFireboardSyncInProgress) return;
    if (!state.start || (!forceFinal && state.finishTime)) {
      if (!state.start) liveFireboardWrap.style.display = 'none';
      return;
    }
    let authSession = loadCloudSession();
    if (!authSession?.access_token) return;
    liveFireboardSyncInProgress = true;
    try {
      let data;
      try {
        data = await requestFireboardSessions(authSession.access_token);
      } catch (err) {
        if (err.code !== 401) throw err;
        authSession = await refreshCloudSession(authSession);
        data = await requestFireboardSessions(authSession.access_token);
      }
      const active = Array.isArray(data.active_sessions) ? data.active_sessions : [];
      if (!active.length) {
        setFireboardStatus('LDCookLog is active. Waiting for an active FireBoard session…');
        return;
      }
      if (active.length > 1) {
        setFireboardStatus(`More than one active FireBoard session was found (${active.length}). Automatic linking is paused rather than guessing.`, 'warn');
        return;
      }

      const fbSession = active[0];
      liveFireboardSession = fbSession;
      const parentOk = await syncCurrentCookToCloud();
      if (!parentOk || !state.cloudCookUuid) throw new Error('The active cook could not be prepared in cloud storage.');
      authSession = loadCloudSession();
      let accessToken = authSession?.access_token;
      if (!accessToken) throw new Error('Cloud session is unavailable.');

      await writeFireboardAssociation(accessToken, fbSession);
      const association = await getFireboardAssociation(accessToken, fbSession.id);
      if (!association?.id) throw new Error('Active FireBoard session could not be linked to this cook.');
      const newCount = await importLiveFireboardSamples(accessToken, fbSession, association.id);
      const rows = await readFireboardTemperatureSamples(accessToken, association.id);
      const graphHost = renderLiveFireboardHeading(fbSession, rows.length, newCount);
      renderFireboardTemperatureGraph(graphHost, fbSession, rows);
      graphHost.querySelector('.fireboard-analysis')?.remove();
      setFireboardStatus(`Active FireBoard session ${fbSession.title || fbSession.id} is linked to cook ${state.cookId}. Live temperatures are being stored automatically.`, 'good');
    } catch (err) {
      setFireboardStatus(`Live FireBoard sync warning: ${err.message}\nThe LDCookLog cook remains safe.`, 'bad');
    } finally {
      liveFireboardSyncInProgress = false;
    }
  }

  function startLiveFireboardPolling() {
    if (liveFireboardPollTimer) clearInterval(liveFireboardPollTimer);
    liveFireboardPollTimer = setInterval(() => syncActiveFireboard(false), 30000);
    setTimeout(() => syncActiveFireboard(false), 2500);
  }

'''
if anchor not in html:
    raise SystemExit('requestFireboardSessions anchor not found')
html = html.replace(anchor, live_code + anchor, 1)

# Stop showing recommendation text in the completed-session loader.
html = html.replace(
"      const recommended = findRecommendedFireboardSession(sessions);\n      const suffix = state.cloudCookUuid ? ` ${attachedCount} already attached to cook ${state.cookId}.` : '';\n      const recommendation = recommended ? ` Recommended match: ${recommended.session.title || `FireBoard Session ${recommended.session.id}`}.` : '';\n      setFireboardStatus(`FireBoard connected. ${sessions.length} recent completed session${sessions.length === 1 ? '' : 's'} loaded.${suffix}${recommendation}`, 'good');",
"      const suffix = state.cloudCookUuid ? ` ${attachedCount} already attached to cook ${state.cookId}.` : '';\n      setFireboardStatus(`FireBoard connected. ${sessions.length} recent completed session${sessions.length === 1 ? '' : 's'} loaded.${suffix}`, 'good');"
)

# Trigger a final pull shortly after Finish Cook and begin polling at startup.
html = html.replace(
"  fireboardLoad.addEventListener('click', loadFireboardSessions);",
"  fireboardLoad.addEventListener('click', loadFireboardSessions);\n  document.getElementById('finishButton')?.addEventListener('click', () => {\n    setTimeout(() => syncActiveFireboard(true), 1200);\n  });\n  startLiveFireboardPolling();"
)

html = html.replace("document.title = 'LDCookLog Mobile V1.23.0';", "document.title = 'LDCookLog Mobile V1.23.1';")
html = html.replace("headerSub.textContent = 'V1.23.0 Stateful BBQ Control Panel';", "headerSub.textContent = 'V1.23.1 Stateful BBQ Control Panel';")
html = html.replace(
"if (footer) footer.innerHTML = 'V1.23.0 begins FireBoard cook integration: recent sessions are matched to the current cook by time window, with a recommended Connect & Import workflow. V1.22.7 analysis remains available but is not expanded in this release.<br><strong>Build 2026-09-13P</strong>';",
"if (footer) footer.innerHTML = 'V1.23.1 begins active FireBoard integration: one active FireBoard session is linked directly to one active LDCookLog cook, new samples are stored automatically, and the live graph refreshes during the cook. Historical analysis remains paused while we collect clean cook data.<br><strong>Build 2026-09-13Q</strong>';"
)

index_path.write_text(html)

sw = sw_path.read_text().replace("ldcooklog-v1-23-0", "ldcooklog-v1-23-1")
sw_path.write_text(sw)
