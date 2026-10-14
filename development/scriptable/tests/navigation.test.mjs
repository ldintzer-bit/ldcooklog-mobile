import test from 'node:test';
import assert from 'node:assert/strict';
import {validateNavigation} from '../navigation.cjs';
const value=()=>({format:'ldcooklog-navigation',version:1,lastCook:'synthetic-cook',recent:['synthetic-cook'],places:[{key:'cook:synthetic-cook',top:521,open:['setupPanel','fireboardPanel']},{key:'view:history',top:100,open:[]}]});
test('navigation preferences retain exact cook identifiers, panel choices and position without cook content',()=>{
 const input=value();assert.deepEqual(validateNavigation(JSON.stringify(input)),input);assert.equal(JSON.stringify(input).includes('temperatures'),false);
});
test('invalid or unbounded navigation preferences are rejected before storage',()=>{
 for(const change of [{lastCook:'../secret'},{recent:['duplicate','duplicate']},{places:[{key:'other:private',top:0,open:[]}]},{places:[{key:'view:history',top:-1,open:[]}]},{places:[{key:'view:history',top:1,open:['bad <id>']}]},{places:[...value().places,...value().places]},{version:2}])assert.throws(()=>validateNavigation(JSON.stringify({...value(),...change})),/Invalid/);
 assert.throws(()=>validateNavigation(' '.repeat(32769)),/Invalid/);
});
