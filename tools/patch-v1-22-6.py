from pathlib import Path

path = Path('index.html')
text = path.read_text()

old_import_button = """      const importButton = document.createElement('button');\n      importButton.className = 'good';\n      importButton.textContent = 'Import Temperature Data';\n      importButton.style.marginTop = '8px';\n      importButton.dataset.fireboardImportId = String(session.id);\n      importButton.disabled = true;\n      importButton.addEventListener('click', () => importFireboardTemperatureData(session, importButton));\n      div.appendChild(importButton);\n"""
new_import_button = old_import_button + """\n      const graphButton = document.createElement('button');\n      graphButton.className = 'blue';\n      graphButton.textContent = 'View Temperature Graph';\n      graphButton.style.marginTop = '8px';\n      graphButton.dataset.fireboardGraphId = String(session.id);\n      graphButton.disabled = true;\n      graphButton.addEventListener('click', () => showFireboardTemperatureGraph(session, div, graphButton));\n      div.appendChild(graphButton);\n"""
if 'data.fireboardGraphId' not in text and 'dataset.fireboardGraphId' not in text:
    if old_import_button not in text:
        raise SystemExit('Could not find FireBoard import button block.')
    text = text.replace(old_import_button, new_import_button, 1)

old_status = """        if (importButton) {\n          importButton.textContent = `Temperature Data Imported — ${count} samples`;\n          importButton.disabled = false;\n        }\n"""
new_status = old_status + """        const graphButton = fireboardList.querySelector(`button[data-fireboard-graph-id=\"${String(sessionId)}\"]`);\n        if (graphButton) graphButton.disabled = false;\n"""
if 'button[data-fireboard-graph-id=' not in text:
    if old_status not in text:
        raise SystemExit('Could not find persistent import status block.')
    text = text.replace(old_status, new_status, 1)

