// Optional editable metadata. Original relational rows remain immutable.
const pieceTextLimits={meatCut:300,boneStatus:40,brandProducer:300,storeSource:300,gradeType:300,meatNote:2000};
const pieceNumbers=['packageWeight','cookWeight','totalPrice','pricePerLb'];
export function blankMeatPiece(){return {meatCut:'',packageWeight:null,cookWeight:null,weightUnit:'lb',boneStatus:'',brandProducer:'',storeSource:'',totalPrice:null,pricePerLb:null,gradeType:'',meatNote:''};}
export function validateMeatPieces(rows){
 if(!Array.isArray(rows) || rows.length>32)throw Error('Use up to 32 meat pieces');
 for(const row of rows){if(!row || typeof row!=='object' || Array.isArray(row))throw Error('Invalid meat piece');
  for(const [key,limit] of Object.entries(pieceTextLimits))if(typeof row[key]!=='string' || row[key].length>limit)throw Error('Invalid meat piece '+key);
  if(!['','bone-in','boneless'].includes(row.boneStatus) || !['lb','kg','g','oz'].includes(row.weightUnit))throw Error('Invalid meat piece unit or bone status');
  for(const key of pieceNumbers)if(row[key]!==null && (!Number.isFinite(row[key]) || row[key]<0 || row[key]>10000000))throw Error('Meat weights and prices must be nonnegative numbers or blank');
 }
 return rows;
}
export function validateRubApplications(rows){
 if(!Array.isArray(rows) || rows.length>64)throw Error('Use up to 64 rub applications');
 for(const row of rows)if(!row || typeof row.name!=='string' || !row.name.trim() || row.name.length>300 || !['Not recorded','Light','Normal','Heavy'].includes(row.level) || typeof row.notes!=='string' || row.notes.length>2000)throw Error('Enter a rub name, application level and optional notes');
 return rows;
}
export function meatPiecesFor(cook){
 if(cook.cookingDetails?.meatPieces!==undefined)return structuredClone(cook.cookingDetails.meatPieces);
 return (cook.legacy?.related?.cook_meat_pieces || []).slice().sort((a,b)=>a.piece_number-b.piece_number).map(row=>{
  const piece=blankMeatPiece();for(const [key,source] of Object.entries({meatCut:'meat_cut',boneStatus:'bone_status',brandProducer:'brand_producer',storeSource:'store_source',gradeType:'grade_type',meatNote:'meat_note'}))piece[key]=String(row[source] ?? '');
  for(const [key,source] of Object.entries({packageWeight:'package_weight',cookWeight:'cook_weight',totalPrice:'total_price',pricePerLb:'price_per_lb'}))piece[key]=row[source]===null || row[source]===undefined || row[source]===''?null:Number(row[source]);
  piece.weightUnit=row.weight_unit || 'lb';return piece;
 });
}
export function rubApplicationsFor(cook){
 if(cook.cookingDetails?.rubApplications!==undefined)return structuredClone(cook.cookingDetails.rubApplications);
 return (cook.legacy?.related?.cook_rubs || []).map(row=>({name:(cook.legacy?.lookups?.rubs || []).find(r=>r.id===row.rub_id)?.name || 'Saved rub',level:row.application_level || 'Not recorded',notes:row.notes || ''}));
}
export function recipeChoices(state){
 const choices=new Map();
 for(const archive of state.relationalArchives || [])for(const row of archive.tables?.cook_methods?.rows || [])if(typeof row.name==='string' && row.name.trim() && row.name.length<=300){const name=row.name.trim();if(!choices.has(name.toLowerCase()))choices.set(name.toLowerCase(),{name,reference:typeof row.source_reference==='string'?row.source_reference:''});}
 for(const cook of state.records || [])if(!cook.isTestCook && typeof cook.cookingDetails?.method==='string' && cook.cookingDetails.method){const name=cook.cookingDetails.method;if(!choices.has(name.toLowerCase()))choices.set(name.toLowerCase(),{name,reference:cook.cookingDetails.recipeReference || ''});}
 return [...choices.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
