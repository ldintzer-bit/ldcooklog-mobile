/* LDCookLog V1.30.50 — read-only history and side-by-side cook comparisons. */
(() => {
  'use strict';
  const TEST_MARKER = '[TEST COOK: EXCLUDE FROM ANALYSIS]';
  const PAGE = 100;
  const DISPLAY_PAGE = 20;
  const colors = ['#f2a13a', '#6aa7e8', '#7ec56e', '#a487df', '#e66a5e', '#f1c453'];
  const isTest = cook => String(cook.notes || '').includes(TEST_MARKER);
  let refreshingAuth = null;
  function cooker(cook) {
    const match = String(cook.notes || '').match(/Smoker: (.*?)\. /);
    return match ? match[1] : 'Not recorded';
  }
  function finalRecord(cook) {
    const line = String(cook.notes || '').split('\n').find(x => x.startsWith('[LDC_FINAL_FIREBOARD_SYNC] '));
    if (!line) return null;
    try {
      const r = JSON.parse(line.slice('[LDC_FINAL_FIREBOARD_SYNC] '.length));
      return r.cookId === cook.cook_id && r.finishTime === cook.finish_time ? r : null;
    } catch (_) { return null; }
  }
  function day(value) {
    if (!value) return '';
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }
  function filterCooks(cooks, f) {
    const q = (f.search || '').trim().toLowerCase();
    return cooks.filter(c => {
      const date = day(c.start_time);
      return (!q || `${c.cook_id || ''} ${c.food || ''}`.toLowerCase().includes(q)) &&
        (!f.food || c.food === f.food) && (!f.cooker || cooker(c) === f.cooker) &&
        (!f.from || (date && date >= f.from)) && (!f.to || (date && date <= f.to)) &&
        (f.tests === 'all' || (f.tests === 'test' ? isTest(c) : !isTest(c)));
    });
  }
  async function get(table, params) {
    let auth = loadCloudSession();
    if (!auth?.access_token) throw new Error('Sign in to LDCookLog Cloud to view your history.');
    const url = `${SUPABASE_URL}/rest/v1/${table}?${new URLSearchParams(params)}`;
    const request = token => fetch(url, { method: 'GET', headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, Accept: 'application/json'
    }});
    let response = await request(auth.access_token);
    if (response.status === 401) {
      // Parallel record reads share one refresh instead of rotating the token repeatedly.
      const current = loadCloudSession();
      if (current?.access_token && current.access_token !== auth.access_token) auth = current;
      else {
        if (!refreshingAuth) refreshingAuth = refreshCloudSession(auth).finally(() => { refreshingAuth = null; });
        auth = await refreshingAuth;
      }
      response = await request(auth.access_token);
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || `Could not read ${table} (${response.status}).`);
    if (!Array.isArray(data)) throw new Error(`Unexpected response while reading ${table}.`);
    return data;
  }
  async function allRows(table, params, read = get, batch = PAGE) {
    const result = [], seen = new Set();
    for (let offset = 0; ; offset += batch) {
      const page = await read(table, { ...params, offset: String(offset), limit: String(batch) });
      for (const row of page) {
        if (row.id && seen.has(row.id)) continue;
        if (row.id) seen.add(row.id);
        result.push(row);
      }
      if (page.length < batch) return result;
    }
  }
  async function loadIndex(read = get) {
    return allRows('cooks', {
      select: 'id,cook_id,food,phase,weight_value,weight_unit,target_temp,start_time,finish_time,notes',
      order: 'start_time.desc.nullslast,id.asc'
    }, read);
  }

  // User-authorized cleanup, bounded to the history preceding the real October 1 cook.
  function testCleanupPlan(rows) {
    const anchor = rows.find(c => c.cook_id === '20261001-001');
    if (!anchor || !Number.isFinite(Date.parse(anchor.start_time))) throw new Error('Cannot identify the October 1 real cook for test cleanup.');
    if (rows.some(c => !Number.isFinite(Date.parse(c.start_time)))) throw new Error('A cook is missing its start date; cleanup paused to protect the 10 oldest cooks.');
    const historical = rows.filter(c => c.id !== anchor.id && Date.parse(c.start_time) <= Date.parse(anchor.start_time));
    if (historical.some(c => !c.cook_id)) throw new Error('A historical cook is missing its Cook ID.');
    historical.sort((a,b) => Date.parse(a.start_time) - Date.parse(b.start_time) || String(a.cook_id).localeCompare(String(b.cook_id)) || a.id.localeCompare(b.id));
    const keep = new Set(historical.slice(0,10).map(c => c.id)); keep.add(anchor.id);
    return [...historical,anchor].map(c => ({id:c.id,test:!keep.has(c.id)}));
  }
  function septemberTestPlan(rows) {
    return rows.filter(c => /^202609(?:11|12|13)-\d+$/.test(String(c.cook_id))).map(c => ({id:c.id,test:true}));
  }
  async function cleanHistoricalTests(rows, supplemental = false) {
    const auth = loadCloudSession();
    const key = (supplemental ? 'ldcooklog-test-cleanup-13050-' : 'ldcooklog-test-cleanup-13049-') + auth.user.id;
    let job;
    try { job = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) {}
    if (job?.complete) return rows;
    if (!job) {
      job = {plan:supplemental ? septemberTestPlan(rows) : testCleanupPlan(rows),complete:false};
      localStorage.setItem(key,JSON.stringify(job)); // Freeze the exact authorized set before the first write.
    }
    for (const item of job.plan) {
      const [fresh] = await get('cooks',{select:'id,cook_id,notes,updated_at',id:'eq.'+item.id,limit:'1'});
      if (!fresh) throw new Error('A cook in the cleanup could not be found.');
      if (isTest(fresh) === item.test) continue;
      const notes = item.test ? String(fresh.notes || '') + '\n' + TEST_MARKER : String(fresh.notes || '').split(TEST_MARKER).join('').trim();
      const session = loadCloudSession();
      const params = {id:'eq.'+item.id,updated_at:fresh.updated_at ? 'eq.'+fresh.updated_at : 'is.null',select:'id,updated_at'};
      const response = await fetch(SUPABASE_URL+'/rest/v1/cooks?'+new URLSearchParams(params), {
        method:'PATCH',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json',Prefer:'return=representation'},
        body:JSON.stringify({notes})
      });
      const changed = await response.json();
      if (!response.ok || !Array.isArray(changed) || changed.length !== 1) throw new Error('Test cleanup paused because a cook changed or could not be saved. Refresh History to retry.');
      if (typeof state !== 'undefined' && state.cloudCookUuid === item.id) {
        state.isTestCook = item.test;
        state.cloudLastSeenUpdatedAt = changed[0].updated_at || state.cloudLastSeenUpdatedAt;
        save();
      }
    }
    job.complete = true; localStorage.setItem(key,JSON.stringify(job));
    return loadIndex();
  }

  async function loadRecord(id, read = get) {
    const rows = await read('cooks', { select: '*', id: `eq.${id}`, limit: '1' });
    if (!rows[0]) throw new Error('This cook could not be found in cloud history.');
    const cook = rows[0];
    const tasks = {
      events: () => allRows('events', { select: '*', cook_id: `eq.${id}`, order: 'event_time.asc,id.asc' }, read, 1000),
      preparation: () => read('cook_preparation', { select: '*', cook_id: `eq.${id}`, limit: '1' }),
      pieces: () => read('cook_meat_pieces', { select: '*', cook_id: `eq.${id}`, order: 'piece_number.asc' }),
      evaluation: () => read('cook_evaluations', { select: '*', cook_id: `eq.${id}`, limit: '1' }),
      roles: () => read('fireboard_probe_roles', { select: '*', cook_id: `eq.${id}` }),
      sessions: () => read('cook_fireboard_sessions', { select: '*', cook_id: `eq.${id}`, order: 'created_at.asc' }),
      equipmentLinks: () => read('cook_equipment', { select: '*', cook_id: `eq.${id}` }),
      rubLinks: () => read('cook_rubs', { select: '*', cook_id: `eq.${id}` })
    };
    const record = { cook, errors: {}, temperatures: [] };
    const keys = Object.keys(tasks);
    const results = await Promise.allSettled(keys.map(k => tasks[k]()));
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') record[keys[i]] = r.value;
      else { record[keys[i]] = []; record.errors[keys[i]] = r.reason.message || String(r.reason); }
    });
    const names = async (table, links, key) => {
      const ids = [...new Set(links.map(x => x[key]).filter(Boolean))];
      return ids.length ? read(table, { select: '*', id: `in.(${ids.join(',')})` }) : [];
    };
    const refs = {
      equipment: () => names('equipment', record.equipmentLinks, 'equipment_id'),
      rubs: () => names('rubs', record.rubLinks, 'rub_id'),
      location: () => cook.location_id ? read('locations', { select: '*', id: `eq.${cook.location_id}`, limit: '1' }) : Promise.resolve([]),
      method: () => cook.cook_method_id ? read('cook_methods', { select: '*', id: `eq.${cook.cook_method_id}`, limit: '1' }) : Promise.resolve([])
    };
    const refKeys = Object.keys(refs);
    const refResults = await Promise.allSettled(refKeys.map(k => refs[k]()));
    refResults.forEach((r, i) => {
      if (r.status === 'fulfilled') record[refKeys[i]] = r.value;
      else { record[refKeys[i]] = []; record.errors[refKeys[i]] = r.reason.message || String(r.reason); }
    });
    const sampleResults = await Promise.allSettled(record.sessions.map(session => allRows('fireboard_temperature_samples', {
      select: 'id,channel_index,device_uuid,channel_label,observed_at,temperature_value,degree_type',
      cook_fireboard_session_id: `eq.${session.id}`, order: 'observed_at.asc,id.asc'
    }, read, 1000)));
    sampleResults.forEach((r, i) => record.temperatures.push({ session: record.sessions[i],
      rows: r.status === 'fulfilled' ? r.value : [], error: r.status === 'rejected' ? r.reason.message || String(r.reason) : null }));
    return record;
  }
  function graphGroups(rows, cook) {
    const groups = new Map();
    const start = cook.start_time ? Date.parse(cook.start_time) : -Infinity;
    const end = cook.finish_time ? Date.parse(cook.finish_time) : Infinity;
    let outside = 0, invalid = 0;
    for (const row of rows) {
      const time = Date.parse(row.observed_at), raw = Number(row.temperature_value);
      const unit = String(row.degree_type || '').toUpperCase();
      const celsius = unit === '1' || unit === 'C';
      const fahrenheit = unit === '2' || unit === 'F';
      if (!Number.isFinite(time) || !Number.isFinite(raw) || row.temperature_value == null || (!celsius && !fahrenheit)) { invalid++; continue; }
      if (time < start || time > end) { outside++; continue; }
      const key = `${row.device_uuid || 'unknown-device'}::${row.channel_index}`;
      if (!groups.has(key)) groups.set(key, { key, label: row.channel_label || `Channel ${row.channel_index}`, points: [] });
      groups.get(key).points.push({ time, temp: celsius ? raw * 9 / 5 + 32 : raw });
    }
    for (const group of groups.values()) group.points.sort((a, b) => a.time - b.time);
    return { groups: [...groups.values()], outside, invalid };
  }
  function downsample(points, buckets = 300) {
    if (points.length <= buckets * 4) return points;
    const output = [];
    const step = Math.ceil(points.length / buckets);
    for (let i = 0; i < points.length; i += step) {
      const segment = points.slice(i, i + step);
      let lo = segment[0], hi = segment[0];
      for (const p of segment) { if (p.temp < lo.temp) lo = p; if (p.temp > hi.temp) hi = p; }
      const keep = [...new Set([segment[0], lo, hi, segment[segment.length - 1]])].sort((a, b) => a.time - b.time);
      output.push(...keep);
    }
    return output;
  }
  function canCompare(cook) { return !isTest(cook) && Boolean(cook.finish_time); }
  function comparisonMetrics(record) {
    const cook = record.cook;
    const start = Date.parse(cook.start_time), finish = Date.parse(cook.finish_time);
    const events = [...record.events].filter(e => Number.isFinite(Date.parse(e.event_time))).sort((a, b) => Date.parse(a.event_time) - Date.parse(b.event_time));
    const targets = events.filter(e => e.target_temp != null && Number.isFinite(Number(e.target_temp)));
    const wraps = events.filter(e => e.event_type === 'Wrapped' || e.event_type === 'Wrap');
    function period(begin, end) {
      let opened = null, total = 0, count = 0, endedAtFinish = false;
      for (const event of events) {
        const t = Date.parse(event.event_time);
        if (Number.isFinite(start) && t < start) continue;
        if (Number.isFinite(finish) && t > finish) continue;
        if (event.event_type === begin && opened == null) opened = t;
        else if ((event.event_type === end || event.event_type === 'Cook Finished') && opened != null) {
          total += Math.max(0, t - opened); count++; opened = null;
          if (event.event_type === 'Cook Finished') endedAtFinish = true;
        }
      }
      return { minutes: count ? total / 60000 : null, incomplete: opened != null, endedAtFinish };
    }
    return {
      duration: Number.isFinite(start) && Number.isFinite(finish) && finish >= start ? (finish - start) / 60000 : null,
      initialTarget: targets.length ? Number(targets[0].target_temp) : null,
      lastTarget: cook.target_temp == null ? null : Number(cook.target_temp),
      wraps: wraps.map(e => ({ note: e.note || e.event_type, minutes: Number.isFinite(start) ? (Date.parse(e.event_time) - start) / 60000 : null })),
      rest: period('Rest Start', 'Rest End'), hold: period('Keep Warm Start', 'Keep Warm End'),
      targets: events.filter(e => e.event_type === 'Target Change').map(e => ({ target: e.target_temp, note: e.note || '', minutes: Number.isFinite(start) ? (Date.parse(e.event_time) - start) / 60000 : null }))
    };
  }
  function comparisonSeries(record, purpose) {
    const start = Date.parse(record.cook.start_time);
    if (!Number.isFinite(start)) return [];
    const roles = new Map(record.roles.filter(r => r.role_type === purpose).map(r => [`${r.device_uuid || 'unknown-device'}::${r.channel_id}`, r]));
    const groups = new Map();
    for (const entry of record.temperatures) {
      if (entry.error) continue;
      for (const g of graphGroups(entry.rows, record.cook).groups) {
        const role = roles.get(g.key);
        if (!role) continue;
        if (!groups.has(g.key)) groups.set(g.key, { label: `${record.cook.cook_id} — ${role.cook_role || g.label}`, points: new Map() });
        for (const point of g.points) groups.get(g.key).points.set(point.time, { ...point, minutes: (point.time - start) / 60000 });
      }
    }
    return [...groups.values()].map(g => ({ label: g.label, points: [...g.points.values()].sort((a, b) => a.time - b.time) }));
  }
  function comparisonSegments(points) {
    const segments = [];
    for (const point of points) {
      const last = segments[segments.length - 1];
      if (!last || point.time - last[last.length - 1].time > 5 * 60000) segments.push([point]);
      else last.push(point);
    }
    return segments.map(segment => downsample(segment));
  }
  // Pure/read-only functions are also usable by the focused Node checks.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { isTest, cooker, finalRecord, filterCooks, allRows, loadIndex, loadRecord, graphGroups, downsample, get, canCompare, comparisonMetrics, comparisonSeries, comparisonSegments, testCleanupPlan, septemberTestPlan };
    return;
  }

  const make = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const dateTime = value => value ? new Date(value).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not recorded';
  const button = (text, action, cls = 'secondary') => { const b = make('button', text, cls); b.type = 'button'; b.addEventListener('click', action); return b; };
  const main = document.querySelector('body > .app');
  const root = make('div', null, 'app history-app');
  root.hidden = true;
  root.innerHTML = '<header><div><h1 tabindex="-1">Cook History</h1><div class="sub">All saved cooks, events, and temperatures</div></div></header><div class="history-toolbar"></div><div class="history-list-view"><section class="card"><h2>Find a cook</h2><div class="history-filters"></div><div class="history-status" role="status" aria-live="polite"></div></section><div class="history-cook-list"></div></div><section class="card history-detail" hidden></section>';
  document.body.appendChild(root);
  const style = make('style');
  style.textContent = '.history-app [hidden],.history-app[hidden]{display:none!important}.history-app .sub{font-size:14px;line-height:1.5}.history-app h2{font-size:18px}.history-app h3{font-size:17px;margin:18px 0 10px}.history-toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}.history-toolbar button{min-height:44px}.history-filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.history-filters label{font-size:14px}.history-search{grid-column:1/-1}.history-status{margin-top:12px;font-size:15px;line-height:1.5}.history-cook-list{display:grid;gap:12px}.history-cook-list article{margin:0}.history-cook-list strong{font-size:18px}.history-cook-list button{margin-top:10px;min-height:44px;width:100%}.history-type{display:inline-block;padding:4px 8px;border:1px solid #777;border-radius:6px;font-size:14px;margin:7px 0}.history-detail{font-size:16px;line-height:1.5;overflow-wrap:anywhere}.history-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.history-summary div{padding:9px;background:#242424;border-radius:8px}.history-summary dt{font-size:14px;color:#bbb}.history-summary dd{margin:2px 0 0}.history-section{border-top:1px solid #444;padding-top:12px;margin-top:18px}.history-error{color:#ffc2bb}.history-event{padding:10px 0;border-bottom:1px solid #333}.history-event time{display:block;font-size:14px;color:#f2a13a}.history-scroll{overflow-x:auto}.history-app table{border-collapse:collapse;width:100%;font-size:14px}.history-app th,.history-app td{text-align:left;padding:9px;border-bottom:1px solid #444;vertical-align:top}.history-chart{min-width:560px;width:100%;height:auto}.history-legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}.history-legend label{display:flex;align-items:center;gap:6px;font-size:14px}.history-legend input{width:18px;height:18px;padding:0}.history-note{white-space:pre-wrap}.history-nav{width:100%;min-height:44px;margin-bottom:14px}@media(max-width:520px){.history-summary{grid-template-columns:1fr}.history-toolbar button{flex:1}.history-filters{gap:10px}}';
  document.head.appendChild(style);
  style.textContent += '.history-selection-summary{margin-bottom:14px;padding:10px;border:1px solid #555;border-radius:10px;font-size:14px}.history-selection-summary>div{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:5px 0}.history-selection-summary button{min-height:36px;font-size:14px;padding:7px 10px}';
  style.textContent += '.history-compare-choice{display:flex;align-items:center;gap:10px;font-size:16px;color:var(--text);padding:12px 0 0;margin:0}.history-compare-choice input{width:22px;height:22px;padding:0;margin:0;flex:none;accent-color:var(--accent)}.history-comparison-table{min-width:760px}.history-comparison-table th,.history-comparison-table td{min-width:165px;max-width:300px;white-space:normal}.history-comparison-table th:first-child,.history-comparison-table td:first-child{position:sticky;left:0;background:var(--panel);min-width:145px;z-index:1}';
  const launch = button('Cook History', () => openHistory(), 'blue history-nav');
  main.querySelector('header').after(launch);
  const toolbar = root.querySelector('.history-toolbar');
  const listView = root.querySelector('.history-list-view');
  const detail = root.querySelector('.history-detail');
  const list = root.querySelector('.history-cook-list');
  const status = root.querySelector('.history-status');
  let cooks = [], loaded = false, loading = false, visible = DISPLAY_PAGE, generation = 0;
  const selected = new Map();
  const selectionSummary = make('div', null, 'history-selection-summary');
  root.querySelector('.history-toolbar').after(selectionSummary);
  const compareButton = button('Compare Selected Cooks (0/4)', () => openComparison(), 'blue');
  const clearSelection = button('Clear Selection', () => { selected.clear(); updateSelection(); renderList(); });
  function updateSelection() {
    compareButton.textContent = `Compare Selected Cooks (${selected.size}/4)`;
    compareButton.disabled = selected.size < 2;
    clearSelection.hidden = selected.size === 0;
    selectionSummary.replaceChildren(); selectionSummary.hidden = selected.size === 0;
    for (const cook of selected.values()) {
      const row = make('div');
      row.append(make('span', `${cook.cook_id} — ${cook.food || 'Cook'}`), button(`Remove ${cook.cook_id}`, () => { selected.delete(cook.id); updateSelection(); renderList(); }));
      selectionSummary.appendChild(row);
    }
  }
  const inputs = {};
  const fields = [['search', 'Search meat/cut or Cook ID', 'search'], ['food', 'Meat / Cut', 'select'], ['cooker', 'Cooker', 'select'], ['from', 'From date', 'date'], ['to', 'Through date', 'date'], ['tests', 'Cook type', 'select']];
  for (const [key, label, type] of fields) {
    const wrap = make('div', null, key === 'search' ? 'history-search' : '');
    const lab = make('label', label); lab.htmlFor = `history-${key}`;
    const input = make(type === 'select' ? 'select' : 'input'); input.id = lab.htmlFor;
    if (type !== 'select') input.type = type;
    if (key === 'search') input.placeholder = 'Brisket, ribs, 20261001…';
    wrap.append(lab, input); root.querySelector('.history-filters').appendChild(wrap); inputs[key] = input;
    input.addEventListener(type === 'search' ? 'input' : 'change', () => { visible = DISPLAY_PAGE; renderList(); });
  }
  function options(input, entries) {
    const previous = input.value; input.replaceChildren();
    for (const [value, label] of entries) { const opt = make('option', label); opt.value = value; input.appendChild(opt); }
    if (entries.some(x => x[0] === previous)) input.value = previous;
  }
  options(inputs.tests, [['real', 'Real cooks'], ['all', 'All cooks, including tests'], ['test', 'Test cooks only']]);
  options(inputs.food, [['', 'All meat / cuts']]); options(inputs.cooker, [['', 'All cookers']]);
  toolbar.append(button('Back to Current Cook', () => {
    generation++; root.hidden = true; main.hidden = false; main.querySelector('h1').tabIndex = -1; main.querySelector('h1').focus(); launch.focus();
  }), button('Refresh History', () => { detail.hidden = true; listView.hidden = false; reload(); }));
  toolbar.append(compareButton, clearSelection);
  const compareHelp = make('p', 'Select two to four finished, real cooks for a side-by-side comparison. Selections stay selected when you change filters.', 'sub');
  root.querySelector('.history-filters').after(compareHelp);
  updateSelection();
  async function openHistory() {
    main.hidden = true; root.hidden = false; detail.hidden = true; listView.hidden = false;
    root.querySelector('h1').focus(); window.scrollTo(0, 0);
    if (!loaded) await reload(); else renderList();
  }
  async function reload() {
    if (loading) return;
    const ticket = ++generation;
    loading = true; status.textContent = 'Reading saved cooks…';
    try {
      status.textContent = 'Updating historical test flags…';
      const result = await cleanHistoricalTests(await cleanHistoricalTests(await loadIndex()), true);
      if (ticket !== generation) return;
      cooks = result; loaded = true; visible = DISPLAY_PAGE;
      options(inputs.food, [['', 'All meat / cuts'], ...[...new Set(cooks.map(c => c.food).filter(Boolean))].sort().map(x => [x, x])]);
      options(inputs.cooker, [['', 'All cookers'], ...[...new Set(cooks.map(cooker))].sort().map(x => [x, x])]);
      renderList();
    } catch (err) {
      if (ticket !== generation) return;
      status.textContent = `History could not be loaded: ${err.message}`;
      if (!loaded) list.replaceChildren();
    } finally { loading = false; if (ticket !== generation && !root.hidden && !loaded) reload(); }
  }
  function renderList() {
    const f = Object.fromEntries(Object.entries(inputs).map(([k, input]) => [k, input.value]));
    list.replaceChildren();
    if (f.from && f.to && f.from > f.to) { status.textContent = 'The From date must be on or before the Through date.'; return; }
    const matches = filterCooks(cooks, f);
    status.textContent = `${matches.length} matching cook${matches.length === 1 ? '' : 's'} • ${cooks.length} saved in cloud history`;
    if (!matches.length) { list.appendChild(make('p', 'No cooks match these filters. Try All cooks, including tests, or clear a filter.')); return; }
    for (const cook of matches.slice(0, visible)) {
      const card = make('article', null, 'card');
      card.append(make('strong', cook.food || 'Unnamed cook'), make('div', cook.cook_id || 'Cook ID not recorded', 'sub'));
      if (isTest(cook)) card.appendChild(make('span', 'TEST COOK — excluded from future analysis', 'history-type'));
      card.append(make('div', `${dateTime(cook.start_time)} • ${cooker(cook)}`, 'sub'), make('div', cook.phase || 'Phase not recorded', 'sub'), button('View Cook Record', () => openRecord(cook.id)));
      if (canCompare(cook)) {
        const selectLabel = make('label', null, 'history-compare-choice');
        const check = make('input'); check.type = 'checkbox'; check.checked = selected.has(cook.id);
        check.addEventListener('change', () => {
          if (check.checked && selected.size >= 4) { check.checked = false; status.textContent = 'Select up to four cooks. Clear a selection before adding another.'; return; }
          if (check.checked) selected.set(cook.id, cook); else selected.delete(cook.id);
          updateSelection();
        });
        selectLabel.append(check, make('span', 'Select for comparison')); card.appendChild(selectLabel);
      } else card.appendChild(make('div', isTest(cook) ? 'Test cooks are excluded from comparisons.' : 'Finish this cook before comparing it.', 'sub'));
      list.appendChild(card);
    }
    if (visible < matches.length) list.appendChild(button(`Show More Cooks (${matches.length - visible} remaining)`, () => { visible += DISPLAY_PAGE; renderList(); }));
  }
  function section(title, parent = detail) { const box = make('section', null, 'history-section'); box.appendChild(make('h3', title)); parent.appendChild(box); return box; }
  function message(parent, text, error = false) { parent.appendChild(make('p', text, error ? 'history-error' : 'sub')); }
  function pairs(parent, entries) {
    const dl = make('dl', null, 'history-summary');
    for (const [label, value] of entries) { const box = make('div'); box.append(make('dt', label), make('dd', value == null || value === '' ? 'Not recorded' : String(value))); dl.appendChild(box); }
    parent.appendChild(dl);
  }
  function table(parent, headings, rows) {
    const scroll = make('div', null, 'history-scroll'), t = make('table'), head = make('thead'), hr = make('tr'), body = make('tbody');
    for (const heading of headings) { const th = make('th', heading); th.scope = 'col'; hr.appendChild(th); }
    head.appendChild(hr);
    for (const row of rows) { const tr = make('tr'); for (const value of row) tr.appendChild(make('td', value == null || value === '' ? '—' : String(value))); body.appendChild(tr); }
    t.append(head, body); scroll.appendChild(t); parent.appendChild(scroll);
  }
  function readableSection(record, key, title) {
    const box = section(title);
    if (record.errors[key]) message(box, `Could not load this part of the record: ${record.errors[key]}`, true);
    return box;
  }
  async function openRecord(id) {
    const ticket = ++generation;
    listView.hidden = true; detail.hidden = false; detail.replaceChildren();
    detail.append(button('Back to Cook History', () => { generation++; detail.hidden = true; listView.hidden = false; renderList(); }), make('p', 'Loading combined cook record…', 'history-record-loading'));
    window.scrollTo(0, 0);
    try {
      const record = await loadRecord(id);
      if (ticket !== generation || root.hidden) return;
      renderRecord(record);
    } catch (err) {
      if (ticket !== generation || root.hidden) return;
      detail.querySelector('.history-record-loading').textContent = `Cook record could not be loaded: ${err.message}`;
      detail.appendChild(button('Retry Loading Record', () => openRecord(id)));
    }
  }
  async function openComparison() {
    if (selected.size < 2 || selected.size > 4) return;
    const ticket = ++generation, ids = [...selected.keys()];
    listView.hidden = true; detail.hidden = false; detail.replaceChildren();
    detail.append(button('Back to Cook History', () => { generation++; detail.hidden = true; listView.hidden = false; renderList(); }), make('p', 'Loading selected cook records…', 'history-record-loading'));
    window.scrollTo(0, 0);
    const results = await Promise.allSettled(ids.map(id => loadRecord(id)));
    if (ticket !== generation || root.hidden) return;
    const failures = results.map((r, i) => r.status === 'rejected' ? `${selected.get(ids[i])?.cook_id || ids[i]}: ${r.reason.message || String(r.reason)}` : null).filter(Boolean);
    if (failures.length) {
      detail.querySelector('.history-record-loading').textContent = 'The comparison could not load all selected records.';
      failures.forEach(error => message(detail, error, true));
      detail.appendChild(button('Retry Comparison', () => openComparison())); return;
    }
    const records = results.map(r => r.value);
    if (records.some(r => !canCompare(r.cook))) {
      detail.querySelector('.history-record-loading').textContent = 'A selected cook is now a test cook or is unfinished. Clear the selection and choose finished, real cooks.';
      return;
    }
    renderComparison(records);
  }
  function durationText(minutes) {
    if (minutes == null || !Number.isFinite(minutes)) return 'Not recorded';
    const total = Math.round(minutes); return `${Math.floor(total / 60)}h ${total % 60}m`;
  }
  function periodText(period) {
    if (period.incomplete) return `${period.minutes == null ? '' : durationText(period.minutes) + '; '}start recorded without an end`;
    return period.minutes == null ? 'No start/end events recorded' : durationText(period.minutes) + (period.endedAtFinish ? ' (ended by Finish Cook)' : '');
  }
  function renderComparison(records) {
    detail.replaceChildren();
    detail.append(button('Back to Cook History', () => { generation++; detail.hidden = true; listView.hidden = false; renderList(); }), make('h2', 'Compare Cooks'));
    message(detail, 'Recorded results only. Temperature curves are aligned to each cook’s Meat On start time. Test cooks are excluded.');
    const cuts = new Set(records.map(r => String(r.cook.food || '').trim().toLowerCase()));
    const cookers = new Set(records.map(r => cooker(r.cook)));
    if (cuts.size > 1) message(detail, 'Different meat/cut or process labels are selected. Duration and food-temperature curves may not describe equivalent cooks.', true);
    if (cookers.size > 1) message(detail, 'Different cookers are selected. Consider their differences when comparing chamber-temperature curves.', true);
    const metrics = records.map(comparisonMetrics);
    const value = (r, key, fn) => r.errors[key] ? 'Unavailable' : fn();
    const headers = ['Recorded detail', ...records.map(r => r.cook.cook_id)];
    const rows = [
      ['Meat / Cut', ...records.map(r => r.cook.food || 'Not recorded')],
      ['Cooker', ...records.map(r => cooker(r.cook))],
      ['Started', ...records.map(r => dateTime(r.cook.start_time))],
      ['Weight', ...records.map(r => r.cook.weight_value == null ? 'Not recorded' : `${r.cook.weight_value} ${r.cook.weight_unit || ''}`)],
      ['Total cook duration', ...metrics.map(m => durationText(m.duration))],
      ['First logged target', ...metrics.map(m => m.initialTarget == null ? 'Not recorded' : `${m.initialTarget}°F`)],
      ['Last saved target', ...metrics.map(m => m.lastTarget == null ? 'Not recorded' : `${m.lastTarget}°F`)],
      ['Target changes', ...metrics.map(m => m.targets.length ? m.targets.map(t => `${t.target == null ? t.note || 'Target not recorded' : t.target + '°F'} at ${durationText(t.minutes)}`).join('; ') : 'No target-change events recorded')],
      ['Wrapping', ...metrics.map(m => m.wraps.length ? m.wraps.map(w => `${w.note} at ${durationText(w.minutes)}`).join('; ') : 'No wrap events recorded')],
      ['Rest', ...metrics.map(m => periodText(m.rest))],
      ['Keep warm', ...metrics.map(m => periodText(m.hold))],
      ['Binder', ...records.map(r => r.cook.binder || 'Not recorded')],
      ['Rubs', ...records.map(r => r.errors.rubs || r.errors.rubLinks ? 'Unavailable' : r.rubLinks.length ? r.rubLinks.map(link => `${r.rubs.find(x => x.id === link.rub_id)?.name || 'Saved rub'}${link.application_level ? ' — ' + link.application_level : ''}`).join('; ') : 'None recorded')],
      ['Preparation', ...records.map(r => value(r, 'preparation', () => { const p = r.preparation[0]; return p ? `Trim: ${p.trim_level || 'not recorded'}; Brine/marinade: ${p.brine_marinade || 'not recorded'}; Injection: ${p.injection || 'not recorded'}${p.prep_notes ? '; ' + p.prep_notes : ''}` : 'Not recorded'; }))],
      ['Meat pieces', ...records.map(r => value(r, 'pieces', () => r.pieces.length ? r.pieces.map(p => `Piece ${p.piece_number}: ${p.meat_cut || 'unspecified'}${p.cook_weight == null ? '' : ' — ' + p.cook_weight + ' ' + (p.weight_unit || '')}`).join('; ') : 'No individual pieces recorded'))],
      ['Overall result', ...records.map(r => value(r, 'evaluation', () => r.evaluation[0]?.overall_result || 'Not recorded'))],
      ['Bark', ...records.map(r => value(r, 'evaluation', () => r.evaluation[0]?.bark || 'Not recorded'))],
      ['Tenderness', ...records.map(r => value(r, 'evaluation', () => r.evaluation[0]?.tenderness || 'Not recorded'))],
      ['Observations', ...records.map(r => value(r, 'evaluation', () => r.evaluation[0]?.observations || 'Not recorded'))],
      ['Changes next time', ...records.map(r => value(r, 'evaluation', () => r.evaluation[0]?.changes_next_time || 'Not recorded'))],
      ['Saved events', ...records.map(r => value(r, 'events', () => r.events.length))],
      ['Final FireBoard sync', ...records.map(r => { const final = finalRecord(r.cook); return final?.status === 'complete' ? `Confirmed ${dateTime(final.checkedAt)}` : final?.status === 'no_session' ? 'Verified: no linked FireBoard session' : final?.status === 'failed' || final?.status === 'pending' ? 'Retry needed' : 'Unverified'; })]
    ];
    // Timing from unavailable event logs is unknown, never treated as an absence.
    for (const row of rows) if (['First logged target', 'Target changes', 'Wrapping', 'Rest', 'Keep warm'].includes(row[0])) records.forEach((r, i) => { if (r.errors.events) row[i + 1] = 'Unavailable'; });
    const summary = section('Setup, Timing, and Results'); table(summary, headers, rows);
    summary.querySelector('table').classList.add('history-comparison-table');
    for (const purpose of ['chamber', 'food']) {
      const box = section(purpose === 'chamber' ? 'Chamber Temperature Comparison' : 'Food Temperature Comparison');
      const series = records.flatMap(r => comparisonSeries(r, purpose));
      for (const r of records) {
        if (r.errors.roles || r.errors.sessions || r.temperatures.some(t => t.error)) message(box, `${r.cook.cook_id}: some saved probe or temperature data could not be loaded.`, true);
        else if (!comparisonSeries(r, purpose).length) message(box, `${r.cook.cook_id}: no usable samples with a saved ${purpose === 'chamber' ? 'chamber' : 'food'} probe assignment.`);
      }
      if (series.length) renderComparisonGraph(box, series);
    }
    const notes = records.flatMap(r => Object.entries(r.errors).map(([key]) => `${r.cook.cook_id}: ${key} unavailable`));
    if (notes.length) { const box = section('Unavailable Record Details'); notes.forEach(n => message(box, n, true)); }
    const links = section('Full Cook Records');
    records.forEach(r => links.appendChild(button(`View ${r.cook.cook_id}`, () => openRecord(r.cook.id))));
    detail.querySelector('h2').tabIndex = -1; detail.querySelector('h2').focus();
  }
  function renderComparisonGraph(parent, series) {
    let maxX = 1, minY = Infinity, maxY = -Infinity;
    for (const s of series) for (const p of s.points) { maxX = Math.max(maxX, p.minutes); minY = Math.min(minY, p.temp); maxY = Math.max(maxY, p.temp); }
    minY = Math.floor(minY / 10) * 10; maxY = Math.max(minY + 10, Math.ceil(maxY / 10) * 10);
    const W = 760, H = 350, left = 58, right = 18, top = 22, bottom = 50;
    const x = v => left + v / maxX * (W - left - right), y = v => top + (maxY - v) / (maxY - minY) * (H - top - bottom);
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Cook comparison temperature graph, degrees Fahrenheit against elapsed time since Meat On'); svg.setAttribute('class', 'history-chart');
    const node = (tag, attrs, text) => { const n = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text != null) n.textContent = text; svg.appendChild(n); return n; };
    for (let i = 0; i <= 4; i++) { const t = minY + (maxY - minY) * i / 4; node('line', { x1: left, x2: W - right, y1: y(t), y2: y(t), stroke: '#444' }); node('text', { x: left - 8, y: y(t) + 5, fill: '#bbb', 'font-size': 14, 'text-anchor': 'end' }, `${Math.round(t)}°F`); }
    for (let i = 0; i <= 4; i++) node('text', { x: x(maxX * i / 4), y: H - 15, fill: '#bbb', 'font-size': 14, 'text-anchor': i === 0 ? 'start' : i === 4 ? 'end' : 'middle' }, durationText(maxX * i / 4));
    const legend = make('div', null, 'history-legend');
    series.forEach((s, i) => {
      const segments = comparisonSegments(s.points), pts = segments.flat(), color = colors[i % colors.length];
      // Break curves across long data gaps rather than suggesting continuous measurements.
      const d = segments.map(segment => segment.map((p, j) => `${j ? 'L' : 'M'}${x(p.minutes).toFixed(1)},${y(p.temp).toFixed(1)}`).join(' ')).join(' ');
      const path = node('path', { d, stroke: color, fill: 'none', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke', 'stroke-dasharray': i >= colors.length ? '5 3' : '' });
      const dot = pts.length === 1 ? node('circle', { cx: x(pts[0].minutes), cy: y(pts[0].temp), r: 3, fill: color }) : null;
      const label = make('label'), check = make('input'); check.type = 'checkbox'; check.checked = true;
      check.addEventListener('change', () => { path.style.display = check.checked ? '' : 'none'; if (dot) dot.style.display = path.style.display; });
      label.style.color = color; label.append(check, make('span', s.label)); legend.appendChild(label);
    });
    const scroll = make('div', null, 'history-scroll'); scroll.appendChild(svg); parent.append(scroll, legend);
    message(parent, 'Elapsed time from Meat On • °F. Use the legend to show or hide a probe. Curves break across gaps longer than five minutes.');
  }
  function renderRecord(r) {
    detail.replaceChildren();
    detail.appendChild(button('Back to Cook History', () => { generation++; detail.hidden = true; listView.hidden = false; renderList(); }));
    const c = r.cook;
    detail.append(make('h2', `${c.cook_id} — ${c.food || 'Cook'}`));
    if (isTest(c)) detail.appendChild(make('span', 'TEST COOK — excluded from future analysis', 'history-type'));
    const elapsed = c.start_time && c.finish_time ? Math.max(0, Date.parse(c.finish_time) - Date.parse(c.start_time)) : null;
    pairs(detail, [['Phase', c.phase], ['Cooker', cooker(c)], ['Started', dateTime(c.start_time)], ['Finished', c.finish_time ? dateTime(c.finish_time) : 'Still active'], ['Duration', elapsed == null ? 'Not yet finished' : `${Math.floor(elapsed / 3600000)}h ${Math.floor(elapsed / 60000) % 60}m`], ['Weight', c.weight_value == null ? null : `${c.weight_value} ${c.weight_unit || ''}`], ['Last saved target', c.target_temp == null ? null : `${c.target_temp}°F`]]);
    const confirmation = section('Final FireBoard Sync');
    const final = finalRecord(c);
    if (!c.finish_time) message(confirmation, 'Cook is active; final capture happens when the cook is finished.');
    else if (final?.status === 'complete') message(confirmation, `Confirmed ${dateTime(final.checkedAt)} • ${final.samples} samples recorded at confirmation.`);
    else if (final?.status === 'no_session') message(confirmation, `Verified ${dateTime(final.checkedAt)}: no FireBoard session was linked to this cook.`);
    else if (final?.status === 'failed' || final?.status === 'pending') message(confirmation, `Final capture needs retry${final.error ? ': ' + final.error : '.'}`, true);
    else message(confirmation, 'Unverified: this cook has no saved, dated final-sync confirmation.');
    const setup = section('Setup and Seasoning');
    pairs(setup, [['Location', r.location[0]?.name], ['Equipment', r.equipment.map(x => x.name).join(', ')], ['Method / Recipe', r.method[0]?.name], ['Binder', c.binder], ['Rubs', r.rubLinks.map(link => `${r.rubs.find(x => x.id === link.rub_id)?.name || 'Saved rub'}${link.application_level ? ' — ' + link.application_level : ''}${link.notes ? ' (' + link.notes + ')' : ''}`).join('; ')]]);
    const context = r.events.find(e => e.setup_context)?.setup_context;
    if (context) setup.appendChild(make('p', context, 'history-note'));
    for (const key of ['location', 'equipmentLinks', 'equipment', 'method', 'rubLinks', 'rubs']) if (r.errors[key]) message(setup, `${key}: ${r.errors[key]}`, true);
    const prep = readableSection(r, 'preparation', 'Preparation');
    if (r.preparation[0]) { const p = r.preparation[0]; pairs(prep, [['Trim', p.trim_level], ['Brine / Marinade', p.brine_marinade], ['Injection', p.injection], ['Notes', p.prep_notes]]); }
    else if (!r.errors.preparation) message(prep, 'No preparation record saved.');
    const pieces = readableSection(r, 'pieces', 'Meat Pieces');
    for (const p of r.pieces) { pieces.appendChild(make('h3', `Piece ${p.piece_number}: ${p.meat_cut || 'Not specified'}`)); pairs(pieces, [['Package weight', p.package_weight == null ? null : `${p.package_weight} ${p.weight_unit || ''}`], ['Cook weight', p.cook_weight == null ? null : `${p.cook_weight} ${p.weight_unit || ''}`], ['Bone', p.bone_status], ['Brand / Producer', p.brand_producer], ['Store / Source', p.store_source], ['Grade', p.grade_type], ['Total price', p.total_price == null ? null : '$' + Number(p.total_price).toFixed(2)], ['Price per lb', p.price_per_lb == null ? null : '$' + Number(p.price_per_lb).toFixed(2)], ['Notes', p.meat_note]]); }
    if (!r.pieces.length && !r.errors.pieces) message(pieces, 'No individual meat pieces saved.');
    const temps = readableSection(r, 'sessions', 'Temperature Graph and Probes');
    if (r.errors.roles) message(temps, `Probe assignments could not be loaded: ${r.errors.roles}`, true);
    if (!r.sessions.length && !r.errors.sessions) message(temps, 'No FireBoard session is attached to this cook.');
    for (const entry of r.temperatures) {
      const box = section(entry.session.session_title || 'Stored FireBoard Session', temps);
      if (entry.error) message(box, `Stored temperatures could not be loaded: ${entry.error}`, true);
      else renderGraph(box, entry.rows, c, r.roles);
    }
    const events = readableSection(r, 'events', `Event Log (${r.events.length})`);
    if (!r.events.length && !r.errors.events) message(events, 'No saved events.');
    for (const e of r.events) {
      const row = make('div', null, 'history-event'); row.append(make('time', dateTime(e.event_time)), make('strong', e.event_type || 'Event'));
      if (e.note) row.appendChild(make('div', e.note, 'history-note'));
      const snap = [e.target_temp == null ? '' : `Target ${e.target_temp}°F`, e.phase || '', e.smoker || ''].filter(Boolean);
      if (snap.length) row.appendChild(make('div', snap.join(' • '), 'sub'));
      events.appendChild(row);
    }
    const evaluation = readableSection(r, 'evaluation', 'Evaluation');
    if (r.evaluation[0]) { const e = r.evaluation[0]; pairs(evaluation, [['Overall result', e.overall_result], ['Bark', e.bark], ['Tenderness', e.tenderness], ['Observations', e.observations], ['Changes next time', e.changes_next_time]]); }
    else if (!r.errors.evaluation) message(evaluation, 'No evaluation saved.');
    detail.querySelector('h2').tabIndex = -1; detail.querySelector('h2').focus();
  }
  function renderGraph(parent, rows, cook, roles) {
    const data = graphGroups(rows, cook), groups = data.groups;
    message(parent, `${rows.length} stored samples • graph shows samples within this cook's start and finish times.`);
    if (data.outside) message(parent, `${data.outside} samples outside the cook window are excluded from this graph.`);
    if (data.invalid) message(parent, `${data.invalid} samples have invalid values or unrecognized temperature units and are not graphed.`);
    if (!groups.length) { message(parent, 'No usable temperature samples within this cook window.'); return; }
    const points = groups.flatMap(g => g.points);
    let minT = Infinity, maxT = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) { minT = Math.min(minT, p.time); maxT = Math.max(maxT, p.time); minY = Math.min(minY, p.temp); maxY = Math.max(maxY, p.temp); }
    minY = Math.floor(minY / 10) * 10; maxY = Math.max(minY + 10, Math.ceil(maxY / 10) * 10);
    const W = 760, H = 340, left = 58, right = 18, top = 22, bottom = 48;
    const x = v => left + (v - minT) / Math.max(1, maxT - minT) * (W - left - right);
    const y = v => top + (maxY - v) / (maxY - minY) * (H - top - bottom);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `Stored temperature graph for cook ${cook.cook_id}, in degrees Fahrenheit`); svg.setAttribute('class', 'history-chart');
    const node = (tag, attrs, text) => { const n = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text != null) n.textContent = text; svg.appendChild(n); return n; };
    for (let i = 0; i <= 4; i++) { const temp = minY + (maxY - minY) * i / 4; node('line', { x1: left, x2: W - right, y1: y(temp), y2: y(temp), stroke: '#444' }); node('text', { x: left - 8, y: y(temp) + 5, fill: '#bbb', 'font-size': 14, 'text-anchor': 'end' }, `${Math.round(temp)}°F`); }
    for (let i = 0; i <= 2; i++) { const t = minT + (maxT - minT) * i / 2; node('text', { x: x(t), y: H - 12, fill: '#bbb', 'font-size': 14, 'text-anchor': i === 0 ? 'start' : i === 2 ? 'end' : 'middle' }, new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })); }
    const legend = make('div', null, 'history-legend'), stats = [];
    groups.forEach((g, i) => {
      const color = colors[i % colors.length], pts = downsample(g.points);
      const path = node('path', { d: pts.map((p, j) => `${j ? 'L' : 'M'}${x(p.time).toFixed(1)},${y(p.temp).toFixed(1)}`).join(' '), fill: 'none', stroke: color, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' });
      const dot = pts.length === 1 ? node('circle', { cx: x(pts[0].time), cy: y(pts[0].temp), r: 3, fill: color }) : null;
      const assignment = roles.find(r => `${r.device_uuid || 'unknown-device'}::${r.channel_id}` === g.key);
      const label = assignment?.cook_role || g.label;
      const control = make('label'), checkbox = make('input'); checkbox.type = 'checkbox'; checkbox.checked = true;
      checkbox.addEventListener('change', () => { path.style.display = checkbox.checked ? '' : 'none'; if (dot) dot.style.display = path.style.display; });
      control.style.color = color; control.append(checkbox, make('span', label)); legend.appendChild(control);
      let lo = Infinity, hi = -Infinity, sum = 0;
      for (const p of g.points) { lo = Math.min(lo, p.temp); hi = Math.max(hi, p.temp); sum += p.temp; }
      const purpose = { chamber: 'Smoker / chamber', food: 'Food', other: 'Reference' }[assignment?.role_type] || 'Not assigned';
      stats.push([label, g.label, purpose, g.points.length, `${lo.toFixed(1)}–${hi.toFixed(1)}°F`, `${(sum / g.points.length).toFixed(1)}°F`]);
    });
    const scroll = make('div', null, 'history-scroll'); scroll.appendChild(svg); parent.append(scroll, legend);
    table(parent, ['Probe', 'FireBoard label', 'Saved purpose', 'Samples', 'Range', 'Mean'], stats);
    const unmatched = roles.filter(r => !groups.some(g => `${r.device_uuid || 'unknown-device'}::${r.channel_id}` === g.key));
    if (unmatched.length) message(parent, `${unmatched.length} additional saved probe assignment(s) have no graphed samples in this session.`);
  }
  document.getElementById('cloudSignOut')?.addEventListener('click', () => {
    generation++; cooks = []; selected.clear(); updateSelection(); loaded = false; list.replaceChildren(); detail.replaceChildren(); detail.hidden = true; listView.hidden = false;
    status.textContent = 'Sign in to LDCookLog Cloud to view your history.';
  });
})();
