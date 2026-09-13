from pathlib import Path

path = Path('index.html')
text = path.read_text()

old_button = """      inspect.dataset.fireboardInspectId = String(session.id);\n      inspect.disabled = true;\n      inspect.addEventListener('click', () => inspectFireboardChart(session, div, inspect));\n      div.appendChild(inspect);\n      fireboardList.appendChild(div);\n"""
new_button = """      inspect.dataset.fireboardInspectId = String(session.id);\n      inspect.disabled = true;\n      inspect.addEventListener('click', () => inspectFireboardChart(session, div, inspect));\n      div.appendChild(inspect);\n\n      const importButton = document.createElement('button');\n      importButton.className = 'good';\n      importButton.textContent = 'Import Temperature Data';\n      importButton.style.marginTop = '8px';\n      importButton.dataset.fireboardImportId = String(session.id);\n      importButton.disabled = true;\n      importButton.addEventListener('click', () => importFireboardTemperatureData(session, importButton));\n      div.appendChild(importButton);\n      fireboardList.appendChild(div);\n"""
if old_button not in text:
    raise SystemExit('Could not find V1.22.3 inspect button block.')
text = text.replace(old_button, new_button, 1)

old_mark = """        const inspect = button.parentElement?.querySelector(`button[data-fireboard-inspect-id=\"${button.dataset.fireboardSessionId}\"]`);\n        if (inspect) inspect.disabled = false;\n"""
new_mark = """        const inspect = button.parentElement?.querySelector(`button[data-fireboard-inspect-id=\"${button.dataset.fireboardSessionId}\"]`);\n        if (inspect) inspect.disabled = false;\n        const importButton = button.parentElement?.querySelector(`button[data-fireboard-import-id=\"${button.dataset.fireboardSessionId}\"]`);\n        if (importButton) importButton.disabled = false;\n"""
if old_mark not in text:
    raise SystemExit('Could not find attached-session marker block.')
text = text.replace(old_mark, new_mark, 1)

old_success = """      const inspect = button.parentElement?.querySelector(`button[data-fireboard-inspect-id=\"${String(fbSession.id)}\"]`);\n      if (inspect) inspect.disabled = false;\n      setFireboardStatus(`FireBoard session attached to cook ${state.cookId} and verified in cloud.`, 'good');\n"""
new_success = """      const inspect = button.parentElement?.querySelector(`button[data-fireboard-inspect-id=\"${String(fbSession.id)}\"]`);\n      if (inspect) inspect.disabled = false;\n      const importButton = button.parentElement?.querySelector(`button[data-fireboard-import-id=\"${String(fbSession.id)}\"]`);\n      if (importButton) importButton.disabled = false;\n      setFireboardStatus(`FireBoard session attached to cook ${state.cookId} and verified in cloud.`, 'good');\n"""
if old_success not in text:
    raise SystemExit('Could not find attach success block.')
text = text.replace(old_success, new_success, 1)

old_request = """  async function requestFireboardChartSummary(accessToken, sessionId) {\n    const response = await fetch(`${SUPABASE_URL}/functions/v1/fireboard-sessions?session_id=${encodeURIComponent(String(sessionId))}`, {\n"""
new_request = """  async function requestFireboardChartSummary(accessToken, sessionId, includeSamples = false) {\n    const sampleQuery = includeSamples ? '&samples=1' : '';\n    const response = await fetch(`${SUPABASE_URL}/functions/v1/fireboard-sessions?session_id=${encodeURIComponent(String(sessionId))}${sampleQuery}`, {\n"""
if old_request not in text:
    raise SystemExit('Could not find chart request helper.')
text = text.replace(old_request, new_request, 1)

old_degree = """        row.textContent = `${channel.label || `Channel ${(channel.index ?? 0) + 1}`}: ${channel.sample_count ?? 0} samples; ${min}–${max}°${channel.degree_type || ''}; ${formatChartTimestamp(channel.first_timestamp)} to ${formatChartTimestamp(channel.last_timestamp)}`;\n"""
new_degree = """        const degreeUnit = channel.degree_unit || (Number(channel.degree_type) === 1 ? 'C' : Number(channel.degree_type) === 2 ? 'F' : channel.degree_type || '');\n        row.textContent = `${channel.label || `Channel ${(channel.index ?? 0) + 1}`}: ${channel.sample_count ?? 0} samples; ${min}–${max}°${degreeUnit}; ${formatChartTimestamp(channel.first_timestamp)} to ${formatChartTimestamp(channel.last_timestamp)}`;\n"""
if old_degree not in text:
    raise SystemExit('Could not find degree display line.')
text = text.replace(old_degree, new_degree, 1)

