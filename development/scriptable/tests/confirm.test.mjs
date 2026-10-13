import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../confirm.js',import.meta.url),'utf8');
function setup(){
  const listeners=new Map(),document={};
  function node(tag){return {tag,inert:false,children:[],attributes:{},isConnected:true,
    setAttribute(k,v){this.attributes[k]=v},append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n)}},
    remove(){this.parent.children=this.parent.children.filter(n=>n!==this);this.isConnected=false},
    focus(){document.activeElement=this}};}
  document.body=node('body');const input=node('input'),alreadyInert=node('section');alreadyInert.inert=true;
  document.body.append(input,alreadyInert);document.activeElement=input;
  document.createElement=node;document.addEventListener=(k,v)=>listeners.set(k,v);document.removeEventListener=k=>listeners.delete(k);
  const window={};vm.runInNewContext(source,{window,document});
  const find=id=>{function walk(n){if(n.id===id)return n;for(const child of n.children){const found=walk(child);if(found)return found}}return walk(document.body)};
  return {window,document,listeners,input,alreadyInert,find};
}
test('restore confirmation is visible in the page, requires explicit acceptance and restores focus/inert state',async()=>{
  const {window,document,input,alreadyInert,find}=setup();let resolved=false;
  const result=window.__ldcConfirm('Restore 1 cooks from a verified copy?');result.then(()=>resolved=true);
  await Promise.resolve();assert.equal(resolved,false);
  assert.equal(find('ldc-confirm').attributes.role,'dialog');assert.equal(input.inert,true);
  assert.equal(find('ldc-confirm-yes').textContent,'Restore recovery copy');
  assert.equal(document.activeElement,find('ldc-confirm-no'));
  find('ldc-confirm-yes').onclick();assert.equal(await result,true);
  assert.equal(find('ldc-confirm'),undefined);assert.equal(input.inert,false);assert.equal(alreadyInert.inert,true);assert.equal(document.activeElement,input);
});
test('Cancel and Escape reject a journal change; concurrent confirmations cannot replace the active one',async()=>{
  const {window,find,listeners}=setup();const first=window.__ldcConfirm('Restore 1 cooks?');
  await assert.rejects(window.__ldcConfirm('Restore 2 cooks?'),/already open/);
  find('ldc-confirm-no').onclick();assert.equal(await first,false);
  const second=window.__ldcConfirm('Import the complete database export?');assert.equal(find('ldc-confirm-yes').textContent,'Import database export');
  let prevented=false;listeners.get('keydown')({key:'Escape',preventDefault(){prevented=true}});
  assert.equal(await second,false);assert.equal(prevented,true);assert.equal(listeners.size,0);
});
test('finish and discard confirmations use explicit action labels and Cancel remains the initial focus',async()=>{
 const {window,find,document}=setup();for(const [message,label] of [['Finish Synthetic ribs?','Finish cook'],['Discard all unsaved drafts?','Discard unsaved drafts']]){const result=window.__ldcConfirm(message);assert.equal(find('ldc-confirm-yes').textContent,label);assert.equal(document.activeElement,find('ldc-confirm-no'));find('ldc-confirm-no').onclick();assert.equal(await result,false);}
});
