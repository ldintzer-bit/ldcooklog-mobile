from pathlib import Path

path = Path('index.html')
text = path.read_text()

old_button = """      attach.dataset.fireboardSessionId = String(session.id);
      attach.addEventListener('click', () => attachFireboardSession(session, attach));
      div.appendChild(attach);
      fireboardList.appendChild(div);
"""
new_button = """      attach.dataset.fireboardSessionId = String(session.id);
      attach.addEventListener('click', () => attachFireboardSession(session, attach));
      div.appendChild(attach);

      const inspect = document.createElement('button');
      inspect.className = 'secondary';
      inspect.textContent = 'Inspect Temperature Data';
      inspect.style.marginTop = '8px';
      inspect.dataset.fireboardInspectId = String(session.id);
      inspect.disabled = true;
      inspect.addEventListener('click', () => inspectFireboardChart(session, div, inspect));
      div.appendChild(inspect);
      fireboardList.appendChild(div);
"""
if old_button not in text:
    raise SystemExit('Could not find FireBoard session button block.')
text = text.replace(old_button, new_button, 1)

old_mark = """      if (attached.has(String(button.dataset.fireboardSessionId))) {
        button.textContent = 'Attached to Current Cook';
        button.disabled = true;
      }
"""
new_mark = """      if (attached.has(String(button.dataset.fireboardSessionId))) {
        button.textContent = 'Attached to Current Cook';
        button.disabled = true;
        const inspect = button.parentElement?.querySelector(`button[data-fireboard-inspect-id=\"${button.dataset.fireboardSessionId}\"]`);
        if (inspect) inspect.disabled = false;
      }
"""
if old_mark not in text:
    raise SystemExit('Could not find existing association marker block.')
text = text.replace(old_mark, new_mark, 1)

old_success = """      button.textContent = 'Attached to Current Cook';
      button.disabled = true;
      setFireboardStatus(`FireBoard session attached to cook ${state.cookId} and verified in cloud.`, 'good');
"""
new_success = """      button.textContent = 'Attached to Current Cook';
      button.disabled = true;
      const inspect = button.parentElement?.querySelector(`button[data-fireboard-inspect-id=\"${String(fbSession.id)}\"]`);
      if (inspect) inspect.disabled = false;
      setFireboardStatus(`FireBoard session attached to cook ${state.cookId} and verified in cloud.`, 'good');
"""
if old_success not in text:
    raise SystemExit('Could not find attach success block.')
text = text.replace(old_success, new_success, 1)

