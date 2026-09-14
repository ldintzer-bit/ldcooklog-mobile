from pathlib import Path

index_path = Path('index.html')
text = index_path.read_text()

# Add a cook-start cutoff helper and a cleanup helper before live FireBoard sample bookkeeping.
needle = "  async function readLatestFireboardSampleTimes(accessToken, associationId) {"
insert = """  function fireboardCookStartCutoffMs() {
    const raw = state.start;
    const startMs = Number.isFinite(Number(raw)) ? Number(raw) : Date.parse(String(raw || ''));
    if (!Number.isFinite(startMs)) return -Infinity;
    // Keep a small grace window so polling/clock timing cannot discard the first legitimate reading.
    return startMs - (2 * 60 * 1000);
  }

  async function purgeFireboardSamplesBeforeCookStart(accessToken, associationId) {
    const cutoffMs = fireboardCookStartCutoffMs();
    if (!Number.isFinite(cutoffMs)) return 0;
    const cutoffIso = new Date(cutoffMs).toISOString();
    const query = new URLSearchParams({
      cook_fireboard_session_id: `eq.${associationId}`,
      observed_at: `lt.${cutoffIso}`
    });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/fireboard_temperature_samples?${query}`, {
      method: 'DELETE',
      headers: {
        ...fireboardCloudHeaders(accessToken),
        Prefer: 'return=representation'
      }
    });
    const rows = await response.json().catch(() => []);
    if (response.status === 401) throw Object.assign(new Error('Session expired.'), { code: 401 });
    if (!response.ok) throw new Error(rows?.message || `Could not apply FireBoard cook-start protection (${response.status}).`);
    return Array.isArray(rows) ? rows.length : 0;
  }

  async function readLatestFireboardSampleTimes(accessToken, associationId) {"""
if text.count(needle) != 1:
    raise SystemExit(f'Expected one readLatestFireboardSampleTimes match, found {text.count(needle)}')
text = text.replace(needle, insert, 1)

# Manual/import path: skip samples older than this cook's own start boundary.
needle = """          rows.push({
            cook_fireboard_session_id: association.id,
            channel_index: channelId,
            device_uuid: channel.device_uuid || null,
            channel_label: channel.label || null,
            observed_at: fireboardTimestampToIso(sample.observed_at),
            temperature_value: temperature,
            degree_type: channel.degree_type == null ? null : String(channel.degree_type)
          });"""
replacement = """          const observedIso = fireboardTimestampToIso(sample.observed_at);
          if (Date.parse(observedIso) < fireboardCookStartCutoffMs()) return;
          rows.push({
            cook_fireboard_session_id: association.id,
            channel_index: channelId,
            device_uuid: channel.device_uuid || null,
            channel_label: channel.label || null,
            observed_at: observedIso,
            temperature_value: temperature,
            degree_type: channel.degree_type == null ? null : String(channel.degree_type)
          });"""
if text.count(needle) != 1:
    raise SystemExit(f'Expected one manual FireBoard sample push match, found {text.count(needle)}')
text = text.replace(needle, replacement, 1)

# Live path: skip samples older than this cook's own start boundary.
needle = """        const observedIso = fireboardTimestampToIso(sample.observed_at);
        if (Date.parse(observedIso) <= latest) return;"""
replacement = """        const observedIso = fireboardTimestampToIso(sample.observed_at);
        const observedMs = Date.parse(observedIso);
        if (observedMs < fireboardCookStartCutoffMs()) return;
        if (observedMs <= latest) return;"""
if text.count(needle) != 1:
    raise SystemExit(f'Expected one live FireBoard cutoff insertion match, found {text.count(needle)}')
text = text.replace(needle, replacement, 1)

# Clean up any already-imported pre-cook readings before every live/final sync.
needle = """      const association = await getFireboardAssociation(accessToken, fbSession.id);
      if (!association?.id) throw new Error('Active FireBoard session could not be linked to this cook.');
      const newCount = await importLiveFireboardSamples(accessToken, fbSession, association.id);"""
replacement = """      const association = await getFireboardAssociation(accessToken, fbSession.id);
      if (!association?.id) throw new Error('Active FireBoard session could not be linked to this cook.');
      await purgeFireboardSamplesBeforeCookStart(accessToken, association.id);
      const newCount = await importLiveFireboardSamples(accessToken, fbSession, association.id);"""
if text.count(needle) != 1:
    raise SystemExit(f'Expected one active FireBoard association sync match, found {text.count(needle)}')
text = text.replace(needle, replacement, 1)

# Clean pre-cook readings before a manual import as well, so re-import can repair an existing cook.
needle = """      if (!association?.id) throw new Error('This FireBoard session is not attached to the current cook in cloud storage.');

      const rows = [];"""
replacement = """      if (!association?.id) throw new Error('This FireBoard session is not attached to the current cook in cloud storage.');
      await purgeFireboardSamplesBeforeCookStart(authSession.access_token, association.id);

      const rows = [];"""
if text.count(needle) != 1:
    raise SystemExit(f'Expected one manual FireBoard association match, found {text.count(needle)}')
text = text.replace(needle, replacement, 1)

replacements = [
    ("  document.title = 'LDCookLog Mobile V1.23.6';", "  document.title = 'LDCookLog Mobile V1.23.7';"),
    ("  if (headerSub) headerSub.textContent = 'V1.23.6 Stateful BBQ Control Panel';", "  if (headerSub) headerSub.textContent = 'V1.23.7 Stateful BBQ Control Panel';"),
    ("  if (footer) footer.innerHTML = 'V1.23.6 uses FireBoard device UUID + actual FireBoard channel ID as the permanent sensor identity, preventing Pulse and wired probe streams from being confused when chart order changes.<br><strong>Build 2026-09-14C</strong>';", "  if (footer) footer.innerHTML = 'V1.23.7 adds a FireBoard cook-start guard: only readings from the current LDCookLog cook window are retained, with a two-minute grace period for polling and clock timing. Older readings from a still-running FireBoard session are automatically removed from this cook.<br><strong>Build 2026-09-14D</strong>';"),
]
for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one version/footer match, found {count}: {old[:120]}')
    text = text.replace(old, new, 1)

index_path.write_text(text)

sw_path = Path('service-worker.js')
sw = sw_path.read_text()
old_cache = "const CACHE_NAME = 'ldcooklog-v1-23-6';"
new_cache = "const CACHE_NAME = 'ldcooklog-v1-23-7';"
if sw.count(old_cache) != 1:
    raise SystemExit(f'Expected one service-worker cache match, found {sw.count(old_cache)}')
sw_path.write_text(sw.replace(old_cache, new_cache, 1))

print('V1.23.7 FireBoard cook-start guard patch applied successfully.')
