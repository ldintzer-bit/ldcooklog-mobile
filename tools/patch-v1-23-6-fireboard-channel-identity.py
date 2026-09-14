from pathlib import Path

index_path = Path('index.html')
text = index_path.read_text()

replacements = [
    (
        "fireboard_temperature_samples?on_conflict=cook_fireboard_session_id,channel_index,observed_at",
        "fireboard_temperature_samples?on_conflict=cook_fireboard_session_id,device_uuid,channel_index,observed_at"
    ),
    (
        "channel_index: Number(channel.index) || 0,",
        "channel_index: Number(channel.channel_id),"
    ),
    (
        "const channelIndex = Number(channel.index) || 0;",
        "const channelIndex = Number(channel.channel_id);\n      if (!Number.isFinite(channelIndex)) return;"
    ),
    (
        "    return { newCount: rows.length, channels };",
        "    return rows.length;"
    ),
    (
        "    diagnosticsNote.textContent = 'Stored identity only — device UUID, LDCookLog series index, and FireBoard source label. The series index is not a physical FireBoard port number.';",
        "    diagnosticsNote.textContent = 'Permanent sensor identity uses FireBoard device UUID + actual FireBoard channel ID. LDCookLog cook roles have not been assigned yet.';"
    ),
    (
        "      row.textContent = `Device UUID: ${group.deviceUuid || 'not reported'} • Stored series index: ${group.channel} • FireBoard label: ${group.label}`;",
        "      row.textContent = `Device UUID: ${group.deviceUuid || 'not reported'} • FireBoard channel ID: ${group.channel} • FireBoard label: ${group.label}`;"
    ),
    (
        "      const liveImport = await importLiveFireboardSamples(accessToken, fbSession, association.id);\n      const newCount = liveImport.newCount;",
        "      const newCount = await importLiveFireboardSamples(accessToken, fbSession, association.id);"
    ),
    (
        "      graphHost.querySelector('.fireboard-analysis')?.remove();\n      renderFireboardRawMetadata(graphHost, liveImport.channels);",
        "      graphHost.querySelector('.fireboard-analysis')?.remove();"
    ),
    (
        "  document.title = 'LDCookLog Mobile V1.23.5';",
        "  document.title = 'LDCookLog Mobile V1.23.6';"
    ),
    (
        "  if (headerSub) headerSub.textContent = 'V1.23.5 Stateful BBQ Control Panel';",
        "  if (headerSub) headerSub.textContent = 'V1.23.6 Stateful BBQ Control Panel';"
    ),
    (
        "  if (footer) footer.innerHTML = 'V1.23.5 exposes the raw non-temperature metadata FireBoard returns for each chart series so physical wired ports and Pulse sensor streams can be identified without guessing. Live and final FireBoard syncing remain unchanged.<br><strong>Build 2026-09-14B</strong>';",
        "  if (footer) footer.innerHTML = 'V1.23.6 uses FireBoard device UUID + actual FireBoard channel ID as the permanent sensor identity, preventing Pulse and wired probe streams from being confused when chart order changes.<br><strong>Build 2026-09-14C</strong>';"
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one match, found {count}: {old[:120]}')
    text = text.replace(old, new, 1)

# Remove the temporary raw-metadata diagnostic function now that channel_id is proven.
start = text.find("  function renderFireboardRawMetadata(container, channels) {")
end = text.find("\n  async function syncActiveFireboard(forceFinal = false) {", start)
if start == -1 or end == -1:
    raise SystemExit('Could not locate temporary raw metadata diagnostic function.')
text = text[:start] + text[end + 1:]

# The historical/manual import path must reject any FireBoard series that lacks channel_id.
needle = "      channels.forEach(channel => {\n        const samples = Array.isArray(channel.samples) ? channel.samples : [];"
replacement = "      channels.forEach(channel => {\n        const channelId = Number(channel.channel_id);\n        if (!Number.isFinite(channelId)) return;\n        const samples = Array.isArray(channel.samples) ? channel.samples : [];"
if text.count(needle) != 1:
    raise SystemExit(f'Expected one manual import loop match, found {text.count(needle)}')
text = text.replace(needle, replacement, 1)
text = text.replace("channel_index: Number(channel.channel_id),", "channel_index: channelId,", 1)

index_path.write_text(text)

sw_path = Path('service-worker.js')
sw = sw_path.read_text()
old_cache = "const CACHE_NAME = 'ldcooklog-v1-23-5';"
new_cache = "const CACHE_NAME = 'ldcooklog-v1-23-6';"
if sw.count(old_cache) != 1:
    raise SystemExit(f'Expected one service-worker cache match, found {sw.count(old_cache)}')
sw_path.write_text(sw.replace(old_cache, new_cache, 1))

print('V1.23.6 FireBoard channel identity patch applied successfully.')
