// Isolated synthetic rehearsal; never operates on real cooking journals.
const LDC_RETENTION_HTML = "<!doctype html><meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'sha256-dB9TvCOG/WUk9ZVevb+e65ffYhWkmZYEvSWke2ZgPcE='; connect-src 'none'; base-uri 'none'\"><title>Synthetic retention validation</title><script>'use strict';\n(() => {\n\n\n/* Pure, independently testable backup and restore planning. */\nconst BACKUP_FORMAT = 'ldcooklog-local-backup';\nconst BACKUP_VERSION = 1;\n\nfunction validateWrap(value){\n  if(!value || !['Foil','Butcher Paper','Foil Boat','Other'].includes(value.wrapMethod) || typeof value.wrapDetail!=='string' || value.wrapDetail.length>300 || (value.wrapMethod==='Other' && !value.wrapDetail.trim()))throw Error('Select a wrap method; describe Other in 300 characters or fewer');\n  return value;\n}\nfunction validateTargets(value){\n  if(!value || typeof value!=='object' || value.unit!=='F')throw Error('Invalid temperature targets');\n  for(const key of ['pitF','meatF'])if(value[key]!==null && (!Number.isFinite(value[key]) || value[key]<0 || value[key]>1000))throw Error('Targets must be between 0 and 1000\u00b0F, or blank');\n  return value;\n}\nfunction validateFireboardSetup(value) {\n  if(value===null)return value;\n  if(!value || typeof value!=='object' || Array.isArray(value) || ![1,2].includes(value.version) || value.model!=='FireBoard 2')throw Error('Invalid FireBoard setup');\n  for(const [key,limit] of [['deviceName',160],['accessories',1000]])if(typeof value[key]!=='string' || value[key].length>limit)throw Error('Invalid FireBoard '+key);\n  if(!Array.isArray(value.channels) || (value.version===1?value.channels.length!==6:value.channels.length>32))throw Error('Invalid FireBoard setup entry count');\n  const seen=new Set();\n  for(const probe of value.channels){\n    if(!probe || !Number.isInteger(probe.channel) || probe.channel<1 || probe.channel>(value.version===1?6:32) || seen.has(probe.channel))throw Error('Invalid or duplicate FireBoard channel');\n    seen.add(probe.channel);\n    if(!['Not used','Pit / ambient','Meat','Other'].includes(probe.role) || !['Not recorded','Wired','Wireless','Other','Wired ambient probe','Wired food probe'].includes(probe.probeType))throw Error('Invalid FireBoard probe choice');\n    if(probe.seriesKey!==undefined && (typeof probe.seriesKey!=='string' || probe.seriesKey.length>2000))throw Error('Invalid FireBoard reading link');\n    if(probe.wiredPort!==undefined && probe.wiredPort!==null && (!Number.isInteger(probe.wiredPort) || probe.wiredPort<1 || probe.wiredPort>6))throw Error('Invalid FireBoard wired port');\n    if(probe.color!==undefined && !['Not recorded','Orange','Silver','Other'].includes(probe.color))throw Error('Invalid FireBoard probe color');\n    if(probe.customColor!==undefined && (typeof probe.customColor!=='string' || probe.customColor.length>100))throw Error('Invalid FireBoard custom color');\n    if(probe.measurement!==undefined && !['Not recorded','Internal / meat','External / ambient'].includes(probe.measurement))throw Error('Invalid FireBoard wireless reading');\n    for(const [key,limit] of [['label',250],['placement',500]])if(typeof probe[key]!=='string' || probe[key].length>limit)throw Error('Invalid FireBoard probe '+key);\n  }\n  return value;\n}\n\nfunction validateCook(c) {\n  if (!c || typeof c !== 'object' || Array.isArray(c) || typeof c.id !== 'string' || !c.id.trim() || c.id.length > 160) throw Error('Invalid cook identifier');\n  if (typeof c.food !== 'string' || c.food.length > 300 || typeof c.cooker !== 'string' || c.cooker.length > 300) throw Error('Invalid cook labels');\n  if (typeof c.startedAt !== 'string' || !Number.isFinite(Date.parse(c.startedAt))) throw Error('Invalid cook start time');\n  if (c.finishedAt !== null && c.finishedAt !== undefined && (typeof c.finishedAt !== 'string' || !Number.isFinite(Date.parse(c.finishedAt)))) throw Error('Invalid finish time');\n  if (!Array.isArray(c.events) || c.events.length > 200000 || !Array.isArray(c.temperatures) || c.temperatures.length > 500000) throw Error('Invalid cook series');\n  if (!c.events.every(e => e && typeof e.type === 'string' && typeof e.at === 'string' && Number.isFinite(Date.parse(e.at)) && typeof e.note === 'string')) throw Error('Invalid cook events');\n  if (!c.temperatures.every(t => t && typeof t.at === 'string' && Number.isFinite(Date.parse(t.at)) && Number.isFinite(t.value) && typeof t.channel === 'string')) throw Error('Invalid temperature samples');\n  if(c.cookingDetails?.fireboardSetup!==undefined)validateFireboardSetup(c.cookingDetails.fireboardSetup);\n  if(c.cookingDetails?.meatPieces!==undefined)validateMeatPieces(c.cookingDetails.meatPieces);\n  if(c.cookingDetails?.rubApplications!==undefined)validateRubApplications(c.cookingDetails.rubApplications);\n  for(const [key,limit] of [['location',300],['recipeReference',2000]])if(c.cookingDetails?.[key]!==undefined && (typeof c.cookingDetails[key]!=='string' || c.cookingDetails[key].length>limit))throw Error('Invalid '+key);\n  if(c.targets!==undefined)validateTargets(c.targets);\n  for(const event of c.events){if(event.wrapMethod!==undefined)validateWrap(event);if(event.targets!==undefined)validateTargets(event.targets);if(event.previousTargets!==undefined)validateTargets(event.previousTargets);}\n  const bindings=(c.cookingDetails?.fireboardSetup?.channels || []).filter(p=>p.seriesKey);\n  const readings=bindings.length?new Set(c.temperatures.map(t=>seriesKey(t))):new Set(),linked=new Set();\n  for(const probe of bindings){\n    if(probe.seriesKey){if(!readings.has(probe.seriesKey))throw Error('FireBoard link does not match an imported reading');\n      if(probe.role!=='Not used'){if(linked.has(probe.seriesKey))throw Error('An imported reading is assigned to more than one active probe');linked.add(probe.seriesKey);}}\n  }\n  return c;\n}\nasync function sha256(s) {\n  const bytes = new TextEncoder().encode(s);\n  const digest = await crypto.subtle.digest('SHA-256', bytes);\n  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');\n}\nfunction backupBody(records, createdAt) {\n  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt, count: records.length, records };\n}\nasync function createBackupForRecords(records, createdAt = new Date().toISOString()) {\n  const sorted = [...records].sort((a, b) => a.id.localeCompare(b.id));\n  for (const record of sorted) validateCook(record);\n  const body = backupBody(sorted, createdAt);\n  return { ...body, sha256: await sha256(JSON.stringify(body)) };\n}\nasync function verifyBackup(backup) {\n  if (!backup || backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION || !Array.isArray(backup.records) || !Number.isSafeInteger(backup.count) || backup.count !== backup.records.length || typeof backup.createdAt !== 'string' || !Number.isFinite(Date.parse(backup.createdAt)) || typeof backup.sha256 !== 'string') throw Error('Unrecognized or damaged backup format');\n  if (backup.records.length > 100000) throw Error('Backup contains too many records');\n  const seen = new Set();\n  for (const row of backup.records) {\n    validateCook(row);\n    if (seen.has(row.id)) throw Error('Backup contains duplicate cook IDs');\n    seen.add(row.id);\n  }\n  if (await sha256(JSON.stringify(backupBody(backup.records, backup.createdAt))) !== backup.sha256) throw Error('Backup checksum does not match; file may be altered or incomplete');\n  return backup.records;\n}\nfunction planRestore(existing, incoming) {\n  const present = new Map(existing.map(c => [c.id, c]));\n  const conflicts = incoming.filter(c => present.has(c.id) && JSON.stringify(present.get(c.id)) !== JSON.stringify(c));\n  if (conflicts.length) throw Error(`${conflicts.length} cook ID conflict(s). No records imported. Preserve both copies and investigate.`);\n  const additions = incoming.filter(c => !present.has(c.id));\n  return { additions, added: additions.length, unchanged: incoming.length - additions.length };\n}\n\n/* One-time, local-only Supabase public-table import. Never sends rows to a server. */\n\nconst RELATIONAL_FORMAT = 'ldcooklog-supabase-relational-export';\nconst RELATIONAL_VERSION = 1;\nconst REQUIRED_TABLES = Object.freeze('cooks events cook_equipment cook_evaluations cook_fireboard_sessions cook_meat_pieces cook_methods cook_preparation cook_rubs cook_sauces equipment fireboard_account_access fireboard_probe_roles fireboard_temperature_samples locations rubs sauces weather'.split(' '));\n\nasync function hash(body) {\n  const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body)));\n  return [...new Uint8Array(hashBytes)].map(n => n.toString(16).padStart(2, '0')).join('');\n}\nasync function verifyRelationalExport(value) {\n  if (!value || value.format !== RELATIONAL_FORMAT || value.version !== RELATIONAL_VERSION || !value.tables || Array.isArray(value.tables) || typeof value.createdAt !== 'string' || typeof value.sha256 !== 'string') throw Error('Not a supported relational archive');\n  const tables = value.tables;\n  for (const required of REQUIRED_TABLES) if (!Object.hasOwn(tables, required)) throw Error(`Missing ${required} table`);\n  const orderedTables = {};\n  let total = 0;\n  for (const table of Object.keys(tables).sort()) {\n    if (!/^[a-z][a-z0-9_]*$/.test(table)) throw Error('Unsafe table name');\n    const {columns, rows} = tables[table] || {};\n    if (!Array.isArray(columns) || !columns.length || !columns.every(col => typeof col === 'string' && /^[a-z][a-z0-9_]*$/.test(col)) || new Set(columns).size !== columns.length || !Array.isArray(rows)) throw Error(`Invalid ${table} table`);\n    total += rows.length;\n    if (total > 1200000) throw Error('Archive exceeds safe record limit');\n    for (const row of rows) {\n      if (!row || Array.isArray(row) || typeof row !== 'object' || Object.keys(row).length !== columns.length || !columns.every(col => Object.hasOwn(row,col) && (row[col] === null || typeof row[col] === 'string'))) throw Error(`Invalid row in ${table}`);\n    }\n    orderedTables[table] = tables[table];\n  }\n  const body = {format: RELATIONAL_FORMAT, version: RELATIONAL_VERSION, createdAt: value.createdAt, tables: orderedTables};\n  if ((await hash(body)) !== value.sha256) throw Error('Relational archive checksum mismatch');\n  return tables;\n}\nfunction asISO(input, label) {\n  if (typeof input !== 'string' || !input.trim()) throw Error(`Missing ${label}`);\n  const normalized = input.trim().replace(/^(\\d{4}-\\d\\d-\\d\\d) /, '$1T').replace(/([+-]\\d\\d)$/, '$1:00');\n  const ms = Date.parse(normalized);\n  if (!Number.isFinite(ms)) throw Error(`Invalid ${label}: ${input.slice(0, 40)}`);\n  return new Date(ms).toISOString();\n}\n/**\n * Check referential completeness BEFORE constructing individual cook records.\n * Never silently omit an orphan event, meat piece, linked FireBoard session,\n * or temperature sample. The source .dump remains intact if a check fails.\n * Some legacy tables are global lookup/configuration tables, not cook children.\n */\nfunction auditRelationalLinks(tables) {\n  const cookIds = new Set(tables.cooks.rows.map(row => row.id));\n  if (cookIds.size !== tables.cooks.rows.length || cookIds.has(null) || cookIds.has('') || cookIds.has(undefined))\n    throw Error('Duplicate or missing cook UUID in source archive');\n  const childNames = [\n    'events', 'cook_equipment', 'cook_evaluations', 'cook_fireboard_sessions',\n    'cook_meat_pieces', 'cook_preparation', 'cook_rubs', 'cook_sauces',\n    'fireboard_probe_roles'\n  ];\n  const orphanCounts = [];\n  for (const name of childNames) {\n    const table = tables[name];\n    // Some installations contain non-per-cook weather records. Check only\n    // tables that actually declare the cook_id relationship.\n    if (!table.columns.includes('cook_id')) continue;\n    const orphans = table.rows.filter(row => !row.cook_id || !cookIds.has(row.cook_id));\n    if (orphans.length) orphanCounts.push(`${name}: ${orphans.length}`);\n  }\n  const sessionIds = new Set(tables.cook_fireboard_sessions.rows.map(row => row.id));\n  const sampleTable = tables.fireboard_temperature_samples;\n  if (sampleTable.rows.length && !sampleTable.columns.includes('cook_fireboard_session_id'))\n    throw Error('FireBoard temperature samples lack their session link column');\n  const lostSamples = sampleTable.rows.filter(row => !row.cook_fireboard_session_id || !sessionIds.has(row.cook_fireboard_session_id));\n  if (lostSamples.length) orphanCounts.push(`fireboard_temperature_samples: ${lostSamples.length}`);\n  if (orphanCounts.length)\n    throw Error(`Migration stopped: orphaned source records would be omitted (${orphanCounts.join(', ')}). Keep the original dump; inspect the relationships.`);\n  return {\n    cooks: tables.cooks.rows.length,\n    events: tables.events.rows.length,\n    linkedFireboardSessions: tables.cook_fireboard_sessions.rows.length,\n    temperatureSamples: sampleTable.rows.length,\n    checkedCookTables: childNames.filter(name => tables[name].columns.includes('cook_id'))\n  };\n}\n\nfunction matchRows(tables, table, field, id) { return tables[table].rows.filter(row => row[field] === id); }\nfunction relationLookups(tables, cook, byTable) {\n  const matchId = (name, id) => id ? tables[name].rows.filter(row => row.id === id) : [];\n  const links = byTable;\n  return {\n    locations: matchId('locations', cook.location_id),\n    cook_methods: matchId('cook_methods', cook.cook_method_id),\n    equipment: [...new Set(links.cook_equipment.map(x => x.equipment_id).filter(Boolean))].flatMap(id => matchId('equipment', id)),\n    rubs: [...new Set(links.cook_rubs.map(x => x.rub_id).filter(Boolean))].flatMap(id => matchId('rubs', id)),\n    sauces: [...new Set(links.cook_sauces.map(x => x.sauce_id).filter(Boolean))].flatMap(id => matchId('sauces', id)),\n  };\n}\nfunction buildLocalCooks(tables) {\n  // Do not silently hide/delete test cooks; preserve all 30, including testing history.\n  const collection = [];\n  const seen = new Set();\n  for (const row of tables.cooks.rows) {\n    const uuid = row.id;\n    if (!uuid || seen.has(uuid)) throw Error('Missing or duplicate database cook UUID');\n    seen.add(uuid);\n    const related = {};\n    for (const table of ['events','cook_equipment','cook_evaluations','cook_fireboard_sessions','cook_meat_pieces','cook_preparation','cook_rubs','cook_sauces','fireboard_probe_roles','weather']) {\n      related[table] = matchRows(tables, table, 'cook_id', uuid);\n    }\n    const sessions = new Set(related.cook_fireboard_sessions.map(x => x.id));\n    related.fireboard_temperature_samples = tables.fireboard_temperature_samples.rows.filter(x => sessions.has(x.cook_fireboard_session_id));\n    const events = related.events.map(e => ({\n      at: asISO(e.event_time, 'event time'),\n      type: e.event_type || 'Event', note: e.note || '',\n      legacyId: e.id || null,\n    })).sort((a,b)=>a.at.localeCompare(b.at));\n    const temperatures = related.fireboard_temperature_samples.map(t => {\n      const value = Number(t.temperature_value);\n      if (!Number.isFinite(value) || t.temperature_value === null) throw Error(`Invalid temperature in sample ${t.id || '(unknown)'}`);\n      return {at:asISO(t.observed_at, 'sample time'), value, channel:t.channel_label || `Channel ${t.channel_index || '?'}`,\n        unit: t.degree_type === '1' || t.degree_type === 'C' ? 'C' : t.degree_type === '2' || t.degree_type === 'F' ? 'F' : 'unknown',\n        legacyId: t.id || null, sessionId:t.cook_fireboard_session_id,\n        deviceUUID:t.device_uuid || null, channelId:String(t.channel_index || t.channel_id || '?')};\n    }).sort((a,b)=>a.at.localeCompare(b.at));\n    const cookerFromNotes = String(row.notes || '').match(/Smoker: (Traeger Ironwood 885|Traeger Pro|Weber 22\" Kettle)/);\n    const cook = {\n      id: uuid,\n      food: row.food || row.cook_id || 'Unnamed cook',\n      cooker: row.smoker || row.cooker || cookerFromNotes?.[1] || 'Not recorded',\n      startedAt: asISO(row.start_time || row.created_at, 'cook start time'),\n      finishedAt: row.finish_time ? asISO(row.finish_time, 'finish time') : null,\n      phase: row.finish_time || row.phase === 'Finished' ? 'Finished' : ({Setup:'Preparation',Cooking:'Cooking',Rest:'Resting','Keep Warm':'Keeping Warm'}[row.phase] || 'Cooking'),\n      events,\n      temperatures,\n      notes: row.notes || '',\n      source: 'Supabase historical migration',\n      isTestCook: /\\[TEST COOK: EXCLUDE FROM ANALYSIS\\]/.test(row.notes || ''),\n      legacy: { cook: row, related, lookups: relationLookups(tables,row,related) }\n    };\n    validateCook(cook);\n    collection.push(cook);\n  }\n  return collection;\n}\nasync function migrateRelationalExport(exported) {\n  const tables = await verifyRelationalExport(exported);\n  const audit = auditRelationalLinks(tables);\n  const cooks = buildLocalCooks(tables);\n  if (cooks.reduce((sum, cook) => sum + cook.events.length, 0) !== audit.events ||\n      cooks.reduce((sum, cook) => sum + cook.temperatures.length, 0) !== audit.temperatureSamples)\n    throw Error('Migration stopped: event or FireBoard sample count changed during conversion.');\n  return { cooks, audit, tables: Object.fromEntries(Object.entries(tables).map(([name,value])=>[name,value.rows.length])) };\n}\n\n// Offline import of completed sessions exported by the local Mac helper.\n// Keep original session and complete chart beside normalized samples.\nfunction completedSession(value, now = Date.now()) {\n  if (value?.format !== 'ldcooklog-fireboard-completed' || value.version !== 1) throw Error('Not a completed FireBoard export');\n  const session = value.session;\n  if (!session || !/^\\d+$/.test(String(session.id)) || !Array.isArray(value.chart)) throw Error('Invalid FireBoard session');\n  const start = Date.parse(session.start_time), end = Date.parse(session.end_time);\n  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end > now) throw Error('Choose a completed session with valid start and end times');\n  let temperatures = [];\n  for (let index=0;index<value.chart.length;index++) {\n    const series = value.chart[index];\n    if (!Array.isArray(series.x) || !Array.isArray(series.y) || series.x.length !== series.y.length) throw Error('FireBoard series has unmatched times and values');\n    const unit = Number(series.degreetype) === 1 ? 'C' : Number(series.degreetype) === 2 ? 'F' : null;\n    if (!unit) throw Error('Unknown series units. Export temperature data without Drive percentage data');\n    for (let i=0;i<series.x.length;i++) {\n      const raw = series.x[i], ms = typeof raw === 'number' ? raw * (Math.abs(raw)<1e12 ? 1000 : 1) : Date.parse(raw);\n      const temp = series.y[i];\n      if (!Number.isFinite(ms) || typeof temp !== 'number' || !Number.isFinite(temp)) throw Error('Invalid temperature or time; entire session import stopped');\n      temperatures.push({at:new Date(ms).toISOString(),value:temp,unit,channel:String(series.label || `Channel ${index+1}`),channelId:String(series.channel_id ?? index),deviceUUID:series.device || null,sessionId:String(session.id)});\n      if (temperatures.length>500000) throw Error('Session exceeds supported sample limit');\n    }\n  }\n  temperatures.sort((a,b)=>a.at.localeCompare(b.at));\n  return { session, chart:value.chart, temperatures };\n}\nfunction attachSession(state, cookId, exported) {\n  const cook = state.records.find(c=>c.id===cookId);\n  if (!cook) throw Error('Open the cook to receive this session');\n  const imported = completedSession(exported);\n  const id = String(imported.session.id);\n  const prior = (cook.completedSessions || []).find(s=>String(s.session.id)===id);\n  if (prior) {\n    if (JSON.stringify(prior) !== JSON.stringify({session:imported.session,chart:imported.chart})) throw Error('Conflicting FireBoard session. Original import retained');\n    return state;\n  }\n  if ((cook.legacy?.related?.cook_fireboard_sessions || []).some(s=>String(s.fireboard_session_id)===id)) throw Error('Session already exists in the migrated cook. Inspect before importing again');\n  cook.completedSessions ||= [];\n  cook.completedSessions.push({session:imported.session,chart:imported.chart});\n  cook.temperatures.push(...imported.temperatures);\n  return state;\n}\n// Distinguish devices/sessions and probe identities even if labels repeat.\nconst seriesKey = sample => JSON.stringify([sample.sessionId || '',sample.deviceUUID || '',sample.channelId || sample.channel,sample.channel]);\nfunction comparisonSeries(cook, key) {\n  const samples = cook.temperatures.filter(t=>seriesKey(t)===key);\n  if (samples.some(t=>t.unit !== 'C' && t.unit !== 'F')) throw Error('Unknown temperature units; comparison stopped');\n  return samples.map(t=>({minutes:(Date.parse(t.at)-Date.parse(cook.startedAt))/60000, fahrenheit:t.unit==='C'?t.value*9/5+32:t.value})).sort((a,b)=>a.minutes-b.minutes);\n}\n\n\n\n\n\n\nconst cookTransitions = { 'Serve / Slice / Pull': [['Cooking','Resting','Keeping Warm'], 'Serving'], 'Meat On': [['Preparation'], 'Cooking'], 'Rest Start': [['Cooking','Keeping Warm'], 'Resting'], 'Keep Warm': [['Cooking','Resting'], 'Keeping Warm'], 'Cook Finished': [['Cooking','Resting','Keeping Warm','Serving'], 'Finished'] };\nfunction lidIsOpen(cook){return (cook.events || []).filter(e=>e.type==='Lid Open' || e.type==='Lid Closed').at(-1)?.type==='Lid Open';}\nfunction availableActions(cook) {\n  const phase=cook.phase || (cook.finishedAt?'Finished':'Cooking');\n  if(phase==='Finished')return [];\n  const steps=Object.keys(cookTransitions).filter(type=>cookTransitions[type][0].includes(phase));\n  const allowed=new Set([...steps,...(phase==='Cooking'?['Wrapped','Target Change']:[]),lidIsOpen(cook)?'Lid Closed':'Lid Open','Spritz','Note']);\n  return ['Meat On','Wrapped','Rest Start','Keep Warm','Cook Finished','Serve / Slice / Pull','Spritz','Lid Open','Lid Closed','Target Change','Note'].filter(type=>allowed.has(type));\n}\nconst FORMAT = 'ldcooklog-recovery';\nconst emptyState = () => ({ records: [], relationalArchives: [] });\nasync function digest(text) {\n  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));\n  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');\n}\nasync function validateState(state) {\n  if (!state || !Array.isArray(state.records) || !Array.isArray(state.relationalArchives)) throw Error('Invalid recovery contents');\n  const ids = new Set();\n  for (const cook of state.records) {\n    validateCook(cook);\n    if (ids.has(cook.id)) throw Error('Duplicate cook ID');\n    ids.add(cook.id);\n  }\n  const hashes = new Set();\n  for (const archive of state.relationalArchives) {\n    await verifyRelationalExport(archive);\n    if (hashes.has(archive.sha256)) throw Error('Duplicate source archive');\n    hashes.add(archive.sha256);\n    if (!archive.tables.cooks.rows.every(row => ids.has(row.id))) throw Error('Recovery omits a migrated cook');\n  }\n  return state;\n}\n// Hash the exact UTF-8 payload string; Swift and JavaScript never need to agree\n// on JSON object key ordering, number formatting, or Unicode escaping.\nasync function seal(state, revision) {\n  await validateState(state);\n  if (!Number.isSafeInteger(revision) || revision < 1) throw Error('Invalid revision');\n  const payload = JSON.stringify({ version: 1, revision, createdAt: new Date().toISOString(), state });\n  return { format: FORMAT, version: 1, payload, sha256: await digest(payload) };\n}\nasync function unseal(envelope) {\n  if (!envelope || envelope.format !== FORMAT || envelope.version !== 1 || typeof envelope.payload !== 'string' || await digest(envelope.payload) !== envelope.sha256) throw Error('Damaged recovery snapshot');\n  const body = JSON.parse(envelope.payload);\n  if (body.version !== 1 || !Number.isSafeInteger(body.revision) || body.revision < 1 || !Number.isFinite(Date.parse(body.createdAt))) throw Error('Unsupported snapshot');\n  await validateState(body.state);\n  return body;\n}\nasync function importArchive(state, archive) {\n  if (archive.format !== RELATIONAL_FORMAT) throw Error('Choose the .relational.json migration file');\n  const migration = await migrateRelationalExport(archive);\n  const plan = planRestore(state.records, migration.cooks);\n  return { state: { records: [...state.records, ...plan.additions], relationalArchives: state.relationalArchives.some(x => x.sha256 === archive.sha256) ? state.relationalArchives : [...state.relationalArchives, archive] }, audit: migration.audit, counts: migration.tables };\n}\nclass CookStore {\n  constructor(adapter) { this.adapter = adapter; this.queue = Promise.resolve(); }\n  async read() {\n    const text = await this.adapter.read();\n    return text ? await unseal(JSON.parse(text)) : { revision: 0, state: emptyState() };\n  }\n  mutate(change) {\n    const next = this.queue.then(async () => {\n      const before = await this.read();\n      const state = await change(structuredClone(before.state));\n      const envelope = await seal(state, before.revision + 1);\n      await this.adapter.commit(JSON.stringify(envelope), before.revision);\n      return state;\n    });\n    this.queue = next.catch(() => {});\n    return next;\n  }\n  async migrate(archive) {\n    let report;\n    await this.mutate(async state => { report = await importArchive(state, archive); return report.state; });\n    return report;\n  }\n  restore(envelope) {\n    return this.mutate(async () => structuredClone((await unseal(envelope)).state));\n  }\n  add(food, cooker) {\n    if (!food.trim() || !cooker.trim()) return Promise.reject(Error('Enter food and cooker'));\n    return this.mutate(state => {\n      state.records.push({ id: crypto.randomUUID(), food: food.trim(), cooker: cooker.trim(), startedAt: new Date().toISOString(), finishedAt: null, phase: 'Preparation', events: [], temperatures: [], notes: '', source: 'LDCookLog 2.0' });\n      return state;\n    });\n  }\n  importSession(id, value) { return this.mutate(state => attachSession(state, id, value)); }\n  profile(id, value) {\n    return this.mutate(state => {\n      const cook = state.records.find(c => c.id === id);\n      if (!cook) throw Error('Cook not found');\n      const limits = {food:300,cooker:300,method:300,weight:100,equipment:1000,preparation:4000,rubs:1000,sauces:1000};\n      for (const [key,limit] of Object.entries(limits)) if (typeof value[key] !== 'string' || value[key].length>limit) throw Error('Invalid '+key);\n      if (!value.food.trim() || !value.cooker.trim() || typeof value.isTestCook !== 'boolean') throw Error('Enter food, cooker and test status');\n      const start = Date.parse(value.startedAt), end = value.finishedAt ? Date.parse(value.finishedAt) : null;\n      if (!Number.isFinite(start) || (end!==null && (!Number.isFinite(end) || end<start))) throw Error('Finish must be on or after a valid start time');\n      if (value.rating!==null && (!Number.isInteger(value.rating) || value.rating<1 || value.rating>5)) throw Error('Rating must be 1 to 5');\n      cook.food=value.food.trim();cook.cooker=value.cooker.trim();cook.startedAt=new Date(start).toISOString();\n      cook.finishedAt=end===null?null:new Date(end).toISOString();\n      if (end!==null) cook.phase='Finished';\n      else if (cook.phase==='Finished') cook.phase='Cooking';\n      cook.isTestCook=value.isTestCook;\n      cook.cookingDetails={...cook.cookingDetails,...Object.fromEntries(Object.keys(limits).filter(key=>!['food','cooker'].includes(key)).map(key=>[key,value[key]]))};\n      cook.cookingDetails.rating=value.rating;\n      for(const [key,options] of Object.entries({trim:['','None','Light','Moderate','Heavy'],brineMarinade:['','None','Dry brine','Wet brine','Marinade'],injection:['','No','Yes']})){\n        if(value[key]!==undefined){if(!options.includes(value[key]))throw Error('Invalid preparation choice');cook.cookingDetails[key]=value[key]}\n      }\n      if(value.binder!==undefined){if(typeof value.binder!=='string' || value.binder.length>500)throw Error('Binder is too long');cook.cookingDetails.binder=value.binder}\n      if(value.fireboardSetup!==undefined)cook.cookingDetails.fireboardSetup=structuredClone(validateFireboardSetup(value.fireboardSetup));\n      for(const [key,limit] of [['location',300],['recipeReference',2000]])if(value[key]!==undefined){if(typeof value[key]!=='string' || value[key].length>limit)throw Error('Invalid '+key);cook.cookingDetails[key]=value[key];}\n      if(value.meatPieces!==undefined)cook.cookingDetails.meatPieces=structuredClone(validateMeatPieces(value.meatPieces));\n      if(value.rubApplications!==undefined)cook.cookingDetails.rubApplications=structuredClone(validateRubApplications(value.rubApplications));\n      // Legacy relational rows and original archives are immutable evidence.\n      return state;\n    });\n  }\n  details(id, notes, evaluation, review) {\n    return this.mutate(state => {\n      const cook = state.records.find(c => c.id === id);\n      if (!cook) throw Error('Cook not found');\n      if (typeof notes !== 'string' || notes.length > 20000 || typeof evaluation !== 'string' || evaluation.length > 20000) throw Error('Notes are too long');\n      cook.notes = notes;\n      cook.evaluation = evaluation;\n      if(review!==undefined){\n        if(!review || typeof review!=='object' || Array.isArray(review))throw Error('Invalid evaluation');\n        for(const key of ['overallResult','bark'])if(!['','Excellent','Good','Fair','Poor'].includes(review[key]))throw Error('Invalid evaluation choice');\n        if(!['','Tough','Slightly Tough','Just Right','Too Tender'].includes(review.tenderness))throw Error('Invalid tenderness choice');\n        for(const key of ['observations','changesNextTime'])if(typeof review[key]!=='string' || review[key].length>20000)throw Error('Evaluation notes are too long');\n        cook.evaluationDetails={overallResult:review.overallResult,bark:review.bark,tenderness:review.tenderness,observations:review.observations,changesNextTime:review.changesNextTime};\n      }\n      return state;\n    });\n  }\n  targets(id,value,note=''){\n    validateTargets(value);\n    if(typeof note!=='string' || note.length>2000)return Promise.reject(Error('Target note is too long'));\n    return this.mutate(state=>{\n      const cook=state.records.find(c=>c.id===id);if(!cook)throw Error('Cook not found');\n      if(cook.phase==='Finished' || cook.finishedAt)throw Error('This cook is finished');\n      const previousTargets=structuredClone(cookTargets(cook));cook.targets=structuredClone(value);\n      cook.events.push({id:crypto.randomUUID(),at:new Date().toISOString(),type:'Target Change',note,previousTargets,targets:structuredClone(value)});\n      return state;\n    });\n  }\n  event(id, type, note = '', detail = null) {\n    return this.mutate(state => {\n      const cook = state.records.find(c => c.id === id);\n      if (!cook) throw Error('Cook not found');\n      const phase = cook.phase || (cook.finishedAt ? 'Finished' : 'Cooking');\n      if (phase === 'Finished') throw Error('This cook is finished');\n      if(type==='Lid Open' && lidIsOpen(cook))throw Error('Lid is already open');\n      if(type==='Lid Closed' && !lidIsOpen(cook))throw Error('Lid is already closed');\n      if(type==='Wrapped' && phase!=='Cooking')throw Error('Wrapping is available during cooking');\n      if(detail!==null){if(type!=='Wrapped')throw Error('Wrap details require a Wrapped event');validateWrap(detail);}\n      const transition = cookTransitions[type];\n      if (transition && !transition[0].includes(phase)) throw Error(`Cannot ${type.toLowerCase()} during ${phase.toLowerCase()}`);\n      const at = new Date().toISOString();\n      cook.events.push({ id: crypto.randomUUID(), at, type, note,...(detail?{wrapMethod:detail.wrapMethod,wrapDetail:detail.wrapDetail}: {}) });\n      if (transition) cook.phase = transition[1];\n      if (type === 'Meat On') cook.startedAt = at;\n      if (type === 'Cook Finished') cook.finishedAt = at;\n      return state;\n    });\n  }\n}\n\nwindow.__rehearsal = {\n  verify: async text => unseal(JSON.parse(text)),\n  seal: async (state,revision) => JSON.stringify(await seal(state,revision)),\n  reseal: async (text,revision) => JSON.stringify(await seal((await unseal(JSON.parse(text))).state,revision))\n};\n})();\n</script>";
// Scriptable FileManager APIs only. No database, credentials or network requests.
// Injectable validator runs the shared recovery/migration checks in WebView.
function createStorage({local, cloud, verify, uuid, namespace = 'development', waitForDownload = work => work(), waitForVerification = work => work()}) {
  if (!['development','restore-check'].includes(namespace)) throw Error('Unsupported journal namespace');
  const isolated = namespace === 'restore-check';
  const localName = isolated ? 'LDCookLog-2-Restore-Check' : 'LDCookLog-2-Development';
  const cloudName = isolated ? 'LDCookLog-2-Restore-Check-Recovery' : 'LDCookLog-2-Development-Recovery';
  const root = local.joinPath(local.documentsDirectory(), localName);
  local.createDirectory(root, true);
  const journal = local.joinPath(root, 'journal');
  local.createDirectory(journal, true);
  const identity = local.joinPath(root, 'device-id');
  const validID = value => /^[a-f0-9-]{36}$/i.test(value);
  let device = local.fileExists(identity) ? local.readString(identity) : uuid();
  if (!validID(device)) throw Error('Invalid device identity; do not reset files.');
  if (!local.fileExists(identity)) local.writeString(identity, device);
  const marker = local.joinPath(root, 'initialized');
  const pattern = /^(\d{16})-([a-f0-9-]{36})\.recovery\.json$/i;
  const entries = () => local.listContents(journal).filter(n => pattern.test(n)).sort().reverse();
  const rev = name => Number(name.match(pattern)[1]);
  const safeRev = value => Number.isSafeInteger(value) && value >= 1;
  let queue = Promise.resolve();
  const serialized = work => {
    const task = queue.then(work);
    queue = task.catch(() => {});
    return task;
  };
  async function read() {
    const files = entries();
    if (!files.length) {
      if (local.fileExists(marker)) throw Error('Journal files are missing. Restore a snapshot; no reset was performed.');
      return null;
    }
    if (!safeRev(rev(files[0]))) throw Error('Invalid journal revision');
    if (files.length > 1 && rev(files[0]) === rev(files[1])) throw Error('Concurrent journals conflict. Choose a recovery snapshot.');
    const text = local.readString(local.joinPath(journal, files[0]));
    const body = await verify(text);
    if (body.revision !== rev(files[0])) throw Error('Journal revision mismatch');
    return text;
  }
  async function append(text, expectedRevision, repair = false) {
    const body = await verify(text);
    let revision;
    if (repair) {
      // A reviewed snapshot may replace a damaged newest entry explicitly.
      const files = entries();
      revision = files.length ? rev(files[0]) : 0;
      if (!Number.isSafeInteger(revision)) throw Error('Invalid local revision');
      revision++;
      text = await repair(text, revision);
      const repaired = await verify(text);
      if (repaired.revision !== revision) throw Error('Invalid repaired revision');
    } else {
      const current = await read();
      const before = current ? (await verify(current)).revision : 0;
      if (!Number.isSafeInteger(expectedRevision) || before !== expectedRevision || body.revision !== before + 1) throw Error('Journal changed; reopen before saving.');
      revision = body.revision;
    }
    const id = uuid();
    if (!validID(id)) throw Error('Invalid snapshot identity');
    const name = String(revision).padStart(16, '0') + '-' + id + '.recovery.json';
    const target = local.joinPath(journal, name);
    if (local.fileExists(target)) throw Error('Snapshot collision; no file replaced');
    // Never overwrite a journal or keep a mutable primary. An interrupted write
    // leaves an explicit recovery condition instead of quietly losing a save.
    local.writeString(marker, 'ldcooklog-scriptable-v1');
    local.writeString(target, text);
    if (local.readString(target) !== text) throw Error('Snapshot readback failed; recover before continuing.');
    await verify(local.readString(target));
    await read(); // Detect a competing same-revision writer before reporting success.
    return true;
  }
  function cloudRoot() {
    const base = cloud.joinPath(cloud.documentsDirectory(), cloudName);
    cloud.createDirectory(base, true);
    return base;
  }
  async function backupStatus() {
    let files = entries();
    let staged = 0, failed = 0, current = null;
    try {
      const destination = cloud.joinPath(cloudRoot(), device);
      cloud.createDirectory(destination, true);
      for (const name of files) {
        try {
          const text = local.readString(local.joinPath(journal, name));
          await verify(text);
          if (name === files[0]) current = {revision:rev(name), sha256:JSON.parse(text).sha256};
          const path = cloud.joinPath(destination, name);
          if (!cloud.fileExists(path)) cloud.writeString(path, text);
          // Do not force a download during a save/retry: it can block offline.
          if (!cloud.isFileDownloaded(path) || cloud.readString(path) !== text) throw Error('Cloud copy is not locally verifiable');
          staged++;
        } catch { failed++; }
      }
    } catch { failed = files.length; }
    // Local verification does not depend on successful cloud staging.
    if (!current && files.length) {
      try { const text=local.readString(local.joinPath(journal,files[0]));await verify(text);current={revision:rev(files[0]),sha256:JSON.parse(text).sha256}; }
      catch { /* A damaged newest journal cannot gain proof from an older copy. */ }
    }
    const mac = await macVerification(current);
    let retention = 'Older snapshots kept until current Mac verification is available.';
    if (mac.verified && !failed) {
      try { retention = await retainSnapshots(files); files = entries(); staged = files.length; }
      catch { retention = 'Snapshot cleanup paused; current recovery copies remain available.'; }
    }
    let bytes = 0;
    for (const name of files) { try { bytes += encodeURIComponent(local.readString(local.joinPath(journal,name))).replace(/%[A-F0-9]{2}/g,'x').length; } catch {} }
    const capacity = `Local snapshots use about ${Math.ceil(bytes/1048576)} MiB.` + (bytes >= 128*1048576 ? ' Storage warning: over 128 MiB. Keep the Mac awake for verification and cleanup.' : '');
    return {local: files.length, uploaded: 0, pending: files.length, failed, storageWarning:bytes >= 128*1048576, mac,
      message: `${staged} copies staged in iCloud Drive; ${failed} could not be staged. Upload completion is unconfirmed. ${mac.message} ${retention} ${capacity}`};
  }
  async function retainSnapshots(files) {
    if (files.length <= 20) return 'Recovery retention is within its 20-recent-copy target.';
    // Only this device/namespace, after proof of its exact newest snapshot.
    const keep = new Set([...files.slice(0,20), files.at(-1)]), archives = new Set(), revisions = new Set(), candidates = [];
    const destination=cloud.joinPath(cloudRoot(),device);
    for (const name of files) {
      const path=local.joinPath(journal,name), text=local.readString(path), body=await verify(text);
      if (body.revision !== rev(name) || revisions.has(body.revision)) throw Error('Conflicting retention revisions');
      revisions.add(body.revision);
      for (const archive of JSON.parse(JSON.parse(text).payload).state.relationalArchives) {
        if (!archives.has(archive.sha256)) { keep.add(name); archives.add(archive.sha256); }
      }
      const cloudPath=cloud.joinPath(destination,name);
      if (!cloud.isFileDownloaded(cloudPath) || cloud.readString(cloudPath)!==text) throw Error('Cloud bytes unavailable');
      candidates.push({name,path,cloudPath,text});
    }
    // Validate every eligible copy before removing any. Never touch another
    // device, the independent Mac copies, or original database exports.
    for (const row of candidates) {
      if (local.readString(row.path)!==row.text || cloud.readString(row.cloudPath)!==row.text) throw Error('Snapshot changed');
    }
    let count=0;
    for (const row of candidates) if (!keep.has(row.name)) {
      cloud.remove(row.cloudPath);
      local.remove(row.path);
      count++;
    }
    return `${count} older snapshot pairs removed after Mac verification; first, recent and source-archive recovery points kept.`;
  }
  async function macVerification(current) {
    const missing = {verified:false, message:'Mac independent-copy report is not available yet.'};
    try {
      const folder=cloud.joinPath(cloud.joinPath(cloud.documentsDirectory(),'LDCookLog-2-Mac-Verification'),namespace);
      const path=cloud.joinPath(folder,device+'.json');
      if (!cloud.fileExists(path)) return missing;
      if (!cloud.isFileDownloaded(path)) await waitForVerification(()=>cloud.downloadFileFromiCloud(path));
      const text=cloud.readString(path);
      if (text.length>4096) throw Error('Oversized report');
      const report=JSON.parse(text), checked=Date.parse(report.checkedAt), verified=Date.parse(report.verifiedAt);
      const timestamp=value=>typeof value==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/.test(value);
      if (report.format!=='ldcooklog-mac-copy-report' || report.version!==1 || report.namespace!==namespace || report.device!==device ||
          !['verified','failed'].includes(report.health) || !['manual','scheduled'].includes(report.trigger) || !safeRev(report.revision) ||
          typeof report.sha256!=='string' || !/^[a-f0-9]{64}$/.test(report.sha256) || !timestamp(report.checkedAt) || !timestamp(report.verifiedAt) || !Number.isFinite(checked) || !Number.isFinite(verified) ||
          checked>Date.now()+300000 || verified>Date.now()+300000 || verified>checked+300000) throw Error('Invalid report');
      if (report.health==='failed') return {verified:false,health:'failed',revision:report.revision,message:`Mac reported a failed backup attempt. Last independently verified copy: revision ${report.revision}.`};
      if (Date.now()-checked>900000) return {verified:false,revision:report.revision,message:`Mac report is over 15 minutes old. Last verified copy: revision ${report.revision}. Keep the Mac awake to refresh it.`};
      if (!current || report.revision!==current.revision || report.sha256!==current.sha256)
        return {verified:false,revision:report.revision,message:`Mac last verified revision ${report.revision}. This journal is awaiting an independent Mac copy.`};
      const capacity = report.capacity;
      const capacityNote = capacity && Number.isSafeInteger(capacity.bytes) && capacity.bytes >= 0 && Number.isSafeInteger(capacity.limit) && capacity.limit > 0 ? ` Mac backup storage: ${Math.ceil(capacity.bytes/1048576)} of ${Math.ceil(capacity.limit/1048576)} MiB.${capacity.bytes >= capacity.limit*.8 ? ' Storage warning: over 80% of the limit.' : ''}` : '';
      return {verified:true,revision:report.revision,message:`Mac independent copy verified for this revision (${report.revision}) at ${new Date(verified).toLocaleString()}.${capacityNote}`};
    } catch {
      return {verified:false,message:'Mac verification report is unavailable or could not be validated. Local snapshots remain available.'};
    }
  }
  const tokens = new Map();
  async function listSnapshots() {
    tokens.clear();
    const found = [];
    function add(manager, path, label, revision) {
      const token = String(found.length);
      tokens.set(token, {manager, path, revision});
      found.push({token, label});
    }
    for (const name of entries()) add(local, local.joinPath(journal, name), `This iPhone · revision ${rev(name)}`, rev(name));
    try {
      const bases = [cloudRoot()];
      // Read original iCloud snapshots for the isolated trial. No original
      // local journal is read and no file is written to the source cloud root.
      if (isolated) bases.push(cloud.joinPath(cloud.documentsDirectory(), 'LDCookLog-2-Development-Recovery'));
      for (const base of bases) {
      if (!cloud.fileExists(base)) continue;
      for (const id of cloud.listContents(base).filter(validID)) {
        const dir = cloud.joinPath(base, id);
        if (!cloud.isDirectory(dir)) continue;
        for (const name of cloud.listContents(dir).filter(n => pattern.test(n)).sort().reverse()) {
          add(cloud, cloud.joinPath(dir, name), `iCloud copy (upload unconfirmed) · revision ${rev(name)} · device ${id.slice(0,8)}`, rev(name));
        }
      }
      }
    } catch { /* Local recovery remains available when iCloud is unavailable. */ }
    return found;
  }
  async function readSnapshot(token) {
    const source = tokens.get(token);
    if (!source) throw Error('Unknown recovery selection; browse again');
    if (source.manager === cloud && !cloud.isFileDownloaded(source.path)) await waitForDownload(() => cloud.downloadFileFromiCloud(source.path));
    const text = source.manager.readString(source.path);
    const body = await verify(text);
    if (body.revision !== source.revision) throw Error('Recovery snapshot revision mismatch');
    return text;
  }
  return {
    read: () => serialized(read),
    commit: (text, expectedRevision) => serialized(() => append(text, expectedRevision)),
    repair: (text, reseal) => serialized(() => append(text, null, reseal)),
    backupStatus: () => serialized(backupStatus),
    listSnapshots: () => serialized(listSnapshots),
    readSnapshot: token => serialized(() => readSnapshot(token))
  };
}


