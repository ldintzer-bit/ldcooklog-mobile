// Read-only, explicitly selected cooking fields. Account-access rows and raw
// database identifiers are never part of this presentation.
export function originalCookingDetails(cook) {
  const legacy=cook.legacy || {}, related=legacy.related || {}, lookups=legacy.lookups || {}, groups=[];
  const fields=(row,labels)=>labels.filter(([key])=>row?.[key]!==null && row?.[key]!==undefined && row?.[key]!=='').map(([key,label])=>({label,value:String(row[key])}));
  function group(title,items){if(items.length)groups.push({title,items})}
  group('Original setup',[
    ...fields(legacy.cook,[['binder','Binder']]),
    ...['locations','cook_methods','equipment'].flatMap(key=>(lookups[key] || []).flatMap(row=>fields(row,[['name',{locations:'Location',cook_methods:'Method / recipe',equipment:'Equipment'}[key]],...(key==='cook_methods'?[['source_reference','Recipe / reference']]:[])])))
  ]);
  for(const row of related.cook_preparation || [])group('Original preparation',fields(row,[['trim_level','Trim'],['brine_marinade','Brine / marinade'],['injection','Injection'],['prep_notes','Preparation notes']]));
  for(const row of [...(related.cook_meat_pieces || [])].sort((a,b)=>a.piece_number-b.piece_number)){
    const items=fields(row,[['meat_cut','Cut'],['bone_status','Bone'],['brand_producer','Brand / producer'],['store_source','Store / source'],['grade_type','Grade'],['meat_note','Notes']]);
    for(const [key,label] of [['package_weight','Package weight'],['cook_weight','Cook weight']])if(row[key]!==null && row[key]!==undefined)items.push({label,value:`${row[key]} ${row.weight_unit || ''}`.trim()});
    for(const [key,label] of [['total_price','Total price'],['price_per_lb','Price per lb']])if(row[key]!==null && row[key]!==undefined)items.push({label,value:String(row[key])});
    group(`Original meat piece ${row.piece_number || ''}`.trim(),items);
  }
  for(const [table,lookup,key,title] of [['cook_rubs','rubs','rub_id','Original rub'],['cook_sauces','sauces','sauce_id','Original sauce']])for(const row of related[table] || []){
    const ref=(lookups[lookup] || []).find(value=>value.id===row[key]);
    group(title,[...fields(ref,[['name','Name']]),...fields(row,[['application_level','Application'],['notes','Notes']])]);
  }
  for(const row of related.cook_evaluations || [])group('Original evaluation',fields(row,[['overall_result','Overall result'],['bark','Bark'],['tenderness','Tenderness'],['observations','Observations'],['changes_next_time','Changes next time']]));
  for(const row of related.weather || [])group('Original weather',fields(row,[['temperature','Temperature'],['temperature_f','Temperature °F'],['conditions','Conditions'],['wind_speed','Wind speed'],['humidity','Humidity'],['notes','Notes']]));
  return groups;
}
export function reviewValues(cook) {
  if(cook.evaluationDetails)return cook.evaluationDetails;
  const row=cook.legacy?.related?.cook_evaluations?.[0] || {};
  return {overallResult:row.overall_result || '',bark:row.bark || '',tenderness:row.tenderness || '',observations:row.observations || '',changesNextTime:row.changes_next_time || ''};
}

export function setupChoices(state,kind){
  if(!['equipment','rubs','sauces'].includes(kind))throw Error('Unsupported setup library');
  const names=new Map();
  const add=value=>{if(typeof value!=='string')return;const name=value.trim();if(name && name.length<=1000 && !names.has(name.toLocaleLowerCase()))names.set(name.toLocaleLowerCase(),name);};
  for(const archive of state.relationalArchives || [])for(const row of archive.tables?.[kind]?.rows || [])add(row.name);
  for(const cook of state.records || [])if(!cook.isTestCook)for(const name of (typeof cook.cookingDetails?.[kind]==='string'?cook.cookingDetails[kind]:'').split(';'))add(name);
  return [...names.values()].sort((a,b)=>a.localeCompare(b));
}
