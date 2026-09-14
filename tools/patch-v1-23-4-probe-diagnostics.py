from pathlib import Path

index_path = Path('index.html')
text = index_path.read_text()

replacements = [
    (
        "select: 'channel_index,channel_label,observed_at,temperature_value,degree_type',",
        "select: 'channel_index,device_uuid,channel_label,observed_at,temperature_value,degree_type',"
    ),
    (
        "      channel: Number(row.channel_index) || 0,\n      label: row.channel_label || `Channel ${(Number(row.channel_index) || 0) + 1}`,\n      time: Date.parse(row.observed_at),",
        "      channel: Number(row.channel_index) || 0,\n      deviceUuid: row.device_uuid || null,\n      label: row.channel_label || `Channel ${(Number(row.channel_index) || 0) + 1}`,\n      time: Date.parse(row.observed_at),"
    ),
    (
        "    parsed.forEach(row => {\n      if (!groups.has(row.channel)) groups.set(row.channel, { label: row.label, degree: row.degree, points: [] });\n      groups.get(row.channel).points.push(row);\n    });",
        "    parsed.forEach(row => {\n      const sensorKey = `${row.deviceUuid || 'unknown-device'}::${row.channel}`;\n      if (!groups.has(sensorKey)) groups.set(sensorKey, { channel: row.channel, deviceUuid: row.deviceUuid, label: row.label, degree: row.degree, points: [] });\n      groups.get(sensorKey).points.push(row);\n    });"
    ),
    (
        "    [...groups.entries()].sort((a, b) => a[0] - b[0]).forEach(([channel, group], index) => {",
        "    [...groups.entries()].sort((a, b) => (a[1].channel - b[1].channel) || String(a[1].deviceUuid || '').localeCompare(String(b[1].deviceUuid || ''))).forEach(([sensorKey, group], index) => {"
    ),
    (
        "    [...groups.entries()].sort((a, b) => a[0] - b[0]).forEach(([channel, group], index) => {\n      const item = document.createElement('span');",
        "    [...groups.entries()].sort((a, b) => (a[1].channel - b[1].channel) || String(a[1].deviceUuid || '').localeCompare(String(b[1].deviceUuid || ''))).forEach(([sensorKey, group], index) => {\n      const item = document.createElement('span');"
    ),
    (
        "    wrap.appendChild(legend);\n\n    // V1.22.7: first-pass FireBoard analysis",
        "    wrap.appendChild(legend);\n\n    const diagnostics = document.createElement('div');\n    diagnostics.className = 'fireboard-sensor-diagnostics';\n    diagnostics.style.cssText = 'margin-top:10px;padding:9px 10px;background:#171717;border:1px solid #333;border-radius:10px;font-size:12px';\n    const diagnosticsTitle = document.createElement('strong');\n    diagnosticsTitle.textContent = 'FireBoard sensor identity (diagnostic)';\n    diagnostics.appendChild(diagnosticsTitle);\n    const diagnosticsNote = document.createElement('div');\n    diagnosticsNote.className = 'sub';\n    diagnosticsNote.style.marginTop = '4px';\n    diagnosticsNote.textContent = 'Raw identity only — device UUID, FireBoard channel, and FireBoard source label. LDCookLog cook roles have not been assigned yet.';\n    diagnostics.appendChild(diagnosticsNote);\n    [...groups.values()].sort((a, b) => (a.channel - b.channel) || String(a.deviceUuid || '').localeCompare(String(b.deviceUuid || ''))).forEach(group => {\n      const row = document.createElement('div');\n      row.style.cssText = 'margin-top:7px;padding-top:7px;border-top:1px solid #2b2b2b;overflow-wrap:anywhere';\n      row.textContent = `Device UUID: ${group.deviceUuid || 'not reported'} • Channel index: ${group.channel} (display channel ${group.channel + 1}) • FireBoard label: ${group.label}`;\n      diagnostics.appendChild(row);\n    });\n    wrap.appendChild(diagnostics);\n\n    // V1.22.7: first-pass FireBoard analysis"
    ),
    (
        "    const sortedGroups = [...groups.entries()].sort((a, b) => a[0] - b[0]);\n    const channelStats = sortedGroups.map(([channel, group]) => {",
        "    const sortedGroups = [...groups.entries()].sort((a, b) => (a[1].channel - b[1].channel) || String(a[1].deviceUuid || '').localeCompare(String(b[1].deviceUuid || '')));\n    const channelStats = sortedGroups.map(([sensorKey, group]) => {\n      const channel = group.channel;"
    ),
    (
        "      return { channel, group, points, temps, avg, avgAbsTargetError };",
        "      return { sensorKey, channel, group, points, temps, avg, avgAbsTargetError };"
    ),
    (
        "      const likelyText = likelyPit && stat.channel === likelyPit.channel ? ' — likely pit/chamber' : '';",
        "      const likelyText = likelyPit && stat.sensorKey === likelyPit.sensorKey ? ' — likely pit/chamber' : '';"
    ),
    (
        "      select: 'channel_index,observed_at',",
        "      select: 'channel_index,device_uuid,observed_at',"
    ),
    (
        "      const key = Number(row.channel_index) || 0;",
        "      const channelIndex = Number(row.channel_index) || 0;\n      const key = `${row.device_uuid || 'unknown-device'}::${channelIndex}`;"
    ),
    (
        "      const latest = latestByChannel.get(channelIndex) ?? -Infinity;",
        "      const sensorKey = `${channel.device_uuid || 'unknown-device'}::${channelIndex}`;\n      const latest = latestByChannel.get(sensorKey) ?? -Infinity;"
    ),
    (
        "  document.title = 'LDCookLog Mobile V1.23.3';",
        "  document.title = 'LDCookLog Mobile V1.23.4';"
    ),
    (
        "  if (headerSub) headerSub.textContent = 'V1.23.3 Stateful BBQ Control Panel';",
        "  if (headerSub) headerSub.textContent = 'V1.23.4 Stateful BBQ Control Panel';"
    ),
    (
        "  if (footer) footer.innerHTML = 'V1.23.3 makes Finish Cook more reliable by completing a final FireBoard sample import even if the session stops appearing active at that moment. Historical analysis remains paused while we collect clean cook data.<br><strong>Build 2026-09-13S</strong>';",
        "  if (footer) footer.innerHTML = 'V1.23.4 adds temporary FireBoard sensor-identity diagnostics so we can verify device UUID, channel mapping, and source labels before assigning permanent cook roles. Live and final FireBoard syncing remain unchanged.<br><strong>Build 2026-09-14A</strong>';"
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one match, found {count}: {old[:100]}')
    text = text.replace(old, new, 1)

index_path.write_text(text)

sw_path = Path('service-worker.js')
sw = sw_path.read_text()
old_cache = "const CACHE_NAME = 'ldcooklog-v1-23-3';"
new_cache = "const CACHE_NAME = 'ldcooklog-v1-23-4';"
if sw.count(old_cache) != 1:
    raise SystemExit(f'Expected one service-worker cache match, found {sw.count(old_cache)}')
sw_path.write_text(sw.replace(old_cache, new_cache, 1))

print('V1.23.4 probe diagnostics patch applied successfully.')
