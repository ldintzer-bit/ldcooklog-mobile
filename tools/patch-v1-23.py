from pathlib import Path

index_path = Path('index.html')
sw_path = Path('service-worker.js')
text = index_path.read_text()

old_sub = "    <div class=\"sub\" style=\"margin-top:10px\">V1.22.6 adds a responsive temperature graph built from imported FireBoard samples stored in Supabase. The graph reads cloud data only and does not call FireBoard again.</div>`;"
new_sub = "    <div class=\"sub\" style=\"margin-top:10px\">V1.23 automatically compares recent completed FireBoard sessions with the current cook time window, recommends the best match, and offers a single Connect &amp; Import action. Nothing is attached without your confirmation.</div>`;"
if old_sub not in text:
    raise SystemExit('FireBoard card description anchor not found')
text = text.replace(old_sub, new_sub, 1)

anchor = "  function renderFireboardSessions(sessions) {\n"
insert = r'''  function fireboardSessionMatchScore(session) {
    if (!state.start) return null;
    const cookStart = Number(state.start);
    const cookEnd = Number(state.finishTime) || Date.now();
    const sessionStart = Date.parse(session.start_time);
    const sessionEnd = Date.parse(session.end_time);
    if (![cookStart, cookEnd, sessionStart, sessionEnd].every(Number.isFinite)) return null;

    const overlap = Math.max(0, Math.min(cookEnd, sessionEnd) - Math.max(cookStart, sessionStart));
    const cookDuration = Math.max(1, cookEnd - cookStart);
    const sessionDuration = Math.max(1, sessionEnd - sessionStart);
    const overlapRatio = overlap / Math.min(cookDuration, sessionDuration);
    const startGap = Math.abs(sessionStart - cookStart);
    const endGap = Math.abs(sessionEnd - cookEnd);

    // Prefer meaningful time overlap, then similar start/end times.
    const score = (overlapRatio * 100) - (startGap / 3600000) - (endGap / 7200000);
    return { score, overlap, overlapRatio, startGap, endGap };
  }

  function findRecommendedFireboardSession(sessions) {
    if (!state.start || !Array.isArray(sessions) || !sessions.length) return null;
    const ranked = sessions
      .map(session => ({ session, match: fireboardSessionMatchScore(session) }))
      .filter(row => row.match && row.match.overlap > 0)
      .sort((a, b) => b.match.score - a.match.score);
    if (!ranked.length) return null;
    const best = ranked[0];
    // Require at least 25% overlap with the shorter of the cook/session windows.
    return best.match.overlapRatio >= 0.25 ? best : null;
  }

  async function connectAndImportFireboardSession(fbSession, connectButton) {
    const card = connectButton.parentElement;
    const attachButton = card?.querySelector(`button[data-fireboard-session-id="${String(fbSession.id)}"]`);
    const importButton = card?.querySelector(`button[data-fireboard-import-id="${String(fbSession.id)}"]`);
    if (!attachButton || !importButton) return;

    const originalText = connectButton.textContent;
    connectButton.disabled = true;
    connectButton.textContent = 'Connecting…';
    await attachFireboardSession(fbSession, attachButton);
    if (attachButton.textContent !== 'Attached to Current Cook') {
      connectButton.textContent = originalText;
      connectButton.disabled = false;
      return;
    }

    connectButton.textContent = 'Importing…';
    await importFireboardTemperatureData(fbSession, importButton);
    const imported = importButton.textContent.startsWith('Temperature Data Imported');
    connectButton.textContent = imported ? 'Connected & Imported' : originalText;
    connectButton.disabled = imported;
  }

'''
if anchor not in text:
    raise SystemExit('renderFireboardSessions anchor not found')
text = text.replace(anchor, insert + anchor, 1)

