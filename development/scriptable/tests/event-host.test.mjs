import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../launcher.js',import.meta.url),'utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('direct presentation stays idle; blocked wake signals drain serialized requests and stop after Close',async()=>{
  const queue=[{id:1,body:{operation:'read'}},{id:2,body:{operation:'backupStatus'}}], replies=[],calls=[];
  let view,finish,presented=false,complete=false,evaluations=0,active=0,verify;
  const storage={read:async()=>({revision:0}),backupStatus:async()=>({pending:0}),commit:async(text,revision)=>{assert.equal(++active,1);await tick();assert.equal((await verify(text)).revision,1);calls.push([text,revision]);active--;return 'saved'}};
  class WebView {
    constructor(){view=this}
    async loadHTML(){}
    async evaluateJavaScript(code,callback){
      evaluations++;
      if(code.includes('completion({bridge:'))return {bridge:true,validator:true,crypto:true,interface:true};
      if(code.includes('window.__ldcEnableSignals')){assert.match(code,/ldcooklog-enabled/);return 'ldcooklog-enabled';}
      if(code.includes('window.__ldcVerify')){
        assert.equal(callback,true);
        const context=vm.createContext({window:{__ldcVerify:async()=>({revision:1})}});
        return new Promise((resolve,reject)=>{
          context.completion=resolve;
          const immediate=vm.runInContext(code,context);
          if(typeof immediate!=='string')reject(Error('Scriptable unsupported immediate return type'));
        });
      }
      if(code.includes('window.__ldcTakeNow'))return JSON.stringify(queue.shift()||null);
      if(code.includes('window.__ldcStartupReady')){
        assert.equal(callback,true);
        assert.equal(presented,false,'Wait until asynchronous startup rendering completes');
        await tick();await tick();await tick();
        assert.equal(presented,false);
        return 'Journal ready.';
      }
      if(code.includes('__ldcDeliver')){assert.match(code,/ldcooklog-delivered/);replies.push(JSON.parse(code.slice(code.indexOf('(')+1,code.lastIndexOf(')'))));return;}
      throw Error('Unexpected evaluation');
    }
    present(){presented=true;return new Promise(resolve=>{finish=resolve})}
  }
  const Timer={schedule:(ms,repeats,callback)=>{assert.equal(ms>=15000 || ms===10,true,'Only bounded startup or signal-triggered timers');const t=setTimeout(callback,ms);return {invalidate:()=>clearTimeout(t)}}};
  class Alert {addAction(){}async presentAlert(){throw Error(this.message)}}
  const running=new AsyncFunction('LDC_HTML','WebView','FileManager','UUID','createStorage','Timer','Alert','Script',source)('',WebView,{local:()=>({}),iCloud:()=>({})},{string:()=>''},(options)=>{verify=options.verify;return storage},Timer,Alert,{complete:()=>{complete=true}});
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

test('late checksum completion retains its own callback rather than replying to a newer verification',async()=>{
  const begin=source.indexOf('`{ const done = completion; window.__ldcVerify');
  assert.ok(begin>=0);
  const end=source.indexOf('`, true)',begin);
  const code=source.slice(begin+1,end).replace('${JSON.stringify(text)}','"synthetic"');
  const resolves=[],first=[],second=[];
  const context=vm.createContext({window:{__ldcVerify:()=>new Promise(resolve=>resolves.push(resolve))}});
  context.completion=value=>first.push(value);assert.equal(vm.runInContext(code,context),'ldcooklog-verification-started');
  context.completion=value=>second.push(value);vm.runInContext(code,context);
  resolves[1]({revision:2});resolves[0]({revision:1});await tick();
  assert.equal(first[0].revision,1);assert.equal(second[0].revision,2);
});


test('startup handshake waits for delayed page validation and returns a supported immediate type',async()=>{
  const begin=source.indexOf('`{ const done = completion; window.__ldcStartupReady');
  assert.ok(begin>=0);
  const end=source.indexOf('`, true)',begin);
  const code=source.slice(begin+1,end);
  let ready,answer;
  const context=vm.createContext({window:{__ldcStartupReady:new Promise(resolve=>{ready=resolve})},completion:value=>{answer=value}});
  assert.equal(vm.runInContext(code,context),'ldcooklog-startup-waiting');
  await tick();assert.equal(answer,undefined,'Read delivery alone does not prove the journal has rendered');
  ready('Journal ready.');await tick();assert.equal(answer,'Journal ready.');
});
