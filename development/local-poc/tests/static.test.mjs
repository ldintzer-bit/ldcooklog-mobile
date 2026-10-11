import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const read=x=>readFileSync(join(root,x),'utf8');
test('every cached offline asset exists',()=>{
 const worker=read('service-worker.js');
 const paths=[...worker.matchAll(/'\.\/([^']+)'/g)].map(x=>x[1]);
 for(const path of paths){if(!path)continue;assert.ok(existsSync(join(root,path)),`missing ${path}`);}
});
test('prototype contains no cloud access tokens or Supabase integration',()=>{
 const sources=['index.html','app.js','db.js','backup.js','service-worker.js'];
 for(const source of sources){const content=read(source);assert.ok(!/supabase\.co|FIREBOARD_TOKEN|service_role|sb_secret_|Authorization:\s*`Bearer/.test(content),`${source} contains cloud credentials or integration`);}
});
test('HTML references local module scripts and manifest',()=>{
 const html=read('index.html');assert.match(html,/<script type="module" src="\.\/app\.js"/);assert.match(html,/manifest\.webmanifest/);assert.ok(!/https?:\/\//.test(html),'Unexpected external resources');
});