marker = """  async function requestFireboardSessions(accessToken) {\n"""
helper = r'''  function fireboardTimestampToIso(value) {
    if (value === null || value === undefined || value === '') throw new Error('FireBoard sample is missing its timestamp.');
    const numeric = Number(value);
    const date = Number.isFinite(numeric)
      ? new Date(numeric > 100000000000 ? numeric : numeric * 1000)
      : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`Invalid FireBoard timestamp: ${value}`);
    return date.toISOString();
  }

  async function getFireboardAssociation(accessToken, sessionId) {
    if (!state.cloudCookUuid) throw new Error('The current cook is not linked to its cloud record.');
    const query = new URLSearchParams({
      select: 'id,fireboard_session_id',
      cook_id: `eq.${state.cloudCookUuid}`,
      fireboard_session_id: `eq.${String(sessionId)}`,
      limit: '1'
    });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cook_fireboard_sessions?${query}`, {
      headers: cloudHeaders(accessToken)
    });
    const rows = await response.json().catch(() => []);
    if (!response.ok) throw new Error(rows?.message || `Could not read FireBoard association (${response.status}).`);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async function upsertFireboardSampleBatch(accessToken, rows) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/fireboard_temperature_samples?on_conflict=cook_fireboard_session_id,channel_index,observed_at`, {
      method: 'POST',
      headers: {
        ...cloudHeaders(accessToken),
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(rows)
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || data.error || `Temperature sample import failed (${response.status}).`);
    }
  }

  async function verifyFireboardSampleCount(accessToken, associationId) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/fireboard_temperature_samples?select=id&cook_fireboard_session_id=eq.${encodeURIComponent(associationId)}&limit=1`, {
      headers: {
        ...cloudHeaders(accessToken),
        Prefer: 'count=exact'
      }
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || `Could not verify imported samples (${response.status}).`);
    }
    const range = response.headers.get('content-range') || '';
    const total = Number(range.split('/')[1]);
    return Number.isFinite(total) ? total : null;
  }

  async function importFireboardTemperatureData(fbSession, button) {
    let authSession = loadCloudSession();
    if (!authSession?.access_token) {
      setFireboardStatus('Sign in to LDCookLog Cloud before importing FireBoard temperature data.', 'warn');
      return;
    }
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Importing Temperature Data…';
    setFireboardStatus(`Importing temperature samples for ${fbSession.title || `FireBoard Session ${fbSession.id}`}…`);
    try {
      let association;
      let data;
      try {
        association = await getFireboardAssociation(authSession.access_token, fbSession.id);
        data = await requestFireboardChartSummary(authSession.access_token, fbSession.id, true);
      } catch (err) {
        if (err.code !== 401) throw err;
        authSession = await refreshCloudSession(authSession);
        association = await getFireboardAssociation(authSession.access_token, fbSession.id);
        data = await requestFireboardChartSummary(authSession.access_token, fbSession.id, true);
      }
      if (!association?.id) throw new Error('This FireBoard session is not attached to the current cook in cloud storage.');

      const rows = [];
      const channels = Array.isArray(data.channels) ? data.channels : [];
      channels.forEach(channel => {
        const samples = Array.isArray(channel.samples) ? channel.samples : [];
        samples.forEach(sample => {
          const temperature = Number(sample.temperature_value);
          if (!Number.isFinite(temperature)) return;
          rows.push({
            cook_fireboard_session_id: association.id,
            channel_index: Number(channel.index) || 0,
            device_uuid: channel.device_uuid || null,
            channel_label: channel.label || null,
            observed_at: fireboardTimestampToIso(sample.observed_at),
            temperature_value: temperature,
            degree_type: channel.degree_type == null ? null : String(channel.degree_type)
          });
        });
      });
      if (!rows.length) throw new Error('FireBoard returned no temperature samples to import.');

      const batchSize = 500;
      for (let start = 0; start < rows.length; start += batchSize) {
        await upsertFireboardSampleBatch(authSession.access_token, rows.slice(start, start + batchSize));
      }
      const verifiedCount = await verifyFireboardSampleCount(authSession.access_token, association.id);
      button.textContent = 'Temperature Data Imported';
      button.disabled = false;
      const verifiedText = verifiedCount == null ? `${rows.length} samples sent` : `${verifiedCount} samples verified in cloud`;
      setFireboardStatus(`FireBoard temperature import complete for ${fbSession.title || `FireBoard Session ${fbSession.id}`}: ${verifiedText}. Re-importing is safe and will not create duplicates.`, 'good');
    } catch (err) {
      button.textContent = originalText;
      button.disabled = false;
      setFireboardStatus(`FireBoard temperature import failed: ${err.message}\nYour cook data is unaffected.`, 'bad');
    }
  }

'''
if marker not in text:
    raise SystemExit('Could not find sessions request marker.')
text = text.replace(marker, helper + marker, 1)

text = text.replace(
    "V1.22.3 can securely inspect read-only FireBoard temperature channel summaries for sessions attached to the current cook. Temperature samples are not imported yet.",
    "V1.22.4 can securely import FireBoard temperature samples for sessions attached to the current cook. Imports are retry-safe and verified in cloud storage.",
    1
)
text = text.replace("document.title = 'LDCookLog Mobile V1.22.3';", "document.title = 'LDCookLog Mobile V1.22.4';", 1)
text = text.replace("headerSub.textContent = 'V1.22.3 Stateful BBQ Control Panel';", "headerSub.textContent = 'V1.22.4 Stateful BBQ Control Panel';", 1)
text = text.replace(
    "V1.22.3 adds secure read-only FireBoard temperature-channel inspection for attached sessions. No temperature samples are written to the database yet.<br><strong>Build 2026-09-13J</strong>",
    "V1.22.4 adds retry-safe FireBoard temperature-sample import into Supabase for attached sessions, with cloud verification and correct °F/°C display.<br><strong>Build 2026-09-13K</strong>",
    1
)
path.write_text(text)

sw = Path('service-worker.js')
sw_text = sw.read_text()
old_cache = "const CACHE_NAME = 'ldcooklog-v1-22-3';"
new_cache = "const CACHE_NAME = 'ldcooklog-v1-22-4';"
if old_cache not in sw_text:
    raise SystemExit('Could not find V1.22.3 service worker cache name.')
sw.write_text(sw_text.replace(old_cache, new_cache, 1))