marker = """  async function verifyFireboardSampleCount(accessToken, associationId) {\n"""
helper = r'''  async function readFireboardTemperatureSamples(accessToken, associationId) {
    const rows = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const query = new URLSearchParams({
        select: 'channel_index,channel_label,observed_at,temperature_value,degree_type',
        cook_fireboard_session_id: `eq.${associationId}`,
        order: 'observed_at.asc',
        offset: String(offset),
        limit: String(pageSize)
      });
      const response = await fetch(`${SUPABASE_URL}/rest/v1/fireboard_temperature_samples?${query}`, {
        headers: fireboardCloudHeaders(accessToken)
      });
      const page = await response.json().catch(() => []);
      if (response.status === 401) throw Object.assign(new Error('Session expired.'), { code: 401 });
      if (!response.ok) throw new Error(page?.message || `Temperature data read failed (${response.status}).`);
      if (!Array.isArray(page)) break;
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows;
  }

  function renderFireboardTemperatureGraph(container, fbSession, rows) {
    container.querySelector('.fireboard-temp-graph')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'fireboard-temp-graph';
    wrap.style.marginTop = '10px';
    wrap.style.padding = '10px';
    wrap.style.background = '#101010';
    wrap.style.border = '1px solid #333';
    wrap.style.borderRadius = '12px';

    if (!rows.length) {
      wrap.textContent = 'No imported FireBoard temperature samples were found.';
      container.appendChild(wrap);
      return;
    }

    const parsed = rows.map(row => ({
      channel: Number(row.channel_index) || 0,
      label: row.channel_label || `Channel ${(Number(row.channel_index) || 0) + 1}`,
      time: Date.parse(row.observed_at),
      temp: Number(row.temperature_value),
      degree: row.degree_type
    })).filter(row => Number.isFinite(row.time) && Number.isFinite(row.temp));

    if (!parsed.length) {
      wrap.textContent = 'Imported temperature samples could not be graphed.';
      container.appendChild(wrap);
      return;
    }

    const groups = new Map();
    parsed.forEach(row => {
      if (!groups.has(row.channel)) groups.set(row.channel, { label: row.label, degree: row.degree, points: [] });
      groups.get(row.channel).points.push(row);
    });

    const allTimes = parsed.map(row => row.time);
    const allTemps = parsed.map(row => row.temp);
    const minTime = Math.min(...allTimes);
    const maxTime = Math.max(...allTimes);
    let minTemp = Math.floor(Math.min(...allTemps) / 10) * 10;
    let maxTemp = Math.ceil(Math.max(...allTemps) / 10) * 10;
    if (minTemp === maxTemp) maxTemp = minTemp + 10;
    const spanTime = Math.max(1, maxTime - minTime);
    const spanTemp = Math.max(1, maxTemp - minTemp);

    const width = 820, height = 360;
    const margin = { left: 52, right: 18, top: 18, bottom: 42 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const x = value => margin.left + ((value - minTime) / spanTime) * plotW;
    const y = value => margin.top + (1 - (value - minTemp) / spanTemp) * plotH;
    const colors = ['#f2a13a', '#6aa7e8', '#7ec56e', '#a487df', '#e66a5e', '#f1c453'];
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Temperature graph for ${fbSession.title || 'FireBoard session'}`);
    svg.style.width = '100%';
    svg.style.height = 'auto';
    svg.style.display = 'block';

    const addLine = (x1, y1, x2, y2, stroke, dash = '') => {
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1); line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('stroke', stroke); line.setAttribute('stroke-width', '1');
      if (dash) line.setAttribute('stroke-dasharray', dash);
      svg.appendChild(line);
    };
    const addText = (value, tx, ty, anchor = 'start') => {
      const node = document.createElementNS(ns, 'text');
      node.textContent = value;
      node.setAttribute('x', tx); node.setAttribute('y', ty); node.setAttribute('text-anchor', anchor);
      node.setAttribute('fill', '#aaa'); node.setAttribute('font-size', '12');
      svg.appendChild(node);
    };

    for (let i = 0; i <= 5; i++) {
      const temp = minTemp + (spanTemp * i / 5);
      const py = y(temp);
      addLine(margin.left, py, width - margin.right, py, '#303030');
      addText(`${Math.round(temp)}°`, margin.left - 8, py + 4, 'end');
    }
    addLine(margin.left, margin.top, margin.left, height - margin.bottom, '#777');
    addLine(margin.left, height - margin.bottom, width - margin.right, height - margin.bottom, '#777');

    const formatTime = ms => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    addText(formatTime(minTime), margin.left, height - 16, 'start');
    addText(formatTime(minTime + spanTime / 2), margin.left + plotW / 2, height - 16, 'middle');
    addText(formatTime(maxTime), width - margin.right, height - 16, 'end');

    [...groups.entries()].sort((a, b) => a[0] - b[0]).forEach(([channel, group], index) => {
      const points = group.points.sort((a, b) => a.time - b.time);
      const path = document.createElementNS(ns, 'path');
      const d = points.map((point, pointIndex) => `${pointIndex ? 'L' : 'M'}${x(point.time).toFixed(1)},${y(point.temp).toFixed(1)}`).join(' ');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', colors[index % colors.length]);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(path);
    });

    const title = document.createElement('strong');
    title.textContent = `${fbSession.title || 'FireBoard Session'} — Temperature Graph`;
    wrap.appendChild(title);
    wrap.appendChild(svg);

    const legend = document.createElement('div');
    legend.style.display = 'flex';
    legend.style.flexWrap = 'wrap';
    legend.style.gap = '8px 14px';
    legend.style.marginTop = '8px';
    legend.style.fontSize = '12px';
    [...groups.entries()].sort((a, b) => a[0] - b[0]).forEach(([channel, group], index) => {
      const item = document.createElement('span');
      const temps = group.points.map(point => point.temp);
      const unit = Number(group.degree) === 1 ? 'C' : Number(group.degree) === 2 ? 'F' : String(group.degree || 'F');
      item.textContent = `● ${group.label}: ${Math.min(...temps).toFixed(1)}–${Math.max(...temps).toFixed(1)} °${unit}`;
      item.style.color = colors[index % colors.length];
      legend.appendChild(item);
    });
    wrap.appendChild(legend);
    container.appendChild(wrap);
  }

  async function showFireboardTemperatureGraph(fbSession, container, button) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Loading Graph…';
    try {
      let authSession = getCloudSession();
      if (!authSession?.access_token) throw new Error('Sign in to LDCookLog Cloud first.');
      const association = await getFireboardAssociation(authSession.access_token, fbSession.id);
      if (!association?.id) throw new Error('Attach this FireBoard session to the current cook first.');
      let rows;
      try {
        rows = await readFireboardTemperatureSamples(authSession.access_token, association.id);
      } catch (err) {
        if (err.code !== 401) throw err;
        authSession = await refreshCloudSession(authSession);
        rows = await readFireboardTemperatureSamples(authSession.access_token, association.id);
      }
      renderFireboardTemperatureGraph(container, fbSession, rows);
      button.textContent = 'Refresh Temperature Graph';
      setFireboardStatus(`Temperature graph loaded for ${fbSession.title || `FireBoard Session ${fbSession.id}`}: ${rows.length} imported samples.`, 'good');
    } catch (err) {
      button.textContent = originalText;
      setFireboardStatus(`Temperature graph failed: ${err.message} Your cook data is unaffected.`, 'bad');
    } finally {
      button.disabled = false;
    }
  }

'''
if 'async function showFireboardTemperatureGraph' not in text:
    if marker not in text:
        raise SystemExit('Could not find graph helper insertion point.')
    text = text.replace(marker, helper + marker, 1)

