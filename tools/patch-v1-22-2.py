from pathlib import Path

path = Path('index.html')
text = path.read_text()

old_button = """      const attach = document.createElement('button');
      attach.className = 'secondary';
      attach.textContent = 'Attach to Current Cook';
      attach.style.marginTop = '8px';
      attach.addEventListener('click', () => attachFireboardSession(session, attach));
      div.appendChild(attach);
"""
new_button = """      const attach = document.createElement('button');
      attach.className = 'secondary';
      attach.textContent = 'Attach to Current Cook';
      attach.style.marginTop = '8px';
      attach.dataset.fireboardSessionId = String(session.id);
      attach.addEventListener('click', () => attachFireboardSession(session, attach));
      div.appendChild(attach);
"""
if old_button not in text:
    raise SystemExit('Could not find FireBoard attach button block.')
text = text.replace(old_button, new_button, 1)

marker = """  async function writeFireboardAssociation(accessToken, fbSession) {\n"""
helper = """  async function readFireboardAssociationIds(accessToken) {
    if (!state.cloudCookUuid) return [];
    const cook = encodeURIComponent(state.cloudCookUuid);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cook_fireboard_sessions?select=fireboard_session_id&cook_id=eq.${cook}`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });
    const data = await response.json().catch(() => []);
    if (response.status === 401) throw Object.assign(new Error('Session expired.'), { code: 401 });
    if (!response.ok) throw new Error((data && (data.message || data.hint || data.details)) || `Association list read failed (${response.status}).`);
    return Array.isArray(data) ? data.map(row => String(row.fireboard_session_id)) : [];
  }

  function markExistingFireboardAssociations(sessionIds) {
    const attached = new Set((sessionIds || []).map(String));
    fireboardList.querySelectorAll('button[data-fireboard-session-id]').forEach(button => {
      if (attached.has(String(button.dataset.fireboardSessionId))) {
        button.textContent = 'Attached to Current Cook';
        button.disabled = true;
      }
    });
  }

"""
if marker not in text:
    raise SystemExit('Could not find FireBoard write function marker.')
text = text.replace(marker, helper + marker, 1)

old_load = """      const sessions = Array.isArray(data.sessions) ? data.sessions : [];
      renderFireboardSessions(sessions);
      setFireboardStatus(`FireBoard connected. ${sessions.length} recent completed session${sessions.length === 1 ? '' : 's'} loaded.`, 'good');
"""
new_load = """      const sessions = Array.isArray(data.sessions) ? data.sessions : [];
      renderFireboardSessions(sessions);
      let attachedIds = [];
      if (state.cloudCookUuid) {
        try {
          attachedIds = await readFireboardAssociationIds(session.access_token);
        } catch (err) {
          if (err.code !== 401) throw err;
          session = await refreshCloudSession(session);
          attachedIds = await readFireboardAssociationIds(session.access_token);
        }
        markExistingFireboardAssociations(attachedIds);
      }
      const attachedCount = sessions.filter(row => attachedIds.includes(String(row.id))).length;
      const suffix = state.cloudCookUuid ? ` ${attachedCount} already attached to cook ${state.cookId}.` : '';
      setFireboardStatus(`FireBoard connected. ${sessions.length} recent completed session${sessions.length === 1 ? '' : 's'} loaded.${suffix}`, 'good');
"""
if old_load not in text:
    raise SystemExit('Could not find FireBoard load/render block.')
text = text.replace(old_load, new_load, 1)

text = text.replace(
    "V1.22.1 retrieves up to 10 recent completed sessions through the secure Supabase Edge Function and can attach a session to the current LDCookLog cook. Temperature samples are not imported yet.",
    "V1.22.2 retrieves recent completed sessions, recognizes FireBoard sessions already attached to the current cook after reload, and keeps attachment retry-safe. Temperature samples are not imported yet.",
    1
)
text = text.replace("document.title = 'LDCookLog Mobile V1.22.1';", "document.title = 'LDCookLog Mobile V1.22.2';", 1)
text = text.replace("headerSub.textContent = 'V1.22.1 Stateful BBQ Control Panel';", "headerSub.textContent = 'V1.22.2 Stateful BBQ Control Panel';", 1)
text = text.replace(
    "V1.22.1 adds retry-safe FireBoard session attachment to the current cook with cloud read-back verification. Temperature samples are not imported yet.<br><strong>Build 2026-09-13H</strong>",
    "V1.22.2 adds persistent FireBoard association recognition after reload while preserving retry-safe attachment and cloud verification. Temperature samples are not imported yet.<br><strong>Build 2026-09-13I</strong>",
    1
)
path.write_text(text)

sw = Path('service-worker.js')
sw_text = sw.read_text()
old_cache = "const CACHE_NAME = 'ldcooklog-v1-22-1';"
new_cache = "const CACHE_NAME = 'ldcooklog-v1-22-2';"
if old_cache not in sw_text:
    raise SystemExit('Could not find V1.22.1 service worker cache name.')
sw.write_text(sw_text.replace(old_cache, new_cache, 1))