marker = """  async function requestFireboardSessions(accessToken) {\n"""
helper = """  async function requestFireboardChartSummary(accessToken, sessionId) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/fireboard-sessions?session_id=${encodeURIComponent(String(sessionId))}`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) throw Object.assign(new Error('Session expired.'), { code: 401 });
    if (!response.ok) throw new Error(data.error || `FireBoard chart request failed (${response.status}).`);
    return data;
  }

  function formatChartTimestamp(value) {
    if (value === null || value === undefined || value === '') return 'unknown';
    const numeric = Number(value);
    const date = Number.isFinite(numeric)
      ? new Date(numeric > 100000000000 ? numeric : numeric * 1000)
      : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  async function inspectFireboardChart(fbSession, card, button) {
    let authSession = loadCloudSession();
    if (!authSession?.access_token) {
      setFireboardStatus('Sign in to LDCookLog Cloud before inspecting FireBoard temperature data.', 'warn');
      return;
    }
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Loading Temperature Data…';
    setFireboardStatus(`Reading temperature channels for ${fbSession.title || `FireBoard Session ${fbSession.id}`}…`);
    try {
      let data;
      try {
        data = await requestFireboardChartSummary(authSession.access_token, fbSession.id);
      } catch (err) {
        if (err.code !== 401) throw err;
        authSession = await refreshCloudSession(authSession);
        data = await requestFireboardChartSummary(authSession.access_token, fbSession.id);
      }
      let detail = card.querySelector('.fireboard-chart-summary');
      if (!detail) {
        detail = document.createElement('div');
        detail.className = 'fireboard-chart-summary';
        detail.style.cssText = 'margin-top:10px;padding:9px 10px;background:#101010;border:1px solid #333;border-radius:10px;font-size:12px';
        card.appendChild(detail);
      }
      const channels = Array.isArray(data.channels) ? data.channels : [];
      detail.innerHTML = '';
      const heading = document.createElement('strong');
      heading.textContent = `Temperature channels: ${channels.length}`;
      detail.appendChild(heading);
      if (!channels.length) {
        const empty = document.createElement('div');
        empty.className = 'sub';
        empty.style.marginTop = '5px';
        empty.textContent = 'No channel arrays were returned for this FireBoard session.';
        detail.appendChild(empty);
      }
      channels.forEach(channel => {
        const row = document.createElement('div');
        row.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid #2b2b2b';
        const min = channel.min_temperature == null ? '—' : Number(channel.min_temperature).toFixed(1);
        const max = channel.max_temperature == null ? '—' : Number(channel.max_temperature).toFixed(1);
        row.textContent = `${channel.label || `Channel ${(channel.index ?? 0) + 1}`}: ${channel.sample_count ?? 0} samples; ${min}–${max}°${channel.degree_type || ''}; ${formatChartTimestamp(channel.first_timestamp)} to ${formatChartTimestamp(channel.last_timestamp)}`;
        if (channel.device_uuid) {
          const device = document.createElement('div');
          device.className = 'sub';
          device.textContent = `Device: ${channel.device_uuid}`;
          row.appendChild(device);
        }
        detail.appendChild(row);
      });
      button.textContent = 'Temperature Data Loaded';
      button.disabled = false;
      setFireboardStatus(`Temperature data read successfully for ${fbSession.title || `FireBoard Session ${fbSession.id}`}. Nothing was imported into LDCookLog yet.`, 'good');
    } catch (err) {
      button.textContent = originalText;
      button.disabled = false;
      setFireboardStatus(`FireBoard temperature read failed: ${err.message}\nYour cook data is unaffected.`, 'bad');
    }
  }

"""
if marker not in text:
    raise SystemExit('Could not find FireBoard sessions request marker.')
text = text.replace(marker, helper + marker, 1)

text = text.replace(
    "V1.22.2 retrieves recent completed sessions, recognizes FireBoard sessions already attached to the current cook after reload, and keeps attachment retry-safe. Temperature samples are not imported yet.",
    "V1.22.3 can securely inspect read-only FireBoard temperature channel summaries for sessions attached to the current cook. Temperature samples are not imported yet.",
    1
)
text = text.replace("document.title = 'LDCookLog Mobile V1.22.2';", "document.title = 'LDCookLog Mobile V1.22.3';", 1)
text = text.replace("headerSub.textContent = 'V1.22.2 Stateful BBQ Control Panel';", "headerSub.textContent = 'V1.22.3 Stateful BBQ Control Panel';", 1)
text = text.replace(
    "V1.22.2 adds persistent FireBoard association recognition after reload while preserving retry-safe attachment and cloud verification. Temperature samples are not imported yet.<br><strong>Build 2026-09-13I</strong>",
    "V1.22.3 adds secure read-only FireBoard temperature-channel inspection for attached sessions. No temperature samples are written to the database yet.<br><strong>Build 2026-09-13J</strong>",
    1
)
path.write_text(text)

sw = Path('service-worker.js')
sw_text = sw.read_text()
old_cache = "const CACHE_NAME = 'ldcooklog-v1-22-2';"
new_cache = "const CACHE_NAME = 'ldcooklog-v1-22-3';"
if old_cache not in sw_text:
    raise SystemExit('Could not find V1.22.2 service worker cache name.')
sw.write_text(sw_text.replace(old_cache, new_cache, 1))
