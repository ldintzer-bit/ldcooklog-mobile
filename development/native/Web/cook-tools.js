import { seriesKey } from './fireboard.js';
export function cookTargets(cook) {
  if(cook.targets)return cook.targets;
  const old=cook.legacy?.cook?.target_temp;
  const pit=old!==null && old!==undefined && old!==''?Number(old):null;
  return {unit:'F',pitF:Number.isFinite(pit) && pit>=0 && pit<=1000?pit:null,meatF:null};
}
export function targetText(value){return `Pit ${value.pitF===null?'not set':value.pitF+'°F'} · Meat ${value.meatF===null?'not set':value.meatF+'°F'}`;}
export function elapsedText(ms){if(ms===null)return 'Not recorded';const minutes=Math.floor(Math.max(0,ms)/60000);return `${Math.floor(minutes/60)}h ${minutes%60}m`;}
export function cookTimers(cook,now=Date.now()){
  const start=Date.parse(cook.startedAt),finish=cook.finishedAt || (cook.phase==='Finished'?cook.events.filter(e=>e.type==='Cook Finished').map(e=>e.at).sort().at(-1):null);
  if(cook.phase==='Finished' && !finish)return {waiting:false,totalMs:null,phaseMs:null,restMs:null,holdMs:null};
  const end=finish?Date.parse(finish):now;
  if(!Number.isFinite(start) || !Number.isFinite(end) || end<start)return {waiting:true,totalMs:0,phaseMs:null,restMs:0,holdMs:0};
  const phases={'Meat On':'Cooking','Rest Start':'Resting','Keep Warm':'Keeping Warm','Cook Finished':'Finished'};
  let phase=cook.phase==='Preparation'?'Preparation':'Cooking',at=start,rest=0,hold=0,lastTransition=null;
  const events=cook.events.map((event,index)=>({...event,index,time:Date.parse(event.at)})).filter(e=>phases[e.type] && e.time>=start && e.time<=end).sort((a,b)=>a.time-b.time || a.index-b.index);
  const accumulate=to=>{if(phase==='Resting')rest+=to-at;if(phase==='Keeping Warm')hold+=to-at;};
  for(const event of events){accumulate(event.time);phase=phases[event.type];at=event.time;lastTransition=event;}
  accumulate(end);
  const current=cook.phase || (cook.finishedAt?'Finished':'Cooking');
  const known=current===phase && (lastTransition || current==='Cooking' || current==='Preparation');
  return {waiting:false,totalMs:end-start,phaseMs:current==='Finished' || !known?null:end-at,restMs:rest,holdMs:hold};
}
export function assignedProbeLabel(cook,sample){
  const key=seriesKey(sample);
  const assignment=cook.cookingDetails?.fireboardSetup?.channels.find(p=>p.role!=='Not used' && p.seriesKey===key);
  if(!assignment)return sample.channel;
  const parts=[assignment.label || sample.channel];
  if(assignment.probeType==='Wireless' && assignment.color && assignment.color!=='Not recorded')parts.push(assignment.color==='Other'?assignment.customColor || 'Other':assignment.color);
  if(assignment.measurement && assignment.measurement!=='Not recorded')parts.push(assignment.measurement);
  return parts.join(' · ');
}
