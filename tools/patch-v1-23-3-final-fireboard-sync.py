from pathlib import Path

index = Path('index.html')
text = index.read_text()

old = """      const active = Array.isArray(data.active_sessions) ? data.active_sessions : [];
      if (!active.length) {
        setFireboardStatus('LDCookLog is active. Waiting for an active FireBoard session…');
        return;
      }
      if (active.length > 1) {
        setFireboardStatus(`More than one active FireBoard session was found (${active.length}). Automatic linking is paused rather than guessing.`, 'warn');
        return;
      }

      const fbSession = active[0];
"""
new = """      const active = Array.isArray(data.active_sessions) ? data.active_sessions : [];
      if (active.length > 1) {
        setFireboardStatus(`More than one active FireBoard session was found (${active.length}). Automatic linking is paused rather than guessing.`, 'warn');
        return;
      }

      let fbSession = active.length === 1 ? active[0] : null;
      // Finish Cook should still capture the last samples even if FireBoard stops
      // reporting the session as active between the button press and this final sync.
      if (!fbSession && forceFinal && liveFireboardSession) fbSession = liveFireboardSession;
      if (!fbSession) {
        setFireboardStatus('LDCookLog is active. Waiting for an active FireBoard session…');
        return;
      }
"""
if old not in text:
    raise SystemExit('Missing expected active-session selection block')
text = text.replace(old, new, 1)

old_status = """      setFireboardStatus(`Active FireBoard session ${fbSession.title || fbSession.id} is linked to cook ${state.cookId}. Live temperatures are being stored automatically.`, 'good');
"""
new_status = """      setFireboardStatus(forceFinal
        ? `Final FireBoard sync complete for cook ${state.cookId}. The latest available temperatures were stored.`
        : `Active FireBoard session ${fbSession.title || fbSession.id} is linked to cook ${state.cookId}. Live temperatures are being stored automatically.`, 'good');
"""
if old_status not in text:
    raise SystemExit('Missing expected live FireBoard success status')
text = text.replace(old_status, new_status, 1)

replacements = {
    "LDCookLog Mobile V1.23.2": "LDCookLog Mobile V1.23.3",
    "V1.23.2 Stateful BBQ Control Panel": "V1.23.3 Stateful BBQ Control Panel",
    "V1.23.2 improves active FireBoard detection using real-time device temperatures and refreshes once per minute to stay within FireBoard API limits. Historical analysis remains paused while we collect clean cook data.<br><strong>Build 2026-09-13R</strong>": "V1.23.3 makes Finish Cook more reliable by completing a final FireBoard sample import even if the session stops appearing active at that moment. Historical analysis remains paused while we collect clean cook data.<br><strong>Build 2026-09-13S</strong>",
}
for old_text, new_text in replacements.items():
    if old_text not in text:
        raise SystemExit(f'Missing expected text: {old_text}')
    text = text.replace(old_text, new_text, 1)

index.write_text(text)

sw = Path('service-worker.js')
sw_text = sw.read_text()
old_cache = "const CACHE_NAME = 'ldcooklog-v1-23-2';"
new_cache = "const CACHE_NAME = 'ldcooklog-v1-23-3';"
if old_cache not in sw_text:
    raise SystemExit('Missing expected V1.23.2 cache name')
sw.write_text(sw_text.replace(old_cache, new_cache, 1))
