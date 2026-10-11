// Offline import of completed sessions exported by the local Mac helper.
// Keep original session and complete chart beside normalized samples.
export function completedSession(value, now = Date.now()) {
  if (value?.format !== 'ldcooklog-fireboard-completed' || value.version !== 1) throw Error('Not a completed FireBoard export');
  const session = value.session;
  if (!session || !/^\d+$/.test(String(session.id)) || !Array.isArray(value.chart)) throw Error('Invalid FireBoard session');
  const start = Date.parse(session.start_time), end = Date.parse(session.end_time);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end > now) throw Error('Choose a completed session with valid start and end times');
  let temperatures = [];
  for (let index=0;index<value.chart.length;index++) {
    const series = value.chart[index];
    if (!Array.isArray(series.x) || !Array.isArray(series.y) || series.x.length !== series.y.length) throw Error('FireBoard series has unmatched times and values');
    const unit = Number(series.degreetype) === 1 ? 'C' : Number(series.degreetype) === 2 ? 'F' : null;
    if (!unit) throw Error('Unknown series units. Export temperature data without Drive percentage data');
    for (let i=0;i<series.x.length;i++) {
      const raw = series.x[i], ms = typeof raw === 'number' ? raw * (Math.abs(raw)<1e12 ? 1000 : 1) : Date.parse(raw);
      const temp = series.y[i];
      if (!Number.isFinite(ms) || typeof temp !== 'number' || !Number.isFinite(temp)) throw Error('Invalid temperature or time; entire session import stopped');
      temperatures.push({at:new Date(ms).toISOString(),value:temp,unit,channel:String(series.label || `Channel ${index+1}`),channelId:String(series.channel_id ?? index),deviceUUID:series.device || null,sessionId:String(session.id)});
      if (temperatures.length>500000) throw Error('Session exceeds supported sample limit');
    }
  }
  temperatures.sort((a,b)=>a.at.localeCompare(b.at));
  return { session, chart:value.chart, temperatures };
}
export function attachSession(state, cookId, exported) {
  const cook = state.records.find(c=>c.id===cookId);
  if (!cook) throw Error('Open the cook to receive this session');
  const imported = completedSession(exported);
  const id = String(imported.session.id);
  const prior = (cook.completedSessions || []).find(s=>String(s.session.id)===id);
  if (prior) {
    if (JSON.stringify(prior) !== JSON.stringify({session:imported.session,chart:imported.chart})) throw Error('Conflicting FireBoard session. Original import retained');
    return state;
  }
  if ((cook.legacy?.related?.cook_fireboard_sessions || []).some(s=>String(s.fireboard_session_id)===id)) throw Error('Session already exists in the migrated cook. Inspect before importing again');
  cook.completedSessions ||= [];
  cook.completedSessions.push({session:imported.session,chart:imported.chart});
  cook.temperatures.push(...imported.temperatures);
  return state;
}
// Distinguish devices/sessions and probe identities even if labels repeat.
export const seriesKey = sample => JSON.stringify([sample.sessionId || '',sample.deviceUUID || '',sample.channelId || sample.channel,sample.channel]);
export function comparisonSeries(cook, key) {
  const samples = cook.temperatures.filter(t=>seriesKey(t)===key);
  if (samples.some(t=>t.unit !== 'C' && t.unit !== 'F')) throw Error('Unknown temperature units; comparison stopped');
  return samples.map(t=>({minutes:(Date.parse(t.at)-Date.parse(cook.startedAt))/60000, fahrenheit:t.unit==='C'?t.value*9/5+32:t.value})).sort((a,b)=>a.minutes-b.minutes);
}