old_success = """      button.textContent = verifiedCount == null ? 'Temperature Data Imported' : `Temperature Data Imported — ${verifiedCount} samples`;\n      button.disabled = false;\n"""
new_success = old_success + """      const graphButton = button.parentElement?.querySelector(`button[data-fireboard-graph-id=\"${String(fbSession.id)}\"]`);\n      if (graphButton) graphButton.disabled = false;\n"""
if 'const graphButton = button.parentElement?.querySelector(`button[data-fireboard-graph-id=' not in text:
    if old_success not in text:
        raise SystemExit('Could not find import success block.')
    text = text.replace(old_success, new_success, 1)

text = text.replace(
    'V1.22.5 remembers FireBoard temperature-import status after refresh and shows the verified cloud sample count for attached sessions.',
    'V1.22.6 adds a responsive temperature graph built from imported FireBoard samples stored in Supabase. The graph reads cloud data only and does not call FireBoard again.',
    1
)
text = text.replace("document.title = 'LDCookLog Mobile V1.22.5';", "document.title = 'LDCookLog Mobile V1.22.6';", 1)
text = text.replace("headerSub.textContent = 'V1.22.5 Stateful BBQ Control Panel';", "headerSub.textContent = 'V1.22.6 Stateful BBQ Control Panel';", 1)
text = text.replace(
    "V1.22.5 adds persistent FireBoard import recognition after refresh, including verified cloud sample counts for attached sessions.<br><strong>Build 2026-09-13L</strong>",
    "V1.22.6 adds an in-app FireBoard temperature graph using imported Supabase telemetry, with all attached channels plotted together.<br><strong>Build 2026-09-13M</strong>",
    1
)
path.write_text(text)

sw = Path('service-worker.js')
sw_text = sw.read_text()
old_cache = "const CACHE_NAME = 'ldcooklog-v1-22-5';"
new_cache = "const CACHE_NAME = 'ldcooklog-v1-22-6';"
if old_cache in sw_text:
    sw_text = sw_text.replace(old_cache, new_cache, 1)
elif new_cache not in sw_text:
    raise SystemExit('Could not find current V1.22.5 service worker cache name.')
sw.write_text(sw_text)
