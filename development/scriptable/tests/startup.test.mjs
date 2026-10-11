import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../LDCookLog-2-Development.js',import.meta.url),'utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;

async function launch(WebView) {
  const alerts=[];
  let touchedStorage=false,completed=false;
  const FileManager={local:()=>{touchedStorage=true;throw Error('Storage must not be touched on startup failure')},iCloud:()=>{}};
  const Timer={schedule:(ms,repeats,callback)=>{assert.equal(ms,15000);assert.equal(repeats,false);const timer=setTimeout(callback,10);return {invalidate:()=>clearTimeout(timer)}}};
  class Alert {addAction(value){assert.equal(value,'OK')}async presentAlert(){alerts.push({title:this.title,message:this.message})}}
  await new AsyncFunction('WebView','FileManager','UUID','Script','Timer','Alert',source)(WebView,FileManager,{}, {complete:()=>{completed=true}},Timer,Alert);
  assert.equal(completed,true);assert.equal(touchedStorage,false);
  assert.equal(alerts.length,1);
  assert.match(alerts[0].message,/No cooking data was reset/);
  return alerts[0].message;
}
test('initial offline navigation permitted, other navigation denied, hung load shows bounded diagnostic',async()=>{
  class WebView {loadHTML(html,url){assert.equal(this.shouldAllowRequest({url}),true);assert.equal(this.shouldAllowRequest({url:'https://untrusted.invalid/'}),false);return new Promise(()=>{})}}
  assert.match(await launch(WebView),/Loading the offline interface timed out/);
});
test('hung capability check shows bounded diagnostic before storage initialization',async()=>{
  class WebView {async loadHTML(){}evaluateJavaScript(){assert.equal(this.shouldAllowRequest({url:'https://ldcooklog.invalid/'}),true);return new Promise(()=>{})}}
  assert.match(await launch(WebView),/Checking the offline interface timed out/);
});
test('missing bundled script or unavailable checksum API stops before storage initialization',async()=>{
  class MissingScript {async loadHTML(){}async evaluateJavaScript(){return {bridge:false,validator:false,crypto:true}}}
  assert.match(await launch(MissingScript),/scripts did not initialize/);
  class MissingCrypto {async loadHTML(){}async evaluateJavaScript(){return {bridge:true,validator:true,crypto:false}}}
  assert.match(await launch(MissingCrypto),/secure checksum/);
});
