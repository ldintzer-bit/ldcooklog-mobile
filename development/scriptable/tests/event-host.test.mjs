import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../launcher.js',import.meta.url),'utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('direct presentation stays idle; blocked wake signals drain serialized requests and stop after Close',async()=>{
  const queue=[{id:1,body:{operation:'read'}},{id:2,body:{operation:'backupStatus'}}], replies=[],calls=[];
  let view,finish,presented=false,complete=false,evaluations=0,active=0;
  const storage={read:async()=>({revision:0}),backupStatus:async()=>({pending:0}),commit:async(text,revision)=>{assert.equal(++active,1);await tick();calls.push([text,revision]);active--;return 'saved'}};
  class WebView {
    constructor(){view=this}
    async loadHTML(){}
    async evaluateJavaScript(code){
      evaluations++;
      if(code.includes('completion({bridge:'))return {bridge:true,validator:true,crypto:true,interface:true};
      if(code.includes('window.__ldcEnableSignals'))return;
      if(code.includes('window.__ldcTakeNow'))return JSON.stringify(queue.shift()||null);
      if(code.includes('document.getElementById'))return JSON.stringify('Journal ready.');
      if(code.includes('__ldcDeliver')){replies.push(JSON.parse(code.slice(code.indexOf('(')+1,code.lastIndexOf(')'))));return;}
      throw Error('Unexpected evaluation');
    }
    present(){presented=true;return new Promise(resolve=>{finish=resolve})}
  }
  const Timer={schedule:(ms,repeats,callback)=>{assert.equal(ms>=15000 || ms===10,true,'Only bounded startup or signal-triggered timers');const t=setTimeout(callback,ms);return {invalidate:()=>clearTimeout(t)}}};
  class Alert {addAction(){}async presentAlert(){throw Error(this.message)}}
  const running=new AsyncFunction('LDC_HTML','WebView','FileManager','UUID','createStorage','Timer','Alert','Script',source)('',WebView,{local:()=>({}),iCloud:()=>({})},{string:()=>''},()=>storage,Timer,Alert,{complete:()=>{complete=true}});
  while(!presented)await tick();
  const idle=evaluations;await tick();await tick();assert.equal(evaluations,idle);
  assert.equal(view.shouldAllowRequest({url:'https://untrusted.invalid/'}),false);
  queue.push({id:3,body:{operation:'commit',text:'one',expectedRevision:0}},{id:4,body:{operation:'commit',text:'two',expectedRevision:1}});
  assert.equal(view.shouldAllowRequest({url:'ldcooklog-bridge://wake'}),false);
  assert.equal(view.shouldAllowRequest({url:'ldcooklog-bridge://wake'}),false);
  while(replies.length<4)await tick();
  assert.deepEqual(calls,[['one',0],['two',1]]);
  await tick();const drained=evaluations;await tick();assert.equal(evaluations,drained);
  finish();await running;assert.equal(complete,true);
  view.shouldAllowRequest({url:'ldcooklog-bridge://wake'});await tick();assert.equal(evaluations,drained);
});
