from pathlib import Path

p=Path('index.html')
text=p.read_text()

anchor="<section class=\"card\"><h2>Current State</h2>"
if text.count(anchor)!=1: raise SystemExit('Cook Setup/Current State anchor not found')

panel='''<section class="card" id="meatPiecesCard"><h2>Meat Pieces</h2><div class="sub" style="margin-bottom:10px">Optional details for each individual piece of meat. One piece is enough for a normal cook; add another only when needed.</div><div id="meatPiecesList"></div><button class="secondary" id="addMeatPiece" type="button" style="width:100%;margin-top:10px">Add Another Piece</button></section>\n'''
text=text.replace(anchor,panel+anchor,1)

script='''
<script>
// V1.28.0 Complete Cook Record — Stage 1 meat-piece UI/local persistence.
(function(){
  function blankPiece(n){return {pieceNumber:n,meatCut:'',packageWeight:'',cookWeight:'',boneStatus:'',brandProducer:'',storeSource:'',totalPrice:'',pricePerLb:'',gradeType:'',meatNote:''};}
  function ensurePieces(){
    if(!Array.isArray(state.meatPieces)||!state.meatPieces.length){
      state.meatPieces=[blankPiece(1)];
      state.meatPieces[0].meatCut=state.cookName||'';
      state.meatPieces[0].cookWeight=state.weight||'';
    }
    state.meatPieces.forEach((x,i)=>x.pieceNumber=i+1);
  }
  function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
  function field(label,key,p,type='text',extra=''){return `<div><label>${label}</label><input data-piece="${p}" data-key="${key}" type="${type}" value="${esc(state.meatPieces[p][key])}" ${extra}></div>`;}
  function renderPieces(){
    ensurePieces(); const host=document.getElementById('meatPiecesList'); if(!host)return;
    host.innerHTML=state.meatPieces.map((x,i)=>`<div class="metric" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><strong>Piece ${i+1}</strong>${state.meatPieces.length>1?`<button class="secondary removeMeatPiece" data-piece="${i}" type="button" style="min-height:34px;padding:6px 9px;font-size:12px">Remove</button>`:''}</div><div class="formrow" style="margin-top:10px">${field('Meat / Cut','meatCut',i)}${field('Bone','boneStatus',i).replace(`<input data-piece="${i}" data-key="boneStatus" type="text" value="${esc(x.boneStatus)}" >`,`<select data-piece="${i}" data-key="boneStatus"><option value="">Not recorded</option><option value="bone-in" ${x.boneStatus==='bone-in'?'selected':''}>Bone-in</option><option value="boneless" ${x.boneStatus==='boneless'?'selected':''}>Boneless</option></select>`)}</div><div class="formrow" style="margin-top:10px">${field('Package Weight (lb)','packageWeight',i,'number','step="0.1" inputmode="decimal"')}${field('Cook / Start Weight (lb)','cookWeight',i,'number','step="0.1" inputmode="decimal"')}</div><div class="formrow" style="margin-top:10px">${field('Brand / Producer','brandProducer',i)}${field('Store / Source','storeSource',i)}</div><div class="formrow" style="margin-top:10px">${field('Total Price ($)','totalPrice',i,'number','step="0.01" inputmode="decimal"')}${field('Price per lb ($)','pricePerLb',i,'number','step="0.01" inputmode="decimal"')}</div><div style="margin-top:10px">${field('Grade / Type','gradeType',i)}</div><div style="margin-top:10px"><label>Meat Note</label><textarea data-piece="${i}" data-key="meatNote" placeholder="Optional">${esc(x.meatNote)}</textarea></div></div>`).join('');
    host.querySelectorAll('[data-key]').forEach(el=>el.addEventListener('change',capture));
    host.querySelectorAll('textarea[data-key],input[data-key]').forEach(el=>el.addEventListener('input',capture));
    host.querySelectorAll('.removeMeatPiece').forEach(b=>b.addEventListener('click',()=>{state.meatPieces.splice(Number(b.dataset.piece),1);state.meatPieces.forEach((x,i)=>x.pieceNumber=i+1);save();renderPieces();}));
  }
  function capture(e){ensurePieces();const i=Number(e.target.dataset.piece),k=e.target.dataset.key;if(!state.meatPieces[i]||!k)return;state.meatPieces[i][k]=e.target.value;if(i===0&&k==='meatCut'){state.cookName=e.target.value;const old=document.getElementById('cookName');if(old)old.value=e.target.value;}if(i===0&&k==='cookWeight'){state.weight=e.target.value;const old=document.getElementById('weight');if(old)old.value=e.target.value;}save();}
  const oldSave=save;
  save=function(){ensurePieces();return oldSave();};
  const oldRender=render;
  render=function(){oldRender();renderPieces();};
  ensurePieces();
  const add=document.getElementById('addMeatPiece');if(add)add.addEventListener('click',()=>{ensurePieces();state.meatPieces.push(blankPiece(state.meatPieces.length+1));save();renderPieces();});
  renderPieces();
  const oldName=document.getElementById('cookName'),oldWeight=document.getElementById('weight');
  if(oldName)oldName.addEventListener('change',()=>{ensurePieces();state.meatPieces[0].meatCut=oldName.value;save();renderPieces();});
  if(oldWeight)oldWeight.addEventListener('change',()=>{ensurePieces();state.meatPieces[0].cookWeight=oldWeight.value;save();renderPieces();});
  document.title='LDCookLog Mobile V1.28.0';
  const headerSub=document.querySelector('header .sub');if(headerSub)headerSub.textContent='V1.28.0 Stateful BBQ Control Panel';
  const footer=document.querySelector('.footer-note');if(footer)footer.innerHTML='V1.28.0 begins the Complete Cook Record with optional individual meat-piece details and multiple-piece support. Existing Meat / Cut and Weight remain compatible with Piece 1.<br><strong>Build 2026-09-15A</strong>';
})();
</script>
'''
if '</body>' not in text: raise SystemExit('body anchor not found')
text=text.replace('</body>',script+'\n</body>',1)
p.write_text(text)

swp=Path('service-worker.js')
sw=swp.read_text()
old="const CACHE_NAME = 'ldcooklog-v1-27-1';"
new="const CACHE_NAME = 'ldcooklog-v1-28-0';"
if sw.count(old)!=1: raise SystemExit('cache anchor not found')
swp.write_text(sw.replace(old,new,1))
print('V1.28.0 Complete Cook Record Stage 1 patch applied successfully.')
