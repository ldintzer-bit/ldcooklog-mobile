from pathlib import Path

index_path = Path('index.html')
text = index_path.read_text()

replacements = [
    (
        "    return rows.length;\n  }\n\n  function renderLiveFireboardHeading",
        "    return { newCount: rows.length, channels };\n  }\n\n  function renderLiveFireboardHeading"
    ),
    (
        "    diagnosticsNote.textContent = 'Raw identity only — device UUID, FireBoard channel, and FireBoard source label. LDCookLog cook roles have not been assigned yet.';",
        "    diagnosticsNote.textContent = 'Stored identity only — device UUID, LDCookLog series index, and FireBoard source label. The series index is not a physical FireBoard port number.';"
    ),
    (
        "      row.textContent = `Device UUID: ${group.deviceUuid || 'not reported'} • Channel index: ${group.channel} (display channel ${group.channel + 1}) • FireBoard label: ${group.label}`;",
        "      row.textContent = `Device UUID: ${group.deviceUuid || 'not reported'} • Stored series index: ${group.channel} • FireBoard label: ${group.label}`;"
    ),
    (
        "  async function syncActiveFireboard(forceFinal = false) {",
        "  function renderFireboardRawMetadata(container, channels) {\n    container.querySelector('.fireboard-raw-metadata')?.remove();\n    const box = document.createElement('div');\n    box.className = 'fireboard-raw-metadata';\n    box.style.cssText = 'margin-top:10px;padding:9px 10px;background:#171717;border:1px solid #555;border-radius:10px;font-size:12px';\n    const title = document.createElement('strong');\n    title.textContent = 'FireBoard raw chart metadata (diagnostic)';\n    box.appendChild(title);\n    const note = document.createElement('div');\n    note.className = 'sub';\n    note.style.marginTop = '4px';\n    note.textContent = 'These are the non-temperature fields FireBoard actually returned for each chart series. This is the section we need for the current probe-identity test.';\n    box.appendChild(note);\n    (Array.isArray(channels) ? channels : []).forEach(channel => {\n      const row = document.createElement('div');\n      row.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid #333;overflow-wrap:anywhere';\n      const meta = channel.raw_metadata && typeof channel.raw_metadata === 'object' ? channel.raw_metadata : {};\n      const keys = Array.isArray(channel.raw_keys) ? channel.raw_keys.join(', ') : '';\n      row.textContent = `Series ${Number(channel.series_index ?? channel.index ?? 0) + 1} • Device UUID: ${channel.device_uuid || 'not reported'} • Label: ${channel.label || 'not reported'} • Raw fields: ${JSON.stringify(meta)}${keys ? ` • Keys: ${keys}` : ''}`;\n      box.appendChild(row);\n    });\n    container.appendChild(box);\n  }\n\n  async function syncActiveFireboard(forceFinal = false) {"
    ),
    (
        "      const newCount = await importLiveFireboardSamples(accessToken, fbSession, association.id);\n      const rows = await readFireboardTemperatureSamples(accessToken, association.id);\n      const graphHost = renderLiveFireboardHeading(fbSession, rows.length, newCount);\n      renderFireboardTemperatureGraph(graphHost, fbSession, rows);\n      graphHost.querySelector('.fireboard-analysis')?.remove();",
        "      const liveImport = await importLiveFireboardSamples(accessToken, fbSession, association.id);\n      const newCount = liveImport.newCount;\n      const rows = await readFireboardTemperatureSamples(accessToken, association.id);\n      const graphHost = renderLiveFireboardHeading(fbSession, rows.length, newCount);\n      renderFireboardTemperatureGraph(graphHost, fbSession, rows);\n      graphHost.querySelector('.fireboard-analysis')?.remove();\n      renderFireboardRawMetadata(graphHost, liveImport.channels);"
    ),
    (
        "  document.title = 'LDCookLog Mobile V1.23.4';",
        "  document.title = 'LDCookLog Mobile V1.23.5';"
    ),
    (
        "  if (headerSub) headerSub.textContent = 'V1.23.4 Stateful BBQ Control Panel';",
        "  if (headerSub) headerSub.textContent = 'V1.23.5 Stateful BBQ Control Panel';"
    ),
    (
        "  if (footer) footer.innerHTML = 'V1.23.4 adds temporary FireBoard sensor-identity diagnostics so we can verify device UUID, channel mapping, and source labels before assigning permanent cook roles. Live and final FireBoard syncing remain unchanged.<br><strong>Build 2026-09-14A</strong>';",
        "  if (footer) footer.innerHTML = 'V1.23.5 exposes the raw non-temperature metadata FireBoard returns for each chart series so physical wired ports and Pulse sensor streams can be identified without guessing. Live and final FireBoard syncing remain unchanged.<br><strong>Build 2026-09-14B</strong>';"
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one match, found {count}: {old[:120]}')
    text = text.replace(old, new, 1)

index_path.write_text(text)

sw_path = Path('service-worker.js')
sw = sw_path.read_text()
old_cache = "const CACHE_NAME = 'ldcooklog-v1-23-4';"
new_cache = "const CACHE_NAME = 'ldcooklog-v1-23-5';"
if sw.count(old_cache) != 1:
    raise SystemExit(f'Expected one service-worker cache match, found {sw.count(old_cache)}')
sw_path.write_text(sw.replace(old_cache, new_cache, 1))

print('V1.23.5 raw FireBoard metadata patch applied successfully.')
