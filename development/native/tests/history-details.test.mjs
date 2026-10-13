import test from 'node:test';
import assert from 'node:assert/strict';
import {originalCookingDetails,reviewValues} from '../Web/history-details.js';

test('original cooking details resolve names and keep zero weights without displaying IDs or account access',()=>{
 const cook={legacy:{cook:{id:'private-id',binder:'Mustard'},lookups:{equipment:[{id:'equipment-id',name:'Synthetic kettle'}],rubs:[{id:'rub-id',name:'Synthetic rub'}]},related:{cook_preparation:[{trim_level:'Light',brine_marinade:'Dry brine',injection:'No',prep_notes:'<img src=x onerror=alert(1)>'}],cook_meat_pieces:[{piece_number:1,meat_cut:'Synthetic ribs',cook_weight:0,weight_unit:'lb'}],cook_rubs:[{rub_id:'rub-id',application_level:'Light'}],fireboard_account_access:[{password:'SECRET FIXTURE'}],cook_evaluations:[{overall_result:'Good',bark:'Excellent',tenderness:'Just Right',changes_next_time:'Less smoke'}]}}};
 const before=structuredClone(cook),groups=originalCookingDetails(cook),text=JSON.stringify(groups);
 assert.match(text,/Synthetic kettle/);assert.match(text,/Synthetic rub/);assert.match(text,/0 lb/);assert.match(text,/Original evaluation/);
 assert.doesNotMatch(text,/private-id|equipment-id|rub-id|SECRET FIXTURE|fireboard_account_access/);
 assert.deepEqual(cook,before);
 assert.deepEqual(reviewValues(cook),{overallResult:'Good',bark:'Excellent',tenderness:'Just Right',observations:'',changesNextTime:'Less smoke'});
});
test('saved evaluation overrides its original presentation without changing legacy evidence',()=>{
 const cook={evaluationDetails:{overallResult:'Excellent'},legacy:{related:{cook_evaluations:[{overall_result:'Good'}]}}};
 assert.equal(reviewValues(cook).overallResult,'Excellent');assert.equal(cook.legacy.related.cook_evaluations[0].overall_result,'Good');assert.deepEqual(originalCookingDetails({}),[]);
});
