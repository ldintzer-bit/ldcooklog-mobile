import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../LDCookLog-Display-Check.js',import.meta.url),'utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
async function run(hang=false) {
  const messages=[],views=[];
  let question=0,completed=false;
  class WebView {
    constructor(){views.push(this);this.mode=String.fromCharCode(64+views.length)}
    async loadHTML(html,base) {
      assert.match(html,new RegExp('LDCookLog test '+this.mode));
      if(this.mode==='A') assert.equal(base,undefined);
      else {assert.equal(this.shouldAllowRequest({url:base}),true);assert.equal(this.shouldAllowRequest({url:'https://untrusted.invalid/'}),false)}
      if(hang && this.mode==='A')await new Promise(()=>{});
    }
    async evaluateJavaScript(){return {heading:'LDCookLog test '+this.mode,bodyHeight:300}}
    async present(){if(this.mode==='B')assert.equal(this.shouldAllowRequest({url:'https://ldcooklog.invalid/'}),false);if(this.mode==='C')assert.equal(this.shouldAllowRequest({url:'https://ldcooklog.invalid/'}),true)}
  }
  class Alert {
    addAction(){}
    async presentAlert(){messages.push({title:this.title,message:this.message});return this.title.startsWith('Test ')?[0,1,0][question++]:0}
  }
  const Timer={schedule:(ms,repeats,callback)=>{assert.equal(ms,15000);assert.equal(repeats,false);const id=setTimeout(callback,10);return {invalidate:()=>clearTimeout(id)}}};
  await new AsyncFunction('WebView','Alert','Timer','Script',source)(WebView,Alert,Timer,{complete:()=>{completed=true}});
  assert.equal(completed,true);assert.equal(views.length,3);
  return messages.at(-1).message;
}
test('display diagnostic separates baseline, blocked presentation and permitted presentation without file access',async()=>{
  const result=await run();
  assert.match(result,/A: visible/);assert.match(result,/B: blank; DOM height 300/);assert.match(result,/C: visible; DOM height 300/);
  assert.equal(/FileManager|new Request\(/.test(source),false);
});
test('hung first display load is bounded and remaining display checks still run',async()=>{
  const result=await run(true);
  assert.match(result,/A: error.*Loading test A timed out/);
  assert.match(result,/B:/);assert.match(result,/C:/);
});
