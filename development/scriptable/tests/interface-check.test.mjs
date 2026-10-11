import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../LDCookLog-Interface-Check.js',import.meta.url),'utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
async function run(hang=false) {
  const messages=[],webs=[],tables=[];
  let question=0,completed=false;
  class WebView {
    constructor(){this.mode=String.fromCharCode(65+webs.length);webs.push(this)}
    async loadHTML(html,base) {
      assert.match(html,new RegExp('Interface test '+this.mode));
      assert.match(html,/Recovery protection/);assert.match(html,/New cook/);
      assert.equal(this.shouldAllowRequest({url:base}),true);
      assert.equal(this.shouldAllowRequest({url:'https://untrusted.invalid/'}),false);
      assert.match(html,/<button disabled/);assert.match(html,/<input disabled/);
      assert.match(html,/<style>/);
      assert.equal(html.includes('<script>'),this.mode!=='A');
      assert.equal(html.includes('<meta http-equiv="Content-Security-Policy"'),this.mode!=='C');
      if(hang && this.mode==='A')await new Promise(()=>{});
    }
    async present(){}
    evaluateJavaScript(){throw Error('The display probe must not start a live native bridge')}
  }
  class UITable {constructor(){this.rows=[];tables.push(this)}addRow(row){this.rows.push(row)}async present(){assert.match(this.rows[0].text,/LDCookLog native/)} }
  class UITableRow {addText(text){this.text=text} }
  class Alert {addAction(){}async presentAlert(){messages.push({title:this.title,message:this.message});return this.title.startsWith('Interface test ')?[0,0,1,0][question++]:0} }
  const Timer={schedule:(ms,repeats,callback)=>{assert.equal(ms,15000);assert.equal(repeats,false);const id=setTimeout(callback,10);return {invalidate:()=>clearTimeout(id)}}};
  await new AsyncFunction('WebView','UITable','UITableRow','Alert','Timer','Script',source)(WebView,UITable,UITableRow,Alert,Timer,{complete:()=>{completed=true}});
  assert.equal(completed,true);assert.equal(webs.length,3);assert.equal(tables.length,1);
  assert.equal(/FileManager|createStorage|new Request\(/.test(source),false);
  return messages.at(-1).message;
}
test('full-interface probe separates scripts/policy/native rendering and disables inputs without storage',async()=>{
  const result=await run();assert.match(result,/A: visible/);assert.match(result,/B: visible/);assert.match(result,/C: blank/);assert.match(result,/D: visible/);
});
test('hung interface load still reaches the independent native list probe',async()=>{
  const result=await run(true);assert.match(result,/A: error.*timed out/);assert.match(result,/D:/);
});
