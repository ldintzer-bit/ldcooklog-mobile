from pathlib import Path

p=Path('index.html')
text=p.read_text()
if 'V1.28.1 Complete Cook Record — meat-piece cloud persistence' in text:
    raise SystemExit('V1.28.1 already applied')

script=r'''
<script>
// V1.28.1 Complete Cook Record — meat-piece cloud persistence.
(function(){
  let meatPieceSyncInProgress=false;
  let lastRecoveryMeatPieces=null;
  const numOrNull=v=>v===''||v===null||v===undefined?null:Number(v);
  function normalizedMeatPieces(){
    if(!Array.isArray(state.meatPieces)||!state.meatPieces.length)return [];
    return state.meatPieces.map((p,i)=>({
      piece_number:i+1,
      meat_cut:p.meatCut||null,
      package_weight:numOrNull(p.packageWeight),
      cook_weight:numOrNull(p.cookWeight),
      weight_unit:'lb',
      bone_status:p.boneStatus||null,
      brand_producer:p.brandProducer||null,
      store_source:p.storeSource||null,
      total_price:numOrNull(p.totalPrice),
      price_per_lb:numOrNull(p.pricePerLb),
      grade_type:p.gradeType||null,
      meat_note:p.meatNote||null
    }));
  }
  function fromCloud(row){return {
    pieceNumber:row.piece_number,
    meatCut:row.meat_cut||'',packageWeight:row.package_weight??'',cookWeight:row.cook_weight??'',
    boneStatus:row.bone_status||'',brandProducer:row.brand_producer||'',storeSource:row.store_source||'',
    totalPrice:row.total_price??'',pricePerLb:row.price_per_lb??'',gradeType:row.grade_type||'',meatNote:row.meat_note||''
  };}
  async function requestPieces(accessToken,cookUuid){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/cook_meat_pieces?select=piece_number,meat_cut,package_weight,cook_weight,weight_unit,bone_status,brand_producer,store_source,total_price,price_per_lb,grade_type,meat_note&cook_id=eq.${encodeURIComponent(cookUuid)}&order=piece_number.asc`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,Accept:'application/json'}});
    if(r.status===401)throw Object.assign(new Error('Session expired.'),{code:401});
    const data=await r.json();if(!r.ok)throw new Error(data.message||data.hint||data.details||'Meat pieces could not be read.');return data;
  }
  async function replacePieces(accessToken){
    let r=await fetch(`${SUPABASE_URL}/rest/v1/cook_meat_pieces?cook_id=eq.${encodeURIComponent(state.cloudCookUuid)}`,{method:'DELETE',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,Prefer:'return=minimal'}});
    if(r.status===401)throw Object.assign(new Error('Session expired.'),{code:401});
    if(!r.ok){const d=await r.json().catch(()=>null);throw new Error((d&&(d.message||d.hint||d.details))||'Existing meat pieces could not be updated.');}
    const rows=normalizedMeatPieces().map(row=>Object.assign({cook_id:state.cloudCookUuid},row));
    if(!rows.length)return true;
    r=await fetch(`${SUPABASE_URL}/rest/v1/cook_meat_pieces`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(rows)});
    if(r.status===401)throw Object.assign(new Error('Session expired.'),{code:401});
    if(!r.ok){const d=await r.json().catch(()=>null);throw new Error((d&&(d.message||d.hint||d.details))||'Meat pieces could not be saved.');}
    return true;
  }
  async function syncMeatPiecesToCloud(){
    if(meatPieceSyncInProgress)return false;
    if(!state.start||!state.cookId||!state.cloudCookUuid)return true;
    if(state.cloudConflict)return false;
    let session=loadCloudSession();if(!session||!session.access_token)return false;
    meatPieceSyncInProgress=true;
    try{
      try{await replacePieces(session.access_token);}catch(err){if(err.code!==401)throw err;session=await refreshCloudSession(session);await replacePieces(session.access_token);}
      return true;
    }catch(err){console.warn('Meat-piece cloud sync warning:',err);return false;}finally{meatPieceSyncInProgress=false;}
  }
  const priorSync=syncPendingEventsToCloud;
  syncPendingEventsToCloud=async function(){const ok=await priorSync();if(state.cloudCookUuid&&!state.cloudConflict)await syncMeatPiecesToCloud();return ok;};

  const priorRecovery=fetchCloudCookRecovery;
  fetchCloudCookRecovery=async function(accessToken,cookUuid){
    const recovery=await priorRecovery(accessToken,cookUuid);
    try{
      const rows=await requestPieces(accessToken,cookUuid);
      recovery.cook.meat_pieces=rows;
      lastRecoveryMeatPieces={cookUuid, pieces:rows.map(fromCloud)};
    }catch(err){recovery.cook.meat_pieces=null;recovery.cook.meat_pieces_error=err.message;}
    return recovery;
  };
  const priorRender=render;
  render=function(){
    if(lastRecoveryMeatPieces&&state.cloudCookUuid===lastRecoveryMeatPieces.cookUuid&&lastRecoveryMeatPieces.pieces.length){
      state.meatPieces=lastRecoveryMeatPieces.pieces.map(x=>Object.assign({},x));
      state.cookName=state.meatPieces[0].meatCut||state.cookName;
      state.weight=state.meatPieces[0].cookWeight===''?state.weight:String(state.meatPieces[0].cookWeight);
      lastRecoveryMeatPieces=null;
    }
    priorRender();
  };
  document.title='LDCookLog Mobile V1.28.1';
  const h=document.querySelector('header .sub');if(h)h.textContent='V1.28.1 Stateful BBQ Control Panel';
  const f=document.querySelector('.footer-note');if(f)f.innerHTML='V1.28.1 adds permanent Supabase save and recovery for individual meat-piece records while preserving local-first operation and Piece 1 compatibility.<br><strong>Build 2026-09-15B</strong>';
})();
</script>
'''
if '</body>' not in text: raise SystemExit('body anchor not found')
text=text.replace('</body>',script+'\n</body>',1)
p.write_text(text)

swp=Path('service-worker.js')
sw=swp.read_text()
old="const CACHE_NAME = 'ldcooklog-v1-28-0';"
new="const CACHE_NAME = 'ldcooklog-v1-28-1';"
if sw.count(old)!=1: raise SystemExit('cache anchor not found')
swp.write_text(sw.replace(old,new,1))
print('V1.28.1 meat-piece cloud persistence applied successfully.')
