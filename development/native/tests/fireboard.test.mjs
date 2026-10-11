import test from 'node:test';
import assert from 'node:assert/strict';
import {completedSession,attachSession,seriesKey,comparisonSeries} from '../Web/fireboard.js';
const exported = () => ({format:'ldcooklog-fireboard-completed',version:1,session:{id:123,start_time:'2026-01-01T00:00:00Z',end_time:'2026-01-01T01:00:00Z',title:'Synthetic'},chart:[{x:[1767225600,1767225660],y:[100,101],degreetype:1,label:'Food',device:'synthetic',channel_id:1}]});
const state = () => ({records:[{id:'test',startedAt:'2026-01-01T00:00:00Z',temperatures:[]}],relationalArchives:[]});
test('completed session retains raw chart, channels, units and exact sample count; repeated import is idempotent',()=>{
  const value=exported(), result=attachSession(state(),'test',value);
  assert.equal(result.records[0].temperatures.length,2);
  assert.deepEqual(result.records[0].completedSessions[0].chart,value.chart);
  attachSession(result,'test',value);
  assert.equal(result.records[0].temperatures.length,2);
  const samples=comparisonSeries(result.records[0],seriesKey(result.records[0].temperatures[0]));
  assert.equal(samples[0].fahrenheit,212); assert.equal(samples[1].minutes,1);
});
test('incomplete, malformed, unknown-unit or conflicting sessions stop without changing the cook',()=>{
  const base=exported();
  for (const modify of [v=>v.session.end_time=null,v=>v.session.end_time='2099-01-01T00:00:00Z',v=>v.chart[0].y.pop(),v=>v.chart[0].y[0]=null,v=>v.chart[0].degreetype=0]) {
    const value=structuredClone(base);modify(value); assert.throws(()=>completedSession(value));
  }
  const result=attachSession(state(),'test',base), changed=exported();changed.chart[0].y[0]=20;
  assert.throws(()=>attachSession(result,'test',changed),/Conflicting/);
  assert.equal(result.records[0].temperatures[0].value,100);
});
test('same channel labels on different devices are separate; unknown units cannot be graphed',()=>{
  const a={sessionId:'1',deviceUUID:'a',channel:'Pit'},b={...a,deviceUUID:'b'};
  assert.notEqual(seriesKey(a),seriesKey(b));
  assert.throws(()=>comparisonSeries({startedAt:'2026-01-01',temperatures:[{...a,unit:'unknown'}]},seriesKey(a)),/Unknown/);
});
