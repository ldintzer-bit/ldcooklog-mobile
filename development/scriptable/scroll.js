// Navigation only. Never saves, discards drafts or reads private recovery files.
(() => {
  const root=document.getElementById('ldc-scroll');
  const label=document.createElement('label');label.id='ldc-jump-label';label.textContent='Go to section';
  const select=document.createElement('select');select.id='ldc-jump';
  select.append(new Option('Choose a section…',''));
  for(const [name,id] of [['Actions and timeline','active'],['Cook setup','setupPanel'],['FireBoard probes','fireboardPanel'],['Pit and meat targets','targetsPanel'],['Wrap method','wrapPanel'],['Notes and evaluation','reviewPanel'],['Temperature comparison','comparisonPanel'],['New cook','newCookSection']])select.append(new Option(name,id));
  label.append(select);document.getElementById('backupSummary').after(label);
  const hint=document.createElement('p');hint.id='ldc-jump-hint';hint.className='hint';hint.setAttribute('role','status');hint.hidden=true;label.after(hint);
  select.addEventListener('change',()=>{
    const target=document.getElementById(select.value);select.value='';if(!target)return;
    document.getElementById('navCook').click();
    if(target.closest('[hidden]')){hint.textContent='Open a cook from History first, then choose its section.';hint.hidden=false;return;}
    hint.hidden=true;
    for(let ancestor=target;ancestor && ancestor!==root;ancestor=ancestor.parentElement)if(ancestor.tagName==='DETAILS')ancestor.open=true;
    target.scrollIntoView({behavior:'instant',block:'start'});
    const summary=target.tagName==='DETAILS'?target.querySelector('summary'):null;
    if(summary)summary.focus({preventScroll:true});
  });
  const top=document.createElement('button');top.id='ldc-top';top.type='button';top.textContent='Top ↑';top.setAttribute('aria-label','Back to top and section choices');
  top.addEventListener('click',()=>{root.scrollTo({top:0,behavior:'instant'});select.focus({preventScroll:true});});
  document.body.append(top);
})();