old_render_end = "      div.appendChild(graphButton);\n      fireboardList.appendChild(div);\n    });\n  }\n"
new_render_end = "      div.appendChild(graphButton);\n      fireboardList.appendChild(div);\n    });\n\n    const recommended = findRecommendedFireboardSession(sessions);\n    if (recommended) {\n      const recommendedId = String(recommended.session.id);\n      const attachButton = fireboardList.querySelector(`button[data-fireboard-session-id=\"${recommendedId}\"]`);\n      const card = attachButton?.parentElement;\n      if (card) {\n        card.style.borderColor = '#f2a13a';\n        const badge = document.createElement('div');\n        badge.className = 'sub';\n        badge.style.cssText = 'margin-top:6px;color:#f2a13a;font-weight:700';\n        const pct = Math.round(recommended.match.overlapRatio * 100);\n        badge.textContent = `Recommended match — ${pct}% time-window overlap with cook ${state.cookId || ''}`.trim();\n        card.insertBefore(badge, attachButton);\n\n        const connectButton = document.createElement('button');\n        connectButton.className = 'good';\n        connectButton.textContent = 'Connect & Import';\n        connectButton.style.marginTop = '8px';\n        connectButton.dataset.fireboardConnectId = recommendedId;\n        connectButton.addEventListener('click', () => connectAndImportFireboardSession(recommended.session, connectButton));\n        card.insertBefore(connectButton, attachButton);\n      }\n    }\n  }\n"
if old_render_end not in text:
    raise SystemExit('render end anchor not found')
text = text.replace(old_render_end, new_render_end, 1)

old_status = "      const attachedCount = sessions.filter(row => attachedIds.includes(String(row.id))).length;\n      const suffix = state.cloudCookUuid ? ` ${attachedCount} already attached to cook ${state.cookId}.` : '';\n      setFireboardStatus(`FireBoard connected. ${sessions.length} recent completed session${sessions.length === 1 ? '' : 's'} loaded.${suffix}`, 'good');"
new_status = "      const attachedCount = sessions.filter(row => attachedIds.includes(String(row.id))).length;\n      const recommended = findRecommendedFireboardSession(sessions);\n      const suffix = state.cloudCookUuid ? ` ${attachedCount} already attached to cook ${state.cookId}.` : '';\n      const recommendation = recommended ? ` Recommended match: ${recommended.session.title || `FireBoard Session ${recommended.session.id}`}.` : '';\n      setFireboardStatus(`FireBoard connected. ${sessions.length} recent completed session${sessions.length === 1 ? '' : 's'} loaded.${suffix}${recommendation}`, 'good');"
if old_status not in text:
    raise SystemExit('load status anchor not found')
text = text.replace(old_status, new_status, 1)

old_tail = "  document.title = 'LDCookLog Mobile V1.22.7';\n  const headerSub = document.querySelector('header .sub');\n  if (headerSub) headerSub.textContent = 'V1.22.7 Stateful BBQ Control Panel';\n  const footer = document.querySelector('.footer-note');\n  if (footer) footer.innerHTML = 'V1.22.7 adds first-pass FireBoard analysis beneath the imported temperature graph: per-channel summary statistics, likely pit/chamber identification, target-range time, and first sustained stable period.<br><strong>Build 2026-09-13N</strong>';"
new_tail = "  document.title = 'LDCookLog Mobile V1.23.0';\n  const headerSub = document.querySelector('header .sub');\n  if (headerSub) headerSub.textContent = 'V1.23.0 Stateful BBQ Control Panel';\n  const footer = document.querySelector('.footer-note');\n  if (footer) footer.innerHTML = 'V1.23.0 begins FireBoard cook integration: recent sessions are matched to the current cook by time window, with a recommended Connect & Import workflow. V1.22.7 analysis remains available but is not expanded in this release.<br><strong>Build 2026-09-13P</strong>';"
if old_tail not in text:
    raise SystemExit('version tail anchor not found')
text = text.replace(old_tail, new_tail, 1)

index_path.write_text(text)

sw = sw_path.read_text()
old_cache = "const CACHE_NAME = 'ldcooklog-v1-22-7';"
new_cache = "const CACHE_NAME = 'ldcooklog-v1-23-0';"
if old_cache not in sw:
    raise SystemExit('service worker cache anchor not found')
sw_path.write_text(sw.replace(old_cache, new_cache, 1))
