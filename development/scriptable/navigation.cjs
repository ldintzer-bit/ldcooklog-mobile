// Bounded, device-only navigation preferences. No cook content or credentials.
function validateNavigation(text) {
  if(typeof text!=='string' || text.length>32768)throw Error('Invalid navigation preferences');
  const value=JSON.parse(text),id=s=>typeof s==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(s);
  if(value?.format!=='ldcooklog-navigation' || value.version!==1 || !(value.lastCook===null || id(value.lastCook)) ||
     !Array.isArray(value.recent) || value.recent.length>8 || value.recent.some(s=>!id(s)) || new Set(value.recent).size!==value.recent.length ||
     !Array.isArray(value.places) || value.places.length>80)throw Error('Invalid navigation preferences');
  const seen=new Set();
  for(const place of value.places){
    if(!place || typeof place.key!=='string' || !/^(?:cook:[A-Za-z0-9_-]{1,128}|view:history|view:backups)$/.test(place.key) || seen.has(place.key) ||
       !Number.isFinite(place.top) || place.top<0 || place.top>10000000 || !Array.isArray(place.open) || place.open.length>64 ||
       place.open.some(s=>typeof s!=='string' || !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(s)) || new Set(place.open).size!==place.open.length)throw Error('Invalid navigation preferences');
    seen.add(place.key);
  }
  return {format:value.format,version:1,lastCook:value.lastCook,recent:[...value.recent],places:value.places.map(p=>({key:p.key,top:p.top,open:[...p.open]}))};
}
module.exports = {validateNavigation};