// Runs only synthetic data in newly created, uniquely named rehearsal roots.
async function retentionRehearsal() {
  const localManager=FileManager.local(), cloudManager=FileManager.iCloud();
  const identity=UUID.string();
  const localRoot=localManager.joinPath(localManager.documentsDirectory(),'LDCookLog-2-Synthetic-Rehearsals/'+identity);
  const cloudRoot=cloudManager.joinPath(cloudManager.documentsDirectory(),'LDCookLog-2-Synthetic-Rehearsals/'+identity);
  if(localManager.fileExists(localRoot) || cloudManager.fileExists(cloudRoot))throw Error('Rehearsal folder already exists');
  localManager.createDirectory(localRoot,true);cloudManager.createDirectory(cloudRoot,true);
  function manager(original,root) {
    original.createDirectory(root,true);
    const adapter={documentsDirectory:()=>root};
    for(const name of ['joinPath','createDirectory','fileExists','readString','writeString','listContents','isDirectory','isFileDownloaded','downloadFileFromiCloud','remove'])adapter[name]=(...args)=>original[name](...args);
    return adapter;
  }
  const local=manager(localManager,localRoot),cloud=manager(cloudManager,cloudRoot);
  const web=new WebView(),base='https://ldcooklog.invalid/';
  web.shouldAllowRequest=request=>request.url===base || request.url==='about:blank';
  async function bounded(work) {
    let timer;
    const expired=new Promise((_,reject)=>{timer=Timer.schedule(15000,false,()=>reject(Error('Synthetic validation timed out')))});
    try{return await Promise.race([Promise.resolve().then(work),expired])}finally{timer.invalidate()}
  }
  await bounded(()=>web.loadHTML(LDC_RETENTION_HTML,base));
  async function invoke(operation,args) {
    const result=await bounded(()=>web.evaluateJavaScript(`{const done=completion;window.__rehearsal[${JSON.stringify(operation)}](...${JSON.stringify(args)}).then(value=>done(JSON.stringify({value})),()=>done(JSON.stringify({error:true})));} 'synthetic-operation-started';`,true));
    const parsed=JSON.parse(result);if(parsed.error)throw Error('Synthetic checksum/schema validation failed');return parsed.value;
  }
  const config={local,cloud,verify:async text=>invoke('verify',[text]),uuid:()=>UUID.string()};
  const storage=createStorage(config);
  const state={records:[{id:'synthetic-retention-cook',food:'Synthetic ribs',cooker:'Synthetic kettle',startedAt:'2026-01-01T10:00:00Z',finishedAt:'2026-01-01T12:00:00Z',phase:'Finished',events:[{id:'synthetic-on',type:'Meat On',at:'2026-01-01T10:00:00Z',note:'Synthetic event'}],temperatures:[{at:'2026-01-01T11:00:00Z',value:225,unit:'F',channel:'Synthetic pit'}],notes:'Synthetic retention notes',evaluation:'Synthetic evaluation',cookingDetails:{method:'No wrap',equipment:'Synthetic kettle',preparation:'Synthetic dry brine',rating:4},isTestCook:true}],relationalArchives:[]};
  let latest;
  for(let revision=1;revision<=26;revision++){state.records[0].notes='Synthetic revision '+revision;latest=await invoke('seal',[state,revision]);await storage.commit(latest,revision-1)}
  const before=await storage.backupStatus();if(before.local!==26)throw Error('Snapshots changed before independent-proof test');
  // A simulated receipt exercises the proof-gated cleanup branch. This is
  // explicitly not evidence of a real Mac copy or of real data protection.
  const device=local.readString(local.joinPath(localRoot,'LDCookLog-2-Development/device-id'));
  const reportFolder=cloud.joinPath(cloudRoot,'LDCookLog-2-Mac-Verification/development');cloud.createDirectory(reportFolder,true);
  cloud.writeString(cloud.joinPath(reportFolder,device+'.json'),JSON.stringify({format:'ldcooklog-mac-copy-report',version:1,namespace:'development',device,health:'verified',revision:26,sha256:JSON.parse(latest).sha256,checkedAt:new Date().toISOString(),verifiedAt:new Date().toISOString(),trigger:'manual'}));
  const after=await storage.backupStatus();if(!after.mac.verified || after.local!==21)throw Error('Synthetic cleanup did not keep first and newest twenty');
  const reopened=createStorage(config);if(await reopened.read()!==latest)throw Error('Reopening after cleanup changed latest snapshot');
  const journal=local.joinPath(localRoot,'LDCookLog-2-Development/journal');
  const names=local.listContents(journal).sort();if(!names[0].startsWith('0000000000000001-') || !names[1].startsWith('0000000000000007-'))throw Error('Required synthetic recovery points missing');
  const listed=await reopened.listSnapshots(),selected=listed.find(row=>row.label.startsWith('iCloud copy') && row.label.includes('revision 26 '));
  if(!selected)throw Error('Synthetic cloud recovery copy missing');
  const selectedText=await reopened.readSnapshot(selected.token);
  const restoreLocal=manager(localManager,localManager.joinPath(localRoot,'Fresh restore'));
  const restored=createStorage({...config,local:restoreLocal});
  await restored.commit(await invoke('reseal',[selectedText,1]),0);
  const recovered=await invoke('verify',[await createStorage({...config,local:restoreLocal}).read()]);
  if(JSON.stringify(recovered.state)!==JSON.stringify(state))throw Error('Fresh synthetic journal differs after restoration');
  let cleanup=true;
  try{cloudManager.remove(cloudRoot);localManager.remove(localRoot)}catch{cleanup=false}
  return 'IPHONE RETENTION PASS: 26 synthetic saves; 21 snapshots retained; first and newest twenty kept.\nREOPEN / FRESH-JOURNAL RECOVERY PASS: exact synthetic cook, readings, notes and setup recovered.\nMac receipt was simulated for this isolated test; this does not verify a real Mac backup.\n'+(cleanup?'Synthetic rehearsal folders removed.':'Synthetic rehearsal folders kept because cleanup could not finish.')+'\nWorking journal, real recovery copies, original archives and credentials were not accessed.';
}
try {
  const result=await retentionRehearsal();const alert=new Alert();alert.title='LDCookLog synthetic retention rehearsal';alert.message=result;alert.addAction('Done');await alert.presentAlert();
} catch {
  const alert=new Alert();alert.title='Synthetic retention rehearsal did not complete';alert.message='Working cooking data and real backups were not accessed. Keep the synthetic rehearsal folders for diagnosis and report this message.';alert.addAction('Done');await alert.presentAlert();
}
Script.complete();
