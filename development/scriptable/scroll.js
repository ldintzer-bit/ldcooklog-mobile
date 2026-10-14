// Navigation only. Never saves, discards drafts or reads private recovery files.
(() => {
  const root=document.getElementById('ldc-scroll');
  let state={format:'ldcooklog-navigation',version:1,lastCook:null,recent:[],places:[]},ready=false,view='cook',selected=null,records=[],choices=[],openCook=null,writeTimer=null,writing=Promise.resolve(),restoring=false,restoreGeneration=0;
  const key=()=>view==='cook'?(selected?'cook:'+selected:null):'view:'+view;
  const hintError=()=>{hint.textContent='Remembering your place is unavailable. Cooking records and drafts are unaffected.';hint.hidden=false;};
  function persist(){
    if(!ready)return;clearTimeout(writeTimer);writeTimer=setTimeout(()=>{
      writeTimer=null;let text=JSON.stringify(state);
      while(text.length>32768 && state.places.length){state.places.shift();text=JSON.stringify(state);}
      writing=writing.catch(()=>{}).then(()=>window.ldcooklogHost.postMessage({operation:'writeNavigation',text})).catch(hintError);
    },500);
  }
  function capture(){
    const placeKey=key();if(!ready || restoring || !placeKey)return;
    const open=view==='cook'?[...document.querySelectorAll('#cookView details[id]')].filter(e=>e.open).map(e=>e.id).slice(0,64):[];
    state.places=state.places.filter(p=>p.key!==placeKey);state.places.push({key:placeKey,top:Math.max(0,root.scrollTop),open});state.places=state.places.slice(-80);persist();
  }
  function restore(){
    if(!ready)return;const place=state.places.find(p=>p.key===key()),generation=++restoreGeneration;restoring=true;
    if(view==='cook')for(const detail of document.querySelectorAll('#cookView details[id]'))detail.open=!!place?.open.includes(detail.id);
    root.scrollTo({top:place?.top || 0,behavior:'instant'});
    requestAnimationFrame(()=>{if(generation!==restoreGeneration)return;root.scrollTo({top:place?.top || 0,behavior:'instant'});restoring=false;});
  }
  function cancelRestore(){restoreGeneration++;restoring=false;}
  const context=document.createElement('div');context.id='ldc-context';context.hidden=true;
  const copy=document.createElement('span');copy.className='ldc-context-copy';const name=document.createElement('strong'),phase=document.createElement('small');name.id='ldc-context-name';phase.id='ldc-context-phase';copy.append(name,phase);
  const previous=document.createElement('button'),next=document.createElement('button');previous.id='ldc-previous';previous.textContent='Previous';previous.type='button';next.id='ldc-next';next.textContent='Next';next.type='button';context.append(copy,previous,next);document.querySelector('nav').append(context);
  const recent=document.createElement('div');recent.id='ldc-recent';document.getElementById('history').before(recent);
  function refresh(){
    const cook=records.find(c=>c.id===selected),index=choices.findIndex(c=>c.id===selected);
    context.hidden=view!=='cook' || !cook;root.classList.toggle('ldc-has-context',!context.hidden);
    if(cook){name.textContent=cook.food;name.title=cook.food+' · '+cook.cooker;phase.textContent=(cook.phase || (cook.finishedAt?'Finished':'Cooking'))+' · '+(index<0?'Outside History filter':`${index+1} of ${choices.length} · newest first`);}
    previous.disabled=index<=0;next.disabled=index<0 || index>=choices.length-1;
    previous.setAttribute('aria-label','Previous cook in filtered History, newer');next.setAttribute('aria-label','Next cook in filtered History, older');
    recent.replaceChildren();const active=choices.filter(c=>c.source==='LDCookLog 2.0' && !c.finishedAt && c.phase!=='Finished').map(c=>c.id);
    const ids=[...new Set([...active,...state.recent])].filter(id=>choices.some(c=>c.id===id)).slice(0,5);
    if(ids.length){const title=document.createElement('h3');title.textContent='Active and recently viewed';recent.append(title);for(const id of ids){const c=choices.find(c=>c.id===id),button=document.createElement('button');button.type='button';button.textContent=c.food+(active.includes(id)?' · Active':'')+(c.isTestCook?' · Test cook':'');button.addEventListener('click',()=>openCook(id));recent.append(button);}}
  }
  previous.addEventListener('click',()=>{const index=choices.findIndex(c=>c.id===selected);if(index>0)openCook(choices[index-1].id);});
  next.addEventListener('click',()=>{const index=choices.findIndex(c=>c.id===selected);if(index>=0 && index<choices.length-1)openCook(choices[index+1].id);});
  window.__ldcNavigation={
    load(text){try{if(text)state=validateNavigation(text);}catch{}},
    lastCook(items){return items.some(c=>c.id===state.lastCook)?state.lastCook:null;},
    beforeView:capture,
    refresh,
    restorePosition:restore,
    afterView(nextView,scroll){view=nextView;refresh();if(scroll)restore();},
    render(value){
      const changed=selected!==value.current;records=value.records;choices=value.cooks;openCook=value.openCook;view=value.view;selected=records.some(c=>c.id===value.current)?value.current:null;ready=true;
      const ids=new Set(records.map(c=>c.id));state.recent=state.recent.filter(id=>ids.has(id));state.places=state.places.filter(p=>!p.key.startsWith('cook:') || ids.has(p.key.slice(5)));
      if(selected){state.lastCook=selected;if(changed)state.recent=[selected,...state.recent.filter(id=>id!==selected)].slice(0,8);}else if(!ids.has(state.lastCook))state.lastCook=null;
      refresh();restore();persist();
    }
  };
  root.addEventListener('scroll',capture,{passive:true});
  for(const type of ['pointerdown','touchstart','wheel'])root.addEventListener(type,cancelRestore,{passive:true});
  document.getElementById('cookView').addEventListener('toggle',capture,true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)capture();});
  const label=document.createElement('label');label.id='ldc-jump-label';label.textContent='Go to section';
  const select=document.createElement('select');select.id='ldc-jump';
  select.append(new Option('Choose a section…',''));
  for(const [name,id] of [['Actions and timeline','active'],['Cook setup','setupPanel'],['FireBoard probes','fireboardPanel'],['Pit and meat targets','targetsPanel'],['Wrap method','wrapPanel'],['Notes and evaluation','reviewPanel'],['Temperature comparison','comparisonPanel'],['New cook','newCookSection']])select.append(new Option(name,id));
  label.append(select);document.getElementById('backupSummary').after(label);
  const hint=document.createElement('p');hint.id='ldc-jump-hint';hint.className='hint';hint.setAttribute('role','status');hint.hidden=true;label.after(hint);
  select.addEventListener('change',()=>{
    const target=document.getElementById(select.value);select.value='';if(!target)return;
    document.getElementById('navCook').click();
    cancelRestore();
    if(target.closest('[hidden]')){hint.textContent='Open a cook from History first, then choose its section.';hint.hidden=false;return;}
    hint.hidden=true;
    for(let ancestor=target;ancestor && ancestor!==root;ancestor=ancestor.parentElement)if(ancestor.tagName==='DETAILS')ancestor.open=true;
    target.scrollIntoView({behavior:'instant',block:'start'});
    capture();
    const summary=target.tagName==='DETAILS'?target.querySelector('summary'):null;
    if(summary)summary.focus({preventScroll:true});
  });
  const top=document.createElement('button');top.id='ldc-top';top.type='button';top.textContent='Top ↑';top.setAttribute('aria-label','Back to top and section choices');
  top.addEventListener('click',()=>{cancelRestore();root.scrollTo({top:0,behavior:'instant'});select.focus({preventScroll:true});capture();});
  document.body.append(top);
})();
